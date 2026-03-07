from __future__ import annotations

from datetime import datetime, timedelta
import secrets
import string
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.invitation import (
    Invitation,
    InvitationApprovalMode,
    InvitationDeliveryMode,
    InvitationLifecycleStatus,
    InvitationType,
)
from app.models.org_member import GlobalRole, InvitationStatus, MemberType, OrgMember
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User


class InvitationService:
    INTERNAL_LINK_EXPIRY_HOURS = 24
    PIN_LENGTH = 6

    @staticmethod
    def _generate_token(db: Session) -> str:
        while True:
            token = secrets.token_urlsafe(24)
            exists = db.query(Invitation).filter(Invitation.token == token).first()
            if not exists:
                return token

    @staticmethod
    def _generate_pin_code(db: Session) -> str:
        digits = string.digits
        while True:
            pin_code = "".join(secrets.choice(digits) for _ in range(InvitationService.PIN_LENGTH))
            exists = db.query(Invitation).filter(Invitation.pin_code == pin_code).first()
            if not exists:
                return pin_code

    @staticmethod
    def _get_org_admin_membership(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> OrgMember:
        membership = (
            db.query(OrgMember)
            .filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id)
            .first()
        )
        if not membership or membership.global_role != GlobalRole.ADMIN:
            raise HTTPException(status_code=403, detail="Organization admin permissions required")
        return membership

    @staticmethod
    def _get_invitation_by_locator(
        db: Session,
        *,
        token: str | None = None,
        pin_code: str | None = None,
    ) -> Invitation:
        invitation = None
        if token:
            invitation = db.query(Invitation).filter(Invitation.token == token).first()
        elif pin_code:
            invitation = db.query(Invitation).filter(Invitation.pin_code == pin_code).first()

        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status == InvitationLifecycleStatus.REVOKED:
            raise HTTPException(status_code=410, detail="Invitation has been removed")
        if invitation.status == InvitationLifecycleStatus.DECLINED:
            raise HTTPException(status_code=410, detail="Invitation has been declined")
        if invitation.expires_at and invitation.expires_at < datetime.utcnow():
            raise HTTPException(status_code=410, detail="Invitation has expired")
        return invitation

    @staticmethod
    def _ensure_team_in_org(db: Session, org_id: uuid.UUID, team_id: uuid.UUID) -> Team:
        team = db.query(Team).filter(Team.id == team_id, Team.org_id == org_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        return team

    @staticmethod
    def _ensure_matching_internal_identity(invitation: Invitation, user: User) -> None:
        if invitation.member_type != MemberType.INTERNAL:
            return
        if invitation.invited_email and user.email and invitation.invited_email.lower() != user.email.lower():
            raise HTTPException(status_code=403, detail="Invitation email does not match the authenticated user")
        if invitation.invited_email and not user.email:
            raise HTTPException(status_code=403, detail="An email address is required to accept this invitation")

    @staticmethod
    def _upsert_membership(
        db: Session,
        *,
        invitation: Invitation,
        user_id: uuid.UUID,
    ) -> OrgMember:
        membership = (
            db.query(OrgMember)
            .filter(OrgMember.org_id == invitation.org_id, OrgMember.user_id == user_id)
            .first()
        )
        if membership:
            membership.invitation_status = InvitationStatus.ACCEPTED
            if invitation.member_type == MemberType.INTERNAL:
                membership.member_type = MemberType.INTERNAL
            return membership

        membership = OrgMember(
            user_id=user_id,
            org_id=invitation.org_id,
            global_role=GlobalRole.MEMBER,
            member_type=invitation.member_type,
            invited_by=invitation.created_by,
            invitation_status=InvitationStatus.ACCEPTED,
        )
        db.add(membership)
        db.flush()
        return membership

    @staticmethod
    def _ensure_team_membership(db: Session, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
        existing = (
            db.query(TeamMember)
            .filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
            .first()
        )
        if existing:
            return
        db.add(TeamMember(team_id=team_id, user_id=user_id))
        db.flush()

    @staticmethod
    def _finalize_invitation(db: Session, invitation: Invitation, user_id: uuid.UUID) -> OrgMember:
        membership = InvitationService._upsert_membership(db, invitation=invitation, user_id=user_id)
        if invitation.invitation_type == InvitationType.TEAM and invitation.team_id:
            InvitationService._ensure_team_membership(db, invitation.team_id, user_id)

        invitation.status = InvitationLifecycleStatus.ACCEPTED
        invitation.accepted_by = user_id
        invitation.accepted_at = datetime.utcnow()
        if invitation.approval_mode == InvitationApprovalMode.AUTO and invitation.approved_at is None:
            invitation.approved_at = datetime.utcnow()
            invitation.approved_by = invitation.created_by

        db.commit()
        db.refresh(invitation)
        db.refresh(membership)
        return membership

    @staticmethod
    def create_internal_invitation(
        db: Session,
        *,
        org_id: uuid.UUID,
        created_by: uuid.UUID,
        invited_email: str | None,
        delivery_mode: InvitationDeliveryMode,
    ) -> Invitation:
        InvitationService._get_org_admin_membership(db, org_id, created_by)
        if delivery_mode not in {InvitationDeliveryMode.EMAIL, InvitationDeliveryMode.SHORT_LINK}:
            raise HTTPException(status_code=400, detail="Internal invitations support email or short_link delivery only")
        if delivery_mode == InvitationDeliveryMode.EMAIL and not invited_email:
            raise HTTPException(status_code=400, detail="Email delivery requires invited_email")

        invitation = Invitation(
            org_id=org_id,
            invitation_type=InvitationType.ORGANIZATION,
            member_type=MemberType.INTERNAL,
            delivery_mode=delivery_mode,
            approval_mode=InvitationApprovalMode.AUTO,
            status=InvitationLifecycleStatus.APPROVED,
            invited_email=invited_email,
            token=InvitationService._generate_token(db),
            created_by=created_by,
            expires_at=datetime.utcnow() + timedelta(hours=InvitationService.INTERNAL_LINK_EXPIRY_HOURS),
            approved_by=created_by,
            approved_at=datetime.utcnow(),
        )
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        return invitation

    @staticmethod
    def create_contractor_invitation(
        db: Session,
        *,
        org_id: uuid.UUID,
        team_id: uuid.UUID,
        created_by: uuid.UUID,
        delivery_mode: InvitationDeliveryMode,
        approval_mode: InvitationApprovalMode,
    ) -> Invitation:
        InvitationService._get_org_admin_membership(db, org_id, created_by)
        InvitationService._ensure_team_in_org(db, org_id, team_id)
        if delivery_mode not in {InvitationDeliveryMode.GENERATED_LINK, InvitationDeliveryMode.PIN_CODE}:
            raise HTTPException(status_code=400, detail="Contractor invitations support generated_link or pin_code delivery only")

        invitation = Invitation(
            org_id=org_id,
            team_id=team_id,
            invitation_type=InvitationType.TEAM,
            member_type=MemberType.CONTRACTOR,
            delivery_mode=delivery_mode,
            approval_mode=approval_mode,
            status=(
                InvitationLifecycleStatus.APPROVED
                if approval_mode == InvitationApprovalMode.AUTO
                else InvitationLifecycleStatus.PENDING
            ),
            token=InvitationService._generate_token(db) if delivery_mode == InvitationDeliveryMode.GENERATED_LINK else None,
            pin_code=InvitationService._generate_pin_code(db) if delivery_mode == InvitationDeliveryMode.PIN_CODE else None,
            created_by=created_by,
            approved_by=created_by if approval_mode == InvitationApprovalMode.AUTO else None,
            approved_at=datetime.utcnow() if approval_mode == InvitationApprovalMode.AUTO else None,
        )
        db.add(invitation)
        db.commit()
        db.refresh(invitation)
        return invitation

    @staticmethod
    def list_invitations(db: Session, *, org_id: uuid.UUID, requested_by: uuid.UUID) -> list[Invitation]:
        InvitationService._get_org_admin_membership(db, org_id, requested_by)
        return (
            db.query(Invitation)
            .filter(Invitation.org_id == org_id)
            .order_by(Invitation.created_at.desc())
            .all()
        )

    @staticmethod
    def approve_invitation(
        db: Session,
        *,
        org_id: uuid.UUID,
        invitation_id: uuid.UUID,
        approved_by: uuid.UUID,
    ) -> Invitation:
        InvitationService._get_org_admin_membership(db, org_id, approved_by)
        invitation = db.query(Invitation).filter(Invitation.id == invitation_id, Invitation.org_id == org_id).first()
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status != InvitationLifecycleStatus.PENDING:
            raise HTTPException(status_code=409, detail="Only pending invitations can be approved")
        if invitation.approval_mode != InvitationApprovalMode.REVIEW:
            raise HTTPException(status_code=409, detail="Only review-mode invitations require approval")

        invitation.approved_by = approved_by
        invitation.approved_at = datetime.utcnow()
        if invitation.claimed_by:
            InvitationService._finalize_invitation(db, invitation, invitation.claimed_by)
        else:
            invitation.status = InvitationLifecycleStatus.APPROVED
            db.commit()
            db.refresh(invitation)
        return invitation

    @staticmethod
    def revoke_invitation(
        db: Session,
        *,
        org_id: uuid.UUID,
        invitation_id: uuid.UUID,
        revoked_by: uuid.UUID,
    ) -> None:
        InvitationService._get_org_admin_membership(db, org_id, revoked_by)
        invitation = db.query(Invitation).filter(Invitation.id == invitation_id, Invitation.org_id == org_id).first()
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status == InvitationLifecycleStatus.ACCEPTED:
            raise HTTPException(status_code=409, detail="Accepted invitations cannot be removed")
        invitation.status = InvitationLifecycleStatus.REVOKED
        invitation.revoked_at = datetime.utcnow()
        db.commit()

    @staticmethod
    def accept_invitation(
        db: Session,
        *,
        user: User,
        token: str | None = None,
        pin_code: str | None = None,
    ) -> tuple[str, Invitation, OrgMember | None]:
        invitation = InvitationService._get_invitation_by_locator(db, token=token, pin_code=pin_code)
        if invitation.status == InvitationLifecycleStatus.ACCEPTED:
            raise HTTPException(status_code=409, detail="Invitation has already been accepted")

        InvitationService._ensure_matching_internal_identity(invitation, user)

        if invitation.status == InvitationLifecycleStatus.PENDING and invitation.approval_mode == InvitationApprovalMode.REVIEW:
            if invitation.claimed_by and invitation.claimed_by != user.id:
                raise HTTPException(status_code=409, detail="Invitation is already claimed by another user")
            invitation.claimed_by = user.id
            invitation.claimed_at = datetime.utcnow()
            db.commit()
            db.refresh(invitation)
            return "pending_review", invitation, None

        if invitation.status not in {InvitationLifecycleStatus.APPROVED, InvitationLifecycleStatus.PENDING}:
            raise HTTPException(status_code=409, detail="Invitation cannot be accepted in its current state")

        if invitation.claimed_by and invitation.claimed_by != user.id:
            raise HTTPException(status_code=409, detail="Invitation is already claimed by another user")
        if invitation.claimed_by is None:
            invitation.claimed_by = user.id
            invitation.claimed_at = datetime.utcnow()

        membership = InvitationService._finalize_invitation(db, invitation, user.id)
        return "accepted", invitation, membership