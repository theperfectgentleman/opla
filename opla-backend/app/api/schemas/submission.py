from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, List

from app.models.submission import SubmissionReviewStatus

class SubmissionCreate(BaseModel):
    form_id: UUID
    data: Dict
    metadata: Optional[Dict] = None

class PublicSubmissionCreate(BaseModel):
    data: Dict
    metadata: Optional[Dict] = None


class SubmissionReviewUpdate(BaseModel):
    review_status: SubmissionReviewStatus
    review_comment: Optional[str] = None


class SubmissionListOut(BaseModel):
    items: List["SubmissionOut"]

class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    form_id: UUID
    user_id: Optional[UUID] = None
    dataset_id: Optional[UUID] = None
    dataset_schema_version_id: Optional[UUID] = None
    form_version_number: Optional[int] = None
    data: Dict
    metadata_json: Optional[Dict] = None
    review_status: SubmissionReviewStatus
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    review_comment: Optional[str] = None
    created_at: datetime


SubmissionListOut.model_rebuild()
