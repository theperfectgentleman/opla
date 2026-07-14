from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class FormSubmissionMedia(Base):
    __tablename__ = "form_submission_media"
    __table_args__ = (UniqueConstraint("submission_id", "field_bind", name="uq_submission_media_field"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(
        UUID(as_uuid=True),
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    form_id = Column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    field_bind = Column(String, nullable=False)
    field_label = Column(String, nullable=True)
    field_type = Column(String, nullable=False)
    media_kind = Column(String, nullable=False, index=True)
    url = Column(Text, nullable=True)
    filename = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    byte_size = Column(Integer, nullable=True)
    payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    submission = relationship("Submission", backref="media_items")
    form = relationship("Form", backref="media_items")
    project = relationship("Project", backref="media_items")
