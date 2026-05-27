from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Text, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
import enum


class ProjectAttendanceStatus(str, enum.Enum):
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"


class ProjectAttendanceRecord(Base):
    __tablename__ = "project_attendance_records"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", "attendance_date", name="uq_project_attendance_project_user_date"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attendance_date = Column(Date, nullable=False, index=True)
    status = Column(
        Enum(ProjectAttendanceStatus, name="project_attendance_status", values_callable=lambda obj: [e.value for e in obj]),
        default=ProjectAttendanceStatus.CHECKED_IN,
        nullable=False,
    )
    check_in_at = Column(DateTime, nullable=False)
    check_in_location_json = Column(JSONB, nullable=False)
    check_in_note = Column(Text, nullable=True)
    check_in_image_uri = Column(String, nullable=True)
    check_in_signature = Column(String, nullable=True)
    check_out_at = Column(DateTime, nullable=True)
    check_out_location_json = Column(JSONB, nullable=True)
    check_out_note = Column(Text, nullable=True)
    check_out_image_uri = Column(String, nullable=True)
    check_out_signature = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", backref="attendance_records")
    user = relationship("User")