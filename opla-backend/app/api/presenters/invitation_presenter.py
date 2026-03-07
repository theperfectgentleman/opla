from app.api.schemas.organization import InvitationOut
from app.models.invitation import Invitation


def serialize_invitation(invitation: Invitation) -> InvitationOut:
    return InvitationOut(
        id=invitation.id,
        org_id=invitation.org_id,
        org_name=invitation.organization.name if invitation.organization else None,
        team_id=invitation.team_id,
        team_name=invitation.team.name if invitation.team else None,
        invitation_type=invitation.invitation_type,
        member_type=invitation.member_type,
        delivery_mode=invitation.delivery_mode,
        approval_mode=invitation.approval_mode,
        status=invitation.status,
        invited_email=invitation.invited_email,
        token=invitation.token,
        pin_code=invitation.pin_code,
        created_by=invitation.created_by,
        claimed_by=invitation.claimed_by,
        approved_by=invitation.approved_by,
        accepted_by=invitation.accepted_by,
        claimed_at=invitation.claimed_at,
        approved_at=invitation.approved_at,
        accepted_at=invitation.accepted_at,
        expires_at=invitation.expires_at,
        revoked_at=invitation.revoked_at,
        created_at=invitation.created_at,
        updated_at=invitation.updated_at,
    )