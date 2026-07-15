"""Directory Form Service

Handles all business logic specific to directory-kind forms:
  - Listing directory forms for a project
  - Resolving directory entries (latest-per-key, deduplicated view)
  - Upserting entries (append-only submissions; latest-wins by key)
  - Activating / deactivating entries (one-click, no re-submission)
  - Permanently deleting entries (all versions for a key)
  - Validating that a directory form is ready to publish
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.form import Form, FormKind, FormStatus
from app.models.submission import Submission


class DirectoryFormService:

    @staticmethod
    def list_directory_forms(db: Session, project_id: uuid.UUID) -> list[Form]:
        """Return all directory forms for a project (any status)."""
        return (
            db.query(Form)
            .filter(Form.project_id == project_id, Form.kind == FormKind.DIRECTORY)
            .order_by(Form.created_at.desc())
            .all()
        )

    @staticmethod
    def get_directory_entries(db: Session, form: Form) -> list[dict[str, Any]]:
        if form.kind != FormKind.DIRECTORY:
            raise HTTPException(status_code=400, detail="Form is not a directory")
        if not form.directory_key_field_id:
            return []

        key_field = form.directory_key_field_id
        label_field = form.directory_label_field_id or key_field

        sql = text(
            """
            SELECT
                s.id              AS submission_id,
                s.data->>:key_field   AS key_value,
                s.data->>:label_field AS label_value,
                s.data,
                s.directory_is_active,
                s.created_at
            FROM (
                SELECT DISTINCT ON (data->>:key_field) *
                FROM submissions
                WHERE form_id = :form_id
                  AND (directory_is_active IS NULL OR directory_is_active = TRUE)
                ORDER BY data->>:key_field, created_at DESC
            ) s
            ORDER BY s.data->>:label_field
            """
        )
        rows = db.execute(
            sql,
            {
                "form_id": str(form.id),
                "key_field": key_field,
                "label_field": label_field,
            },
        ).fetchall()

        return [
            {
                "submission_id": str(row.submission_id),
                "key_value": row.key_value,
                "label_value": row.label_value,
                "data": row.data or {},
                "directory_is_active": row.directory_is_active if row.directory_is_active is not None else True,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]

    @staticmethod
    def upsert_entry(
        db: Session,
        form: Form,
        data: dict[str, Any],
        actor_id: uuid.UUID,
    ) -> Submission:
        if form.kind != FormKind.DIRECTORY:
            raise HTTPException(status_code=400, detail="Form is not a directory")
        if form.status != FormStatus.LIVE:
            raise HTTPException(status_code=400, detail="Directory form is not published")

        key_field = form.directory_key_field_id
        if key_field and not data.get(key_field):
            raise HTTPException(
                status_code=422,
                detail=f"Directory key field '{key_field}' is required and must have a value",
            )

        submission = Submission(
            form_id=form.id,
            user_id=actor_id,
            data=data,
            directory_is_active=True,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def set_entry_active(
        db: Session,
        form: Form,
        submission_id: uuid.UUID,
        active: bool,
    ) -> dict[str, Any]:
        submission = (
            db.query(Submission)
            .filter(Submission.id == submission_id, Submission.form_id == form.id)
            .first()
        )
        if not submission:
            raise HTTPException(status_code=404, detail="Directory entry not found")

        submission.directory_is_active = active
        db.commit()
        db.refresh(submission)

        key_field = form.directory_key_field_id or ""
        label_field = form.directory_label_field_id or key_field
        data = submission.data or {}

        return {
            "submission_id": str(submission.id),
            "key_value": data.get(key_field),
            "label_value": data.get(label_field),
            "data": data,
            "directory_is_active": submission.directory_is_active,
            "created_at": submission.created_at.isoformat() if submission.created_at else None,
        }

    @staticmethod
    def delete_entry(
        db: Session,
        form: Form,
        submission_id: uuid.UUID,
    ) -> dict[str, Any]:
        if form.kind != FormKind.DIRECTORY:
            raise HTTPException(status_code=400, detail="Form is not a directory")

        submission = (
            db.query(Submission)
            .filter(Submission.id == submission_id, Submission.form_id == form.id)
            .first()
        )
        if not submission:
            raise HTTPException(status_code=404, detail="Directory entry not found")

        key_field = form.directory_key_field_id
        if not key_field:
            raise HTTPException(status_code=422, detail="Directory has no key field configured")

        data = submission.data or {}
        key_value = data.get(key_field)
        if key_value is None or str(key_value).strip() == "":
            raise HTTPException(status_code=422, detail="Directory entry has no key value")

        key_value_str = str(key_value)
        sql = text(
            """
            DELETE FROM submissions
            WHERE form_id = :form_id
              AND data->>:key_field = :key_value
            RETURNING id
            """
        )
        rows = db.execute(
            sql,
            {
                "form_id": str(form.id),
                "key_field": key_field,
                "key_value": key_value_str,
            },
        ).fetchall()
        db.commit()

        if not rows:
            raise HTTPException(status_code=404, detail="Directory entry not found")

        return {
            "deleted_count": len(rows),
            "key_value": key_value_str,
        }

    @staticmethod
    def update_directory_designations(
        db: Session,
        form: Form,
        directory_key_field_id: str | None,
        directory_label_field_id: str | None,
    ) -> Form:
        if form.kind != FormKind.DIRECTORY:
            raise HTTPException(status_code=400, detail="Form is not a directory")

        form.directory_key_field_id = directory_key_field_id
        form.directory_label_field_id = directory_label_field_id
        db.commit()
        db.refresh(form)
        return form

    BLOCKED_FIELD_TYPES: frozenset[str] = frozenset(
        [
            "gps_capture",
            "photo_capture",
            "file_upload",
            "signature_pad",
            "audio_recorder",
            "object_collection",
            "object_instance",
            "form_link",
        ]
    )

    @staticmethod
    def extract_directory_blueprint_fields(directory: Form) -> list[dict[str, str]]:
        blueprint = directory.blueprint_live or {}
        fields: list[dict[str, str]] = []
        for screen in blueprint.get("ui", []) or []:
            for child in screen.get("children", []) or []:
                field_type = str(child.get("type") or "")
                if field_type in DirectoryFormService.BLOCKED_FIELD_TYPES:
                    continue
                bind = str(child.get("bind") or "").strip()
                if not bind:
                    continue
                fields.append(
                    {
                        "bind": bind,
                        "label": str(child.get("label") or bind),
                    }
                )
        return fields

    @staticmethod
    def list_lookup_sources(db: Session, form: Form) -> list[dict[str, Any]]:
        directories = (
            db.query(Form)
            .filter(
                Form.project_id == form.project_id,
                Form.kind == FormKind.DIRECTORY,
                Form.status == FormStatus.LIVE,
                Form.directory_key_field_id.isnot(None),
                Form.directory_label_field_id.isnot(None),
            )
            .order_by(Form.title.asc())
            .all()
        )
        return [
            {
                "id": str(directory.id),
                "title": directory.title,
                "directory_key_field_id": directory.directory_key_field_id or "",
                "directory_label_field_id": directory.directory_label_field_id or "",
                "fields": DirectoryFormService.extract_directory_blueprint_fields(directory),
            }
            for directory in directories
        ]

    @staticmethod
    def get_directory_form_for_lookup(
        db: Session,
        consumer_form: Form,
        directory_form_id: uuid.UUID,
    ) -> Form:
        directory = db.query(Form).filter(Form.id == directory_form_id).first()
        if not directory or directory.kind != FormKind.DIRECTORY:
            raise HTTPException(status_code=404, detail="Directory form not found")
        if directory.project_id != consumer_form.project_id:
            raise HTTPException(status_code=404, detail="Directory form not found")
        if directory.status != FormStatus.LIVE:
            raise HTTPException(status_code=404, detail="Directory form is not published")
        if not directory.directory_key_field_id or not directory.directory_label_field_id:
            raise HTTPException(status_code=400, detail="Directory form is missing key/label designations")
        return directory

    @staticmethod
    def get_lookup_options(
        db: Session,
        *,
        consumer_form: Form,
        directory_form_id: uuid.UUID,
        search: str | None = None,
        limit: int = 500,
    ) -> dict[str, Any]:
        directory = DirectoryFormService.get_directory_form_for_lookup(db, consumer_form, directory_form_id)
        entries = DirectoryFormService.get_directory_entries(db, directory)

        search_term = (search or "").strip().lower()
        options: list[dict[str, Any]] = []
        for entry in entries:
            label = str(entry.get("label_value") or "")
            value = str(entry.get("key_value") or "")
            if not label or not value:
                continue
            if search_term and search_term not in label.lower() and search_term not in value.lower():
                continue
            options.append(
                {
                    "label": label,
                    "value": value,
                    "submission_id": entry["submission_id"],
                    "created_at": entry.get("created_at"),
                    "data": entry.get("data") or {},
                }
            )
            if len(options) >= limit:
                break

        return {
            "directory_form_id": str(directory.id),
            "directory_form_title": directory.title,
            "label_field": directory.directory_label_field_id or "",
            "value_field": directory.directory_key_field_id or "",
            "synced_at": datetime.utcnow(),
            "total_options": len(options),
            "options": options,
        }

    @staticmethod
    def build_source_items(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for entry in entries:
            key_value = entry.get("key_value")
            label_value = entry.get("label_value")
            data = entry.get("data") or {}
            item = {
                "id": entry.get("submission_id"),
                "sku_code": key_value,
                "label": label_value,
                **data,
            }
            items.append(item)
        return items

    @staticmethod
    def get_public_lookup_options(
        db: Session,
        *,
        slug: str,
        directory_form_id: uuid.UUID,
        search: str | None = None,
        limit: int = 500,
    ) -> dict[str, Any]:
        from app.models.form import Form
        from app.models.project import ProjectStatus

        form = db.query(Form).filter(Form.slug == slug).first()
        if (
            not form
            or not form.is_public
            or form.status != FormStatus.LIVE
            or not form.blueprint_live
            or not form.project
            or form.project.status != ProjectStatus.ACTIVE
        ):
            raise HTTPException(status_code=404, detail="Form not found or not public")

        return DirectoryFormService.get_lookup_options(
            db,
            consumer_form=form,
            directory_form_id=directory_form_id,
            search=search,
            limit=limit,
        )

    @staticmethod
    def validate_ready_to_publish(form: Form) -> None:
        if form.kind != FormKind.DIRECTORY:
            return

        if not form.directory_key_field_id:
            raise HTTPException(
                status_code=422,
                detail="Directory forms require a Key Field designation before publishing.",
            )
        if not form.directory_label_field_id:
            raise HTTPException(
                status_code=422,
                detail="Directory forms require a Label Field designation before publishing.",
            )
