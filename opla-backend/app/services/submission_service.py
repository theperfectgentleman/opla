from sqlalchemy.orm import Session
from app.models.submission import Submission
from app.models.form import Form, FormStatus
from app.models.form_dataset import FormDatasetSchemaVersion
from app.models.project import ProjectStatus
import uuid
from typing import Dict, Optional

class SubmissionService:
    @staticmethod
    def create_submission(
        db: Session, 
        form_id: uuid.UUID, 
        data: Dict, 
        user_id: Optional[uuid.UUID] = None,
        metadata: Optional[Dict] = None
    ) -> Submission:
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form or form.status != FormStatus.LIVE or not form.blueprint_live:
            raise ValueError("FORM_NOT_PUBLISHED")
        if not form.project or form.project.status != ProjectStatus.ACTIVE:
            raise ValueError("PROJECT_NOT_ACTIVE")

        from app.services.form_service import FormService

        dataset, schema_version = FormService.ensure_live_dataset(db, form)
        if dataset and not schema_version and dataset.current_schema_version_number is not None:
            schema_version = (
                db.query(FormDatasetSchemaVersion)
                .filter(
                    FormDatasetSchemaVersion.dataset_id == dataset.id,
                    FormDatasetSchemaVersion.version_number == dataset.current_schema_version_number,
                )
                .first()
            )

        submission = Submission(
            form_id=form_id,
            user_id=user_id,
            dataset_id=dataset.id if dataset else None,
            dataset_schema_version_id=schema_version.id if schema_version else None,
            data=data,
            metadata_json=metadata,
            form_version_number=form.published_version or form.version,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def get_form_by_slug(db: Session, slug: str) -> Optional[Form]:
        return db.query(Form).filter(Form.slug == slug).first()
