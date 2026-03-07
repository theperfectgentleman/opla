from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import model_validator
from app.models.org_member import GlobalRole, InvitationStatus, MemberType
from app.models.invitation import (
    InvitationApprovalMode,
    InvitationDeliveryMode,
    InvitationLifecycleStatus,
    InvitationType,
)
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
    member_type: MemberType
    invitation_status: InvitationStatus
    joined_at: datetime


class InternalInvitationCreate(BaseModel):
    invited_email: Optional[str] = None
    delivery_mode: InvitationDeliveryMode

    @model_validator(mode="after")
    def validate_internal_invitation(self):
        if self.delivery_mode not in {InvitationDeliveryMode.EMAIL, InvitationDeliveryMode.SHORT_LINK}:
            raise ValueError("Internal invitations support email or short_link delivery only")
        if self.delivery_mode == InvitationDeliveryMode.EMAIL and not self.invited_email:
            raise ValueError("Email delivery requires invited_email")
        return self


class TeamInvitationCreate(BaseModel):
    delivery_mode: InvitationDeliveryMode
    approval_mode: InvitationApprovalMode = InvitationApprovalMode.AUTO

    @model_validator(mode="after")
    def validate_team_invitation(self):
        if self.delivery_mode not in {InvitationDeliveryMode.GENERATED_LINK, InvitationDeliveryMode.PIN_CODE}:
            raise ValueError("Team invitations support generated_link or pin_code delivery only")
        return self


class InvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    org_name: Optional[str] = None
    team_id: Optional[UUID] = None
    team_name: Optional[str] = None
    invitation_type: InvitationType
    member_type: MemberType
    delivery_mode: InvitationDeliveryMode
    approval_mode: InvitationApprovalMode
    status: InvitationLifecycleStatus
    invited_email: Optional[str] = None
    token: Optional[str] = None
    pin_code: Optional[str] = None
    created_by: UUID
    claimed_by: Optional[UUID] = None
    approved_by: Optional[UUID] = None
    accepted_by: Optional[UUID] = None
    claimed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class InvitationAcceptRequest(BaseModel):
    token: Optional[str] = None
    pin_code: Optional[str] = None

    @model_validator(mode="after")
    def validate_locator(self):
        if bool(self.token) == bool(self.pin_code):
            raise ValueError("Provide exactly one of token or pin_code")
        return self


class InvitationAcceptResponse(BaseModel):
    status: str
    invitation: InvitationOut
    membership: Optional[OrgMemberOut] = None

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


class PermissionDefinitionOut(BaseModel):
    key: str
    label: str
    description: str
    category: str


class StarterRoleTemplateOut(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    scope: str
    permissions: List[str] = []
    priority: int
    is_system: bool = True


class OrgRoleCatalogOut(BaseModel):
    permissions: List[PermissionDefinitionOut]
    starter_roles: List[StarterRoleTemplateOut]

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
