from sqlalchemy import Column, String, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base
import enum

class AccessorType(str, enum.Enum):
    USER = "user"
    TEAM = "team"

class ProjectRole(str, enum.Enum):
    COLLECTOR = "collector"
    ANALYST = "analyst"
    EDITOR = "editor"

class ProjectAccess(Base):
    __tablename__ = "project_access"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    accessor_id = Column(UUID(as_uuid=True), nullable=False) # Polymorphic: user_id or team_id
    accessor_type = Column(Enum(AccessorType), nullable=False)
    role = Column(Enum(ProjectRole), nullable=False)
    
    project = relationship("Project", backref="access_rules")
    
    __table_args__ = (UniqueConstraint('project_id', 'accessor_id', 'accessor_type', name='_project_accessor_uc'),)
