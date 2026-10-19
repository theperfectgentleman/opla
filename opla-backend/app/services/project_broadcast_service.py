"""SMS broadcasts: audience preview, queueing, batched sending, retry, opt-outs."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timedelta
from itertools import islice
from typing import Iterable, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.project import Project
from app.models.project_broadcast import (
    BroadcastStatus,
    DeliveryStatus,
    OrgMessageOptOut,
    ProjectBroadcast,
    ProjectBroadcastDelivery,
)
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.services.sms.contacts import AudienceResult, ContactInput, build_audience, render_message
from app.services.sms.phone import normalize_phone
from app.services.sms.providers import SendResult, SmsProvider, get_sms_provider
from app.services.sms.segments import count_segments

logger = logging.getLogger(__name__)

MAX_BODY_CHARS = 1600  # ~10 GSM parts; longer blasts are almost always a mistake
STALE_SENDING_AFTER = timedelta(minutes=15)


def _chunks(items: list, size: int) -> Iterable[list]:
    iterator = iter(items)
    while True:
        chunk = list(islice(iterator, size))
        if not chunk:
            return
        yield chunk


class ProjectBroadcastService:
    # ------------------------------------------------------------------ audience
    @staticmethod
    def team_contacts(db: Session, org_id: uuid.UUID, team_ids: list[uuid.UUID]) -> tuple[list[ContactInput], list[dict]]:
        """Team members as contacts, plus members who have no phone on their profile."""
        if not team_ids:
            return [], []
        teams = db.query(Team).filter(Team.org_id == org_id, Team.id.in_(team_ids)).all()
        found = {team.id for team in teams}
        missing = [str(team_id) for team_id in team_ids if team_id not in found]
        if missing:
            raise HTTPException(status_code=404, detail="One or more teams were not found in this organisation")

        order = {team_id: index for index, team_id in enumerate(team_ids)}
        teams.sort(key=lambda team: order.get(team.id, 0))
        contacts: list[ContactInput] = []
        without_phone: list[dict] = []
        for team in teams:
            rows = (
                db.query(TeamMember, User)
                .join(User, User.id == TeamMember.user_id)
                .filter(TeamMember.team_id == team.id)
                .order_by(User.full_name.asc())
                .all()
            )
            for _membership, user in rows:
                if not user.is_active:
                    continue
                if not (user.phone or "").strip():
                    without_phone.append({"user_id": str(user.id), "name": user.full_name, "team_name": team.name})
                    continue
                contacts.append(
                    ContactInput(
                        phone=user.phone,
                        name=user.full_name,
                        source="team",
                        user_id=str(user.id),
                        team_id=str(team.id),
                        team_name=team.name,
                    )
                )
        return contacts, without_phone

    @staticmethod
    def opted_out_phones(db: Session, org_id: uuid.UUID) -> set[str]:
        rows = db.query(OrgMessageOptOut.phone).filter(
            OrgMessageOptOut.org_id == org_id, OrgMessageOptOut.channel == "sms"
        )
        return {phone for (phone,) in rows}

    @staticmethod
    def resolve_audience(
        db: Session,
        org_id: uuid.UUID,
        *,
        team_ids: list[uuid.UUID],
        contacts: list[ContactInput],
        provider: SmsProvider,
    ) -> tuple[AudienceResult, list[dict]]:
        team_contacts, without_phone = ProjectBroadcastService.team_contacts(db, org_id, team_ids)
        audience = build_audience(
            [*team_contacts, *contacts],
            opted_out=ProjectBroadcastService.opted_out_phones(db, org_id),
            supports=provider.supports,
        )
        return audience, without_phone

    @staticmethod
    def estimate(message: str, audience: AudienceResult, name_fallback: str = "") -> dict:
        template = count_segments(message)
        credits = 0
        max_parts = 0
        for recipient in audience.recipients:
            parts = count_segments(render_message(message, recipient.name, name_fallback)).parts
            credits += parts
            max_parts = max(max_parts, parts)
        return {
            "encoding": template.encoding,
            "length": template.length,
            "parts": template.parts,
            "max_parts": max_parts,
            "estimated_credits": credits,
        }

    @staticmethod
    def validate_message(message: str) -> str:
        text = (message or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Type a message first")
        if len(text) > MAX_BODY_CHARS:
            raise HTTPException(status_code=400, detail=f"Message is too long (max {MAX_BODY_CHARS} characters)")
        return text

    # ------------------------------------------------------------------ create
    @staticmethod
    def create_broadcast(
        db: Session,
        project: Project,
        user: User,
        *,
        message: str,
        team_ids: list[uuid.UUID],
        contacts: list[ContactInput],
        name_fallback: str = "",
        expected_recipient_count: Optional[int] = None,
        provider: SmsProvider,
    ) -> ProjectBroadcast:
        if not provider.is_configured():
            raise HTTPException(status_code=503, detail=provider.config_issue() or "SMS is not enabled")
        text = ProjectBroadcastService.validate_message(message)
        audience, without_phone = ProjectBroadcastService.resolve_audience(
            db, project.org_id, team_ids=team_ids, contacts=contacts, provider=provider
        )
        if not audience.recipients:
            raise HTTPException(status_code=400, detail="No valid recipients to send to")
        if len(audience.recipients) > settings.SMS_MAX_RECIPIENTS:
            raise HTTPException(
                status_code=400,
                detail=f"Too many recipients ({len(audience.recipients)}). The limit is {settings.SMS_MAX_RECIPIENTS} per broadcast.",
            )
        if expected_recipient_count is not None and expected_recipient_count != len(audience.recipients):
            raise HTTPException(
                status_code=409,
                detail="The recipient list changed since you reviewed it. Check the preview and confirm again.",
            )

        fallback = (name_fallback or "").strip()
        estimate = ProjectBroadcastService.estimate(text, audience, fallback)
        teams = (
            db.query(Team).filter(Team.org_id == project.org_id, Team.id.in_(team_ids)).all() if team_ids else []
        )
        broadcast = ProjectBroadcast(
            org_id=project.org_id,
            project_id=project.id,
            created_by=user.id,
            channel="sms",
            provider=provider.name,
            sender_id=provider.sender_id or None,
            body=text,
            name_fallback=fallback or None,
            status=BroadcastStatus.QUEUED,
            recipient_count=len(audience.recipients),
            estimated_credits=estimate["estimated_credits"],
            audience_json={
                "teams": [{"id": str(team.id), "name": team.name} for team in teams],
                "csv_count": sum(1 for c in contacts if c.source == "csv"),
                "manual_count": sum(1 for c in contacts if c.source == "manual"),
                "invalid_count": len(audience.invalid),
                "unsupported_count": len(audience.unsupported),
                "opted_out_count": len(audience.opted_out),
                "duplicates_removed": audience.duplicates_removed,
                "members_without_phone": len(without_phone),
            },
        )
        db.add(broadcast)
        db.flush()
        for recipient in audience.recipients:
            db.add(
                ProjectBroadcastDelivery(
                    broadcast_id=broadcast.id,
                    phone=recipient.phone,
                    name=recipient.name,
                    user_id=uuid.UUID(recipient.user_id) if recipient.user_id else None,
                    sources=recipient.sources,
                    team_names=recipient.team_names or None,
                    parts=count_segments(render_message(text, recipient.name, fallback)).parts,
                    status=DeliveryStatus.QUEUED,
                )
            )
        db.commit()
        db.refresh(broadcast)
        return broadcast

    # ------------------------------------------------------------------ send
    @staticmethod
    def _claim(db: Session, broadcast_id: uuid.UUID) -> bool:
        """Mark a broadcast as sending unless another worker already is (stale claims expire)."""
        now = datetime.utcnow()
        claimed = (
            db.query(ProjectBroadcast)
            .filter(
                ProjectBroadcast.id == broadcast_id,
                (ProjectBroadcast.status != BroadcastStatus.SENDING)
                | (ProjectBroadcast.started_at < now - STALE_SENDING_AFTER),
            )
            .update(
                {ProjectBroadcast.status: BroadcastStatus.SENDING, ProjectBroadcast.started_at: now},
                synchronize_session=False,
            )
        )
        db.commit()
        return claimed == 1

    @staticmethod
    def process_broadcast(
        db: Session,
        broadcast_id: uuid.UUID,
        *,
        provider: SmsProvider,
        batch_size: Optional[int] = None,
        delay_seconds: Optional[float] = None,
    ) -> ProjectBroadcast | None:
        batch_size = max(1, int(batch_size or settings.SMS_BATCH_SIZE))
        delay = settings.SMS_BATCH_DELAY_SECONDS if delay_seconds is None else delay_seconds

        if not ProjectBroadcastService._claim(db, broadcast_id):
            logger.info("Broadcast %s is already sending; skipping", broadcast_id)
            return None
        broadcast = db.query(ProjectBroadcast).filter(ProjectBroadcast.id == broadcast_id).first()
        if broadcast is None:
            return None

        queued = (
            db.query(ProjectBroadcastDelivery)
            .filter(
                ProjectBroadcastDelivery.broadcast_id == broadcast_id,
                ProjectBroadcastDelivery.status == DeliveryStatus.QUEUED,
            )
            .order_by(ProjectBroadcastDelivery.created_at.asc(), ProjectBroadcastDelivery.phone.asc())
            .all()
        )

        # One provider request per batch of recipients that get the same text.
        groups: dict[str, list[ProjectBroadcastDelivery]] = {}
        for delivery in queued:
            text = render_message(broadcast.body, delivery.name, broadcast.name_fallback or "")
            groups.setdefault(text, []).append(delivery)

        credits_used = broadcast.credits_used or 0.0
        any_credit_report = broadcast.credits_used is not None
        last_error: Optional[str] = None
        first_request = True
        for text, deliveries in groups.items():
            for batch in _chunks(deliveries, batch_size):
                if not first_request and delay > 0:
                    time.sleep(delay)
                first_request = False
                try:
                    result = provider.send([d.phone for d in batch], text)
                except Exception as exc:  # never leave rows stuck in "queued" because of one bad batch
                    logger.exception("SMS batch failed for broadcast %s", broadcast_id)
                    result = SendResult(False, error=f"Unexpected error: {type(exc).__name__}")
                now = datetime.utcnow()
                for delivery in batch:
                    delivery.attempts = (delivery.attempts or 0) + 1
                    if result.success and delivery.phone not in result.rejected:
                        delivery.status = DeliveryStatus.SENT
                        delivery.sent_at = now
                        delivery.provider_ref = result.provider_ref
                        delivery.error = None
                    else:
                        delivery.status = DeliveryStatus.FAILED
                        delivery.provider_ref = result.provider_ref
                        delivery.error = (
                            "Rejected by the SMS provider" if result.success else (result.error or "Send failed")
                        )
                if result.credits_used is not None:
                    credits_used += result.credits_used
                    any_credit_report = True
                if not result.success:
                    last_error = result.error
                db.commit()

        ProjectBroadcastService._finalise(db, broadcast, credits_used if any_credit_report else None, last_error)
        return broadcast

    @staticmethod
    def _finalise(db: Session, broadcast: ProjectBroadcast, credits_used: Optional[float], last_error: Optional[str]):
        counts = dict.fromkeys((DeliveryStatus.QUEUED, DeliveryStatus.SENT, DeliveryStatus.FAILED), 0)
        for (status,) in db.query(ProjectBroadcastDelivery.status).filter(
            ProjectBroadcastDelivery.broadcast_id == broadcast.id
        ):
            counts[status] = counts.get(status, 0) + 1
        broadcast.sent_count = counts[DeliveryStatus.SENT]
        broadcast.failed_count = counts[DeliveryStatus.FAILED]
        broadcast.credits_used = credits_used
        if last_error:
            broadcast.last_error = last_error
        if counts[DeliveryStatus.QUEUED]:
            broadcast.status = BroadcastStatus.QUEUED
        elif broadcast.failed_count == 0:
            broadcast.status = BroadcastStatus.COMPLETED
            broadcast.last_error = None
        elif broadcast.sent_count == 0:
            broadcast.status = BroadcastStatus.FAILED
        else:
            broadcast.status = BroadcastStatus.PARTIAL
        broadcast.completed_at = datetime.utcnow()
        db.commit()
        db.refresh(broadcast)

    @staticmethod
    def run_in_background(broadcast_id: uuid.UUID) -> None:
        """Entry point for FastAPI BackgroundTasks: own session, provider chosen at run time."""
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            ProjectBroadcastService.process_broadcast(db, broadcast_id, provider=get_sms_provider())
        except Exception:
            logger.exception("Broadcast %s crashed", broadcast_id)
        finally:
            db.close()

    # ------------------------------------------------------------------ retry / read
    @staticmethod
    def requeue_failed(db: Session, broadcast: ProjectBroadcast, provider: SmsProvider) -> int:
        if not provider.is_configured():
            raise HTTPException(status_code=503, detail=provider.config_issue() or "SMS is not enabled")
        if broadcast.status == BroadcastStatus.SENDING and broadcast.started_at and (
            datetime.utcnow() - broadcast.started_at < STALE_SENDING_AFTER
        ):
            raise HTTPException(status_code=409, detail="This broadcast is still sending")
        opted_out = ProjectBroadcastService.opted_out_phones(db, broadcast.org_id)
        failed = (
            db.query(ProjectBroadcastDelivery)
            .filter(
                ProjectBroadcastDelivery.broadcast_id == broadcast.id,
                ProjectBroadcastDelivery.status == DeliveryStatus.FAILED,
            )
            .all()
        )
        count = 0
        for delivery in failed:
            if delivery.phone in opted_out:
                delivery.error = "Opted out of SMS"
                continue
            delivery.status = DeliveryStatus.QUEUED
            delivery.error = None
            count += 1
        if count == 0:
            db.commit()
            raise HTTPException(status_code=400, detail="There are no failed recipients to retry")
        broadcast.status = BroadcastStatus.QUEUED
        broadcast.completed_at = None
        db.commit()
        return count

    @staticmethod
    def get_or_404(db: Session, project_id: uuid.UUID, broadcast_id: uuid.UUID) -> ProjectBroadcast:
        broadcast = (
            db.query(ProjectBroadcast)
            .options(joinedload(ProjectBroadcast.creator))
            .filter(ProjectBroadcast.id == broadcast_id, ProjectBroadcast.project_id == project_id)
            .first()
        )
        if broadcast is None:
            raise HTTPException(status_code=404, detail="Broadcast not found")
        return broadcast

    @staticmethod
    def list_for_project(db: Session, project_id: uuid.UUID, limit: int = 50) -> list[ProjectBroadcast]:
        return (
            db.query(ProjectBroadcast)
            .options(joinedload(ProjectBroadcast.creator))
            .filter(ProjectBroadcast.project_id == project_id)
            .order_by(ProjectBroadcast.created_at.desc())
            .limit(limit)
            .all()
        )

    # ------------------------------------------------------------------ opt-outs
    @staticmethod
    def list_opt_outs(db: Session, org_id: uuid.UUID) -> list[OrgMessageOptOut]:
        return (
            db.query(OrgMessageOptOut)
            .filter(OrgMessageOptOut.org_id == org_id, OrgMessageOptOut.channel == "sms")
            .order_by(OrgMessageOptOut.created_at.desc())
            .all()
        )

    @staticmethod
    def add_opt_out(db: Session, org_id: uuid.UUID, user: User, phone: str, reason: Optional[str]) -> OrgMessageOptOut:
        parsed = normalize_phone(phone)
        if not parsed.ok:
            raise HTTPException(status_code=400, detail=parsed.reason or "Invalid phone number")
        existing = (
            db.query(OrgMessageOptOut)
            .filter(
                OrgMessageOptOut.org_id == org_id,
                OrgMessageOptOut.channel == "sms",
                OrgMessageOptOut.phone == parsed.e164,
            )
            .first()
        )
        if existing:
            return existing
        row = OrgMessageOptOut(
            org_id=org_id,
            phone=parsed.e164,
            channel="sms",
            reason=(reason or "").strip() or None,
            created_by=user.id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def remove_opt_out(db: Session, org_id: uuid.UUID, opt_out_id: uuid.UUID) -> None:
        row = (
            db.query(OrgMessageOptOut)
            .filter(OrgMessageOptOut.org_id == org_id, OrgMessageOptOut.id == opt_out_id)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Opt-out not found")
        db.delete(row)
        db.commit()
