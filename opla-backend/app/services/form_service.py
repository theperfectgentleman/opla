from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.project import ProjectStatus
from app.models.form import Form, FormStatus
from app.models.form_version import FormVersion, FormVersionKind
from app.models.project_access import ProjectAccess, ProjectRole, AccessorType
from app.models.org_member import OrgMember
from app.models.team import Team
import uuid
from typing import List, Optional, Dict
import re
from datetime import datetime
from fastapi import HTTPException

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

class ProjectService:
    @staticmethod
    def create_project(
        db: Session,
        org_id: uuid.UUID,
        name: str,
        description: Optional[str] = None,
        created_by: Optional[uuid.UUID] = None,
    ) -> Project:
        project = Project(
            org_id=org_id,
            name=name,
            description=description
        )
        db.add(project)
        db.flush()

        if created_by:
            db.add(
                ProjectAccess(
                    project_id=project.id,
                    accessor_id=created_by,
                    accessor_type=AccessorType.USER,
                    role=ProjectRole.EDITOR,
                )
            )

        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def get_org_projects(db: Session, org_id: uuid.UUID) -> List[Project]:
        return db.query(Project).filter(Project.org_id == org_id).all()

    @staticmethod
    def get_project(db: Session, project_id: uuid.UUID) -> Optional[Project]:
        return db.query(Project).filter(Project.id == project_id).first()

    @staticmethod
    def update_project(
        db: Session,
        project: Project,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[ProjectStatus] = None,
    ) -> Project:
        if name is not None:
            project.name = name
        if description is not None:
            project.description = description
        if status is not None and status != project.status:
            project.status = status
            now = datetime.utcnow()
            if status == ProjectStatus.ACTIVE:
                project.activated_at = now
                project.paused_at = None
                project.archived_at = None
            elif status == ProjectStatus.PAUSED:
                project.paused_at = now
                project.archived_at = None
            elif status == ProjectStatus.ARCHIVED:
                project.archived_at = now
            elif status == ProjectStatus.PLANNING:
                project.paused_at = None
                project.archived_at = None

        db.commit()
        db.refresh(project)
        return project

