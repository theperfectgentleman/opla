from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user, require_org_admin
from app.api.schemas.role import OrgRoleCreate, OrgRoleUpdate, OrgRoleOut, RoleAssignmentCreate, RoleAssignmentOut
from app.services.role_service import RoleService
from app.models.user import User
from typing import List
from uuid import UUID

router = APIRouter(prefix="/organizations/{org_id}/roles", tags=["roles"])


@router.post("", response_model=OrgRoleOut)
def create_role(
    org_id: UUID,
    role_data: OrgRoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Create a new role template (admin only)"""
    try:
        role = RoleService.create_role(db, org_id, role_data, is_system=False)
        return role
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[OrgRoleOut])
def list_roles(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all roles for an organization"""
    roles = RoleService.get_org_roles(db, org_id)
    return roles


@router.get("/{role_id}", response_model=OrgRoleOut)
def get_role(
    org_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific role"""
    role = RoleService.get_role(db, role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.put("/{role_id}", response_model=OrgRoleOut)
def update_role(
    org_id: UUID,
    role_id: UUID,
    role_data: OrgRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Update a role template (admin only, system roles cannot be updated)"""
    role = RoleService.update_role(db, role_id, role_data)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found or is a system role")
    return role


@router.delete("/{role_id}")
def delete_role(
    org_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Delete a role template (admin only, system roles cannot be deleted)"""
    success = RoleService.delete_role(db, role_id)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot delete system role or role with assignments")
    return {"message": "Role deleted successfully"}


@router.post("/assignments", response_model=RoleAssignmentOut)
def assign_role(
    org_id: UUID,
    assignment_data: RoleAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Assign a role to a user or team (admin only)"""
    # Verify role exists and belongs to org
    role = RoleService.get_role(db, assignment_data.role_id)
    if not role or role.org_id != org_id:
        raise HTTPException(status_code=404, detail="Role not found")
    
    assignment = RoleService.assign_role(
        db, org_id, assignment_data.role_id,
        assignment_data.accessor_id, assignment_data.accessor_type,
        current_user.id
    )
    return assignment


@router.get("/assignments", response_model=List[RoleAssignmentOut])
def list_assignments(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all role assignments for an organization"""
    assignments = RoleService.get_assignments_for_org(db, org_id)
    return assignments


@router.delete("/assignments/{accessor_type}/{accessor_id}")
def remove_assignment(
    org_id: UUID,
    accessor_type: str,
    accessor_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Remove a role assignment (admin only)"""
    success = RoleService.remove_assignment(db, org_id, accessor_id, accessor_type)
    if not success:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Assignment removed successfully"}
