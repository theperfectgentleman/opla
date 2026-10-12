from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AiActionCostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    action_key: str
    label: str
    credit_cost: int


class AiCreditWalletOut(BaseModel):
    organization_id: UUID
    balance: int
    action_costs: List[AiActionCostOut]
    can_spend: Dict[str, bool]


class AiCreditTopUpRequest(BaseModel):
    amount: int = Field(gt=0, le=1_000_000_000)
    note: Optional[str] = Field(default=None, max_length=500)


class AiCreditTopUpResponse(BaseModel):
    organization_id: UUID
    balance: int
    ledger_id: UUID
    amount: int


class AiActionCostUpdate(BaseModel):
    credit_cost: int = Field(ge=0, le=1_000_000_000)


class AiCreditLedgerEntryOut(BaseModel):
    id: UUID
    entry_type: str
    amount: int
    balance_after: int
    action_key: Optional[str] = None
    note: Optional[str] = None
    actor_user_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    created_at: datetime


class AiCreditLedgerOut(BaseModel):
    entries: List[AiCreditLedgerEntryOut]
