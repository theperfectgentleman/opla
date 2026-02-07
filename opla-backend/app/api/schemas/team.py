from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamMemberAdd(BaseModel):
    user_id: UUID


class TeamMemberOut(BaseModel):
    id: UUID
    user_id: UUID
    team_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class TeamOut(TeamBase):
    id: UUID
    org_id: UUID
    created_at: datetime
    updated_at: datetime
    member_count: Optional[int] = 0

    class Config:
        from_attributes = True
