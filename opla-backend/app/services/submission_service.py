from sqlalchemy.orm import Session
from app.models.submission import Submission
from app.models.form import Form, FormStatus
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

        submission = Submission(
            form_id=form_id,
            user_id=user_id,
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
