from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.form_automation_rule import FormAutomationAction, FormAutomationEvent


class FormAutomationRuleBase(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: FormAutomationEvent
    action_type: FormAutomationAction
    is_active: bool = True
    conditions_json: Optional[Dict[str, Any]] = None
    action_config_json: Dict[str, Any]


class FormAutomationRuleCreate(FormAutomationRuleBase):
    pass


class FormAutomationRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[FormAutomationEvent] = None
    action_type: Optional[FormAutomationAction] = None
    is_active: Optional[bool] = None
    conditions_json: Optional[Dict[str, Any]] = None
    action_config_json: Optional[Dict[str, Any]] = None


class FormAutomationRuleOut(FormAutomationRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    form_id: UUID
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime