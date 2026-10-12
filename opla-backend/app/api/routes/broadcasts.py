"""Project Messages → Broadcasts: outbound SMS to teams, CSV imports and typed numbers.

Everything here needs the ``communication.field`` permission (org admins, Project
Managers, Field Supervisors, legacy ``editor`` access) except the provider status,
which any project viewer can read so Studio can explain why the form is locked.
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.broadcast import (
    BroadcastCreateIn,
    BroadcastDetailOut,
    BroadcastOut,
    BroadcastPreviewIn,
    BroadcastPreviewOut,
    BroadcastRetryOut,
    OptOutIn,
    OptOutOut,
    SmsBalanceOut,
    SmsProviderStatusOut,
)
from app.core.config import settings
from app.models.project import Project
from app.models.project_broadcast import DeliveryStatus
from app.models.user import User
from app.services.project_access_service import ProjectAccessService
from app.services.project_broadcast_service import ProjectBroadcastService
from app.services.sms.contacts import ContactInput
from app.services.sms.providers import get_sms_provider


router = APIRouter(prefix="/organizations/{org_id}/projects/{project_id}/broadcasts", tags=["broadcasts"])


def _project_for_sender(db: Session, user: User, org_id: uuid.UUID, project_id: uuid.UUID) -> Project:
    project = ProjectAccessService.ensure_can_message_field(db, user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _contacts(payload) -> list[ContactInput]:
    return [ContactInput(phone=c.phone, name=c.name, source=c.source) for c in payload.contacts]


def _rejected(items):
    return [{"input": r.input, "name": r.name, "source": r.source, "reason": r.reason} for r in items]


@router.get("/provider", response_model=SmsProviderStatusOut)
def get_sms_provider_status(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    provider = get_sms_provider()
    return SmsProviderStatusOut(
        enabled=provider.is_configured(),
        provider=provider.name,
        sender_id=provider.sender_id or None,
        issue=provider.config_issue(),
        can_send=ProjectAccessService.can_message_field(db, current_user.id, project),
        batch_size=settings.SMS_BATCH_SIZE,
        max_recipients=settings.SMS_MAX_RECIPIENTS,
    )


@router.get("/balance", response_model=SmsBalanceOut)
def get_sms_balance(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _project_for_sender(db, current_user, org_id, project_id)
    result = get_sms_provider().get_balance()
    return SmsBalanceOut(available=result.success, balance=result.balance, bonus=result.bonus, error=result.error)


@router.post("/preview", response_model=BroadcastPreviewOut)
def preview_broadcast(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: BroadcastPreviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _project_for_sender(db, current_user, org_id, project_id)
    provider = get_sms_provider()
    audience, without_phone = ProjectBroadcastService.resolve_audience(
        db, project.org_id, team_ids=payload.team_ids, contacts=_contacts(payload), provider=provider
    )
    estimate = ProjectBroadcastService.estimate(payload.message.strip(), audience, payload.name_fallback)
    return BroadcastPreviewOut(
        recipient_count=len(audience.recipients),
        recipients=[
            {"phone": r.phone, "name": r.name, "sources": r.sources, "team_names": r.team_names}
            for r in audience.recipients
        ],
        invalid=_rejected(audience.invalid),
        unsupported=_rejected(audience.unsupported),
        opted_out=_rejected(audience.opted_out),
        members_without_phone=without_phone,
        duplicates_removed=audience.duplicates_removed,
        estimate=estimate,
        max_recipients=settings.SMS_MAX_RECIPIENTS,
    )


@router.post("", response_model=BroadcastOut, status_code=status.HTTP_202_ACCEPTED)
def create_broadcast(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: BroadcastCreateIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _project_for_sender(db, current_user, org_id, project_id)
    broadcast = ProjectBroadcastService.create_broadcast(
        db,
        project,
        current_user,
        message=payload.message,
        team_ids=payload.team_ids,
        contacts=_contacts(payload),
        name_fallback=payload.name_fallback,
        expected_recipient_count=payload.expected_recipient_count,
        provider=get_sms_provider(),
    )
    background_tasks.add_task(ProjectBroadcastService.run_in_background, broadcast.id)
    return broadcast


@router.get("", response_model=List[BroadcastOut])
def list_broadcasts(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _project_for_sender(db, current_user, org_id, project_id)
    return ProjectBroadcastService.list_for_project(db, project_id, limit=limit)


@router.get("/opt-outs", response_model=List[OptOutOut])
def list_opt_outs(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _project_for_sender(db, current_user, org_id, project_id)
    return ProjectBroadcastService.list_opt_outs(db, project.org_id)


@router.post("/opt-outs", response_model=OptOutOut, status_code=status.HTTP_201_CREATED)
def add_opt_out(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: OptOutIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _project_for_sender(db, current_user, org_id, project_id)
    return ProjectBroadcastService.add_opt_out(db, project.org_id, current_user, payload.phone, payload.reason)


@router.delete("/opt-outs/{opt_out_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_opt_out(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    opt_out_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _project_for_sender(db, current_user, org_id, project_id)
    ProjectBroadcastService.remove_opt_out(db, project.org_id, opt_out_id)
    return None


@router.get("/{broadcast_id}", response_model=BroadcastDetailOut)
def get_broadcast(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _project_for_sender(db, current_user, org_id, project_id)
    broadcast = ProjectBroadcastService.get_or_404(db, project_id, broadcast_id)
    detail = BroadcastDetailOut.model_validate(
        {
            **BroadcastOut.model_validate(broadcast).model_dump(),
            "deliveries": broadcast.deliveries,
            "queued_count": sum(1 for d in broadcast.deliveries if d.status == DeliveryStatus.QUEUED),
        }
    )
    return detail


@router.post("/{broadcast_id}/retry", response_model=BroadcastRetryOut, status_code=status.HTTP_202_ACCEPTED)
def retry_failed(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    broadcast_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _project_for_sender(db, current_user, org_id, project_id)
    broadcast = ProjectBroadcastService.get_or_404(db, project_id, broadcast_id)
    requeued = ProjectBroadcastService.requeue_failed(db, broadcast, get_sms_provider())
    background_tasks.add_task(ProjectBroadcastService.run_in_background, broadcast.id)
    return BroadcastRetryOut(requeued=requeued, broadcast=BroadcastOut.model_validate(broadcast))
