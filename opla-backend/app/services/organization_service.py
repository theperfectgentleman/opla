from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.organization import Organization
from app.models.org_member import OrgMember, GlobalRole, InvitationStatus
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.models.role_template import OrgRole, OrgRoleAssignment, AccessorType
from app.models.project_access import AccessorType as ProjectAccessorType
import uuid
from typing import List, Optional
import re

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

class OrganizationService:
    @staticmethod
    def create_organization(db: Session, name: str, owner_id: uuid.UUID, logo_url: Optional[str] = None, primary_color: str = "#6366f1") -> Organization:
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while db.query(Organization).filter(Organization.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
            
        org = Organization(
            name=name,
            slug=slug,
            owner_id=owner_id,
            logo_url=logo_url,
            primary_color=primary_color
        )
        db.add(org)
        db.flush()
        
        # Add owner as admin member
        member = OrgMember(
            user_id=owner_id,
            org_id=org.id,
            global_role=GlobalRole.ADMIN,
            invitation_status=InvitationStatus.ACCEPTED
        )
        db.add(member)
        db.flush()

        OrganizationService.seed_default_roles(db, org.id, owner_id)
        db.commit()
        db.refresh(org)
        return org

    @staticmethod
    def seed_default_roles(db: Session, org_id: uuid.UUID, owner_id: uuid.UUID) -> None:
        defaults = [
            {
                "name": "Admin",
                "slug": "admin",
                "description": "Full access to org settings and projects",
                "permissions": ["*"],
                "priority": 100,
                "is_system": True
            },
            {
                "name": "Editor",
                "slug": "editor",
                "description": "Create and edit projects and forms",
                "permissions": ["projects:edit", "forms:edit", "forms:publish", "data:view"],
                "priority": 80,
                "is_system": True
            },
            {
                "name": "Supervisor",
                "slug": "supervisor",
                "description": "Review data and manage team workflows",
                "permissions": ["forms:view", "data:view", "teams:view"],
                "priority": 60,
                "is_system": True
            },
            {
                "name": "Agent",
                "slug": "agent",
                "description": "Collect data and submit forms",
                "permissions": ["forms:submit", "data:collect"],
                "priority": 40,
                "is_system": True
            }
        ]

        roles = []
        for role in defaults:
            roles.append(OrgRole(
                org_id=org_id,
                name=role["name"],
                slug=role["slug"],
                description=role["description"],
                permissions=role["permissions"],
                priority=role["priority"],
                is_system=role["is_system"]
            ))
        db.add_all(roles)
        db.flush()

        admin_role = next((r for r in roles if r.slug == "admin"), None)
        if admin_role:
            db.add(OrgRoleAssignment(
                org_id=org_id,
                role_id=admin_role.id,
                accessor_id=owner_id,
                accessor_type=AccessorType.USER,
                assigned_by=owner_id
            ))

    @staticmethod
    def get_user_organizations(db: Session, user_id: uuid.UUID) -> List[Organization]:
        return db.query(Organization).join(OrgMember).filter(OrgMember.user_id == user_id).all()

    @staticmethod
    def get_organization(db: Session, org_id: uuid.UUID) -> Optional[Organization]:
        return db.query(Organization).filter(Organization.id == org_id).first()

    @staticmethod
    def get_org_members(db: Session, org_id: uuid.UUID) -> List[OrgMember]:
        return db.query(OrgMember).filter(OrgMember.org_id == org_id).all()

    @staticmethod
    def invite_member(db: Session, org_id: uuid.UUID, invited_by_id: uuid.UUID, email_or_phone: str, role: GlobalRole = GlobalRole.MEMBER) -> OrgMember:
        # Check if user already exists
        user = db.query(User).filter(or_(User.email == email_or_phone, User.phone == email_or_phone)).first()
        
        if not user:
            # In a real app, we might create a placeholder user or just track the invitation
            # For now, let's assume the user must exist to be invited to keep it simple, 
            # or we could return an error.
            raise ValueError("User not found")
            
        # Check if already a member
        existing_member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == user.id).first()
        if existing_member:
            return existing_member
            
        member = OrgMember(
            user_id=user.id,
            org_id=org_id,
            global_role=role,
            invited_by=invited_by_id,
            invitation_status=InvitationStatus.PENDING
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member

    @staticmethod
    def create_team(db: Session, org_id: uuid.UUID, name: str, description: Optional[str] = None) -> Team:
        team = Team(
            org_id=org_id,
            name=name,
            description=description
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        return team

    @staticmethod
    def list_teams(db: Session, org_id: uuid.UUID) -> List[Team]:
        return db.query(Team).filter(Team.org_id == org_id).all()

    @staticmethod
    def get_team_members(db: Session, team_id: uuid.UUID) -> List[TeamMember]:
        return db.query(TeamMember).filter(TeamMember.team_id == team_id).all()

    @staticmethod
    def add_team_member(db: Session, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamMember:
        existing = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()
        if existing:
            return existing
            
        tm = TeamMember(
            team_id=team_id,
            user_id=user_id
        )
        db.add(tm)
        db.commit()
        db.refresh(tm)
        return tm

    @staticmethod
    def remove_team_member(db: Session, team_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        existing = db.query(TeamMember).filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id).first()
        if not existing:
            return False
        db.delete(existing)
        db.commit()
        return True

    @staticmethod
    def create_role(
        db: Session,
        org_id: uuid.UUID,
        name: str,
        description: Optional[str],
        permissions: List[str],
        priority: int
    ) -> OrgRole:
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while db.query(OrgRole).filter(OrgRole.org_id == org_id, OrgRole.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1

        role = OrgRole(
            org_id=org_id,
            name=name,
            slug=slug,
            description=description,
            permissions=permissions,
            priority=priority,
            is_system=False
        )
        db.add(role)
        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def list_roles(db: Session, org_id: uuid.UUID) -> List[OrgRole]:
        return db.query(OrgRole).filter(OrgRole.org_id == org_id).order_by(OrgRole.priority.desc()).all()

    @staticmethod
    def update_role(
        db: Session,
        org_id: uuid.UUID,
        role_id: uuid.UUID,
        name: Optional[str],
        description: Optional[str],
        permissions: Optional[List[str]],
        priority: Optional[int]
    ) -> Optional[OrgRole]:
        role = db.query(OrgRole).filter(OrgRole.org_id == org_id, OrgRole.id == role_id).first()
        if not role:
            return None
        if role.is_system:
            return role

        if name:
            role.name = name
        if description is not None:
            role.description = description
        if permissions is not None:
            role.permissions = permissions
        if priority is not None:
            role.priority = priority

        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def assign_role(
        db: Session,
        org_id: uuid.UUID,
        role_id: uuid.UUID,
        accessor_type: AccessorType,
        accessor_id: uuid.UUID,
        assigned_by: uuid.UUID
    ) -> OrgRoleAssignment:
        role = db.query(OrgRole).filter(OrgRole.org_id == org_id, OrgRole.id == role_id).first()
        if not role:
            raise ValueError("Role not found")

        if accessor_type == AccessorType.USER:
            member = db.query(OrgMember).filter(OrgMember.org_id == org_id, OrgMember.user_id == accessor_id).first()
            if not member:
                raise ValueError("User is not a member of this organization")
        else:
            team = db.query(Team).filter(Team.org_id == org_id, Team.id == accessor_id).first()
            if not team:
                raise ValueError("Team not found in this organization")

        assignment = db.query(OrgRoleAssignment).filter(
            OrgRoleAssignment.org_id == org_id,
            OrgRoleAssignment.accessor_id == accessor_id,
            OrgRoleAssignment.accessor_type == accessor_type
        ).first()

        if assignment:
            assignment.role_id = role_id
        else:
            assignment = OrgRoleAssignment(
                org_id=org_id,
                role_id=role_id,
                accessor_type=accessor_type,
                accessor_id=accessor_id,
                assigned_by=assigned_by
            )
            db.add(assignment)

        db.commit()
        db.refresh(assignment)
        return assignment

    @staticmethod
    def list_role_assignments(db: Session, org_id: uuid.UUID) -> List[OrgRoleAssignment]:
        return db.query(OrgRoleAssignment).filter(OrgRoleAssignment.org_id == org_id).all()

    @staticmethod
    def get_effective_roles_for_user(db: Session, org_id: uuid.UUID, user_id: uuid.UUID):
        direct_assignments = db.query(OrgRoleAssignment).filter(
            OrgRoleAssignment.org_id == org_id,
            OrgRoleAssignment.accessor_type == AccessorType.USER,
            OrgRoleAssignment.accessor_id == user_id
        ).all()

        team_ids = [tm.team_id for tm in db.query(TeamMember).filter(TeamMember.user_id == user_id).all()]
        team_assignments = []
        if team_ids:
            team_assignments = db.query(OrgRoleAssignment).filter(
                OrgRoleAssignment.org_id == org_id,
                OrgRoleAssignment.accessor_type == AccessorType.TEAM,
                OrgRoleAssignment.accessor_id.in_(team_ids)
            ).all()

        assignments = direct_assignments + team_assignments
        roles = [a.role for a in assignments if a.role]
        effective = None
        if roles:
            effective = sorted(roles, key=lambda r: r.priority, reverse=True)[0]
        return effective, assignments
