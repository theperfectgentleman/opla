from sqlalchemy import Column, DateTime, ForeignKey, Integer, Boolean, Enum, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
import enum

from app.models.base import Base


class FormVersionKind(str, enum.Enum):
    DRAFT = "draft"
    LIVE = "live"


class FormVersion(Base):
    __tablename__ = "form_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("forms.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    kind = Column(
        Enum(
            FormVersionKind,
            name="form_version_kind",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )
    # Draft slots are bounded to 1..3; null for live snapshots.
    slot_index = Column(Integer, nullable=True)
    blueprint = Column(JSONB, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    changelog = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)

    form = relationship("Form", backref="versions")

    __table_args__ = (
        # Keep one active live snapshot per form.
        Index(
            "ix_form_versions_active_live",
            "form_id",
            unique=True,
            postgresql_where=(kind == FormVersionKind.LIVE) & (is_active.is_(True)),
        ),
        # Keep one active draft per slot per form.
        Index(
            "ix_form_versions_active_draft_slot",
            "form_id",
            "slot_index",
            unique=True,
            postgresql_where=(kind == FormVersionKind.DRAFT) & (is_active.is_(True)),
        ),
    )
