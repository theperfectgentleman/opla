from datetime import datetime
import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.org_member import MemberType


class InvitationType(str, enum.Enum):
    ORGANIZATION = "organization"
    TEAM = "team"


class InvitationDeliveryMode(str, enum.Enum):
    EMAIL = "email"
    SHORT_LINK = "short_link"
    GENERATED_LINK = "generated_link"
    PIN_CODE = "pin_code"


class InvitationApprovalMode(str, enum.Enum):
    AUTO = "auto"
    REVIEW = "review"


class InvitationLifecycleStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    DECLINED = "declined"


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    invitation_type = Column(
        Enum(InvitationType, name="invitation_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    member_type = Column(
        Enum(MemberType, name="invitation_member_type", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    delivery_mode = Column(
        Enum(InvitationDeliveryMode, name="invitation_delivery_mode", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    approval_mode = Column(
        Enum(InvitationApprovalMode, name="invitation_approval_mode", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    status = Column(
        Enum(InvitationLifecycleStatus, name="invitation_lifecycle_status", values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=InvitationLifecycleStatus.PENDING,
    )
    invited_email = Column(String, nullable=True)
    token = Column(String, nullable=True, unique=True, index=True)
    pin_code = Column(String, nullable=True, unique=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    claimed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    accepted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization")
    team = relationship("Team")
    creator = relationship("User", foreign_keys=[created_by])
    claimant = relationship("User", foreign_keys=[claimed_by])
    approver = relationship("User", foreign_keys=[approved_by])
    accepter = relationship("User", foreign_keys=[accepted_by])