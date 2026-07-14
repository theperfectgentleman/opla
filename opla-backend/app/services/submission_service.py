from datetime import datetime

from sqlalchemy.orm import Session
from app.models.submission import Submission
from app.models.form import Form, FormStatus
from app.models.form_automation_rule import FormAutomationEvent
from app.models.form_dataset import FormDatasetSchemaVersion
from app.models.project import ProjectStatus
import uuid
from typing import Dict, Optional

from app.models.submission import SubmissionReviewStatus
from app.services.form_automation_service import FormAutomationService

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
            review_status=SubmissionReviewStatus.SUBMITTED,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        FormAutomationService.run_submission_event(
            db,
            submission,
            FormAutomationEvent.SUBMISSION_CREATED,
            actor_id=user_id,
            context={"metadata": metadata or {}},
        )
        from app.services.project_attention_service import ProjectAttentionService
        from app.services.form_submission_media_service import FormSubmissionMediaService

        ProjectAttentionService.on_submission_created(db, submission)
        try:
            FormSubmissionMediaService.index_submission(db, form, submission, commit=True)
        except Exception:
            db.rollback()
        return submission

    @staticmethod
    def list_form_submissions(
        db: Session,
        form_id: uuid.UUID,
        review_status: SubmissionReviewStatus | None = None,
    ) -> list[Submission]:
        query = db.query(Submission).filter(Submission.form_id == form_id)
        if review_status is not None:
            query = query.filter(Submission.review_status == review_status)
        return query.order_by(Submission.created_at.desc()).all()

    @staticmethod
    def get_submission_or_404(db: Session, submission_id: uuid.UUID) -> Submission:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError("SUBMISSION_NOT_FOUND")
        return submission

    @staticmethod
    def review_submission(
        db: Session,
        submission_id: uuid.UUID,
        *,
        review_status: SubmissionReviewStatus,
        reviewed_by: uuid.UUID,
        review_comment: Optional[str] = None,
    ) -> Submission:
        submission = SubmissionService.get_submission_or_404(db, submission_id)
        submission.review_status = review_status
        submission.review_comment = review_comment.strip() if review_comment else None
        if review_status == SubmissionReviewStatus.SUBMITTED:
            submission.reviewed_by = None
            submission.reviewed_at = None
        else:
            submission.reviewed_by = reviewed_by
            submission.reviewed_at = datetime.utcnow()

        FormAutomationService.run_submission_event(
            db,
            submission,
            FormAutomationEvent.SUBMISSION_REVIEWED,
            actor_id=reviewed_by,
            context={"review_status": review_status.value},
        )
        if review_status == SubmissionReviewStatus.APPROVED:
            FormAutomationService.run_submission_event(
                db,
                submission,
                FormAutomationEvent.SUBMISSION_APPROVED,
                actor_id=reviewed_by,
                context={"review_status": review_status.value},
            )
        db.commit()
        db.refresh(submission)
        from app.services.project_attention_service import ProjectAttentionService

        ProjectAttentionService.on_submission_reviewed(db, submission)
        return submission

    @staticmethod
    def get_form_by_slug(db: Session, slug: str) -> Optional[Form]:
        return db.query(Form).filter(Form.slug == slug).first()
