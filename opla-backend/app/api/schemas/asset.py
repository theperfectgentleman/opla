from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.project_asset import ProjectAssetKind


class ProjectAssetCreate(BaseModel):
    title: str
    kind: ProjectAssetKind = ProjectAssetKind.DOCUMENT
    summary: Optional[str] = None
    source_url: Optional[str] = None


class ProjectAssetUpdate(BaseModel):
    title: Optional[str] = None
    kind: Optional[ProjectAssetKind] = None
    summary: Optional[str] = None
    source_url: Optional[str] = None


class ProjectAssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    kind: ProjectAssetKind
    summary: Optional[str] = None
    source_url: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime