from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime

from app.models.base import Base


class ProjectCatalogItem(Base):
    __tablename__ = "project_catalog_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    sku_code = Column(String, nullable=False)
    label = Column(String, nullable=False)
    default_price = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    price_editable = Column(Boolean, nullable=False, default=True)
    metadata_json = Column(JSONB, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", backref="catalog_items")
    creator = relationship("User")

    __table_args__ = (
        Index("ix_project_catalog_items_project_sku", "project_id", "sku_code", unique=True),
    )