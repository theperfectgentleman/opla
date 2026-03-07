from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectThreadCreate(BaseModel):
    title: str
    summary: Optional[str] = None
    reply_count: int = Field(default=0, ge=0)


class ProjectThreadUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    reply_count: Optional[int] = Field(default=None, ge=0)


class ProjectThreadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    summary: Optional[str] = None
    reply_count: int
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime