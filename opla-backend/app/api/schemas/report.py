from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.api.schemas.form import ArtifactResponsibilityFields
from app.models.project_report import ProjectReportStatus


class ProjectReportCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content: list[dict[str, Any]] = Field(default_factory=list)


class ProjectReportUpdate(ArtifactResponsibilityFields):
    title: Optional[str] = None
    description: Optional[str] = None
    content: Optional[list[dict[str, Any]]] = None
    status: Optional[ProjectReportStatus] = None

    @model_validator(mode="after")
    def validate_payload(self):
        return self._validate_pairs(self)


class ProjectReportOut(ArtifactResponsibilityFields):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    content: list[dict[str, Any]] = Field(default_factory=list)
    status: ProjectReportStatus
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime