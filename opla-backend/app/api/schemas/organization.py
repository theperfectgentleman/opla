from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from app.models.org_member import GlobalRole, InvitationStatus
from app.models.project_access import AccessorType
from app.api.schemas.auth import UserResponse

class OrganizationBase(BaseModel):
    name: str
    logo_url: Optional[str] = None
    primary_color: str = "#6366f1"

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationOut(OrganizationBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    slug: str
    owner_id: UUID
    created_at: datetime
    updated_at: datetime

class OrgMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    global_role: GlobalRole
    invitation_status: InvitationStatus
    joined_at: datetime

class OrgRoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    priority: int = 50

class OrgRoleCreate(OrgRoleBase):
    pass

class OrgRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    priority: Optional[int] = None

class OrgRoleOut(OrgRoleBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    org_id: UUID
    slug: str
    is_system: bool
    created_at: datetime
    updated_at: datetime

class OrgRoleAssignmentCreate(BaseModel):
    role_id: UUID
    accessor_id: UUID
    accessor_type: AccessorType

class OrgRoleAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    org_id: UUID
    role_id: UUID
    accessor_id: UUID
    accessor_type: AccessorType
    assigned_by: Optional[UUID] = None
    created_at: datetime

class OrgRoleAssignmentView(BaseModel):
    accessor_id: UUID
    accessor_type: AccessorType
    accessor_name: Optional[str] = None
    role: OrgRoleOut

class OrgMemberDetailOut(OrgMemberOut):
    user: UserResponse
    effective_role: Optional[OrgRoleOut] = None
    role_assignments: List[OrgRoleAssignmentView] = []

class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None

class TeamCreate(TeamBase):
    pass

class TeamOut(TeamBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    org_id: UUID
    created_at: datetime
    updated_at: datetime
