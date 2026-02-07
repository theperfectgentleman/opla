from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict
from app.models.form import FormStatus

class FormBase(BaseModel):
    title: str
    is_public: bool = False

class FormCreateIn(FormBase):
    blueprint: Optional[Dict] = None

class FormCreate(FormBase):
    project_id: UUID
    blueprint: Optional[Dict] = None

class FormOut(FormBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    slug: str
    blueprint_draft: Optional[Dict] = None
    blueprint_live: Optional[Dict] = None
    version: int
    status: FormStatus
    created_at: datetime
    updated_at: datetime
