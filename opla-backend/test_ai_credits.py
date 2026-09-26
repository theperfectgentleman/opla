"""AI credit wallet: balance, deduct, block-at-zero, manual top-up, configurable costs."""

from __future__ import annotations

import threading
import unittest
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.ai_credits import AiCreditLedgerEntry, OrgAiActionCost, OrgAiCreditBalance
from app.models.org_member import GlobalRole, InvitationStatus, MemberType, OrgMember
from app.models.organization import Organization
from app.models.project_role_template import ProjectRoleTemplate
from app.models.role_template import OrgRole, OrgRoleAssignment
from app.models.user import User
from app.services.ai_credit_catalog import (
    AI_CREDITS_TOP_UP_MESSAGE,
    AI_SURVEY_DRAFT,
    AI_SURVEY_INTERVIEW,
    AI_SURVEY_REVISE,
)
from app.services.ai_credit_service import (
    InsufficientAiCredits,
    refund_spend,
    spend_or_reject,
    top_up,
    update_action_cost,
)
from app.services.ai_survey_service import AiSurveyServiceError
from app.services.auth_service import auth_service
from app.services.organization_service import OrganizationService


class AiCreditServiceTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.suffix = uuid.uuid4().hex[:10]
        self.owner = User(
            email=f"credits-owner-{self.suffix}@example.com",
            full_name="Credits Owner",
            password_hash="not-used",
            is_active=True,
        )
        self.db.add(self.owner)
        self.db.commit()
        self.db.refresh(self.owner)
        self.org = OrganizationService.create_organization(self.db, f"Credits Org {self.suffix}", self.owner.id)

    def tearDown(self):
        self.db.rollback()
        org_id = self.org.id
        self.db.query(AiCreditLedgerEntry).filter(AiCreditLedgerEntry.organization_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgAiActionCost).filter(OrgAiActionCost.organization_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgAiCreditBalance).filter(OrgAiCreditBalance.organization_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgMember).filter(OrgMember.org_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgRoleAssignment).filter(OrgRoleAssignment.org_id == org_id).delete(synchronize_session=False)
        self.db.query(ProjectRoleTemplate).filter(ProjectRoleTemplate.org_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgRole).filter(OrgRole.org_id == org_id).delete(synchronize_session=False)
        self.db.query(Organization).filter(Organization.id == org_id).delete(synchronize_session=False)
        self.db.query(User).filter(User.id == self.owner.id).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def test_new_organization_starts_at_zero_with_configurable_actions(self):
        balance = (
            self.db.query(OrgAiCreditBalance)
            .filter(OrgAiCreditBalance.organization_id == self.org.id)
            .one()
        )
        self.assertEqual(balance.balance, 0)
        keys = {
            row.action_key: row.credit_cost
            for row in self.db.query(OrgAiActionCost).filter(OrgAiActionCost.organization_id == self.org.id).all()
        }
        self.assertEqual(
            set(keys),
            {AI_SURVEY_INTERVIEW, AI_SURVEY_DRAFT, AI_SURVEY_REVISE},
        )

    def test_top_up_spend_block_and_cost_change(self):
        with self.assertRaises(ValueError):
            top_up(self.db, self.org.id, 0, actor_user_id=self.owner.id)

        balance_row, entry = top_up(
            self.db,
            self.org.id,
            4,
            actor_user_id=self.owner.id,
            note="MoMo reference",
        )
        self.assertEqual(balance_row.balance, 4)
        self.assertEqual(entry.entry_type, "top_up")
        self.assertEqual(entry.amount, 4)
        self.assertEqual(entry.note, "MoMo reference")

        spent = spend_or_reject(self.db, self.org.id, AI_SURVEY_INTERVIEW, self.owner.id)
        self.assertEqual(spent.entry_type, "spend")
        self.assertEqual(spent.amount, -1)
        self.assertEqual(spent.action_key, AI_SURVEY_INTERVIEW)
        self.assertEqual(spent.balance_after, 3)

        update_action_cost(self.db, self.org.id, AI_SURVEY_DRAFT, 3)
        drafted = spend_or_reject(self.db, self.org.id, AI_SURVEY_DRAFT, self.owner.id)
        self.assertEqual(drafted.amount, -3)
        self.assertEqual(drafted.balance_after, 0)

        with self.assertRaises(InsufficientAiCredits) as blocked:
            spend_or_reject(self.db, self.org.id, AI_SURVEY_REVISE, self.owner.id)
        self.assertEqual(blocked.exception.balance, 0)
        self.assertEqual(blocked.exception.code, "ai_credits_exhausted")
        self.assertIn("Top up AI credits", blocked.exception.message)

        still = (
            self.db.query(OrgAiCreditBalance)
            .filter(OrgAiCreditBalance.organization_id == self.org.id)
            .one()
        )
        self.assertEqual(still.balance, 0)
        spend_rows = (
            self.db.query(AiCreditLedgerEntry)
            .filter(
                AiCreditLedgerEntry.organization_id == self.org.id,
                AiCreditLedgerEntry.entry_type == "spend",
            )
            .count()
        )
        self.assertEqual(spend_rows, 2)

    def test_refund_applies_exactly_once(self):
        top_up(self.db, self.org.id, 3, actor_user_id=self.owner.id)
        spent = spend_or_reject(self.db, self.org.id, AI_SURVEY_INTERVIEW, self.owner.id)
        first = refund_spend(self.db, spent, note="model failed")
        second = refund_spend(self.db, spent, note="model failed again")
        self.assertIsNotNone(first)
        self.assertEqual(second.id, first.id)
        self.assertEqual(first.amount, 1)
        self.assertEqual(first.related_entry_id, spent.id)
        balance = (
            self.db.query(OrgAiCreditBalance)
            .filter(OrgAiCreditBalance.organization_id == self.org.id)
            .one()
        )
        self.assertEqual(int(balance.balance), 3)
        refunds = (
            self.db.query(AiCreditLedgerEntry)
            .filter(
                AiCreditLedgerEntry.organization_id == self.org.id,
                AiCreditLedgerEntry.entry_type == "refund",
                AiCreditLedgerEntry.related_entry_id == spent.id,
            )
            .count()
        )
        self.assertEqual(refunds, 1)

    def _preload_balance(self, db, organization_id):
        (
            db.query(OrgAiCreditBalance)
            .filter(OrgAiCreditBalance.organization_id == organization_id)
            .one()
        )

    def test_parallel_spends_at_balance_equal_cost_cannot_overspend(self):
        top_up(self.db, self.org.id, 1, actor_user_id=self.owner.id)
        barrier = threading.Barrier(2)
        outcomes = []
        errors = []
        guard = threading.Lock()

        def worker():
            db = SessionLocal()
            try:
                self._preload_balance(db, self.org.id)
                barrier.wait(timeout=15)
                try:
                    spend_or_reject(db, self.org.id, AI_SURVEY_INTERVIEW, self.owner.id)
                    with guard:
                        outcomes.append("ok")
                except InsufficientAiCredits:
                    with guard:
                        outcomes.append("blocked")
            except Exception as exc:
                with guard:
                    errors.append(repr(exc))
                try:
                    barrier.abort()
                except Exception:
                    pass
            finally:
                db.close()

        threads = [threading.Thread(target=worker) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)
        self.assertTrue(all(not thread.is_alive() for thread in threads))
        self.assertEqual(errors, [])
        self.assertEqual(sorted(outcomes), ["blocked", "ok"])

        fresh = SessionLocal()
        try:
            balance = (
                fresh.query(OrgAiCreditBalance)
                .filter(OrgAiCreditBalance.organization_id == self.org.id)
                .one()
            )
            spends = (
                fresh.query(AiCreditLedgerEntry)
                .filter(
                    AiCreditLedgerEntry.organization_id == self.org.id,
                    AiCreditLedgerEntry.entry_type == "spend",
                )
                .count()
            )
            self.assertEqual(int(balance.balance), 0)
            self.assertEqual(spends, 1)
        finally:
            fresh.close()

    def test_parallel_top_ups_sum(self):
        barrier = threading.Barrier(2)
        errors = []
        guard = threading.Lock()

        def worker(amount: int):
            db = SessionLocal()
            try:
                self._preload_balance(db, self.org.id)
                barrier.wait(timeout=15)
                top_up(db, self.org.id, amount, actor_user_id=self.owner.id, note=f"parallel {amount}")
            except Exception as exc:
                with guard:
                    errors.append(repr(exc))
                try:
                    barrier.abort()
                except Exception:
                    pass
            finally:
                db.close()

        threads = [
            threading.Thread(target=worker, args=(10,)),
            threading.Thread(target=worker, args=(1,)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)
        self.assertTrue(all(not thread.is_alive() for thread in threads))
        self.assertEqual(errors, [])

        fresh = SessionLocal()
        try:
            balance = (
                fresh.query(OrgAiCreditBalance)
                .filter(OrgAiCreditBalance.organization_id == self.org.id)
                .one()
            )
            credited = (
                fresh.query(AiCreditLedgerEntry)
                .filter(
                    AiCreditLedgerEntry.organization_id == self.org.id,
                    AiCreditLedgerEntry.entry_type == "top_up",
                )
                .all()
            )
            self.assertEqual(int(balance.balance), 11)
            self.assertEqual(sum(int(row.amount) for row in credited), 11)
        finally:
            fresh.close()


class AiCreditApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        self.suffix = uuid.uuid4().hex[:10]
        self.admin = User(
            email=f"credits-admin-{self.suffix}@example.com",
            full_name="Credits Admin",
            password_hash="not-used",
            is_active=True,
        )
        self.member = User(
            email=f"credits-member-{self.suffix}@example.com",
            full_name="Credits Member",
            password_hash="not-used",
            is_active=True,
        )
        self.outsider = User(
            email=f"credits-outsider-{self.suffix}@example.com",
            full_name="Outsider",
            password_hash="not-used",
            is_active=True,
        )
        self.platform_admin = User(
            email=f"credits-platform-{self.suffix}@example.com",
            full_name="Platform Admin",
            password_hash="not-used",
            is_active=True,
            is_platform_admin=True,
        )
        self.extra_org_ids: list[uuid.UUID] = []
        self.extra_user_ids: list[uuid.UUID] = []
        self.db.add_all([self.admin, self.member, self.outsider, self.platform_admin])
        self.db.flush()
        self.organization = Organization(
            name=f"Wallet Org {self.suffix}",
            slug=f"wallet-org-{self.suffix}",
            owner_id=self.admin.id,
        )
        self.db.add(self.organization)
        self.db.flush()
        self.db.add_all(
            [
                OrgMember(
                    user_id=self.admin.id,
                    org_id=self.organization.id,
                    global_role=GlobalRole.ADMIN,
                    member_type=MemberType.INTERNAL,
                    invitation_status=InvitationStatus.ACCEPTED,
                ),
                OrgMember(
                    user_id=self.member.id,
                    org_id=self.organization.id,
                    global_role=GlobalRole.MEMBER,
                    member_type=MemberType.INTERNAL,
                    invitation_status=InvitationStatus.ACCEPTED,
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        org_id = self.organization.id
        user_ids = [self.admin.id, self.member.id, self.outsider.id, self.platform_admin.id]
        self.db.query(AiCreditLedgerEntry).filter(AiCreditLedgerEntry.organization_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgAiActionCost).filter(OrgAiActionCost.organization_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgAiCreditBalance).filter(OrgAiCreditBalance.organization_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgMember).filter(OrgMember.org_id == org_id).delete(synchronize_session=False)
        self.db.query(Organization).filter(Organization.id == org_id).delete(synchronize_session=False)
        for extra_org_id in self.extra_org_ids:
            self.db.query(AiCreditLedgerEntry).filter(AiCreditLedgerEntry.organization_id == extra_org_id).delete(synchronize_session=False)
            self.db.query(OrgAiActionCost).filter(OrgAiActionCost.organization_id == extra_org_id).delete(synchronize_session=False)
            self.db.query(OrgAiCreditBalance).filter(OrgAiCreditBalance.organization_id == extra_org_id).delete(synchronize_session=False)
            self.db.query(OrgMember).filter(OrgMember.org_id == extra_org_id).delete(synchronize_session=False)
            self.db.query(Organization).filter(Organization.id == extra_org_id).delete(synchronize_session=False)
        if self.extra_user_ids:
            self.db.query(User).filter(User.id.in_(self.extra_user_ids)).delete(synchronize_session=False)
        self.db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def auth_headers(self, user: User) -> dict[str, str]:
        token = auth_service.create_access_token({"sub": str(user.id)})
        return {"Authorization": f"Bearer {token}"}

    def wallet_url(self) -> str:
        return f"/api/v1/organizations/{self.organization.id}/ai-credits"

    def test_health_ignores_ai_credits(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_member_can_read_balance_but_cannot_top_up_or_read_ledger(self):
        read = self.client.get(self.wallet_url(), headers=self.auth_headers(self.member))
        self.assertEqual(read.status_code, 200)
        body = read.json()
        self.assertEqual(body["balance"], 0)
        self.assertIn(AI_SURVEY_INTERVIEW, body["can_spend"])
        self.assertFalse(body["can_spend"][AI_SURVEY_INTERVIEW])

        top_up = self.client.post(
            f"{self.wallet_url()}/top-ups",
            headers=self.auth_headers(self.member),
            json={"amount": 5, "note": "should fail"},
        )
        self.assertEqual(top_up.status_code, 403)

        ledger = self.client.get(f"{self.wallet_url()}/ledger", headers=self.auth_headers(self.member))
        self.assertEqual(ledger.status_code, 403)

        outsider = self.client.get(self.wallet_url(), headers=self.auth_headers(self.outsider))
        self.assertEqual(outsider.status_code, 403)

    def test_admin_manual_top_up_and_platform_admin_path(self):
        created = self.client.post(
            f"{self.wallet_url()}/top-ups",
            headers=self.auth_headers(self.admin),
            json={"amount": 2, "note": "invoice 14"},
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["balance"], 2)

        ledger = self.client.get(f"{self.wallet_url()}/ledger", headers=self.auth_headers(self.admin))
        self.assertEqual(ledger.status_code, 200)
        entries = ledger.json()["entries"]
        self.assertEqual(entries[0]["entry_type"], "top_up")
        self.assertEqual(entries[0]["amount"], 2)
        self.assertEqual(entries[0]["note"], "invoice 14")
        self.assertEqual(entries[0]["actor_name"], "Credits Admin")

        platform = self.client.post(
            f"{self.wallet_url()}/top-ups",
            headers=self.auth_headers(self.platform_admin),
            json={"amount": 1, "note": "platform adjustment"},
        )
        self.assertEqual(platform.status_code, 201)
        self.assertEqual(platform.json()["balance"], 3)

    def test_cross_org_admin_top_up_is_forbidden(self):
        other_admin = User(
            email=f"credits-other-admin-{self.suffix}@example.com",
            full_name="Other Org Admin",
            password_hash="not-used",
            is_active=True,
        )
        self.db.add(other_admin)
        self.db.flush()
        other_org = Organization(
            name=f"Other Wallet Org {self.suffix}",
            slug=f"other-wallet-org-{self.suffix}",
            owner_id=other_admin.id,
        )
        self.db.add(other_org)
        self.db.flush()
        self.db.add(
            OrgMember(
                user_id=other_admin.id,
                org_id=other_org.id,
                global_role=GlobalRole.ADMIN,
                member_type=MemberType.INTERNAL,
                invitation_status=InvitationStatus.ACCEPTED,
            )
        )
        self.db.commit()
        self.extra_org_ids.append(other_org.id)
        self.extra_user_ids.append(other_admin.id)

        response = self.client.post(
            f"{self.wallet_url()}/top-ups",
            headers=self.auth_headers(other_admin),
            json={"amount": 5, "note": "cross org"},
        )
        self.assertEqual(response.status_code, 403)
        wallet = self.client.get(self.wallet_url(), headers=self.auth_headers(self.admin))
        self.assertEqual(wallet.status_code, 200)
        self.assertEqual(wallet.json()["balance"], 0)

    def test_interview_blocks_at_zero_and_does_not_call_the_model(self):
        with patch("app.api.routes.ai_survey.ai_survey_service.generate_interview_questions") as mocked:
            response = self.client.post(
                "/api/v1/ai/survey/interview",
                headers=self.auth_headers(self.member),
                json={"brief": "Retail audit for Accra shops", "organization_id": str(self.organization.id)},
            )
        self.assertEqual(response.status_code, 402)
        detail = response.json()["detail"]
        self.assertEqual(detail["code"], "ai_credits_exhausted")
        self.assertEqual(detail["message"], AI_CREDITS_TOP_UP_MESSAGE)
        self.assertEqual(detail["balance"], 0)
        mocked.assert_not_called()

        wallet = self.client.get(self.wallet_url(), headers=self.auth_headers(self.admin))
        self.assertEqual(wallet.json()["balance"], 0)

    def test_interview_deducts_and_refunds_when_the_model_fails(self):
        self.client.post(
            f"{self.wallet_url()}/top-ups",
            headers=self.auth_headers(self.admin),
            json={"amount": 2},
        )
        with patch(
            "app.api.routes.ai_survey.ai_survey_service.generate_interview_questions",
            side_effect=AiSurveyServiceError("groq down"),
        ):
            failed = self.client.post(
                "/api/v1/ai/survey/interview",
                headers=self.auth_headers(self.member),
                json={"brief": "Retail audit for Accra shops", "organization_id": str(self.organization.id)},
            )
        self.assertEqual(failed.status_code, 400)
        wallet = self.client.get(self.wallet_url(), headers=self.auth_headers(self.admin))
        self.assertEqual(wallet.json()["balance"], 2)
        ledger = self.client.get(f"{self.wallet_url()}/ledger", headers=self.auth_headers(self.admin)).json()["entries"]
        types = {row["entry_type"] for row in ledger}
        self.assertIn("spend", types)
        self.assertIn("refund", types)

        with patch(
            "app.api.routes.ai_survey.ai_survey_service.generate_interview_questions",
            return_value=[{"id": "q1", "prompt": "Who answers?", "kind": "text"}],
        ):
            ok = self.client.post(
                "/api/v1/ai/survey/interview",
                headers=self.auth_headers(self.member),
                json={"brief": "Retail audit for Accra shops", "organization_id": str(self.organization.id)},
            )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["questions"][0]["id"], "q1")
        wallet = self.client.get(self.wallet_url(), headers=self.auth_headers(self.admin))
        self.assertEqual(wallet.json()["balance"], 1)

    def test_configurable_draft_cost_blocks_without_stopping_other_routes(self):
        self.client.post(
            f"{self.wallet_url()}/top-ups",
            headers=self.auth_headers(self.admin),
            json={"amount": 2},
        )
        updated = self.client.patch(
            f"{self.wallet_url()}/action-costs/{AI_SURVEY_DRAFT}",
            headers=self.auth_headers(self.admin),
            json={"credit_cost": 5},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["credit_cost"], 5)

        member_cost = self.client.patch(
            f"{self.wallet_url()}/action-costs/{AI_SURVEY_DRAFT}",
            headers=self.auth_headers(self.member),
            json={"credit_cost": 1},
        )
        self.assertEqual(member_cost.status_code, 403)

        with patch("app.api.routes.ai_survey.ai_survey_service.draft_survey_markdown") as mocked:
            blocked = self.client.post(
                "/api/v1/ai/survey/draft",
                headers=self.auth_headers(self.member),
                json={
                    "brief": "Retail audit for Accra shops",
                    "organization_id": str(self.organization.id),
                },
            )
        self.assertEqual(blocked.status_code, 402)
        self.assertEqual(blocked.json()["detail"]["required"], 5)
        mocked.assert_not_called()

        with patch(
            "app.api.routes.ai_survey.ai_survey_service.revise_survey_markdown",
            return_value="# Kept\n",
        ):
            revised = self.client.post(
                "/api/v1/ai/survey/revise",
                headers=self.auth_headers(self.member),
                json={
                    "markdown": "# Kept\n",
                    "instruction": "Leave it",
                    "organization_id": str(self.organization.id),
                },
            )
        self.assertEqual(revised.status_code, 200)

        compile_response = self.client.post(
            "/api/v1/ai/survey/compile",
            headers=self.auth_headers(self.member),
            json={"markdown": "not a survey"},
        )
        self.assertNotEqual(compile_response.status_code, 402)
        health = self.client.get("/health")
        self.assertEqual(health.status_code, 200)

        wallet = self.client.get(self.wallet_url(), headers=self.auth_headers(self.admin)).json()
        self.assertEqual(wallet["balance"], 1)
        self.assertFalse(wallet["can_spend"][AI_SURVEY_DRAFT])
        self.assertTrue(wallet["can_spend"][AI_SURVEY_REVISE])


if __name__ == "__main__":
    unittest.main()
