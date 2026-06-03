import unittest
import uuid
from datetime import date

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.form import Form, FormStatus
from app.models.form_dataset import FormDataset, FormDatasetField, FormDatasetSchemaVersion
from app.models.form_version import FormVersion
from app.models.org_member import GlobalRole, InvitationStatus, OrgMember
from app.models.organization import Organization
from app.models.project import Project, ProjectStatus
from app.models.project_access import AccessorType, ProjectAccess, ProjectRole
from app.models.project_asset import ProjectAsset, ProjectAssetKind
from app.models.project_report import ProjectReport
from app.models.project_role_template import ProjectRoleTemplate
from app.models.project_thread import ProjectThread
from app.models.project_task import ProjectTask, ProjectTaskKind, ProjectTaskStatus
from app.models.role_template import OrgRole, OrgRoleAssignment, AccessorType as RoleAccessorType
from app.models.submission import Submission, SubmissionReviewStatus
from app.models.user import User
from app.services.auth_service import auth_service
from app.services.form_service import FormService, ProjectService
from app.services.organization_service import OrganizationService
from app.services.project_role_service import ProjectRoleService


class ProjectWorkspaceApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        self.suffix = uuid.uuid4().hex[:10]

        self.admin_user = User(
            email=f"admin-{self.suffix}@example.com",
            full_name="Workspace Admin",
            password_hash="not-used",
            is_active=True,
        )
        self.member_user = User(
            email=f"member-{self.suffix}@example.com",
            full_name="Workspace Member",
            password_hash="not-used",
            is_active=True,
        )
        self.db.add_all([self.admin_user, self.member_user])
        self.db.flush()

        self.organization = Organization(
            name=f"Workspace Org {self.suffix}",
            slug=f"workspace-org-{self.suffix}",
            owner_id=self.admin_user.id,
        )
        self.db.add(self.organization)
        self.db.flush()

        self.db.add_all(
            [
                OrgMember(
                    user_id=self.admin_user.id,
                    org_id=self.organization.id,
                    global_role=GlobalRole.ADMIN,
                    invitation_status=InvitationStatus.ACCEPTED,
                ),
                OrgMember(
                    user_id=self.member_user.id,
                    org_id=self.organization.id,
                    global_role=GlobalRole.MEMBER,
                    invitation_status=InvitationStatus.ACCEPTED,
                    invited_by=self.admin_user.id,
                ),
            ]
        )

        self.open_project = Project(
            org_id=self.organization.id,
            name=f"Open Project {self.suffix}",
            description="Visible to org members when no access rules exist.",
            status=ProjectStatus.ACTIVE,
        )
        self.db.add(self.open_project)
        self.db.flush()

        self.restricted_project = ProjectService.create_project(
            self.db,
            org_id=self.organization.id,
            name=f"Restricted Project {self.suffix}",
            description="Visible only through explicit access rules.",
            created_by=self.admin_user.id,
        )

        self.paused_project = ProjectService.create_project(
            self.db,
            org_id=self.organization.id,
            name=f"Paused Project {self.suffix}",
            description="Used to verify runtime and public blocking.",
            created_by=self.admin_user.id,
        )
        self.paused_project.status = ProjectStatus.PAUSED
        self.db.flush()

        self.private_live_form = Form(
            project_id=self.paused_project.id,
            title=f"Private Runtime Form {self.suffix}",
            slug=f"private-runtime-form-{self.suffix}",
            blueprint_draft={"meta": {"title": "Private Runtime Form"}},
            blueprint_live={"meta": {"title": "Private Runtime Form"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=False,
        )
        self.public_live_form = Form(
            project_id=self.paused_project.id,
            title=f"Public Runtime Form {self.suffix}",
            slug=f"public-runtime-form-{self.suffix}",
            blueprint_draft={"meta": {"title": "Public Runtime Form"}},
            blueprint_live={"meta": {"title": "Public Runtime Form"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=True,
        )
        self.db.add_all([self.private_live_form, self.public_live_form])
        self.db.commit()

        self.field_personnel_role = OrganizationService.create_role(
            self.db,
            self.organization.id,
            name=f"Field Personnel {self.suffix}",
            description="Can submit and view forms.",
            permissions=["project.view", "form.view", "submission.create", "submission.view_own"],
            priority=40,
        )
        self.analyst_role = OrganizationService.create_role(
            self.db,
            self.organization.id,
            name=f"Analyst {self.suffix}",
            description="Can create and publish forms.",
            permissions=["project.view", "form.view", "form.create", "form.edit", "form.publish"],
            priority=75,
        )
        self.db.add(
            OrgRoleAssignment(
                org_id=self.organization.id,
                role_id=self.analyst_role.id,
                accessor_id=self.admin_user.id,
                accessor_type=RoleAccessorType.USER,
                assigned_by=self.admin_user.id,
            )
        )
        self.db.commit()

    def tearDown(self):
        project_ids = [self.open_project.id, self.restricted_project.id, self.paused_project.id]
        org_id = self.organization.id
        user_ids = [self.admin_user.id, self.member_user.id]
        form_ids = self.db.query(Form.id).filter(Form.project_id.in_(project_ids))
        dataset_ids = self.db.query(FormDataset.id).filter(FormDataset.form_id.in_(form_ids))

        self.db.query(ProjectTask).filter(ProjectTask.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(Submission).filter(Submission.form_id.in_(
            form_ids
        )).delete(synchronize_session=False)
        self.db.query(FormDatasetField).filter(FormDatasetField.dataset_id.in_(dataset_ids)).delete(synchronize_session=False)
        self.db.query(FormDatasetSchemaVersion).filter(FormDatasetSchemaVersion.dataset_id.in_(dataset_ids)).delete(synchronize_session=False)
        self.db.query(FormDataset).filter(FormDataset.form_id.in_(form_ids)).delete(synchronize_session=False)
        self.db.query(FormVersion).filter(FormVersion.form_id.in_(
            form_ids
        )).delete(synchronize_session=False)
        self.db.query(Form).filter(Form.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(ProjectAsset).filter(ProjectAsset.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(ProjectReport).filter(ProjectReport.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(ProjectThread).filter(ProjectThread.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(ProjectAccess).filter(ProjectAccess.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(ProjectRoleTemplate).filter(ProjectRoleTemplate.org_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgRoleAssignment).filter(OrgRoleAssignment.org_id == org_id).delete(synchronize_session=False)
        self.db.query(OrgRole).filter(OrgRole.org_id == org_id).delete(synchronize_session=False)
        self.db.query(Project).filter(Project.id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(OrgMember).filter(OrgMember.org_id == org_id).delete(synchronize_session=False)
        self.db.query(Organization).filter(Organization.id == org_id).delete(synchronize_session=False)
        self.db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def auth_headers(self, user: User) -> dict[str, str]:
        token = auth_service.create_access_token({"sub": str(user.id)})
        return {"Authorization": f"Bearer {token}"}

    def test_member_list_hides_projects_with_explicit_access_rules(self):
        response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(response.status_code, 200)
        project_names = {item["name"] for item in response.json()}

        self.assertIn(self.open_project.name, project_names)
        self.assertNotIn(self.restricted_project.name, project_names)
        self.assertNotIn(self.paused_project.name, project_names)

    def test_runtime_form_returns_409_when_parent_project_is_not_active(self):
        response = self.client.get(
            f"/api/v1/forms/{self.private_live_form.id}/runtime",
            headers=self.auth_headers(self.admin_user),
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "Project is not active")

    def test_public_form_is_hidden_when_parent_project_is_not_active(self):
        response = self.client.get(f"/api/v1/public/forms/{self.public_live_form.slug}")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Form not found or not public")

    def test_member_with_submission_permission_can_submit_authenticated_data(self):
        self.db.add(
            OrgRoleAssignment(
                org_id=self.organization.id,
                role_id=self.field_personnel_role.id,
                accessor_id=self.member_user.id,
                accessor_type=RoleAccessorType.USER,
                assigned_by=self.admin_user.id,
            )
        )
        self.db.commit()

        form = Form(
            project_id=self.open_project.id,
            title=f"Collector Form {self.suffix}",
            slug=f"collector-form-{self.suffix}",
            blueprint_draft={"meta": {"title": "Collector Form"}},
            blueprint_live={"meta": {"title": "Collector Form"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=False,
        )
        self.db.add(form)
        self.db.commit()

        response = self.client.post(
            "/api/v1/submissions",
            headers=self.auth_headers(self.member_user),
            json={"form_id": str(form.id), "data": {"q1": "yes"}, "metadata": {}},
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["review_status"], SubmissionReviewStatus.SUBMITTED.value)

    def test_member_without_form_create_permission_cannot_create_form(self):
        response = self.client.post(
            f"/api/v1/projects/{self.open_project.id}/forms",
            headers=self.auth_headers(self.member_user),
            json={"title": "Blocked Form", "blueprint": {"meta": {"title": "Blocked Form"}}},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Form creation permission is required for this project")

    def test_role_template_list_includes_assignment_count(self):
        ProjectRoleService.ensure_default_roles(self.db, self.organization.id)
        field_personnel_role = (
            self.db.query(ProjectRoleTemplate)
            .filter(
                ProjectRoleTemplate.org_id == self.organization.id,
                ProjectRoleTemplate.slug == "field-personnel",
            )
            .first()
        )
        self.assertIsNotNone(field_personnel_role)

        self.db.add(
            ProjectAccess(
                project_id=self.open_project.id,
                accessor_id=self.member_user.id,
                accessor_type=AccessorType.USER,
                role=ProjectRole.COLLECTOR,
                role_template_id=field_personnel_role.id,
            )
        )
        self.db.commit()

        response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/role-templates",
            headers=self.auth_headers(self.admin_user),
        )

        self.assertEqual(response.status_code, 200)
        templates = {item["slug"]: item for item in response.json()}
        self.assertIn("field-personnel", templates)
        self.assertEqual(templates["field-personnel"]["assignment_count"], 1)

    def test_admin_can_create_and_list_project_tasks(self):
        response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/tasks",
            headers=self.auth_headers(self.admin_user),
            json={
                "title": "Kickoff briefing",
                "description": "Prepare the field kickoff checklist.",
                "assigned_accessor_id": str(self.member_user.id),
                "assigned_accessor_type": "user",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["title"], "Kickoff briefing")
        self.assertEqual(payload["status"], ProjectTaskStatus.TODO.value)

        list_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/tasks",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

    def test_admin_can_create_journey_visit_task_linked_to_submission(self):
        form = Form(
            project_id=self.open_project.id,
            title=f"Recruitment Form {self.suffix}",
            slug=f"recruitment-form-{self.suffix}",
            blueprint_draft={"meta": {"title": "Recruitment Form"}},
            blueprint_live={"meta": {"title": "Recruitment Form"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=False,
        )
        self.db.add(form)
        self.db.flush()

        submission = Submission(
            form_id=form.id,
            user_id=self.admin_user.id,
            data={"store_name": "Makola Central"},
            metadata_json={"source": "test"},
            form_version_number=1,
        )
        self.db.add(submission)
        self.db.commit()

        response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/tasks",
            headers=self.auth_headers(self.admin_user),
            json={
                "title": "Visit Makola Central",
                "kind": "journey_visit",
                "visit_date": "2026-05-23",
                "source_submission_id": str(submission.id),
                "context_json": {
                    "source_record_label": "Makola Central",
                    "region": "Greater Accra",
                    "routing": {"cluster": "A1"},
                },
                "assigned_accessor_id": str(self.member_user.id),
                "assigned_accessor_type": "user",
            },
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["kind"], "journey_visit")
        self.assertEqual(payload["visit_date"], "2026-05-23")
        self.assertEqual(payload["source_submission_id"], str(submission.id))
        self.assertEqual(payload["context_json"]["source_record_label"], "Makola Central")
        self.assertEqual(payload["context_json"]["routing"]["cluster"], "A1")

    def test_member_can_list_only_their_tasks_for_a_day(self):
        today_task = ProjectTask(
            project_id=self.open_project.id,
            title=f"Visit Kaneshie {self.suffix}",
            kind=ProjectTaskKind.JOURNEY_VISIT,
            visit_date=date(2026, 5, 23),
            assigned_accessor_id=self.member_user.id,
            assigned_accessor_type=AccessorType.USER,
            created_by=self.admin_user.id,
        )
        other_day_task = ProjectTask(
            project_id=self.open_project.id,
            title=f"Visit Makola {self.suffix}",
            kind=ProjectTaskKind.JOURNEY_VISIT,
            visit_date=date(2026, 5, 24),
            assigned_accessor_id=self.member_user.id,
            assigned_accessor_type=AccessorType.USER,
            created_by=self.admin_user.id,
        )
        other_user_task = ProjectTask(
            project_id=self.open_project.id,
            title=f"Visit Kejetia {self.suffix}",
            kind=ProjectTaskKind.JOURNEY_VISIT,
            visit_date=date(2026, 5, 23),
            assigned_accessor_id=self.admin_user.id,
            assigned_accessor_type=AccessorType.USER,
            created_by=self.admin_user.id,
        )
        self.db.add_all([today_task, other_day_task, other_user_task])
        self.db.commit()

        response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/tasks/my-day?date=2026-05-23",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], str(today_task.id))
        self.assertEqual(payload[0]["kind"], "journey_visit")

    def test_member_can_check_in_and_out_for_project_attendance(self):
        check_in_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/attendance/check-in",
            headers=self.auth_headers(self.member_user),
            json={
                "timestamp": "2026-05-25T08:15:00",
                "location": {"latitude": 5.6037, "longitude": -0.1870, "accuracy_meters": 12.5, "label": "Osu Base"},
                "note": "Morning roll call",
                "signature": "K. Mensah",
            },
        )

        self.assertEqual(check_in_response.status_code, 201)
        checked_in = check_in_response.json()
        self.assertEqual(checked_in["status"], "checked_in")
        self.assertEqual(checked_in["check_in_location_json"]["label"], "Osu Base")
        self.assertEqual(checked_in["check_in_signature"], "K. Mensah")

        check_out_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/attendance/check-out",
            headers=self.auth_headers(self.member_user),
            json={
                "timestamp": "2026-05-25T17:30:00",
                "location": {"latitude": 5.6071, "longitude": -0.1901, "accuracy_meters": 8.0, "label": "Osu Debrief"},
                "note": "Day complete",
            },
        )

        self.assertEqual(check_out_response.status_code, 200)
        checked_out = check_out_response.json()
        self.assertEqual(checked_out["status"], "checked_out")
        self.assertEqual(checked_out["check_out_location_json"]["label"], "Osu Debrief")
        self.assertEqual(checked_out["check_out_note"], "Day complete")

    def test_admin_can_list_project_attendance_for_day(self):
        self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/attendance/check-in",
            headers=self.auth_headers(self.member_user),
            json={
                "timestamp": "2026-05-25T08:00:00",
                "location": {"latitude": 5.6037, "longitude": -0.1870, "label": "Field Hub"},
            },
        )

        response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/attendance?date=2026-05-25",
            headers=self.auth_headers(self.admin_user),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["user_id"], str(self.member_user.id))
        self.assertEqual(payload[0]["status"], "checked_in")

    def test_admin_can_list_and_review_form_submissions(self):
        form = Form(
            project_id=self.open_project.id,
            title=f"Review Form {self.suffix}",
            slug=f"review-form-{self.suffix}",
            blueprint_draft={"meta": {"title": "Review Form"}},
            blueprint_live={"meta": {"title": "Review Form"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=False,
        )
        self.db.add(form)
        self.db.commit()

        create_response = self.client.post(
            "/api/v1/submissions",
            headers=self.auth_headers(self.admin_user),
            json={"form_id": str(form.id), "data": {"amount": 120}, "metadata": {"source": "test"}},
        )

        self.assertEqual(create_response.status_code, 201)
        submission_id = create_response.json()["id"]

        list_response = self.client.get(
            f"/api/v1/forms/{form.id}/submissions?review_status=submitted",
            headers=self.auth_headers(self.admin_user),
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)
        self.assertEqual(list_response.json()[0]["review_status"], SubmissionReviewStatus.SUBMITTED.value)

        review_response = self.client.patch(
            f"/api/v1/submissions/{submission_id}/review",
            headers=self.auth_headers(self.admin_user),
            json={"review_status": "approved", "review_comment": "Validated for workflow routing."},
        )

        self.assertEqual(review_response.status_code, 200)
        reviewed = review_response.json()
        self.assertEqual(reviewed["review_status"], SubmissionReviewStatus.APPROVED.value)
        self.assertEqual(reviewed["review_comment"], "Validated for workflow routing.")
        self.assertEqual(reviewed["reviewed_by"], str(self.admin_user.id))
        self.assertIsNotNone(reviewed["reviewed_at"])

    def test_member_without_review_permission_cannot_review_submission(self):
        form = Form(
            project_id=self.open_project.id,
            title=f"Restricted Review Form {self.suffix}",
            slug=f"restricted-review-form-{self.suffix}",
            blueprint_draft={"meta": {"title": "Restricted Review Form"}},
            blueprint_live={"meta": {"title": "Restricted Review Form"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=False,
        )
        self.db.add(form)
        self.db.flush()

        submission = Submission(
            form_id=form.id,
            user_id=self.admin_user.id,
            data={"expense_type": "transport", "amount": 32},
            metadata_json={"source": "seed"},
            form_version_number=1,
            review_status=SubmissionReviewStatus.SUBMITTED,
        )
        self.db.add(submission)
        self.db.commit()

        response = self.client.patch(
            f"/api/v1/submissions/{submission.id}/review",
            headers=self.auth_headers(self.member_user),
            json={"review_status": "rejected", "review_comment": "Not authorized."},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Submission review permission is required for this project")

    def test_approved_submission_can_trigger_generic_task_automation(self):
        form = Form(
            project_id=self.open_project.id,
            title=f"Shared Expense Intake {self.suffix}",
            slug=f"shared-expense-intake-{self.suffix}",
            blueprint_draft={"meta": {"title": "Shared Expense Intake"}},
            blueprint_live={"meta": {"title": "Shared Expense Intake"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=False,
        )
        self.db.add(form)
        self.db.commit()

        create_rule = self.client.post(
            f"/api/v1/forms/{form.id}/automation-rules",
            headers=self.auth_headers(self.admin_user),
            json={
                "name": "Create settlement task",
                "description": "Create a follow-up task for approved transport charges.",
                "event_type": "submission_approved",
                "action_type": "create_task",
                "conditions_json": {
                    "combinator": "and",
                    "rules": [
                        {"field": "charge_type", "operator": "equal", "value": "transport"},
                        {"field": "amount", "operator": ">", "value": 30}
                    ]
                },
                "action_config_json": {
                    "title_template": "Settle {{ data.charge_type }} for {{ data.roommate_name }}",
                    "description_template": "Approved amount: {{ data.amount }}",
                    "kind": "general"
                }
            },
        )

        self.assertEqual(create_rule.status_code, 201)
        rule_id = create_rule.json()["id"]

        submission_response = self.client.post(
            "/api/v1/submissions",
            headers=self.auth_headers(self.admin_user),
            json={
                "form_id": str(form.id),
                "data": {"roommate_name": "Kojo", "charge_type": "transport", "amount": 45},
                "metadata": {"source": "test"},
            },
        )
        self.assertEqual(submission_response.status_code, 201)

        submission_id = submission_response.json()["id"]
        review_response = self.client.patch(
            f"/api/v1/submissions/{submission_id}/review",
            headers=self.auth_headers(self.admin_user),
            json={"review_status": "approved", "review_comment": "Approved for settlement."},
        )
        self.assertEqual(review_response.status_code, 200)

        task_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/tasks",
            headers=self.auth_headers(self.admin_user),
        )
        self.assertEqual(task_response.status_code, 200)

        matching_tasks = [task for task in task_response.json() if task["title"] == "Settle transport for Kojo"]
        self.assertEqual(len(matching_tasks), 1)
        self.assertEqual(matching_tasks[0]["description"], "Approved amount: 45")
        self.assertEqual(matching_tasks[0]["source_submission_id"], submission_id)
        self.assertEqual(matching_tasks[0]["automation_rule_id"], rule_id)

    def test_approved_submission_automation_can_map_task_context(self):
        form = Form(
            project_id=self.open_project.id,
            title=f"Assignment Intake {self.suffix}",
            slug=f"assignment-intake-{self.suffix}",
            blueprint_draft={"meta": {"title": "Assignment Intake"}},
            blueprint_live={"meta": {"title": "Assignment Intake"}, "ui": []},
            version=1,
            published_version=1,
            status=FormStatus.LIVE,
            is_public=False,
        )
        self.db.add(form)
        self.db.commit()

        create_rule = self.client.post(
            f"/api/v1/forms/{form.id}/automation-rules",
            headers=self.auth_headers(self.admin_user),
            json={
                "name": "Create routed task",
                "description": "Capture source context on automated tasks.",
                "event_type": "submission_approved",
                "action_type": "create_task",
                "conditions_json": None,
                "action_config_json": {
                    "title_template": "Visit {{ data.outlet_name }}",
                    "description_template": "Review {{ data.outlet_name }} in {{ data.region }}",
                    "kind": "journey_visit",
                    "visit_date_value": "2026-06-03",
                    "context_mapping_json": {
                        "source_record_label": "data.outlet_name",
                        "location_label": "{{ data.region }} cluster",
                        "routing.cluster": "data.cluster",
                        "review.review_status": "submission.review_status"
                    }
                }
            },
        )

        self.assertEqual(create_rule.status_code, 201)

        submission_response = self.client.post(
            "/api/v1/submissions",
            headers=self.auth_headers(self.admin_user),
            json={
                "form_id": str(form.id),
                "data": {
                    "outlet_name": "Osu Shop 4",
                    "region": "Accra",
                    "cluster": "South Coast",
                },
                "metadata": {"source": "test"},
            },
        )
        self.assertEqual(submission_response.status_code, 201)

        submission_id = submission_response.json()["id"]
        review_response = self.client.patch(
            f"/api/v1/submissions/{submission_id}/review",
            headers=self.auth_headers(self.admin_user),
            json={"review_status": "approved", "review_comment": "Ready for fieldwork."},
        )
        self.assertEqual(review_response.status_code, 200)

        task_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/tasks",
            headers=self.auth_headers(self.admin_user),
        )
        self.assertEqual(task_response.status_code, 200)

        matching_tasks = [task for task in task_response.json() if task["title"] == "Visit Osu Shop 4"]
        self.assertEqual(len(matching_tasks), 1)
        self.assertEqual(matching_tasks[0]["source_submission_id"], submission_id)
        self.assertEqual(matching_tasks[0]["context_json"]["source_record_label"], "Osu Shop 4")
        self.assertEqual(matching_tasks[0]["context_json"]["location_label"], "Accra cluster")
        self.assertEqual(matching_tasks[0]["context_json"]["routing"]["cluster"], "South Coast")
        self.assertEqual(matching_tasks[0]["context_json"]["review"]["review_status"], "approved")

    def test_admin_can_view_form_dataset_details(self):
        form = FormService.create_form(
            self.db,
            project_id=self.open_project.id,
            title=f"Dataset Form {self.suffix}",
            blueprint={
                "meta": {"title": "Dataset Form"},
                "schema": [
                    {"key": "customer_name", "type": "string", "required": True},
                    {"key": "region", "type": "string", "required": False},
                ],
                "ui": [
                    {
                        "id": "screen_1",
                        "type": "screen",
                        "title": "Section 1",
                        "children": [
                            {"type": "input_text", "bind": "customer_name", "label": "Customer Name", "required": True},
                            {"type": "input_text", "bind": "region", "label": "Region", "required": False},
                        ],
                    }
                ],
                "logic": [],
            },
        )
        FormService.publish_form(self.db, form.id, published_by=self.admin_user.id)

        response = self.client.get(
            f"/api/v1/forms/{form.id}/dataset",
            headers=self.auth_headers(self.admin_user),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["form_id"], str(form.id))
        self.assertEqual(payload["current_schema_version_number"], 1)
        self.assertEqual(len(payload["fields"]), 2)
        self.assertEqual(payload["fields"][0]["field_identifier"], "customer_name")
        self.assertEqual(len(payload["schema_versions"]), 1)

    def test_assigned_member_can_update_task_status(self):
        task = ProjectTask(
            project_id=self.open_project.id,
            title=f"Assigned Task {self.suffix}",
            assigned_accessor_id=self.member_user.id,
            assigned_accessor_type=AccessorType.USER,
            created_by=self.admin_user.id,
        )
        self.db.add(task)
        self.db.commit()

        response = self.client.patch(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/tasks/{task.id}",
            headers=self.auth_headers(self.member_user),
            json={"status": "done"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], ProjectTaskStatus.DONE.value)
        self.assertIsNotNone(payload["completed_at"])

    def test_admin_can_update_form_responsibility(self):
        form = Form(
            project_id=self.open_project.id,
            title=f"Responsibility Form {self.suffix}",
            slug=f"responsibility-form-{self.suffix}",
            blueprint_draft={"meta": {"title": "Responsibility Form"}},
            version=0,
            status=FormStatus.DRAFT,
            is_public=False,
        )
        self.db.add(form)
        self.db.commit()

        response = self.client.put(
            f"/api/v1/forms/{form.id}/responsibility",
            headers=self.auth_headers(self.admin_user),
            json={
                "lead_accessor_id": str(self.admin_user.id),
                "lead_accessor_type": "user",
                "assigned_accessor_id": str(self.member_user.id),
                "assigned_accessor_type": "user",
                "guest_accessor_id": str(self.member_user.id),
                "guest_accessor_type": "user",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["lead_accessor_id"], str(self.admin_user.id))
        self.assertEqual(payload["assigned_accessor_id"], str(self.member_user.id))
        self.assertEqual(payload["guest_accessor_id"], str(self.member_user.id))

    def test_admin_can_create_update_and_list_project_reports(self):
        create_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/reports",
            headers=self.auth_headers(self.admin_user),
            json={
                "title": "Field Readout",
                "description": "Summary of field activity.",
                "content": [{"id": "summary", "type": "narrative", "label": "Executive Summary", "content": "Launch overview"}],
            },
        )

        self.assertEqual(create_response.status_code, 201)
        created = create_response.json()
        self.assertEqual(created["title"], "Field Readout")
        self.assertEqual(created["status"], "draft")
        self.assertEqual(created["content"][0]["label"], "Executive Summary")

        update_response = self.client.patch(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/reports/{created['id']}",
            headers=self.auth_headers(self.admin_user),
            json={
                "content": [{"id": "summary", "type": "narrative", "label": "Executive Summary", "content": "Published report body"}],
                "status": "published",
                "lead_accessor_id": str(self.admin_user.id),
                "lead_accessor_type": "user",
                "assigned_accessor_id": str(self.member_user.id),
                "assigned_accessor_type": "user",
                "guest_accessor_id": str(self.member_user.id),
                "guest_accessor_type": "user",
            },
        )

        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["status"], "published")
        self.assertEqual(updated["content"][0]["content"], "Published report body")
        self.assertEqual(updated["lead_accessor_id"], str(self.admin_user.id))
        self.assertEqual(updated["assigned_accessor_id"], str(self.member_user.id))
        self.assertEqual(updated["guest_accessor_id"], str(self.member_user.id))

        list_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/reports",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

        detail_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/reports/{created['id']}",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["id"], created["id"])
        self.assertEqual(detail_response.json()["content"][0]["content"], "Published report body")

    def test_admin_can_create_update_and_list_project_assets(self):
        create_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/assets",
            headers=self.auth_headers(self.admin_user),
            json={
                "title": "Field briefing deck",
                "kind": "document",
                "summary": "Launch support deck for field supervisors.",
                "source_url": "https://example.com/briefing",
            },
        )

        self.assertEqual(create_response.status_code, 201)
        created = create_response.json()
        self.assertEqual(created["title"], "Field briefing deck")
        self.assertEqual(created["kind"], ProjectAssetKind.DOCUMENT.value)

        update_response = self.client.patch(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/assets/{created['id']}",
            headers=self.auth_headers(self.admin_user),
            json={
                "kind": "audio",
                "summary": "Updated asset summary for briefing playback.",
            },
        )

        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["kind"], ProjectAssetKind.AUDIO.value)
        self.assertEqual(updated["summary"], "Updated asset summary for briefing playback.")

        list_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/assets",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

        detail_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/assets/{created['id']}",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["id"], created["id"])

    def test_admin_can_create_update_and_list_project_threads(self):
        create_response = self.client.post(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/threads",
            headers=self.auth_headers(self.admin_user),
            json={
                "title": "Launch thread",
                "summary": "Operational launch notices and escalations.",
                "reply_count": 4,
            },
        )

        self.assertEqual(create_response.status_code, 201)
        created = create_response.json()
        self.assertEqual(created["title"], "Launch thread")
        self.assertEqual(created["reply_count"], 4)

        update_response = self.client.patch(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/threads/{created['id']}",
            headers=self.auth_headers(self.admin_user),
            json={
                "summary": "Pinned notices and follow-up actions.",
                "reply_count": 6,
            },
        )

        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["summary"], "Pinned notices and follow-up actions.")
        self.assertEqual(updated["reply_count"], 6)

        list_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/threads",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.json()), 1)

        detail_response = self.client.get(
            f"/api/v1/organizations/{self.organization.id}/projects/{self.open_project.id}/threads/{created['id']}",
            headers=self.auth_headers(self.member_user),
        )

        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["id"], created["id"])


if __name__ == "__main__":
    unittest.main()