from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BroadcastContactIn(BaseModel):
    phone: str = Field(max_length=64)
    name: Optional[str] = Field(default=None, max_length=200)
    source: Literal["csv", "manual"] = "manual"


class BroadcastAudienceIn(BaseModel):
    team_ids: List[UUID] = Field(default_factory=list, max_length=200)
    contacts: List[BroadcastContactIn] = Field(default_factory=list, max_length=20000)


class BroadcastPreviewIn(BroadcastAudienceIn):
    message: str = Field(default="", max_length=5000)
    name_fallback: str = Field(default="", max_length=60)


class BroadcastCreateIn(BroadcastAudienceIn):
    message: str = Field(min_length=1, max_length=5000)
    name_fallback: str = Field(default="", max_length=60)
    # Recipient count the user saw in the confirm step; a mismatch returns 409.
    expected_recipient_count: Optional[int] = Field(default=None, ge=0)


class PreviewRecipientOut(BaseModel):
    phone: str
    name: Optional[str] = None
    sources: List[str]
    team_names: List[str] = Field(default_factory=list)


class RejectedOut(BaseModel):
    input: str
    name: Optional[str] = None
    source: str
    reason: str


class MemberWithoutPhoneOut(BaseModel):
    user_id: str
    name: str
    team_name: str


class SegmentEstimateOut(BaseModel):
    encoding: str
    length: int
    parts: int
    max_parts: int
    estimated_credits: int


class BroadcastPreviewOut(BaseModel):
    recipient_count: int
    recipients: List[PreviewRecipientOut]
    invalid: List[RejectedOut]
    unsupported: List[RejectedOut]
    opted_out: List[RejectedOut]
    members_without_phone: List[MemberWithoutPhoneOut]
    duplicates_removed: int
    estimate: SegmentEstimateOut
    max_recipients: int


class SmsProviderStatusOut(BaseModel):
    enabled: bool
    provider: str
    sender_id: Optional[str] = None
    issue: Optional[str] = None
    can_send: bool
    batch_size: int
    max_recipients: int


class SmsBalanceOut(BaseModel):
    available: bool
    balance: Optional[float] = None
    bonus: Optional[float] = None
    error: Optional[str] = None


class BroadcastCreatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str


class BroadcastOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    channel: str
    provider: str
    sender_id: Optional[str] = None
    body: str
    name_fallback: Optional[str] = None
    status: str
    audience_json: Optional[dict] = None
    recipient_count: int
    sent_count: int
    failed_count: int
    estimated_credits: int
    credits_used: Optional[float] = None
    last_error: Optional[str] = None
    created_by: Optional[UUID] = None
    creator: Optional[BroadcastCreatorOut] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class BroadcastDeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone: str
    name: Optional[str] = None
    user_id: Optional[UUID] = None
    sources: Optional[List[str]] = None
    team_names: Optional[List[str]] = None
    parts: int
    status: str
    error: Optional[str] = None
    provider_ref: Optional[str] = None
    attempts: int
    sent_at: Optional[datetime] = None
    updated_at: datetime


class BroadcastDetailOut(BroadcastOut):
    queued_count: int = 0
    deliveries: List[BroadcastDeliveryOut]


class BroadcastRetryOut(BaseModel):
    requeued: int
    broadcast: BroadcastOut


class OptOutIn(BaseModel):
    phone: str = Field(min_length=1, max_length=64)
    reason: Optional[str] = Field(default=None, max_length=200)


class OptOutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone: str
    reason: Optional[str] = None
    created_at: datetime
