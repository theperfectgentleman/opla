from datetime import datetime
import enum
import uuid

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class FormAutomationEvent(str, enum.Enum):
    SUBMISSION_CREATED = "submission_created"
    SUBMISSION_REVIEWED = "submission_reviewed"
    SUBMISSION_APPROVED = "submission_approved"


class FormAutomationAction(str, enum.Enum):
    CREATE_TASK = "create_task"
    CREATE_ALERT = "create_alert"


class FormAutomationRule(Base):
    __tablename__ = "form_automation_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    event_type = Column(
        Enum(FormAutomationEvent, name="form_automation_event", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    action_type = Column(
        Enum(FormAutomationAction, name="form_automation_action", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    is_active = Column(Boolean, nullable=False, default=True)
    conditions_json = Column(JSONB, nullable=True)
    action_config_json = Column(JSONB, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    form = relationship("Form", backref="automation_rules")
    creator = relationship("User")