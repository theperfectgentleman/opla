"""Per-organisation AI credit wallet.

These tables are AI credits only. Do not reuse them for SMS or other metering.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base


class OrgAiCreditBalance(Base):
    __tablename__ = "org_ai_credit_balances"
    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_org_ai_credit_balances_nonnegative"),
    )

    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    balance = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class OrgAiActionCost(Base):
    __tablename__ = "org_ai_action_costs"
    __table_args__ = (
        UniqueConstraint("organization_id", "action_key", name="uq_org_ai_action_costs_org_action"),
        CheckConstraint("credit_cost >= 0", name="ck_org_ai_action_costs_nonnegative"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action_key = Column(String, nullable=False)
    label = Column(String, nullable=False)
    credit_cost = Column(Integer, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AiCreditLedgerEntry(Base):
    __tablename__ = "ai_credit_ledger"
    __table_args__ = (
        CheckConstraint("balance_after >= 0", name="ck_ai_credit_ledger_balance_after_nonnegative"),
        CheckConstraint(
            "entry_type IN ('top_up', 'spend', 'refund')",
            name="ck_ai_credit_ledger_entry_type",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entry_type = Column(String, nullable=False)
    # Signed AI credit units: top-up and refund positive, spend negative.
    amount = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    action_key = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    actor_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    related_entry_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_credit_ledger.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
