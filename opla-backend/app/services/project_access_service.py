from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.permission_catalog import LEGACY_PROJECT_ROLE_BY_TEMPLATE_SLUG, PROJECT_ROLE_PERMISSION_MAP, VALID_PERMISSION_KEYS
from app.models.form import Form
from app.models.org_member import OrgMember, GlobalRole
from app.models.project import Project, ProjectStatus
from app.models.project_access import ProjectAccess, ProjectRole, AccessorType
from app.models.project_role_template import ProjectRoleTemplate
from app.models.team import Team
from app.models.team_member import TeamMember
from app.services.organization_service import OrganizationService

import uuid


class ProjectAccessService:
    @staticmethod
    def _get_membership(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> OrgMember | None:
        return (
            db.query(OrgMember)
            .filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id)
            .first()
        )

    @staticmethod
    def _is_org_admin(membership: OrgMember | None) -> bool:
        return membership is not None and membership.global_role == GlobalRole.ADMIN

    @staticmethod
    def _project_has_access_rules(db: Session, project_id: uuid.UUID) -> bool:
        return db.query(ProjectAccess).filter(ProjectAccess.project_id == project_id).first() is not None

    @staticmethod
    def _effective_project_permissions(
        db: Session,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> set[str]:
        def resolve_permissions(access: ProjectAccess) -> set[str]:
            if access.role_template:
                return set(access.role_template.permissions)
            if access.role:
                return PROJECT_ROLE_PERMISSION_MAP.get(access.role.value, set())
            return set()

        direct_permissions = [
            resolve_permissions(access)
            for access in db.query(ProjectAccess).filter(
                ProjectAccess.project_id == project_id,
                ProjectAccess.accessor_type == AccessorType.USER,
                ProjectAccess.accessor_id == user_id,
            )
        ]

        team_ids = [
            membership.team_id
            for membership in db.query(TeamMember).filter(TeamMember.user_id == user_id).all()
        ]

        team_permissions = []
        if team_ids:
            team_permissions = [
                resolve_permissions(access)
                for access in db.query(ProjectAccess).filter(
                    ProjectAccess.project_id == project_id,
                    ProjectAccess.accessor_type == AccessorType.TEAM,
                    ProjectAccess.accessor_id.in_(team_ids),
                )
            ]

        permissions: set[str] = set()
        for permission_set in direct_permissions + team_permissions:
            permissions.update(permission_set)
        return permissions

    @staticmethod
    def _get_effective_permissions(db: Session, project: Project, user_id: uuid.UUID) -> set[str]:
        membership = ProjectAccessService._get_membership(db, project.org_id, user_id)
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        if ProjectAccessService._is_org_admin(membership):
            return set(VALID_PERMISSION_KEYS)

        permissions = OrganizationService.get_effective_permissions_for_user(db, project.org_id, user_id)
        permissions.update(ProjectAccessService._effective_project_permissions(db, project.id, user_id))
        return permissions

    @staticmethod
    def _ensure_project_permission(
        db: Session,
        user_id: uuid.UUID,
        project: Project,
        permission: str,
        *,
        error_detail: str,
        allow_open_view: bool = False,
    ) -> Project:
        permissions = ProjectAccessService._get_effective_permissions(db, project, user_id)
        if permission in permissions:
            return project

        if allow_open_view and permission == "project.view" and not ProjectAccessService._project_has_access_rules(db, project.id):
            return project

        raise HTTPException(status_code=403, detail=error_detail)

    @staticmethod
    def get_project_or_404(db: Session, project_id: uuid.UUID) -> Project:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    @staticmethod
    def ensure_can_view_project(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
        project = ProjectAccessService.get_project_or_404(db, project_id)
        return ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "project.view",
            error_detail="You do not have access to this project",
            allow_open_view=True,
        )

    @staticmethod
    def ensure_can_edit_project(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
        project = ProjectAccessService.get_project_or_404(db, project_id)
        return ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "project.edit",
            error_detail="Project edit permission is required for this project",
        )

    @staticmethod
    def ensure_can_manage_project_access(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
        project = ProjectAccessService.get_project_or_404(db, project_id)
        return ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "project.manage_access",
            error_detail="Project access management permission is required for this project",
        )

    @staticmethod
    def ensure_can_manage_project_lifecycle(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
        project = ProjectAccessService.get_project_or_404(db, project_id)
        return ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "project.manage_lifecycle",
            error_detail="Project lifecycle management permission is required for this project",
        )

    @staticmethod
    def ensure_can_create_form(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
        project = ProjectAccessService.get_project_or_404(db, project_id)
        project = ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "form.create",
            error_detail="Form creation permission is required for this project",
        )
        ProjectAccessService.ensure_project_is_mutable(project)
        return project

    @staticmethod
    def ensure_project_is_mutable(project: Project) -> None:
        if project.status == ProjectStatus.ARCHIVED:
            raise HTTPException(status_code=409, detail="Project is archived")

    @staticmethod
    def ensure_project_is_active(project: Project) -> None:
        if project.status != ProjectStatus.ACTIVE:
            raise HTTPException(status_code=409, detail="Project is not active")

    @staticmethod
    def ensure_can_view_form(db: Session, user_id: uuid.UUID, form: Form) -> Project:
        project = ProjectAccessService.get_project_or_404(db, form.project_id)
        return ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "form.view",
            error_detail="Form view permission is required for this project",
            allow_open_view=not ProjectAccessService._project_has_access_rules(db, project.id),
        )

    @staticmethod
    def ensure_can_edit_form(db: Session, user_id: uuid.UUID, form: Form) -> Project:
        project = ProjectAccessService.get_project_or_404(db, form.project_id)
        project = ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "form.edit",
            error_detail="Form edit permission is required for this project",
        )
        ProjectAccessService.ensure_project_is_mutable(project)
        return project

    @staticmethod
    def ensure_can_publish_form(db: Session, user_id: uuid.UUID, form: Form) -> Project:
        project = ProjectAccessService.get_project_or_404(db, form.project_id)
        project = ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "form.publish",
            error_detail="Form publish permission is required for this project",
        )
        ProjectAccessService.ensure_project_is_mutable(project)
        return project

    @staticmethod
    def ensure_can_submit_form(db: Session, user_id: uuid.UUID, form: Form) -> Project:
        project = ProjectAccessService.get_project_or_404(db, form.project_id)
        return ProjectAccessService._ensure_project_permission(
            db,
            user_id,
            project,
            "submission.create",
            error_detail="Submission permission is required for this project",
            allow_open_view=not ProjectAccessService._project_has_access_rules(db, project.id),
        )

    @staticmethod
    def list_access_rules(db: Session, project_id: uuid.UUID) -> list[ProjectAccess]:
        return (
            db.query(ProjectAccess)
            .filter(ProjectAccess.project_id == project_id)
            .order_by(ProjectAccess.accessor_type.asc(), ProjectAccess.id.asc())
            .all()
        )

    @staticmethod
    def grant_access(
        db: Session,
        project: Project,
        *,
        accessor_id: uuid.UUID,
        accessor_type: AccessorType,
        role: ProjectRole | None = None,
        role_template_id: uuid.UUID | None = None,
    ) -> ProjectAccess:
        if accessor_type == AccessorType.USER:
            member = ProjectAccessService._get_membership(db, project.org_id, accessor_id)
            if not member:
                raise HTTPException(status_code=400, detail="User is not a member of this organization")
        else:
            team = db.query(Team).filter(Team.id == accessor_id, Team.org_id == project.org_id).first()
            if not team:
                raise HTTPException(status_code=400, detail="Team not found in this organization")

        role_template = None
        if role_template_id:
            role_template = (
                db.query(ProjectRoleTemplate)
                .filter(ProjectRoleTemplate.org_id == project.org_id, ProjectRoleTemplate.id == role_template_id)
                .first()
            )
            if not role_template:
                raise HTTPException(status_code=400, detail="Project role template not found")
        elif role is None:
            raise HTTPException(status_code=400, detail="A project role template is required")

        legacy_role = role
        if legacy_role is None and role_template and role_template.slug in LEGACY_PROJECT_ROLE_BY_TEMPLATE_SLUG:
            legacy_role = ProjectRole(LEGACY_PROJECT_ROLE_BY_TEMPLATE_SLUG[role_template.slug])

        access = (
            db.query(ProjectAccess)
            .filter(
                ProjectAccess.project_id == project.id,
                ProjectAccess.accessor_id == accessor_id,
                ProjectAccess.accessor_type == accessor_type,
            )
            .first()
        )
        if access:
            access.role = legacy_role
            access.role_template_id = role_template.id if role_template else None
        else:
            access = ProjectAccess(
                project_id=project.id,
                accessor_id=accessor_id,
                accessor_type=accessor_type,
                role=legacy_role,
                role_template_id=role_template.id if role_template else None,
            )
            db.add(access)

        db.commit()
        db.refresh(access)
        return access

    @staticmethod
    def revoke_access(
        db: Session,
        project_id: uuid.UUID,
        accessor_id: uuid.UUID,
        accessor_type: AccessorType,
    ) -> None:
        access = (
            db.query(ProjectAccess)
            .filter(
                ProjectAccess.project_id == project_id,
                ProjectAccess.accessor_id == accessor_id,
                ProjectAccess.accessor_type == accessor_type,
            )
            .first()
        )
        if not access:
            raise HTTPException(status_code=404, detail="Project access rule not found")

        db.delete(access)
        db.commit()