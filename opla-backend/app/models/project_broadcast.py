"""Outbound SMS broadcasts (project Messages → Broadcasts).

Kept separate from ``project_messages`` (in-app threads), per docs/Messaging-Broadcasts-MVP.md.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class BroadcastStatus:
    QUEUED = "queued"
    SENDING = "sending"
    COMPLETED = "completed"  # every recipient accepted by the provider
    PARTIAL = "partial"  # some sent, some failed
    FAILED = "failed"  # nothing sent


class DeliveryStatus:
    QUEUED = "queued"
    SENT = "sent"  # accepted by the provider (not a handset delivery receipt)
    FAILED = "failed"


class ProjectBroadcast(Base):
    __tablename__ = "project_broadcasts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    channel = Column(String, nullable=False, default="sms")
    provider = Column(String, nullable=False)
    sender_id = Column(String, nullable=True)
    body = Column(Text, nullable=False)
    name_fallback = Column(String, nullable=True)
    status = Column(String, nullable=False, default=BroadcastStatus.QUEUED, index=True)
    audience_json = Column(JSONB, nullable=True)  # team ids/names and source counts at send time
    recipient_count = Column(Integer, nullable=False, default=0)
    sent_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    estimated_credits = Column(Integer, nullable=False, default=0)
    credits_used = Column(Float, nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    creator = relationship("User", foreign_keys=[created_by])
    deliveries = relationship(
        "ProjectBroadcastDelivery",
        back_populates="broadcast",
        cascade="all, delete-orphan",
        order_by="ProjectBroadcastDelivery.created_at",
    )


class ProjectBroadcastDelivery(Base):
    __tablename__ = "project_broadcast_deliveries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    broadcast_id = Column(
        UUID(as_uuid=True), ForeignKey("project_broadcasts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    phone = Column(String, nullable=False)  # E.164
    name = Column(String, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sources = Column(JSONB, nullable=True)  # ["team", "csv", "manual"]
    team_names = Column(JSONB, nullable=True)
    parts = Column(Integer, nullable=False, default=1)
    status = Column(String, nullable=False, default=DeliveryStatus.QUEUED, index=True)
    error = Column(Text, nullable=True)
    provider_ref = Column(String, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    broadcast = relationship("ProjectBroadcast", back_populates="deliveries")

    __table_args__ = (UniqueConstraint("broadcast_id", "phone", name="uq_project_broadcast_delivery_phone"),)


class OrgMessageOptOut(Base):
    """Numbers that asked not to be texted. Applies to every project in the organisation."""

    __tablename__ = "org_message_opt_outs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    phone = Column(String, nullable=False)  # E.164
    channel = Column(String, nullable=False, default="sms")
    reason = Column(String, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("org_id", "channel", "phone", name="uq_org_message_opt_out"),)
