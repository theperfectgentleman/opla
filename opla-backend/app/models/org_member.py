from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.models.base import Base
import enum

class GlobalRole(str, enum.Enum):
    ADMIN = "admin"
    MEMBER = "member"

class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"

class OrgMember(Base):
    __tablename__ = "org_members"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    global_role = Column(Enum(GlobalRole), default=GlobalRole.MEMBER, nullable=False)
    invited_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    invitation_status = Column(Enum(InvitationStatus), default=InvitationStatus.PENDING, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    user = relationship("User", foreign_keys=[user_id], backref="org_memberships")
    organization = relationship("Organization", back_populates="members")
    inviter = relationship("User", foreign_keys=[invited_by], backref="sent_invitations")
    
    __table_args__ = (UniqueConstraint('user_id', 'org_id', name='_user_org_uc'),)
