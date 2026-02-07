from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.team import Team
from app.models.team_member import TeamMember
from app.api.schemas.team import TeamCreate, TeamUpdate
from uuid import UUID
from typing import List, Optional


class TeamService:
    @staticmethod
    def create_team(db: Session, org_id: UUID, team_data: TeamCreate) -> Team:
        """Create a new team"""
        team = Team(
            org_id=org_id,
            name=team_data.name,
            description=team_data.description
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        return team

    @staticmethod
    def get_org_teams(db: Session, org_id: UUID) -> List[Team]:
        """Get all teams for an organization with member counts"""
        teams = db.query(
            Team,
            func.count(TeamMember.id).label('member_count')
        ).outerjoin(TeamMember).filter(
            Team.org_id == org_id
        ).group_by(Team.id).all()
        
        result = []
        for team, count in teams:
            team.member_count = count
            result.append(team)
        return result

    @staticmethod
    def get_team(db: Session, team_id: UUID) -> Optional[Team]:
        """Get a specific team by ID"""
        return db.query(Team).filter(Team.id == team_id).first()

    @staticmethod
    def update_team(db: Session, team_id: UUID, team_data: TeamUpdate) -> Optional[Team]:
        """Update a team"""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return None
        
        if team_data.name is not None:
            team.name = team_data.name
        if team_data.description is not None:
            team.description = team_data.description
        
        db.commit()
        db.refresh(team)
        return team

    @staticmethod
    def delete_team(db: Session, team_id: UUID) -> bool:
        """Delete a team"""
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return False
        
        db.delete(team)
        db.commit()
        return True

    @staticmethod
    def add_member(db: Session, team_id: UUID, user_id: UUID) -> TeamMember:
        """Add a user to a team"""
        # Check if already a member
        existing = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id
        ).first()
        
        if existing:
            return existing
        
        member = TeamMember(
            team_id=team_id,
            user_id=user_id
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member

    @staticmethod
    def remove_member(db: Session, team_id: UUID, user_id: UUID) -> bool:
        """Remove a user from a team"""
        result = db.query(TeamMember).filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id
        ).delete()
        db.commit()
        return result > 0

    @staticmethod
    def get_team_members(db: Session, team_id: UUID) -> List[TeamMember]:
        """Get all members of a team"""
        return db.query(TeamMember).filter(TeamMember.team_id == team_id).all()

    @staticmethod
    def get_user_teams(db: Session, user_id: UUID, org_id: UUID) -> List[Team]:
        """Get all teams a user belongs to in an organization"""
        return db.query(Team).join(TeamMember).filter(
            TeamMember.user_id == user_id,
            Team.org_id == org_id
        ).all()
