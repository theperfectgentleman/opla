from pydantic import BaseModel, ConfigDict, model_validator
from uuid import UUID
from datetime import date, datetime
from typing import List, Optional
from app.models.project import ProjectStatus
from app.models.project_access import AccessorType, ProjectRole
from app.models.project_task import ProjectTaskKind, ProjectTaskStatus

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


class ProjectTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    kind: ProjectTaskKind = ProjectTaskKind.GENERAL
    starts_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    visit_date: Optional[date] = None
    source_submission_id: Optional[UUID] = None
    assigned_accessor_id: Optional[UUID] = None
    assigned_accessor_type: Optional[AccessorType] = None

    @model_validator(mode="after")
    def validate_task(self):
        if self.starts_at and self.due_at and self.due_at < self.starts_at:
            raise ValueError("Task due date must be after the start date")
        if self.kind == ProjectTaskKind.JOURNEY_VISIT and self.visit_date is None:
            raise ValueError("Journey visit tasks must include a visit date")
        if bool(self.assigned_accessor_id) != bool(self.assigned_accessor_type):
            raise ValueError("Assigned accessor id and type must be provided together")
        return self


class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    kind: Optional[ProjectTaskKind] = None
    status: Optional[ProjectTaskStatus] = None
    starts_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    visit_date: Optional[date] = None
    source_submission_id: Optional[UUID] = None
    assigned_accessor_id: Optional[UUID] = None
    assigned_accessor_type: Optional[AccessorType] = None
    clear_assignment: bool = False

    @model_validator(mode="after")
    def validate_task(self):
        if self.starts_at and self.due_at and self.due_at < self.starts_at:
            raise ValueError("Task due date must be after the start date")
        if self.kind == ProjectTaskKind.JOURNEY_VISIT and self.visit_date is None:
            raise ValueError("Journey visit tasks must include a visit date")
        if not self.clear_assignment and (self.assigned_accessor_id is not None or self.assigned_accessor_type is not None):
            if bool(self.assigned_accessor_id) != bool(self.assigned_accessor_type):
                raise ValueError("Assigned accessor id and type must be provided together")
        return self


class ProjectTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    description: Optional[str] = None
    kind: ProjectTaskKind
    status: ProjectTaskStatus
    starts_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    visit_date: Optional[date] = None
    source_submission_id: Optional[UUID] = None
    assigned_accessor_id: Optional[UUID] = None
    assigned_accessor_type: Optional[AccessorType] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class ProjectCatalogItemCreate(BaseModel):
    sku_code: str
    label: str
    default_price: Optional[float] = None
    unit: Optional[str] = None
    brand: Optional[str] = None
    is_active: bool = True
    price_editable: bool = True
    metadata_json: Optional[dict] = None


class ProjectCatalogItemUpdate(BaseModel):
    sku_code: Optional[str] = None
    label: Optional[str] = None
    default_price: Optional[float] = None
    unit: Optional[str] = None
    brand: Optional[str] = None
    is_active: Optional[bool] = None
    price_editable: Optional[bool] = None
    metadata_json: Optional[dict] = None


class ProjectCatalogItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    sku_code: str
    label: str
    default_price: Optional[float] = None
    unit: Optional[str] = None
    brand: Optional[str] = None
    is_active: bool
    price_editable: bool
    metadata_json: Optional[dict] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
