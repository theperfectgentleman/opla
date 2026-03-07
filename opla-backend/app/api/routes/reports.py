from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.report import ProjectReportCreate, ProjectReportOut, ProjectReportUpdate
from app.models.user import User
from app.services.project_access_service import ProjectAccessService
from app.services.project_report_service import ProjectReportService


router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["reports"])


@router.get("/{project_id}/reports", response_model=List[ProjectReportOut])
def list_project_reports(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectReportService.list_reports(db, project_id)


@router.get("/{project_id}/reports/{report_id}", response_model=ProjectReportOut)
def get_project_report(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectReportService.get_report_or_404(db, project_id, report_id)


@router.post("/{project_id}/reports", response_model=ProjectReportOut, status_code=status.HTTP_201_CREATED)
def create_project_report(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectReportService.create_report(
        db,
        project,
        title=payload.title,
        description=payload.description,
        content=payload.content,
        created_by=current_user.id,
    )


@router.patch("/{project_id}/reports/{report_id}", response_model=ProjectReportOut)
def update_project_report(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    payload: ProjectReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = ProjectReportService.get_report_or_404(db, project_id, report_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectReportService.update_report(
        db,
        project,
        report,
        title=payload.title,
        description=payload.description,
        content=payload.content,
        status=payload.status,
        lead_accessor_id=payload.lead_accessor_id,
        lead_accessor_type=payload.lead_accessor_type,
        assigned_accessor_id=payload.assigned_accessor_id,
        assigned_accessor_type=payload.assigned_accessor_type,
        guest_accessor_id=payload.guest_accessor_id,
        guest_accessor_type=payload.guest_accessor_type,
    )


@router.delete("/{project_id}/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_report(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = ProjectReportService.get_report_or_404(db, project_id, report_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    ProjectReportService.delete_report(db, project, report)
    return None