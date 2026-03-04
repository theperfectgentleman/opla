from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
import enum
from app.models.base import Base

class Visibility(str, enum.Enum):
    ORGANIZATION = "organization"
    TEAM = "team"

class SectionTemplate(Base):
    __tablename__ = "section_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    blueprint = Column(JSONB, nullable=False)
    visibility = Column(Enum(Visibility, name="template_visibility", values_callable=lambda obj: [e.value for e in obj]), default=Visibility.ORGANIZATION, nullable=False)
    team_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    organization = relationship("Organization")
