from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
from app.models.project_access import AccessorType
import enum


class ProjectReportStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ProjectReport(Base):
    __tablename__ = "project_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    content = Column(JSONB, nullable=False, default=list, server_default="[]")
    status = Column(
        Enum(ProjectReportStatus, name="project_report_status", values_callable=lambda obj: [e.value for e in obj]),
        default=ProjectReportStatus.DRAFT,
        nullable=False,
    )
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
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="reports")
    creator = relationship("User")