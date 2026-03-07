import unittest
import uuid

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.form import Form, FormStatus
from app.models.form_version import FormVersion
from app.models.org_member import GlobalRole, InvitationStatus, OrgMember
from app.models.organization import Organization
from app.models.project import Project, ProjectStatus
from app.models.project_access import AccessorType, ProjectAccess, ProjectRole
from app.models.project_report import ProjectReport
from app.models.project_role_template import ProjectRoleTemplate
from app.models.project_task import ProjectTask, ProjectTaskStatus
from app.models.role_template import OrgRole, OrgRoleAssignment, AccessorType as RoleAccessorType
from app.models.submission import Submission
from app.models.user import User
from app.services.auth_service import auth_service
from app.services.form_service import ProjectService
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

        self.db.query(Submission).filter(Submission.form_id.in_(
            self.db.query(Form.id).filter(Form.project_id.in_(project_ids))
        )).delete(synchronize_session=False)
        self.db.query(FormVersion).filter(FormVersion.form_id.in_(
            self.db.query(Form.id).filter(Form.project_id.in_(project_ids))
        )).delete(synchronize_session=False)
        self.db.query(Form).filter(Form.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(ProjectReport).filter(ProjectReport.project_id.in_(project_ids)).delete(synchronize_session=False)
        self.db.query(ProjectTask).filter(ProjectTask.project_id.in_(project_ids)).delete(synchronize_session=False)
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


if __name__ == "__main__":
    unittest.main()