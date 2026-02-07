from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user, require_org_admin
from app.api.schemas.team import TeamCreate, TeamUpdate, TeamOut, TeamMemberAdd, TeamMemberOut
from app.services.team_service import TeamService
from app.models.user import User
from typing import List
from uuid import UUID

router = APIRouter(prefix="/organizations/{org_id}/teams", tags=["teams"])


@router.post("", response_model=TeamOut)
def create_team(
    org_id: UUID,
    team_data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Create a new team (admin only)"""
    team = TeamService.create_team(db, org_id, team_data)
    return team


@router.get("", response_model=List[TeamOut])
def list_teams(
    org_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all teams for an organization"""
    teams = TeamService.get_org_teams(db, org_id)
    return teams


@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    org_id: UUID,
    team_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific team"""
    team = TeamService.get_team(db, team_id)
    if not team or team.org_id != org_id:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.put("/{team_id}", response_model=TeamOut)
def update_team(
    org_id: UUID,
    team_id: UUID,
    team_data: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Update a team (admin only)"""
    team = TeamService.update_team(db, team_id, team_data)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.delete("/{team_id}")
def delete_team(
    org_id: UUID,
    team_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Delete a team (admin only)"""
    success = TeamService.delete_team(db, team_id)
    if not success:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"message": "Team deleted successfully"}


@router.post("/{team_id}/members", response_model=TeamMemberOut)
def add_team_member(
    org_id: UUID,
    team_id: UUID,
    member_data: TeamMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Add a member to a team (admin only)"""
    # Verify team exists and belongs to org
    team = TeamService.get_team(db, team_id)
    if not team or team.org_id != org_id:
        raise HTTPException(status_code=404, detail="Team not found")
    
    member = TeamService.add_member(db, team_id, member_data.user_id)
    return member


@router.get("/{team_id}/members", response_model=List[TeamMemberOut])
def list_team_members(
    org_id: UUID,
    team_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all members of a team"""
    team = TeamService.get_team(db, team_id)
    if not team or team.org_id != org_id:
        raise HTTPException(status_code=404, detail="Team not found")
    
    members = TeamService.get_team_members(db, team_id)
    return members


@router.delete("/{team_id}/members/{user_id}")
def remove_team_member(
    org_id: UUID,
    team_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Remove a member from a team (admin only)"""
    success = TeamService.remove_member(db, team_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found in team")
    return {"message": "Member removed from team successfully"}
