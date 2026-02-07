from sqlalchemy import Column, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
from app.models.project_access import AccessorType

class OrgRoleAssignment(Base):
    __tablename__ = "org_role_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("org_roles.id"), nullable=False)
    accessor_id = Column(UUID(as_uuid=True), nullable=False)
    accessor_type = Column(Enum(AccessorType), nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    role = relationship("OrgRole", back_populates="assignments")
    organization = relationship("Organization", backref="role_assignments")

    __table_args__ = (
        UniqueConstraint('org_id', 'accessor_id', 'accessor_type', name='_org_accessor_uc'),
    )
