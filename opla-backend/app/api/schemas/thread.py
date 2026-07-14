from datetime import datetime
from typing import Any, List, Optional
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
    kind: str = "general"
    team_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class ThreadMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    mentioned_user_ids: Optional[List[UUID]] = None


class ThreadMessageUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    mentioned_user_ids: Optional[List[UUID]] = None


class ThreadMessageAuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: Optional[str] = None


class ThreadMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    thread_id: UUID
    project_id: UUID
    author_id: Optional[UUID] = None
    author: Optional[ThreadMessageAuthorOut] = None
    body: str
    mentions_json: Optional[List[Any]] = None
    created_at: datetime
    edited_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None


class ThreadNotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    project_id: UUID
    thread_id: UUID
    message_id: UUID
    kind: str
    read_at: Optional[datetime] = None
    created_at: datetime
