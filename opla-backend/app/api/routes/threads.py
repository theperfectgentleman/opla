from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.thread import ProjectThreadCreate, ProjectThreadOut, ProjectThreadUpdate
from app.models.user import User
from app.services.project_access_service import ProjectAccessService
from app.services.project_thread_service import ProjectThreadService


router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["threads"])


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