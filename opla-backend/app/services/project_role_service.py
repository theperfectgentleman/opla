import re
import uuid
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.permission_catalog import STARTER_PROJECT_ROLE_TEMPLATES, validate_permissions
from app.models.project_role_template import ProjectRoleTemplate


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


class ProjectRoleService:
    @staticmethod
    def ensure_default_roles(db: Session, org_id: uuid.UUID) -> None:
        existing_count = (
            db.query(ProjectRoleTemplate)
            .filter(ProjectRoleTemplate.org_id == org_id)
            .count()
        )
        if existing_count == 0:
            ProjectRoleService.seed_default_roles(db, org_id)
            db.commit()

    @staticmethod
    def seed_default_roles(db: Session, org_id: uuid.UUID) -> None:
        for role_data in STARTER_PROJECT_ROLE_TEMPLATES:
            existing = (
                db.query(ProjectRoleTemplate)
                .filter(ProjectRoleTemplate.org_id == org_id, ProjectRoleTemplate.slug == role_data["slug"])
                .first()
            )
            if existing:
                continue

            db.add(
                ProjectRoleTemplate(
                    org_id=org_id,
                    name=role_data["name"],
                    slug=role_data["slug"],
                    description=role_data["description"],
                    permissions=role_data["permissions"],
                    priority=role_data["priority"],
                    is_system=role_data["is_system"],
                )
            )

    @staticmethod
    def list_roles(db: Session, org_id: uuid.UUID) -> List[ProjectRoleTemplate]:
        ProjectRoleService.ensure_default_roles(db, org_id)
        return (
            db.query(ProjectRoleTemplate)
            .filter(ProjectRoleTemplate.org_id == org_id)
            .order_by(ProjectRoleTemplate.priority.desc(), ProjectRoleTemplate.name.asc())
            .all()
        )

    @staticmethod
    def get_role(db: Session, org_id: uuid.UUID, role_template_id: uuid.UUID) -> Optional[ProjectRoleTemplate]:
        return (
            db.query(ProjectRoleTemplate)
            .filter(ProjectRoleTemplate.org_id == org_id, ProjectRoleTemplate.id == role_template_id)
            .first()
        )

    @staticmethod
    def create_role(
        db: Session,
        org_id: uuid.UUID,
        *,
        name: str,
        description: Optional[str],
        permissions: List[str],
        priority: int,
    ) -> ProjectRoleTemplate:
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while db.query(ProjectRoleTemplate).filter(ProjectRoleTemplate.org_id == org_id, ProjectRoleTemplate.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1

        role = ProjectRoleTemplate(
            org_id=org_id,
            name=name,
            slug=slug,
            description=description,
            permissions=validate_permissions(permissions),
            priority=priority,
            is_system=False,
        )
        db.add(role)
        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def update_role(
        db: Session,
        org_id: uuid.UUID,
        role_template_id: uuid.UUID,
        *,
        name: Optional[str],
        description: Optional[str],
        permissions: Optional[List[str]],
        priority: Optional[int],
    ) -> Optional[ProjectRoleTemplate]:
        role = ProjectRoleService.get_role(db, org_id, role_template_id)
        if not role:
            return None

        if name and not role.is_system:
            role.name = name
        if description is not None:
            role.description = description
        if permissions is not None:
            role.permissions = validate_permissions(permissions)
        if priority is not None:
            role.priority = priority

        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def delete_role(db: Session, org_id: uuid.UUID, role_template_id: uuid.UUID) -> bool:
        role = ProjectRoleService.get_role(db, org_id, role_template_id)
        if not role or role.is_system or role.assignments:
            return False

        db.delete(role)
        db.commit()
        return True