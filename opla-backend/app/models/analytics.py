import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import backref, relationship

from app.models.base import Base


class SavedQuestion(Base):
    __tablename__ = "saved_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_config = Column(JSONB, nullable=False)
    query_config = Column(JSONB, nullable=False)
    viz_type = Column(String(50), nullable=False, default="table")
    viz_config = Column(JSONB, nullable=True)
    cache_ttl_seconds = Column(Integer, nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", backref=backref("saved_questions", lazy="dynamic"))
    project = relationship("Project", backref=backref("saved_questions", lazy="dynamic"))
    creator = relationship("User", backref=backref("saved_analytics_questions", lazy="dynamic"))
    cards = relationship("DashboardCard", back_populates="question", cascade="all, delete-orphan")


class AnalyticsDashboard(Base):
    __tablename__ = "analytics_dashboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    layout_config = Column(JSONB, nullable=False, default=list)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", backref=backref("analytics_dashboards", lazy="dynamic"))
    project = relationship("Project", backref=backref("analytics_dashboards", lazy="dynamic"))
    creator = relationship("User", backref=backref("analytics_dashboards_created", lazy="dynamic"))
    cards = relationship("DashboardCard", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardCard(Base):
    __tablename__ = "dashboard_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("analytics_dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("saved_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(JSONB, nullable=False)
    viz_override = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dashboard = relationship("AnalyticsDashboard", back_populates="cards")
    question = relationship("SavedQuestion", back_populates="cards")
