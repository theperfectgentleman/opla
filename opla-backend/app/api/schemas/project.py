from pydantic import BaseModel, ConfigDict, Field, model_validator
from uuid import UUID
from datetime import date, datetime, time
from typing import List, Optional
from app.models.project import ProjectStatus
from app.models.project_access import AccessorType, ProjectRole
from app.models.project_attendance import ProjectAttendanceStatus
from app.models.project_task import ProjectTaskKind, ProjectTaskStatus

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


def _validate_collection_settings(
    *,
    collection_start_date: Optional[date],
    collection_end_date: Optional[date],
    collection_time_start: Optional[time],
    collection_time_end: Optional[time],
    expected_total_count: Optional[int],
    expected_weekly_count: Optional[int],
    require_dates: bool,
    require_expectation: bool,
) -> None:
    if require_dates:
        if collection_start_date is None or collection_end_date is None:
            raise ValueError("collection_start_date and collection_end_date are required")
    if collection_start_date and collection_end_date and collection_end_date < collection_start_date:
        raise ValueError("collection_end_date must be on or after collection_start_date")

    start_t = collection_time_start or time(9, 0)
    end_t = collection_time_end or time(17, 0)
    if end_t <= start_t:
        raise ValueError("collection_time_end must be after collection_time_start")

    total = expected_total_count
    weekly = expected_weekly_count
    if total is not None and total < 1:
        raise ValueError("expected_total_count must be at least 1 when set")
    if weekly is not None and weekly < 1:
        raise ValueError("expected_weekly_count must be at least 1 when set")
    if require_expectation and not ((total is not None and total >= 1) or (weekly is not None and weekly >= 1)):
        raise ValueError("Set at least one of expected_total_count or expected_weekly_count (minimum 1)")


class ProjectCreate(ProjectBase):
    collection_start_date: date
    collection_end_date: date
    collection_time_start: time = Field(default_factory=lambda: time(9, 0))
    collection_time_end: time = Field(default_factory=lambda: time(17, 0))
    expected_total_count: Optional[int] = None
    expected_weekly_count: Optional[int] = None

    @model_validator(mode="after")
    def validate_collection(self):
        _validate_collection_settings(
            collection_start_date=self.collection_start_date,
            collection_end_date=self.collection_end_date,
            collection_time_start=self.collection_time_start,
            collection_time_end=self.collection_time_end,
            expected_total_count=self.expected_total_count,
            expected_weekly_count=self.expected_weekly_count,
            require_dates=True,
            require_expectation=True,
        )
        return self


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    collection_start_date: Optional[date] = None
    collection_end_date: Optional[date] = None
    collection_time_start: Optional[time] = None
    collection_time_end: Optional[time] = None
    expected_total_count: Optional[int] = None
    expected_weekly_count: Optional[int] = None

class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    org_id: UUID
    status: ProjectStatus
    collection_start_date: Optional[date] = None
    collection_end_date: Optional[date] = None
    collection_time_start: time
    collection_time_end: time
    expected_total_count: Optional[int] = None
    expected_weekly_count: Optional[int] = None
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
    context_json: Optional[dict] = None
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
    context_json: Optional[dict] = None
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
    context_json: Optional[dict] = None
    automation_rule_id: Optional[UUID] = None
    assigned_accessor_id: Optional[UUID] = None
    assigned_accessor_type: Optional[AccessorType] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class ProjectAttendanceLocation(BaseModel):
    latitude: float
    longitude: float
    accuracy_meters: Optional[float] = None
    label: Optional[str] = None


class ProjectAttendanceCheckIn(BaseModel):
    timestamp: Optional[datetime] = None
    location: ProjectAttendanceLocation
    note: Optional[str] = None
    image_uri: Optional[str] = None
    signature: Optional[str] = None


class ProjectAttendanceCheckOut(BaseModel):
    timestamp: Optional[datetime] = None
    location: ProjectAttendanceLocation
    note: Optional[str] = None
    image_uri: Optional[str] = None
    signature: Optional[str] = None


class ProjectAttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    user_id: UUID
    attendance_date: date
    status: ProjectAttendanceStatus
    check_in_at: datetime
    check_in_location_json: dict
    check_in_note: Optional[str] = None
    check_in_image_uri: Optional[str] = None
    check_in_signature: Optional[str] = None
    check_out_at: Optional[datetime] = None
    check_out_location_json: Optional[dict] = None
    check_out_note: Optional[str] = None
    check_out_image_uri: Optional[str] = None
    check_out_signature: Optional[str] = None
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
