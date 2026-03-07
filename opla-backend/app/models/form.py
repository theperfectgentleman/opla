from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
from app.models.project_access import AccessorType
import enum

class FormStatus(str, enum.Enum):
    DRAFT = "draft"
    LIVE = "live"
    ARCHIVED = "archived"

class Form(Base):
    __tablename__ = "forms"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    blueprint_draft = Column(JSONB, nullable=True)
    blueprint_live = Column(JSONB, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)
    status = Column(Enum(FormStatus, name="form_status", values_callable=lambda obj: [e.value for e in obj]), default=FormStatus.DRAFT, nullable=False)
    published_version = Column(Integer, nullable=True)
    published_at = Column(DateTime, nullable=True)
    lead_accessor_id = Column(UUID(as_uuid=True), nullable=True)
    lead_accessor_type = Column(
        Enum(AccessorType, name="accessor_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    assigned_accessor_id = Column(UUID(as_uuid=True), nullable=True)
    assigned_accessor_type = Column(
        Enum(AccessorType, name="accessor_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    guest_accessor_id = Column(UUID(as_uuid=True), nullable=True)
    guest_accessor_type = Column(
        Enum(AccessorType, name="accessor_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    project = relationship("Project", back_populates="forms")
