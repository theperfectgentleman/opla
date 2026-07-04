"""Catalog Form Service

Handles all business logic specific to catalog-kind forms:
  - Listing catalog forms for a project
  - Resolving catalog entries (latest-per-key, deduplicated view)
  - Upserting entries (append-only submissions; latest-wins by key)
  - Activating / deactivating entries (one-click, no re-submission)
  - Permanently deleting entries (all versions for a key)
  - Validating that a catalog form is ready to publish
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


class CatalogFormService:

    # ------------------------------------------------------------------ #
    #  Queries                                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    def list_catalog_forms(db: Session, project_id: uuid.UUID) -> list[Form]:
        """Return all catalog forms for a project (any status)."""
        return (
            db.query(Form)
            .filter(Form.project_id == project_id, Form.kind == FormKind.CATALOG)
            .order_by(Form.created_at.desc())
            .all()
        )

    @staticmethod
    def get_catalog_entries(db: Session, form: Form) -> list[dict[str, Any]]:
        """
        Latest-per-key resolver using PostgreSQL's DISTINCT ON.

        For each unique value of the catalog key field, returns only the most
        recently created submission.  Submissions with catalog_is_active = False
        are treated as deactivated and excluded from the result.

        Returns a list of plain dicts with:
          - submission_id
          - key_value  (value of catalog_key_field_id in data)
          - label_value  (value of catalog_label_field_id in data)
          - data  (full submission data dict)
          - catalog_is_active
          - created_at
        """
        if form.kind != FormKind.CATALOG:
            raise HTTPException(status_code=400, detail="Form is not a catalog")
        if not form.catalog_key_field_id:
            return []

        key_field = form.catalog_key_field_id
        label_field = form.catalog_label_field_id or key_field

        # DISTINCT ON picks the first row per (key_value) after ORDER BY created_at DESC
        # We wrap it so we can also filter out deactivated entries.
        sql = text(
            """
            SELECT
                s.id              AS submission_id,
                s.data->>:key_field   AS key_value,
                s.data->>:label_field AS label_value,
                s.data,
                s.catalog_is_active,
                s.created_at
            FROM (
                SELECT DISTINCT ON (data->>:key_field) *
                FROM submissions
                WHERE form_id = :form_id
                  AND (catalog_is_active IS NULL OR catalog_is_active = TRUE)
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
                "catalog_is_active": row.catalog_is_active if row.catalog_is_active is not None else True,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]

    # ------------------------------------------------------------------ #
    #  Mutations                                                           #
    # ------------------------------------------------------------------ #

    @staticmethod
    def upsert_entry(
        db: Session,
        form: Form,
        data: dict[str, Any],
        actor_id: uuid.UUID,
    ) -> Submission:
        """
        Always INSERT a new submission (append-only).
        The latest-per-key query in get_catalog_entries handles deduplication.
        Sets catalog_is_active = True so the new entry is immediately visible.
        """
        if form.kind != FormKind.CATALOG:
            raise HTTPException(status_code=400, detail="Form is not a catalog")
        if form.status != FormStatus.LIVE:
            raise HTTPException(status_code=400, detail="Catalog form is not published")

        key_field = form.catalog_key_field_id
        if key_field and not data.get(key_field):
            raise HTTPException(
                status_code=422,
                detail=f"Catalog key field '{key_field}' is required and must have a value",
            )

        submission = Submission(
            form_id=form.id,
            user_id=actor_id,
            data=data,
            catalog_is_active=True,
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
        """
        Toggle catalog_is_active on a specific submission.
        One DB write; no form re-submission needed.
        """
        submission = (
            db.query(Submission)
            .filter(Submission.id == submission_id, Submission.form_id == form.id)
            .first()
        )
        if not submission:
            raise HTTPException(status_code=404, detail="Catalog entry not found")

        submission.catalog_is_active = active
        db.commit()
        db.refresh(submission)

        key_field = form.catalog_key_field_id or ""
        label_field = form.catalog_label_field_id or key_field
        data = submission.data or {}

        return {
            "submission_id": str(submission.id),
            "key_value": data.get(key_field),
            "label_value": data.get(label_field),
            "data": data,
            "catalog_is_active": submission.catalog_is_active,
            "created_at": submission.created_at.isoformat() if submission.created_at else None,
        }

    @staticmethod
    def delete_entry(
        db: Session,
        form: Form,
        submission_id: uuid.UUID,
    ) -> dict[str, Any]:
        """
        Permanently delete all submissions for this catalog key value.
        Removes every historical version tied to the entry, not just the latest row.
        """
        if form.kind != FormKind.CATALOG:
            raise HTTPException(status_code=400, detail="Form is not a catalog")

        submission = (
            db.query(Submission)
            .filter(Submission.id == submission_id, Submission.form_id == form.id)
            .first()
        )
        if not submission:
            raise HTTPException(status_code=404, detail="Catalog entry not found")

        key_field = form.catalog_key_field_id
        if not key_field:
            raise HTTPException(status_code=422, detail="Catalog has no key field configured")

        data = submission.data or {}
        key_value = data.get(key_field)
        if key_value is None or str(key_value).strip() == "":
            raise HTTPException(status_code=422, detail="Catalog entry has no key value")

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
            raise HTTPException(status_code=404, detail="Catalog entry not found")

        return {
            "deleted_count": len(rows),
            "key_value": key_value_str,
        }

    # ------------------------------------------------------------------ #
    #  Catalog designation (key / label field assignment)                 #
    # ------------------------------------------------------------------ #

    @staticmethod
    def update_catalog_designations(
        db: Session,
        form: Form,
        catalog_key_field_id: str | None,
        catalog_label_field_id: str | None,
    ) -> Form:
        """Persist key/label field designations for a catalog form."""
        if form.kind != FormKind.CATALOG:
            raise HTTPException(status_code=400, detail="Form is not a catalog")

        form.catalog_key_field_id = catalog_key_field_id
        form.catalog_label_field_id = catalog_label_field_id
        db.commit()
        db.refresh(form)
        return form

    # ------------------------------------------------------------------ #
    #  Validation                                                          #
    # ------------------------------------------------------------------ #

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
    def extract_catalog_blueprint_fields(catalog: Form) -> list[dict[str, str]]:
        """Scalar fields from a catalog form blueprint for column pickers."""
        blueprint = catalog.blueprint_live or {}
        fields: list[dict[str, str]] = []
        for screen in blueprint.get("ui", []) or []:
            for child in screen.get("children", []) or []:
                field_type = str(child.get("type") or "")
                if field_type in CatalogFormService.BLOCKED_FIELD_TYPES:
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
        """Return live catalog forms in the same project that can back survey lookups."""
        catalogs = (
            db.query(Form)
            .filter(
                Form.project_id == form.project_id,
                Form.kind == FormKind.CATALOG,
                Form.status == FormStatus.LIVE,
                Form.catalog_key_field_id.isnot(None),
                Form.catalog_label_field_id.isnot(None),
            )
            .order_by(Form.title.asc())
            .all()
        )
        return [
            {
                "id": str(catalog.id),
                "title": catalog.title,
                "catalog_key_field_id": catalog.catalog_key_field_id or "",
                "catalog_label_field_id": catalog.catalog_label_field_id or "",
                "fields": CatalogFormService.extract_catalog_blueprint_fields(catalog),
            }
            for catalog in catalogs
        ]

    @staticmethod
    def get_catalog_form_for_lookup(
        db: Session,
        consumer_form: Form,
        catalog_form_id: uuid.UUID,
    ) -> Form:
        catalog = db.query(Form).filter(Form.id == catalog_form_id).first()
        if not catalog or catalog.kind != FormKind.CATALOG:
            raise HTTPException(status_code=404, detail="Catalog form not found")
        if catalog.project_id != consumer_form.project_id:
            raise HTTPException(status_code=404, detail="Catalog form not found")
        if catalog.status != FormStatus.LIVE:
            raise HTTPException(status_code=404, detail="Catalog form is not published")
        if not catalog.catalog_key_field_id or not catalog.catalog_label_field_id:
            raise HTTPException(status_code=400, detail="Catalog form is missing key/label designations")
        return catalog

    @staticmethod
    def get_lookup_options(
        db: Session,
        *,
        consumer_form: Form,
        catalog_form_id: uuid.UUID,
        search: str | None = None,
        limit: int = 500,
    ) -> dict[str, Any]:
        catalog = CatalogFormService.get_catalog_form_for_lookup(db, consumer_form, catalog_form_id)
        entries = CatalogFormService.get_catalog_entries(db, catalog)

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
            "catalog_form_id": str(catalog.id),
            "catalog_form_title": catalog.title,
            "label_field": catalog.catalog_label_field_id or "",
            "value_field": catalog.catalog_key_field_id or "",
            "synced_at": datetime.utcnow(),
            "total_options": len(options),
            "options": options,
        }

    @staticmethod
    def build_source_items(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize catalog entries for object-collection reference hydration."""
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
        catalog_form_id: uuid.UUID,
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

        return CatalogFormService.get_lookup_options(
            db,
            consumer_form=form,
            catalog_form_id=catalog_form_id,
            search=search,
            limit=limit,
        )

    @staticmethod
    def validate_ready_to_publish(form: Form) -> None:
        """
        Called by the publish route before promoting a catalog form to live.
        Raises HTTPException(422) if any required designations are missing.
        """
        if form.kind != FormKind.CATALOG:
            return  # Standard forms: no extra validation

        if not form.catalog_key_field_id:
            raise HTTPException(
                status_code=422,
                detail="Catalog forms require a Key Field designation before publishing.",
            )
        if not form.catalog_label_field_id:
            raise HTTPException(
                status_code=422,
                detail="Catalog forms require a Label Field designation before publishing.",
            )
