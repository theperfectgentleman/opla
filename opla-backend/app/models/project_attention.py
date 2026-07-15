from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class AttentionSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AttentionItemStatus(str, enum.Enum):
    OPEN = "open"
    DISMISSED = "dismissed"
    RESOLVED = "resolved"


class AttentionHookKind(str, enum.Enum):
    PENDING_REVIEW_AGING = "pending_review_aging"
    TASK_BLOCKED = "task_blocked"
    TASK_OVERDUE = "task_overdue"
    ATTENDANCE_GAP = "attendance_gap"
    AUTOMATION_ALERT = "automation_alert"


class ProjectAttentionHook(Base):
    __tablename__ = "project_attention_hooks"
    __table_args__ = (UniqueConstraint("project_id", "kind", name="uq_project_attention_hook_kind"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String, nullable=False)
    severity_default = Column(String, nullable=False, default=AttentionSeverity.WARNING.value)
    enabled = Column(Boolean, nullable=False, default=True)
    is_system = Column(Boolean, nullable=False, default=True)
    config_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", backref="attention_hooks")


class ProjectAttentionItem(Base):
    __tablename__ = "project_attention_items"
    __table_args__ = (UniqueConstraint("project_id", "dedupe_key", name="uq_project_attention_dedupe"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    hook_id = Column(
        UUID(as_uuid=True),
        ForeignKey("project_attention_hooks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    severity = Column(String, nullable=False)
    kind = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    deep_link = Column(String, nullable=True)
    status = Column(String, nullable=False, default=AttentionItemStatus.OPEN.value, index=True)
    dedupe_key = Column(String, nullable=False)
    source_submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="SET NULL"), nullable=True)
    source_task_id = Column(UUID(as_uuid=True), ForeignKey("project_tasks.id", ondelete="SET NULL"), nullable=True)
    source_attendance_id = Column(
        UUID(as_uuid=True),
        ForeignKey("project_attendance_records.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_channel_id = Column(UUID(as_uuid=True), ForeignKey("project_message_channels.id", ondelete="SET NULL"), nullable=True)
    source_automation_rule_id = Column(
        UUID(as_uuid=True),
        ForeignKey("form_automation_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    dismissed_at = Column(DateTime, nullable=True)
    dismissed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", backref="attention_items")
    hook = relationship("ProjectAttentionHook", backref="items")
