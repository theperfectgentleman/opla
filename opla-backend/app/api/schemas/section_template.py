from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime
from app.models.section_template import Visibility

class SectionTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    blueprint: Dict[str, Any]
    visibility: Visibility = Visibility.ORGANIZATION
    team_ids: Optional[List[UUID]] = None

class SectionTemplateCreate(SectionTemplateBase):
    pass

class SectionTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    blueprint: Optional[Dict[str, Any]] = None
    visibility: Optional[Visibility] = None
    team_ids: Optional[List[UUID]] = None

class SectionTemplateResponse(SectionTemplateBase):
    id: UUID
    org_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
