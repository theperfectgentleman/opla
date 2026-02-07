from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
import enum

class OrgRole(Base):
    __tablename__ = "org_roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False)
    description = Column(String, nullable=True)
    permissions = Column(JSONB, nullable=False, server_default='[]')  # Array of permission strings
    priority = Column(Integer, nullable=False, server_default='50')  # Higher priority = more permissions
    is_system = Column(Boolean, default=False, nullable=False)  # System roles are read-only
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    organization = relationship("Organization", back_populates="org_roles")
    
    __table_args__ = (UniqueConstraint('org_id', 'slug', name='_org_role_slug_uc'),)


class AccessorType(str, enum.Enum):
    USER = "user"
    TEAM = "team"


class OrgRoleAssignment(Base):
    __tablename__ = "org_role_assignments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("org_roles.id"), nullable=False)
    accessor_id = Column(UUID(as_uuid=True), nullable=False)  # user_id or team_id
    accessor_type = Column(String, nullable=False)  # 'user' or 'team'
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    organization = relationship("Organization")
    role = relationship("OrgRole", backref="assignments")
    assigner = relationship("User", foreign_keys=[assigned_by])
    
    __table_args__ = (UniqueConstraint('org_id', 'accessor_id', 'accessor_type', name='_org_accessor_uc'),)
