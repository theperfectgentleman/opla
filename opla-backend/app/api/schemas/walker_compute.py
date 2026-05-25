from typing import Any, Optional

from pydantic import BaseModel, Field


class WalkerComputePayload(BaseModel):
    workflow: list[dict[str, Any]]
    tag: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None


class WalkerComputeResponse(BaseModel):
    success: bool
    data: list[dict[str, Any]] | None = None
    message: Optional[str] = None
    error: Optional[dict[str, Any]] = None
