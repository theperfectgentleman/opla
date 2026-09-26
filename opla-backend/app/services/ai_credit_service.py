"""AI credit wallet: balance, manual top-up, configurable costs, spend or reject."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.ai_credits import AiCreditLedgerEntry, OrgAiActionCost, OrgAiCreditBalance
from app.models.organization import Organization
from app.models.user import User
from app.services.ai_credit_catalog import (
    AI_ACTION_CATALOG,
    AI_ACTION_KEYS,
    AI_CREDITS_TOP_UP_MESSAGE,
)


class InsufficientAiCredits(Exception):
    """Raised when an AI action costs more credits than the organisation has."""

    code = "ai_credits_exhausted"

    def __init__(self, *, balance: int, required: int, action_key: str):
        self.balance = balance
        self.required = required
        self.action_key = action_key
        self.message = AI_CREDITS_TOP_UP_MESSAGE
        super().__init__(self.message)

    def as_detail(self) -> dict:
        return {
            "code": self.code,
            "message": self.message,
            "balance": self.balance,
            "required": self.required,
            "action_key": self.action_key,
        }


class UnknownAiAction(Exception):
    def __init__(self, action_key: str):
        self.action_key = action_key
        super().__init__(f"Unknown AI action: {action_key}")


class AiCreditOrgNotFound(Exception):
    def __init__(self, organization_id: uuid.UUID):
        self.organization_id = organization_id
        super().__init__("Organization not found")


def ensure_wallet(db: Session, organization_id: uuid.UUID) -> OrgAiCreditBalance:
    """Create the balance row and any missing action-cost rows. Does not commit."""
    balance = (
        db.query(OrgAiCreditBalance)
        .filter(OrgAiCreditBalance.organization_id == organization_id)
        .first()
    )
    if balance is None:
        balance = OrgAiCreditBalance(organization_id=organization_id, balance=0)
        try:
            with db.begin_nested():
                db.add(balance)
                db.flush()
        except IntegrityError:
            balance = (
                db.query(OrgAiCreditBalance)
                .filter(OrgAiCreditBalance.organization_id == organization_id)
                .one()
            )

    existing = {
        row.action_key
        for row in db.query(OrgAiActionCost)
        .filter(OrgAiActionCost.organization_id == organization_id)
        .all()
    }
    now = datetime.utcnow()
    for spec in AI_ACTION_CATALOG:
        if spec["action_key"] in existing:
            continue
        db.add(
            OrgAiActionCost(
                organization_id=organization_id,
                action_key=spec["action_key"],
                label=spec["label"],
                credit_cost=spec["credit_cost"],
                updated_at=now,
            )
        )
    db.flush()
    return balance


def get_balance(db: Session, organization_id: uuid.UUID) -> int:
    row = (
        db.query(OrgAiCreditBalance)
        .filter(OrgAiCreditBalance.organization_id == organization_id)
        .first()
    )
    if row is None:
        return 0
    return int(row.balance)


def list_action_costs(db: Session, organization_id: uuid.UUID) -> list[OrgAiActionCost]:
    ensure_wallet(db, organization_id)
    return (
        db.query(OrgAiActionCost)
        .filter(OrgAiActionCost.organization_id == organization_id)
        .order_by(OrgAiActionCost.action_key.asc())
        .all()
    )


def wallet_view(db: Session, organization_id: uuid.UUID) -> dict:
    if db.query(Organization.id).filter(Organization.id == organization_id).first() is None:
        raise AiCreditOrgNotFound(organization_id)
    ensure_wallet(db, organization_id)
    db.commit()
    balance = get_balance(db, organization_id)
    costs = list_action_costs(db, organization_id)
    db.commit()
    return {
        "organization_id": organization_id,
        "balance": balance,
        "action_costs": costs,
        "can_spend": {row.action_key: balance >= int(row.credit_cost) for row in costs},
    }


def list_ledger(
    db: Session,
    organization_id: uuid.UUID,
    *,
    limit: int = 50,
) -> list[tuple[AiCreditLedgerEntry, Optional[str]]]:
    limit = max(1, min(int(limit), 200))
    rows = (
        db.query(AiCreditLedgerEntry, User.full_name)
        .outerjoin(User, User.id == AiCreditLedgerEntry.actor_user_id)
        .filter(AiCreditLedgerEntry.organization_id == organization_id)
        .order_by(AiCreditLedgerEntry.created_at.desc(), AiCreditLedgerEntry.id.desc())
        .limit(limit)
        .all()
    )
    return [(entry, name) for entry, name in rows]


def top_up(
    db: Session,
    organization_id: uuid.UUID,
    amount: int,
    *,
    actor_user_id: Optional[uuid.UUID],
    note: Optional[str] = None,
) -> tuple[OrgAiCreditBalance, AiCreditLedgerEntry]:
    if amount <= 0:
        raise ValueError("Top-up amount must be a positive number of AI credits")
    if db.query(Organization.id).filter(Organization.id == organization_id).first() is None:
        raise AiCreditOrgNotFound(organization_id)

    ensure_wallet(db, organization_id)
    balance_row = (
        db.query(OrgAiCreditBalance)
        .filter(OrgAiCreditBalance.organization_id == organization_id)
        .with_for_update()
        .one()
    )
    balance_row.balance = int(balance_row.balance) + int(amount)
    balance_row.updated_at = datetime.utcnow()
    entry = AiCreditLedgerEntry(
        organization_id=organization_id,
        entry_type="top_up",
        amount=int(amount),
        balance_after=int(balance_row.balance),
        action_key=None,
        note=(note or "").strip() or None,
        actor_user_id=actor_user_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(balance_row)
    db.refresh(entry)
    return balance_row, entry


def update_action_cost(
    db: Session,
    organization_id: uuid.UUID,
    action_key: str,
    credit_cost: int,
) -> OrgAiActionCost:
    if action_key not in AI_ACTION_KEYS:
        raise UnknownAiAction(action_key)
    if credit_cost < 0:
        raise ValueError("AI action cost cannot be negative")
    if db.query(Organization.id).filter(Organization.id == organization_id).first() is None:
        raise AiCreditOrgNotFound(organization_id)

    ensure_wallet(db, organization_id)
    row = (
        db.query(OrgAiActionCost)
        .filter(
            OrgAiActionCost.organization_id == organization_id,
            OrgAiActionCost.action_key == action_key,
        )
        .one()
    )
    row.credit_cost = int(credit_cost)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def spend_or_reject(
    db: Session,
    organization_id: uuid.UUID,
    action_key: str,
    actor_user_id: Optional[uuid.UUID],
) -> AiCreditLedgerEntry:
    """Deduct the configured AI credit cost, or reject when the balance is short.

    The cost is read from ``org_ai_action_costs`` for this organisation.
    A cost of zero is allowed and still writes a ledger row.
    Commits on success. Rolls the session back when rejecting so the row lock drops.
    """
    if action_key not in AI_ACTION_KEYS:
        raise UnknownAiAction(action_key)
    if db.query(Organization.id).filter(Organization.id == organization_id).first() is None:
        raise AiCreditOrgNotFound(organization_id)

    ensure_wallet(db, organization_id)
    cost_row = (
        db.query(OrgAiActionCost)
        .filter(
            OrgAiActionCost.organization_id == organization_id,
            OrgAiActionCost.action_key == action_key,
        )
        .one()
    )
    cost = int(cost_row.credit_cost)
    balance_row = (
        db.query(OrgAiCreditBalance)
        .filter(OrgAiCreditBalance.organization_id == organization_id)
        .with_for_update()
        .one()
    )
    current = int(balance_row.balance)
    if current < cost:
        db.rollback()
        raise InsufficientAiCredits(balance=current, required=cost, action_key=action_key)

    balance_row.balance = current - cost
    balance_row.updated_at = datetime.utcnow()
    entry = AiCreditLedgerEntry(
        organization_id=organization_id,
        entry_type="spend",
        amount=-cost,
        balance_after=int(balance_row.balance),
        action_key=action_key,
        note=None,
        actor_user_id=actor_user_id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def refund_spend(
    db: Session,
    entry: AiCreditLedgerEntry,
    *,
    note: str,
) -> Optional[AiCreditLedgerEntry]:
    """Put credits back after a spend whose AI call failed. No-op when nothing was taken."""
    amount = abs(int(entry.amount))
    if amount == 0:
        return None
    balance_row = (
        db.query(OrgAiCreditBalance)
        .filter(OrgAiCreditBalance.organization_id == entry.organization_id)
        .with_for_update()
        .one()
    )
    balance_row.balance = int(balance_row.balance) + amount
    balance_row.updated_at = datetime.utcnow()
    refund = AiCreditLedgerEntry(
        organization_id=entry.organization_id,
        entry_type="refund",
        amount=amount,
        balance_after=int(balance_row.balance),
        action_key=entry.action_key,
        note=note,
        actor_user_id=entry.actor_user_id,
        related_entry_id=entry.id,
    )
    db.add(refund)
    db.commit()
    db.refresh(refund)
    return refund
