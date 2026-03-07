from sqlalchemy.orm import Session
from app.models.project import Project
from app.models.project import ProjectStatus
from app.models.form import Form, FormStatus
from app.models.form_dataset import (
    FormDataset,
    FormDatasetField,
    FormDatasetFieldStatus,
    FormDatasetSchemaVersion,
    FormDatasetStatus,
)
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
    def _normalize_identifier(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = re.sub(r"[^a-zA-Z0-9_]+", "_", str(value).strip())
        normalized = normalized.strip("_")
        return normalized or None

    @staticmethod
    def _generate_field_identifier(seed: Optional[str] = None) -> str:
        normalized_seed = FormService._normalize_identifier(seed)
        if normalized_seed:
            return normalized_seed
        return f"field_{uuid.uuid4().hex[:12]}"

    @staticmethod
    def _normalize_blueprint(blueprint: Optional[Dict]) -> Dict:
        payload = dict(blueprint or {})
        schema = payload.get("schema")
        ui = payload.get("ui")

        normalized_schema = []
        field_identifiers_by_key: Dict[str, str] = {}
        used_identifiers: set[str] = set()

        if isinstance(schema, list):
            for index, raw_entry in enumerate(schema):
                entry = dict(raw_entry) if isinstance(raw_entry, dict) else {"type": "string"}
                raw_key = entry.get("key")
                normalized_key = FormService._normalize_identifier(raw_key) or f"field_{index + 1}"
                identifier = FormService._normalize_identifier(
                    entry.get("id") or entry.get("field_id") or entry.get("dataset_field_id") or normalized_key
                )
                if not identifier or identifier in used_identifiers:
                    identifier = FormService._generate_field_identifier(normalized_key)
                    while identifier in used_identifiers:
                        identifier = FormService._generate_field_identifier()

                entry["key"] = normalized_key
                entry["id"] = identifier
                entry["field_id"] = identifier
                entry["dataset_field_id"] = identifier
                normalized_schema.append(entry)
                field_identifiers_by_key[normalized_key] = identifier
                used_identifiers.add(identifier)

        if isinstance(ui, list):
            normalized_ui = []
            for section_index, raw_section in enumerate(ui):
                section = dict(raw_section) if isinstance(raw_section, dict) else {}
                section_id = FormService._normalize_identifier(section.get("id")) or f"screen_{section_index + 1}"
                section["id"] = section_id

                children = section.get("children") or []
                normalized_children = []
                for child_index, raw_child in enumerate(children):
                    child = dict(raw_child) if isinstance(raw_child, dict) else {}
                    raw_bind = child.get("bind") or child.get("key") or child.get("field_id") or child.get("id")
                    normalized_bind = FormService._normalize_identifier(raw_bind) or f"field_{child_index + 1}"
                    identifier = field_identifiers_by_key.get(normalized_bind)
                    if not identifier:
                        identifier = FormService._normalize_identifier(child.get("field_id") or child.get("id"))
                    if not identifier or identifier in used_identifiers and field_identifiers_by_key.get(normalized_bind) != identifier:
                        identifier = FormService._generate_field_identifier(normalized_bind)
                        while identifier in used_identifiers:
                            identifier = FormService._generate_field_identifier()

                    child["bind"] = normalized_bind
                    child["id"] = identifier
                    child["field_id"] = identifier
                    child["dataset_field_id"] = identifier
                    normalized_children.append(child)

                    if normalized_bind not in field_identifiers_by_key:
                        field_identifiers_by_key[normalized_bind] = identifier
                        normalized_schema.append(
                            {
                                "key": normalized_bind,
                                "id": identifier,
                                "field_id": identifier,
                                "dataset_field_id": identifier,
                                "type": child.get("type") or "string",
                                "required": bool(child.get("required")),
                            }
                        )
                    used_identifiers.add(identifier)

                section["children"] = normalized_children
                normalized_ui.append(section)

            payload["ui"] = normalized_ui

        payload["schema"] = normalized_schema
        return payload

    @staticmethod
    def _extract_schema_fields(blueprint: Optional[Dict]) -> List[Dict]:
        schema = (blueprint or {}).get("schema") or []
        extracted: List[Dict] = []
        if not isinstance(schema, list):
            return extracted

        for index, field in enumerate(schema):
            if not isinstance(field, dict):
                continue

            identifier = (
                field.get("id")
                or field.get("field_id")
                or field.get("dataset_field_id")
                or field.get("key")
            )
            if not identifier:
                identifier = f"field_{index + 1}"

            extracted.append(
                {
                    "identifier": str(identifier),
                    "key": field.get("key") or str(identifier),
                    "label": field.get("label") or field.get("title") or field.get("key") or str(identifier),
                    "field_type": field.get("type"),
                    "definition": field,
                }
            )

        return extracted

    @staticmethod
    def _build_schema_change_summary(
        previous_schema: Optional[Dict],
        current_schema: Optional[Dict],
    ) -> Dict:
        previous_fields = {
            field["identifier"]: field for field in FormService._extract_schema_fields(previous_schema)
        }
        current_fields = {
            field["identifier"]: field for field in FormService._extract_schema_fields(current_schema)
        }

        previous_ids = set(previous_fields)
        current_ids = set(current_fields)

        modified = []
        for identifier in sorted(previous_ids & current_ids):
            old_definition = previous_fields[identifier].get("definition") or {}
            new_definition = current_fields[identifier].get("definition") or {}
            if old_definition != new_definition:
                modified.append(
                    {
                        "field_identifier": identifier,
                        "previous_key": previous_fields[identifier].get("key"),
                        "current_key": current_fields[identifier].get("key"),
                    }
                )

        return {
            "added": sorted(current_ids - previous_ids),
            "removed": sorted(previous_ids - current_ids),
            "modified": modified,
        }

    @staticmethod
    def _sync_dataset_fields(
        db: Session,
        dataset: FormDataset,
        schema_version_number: int,
        blueprint: Optional[Dict],
    ) -> None:
        current_fields = FormService._extract_schema_fields(blueprint)
        current_by_identifier = {field["identifier"]: field for field in current_fields}
        existing_fields = (
            db.query(FormDatasetField)
            .filter(FormDatasetField.dataset_id == dataset.id)
            .all()
        )
        existing_by_identifier = {field.field_identifier: field for field in existing_fields}

        for identifier, field in current_by_identifier.items():
            record = existing_by_identifier.get(identifier)
            if record:
                record.field_key = field.get("key")
                record.label = field.get("label")
                record.field_type = field.get("field_type")
                record.status = FormDatasetFieldStatus.ACTIVE
                record.retired_in_version_number = None
                record.metadata_json = field.get("definition")
                continue

            db.add(
                FormDatasetField(
                    dataset_id=dataset.id,
                    field_identifier=identifier,
                    field_key=field.get("key"),
                    label=field.get("label"),
                    field_type=field.get("field_type"),
                    status=FormDatasetFieldStatus.ACTIVE,
                    introduced_in_version_number=schema_version_number,
                    metadata_json=field.get("definition"),
                )
            )

        for identifier, record in existing_by_identifier.items():
            if identifier in current_by_identifier:
                continue
            record.status = FormDatasetFieldStatus.LEGACY
            if record.retired_in_version_number is None:
                record.retired_in_version_number = schema_version_number

    @staticmethod
    def ensure_live_dataset(
        db: Session,
        form: Form,
        live_snapshot: Optional[FormVersion] = None,
        changelog: Optional[str] = None,
    ) -> tuple[Optional[FormDataset], Optional[FormDatasetSchemaVersion]]:
        blueprint = form.blueprint_live
        if not blueprint:
            return None, None

        dataset = (
            db.query(FormDataset)
            .filter(FormDataset.form_id == form.id)
            .with_for_update(of=FormDataset)
            .first()
        )
        if not dataset:
            dataset = FormDataset(
                form_id=form.id,
                name=form.title,
                slug=form.slug,
                status=FormDatasetStatus.ACTIVE,
                current_schema_version_number=0,
                last_form_version_number=form.published_version or form.version,
                metadata_json={"source": "form_publish"},
            )
            db.add(dataset)
            db.flush()

        dataset.name = form.title
        dataset.slug = form.slug
        dataset.status = FormDatasetStatus.ACTIVE
        dataset.last_form_version_number = form.published_version or form.version

        target_version_number = None
        if live_snapshot and live_snapshot.version_number is not None:
            target_version_number = live_snapshot.version_number
        else:
            target_version_number = form.published_version or form.version or 1

        existing_version = (
            db.query(FormDatasetSchemaVersion)
            .filter(
                FormDatasetSchemaVersion.dataset_id == dataset.id,
                FormDatasetSchemaVersion.version_number == target_version_number,
            )
            .first()
        )

        latest_version = (
            db.query(FormDatasetSchemaVersion)
            .filter(FormDatasetSchemaVersion.dataset_id == dataset.id)
            .order_by(FormDatasetSchemaVersion.version_number.desc())
            .first()
        )

        previous_blueprint = latest_version.blueprint_snapshot if latest_version else None
        change_summary = FormService._build_schema_change_summary(previous_blueprint, blueprint)
        if changelog:
            change_summary["changelog"] = changelog

        if existing_version:
            existing_version.form_version_id = live_snapshot.id if live_snapshot else existing_version.form_version_id
            existing_version.schema_snapshot = blueprint.get("schema") or []
            existing_version.blueprint_snapshot = blueprint
            if existing_version.change_summary_json is None:
                existing_version.change_summary_json = change_summary
            existing_version.published_at = form.published_at or existing_version.published_at
            schema_version = existing_version
        else:
            schema_version = FormDatasetSchemaVersion(
                dataset_id=dataset.id,
                form_version_id=live_snapshot.id if live_snapshot else None,
                version_number=target_version_number,
                schema_snapshot=blueprint.get("schema") or [],
                blueprint_snapshot=blueprint,
                change_summary_json=change_summary,
                published_at=form.published_at,
            )
            db.add(schema_version)
            db.flush()

        dataset.current_schema_version_number = target_version_number
        FormService._sync_dataset_fields(db, dataset, target_version_number, blueprint)
        return dataset, schema_version

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
        blueprint = FormService._normalize_blueprint(blueprint)
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
            blueprint = FormService._normalize_blueprint(blueprint)
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
        db.flush()

        form.blueprint_live = blueprint
        form.status = FormStatus.LIVE
        form.version = live_version
        form.published_version = live_version
        form.published_at = published_at

        FormService._ensure_active_draft_exists(db, form)
        FormService.ensure_live_dataset(
            db,
            form=form,
            live_snapshot=live_snapshot,
            changelog=changelog,
        )

        db.commit()
        db.refresh(form)
        return form

    @staticmethod
    def get_project_forms(db: Session, project_id: uuid.UUID, live_only: bool = False) -> List[Form]:
        q = db.query(Form).filter(Form.project_id == project_id)
        if live_only:
            q = q.filter(Form.status == FormStatus.LIVE)
        return q.all()

    @staticmethod
    def get_form_stats(db: Session, form_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        from app.models.submission import Submission
        from sqlalchemy import func
        total = db.query(func.count(Submission.id)).filter(
            Submission.form_id == form_id
        ).scalar() or 0
        mine = db.query(func.count(Submission.id)).filter(
            Submission.form_id == form_id,
            Submission.user_id == user_id,
        ).scalar() or 0
        last_at = db.query(func.max(Submission.created_at)).filter(
            Submission.form_id == form_id
        ).scalar()
        return {"total": total, "mine": mine, "last_submitted_at": last_at}

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
