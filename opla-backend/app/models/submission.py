import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base


class SubmissionReviewStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("forms.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Null for public submissions
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("form_datasets.id"), nullable=True)
    dataset_schema_version_id = Column(UUID(as_uuid=True), ForeignKey("form_dataset_schema_versions.id"), nullable=True)
    data = Column(JSONB, nullable=False) # The actual form response
    metadata_json = Column(JSONB, nullable=True) # Browser info, duration, etc.
    form_version_number = Column(Integer, nullable=True)
    review_status = Column(
        Enum(SubmissionReviewStatus, name="submission_review_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=SubmissionReviewStatus.SUBMITTED,
    )
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_comment = Column(Text, nullable=True)
    # For directory form submissions only: True/False to activate or deactivate an entry.
    # NULL for regular form submissions (irrelevant).
    directory_is_active = Column(Boolean, nullable=True, default=None)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    form = relationship("Form", backref="submissions")
    user = relationship("User", foreign_keys=[user_id], backref="submissions")
    dataset = relationship("FormDataset", backref="submissions")
    dataset_schema_version = relationship("FormDatasetSchemaVersion", backref="submissions")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
