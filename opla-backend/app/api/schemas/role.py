from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class OrgRoleBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    permissions: List[str] = Field(default_factory=list)
    priority: int = 50


class OrgRoleCreate(OrgRoleBase):
    pass


class OrgRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    priority: Optional[int] = None


class OrgRoleOut(OrgRoleBase):
    id: UUID
    org_id: UUID
    is_system: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoleAssignmentCreate(BaseModel):
    role_id: UUID
    accessor_id: UUID
    accessor_type: str  # 'user' or 'team'


class RoleAssignmentOut(BaseModel):
    id: UUID
    org_id: UUID
    role_id: UUID
    accessor_id: UUID
    accessor_type: str
    assigned_by: Optional[UUID]
    created_at: datetime

    class Config:
        from_attributes = True
