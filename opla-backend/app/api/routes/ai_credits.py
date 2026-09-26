"""Organisation AI credit wallet: balance, history, manual top-up, action costs."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.ai_credits import (
    AiActionCostOut,
    AiActionCostUpdate,
    AiCreditLedgerEntryOut,
    AiCreditLedgerOut,
    AiCreditTopUpRequest,
    AiCreditTopUpResponse,
    AiCreditWalletOut,
)
from app.models.org_member import GlobalRole, OrgMember
from app.models.organization import Organization
from app.models.user import User
from app.services import ai_credit_service
from app.services.ai_credit_service import AiCreditOrgNotFound, UnknownAiAction

router = APIRouter(prefix="/organizations", tags=["ai-credits"])


def _org_or_404(db: Session, org_id: uuid.UUID) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


def _membership(db: Session, org_id: uuid.UUID, user_id: uuid.UUID) -> OrgMember | None:
    return (
        db.query(OrgMember)
        .filter(OrgMember.org_id == org_id, OrgMember.user_id == user_id)
        .first()
    )


def _is_org_admin(member: OrgMember) -> bool:
    role = member.global_role
    if isinstance(role, GlobalRole):
        return role == GlobalRole.ADMIN
    return str(role) == GlobalRole.ADMIN.value


def _require_reader(db: Session, org_id: uuid.UUID, user: User) -> None:
    if user.is_platform_admin:
        return
    if _membership(db, org_id, user.id) is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )


def _require_manager(db: Session, org_id: uuid.UUID, user: User) -> None:
    """Org admin, or a platform admin (the existing super-admin flag)."""
    if user.is_platform_admin:
        return
    member = _membership(db, org_id, user.id)
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )
    if not _is_org_admin(member):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization admin permissions required",
        )


@router.get("/{org_id}/ai-credits", response_model=AiCreditWalletOut)
def get_ai_credits(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _org_or_404(db, org_id)
    _require_reader(db, org_id, current_user)
    try:
        view = ai_credit_service.wallet_view(db, org_id)
    except AiCreditOrgNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return view


@router.get("/{org_id}/ai-credits/ledger", response_model=AiCreditLedgerOut)
def list_ai_credit_ledger(
    org_id: uuid.UUID,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _org_or_404(db, org_id)
    _require_manager(db, org_id, current_user)
    rows = ai_credit_service.list_ledger(db, org_id, limit=limit)
    return AiCreditLedgerOut(
        entries=[
            AiCreditLedgerEntryOut(
                id=entry.id,
                entry_type=entry.entry_type,
                amount=entry.amount,
                balance_after=entry.balance_after,
                action_key=entry.action_key,
                note=entry.note,
                actor_user_id=entry.actor_user_id,
                actor_name=actor_name,
                created_at=entry.created_at,
            )
            for entry, actor_name in rows
        ]
    )


@router.post("/{org_id}/ai-credits/top-ups", response_model=AiCreditTopUpResponse, status_code=status.HTTP_201_CREATED)
def top_up_ai_credits(
    org_id: uuid.UUID,
    body: AiCreditTopUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manual top-up after MoMo or invoice. No card or Paystack charge."""
    _org_or_404(db, org_id)
    _require_manager(db, org_id, current_user)
    try:
        balance_row, entry = ai_credit_service.top_up(
            db,
            org_id,
            body.amount,
            actor_user_id=current_user.id,
            note=body.note,
        )
    except AiCreditOrgNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return AiCreditTopUpResponse(
        organization_id=org_id,
        balance=int(balance_row.balance),
        ledger_id=entry.id,
        amount=entry.amount,
    )


@router.patch("/{org_id}/ai-credits/action-costs/{action_key}", response_model=AiActionCostOut)
def update_ai_action_cost(
    org_id: uuid.UUID,
    action_key: str,
    body: AiActionCostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _org_or_404(db, org_id)
    _require_manager(db, org_id, current_user)
    try:
        row = ai_credit_service.update_action_cost(db, org_id, action_key, body.credit_cost)
    except UnknownAiAction as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AiCreditOrgNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return row
