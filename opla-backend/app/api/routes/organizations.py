from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_current_user, get_db
from app.api.schemas.organization import (
    OrganizationCreate,
    OrganizationOut,
    TeamCreate,
    TeamOut,
    OrgMemberDetailOut,
    OrgRoleCreate,
    OrgRoleOut,
    OrgRoleUpdate,
    OrgRoleAssignmentCreate,
    OrgRoleAssignmentOut,
    OrgRoleAssignmentView
)
from app.services.organization_service import OrganizationService
from app.models.user import User
from app.models.project_access import AccessorType
from app.models.team import Team
import uuid

router = APIRouter(prefix="/organizations", tags=["organizations"])

@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
def create_organization(
    org_in: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return OrganizationService.create_organization(
        db=db,
        name=org_in.name,
        owner_id=current_user.id,
        logo_url=org_in.logo_url,
        primary_color=org_in.primary_color
    )

@router.get("", response_model=List[OrganizationOut])
def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return OrganizationService.get_user_organizations(db, current_user.id)

@router.get("/{org_id}", response_model=OrganizationOut)
def get_organization(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    org = OrganizationService.get_organization(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    # Verify membership
    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return org

@router.get("/{org_id}/members", response_model=List[OrgMemberDetailOut])
def list_org_members(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify membership
    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    results = []
    for member in members:
        effective_role, assignments = OrganizationService.get_effective_roles_for_user(db, org_id, member.user_id)
        views: List[OrgRoleAssignmentView] = []
        for assignment in assignments:
            accessor_name = None
            if assignment.accessor_type == AccessorType.USER:
                accessor_name = member.user.full_name
            else:
                team = db.query(Team).filter(Team.id == assignment.accessor_id).first()
                accessor_name = team.name if team else None
            views.append(OrgRoleAssignmentView(
                accessor_id=assignment.accessor_id,
                accessor_type=assignment.accessor_type,
                accessor_name=accessor_name,
                role=assignment.role
            ))

        results.append(OrgMemberDetailOut(
            id=member.id,
            user_id=member.user_id,
            global_role=member.global_role,
            invitation_status=member.invitation_status,
            joined_at=member.joined_at,
            user=member.user,
            effective_role=effective_role,
            role_assignments=views
        ))
    return results

@router.post("/{org_id}/teams", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    org_id: uuid.UUID,
    team_in: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify membership and admin role
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create teams")
    
    return OrganizationService.create_team(
        db=db,
        org_id=org_id,
        name=team_in.name,
        description=team_in.description
    )

@router.get("/{org_id}/teams", response_model=List[TeamOut])
def list_teams(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return OrganizationService.list_teams(db, org_id)

@router.get("/{org_id}/teams/{team_id}/members")
def list_team_members(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return OrganizationService.get_team_members(db, team_id)

@router.post("/{org_id}/teams/{team_id}/members/{user_id}", status_code=status.HTTP_201_CREATED)
def add_team_member(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add team members")
    return OrganizationService.add_team_member(db, team_id, user_id)

@router.delete("/{org_id}/teams/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    org_id: uuid.UUID,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can remove team members")
    removed = OrganizationService.remove_team_member(db, team_id, user_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Team member not found")
    return None

@router.get("/{org_id}/roles", response_model=List[OrgRoleOut])
def list_roles(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return OrganizationService.list_roles(db, org_id)

@router.post("/{org_id}/roles", response_model=OrgRoleOut, status_code=status.HTTP_201_CREATED)
def create_role(
    org_id: uuid.UUID,
    role_in: OrgRoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create roles")
    return OrganizationService.create_role(
        db=db,
        org_id=org_id,
        name=role_in.name,
        description=role_in.description,
        permissions=role_in.permissions,
        priority=role_in.priority
    )

@router.patch("/{org_id}/roles/{role_id}", response_model=OrgRoleOut)
def update_role(
    org_id: uuid.UUID,
    role_id: uuid.UUID,
    role_in: OrgRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update roles")
    role = OrganizationService.update_role(
        db=db,
        org_id=org_id,
        role_id=role_id,
        name=role_in.name,
        description=role_in.description,
        permissions=role_in.permissions,
        priority=role_in.priority
    )
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role

@router.get("/{org_id}/roles/assignments", response_model=List[OrgRoleAssignmentOut])
def list_role_assignments(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    if not any(m.user_id == current_user.id for m in members):
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return OrganizationService.list_role_assignments(db, org_id)

@router.post("/{org_id}/roles/assignments", response_model=OrgRoleAssignmentOut, status_code=status.HTTP_201_CREATED)
def assign_role(
    org_id: uuid.UUID,
    assignment_in: OrgRoleAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign roles")
    return OrganizationService.assign_role(
        db=db,
        org_id=org_id,
        role_id=assignment_in.role_id,
        accessor_type=assignment_in.accessor_type,
        accessor_id=assignment_in.accessor_id,
        assigned_by=current_user.id
    )
    
@router.post("/{org_id}/roles/assignments/validate", status_code=status.HTTP_200_OK)
def validate_role_assignment(
    org_id: uuid.UUID,
    assignment_in: OrgRoleAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    members = OrganizationService.get_org_members(db, org_id)
    member = next((m for m in members if m.user_id == current_user.id), None)
    if not member or member.global_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can assign roles")
    try:
        OrganizationService.assign_role(
            db=db,
            org_id=org_id,
            role_id=assignment_in.role_id,
            accessor_type=assignment_in.accessor_type,
            accessor_id=assignment_in.accessor_id,
            assigned_by=current_user.id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"success": True}
