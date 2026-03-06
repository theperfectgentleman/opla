from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from app.models.project import ProjectStatus
from app.models.project_access import AccessorType, ProjectRole

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None

class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    org_id: UUID
    status: ProjectStatus
    activated_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ProjectAccessCreate(BaseModel):
    accessor_id: UUID
    accessor_type: AccessorType
    role: Optional[ProjectRole] = None
    role_template_id: Optional[UUID] = None


class ProjectAccessOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    accessor_id: UUID
    accessor_type: AccessorType
    role: Optional[ProjectRole] = None
    role_template_id: Optional[UUID] = None
    role_name: Optional[str] = None
    role_slug: Optional[str] = None
    permissions: List[str] = []


class ProjectRoleTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    priority: int = 50


class ProjectRoleTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    priority: Optional[int] = None


class ProjectRoleTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    permissions: List[str] = []
    priority: int
    is_system: bool
    assignment_count: int = 0
    created_at: datetime
    updated_at: datetime
