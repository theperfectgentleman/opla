from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.message import (
    ProjectMessageChannelCreate,
    ProjectMessageChannelOut,
    ProjectMessageChannelUpdate,
    MessageCreate,
    MessageOut,
    MessageUpdate,
    MessageNotificationOut,
)
from app.models.user import User
from app.services.project_access_service import ProjectAccessService
from app.services.project_message_service import ProjectMessageService


router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["messages"])


def _serialize_message(message) -> MessageOut:
    body = message.body
    if message.deleted_at:
        body = ""
    return MessageOut(
        id=message.id,
        channel_id=message.channel_id,
        project_id=message.project_id,
        author_id=message.author_id,
        author=message.author,
        body=body,
        mentions_json=None if message.deleted_at else message.mentions_json,
        created_at=message.created_at,
        edited_at=message.edited_at,
        deleted_at=message.deleted_at,
    )


@router.get("/{project_id}/messages", response_model=List[ProjectMessageChannelOut])
def list_project_message_channels(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectMessageService.list_channels(db, project_id)


@router.get("/{project_id}/message-channels/{channel_id}", response_model=ProjectMessageChannelOut)
def get_project_message_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectMessageService.get_channel_or_404(db, project_id, channel_id)


@router.post("/{project_id}/messages", response_model=ProjectMessageChannelOut, status_code=status.HTTP_201_CREATED)
def create_project_message_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectMessageChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectMessageService.create_channel(
        db,
        project,
        title=payload.title,
        summary=payload.summary,
        reply_count=payload.reply_count,
        created_by=current_user.id,
    )


@router.patch("/{project_id}/message-channels/{channel_id}", response_model=ProjectMessageChannelOut)
def update_project_message_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    payload: ProjectMessageChannelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channel = ProjectMessageService.get_channel_or_404(db, project_id, channel_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectMessageService.update_channel(
        db,
        project,
        channel,
        title=payload.title,
        summary=payload.summary,
        reply_count=payload.reply_count,
    )


@router.delete("/{project_id}/message-channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_message_channel(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channel = ProjectMessageService.get_channel_or_404(db, project_id, channel_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    ProjectMessageService.delete_channel(db, project, channel)
    return None


@router.get("/{project_id}/message-channels/{channel_id}/messages", response_model=List[MessageOut])
def list_channel_messages(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    before: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    messages = ProjectMessageService.list_messages(db, project_id, channel_id, limit=limit, before=before)
    return [_serialize_message(m) for m in reversed(messages)]


@router.post(
    "/{project_id}/message-channels/{channel_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
def post_channel_message(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    channel_id: uuid.UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    channel = ProjectMessageService.get_channel_or_404(db, project_id, channel_id)
    message = ProjectMessageService.post_message(
        db,
        project,
        channel,
        author=current_user,
        body=payload.body,
        mentioned_user_ids=payload.mentioned_user_ids,
    )
    return _serialize_message(message)


@router.patch("/{project_id}/messages/{message_id}", response_model=MessageOut)
def edit_channel_message(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: MessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    message = ProjectMessageService.get_message_or_404(db, project_id, message_id)
    updated = ProjectMessageService.edit_message(
        db,
        project,
        message,
        actor=current_user,
        body=payload.body,
        mentioned_user_ids=payload.mentioned_user_ids,
    )
    return _serialize_message(updated)


@router.delete("/{project_id}/messages/{message_id}", response_model=MessageOut)
def delete_channel_message(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    message_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    message = ProjectMessageService.get_message_or_404(db, project_id, message_id)
    deleted = ProjectMessageService.delete_message(db, project, message, actor=current_user)
    return _serialize_message(deleted)


notifications_router = APIRouter(prefix="/organizations/{org_id}", tags=["message-notifications"])


@notifications_router.get("/message-notifications", response_model=List[MessageNotificationOut])
def list_message_notifications(
    org_id: uuid.UUID,
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.organization_service import OrganizationService

    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return ProjectMessageService.list_notifications(
        db, current_user.id, unread_only=unread_only, limit=limit
    )


@notifications_router.post(
    "/message-notifications/{notification_id}/read",
    response_model=MessageNotificationOut,
)
def mark_message_notification_read(
    org_id: uuid.UUID,
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.organization_service import OrganizationService

    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return ProjectMessageService.mark_notification_read(db, current_user.id, notification_id)
