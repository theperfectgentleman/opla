from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Any, Optional, Dict, List
from app.models.form import FormKind, FormStatus
from app.models.form_version import FormVersionKind
from app.models.project_access import AccessorType


class ArtifactResponsibilityFields(BaseModel):
    lead_accessor_id: Optional[UUID] = None
    lead_accessor_type: Optional[AccessorType] = None
    assigned_accessor_id: Optional[UUID] = None
    assigned_accessor_type: Optional[AccessorType] = None
    guest_accessor_id: Optional[UUID] = None
    guest_accessor_type: Optional[AccessorType] = None

    @staticmethod
    def _validate_pair(accessor_id: Optional[UUID], accessor_type: Optional[AccessorType], label: str) -> None:
        if bool(accessor_id) != bool(accessor_type):
            raise ValueError(f"{label} accessor id and type must be provided together")

    @classmethod
    def _validate_pairs(cls, payload: "ArtifactResponsibilityFields") -> "ArtifactResponsibilityFields":
        cls._validate_pair(payload.lead_accessor_id, payload.lead_accessor_type, "Lead")
        cls._validate_pair(payload.assigned_accessor_id, payload.assigned_accessor_type, "Assigned")
        cls._validate_pair(payload.guest_accessor_id, payload.guest_accessor_type, "Guest")
        return payload

class FormBase(BaseModel):
    title: str
    is_public: bool = False

class FormCreateIn(FormBase):
    blueprint: Optional[Dict] = None
    kind: FormKind = FormKind.STANDARD

class FormCreate(FormBase):
    project_id: UUID
    blueprint: Optional[Dict] = None

class FormOut(FormBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    slug: str
    kind: FormKind
    dataset_id: Optional[UUID] = None
    current_dataset_schema_version_number: Optional[int] = None
    blueprint_draft: Optional[Dict] = None
    blueprint_live: Optional[Dict] = None
    version: int
    published_version: Optional[int] = None
    published_at: Optional[datetime] = None
    status: FormStatus
    lead_accessor_id: Optional[UUID] = None
    lead_accessor_type: Optional[AccessorType] = None
    assigned_accessor_id: Optional[UUID] = None
    assigned_accessor_type: Optional[AccessorType] = None
    guest_accessor_id: Optional[UUID] = None
    guest_accessor_type: Optional[AccessorType] = None
    # Catalog-specific designations
    catalog_key_field_id: Optional[str] = None
    catalog_label_field_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class FormResponsibilityUpdateIn(ArtifactResponsibilityFields):
    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        payload = super().model_validate(obj, *args, **kwargs)
        return cls._validate_pairs(payload)


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


class FormStatsOut(BaseModel):
    form_id: UUID
    title: str
    status: FormStatus
    version: int
    submission_count: int
    my_submission_count: int
    last_submitted_at: Optional[datetime] = None


class PublishFormIn(BaseModel):
    draft_version_id: Optional[UUID] = None
    draft_slot: Optional[int] = None
    changelog: Optional[str] = None


class FormVersionsListOut(BaseModel):
    live: Optional[FormVersionOut] = None
    drafts: List[FormVersionOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Catalog-specific schemas
# ---------------------------------------------------------------------------

class CatalogDesignationIn(BaseModel):
    """PATCH body for setting key/label field designations on a catalog form."""
    catalog_key_field_id: Optional[str] = None
    catalog_label_field_id: Optional[str] = None


class CatalogEntryUpsertIn(BaseModel):
    """Body for creating or updating a catalog entry."""
    data: Dict[str, Any]


class CatalogEntryOut(BaseModel):
    """Resolved catalog entry (latest submission per key value)."""
    submission_id: str
    key_value: Optional[str] = None
    label_value: Optional[str] = None
    data: Dict[str, Any]
    catalog_is_active: bool
    created_at: Optional[str] = None


class CatalogEntryDeleteOut(BaseModel):
    deleted_count: int
    key_value: Optional[str] = None


class CatalogLookupSourceOut(BaseModel):
    """Published catalog form available as a lookup source within the same project."""
    id: str
    title: str
    catalog_key_field_id: str
    catalog_label_field_id: str
    fields: List[Dict[str, str]] = []


class CatalogLookupOptionOut(BaseModel):
    label: str
    value: str
    submission_id: str
    created_at: Optional[str] = None
    data: Dict[str, Any] = {}


class CatalogLookupOptionsOut(BaseModel):
    catalog_form_id: str
    catalog_form_title: str
    label_field: str
    value_field: str
    synced_at: datetime
    total_options: int
    options: List[CatalogLookupOptionOut]
