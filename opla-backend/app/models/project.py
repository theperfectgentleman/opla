from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum, Date, Time, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, time
from app.models.base import Base
import enum


class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        Enum(ProjectStatus, name="project_status", values_callable=lambda obj: [e.value for e in obj]),
        default=ProjectStatus.PLANNING,
        nullable=False,
    )
    collection_start_date = Column(Date, nullable=True)
    collection_end_date = Column(Date, nullable=True)
    collection_time_start = Column(Time, nullable=False, default=time(9, 0))
    collection_time_end = Column(Time, nullable=False, default=time(17, 0))
    expected_total_count = Column(Integer, nullable=True)
    expected_weekly_count = Column(Integer, nullable=True)
    activated_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    archived_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    organization = relationship("Organization", backref="projects")
    forms = relationship("Form", back_populates="project", cascade="all, delete-orphan")
    reports = relationship("ProjectReport", back_populates="project", cascade="all, delete-orphan")
    assets = relationship("ProjectAsset", back_populates="project", cascade="all, delete-orphan")
    message_channels = relationship("ProjectMessageChannel", back_populates="project", cascade="all, delete-orphan")
