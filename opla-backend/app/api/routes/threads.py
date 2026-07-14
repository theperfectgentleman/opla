from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.thread import (
    ProjectThreadCreate,
    ProjectThreadOut,
    ProjectThreadUpdate,
    ThreadMessageCreate,
    ThreadMessageOut,
    ThreadMessageUpdate,
    ThreadNotificationOut,
)
from app.models.user import User
from app.services.project_access_service import ProjectAccessService
from app.services.project_thread_service import ProjectThreadService


router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["threads"])


def _serialize_message(message) -> ThreadMessageOut:
    body = message.body
    if message.deleted_at:
        body = ""
    return ThreadMessageOut(
        id=message.id,
        thread_id=message.thread_id,
        project_id=message.project_id,
        author_id=message.author_id,
        author=message.author,
        body=body,
        mentions_json=None if message.deleted_at else message.mentions_json,
        created_at=message.created_at,
        edited_at=message.edited_at,
        deleted_at=message.deleted_at,
    )


@router.get("/{project_id}/threads", response_model=List[ProjectThreadOut])
def list_project_threads(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectThreadService.list_threads(db, project_id)


@router.get("/{project_id}/threads/{thread_id}", response_model=ProjectThreadOut)
def get_project_thread(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    thread_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectThreadService.get_thread_or_404(db, project_id, thread_id)


@router.post("/{project_id}/threads", response_model=ProjectThreadOut, status_code=status.HTTP_201_CREATED)
def create_project_thread(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectThreadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectThreadService.create_thread(
        db,
        project,
        title=payload.title,
        summary=payload.summary,
        reply_count=payload.reply_count,
        created_by=current_user.id,
    )


@router.patch("/{project_id}/threads/{thread_id}", response_model=ProjectThreadOut)
def update_project_thread(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    thread_id: uuid.UUID,
    payload: ProjectThreadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = ProjectThreadService.get_thread_or_404(db, project_id, thread_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectThreadService.update_thread(
        db,
        project,
        thread,
        title=payload.title,
        summary=payload.summary,
        reply_count=payload.reply_count,
    )


@router.delete("/{project_id}/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_thread(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    thread_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = ProjectThreadService.get_thread_or_404(db, project_id, thread_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    ProjectThreadService.delete_thread(db, project, thread)
    return None


@router.get("/{project_id}/threads/{thread_id}/messages", response_model=List[ThreadMessageOut])
def list_thread_messages(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    thread_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    before: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    messages = ProjectThreadService.list_messages(db, project_id, thread_id, limit=limit, before=before)
    # Return chronological for UI (oldest → newest)
    return [_serialize_message(m) for m in reversed(messages)]


@router.post(
    "/{project_id}/threads/{thread_id}/messages",
    response_model=ThreadMessageOut,
    status_code=status.HTTP_201_CREATED,
)
def post_thread_message(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    thread_id: uuid.UUID,
    payload: ThreadMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    thread = ProjectThreadService.get_thread_or_404(db, project_id, thread_id)
    message = ProjectThreadService.post_message(
        db,
        project,
        thread,
        author=current_user,
        body=payload.body,
        mentioned_user_ids=payload.mentioned_user_ids,
    )
    return _serialize_message(message)


@router.patch("/{project_id}/messages/{message_id}", response_model=ThreadMessageOut)
def edit_thread_message(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: ThreadMessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    message = ProjectThreadService.get_message_or_404(db, project_id, message_id)
    updated = ProjectThreadService.edit_message(
        db,
        project,
        message,
        actor=current_user,
        body=payload.body,
        mentioned_user_ids=payload.mentioned_user_ids,
    )
    return _serialize_message(updated)


@router.delete("/{project_id}/messages/{message_id}", response_model=ThreadMessageOut)
def delete_thread_message(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    message_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    message = ProjectThreadService.get_message_or_404(db, project_id, message_id)
    deleted = ProjectThreadService.delete_message(db, project, message, actor=current_user)
    return _serialize_message(deleted)


notifications_router = APIRouter(prefix="/organizations/{org_id}", tags=["thread-notifications"])


@notifications_router.get("/thread-notifications", response_model=List[ThreadNotificationOut])
def list_thread_notifications(
    org_id: uuid.UUID,
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Org membership gate
    from app.services.organization_service import OrganizationService

    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return ProjectThreadService.list_notifications(
        db, current_user.id, unread_only=unread_only, limit=limit
    )


@notifications_router.post(
    "/thread-notifications/{notification_id}/read",
    response_model=ThreadNotificationOut,
)
def mark_thread_notification_read(
    org_id: uuid.UUID,
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.organization_service import OrganizationService

    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return ProjectThreadService.mark_notification_read(db, current_user.id, notification_id)
