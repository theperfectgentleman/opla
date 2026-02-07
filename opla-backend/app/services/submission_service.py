from sqlalchemy.orm import Session
from app.models.submission import Submission
from app.models.form import Form
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
        submission = Submission(
            form_id=form_id,
            user_id=user_id,
            data=data,
            metadata_json=metadata
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def get_form_by_slug(db: Session, slug: str) -> Optional[Form]:
        return db.query(Form).filter(Form.slug == slug).first()