class FormService:
    DRAFT_SLOTS = (1, 2, 3)

    @staticmethod
    def _validate_accessor(
        db: Session,
        project: Project,
        accessor_id: uuid.UUID | None,
        accessor_type: AccessorType | None,
        label: str,
    ) -> None:
        if accessor_id is None and accessor_type is None:
            return

        if accessor_id is None or accessor_type is None:
            raise HTTPException(status_code=400, detail=f"{label} accessor id and type must be provided together")

        if accessor_type == AccessorType.USER:
            membership = (
                db.query(OrgMember)
                .filter(OrgMember.org_id == project.org_id, OrgMember.user_id == accessor_id)
                .first()
            )
            if not membership:
                raise HTTPException(status_code=400, detail=f"{label} user is not a member of this organization")
            return

        team = (
            db.query(Team)
            .filter(Team.id == accessor_id, Team.org_id == project.org_id)
            .first()
        )
        if not team:
            raise HTTPException(status_code=400, detail=f"{label} team was not found in this organization")

    @staticmethod
    def _next_version_number(db: Session, form_id: uuid.UUID) -> int:
        latest = (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id)
            .order_by(FormVersion.version_number.desc())
            .first()
        )
        return (latest.version_number if latest else 0) + 1

    @staticmethod
    def _get_active_live(db: Session, form_id: uuid.UUID) -> Optional[FormVersion]:
        return (
            db.query(FormVersion)
            .filter(
                FormVersion.form_id == form_id,
                FormVersion.kind == FormVersionKind.LIVE,
                FormVersion.is_active.is_(True),
            )
            .first()
        )

    @staticmethod
    def _get_active_draft_in_slot(db: Session, form_id: uuid.UUID, slot_index: int) -> Optional[FormVersion]:
        return (
            db.query(FormVersion)
            .filter(
                FormVersion.form_id == form_id,
                FormVersion.kind == FormVersionKind.DRAFT,
                FormVersion.slot_index == slot_index,
                FormVersion.is_active.is_(True),
            )
            .first()
        )

    @staticmethod
    def _ensure_slot(slot_index: Optional[int]) -> int:
        slot = slot_index or 1
        if slot not in FormService.DRAFT_SLOTS:
            raise ValueError("Draft slot must be one of: 1, 2, or 3")
        return slot

    @staticmethod
    def _upsert_draft_snapshot(
        db: Session,
        form: Form,
        blueprint: Dict,
        slot_index: int,
        created_by: Optional[uuid.UUID] = None,
    ) -> FormVersion:
        existing = FormService._get_active_draft_in_slot(db, form.id, slot_index)
        if existing:
            existing.is_active = False

        snapshot = FormVersion(
            form_id=form.id,
            version_number=FormService._next_version_number(db, form.id),
            kind=FormVersionKind.DRAFT,
            slot_index=slot_index,
            blueprint=blueprint or {},
            created_by=created_by,
            is_active=True,
        )
        db.add(snapshot)
        return snapshot

    @staticmethod
    def _ensure_active_draft_exists(db: Session, form: Form) -> None:
        active_drafts = (
            db.query(FormVersion)
            .filter(
                FormVersion.form_id == form.id,
                FormVersion.kind == FormVersionKind.DRAFT,
                FormVersion.is_active.is_(True),
            )
            .all()
        )
        if active_drafts:
            return

        FormService._upsert_draft_snapshot(
            db,
            form=form,
            blueprint=form.blueprint_live or form.blueprint_draft or {},
            slot_index=1,
        )

    @staticmethod
    def create_form(db: Session, project_id: uuid.UUID, title: str, blueprint: Optional[Dict] = None) -> Form:
        base_slug = slugify(title)
        slug = base_slug
        counter = 1
        while db.query(Form).filter(Form.slug == slug).first():
            slug = f"{base_slug}-{counter}"
            counter += 1
            
        form = Form(
            project_id=project_id,
            title=title,
            slug=slug,
            blueprint_draft=blueprint,
            version=0,
            status=FormStatus.DRAFT
        )
        db.add(form)
        db.flush()

        FormService._upsert_draft_snapshot(db, form=form, blueprint=blueprint or {}, slot_index=1)

        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def update_blueprint(
        db: Session,
        form_id: uuid.UUID,
        blueprint: Dict,
        target_slot: Optional[int] = None,
        updated_by: Optional[uuid.UUID] = None,
    ) -> Form:
        form = db.query(Form).filter(Form.id == form_id).first()
        if form:
            slot_index = FormService._ensure_slot(target_slot)
            form.blueprint_draft = blueprint
            if blueprint and "meta" in blueprint and "title" in blueprint["meta"]:
                form.title = blueprint["meta"]["title"]

            FormService._upsert_draft_snapshot(
                db,
                form=form,
                blueprint=blueprint or {},
                slot_index=slot_index,
                created_by=updated_by,
            )

            db.commit()
            db.refresh(form)
        return form

    @staticmethod
    def get_form(db: Session, form_id: uuid.UUID) -> Optional[Form]:
        return db.query(Form).filter(Form.id == form_id).first()

    @staticmethod
    def get_form_versions(db: Session, form_id: uuid.UUID) -> List[FormVersion]:
        return (
            db.query(FormVersion)
            .filter(FormVersion.form_id == form_id, FormVersion.is_active.is_(True))
            .order_by(FormVersion.version_number.desc())
            .all()
        )

    @staticmethod
    def get_runtime_form_by_id(db: Session, form_id: uuid.UUID) -> Optional[Form]:
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form or not form.blueprint_live or form.status != FormStatus.LIVE:
            return None
        return form

    @staticmethod
    def publish_form(
        db: Session,
        form_id: uuid.UUID,
        draft_version_id: Optional[uuid.UUID] = None,
        draft_slot: Optional[int] = None,
        changelog: Optional[str] = None,
        published_by: Optional[uuid.UUID] = None,
    ) -> Form:
        form = db.query(Form).filter(Form.id == form_id).with_for_update().first()
        if not form:
            return None

        selected_draft = None
        if draft_version_id:
            selected_draft = (
                db.query(FormVersion)
                .filter(
                    FormVersion.id == draft_version_id,
                    FormVersion.form_id == form.id,
                    FormVersion.kind == FormVersionKind.DRAFT,
                    FormVersion.is_active.is_(True),
                )
                .first()
            )
        elif draft_slot is not None:
            slot_index = FormService._ensure_slot(draft_slot)
            selected_draft = FormService._get_active_draft_in_slot(db, form.id, slot_index)
        else:
            # Default publish behavior always promotes the working draft slot (1).
            selected_draft = FormService._get_active_draft_in_slot(db, form.id, 1)

        blueprint = selected_draft.blueprint if selected_draft else form.blueprint_draft
        if not blueprint:
            raise ValueError("No draft blueprint available to publish")

        current_live = FormService._get_active_live(db, form.id)
        if current_live:
            current_live.is_active = False

        published_at = datetime.utcnow()
        live_version = (form.version or 0) + 1

        live_snapshot = FormVersion(
            form_id=form.id,
            version_number=live_version,
            kind=FormVersionKind.LIVE,
            blueprint=blueprint,
            created_by=published_by,
            changelog=changelog,
            published_at=published_at,
            is_active=True,
        )
        db.add(live_snapshot)

        form.blueprint_live = blueprint
        form.status = FormStatus.LIVE
        form.version = live_version
        form.published_version = live_version
        form.published_at = published_at

        FormService._ensure_active_draft_exists(db, form)

        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def get_project_forms(db: Session, project_id: uuid.UUID) -> List[Form]:
        return db.query(Form).filter(Form.project_id == project_id).all()

    @staticmethod
    def update_responsibility(
        db: Session,
        form: Form,
        *,
        lead_accessor_id: uuid.UUID | None,
        lead_accessor_type: AccessorType | None,
        assigned_accessor_id: uuid.UUID | None,
        assigned_accessor_type: AccessorType | None,
        guest_accessor_id: uuid.UUID | None,
        guest_accessor_type: AccessorType | None,
    ) -> Form:
        project = form.project
        FormService._validate_accessor(db, project, lead_accessor_id, lead_accessor_type, "Lead")
        FormService._validate_accessor(db, project, assigned_accessor_id, assigned_accessor_type, "Assigned")
        FormService._validate_accessor(db, project, guest_accessor_id, guest_accessor_type, "Guest")

        form.lead_accessor_id = lead_accessor_id
        form.lead_accessor_type = lead_accessor_type
        form.assigned_accessor_id = assigned_accessor_id
        form.assigned_accessor_type = assigned_accessor_type
        form.guest_accessor_id = guest_accessor_id
        form.guest_accessor_type = guest_accessor_type

        db.commit()
        db.refresh(form)
        return form
