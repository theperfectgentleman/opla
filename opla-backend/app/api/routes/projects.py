from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_current_user, get_db
from app.api.schemas.project import ProjectCreate, ProjectOut
from app.services.form_service import ProjectService
from app.services.organization_service import OrganizationService
from app.models.user import User
import uuid

router = APIRouter(prefix="/organizations/{org_id}/projects", tags=["projects"])

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify org membership and admin role
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only org admins can create projects")
        
    return ProjectService.create_project(
        db=db,
        org_id=org_id,
        name=project_in.name,
        description=project_in.description
    )

@router.get("", response_model=List[ProjectOut])
def list_projects(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify org membership
    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
        
    return ProjectService.get_org_projects(db, org_id)
