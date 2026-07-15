from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class ProjectMessage(Base):
    __tablename__ = "project_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_id = Column(
        UUID(as_uuid=True),
        ForeignKey("project_message_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    body = Column(Text, nullable=False)
    mentions_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    edited_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    channel = relationship("ProjectMessageChannel", back_populates="messages")
    author = relationship("User", foreign_keys=[author_id])


class ProjectMessageNotification(Base):
    __tablename__ = "project_message_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(
        UUID(as_uuid=True),
        ForeignKey("project_message_channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("project_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String, nullable=False, default="mention")
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
