import unittest
import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.invitation import Invitation
from app.models.org_member import GlobalRole, InvitationStatus, MemberType, OrgMember
from app.models.organization import Organization
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.services.auth_service import auth_service


class InvitationApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        self.suffix = uuid.uuid4().hex[:10]

        self.admin_user = User(
            email=f"admin-invite-{self.suffix}@example.com",
            full_name="Invite Admin",
            password_hash="not-used",
            is_active=True,
        )
        self.internal_user = User(
            email=f"internal-{self.suffix}@example.com",
            full_name="Internal Invitee",
            password_hash="not-used",
            is_active=True,
        )
        self.contractor_user = User(
            email=f"contractor-{self.suffix}@example.com",
            full_name="Contractor Invitee",
            password_hash="not-used",
            is_active=True,
        )
        self.db.add_all([self.admin_user, self.internal_user, self.contractor_user])
        self.db.flush()

        self.organization = Organization(
            name=f"Invitation Org {self.suffix}",
            slug=f"invitation-org-{self.suffix}",
            owner_id=self.admin_user.id,
        )
        self.db.add(self.organization)
        self.db.flush()

        self.db.add(
            OrgMember(
                user_id=self.admin_user.id,
                org_id=self.organization.id,
                global_role=GlobalRole.ADMIN,
                member_type=MemberType.INTERNAL,
                invitation_status=InvitationStatus.ACCEPTED,
            )
        )

        self.team = Team(org_id=self.organization.id, name=f"Field Team {self.suffix}")
        self.db.add(self.team)
        self.db.commit()

    def tearDown(self):
        org_id = self.organization.id
        team_id = self.team.id
        user_ids = [self.admin_user.id, self.internal_user.id, self.contractor_user.id]

        self.db.query(Invitation).filter(Invitation.org_id == org_id).delete(synchronize_session=False)
        self.db.query(TeamMember).filter(TeamMember.team_id == team_id).delete(synchronize_session=False)
        self.db.query(Team).filter(Team.id == team_id).delete(synchronize_session=False)
        self.db.query(OrgMember).filter(OrgMember.org_id == org_id).delete(synchronize_session=False)
        self.db.query(Organization).filter(Organization.id == org_id).delete(synchronize_session=False)
        self.db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def auth_headers(self, user: User) -> dict[str, str]:
        token = auth_service.create_access_token({"sub": str(user.id)})
        return {"Authorization": f"Bearer {token}"}

    def test_internal_invitation_acceptance_creates_internal_membership(self):
        create_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/invitations/internal",
            headers=self.auth_headers(self.admin_user),
            json={"delivery_mode": "email", "invited_email": self.internal_user.email},
        )

        self.assertEqual(create_response.status_code, 201)
        invitation = create_response.json()
        self.assertEqual(invitation["member_type"], "internal")
        self.assertEqual(invitation["status"], "approved")
        self.assertEqual(invitation["org_name"], self.organization.name)

        accept_response = self.client.post(
            "/api/v1/organizations/invitations/accept",
            headers=self.auth_headers(self.internal_user),
            json={"token": invitation["token"]},
        )

        self.assertEqual(accept_response.status_code, 200)
        payload = accept_response.json()
        self.assertEqual(payload["status"], "accepted")
        self.assertEqual(payload["membership"]["member_type"], "internal")

    def test_contractor_pin_invitation_auto_approval_adds_team_membership(self):
        create_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/teams/{self.team.id}/invitations/contractor",
            headers=self.auth_headers(self.admin_user),
            json={"delivery_mode": "pin_code", "approval_mode": "auto"},
        )

        self.assertEqual(create_response.status_code, 200)
        invitation = create_response.json()
        self.assertEqual(invitation["member_type"], "contractor")
        self.assertIsNotNone(invitation["pin_code"])
        self.assertEqual(invitation["team_name"], self.team.name)

        accept_response = self.client.post(
            "/api/v1/organizations/invitations/accept",
            headers=self.auth_headers(self.contractor_user),
            json={"pin_code": invitation["pin_code"]},
        )

        self.assertEqual(accept_response.status_code, 200)
        payload = accept_response.json()
        self.assertEqual(payload["status"], "accepted")
        self.assertEqual(payload["membership"]["member_type"], "contractor")

        team_membership = (
            self.db.query(TeamMember)
            .filter(TeamMember.team_id == self.team.id, TeamMember.user_id == self.contractor_user.id)
            .first()
        )
        self.assertIsNotNone(team_membership)

    def test_contractor_review_invitation_requires_approval(self):
        create_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/teams/{self.team.id}/invitations/contractor",
            headers=self.auth_headers(self.admin_user),
            json={"delivery_mode": "generated_link", "approval_mode": "review"},
        )

        self.assertEqual(create_response.status_code, 200)
        invitation = create_response.json()
        self.assertEqual(invitation["status"], "pending")

        claim_response = self.client.post(
            "/api/v1/organizations/invitations/accept",
            headers=self.auth_headers(self.contractor_user),
            json={"token": invitation["token"]},
        )

        self.assertEqual(claim_response.status_code, 200)
        self.assertEqual(claim_response.json()["status"], "pending_review")

        approve_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/invitations/{invitation['id']}/approve",
            headers=self.auth_headers(self.admin_user),
        )

        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.json()["status"], "accepted")
        self.assertEqual(approve_response.json()["team_name"], self.team.name)

        membership = (
            self.db.query(OrgMember)
            .filter(OrgMember.org_id == self.organization.id, OrgMember.user_id == self.contractor_user.id)
            .first()
        )
        self.assertIsNotNone(membership)
        self.assertEqual(membership.member_type, MemberType.CONTRACTOR)