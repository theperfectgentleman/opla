from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
from app.models.project_access import AccessorType
import enum


class ProjectTaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class ProjectTaskKind(str, enum.Enum):
    GENERAL = "general"
    JOURNEY_VISIT = "journey_visit"


class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    kind = Column(
        Enum(ProjectTaskKind, name="project_task_kind", values_callable=lambda obj: [e.value for e in obj]),
        default=ProjectTaskKind.GENERAL,
        nullable=False,
    )
    status = Column(
        Enum(ProjectTaskStatus, name="project_task_status", values_callable=lambda obj: [e.value for e in obj]),
        default=ProjectTaskStatus.TODO,
        nullable=False,
    )
    starts_at = Column(DateTime, nullable=True)
    due_at = Column(DateTime, nullable=True)
    visit_date = Column(Date, nullable=True)
    source_submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id"), nullable=True, index=True)
    assigned_accessor_id = Column(UUID(as_uuid=True), nullable=True)
    assigned_accessor_type = Column(
        Enum(AccessorType, name="accessor_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=True,
    )
    completed_at = Column(DateTime, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", backref="project_tasks")
    creator = relationship("User")
    source_submission = relationship("Submission")