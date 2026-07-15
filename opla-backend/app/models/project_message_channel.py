from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base


class ProjectMessageChannel(Base):
    __tablename__ = "project_message_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    reply_count = Column(Integer, nullable=False, default=0, server_default="0")
    kind = Column(String, nullable=False, default="general", index=True)  # general | team
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True)
    archived_at = Column(DateTime, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="message_channels")
    creator = relationship("User", foreign_keys=[created_by])
    team = relationship("Team")
    messages = relationship("ProjectMessage", back_populates="channel", cascade="all, delete-orphan")
