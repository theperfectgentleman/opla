from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
import enum


class ProjectAssetKind(str, enum.Enum):
    DOCUMENT = "document"
    IMAGE = "image"
    AUDIO = "audio"
    LINK = "link"


class ProjectAsset(Base):
    __tablename__ = "project_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    kind = Column(
        Enum(ProjectAssetKind, name="project_asset_kind", values_callable=lambda obj: [e.value for e in obj]),
        default=ProjectAssetKind.DOCUMENT,
        nullable=False,
    )
    summary = Column(Text, nullable=True)
    source_url = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="assets")
    creator = relationship("User")