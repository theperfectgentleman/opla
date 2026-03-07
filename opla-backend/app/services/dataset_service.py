from datetime import datetime
from typing import Optional
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.models.form import Form, FormStatus
from app.models.form_dataset import FormDataset
from app.models.form_dataset import FormDatasetFieldStatus
from app.models.project import ProjectStatus
from app.models.submission import Submission


class DatasetService:
    @staticmethod
    def update_form_dataset(
        db: Session,
        *,
        form: Form,
        lookup_enabled: Optional[bool] = None,
        public_lookup_enabled: Optional[bool] = None,
    ) -> FormDataset:
        dataset = DatasetService.get_form_dataset(db, form.id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found for this form")

        if lookup_enabled is not None:
            dataset.lookup_enabled = lookup_enabled

        if public_lookup_enabled is not None:
            dataset.public_lookup_enabled = public_lookup_enabled

        if dataset.public_lookup_enabled and not dataset.lookup_enabled:
            dataset.lookup_enabled = True

        db.commit()
        db.refresh(dataset)
        return DatasetService.get_form_dataset(db, form.id)

    @staticmethod
    def get_form_dataset(db: Session, form_id: uuid.UUID) -> Optional[FormDataset]:
        return (
            db.query(FormDataset)
            .options(
                selectinload(FormDataset.fields),
                selectinload(FormDataset.schema_versions),
            )
            .filter(FormDataset.form_id == form_id)
            .first()
        )

    @staticmethod
    def get_dataset(db: Session, dataset_id: uuid.UUID) -> Optional[FormDataset]:
        return (
            db.query(FormDataset)
            .options(
                selectinload(FormDataset.fields),
                selectinload(FormDataset.schema_versions),
            )
            .filter(FormDataset.id == dataset_id)
            .first()
        )

    @staticmethod
    def list_lookup_sources_for_form(db: Session, form: Form) -> list[FormDataset]:
        return (
            db.query(FormDataset)
            .join(Form, Form.id == FormDataset.form_id)
            .options(selectinload(FormDataset.fields))
            .filter(
                Form.project_id == form.project_id,
                Form.status == FormStatus.LIVE,
                Form.blueprint_live.is_not(None),
                FormDataset.lookup_enabled.is_(True),
                FormDataset.current_schema_version_number > 0,
            )
            .order_by(FormDataset.updated_at.desc())
            .all()
        )

    @staticmethod
    def _get_lookup_dataset_or_404(db: Session, form: Form, dataset_id: uuid.UUID) -> FormDataset:
        dataset = (
            db.query(FormDataset)
            .join(Form, Form.id == FormDataset.form_id)
            .options(selectinload(FormDataset.fields))
            .filter(
                FormDataset.id == dataset_id,
                Form.project_id == form.project_id,
                Form.status == FormStatus.LIVE,
                Form.blueprint_live.is_not(None),
            )
            .first()
        )
        if not dataset:
            raise HTTPException(status_code=404, detail="Lookup dataset not found")
        if not dataset.lookup_enabled:
            raise HTTPException(status_code=404, detail="Lookup dataset not enabled")
        return dataset

    @staticmethod
    def get_lookup_options(
        db: Session,
        *,
        form: Form,
        dataset_id: uuid.UUID,
        label_field: str,
        value_field: str,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> dict:
        dataset = DatasetService._get_lookup_dataset_or_404(db, form, dataset_id)

        available_keys = {
            field.field_key
            for field in dataset.fields
            if field.status in {FormDatasetFieldStatus.ACTIVE, FormDatasetFieldStatus.LEGACY}
        }
        if label_field not in available_keys or value_field not in available_keys:
            raise HTTPException(status_code=400, detail="Lookup label/value fields must exist on the dataset")

        submissions = (
            db.query(Submission)
            .filter(Submission.dataset_id == dataset.id)
            .order_by(Submission.created_at.desc())
            .all()
        )

        search_term = (search or "").strip().lower()
        deduped: dict[str, dict] = {}
        for submission in submissions:
            payload = submission.data or {}
            raw_label = payload.get(label_field)
            raw_value = payload.get(value_field)
            if raw_label in (None, "") or raw_value in (None, ""):
                continue

            label = str(raw_label)
            value = str(raw_value)
            if search_term and search_term not in label.lower() and search_term not in value.lower():
                continue
            if value in deduped:
                continue

            deduped[value] = {
                "label": label,
                "value": value,
                "submission_id": submission.id,
                "created_at": submission.created_at,
            }
            if len(deduped) >= limit:
                break

        return {
            "dataset_id": dataset.id,
            "label_field": label_field,
            "value_field": value_field,
            "synced_at": datetime.utcnow(),
            "total_options": len(deduped),
            "options": list(deduped.values()),
        }

    @staticmethod
    def get_public_lookup_options(
        db: Session,
        *,
        slug: str,
        dataset_id: uuid.UUID,
        label_field: str,
        value_field: str,
        search: Optional[str] = None,
        limit: int = 100,
    ) -> dict:
        form = (
            db.query(Form)
            .filter(Form.slug == slug)
            .first()
        )
        if (
            not form
            or not form.is_public
            or form.status != FormStatus.LIVE
            or not form.blueprint_live
            or not form.project
            or form.project.status != ProjectStatus.ACTIVE
        ):
            raise HTTPException(status_code=404, detail="Form not found or not public")

        dataset = DatasetService._get_lookup_dataset_or_404(db, form, dataset_id)
        if not dataset.public_lookup_enabled:
            raise HTTPException(status_code=404, detail="Lookup dataset not available for public forms")

        return DatasetService.get_lookup_options(
            db,
            form=form,
            dataset_id=dataset_id,
            label_field=label_field,
            value_field=value_field,
            search=search,
            limit=limit,
        )