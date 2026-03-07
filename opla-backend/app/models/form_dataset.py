from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import backref, relationship
import enum
import uuid
from datetime import datetime

from app.models.base import Base


class FormDatasetStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class FormDatasetFieldStatus(str, enum.Enum):
    ACTIVE = "active"
    LEGACY = "legacy"


class FormDataset(Base):
    __tablename__ = "form_datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id = Column(UUID(as_uuid=True), ForeignKey("forms.id"), nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, index=True)
    status = Column(
        Enum(
            FormDatasetStatus,
            name="form_dataset_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=FormDatasetStatus.ACTIVE,
    )
    lookup_enabled = Column(Boolean, nullable=False, default=False)
    public_lookup_enabled = Column(Boolean, nullable=False, default=False)
    current_schema_version_number = Column(Integer, nullable=False, default=0)
    last_form_version_number = Column(Integer, nullable=True)
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    form = relationship("Form", backref=backref("dataset", uselist=False))


class FormDatasetSchemaVersion(Base):
    __tablename__ = "form_dataset_schema_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("form_datasets.id"), nullable=False, index=True)
    form_version_id = Column(UUID(as_uuid=True), ForeignKey("form_versions.id"), nullable=True)
    version_number = Column(Integer, nullable=False)
    schema_snapshot = Column(JSONB, nullable=False)
    blueprint_snapshot = Column(JSONB, nullable=False)
    change_summary_json = Column(JSONB, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dataset = relationship(
        "FormDataset",
        backref=backref("schema_versions", order_by="FormDatasetSchemaVersion.version_number"),
    )
    form_version = relationship("FormVersion", backref="dataset_schema_versions")

    __table_args__ = (
        Index("ix_form_dataset_schema_versions_unique", "dataset_id", "version_number", unique=True),
    )


class FormDatasetField(Base):
    __tablename__ = "form_dataset_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("form_datasets.id"), nullable=False, index=True)
    field_identifier = Column(String, nullable=False)
    field_key = Column(String, nullable=False)
    label = Column(String, nullable=True)
    field_type = Column(String, nullable=True)
    status = Column(
        Enum(
            FormDatasetFieldStatus,
            name="form_dataset_field_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=FormDatasetFieldStatus.ACTIVE,
    )
    introduced_in_version_number = Column(Integer, nullable=False)
    retired_in_version_number = Column(Integer, nullable=True)
    metadata_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    dataset = relationship("FormDataset", backref=backref("fields", lazy="selectin"))

    __table_args__ = (
        Index("ix_form_dataset_fields_unique", "dataset_id", "field_identifier", unique=True),
    )