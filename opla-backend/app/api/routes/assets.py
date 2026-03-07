from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.asset import ProjectAssetCreate, ProjectAssetOut, ProjectAssetUpdate
from app.models.user import User
from app.services.project_access_service import ProjectAccessService
from app.services.project_asset_service import ProjectAssetService


router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["assets"])


@router.get("/{project_id}/assets", response_model=List[ProjectAssetOut])
def list_project_assets(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAssetService.list_assets(db, project_id)


@router.get("/{project_id}/assets/{asset_id}", response_model=ProjectAssetOut)
def get_project_asset(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_view_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAssetService.get_asset_or_404(db, project_id, asset_id)


@router.post("/{project_id}/assets", response_model=ProjectAssetOut, status_code=status.HTTP_201_CREATED)
def create_project_asset(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    payload: ProjectAssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAssetService.create_asset(
        db,
        project,
        title=payload.title,
        kind=payload.kind,
        summary=payload.summary,
        source_url=payload.source_url,
        created_by=current_user.id,
    )


@router.patch("/{project_id}/assets/{asset_id}", response_model=ProjectAssetOut)
def update_project_asset(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    asset_id: uuid.UUID,
    payload: ProjectAssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = ProjectAssetService.get_asset_or_404(db, project_id, asset_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectAssetService.update_asset(
        db,
        project,
        asset,
        title=payload.title,
        kind=payload.kind,
        summary=payload.summary,
        source_url=payload.source_url,
    )


@router.delete("/{project_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_asset(
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    asset_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = ProjectAssetService.get_asset_or_404(db, project_id, asset_id)
    project = ProjectAccessService.ensure_can_edit_project(db, current_user.id, project_id)
    if project.org_id != org_id:
        raise HTTPException(status_code=404, detail="Project not found")
    ProjectAssetService.delete_asset(db, project, asset)
    return None