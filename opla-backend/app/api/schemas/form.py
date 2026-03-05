from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, List
from app.models.form import FormStatus
from app.models.form_version import FormVersionKind

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
    published_version: Optional[int] = None
    published_at: Optional[datetime] = None
    status: FormStatus
    created_at: datetime
    updated_at: datetime


class FormVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    form_id: UUID
    version_number: int
    kind: FormVersionKind
    slot_index: Optional[int] = None
    is_active: bool
    created_at: datetime
    published_at: Optional[datetime] = None
    changelog: Optional[str] = None
    blueprint: Optional[Dict] = None


class FormRuntimeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    slug: str
    blueprint_live: Dict
    published_version: Optional[int] = None
    published_at: Optional[datetime] = None


class PublishFormIn(BaseModel):
    draft_version_id: Optional[UUID] = None
    draft_slot: Optional[int] = None
    changelog: Optional[str] = None


class FormVersionsListOut(BaseModel):
    live: Optional[FormVersionOut] = None
    drafts: List[FormVersionOut] = Field(default_factory=list)
