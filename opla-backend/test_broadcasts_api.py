"""API tests for project SMS broadcasts with a fake provider (no network, no real SMS).

Needs DATABASE_URL pointing at a throwaway database with migrations applied.
"""

import unittest
import uuid

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models.org_member import GlobalRole, InvitationStatus, OrgMember
from app.models.organization import Organization
from app.models.project import Project, ProjectStatus
from app.models.project_access import AccessorType, ProjectAccess, ProjectRole
from app.models.project_broadcast import OrgMessageOptOut, ProjectBroadcast
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.user import User
from app.services.auth_service import auth_service
from app.services.sms.providers import FakeSmsProvider, set_sms_provider_override


class BroadcastApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self._saved = (settings.SMS_BATCH_SIZE, settings.SMS_BATCH_DELAY_SECONDS, settings.SMS_PROVIDER)
        settings.SMS_BATCH_SIZE = 2
        settings.SMS_BATCH_DELAY_SECONDS = 0
        settings.SMS_PROVIDER = ""
        self.fake = FakeSmsProvider(sender_id="Opla")
        set_sms_provider_override(self.fake)

        self.db = SessionLocal()
        s = uuid.uuid4().hex[:8]
        n = int(uuid.uuid4().int % 10_000_000)

        def phone(i):
            return f"024{(n + i) % 10_000_000:07d}"

        self.phones = [phone(i) for i in range(6)]
        self.admin = User(email=f"bc-admin-{s}@example.com", full_name="Admin Person", password_hash="x", phone=phone(0))
        self.supervisor = User(email=f"bc-sup-{s}@example.com", full_name="Esi Supervisor", password_hash="x", phone=phone(1))
        self.agent = User(email=f"bc-agent-{s}@example.com", full_name="Kwame Agent", password_hash="x", phone="+233" + phone(2)[1:])
        self.nophone = User(email=f"bc-nophone-{s}@example.com", full_name="No Phone", password_hash="x")
        self.db.add_all([self.admin, self.supervisor, self.agent, self.nophone])
        self.db.flush()
        self.users = [self.admin, self.supervisor, self.agent, self.nophone]

        self.org = Organization(name=f"Broadcast Org {s}", slug=f"broadcast-org-{s}", owner_id=self.admin.id)
        self.db.add(self.org)
        self.db.flush()
        for user, role in [
            (self.admin, GlobalRole.ADMIN),
            (self.supervisor, GlobalRole.MEMBER),
            (self.agent, GlobalRole.MEMBER),
            (self.nophone, GlobalRole.MEMBER),
        ]:
            self.db.add(OrgMember(user_id=user.id, org_id=self.org.id, global_role=role, invitation_status=InvitationStatus.ACCEPTED))
        self.project = Project(org_id=self.org.id, name=f"Activation {s}", status=ProjectStatus.ACTIVE)
        self.db.add(self.project)
        self.db.flush()
        self.db.add_all(
            [
                ProjectAccess(project_id=self.project.id, accessor_id=self.supervisor.id, accessor_type=AccessorType.USER, role=ProjectRole.EDITOR),
                ProjectAccess(project_id=self.project.id, accessor_id=self.agent.id, accessor_type=AccessorType.USER, role=ProjectRole.COLLECTOR),
            ]
        )
        self.north = Team(org_id=self.org.id, name="North Team")
        self.south = Team(org_id=self.org.id, name="South Team")
        self.db.add_all([self.north, self.south])
        self.db.flush()
        self.db.add_all(
            [
                TeamMember(team_id=self.north.id, user_id=self.agent.id),
                TeamMember(team_id=self.north.id, user_id=self.nophone.id),
                TeamMember(team_id=self.south.id, user_id=self.agent.id),  # overlap
                TeamMember(team_id=self.south.id, user_id=self.supervisor.id),
            ]
        )
        self.db.commit()
        self.base = f"/api/v1/organizations/{self.org.id}/projects/{self.project.id}/broadcasts"

    def tearDown(self):
        set_sms_provider_override(None)
        settings.SMS_BATCH_SIZE, settings.SMS_BATCH_DELAY_SECONDS, settings.SMS_PROVIDER = self._saved
        db = self.db
        db.rollback()
        db.query(ProjectBroadcast).filter(ProjectBroadcast.project_id == self.project.id).delete(synchronize_session=False)
        db.query(OrgMessageOptOut).filter(OrgMessageOptOut.org_id == self.org.id).delete(synchronize_session=False)
        team_ids = [self.north.id, self.south.id]
        db.query(TeamMember).filter(TeamMember.team_id.in_(team_ids)).delete(synchronize_session=False)
        db.query(Team).filter(Team.id.in_(team_ids)).delete(synchronize_session=False)
        db.query(ProjectAccess).filter(ProjectAccess.project_id == self.project.id).delete(synchronize_session=False)
        db.query(Project).filter(Project.id == self.project.id).delete(synchronize_session=False)
        db.query(OrgMember).filter(OrgMember.org_id == self.org.id).delete(synchronize_session=False)
        db.query(Organization).filter(Organization.id == self.org.id).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_([u.id for u in self.users])).delete(synchronize_session=False)
        db.commit()
        db.close()

    def h(self, user):
        return {"Authorization": f"Bearer {auth_service.create_access_token({'sub': str(user.id)})}"}

    def audience(self, **extra):
        payload = {
            "team_ids": [str(self.north.id), str(self.south.id)],
            "contacts": [
                {"phone": self.phones[3], "name": "Yaa CSV", "source": "csv"},
                {"phone": "233" + self.phones[2][1:], "name": "Dup of agent", "source": "csv"},
                {"phone": "12345", "source": "csv"},
                {"phone": self.phones[4], "source": "manual"},
                {"phone": "+447700900123", "source": "manual"},
            ],
        }
        payload.update(extra)
        return payload

    def test_provider_status_and_permissions(self):
        status = self.client.get(f"{self.base}/provider", headers=self.h(self.agent)).json()
        self.assertTrue(status["enabled"])
        self.assertFalse(status["can_send"])
        self.assertTrue(self.client.get(f"{self.base}/provider", headers=self.h(self.supervisor)).json()["can_send"])
        self.assertTrue(self.client.get(f"{self.base}/provider", headers=self.h(self.admin)).json()["can_send"])

        denied = self.client.post(f"{self.base}/preview", json=self.audience(message="hi"), headers=self.h(self.agent))
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(self.client.get(self.base, headers=self.h(self.agent)).status_code, 403)
        self.assertEqual(self.client.get(f"{self.base}/balance", headers=self.h(self.agent)).status_code, 403)

        balance = self.client.get(f"{self.base}/balance", headers=self.h(self.supervisor)).json()
        self.assertTrue(balance["available"])

    def test_disabled_provider_blocks_sending(self):
        set_sms_provider_override(None)  # SMS_PROVIDER="" → disabled
        status = self.client.get(f"{self.base}/provider", headers=self.h(self.admin)).json()
        self.assertFalse(status["enabled"])
        self.assertIn("SMS_PROVIDER", status["issue"])
        res = self.client.post(self.base, json=self.audience(message="hi"), headers=self.h(self.admin))
        self.assertEqual(res.status_code, 503)

    def test_preview_dedupes_and_flags(self):
        self.client.post(f"{self.base}/opt-outs", json={"phone": self.phones[4], "reason": "asked"}, headers=self.h(self.admin))
        res = self.client.post(f"{self.base}/preview", json=self.audience(message="Hi {name}"), headers=self.h(self.admin))
        self.assertEqual(res.status_code, 200, res.text)
        body = res.json()
        phones = [r["phone"] for r in body["recipients"]]
        # agent (North+South+CSV dup), supervisor (South), CSV Yaa, UK number (fake supports all)
        self.assertEqual(body["recipient_count"], 4)
        self.assertEqual(len(set(phones)), 4)
        agent = next(r for r in body["recipients"] if r["phone"] == "+233" + self.phones[2][1:])
        self.assertEqual(agent["team_names"], ["North Team", "South Team"])
        self.assertEqual(agent["name"], "Kwame Agent")
        self.assertEqual(body["duplicates_removed"], 2)
        self.assertEqual([i["input"] for i in body["invalid"]], ["12345"])
        self.assertEqual(len(body["opted_out"]), 1)
        self.assertEqual([m["name"] for m in body["members_without_phone"]], ["No Phone"])
        self.assertEqual(body["estimate"]["estimated_credits"], 4)

    def test_send_batches_personalises_and_logs(self):
        payload = self.audience(message="Hello team, site closed today.")
        preview = self.client.post(f"{self.base}/preview", json=payload, headers=self.h(self.supervisor)).json()

        stale = self.client.post(self.base, json={**payload, "expected_recipient_count": 99}, headers=self.h(self.supervisor))
        self.assertEqual(stale.status_code, 409)

        res = self.client.post(
            self.base, json={**payload, "expected_recipient_count": preview["recipient_count"]}, headers=self.h(self.supervisor)
        )
        self.assertEqual(res.status_code, 202, res.text)
        broadcast_id = res.json()["id"]
        # BackgroundTasks run after the response inside TestClient; batch size 2 → 3 requests for 5 people
        self.assertEqual(preview["recipient_count"], 5)
        self.assertEqual(len(self.fake.sent), 3, self.fake.sent)
        self.assertTrue(all(len(phones) <= 2 for phones, _ in self.fake.sent))

        detail = self.client.get(f"{self.base}/{broadcast_id}", headers=self.h(self.supervisor)).json()
        self.assertEqual(detail["status"], "completed")
        self.assertEqual((detail["recipient_count"], detail["sent_count"], detail["failed_count"]), (5, 5, 0))
        self.assertEqual(detail["credits_used"], 5.0)
        self.assertTrue(all(d["status"] == "sent" and d["provider_ref"] for d in detail["deliveries"]))
        self.assertEqual(detail["creator"]["full_name"], "Esi Supervisor")

        listing = self.client.get(self.base, headers=self.h(self.supervisor)).json()
        self.assertEqual([b["id"] for b in listing], [broadcast_id])

    def test_name_personalisation(self):
        payload = {"team_ids": [str(self.south.id)], "contacts": [{"phone": self.phones[3], "source": "manual"}], "message": "Hi {name}, check in by 8.", "name_fallback": "team"}
        res = self.client.post(self.base, json=payload, headers=self.h(self.admin))
        self.assertEqual(res.status_code, 202, res.text)
        texts = sorted(text for _, text in self.fake.sent)
        self.assertEqual(texts, ["Hi Esi, check in by 8.", "Hi Kwame, check in by 8.", "Hi team, check in by 8."])

    def test_failed_recipients_can_be_retried(self):
        failing = "+233" + self.phones[3][1:]
        self.fake.fail_phones = {failing}
        res = self.client.post(self.base, json=self.audience(message="Report at 9"), headers=self.h(self.admin))
        broadcast_id = res.json()["id"]
        detail = self.client.get(f"{self.base}/{broadcast_id}", headers=self.h(self.admin)).json()
        self.assertEqual(detail["status"], "partial")
        self.assertEqual(detail["failed_count"], 1)
        failed = [d for d in detail["deliveries"] if d["status"] == "failed"]
        self.assertEqual([d["phone"] for d in failed], [failing])

        self.fake.fail_phones = set()
        retry = self.client.post(f"{self.base}/{broadcast_id}/retry", headers=self.h(self.admin))
        self.assertEqual(retry.status_code, 202, retry.text)
        self.assertEqual(retry.json()["requeued"], 1)
        detail = self.client.get(f"{self.base}/{broadcast_id}", headers=self.h(self.admin)).json()
        self.assertEqual(detail["status"], "completed")
        self.assertEqual(detail["failed_count"], 0)
        again = next(d for d in detail["deliveries"] if d["phone"] == failing)
        self.assertEqual(again["attempts"], 2)

        nothing = self.client.post(f"{self.base}/{broadcast_id}/retry", headers=self.h(self.admin))
        self.assertEqual(nothing.status_code, 400)

    def test_opt_outs_crud_and_validation(self):
        bad = self.client.post(f"{self.base}/opt-outs", json={"phone": "nope"}, headers=self.h(self.admin))
        self.assertEqual(bad.status_code, 400)
        created = self.client.post(f"{self.base}/opt-outs", json={"phone": "+233 " + self.phones[5][1:]}, headers=self.h(self.admin)).json()
        same = self.client.post(f"{self.base}/opt-outs", json={"phone": self.phones[5]}, headers=self.h(self.admin)).json()
        self.assertEqual(created["id"], same["id"])
        listed = self.client.get(f"{self.base}/opt-outs", headers=self.h(self.admin)).json()
        self.assertEqual(len(listed), 1)
        self.assertEqual(self.client.delete(f"{self.base}/opt-outs/{created['id']}", headers=self.h(self.admin)).status_code, 204)

    def test_empty_and_foreign_team(self):
        empty = self.client.post(self.base, json={"message": "hi", "team_ids": [], "contacts": []}, headers=self.h(self.admin))
        self.assertEqual(empty.status_code, 400)
        foreign = self.client.post(
            f"{self.base}/preview", json={"message": "hi", "team_ids": [str(uuid.uuid4())]}, headers=self.h(self.admin)
        )
        self.assertEqual(foreign.status_code, 404)


if __name__ == "__main__":
    unittest.main()
