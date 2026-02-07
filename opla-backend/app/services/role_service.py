from sqlalchemy.orm import Session
from app.models.role_template import OrgRole, OrgRoleAssignment
from app.api.schemas.role import OrgRoleCreate, OrgRoleUpdate
from uuid import UUID
from typing import List, Optional


class RoleService:
    @staticmethod
    def create_role(db: Session, org_id: UUID, role_data: OrgRoleCreate, is_system: bool = False) -> OrgRole:
        """Create a new role template for an organization"""
        role = OrgRole(
            org_id=org_id,
            name=role_data.name,
            slug=role_data.slug,
            description=role_data.description,
            permissions=role_data.permissions,
            priority=role_data.priority,
            is_system=is_system
        )
        db.add(role)
        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def get_org_roles(db: Session, org_id: UUID) -> List[OrgRole]:
        """Get all roles for an organization"""
        return db.query(OrgRole).filter(OrgRole.org_id == org_id).order_by(OrgRole.priority.desc()).all()

    @staticmethod
    def get_role(db: Session, role_id: UUID) -> Optional[OrgRole]:
        """Get a specific role by ID"""
        return db.query(OrgRole).filter(OrgRole.id == role_id).first()

    @staticmethod
    def update_role(db: Session, role_id: UUID, role_data: OrgRoleUpdate) -> Optional[OrgRole]:
        """Update a role template (only if not system role)"""
        role = db.query(OrgRole).filter(OrgRole.id == role_id).first()
        if not role or role.is_system:
            return None
        
        if role_data.name is not None:
            role.name = role_data.name
        if role_data.description is not None:
            role.description = role_data.description
        if role_data.permissions is not None:
            role.permissions = role_data.permissions
        if role_data.priority is not None:
            role.priority = role_data.priority
        
        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def delete_role(db: Session, role_id: UUID) -> bool:
        """Delete a role template (only if not system role and no assignments)"""
        role = db.query(OrgRole).filter(OrgRole.id == role_id).first()
        if not role or role.is_system:
            return False
        
        # Check if role has any assignments
        assignment_count = db.query(OrgRoleAssignment).filter(OrgRoleAssignment.role_id == role_id).count()
        if assignment_count > 0:
            return False
        
        db.delete(role)
        db.commit()
        return True

    @staticmethod
    def assign_role(db: Session, org_id: UUID, role_id: UUID, accessor_id: UUID, 
                   accessor_type: str, assigned_by: UUID) -> OrgRoleAssignment:
        """Assign a role to a user or team"""
        # Remove existing assignment if any
        db.query(OrgRoleAssignment).filter(
            OrgRoleAssignment.org_id == org_id,
            OrgRoleAssignment.accessor_id == accessor_id,
            OrgRoleAssignment.accessor_type == accessor_type
        ).delete()
        
        assignment = OrgRoleAssignment(
            org_id=org_id,
            role_id=role_id,
            accessor_id=accessor_id,
            accessor_type=accessor_type,
            assigned_by=assigned_by
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        return assignment

    @staticmethod
    def get_assignments_for_org(db: Session, org_id: UUID) -> List[OrgRoleAssignment]:
        """Get all role assignments for an organization"""
        return db.query(OrgRoleAssignment).filter(OrgRoleAssignment.org_id == org_id).all()

    @staticmethod
    def remove_assignment(db: Session, org_id: UUID, accessor_id: UUID, accessor_type: str) -> bool:
        """Remove a role assignment"""
        result = db.query(OrgRoleAssignment).filter(
            OrgRoleAssignment.org_id == org_id,
            OrgRoleAssignment.accessor_id == accessor_id,
            OrgRoleAssignment.accessor_type == accessor_type
        ).delete()
        db.commit()
        return result > 0

    @staticmethod
    def seed_system_roles(db: Session, org_id: UUID):
        """Seed default system roles for a new organization"""
        system_roles = [
            {
                "name": "Collector",
                "slug": "collector",
                "description": "Can collect data via mobile app",
                "permissions": ["form.view", "submission.create", "submission.view_own"],
                "priority": 10
            },
            {
                "name": "Analyst",
                "slug": "analyst",
                "description": "Can view and analyze submissions",
                "permissions": ["form.view", "submission.view", "submission.export"],
                "priority": 20
            },
            {
                "name": "Editor",
                "slug": "editor",
                "description": "Can create and edit forms",
                "permissions": ["form.view", "form.create", "form.edit", "form.delete", 
                               "submission.view", "submission.export", "submission.edit"],
                "priority": 30
            }
        ]
        
        for role_data in system_roles:
            existing = db.query(OrgRole).filter(
                OrgRole.org_id == org_id,
                OrgRole.slug == role_data["slug"]
            ).first()
            
            if not existing:
                role = OrgRole(
                    org_id=org_id,
                    name=role_data["name"],
                    slug=role_data["slug"],
                    description=role_data["description"],
                    permissions=role_data["permissions"],
                    priority=role_data["priority"],
                    is_system=True
                )
                db.add(role)
        
        db.commit()
