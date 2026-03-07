from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.form_dataset import FormDatasetFieldStatus, FormDatasetStatus


class DatasetFieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dataset_id: UUID
    field_identifier: str
    field_key: str
    label: Optional[str] = None
    field_type: Optional[str] = None
    status: FormDatasetFieldStatus
    introduced_in_version_number: int
    retired_in_version_number: Optional[int] = None
    metadata_json: Optional[Dict] = None
    created_at: datetime
    updated_at: datetime


class DatasetSchemaVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dataset_id: UUID
    form_version_id: Optional[UUID] = None
    version_number: int
    schema_snapshot: List[Dict] | List
    blueprint_snapshot: Dict
    change_summary_json: Optional[Dict] = None
    published_at: Optional[datetime] = None
    created_at: datetime


class FormDatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    form_id: UUID
    name: str
    slug: str
    status: FormDatasetStatus
    lookup_enabled: bool
    public_lookup_enabled: bool
    current_schema_version_number: int
    last_form_version_number: Optional[int] = None
    metadata_json: Optional[Dict] = None
    created_at: datetime
    updated_at: datetime
    fields: List[DatasetFieldOut] = []
    schema_versions: List[DatasetSchemaVersionOut] = []


class LookupDatasetFieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    field_identifier: str
    field_key: str
    label: Optional[str] = None
    field_type: Optional[str] = None
    status: FormDatasetFieldStatus


class LookupDatasetSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    form_id: UUID
    name: str
    slug: str
    lookup_enabled: bool
    public_lookup_enabled: bool
    current_schema_version_number: int
    updated_at: datetime
    fields: List[LookupDatasetFieldOut] = []


class FormDatasetUpdateIn(BaseModel):
    lookup_enabled: Optional[bool] = None
    public_lookup_enabled: Optional[bool] = None


class LookupOptionOut(BaseModel):
    label: str
    value: str
    submission_id: UUID
    created_at: datetime


class LookupOptionsOut(BaseModel):
    dataset_id: UUID
    label_field: str
    value_field: str
    synced_at: datetime
    total_options: int
    options: List[LookupOptionOut]