import unittest
import uuid

from app.core.database import SessionLocal
from app.main import app
from app.models.form import Form
from app.models.form_dataset import FormDataset, FormDatasetField, FormDatasetFieldStatus, FormDatasetSchemaVersion
from app.models.form_version import FormVersion
from app.models.org_member import GlobalRole, InvitationStatus, OrgMember
from app.models.organization import Organization
from app.models.project import Project, ProjectStatus
from app.models.submission import Submission
from app.models.user import User
from fastapi.testclient import TestClient
from app.services.form_service import FormService
from app.services.submission_service import SubmissionService


class FormDatasetFlowTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.client = TestClient(app)
        self.suffix = uuid.uuid4().hex[:10]

        self.user = User(
            email=f"dataset-admin-{self.suffix}@example.com",
            full_name="Dataset Admin",
            password_hash="unused",
            is_active=True,
        )
        self.db.add(self.user)
        self.db.flush()

        self.organization = Organization(
            name=f"Dataset Org {self.suffix}",
            slug=f"dataset-org-{self.suffix}",
            owner_id=self.user.id,
        )
        self.db.add(self.organization)
        self.db.flush()

        self.db.add(
            OrgMember(
                user_id=self.user.id,
                org_id=self.organization.id,
                global_role=GlobalRole.ADMIN,
                invitation_status=InvitationStatus.ACCEPTED,
            )
        )

        self.project = Project(
            org_id=self.organization.id,
            name=f"Dataset Project {self.suffix}",
            description="Dataset publishing tests",
            status=ProjectStatus.ACTIVE,
        )
        self.db.add(self.project)
        self.db.commit()
        self.user_id = self.user.id
        self.org_id = self.organization.id
        self.project_id = self.project.id

    def tearDown(self):
        self.db.rollback()
        project_id = self.project_id
        org_id = self.org_id
        user_id = self.user_id

        self.db.query(Submission).filter(
            Submission.form_id.in_(self.db.query(Form.id).filter(Form.project_id == project_id))
        ).delete(synchronize_session=False)
        self.db.query(FormDatasetField).filter(
            FormDatasetField.dataset_id.in_(self.db.query(FormDataset.id).filter(FormDataset.form_id.in_(self.db.query(Form.id).filter(Form.project_id == project_id))))
        ).delete(synchronize_session=False)
        self.db.query(FormDatasetSchemaVersion).filter(
            FormDatasetSchemaVersion.dataset_id.in_(self.db.query(FormDataset.id).filter(FormDataset.form_id.in_(self.db.query(Form.id).filter(Form.project_id == project_id))))
        ).delete(synchronize_session=False)
        self.db.query(FormDataset).filter(
            FormDataset.form_id.in_(self.db.query(Form.id).filter(Form.project_id == project_id))
        ).delete(synchronize_session=False)
        self.db.query(FormVersion).filter(
            FormVersion.form_id.in_(self.db.query(Form.id).filter(Form.project_id == project_id))
        ).delete(synchronize_session=False)
        self.db.query(Form).filter(Form.project_id == project_id).delete(synchronize_session=False)
        self.db.query(Project).filter(Project.id == project_id).delete(synchronize_session=False)
        self.db.query(OrgMember).filter(OrgMember.org_id == org_id).delete(synchronize_session=False)
        self.db.query(Organization).filter(Organization.id == org_id).delete(synchronize_session=False)
        self.db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def _draft_blueprint_v1(self):
        return {
            "meta": {"title": "Customer Survey"},
            "schema": [
                {"id": "q_customer_name", "key": "customer_name", "type": "string", "label": "Customer Name"},
                {"id": "q_region", "key": "region", "type": "string", "label": "Region"},
                {"id": "q_satisfaction", "key": "satisfaction", "type": "select", "label": "Satisfaction", "options": ["good", "bad"]},
                {"id": "q_comments", "key": "comments", "type": "string", "label": "Comments"},
            ],
            "ui": [],
        }

    def _draft_blueprint_v2(self):
        return {
            "meta": {"title": "Customer Survey"},
            "schema": [
                {"id": "q_customer_name", "key": "customer_name", "type": "string", "label": "Customer Name"},
                {"id": "q_region", "key": "region", "type": "string", "label": "Region"},
                {
                    "id": "q_satisfaction",
                    "key": "satisfaction",
                    "type": "select",
                    "label": "Satisfaction",
                    "options": ["good", "bad", "neutral", "excellent"],
                },
                {"id": "q_followup_consent", "key": "followup_consent", "type": "boolean", "label": "Follow Up Consent"},
                {"id": "q_sales_notes", "key": "sales_notes", "type": "string", "label": "Sales Notes"},
            ],
            "ui": [],
        }

    def _draft_blueprint_without_ids(self):
        return {
            "meta": {"title": "Normalization Survey"},
            "schema": [
                {"key": "customer name", "type": "string", "required": True},
            ],
            "ui": [
                {
                    "id": "screen alpha",
                    "type": "screen",
                    "title": "Profile",
                    "children": [
                        {
                            "type": "input_text",
                            "bind": "customer name",
                            "label": "Customer Name",
                            "required": True,
                        }
                    ],
                }
            ],
            "logic": [],
        }

    def test_publish_creates_dataset_and_submission_links(self):
        form = FormService.create_form(
            self.db,
            project_id=self.project.id,
            title="Customer Survey",
            blueprint=self._draft_blueprint_v1(),
        )

        published_form = FormService.publish_form(self.db, form.id, published_by=self.user.id)

        dataset = self.db.query(FormDataset).filter(FormDataset.form_id == form.id).one()
        schema_version = (
            self.db.query(FormDatasetSchemaVersion)
            .filter(FormDatasetSchemaVersion.dataset_id == dataset.id)
            .one()
        )

        self.assertEqual(dataset.current_schema_version_number, published_form.published_version)
        self.assertEqual(schema_version.version_number, published_form.published_version)
        self.assertEqual(len(dataset.fields), 4)

        submission = SubmissionService.create_submission(
            self.db,
            form_id=form.id,
            data={
                "customer_name": "Ada",
                "region": "North",
                "satisfaction": "good",
                "comments": "Fast service",
            },
            user_id=self.user.id,
            metadata={"source": "test"},
        )

        self.assertEqual(submission.dataset_id, dataset.id)
        self.assertEqual(submission.dataset_schema_version_id, schema_version.id)
        self.assertEqual(submission.form_version_number, published_form.published_version)

    def test_republish_preserves_legacy_fields_and_adds_new_schema_version(self):
        form = FormService.create_form(
            self.db,
            project_id=self.project.id,
            title="Customer Survey",
            blueprint=self._draft_blueprint_v1(),
        )
        FormService.publish_form(self.db, form.id, published_by=self.user.id)

        FormService.update_blueprint(
            self.db,
            form.id,
            self._draft_blueprint_v2(),
            updated_by=self.user.id,
        )
        updated_form = FormService.publish_form(
            self.db,
            form.id,
            published_by=self.user.id,
            changelog="Added follow-up questions and retired comments",
        )

        dataset = self.db.query(FormDataset).filter(FormDataset.form_id == form.id).one()
        schema_versions = (
            self.db.query(FormDatasetSchemaVersion)
            .filter(FormDatasetSchemaVersion.dataset_id == dataset.id)
            .order_by(FormDatasetSchemaVersion.version_number.asc())
            .all()
        )
        fields = {field.field_identifier: field for field in dataset.fields}

        self.assertEqual(dataset.current_schema_version_number, updated_form.published_version)
        self.assertEqual([version.version_number for version in schema_versions], [1, 2])
        self.assertEqual(fields["q_comments"].status, FormDatasetFieldStatus.LEGACY)
        self.assertEqual(fields["q_comments"].retired_in_version_number, updated_form.published_version)
        self.assertEqual(fields["q_followup_consent"].status, FormDatasetFieldStatus.ACTIVE)
        self.assertEqual(fields["q_sales_notes"].status, FormDatasetFieldStatus.ACTIVE)
        self.assertIn("q_followup_consent", schema_versions[-1].change_summary_json["added"])
        self.assertIn("q_comments", schema_versions[-1].change_summary_json["removed"])

    def test_create_form_normalizes_missing_field_ids(self):
        form = FormService.create_form(
            self.db,
            project_id=self.project.id,
            title="Normalization Survey",
            blueprint=self._draft_blueprint_without_ids(),
        )

        schema_entry = form.blueprint_draft["schema"][0]
        ui_child = form.blueprint_draft["ui"][0]["children"][0]

        self.assertEqual(schema_entry["key"], "customer_name")
        self.assertEqual(schema_entry["id"], "customer_name")
        self.assertEqual(schema_entry["field_id"], "customer_name")
        self.assertEqual(schema_entry["dataset_field_id"], "customer_name")
        self.assertEqual(form.blueprint_draft["ui"][0]["id"], "screen_alpha")
        self.assertEqual(ui_child["bind"], "customer_name")
        self.assertEqual(ui_child["id"], "customer_name")

    def test_lookup_sources_and_options_are_available_for_same_project_forms(self):
        customer_form = FormService.create_form(
            self.db,
            project_id=self.project.id,
            title="Customer Registry",
            blueprint={
                "meta": {"title": "Customer Registry"},
                "schema": [
                    {"key": "customer_id", "type": "string", "required": True},
                    {"key": "customer_name", "type": "string", "required": True},
                ],
                "ui": [
                    {
                        "id": "screen_1",
                        "type": "screen",
                        "title": "Customers",
                        "children": [
                            {"type": "input_text", "bind": "customer_id", "label": "Customer ID", "required": True},
                            {"type": "input_text", "bind": "customer_name", "label": "Customer Name", "required": True},
                        ],
                    }
                ],
                "logic": [],
            },
        )
        sales_form = FormService.create_form(
            self.db,
            project_id=self.project.id,
            title="Customer Sales",
            blueprint={
                "meta": {"title": "Customer Sales"},
                "schema": [{"key": "sale_amount", "type": "integer", "required": True}],
                "ui": [],
                "logic": [],
            },
        )
        FormService.publish_form(self.db, customer_form.id, published_by=self.user.id)
        FormService.publish_form(self.db, sales_form.id, published_by=self.user.id)

        enable_lookup = self.client.patch(
            f"/api/v1/forms/{customer_form.id}/dataset",
            json={"lookup_enabled": True, "public_lookup_enabled": False},
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        self.assertEqual(enable_lookup.status_code, 200)
        self.assertTrue(enable_lookup.json()["lookup_enabled"])

        SubmissionService.create_submission(
            self.db,
            form_id=customer_form.id,
            data={"customer_id": "CUST-001", "customer_name": "Ada Lovelace"},
            user_id=self.user.id,
        )
        SubmissionService.create_submission(
            self.db,
            form_id=customer_form.id,
            data={"customer_id": "CUST-002", "customer_name": "Grace Hopper"},
            user_id=self.user.id,
        )

        sources = self.client.get(
            f"/api/v1/forms/{sales_form.id}/lookup-sources",
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        self.assertEqual(sources.status_code, 200)
        payload = sources.json()
        self.assertTrue(any(item["form_id"] == str(customer_form.id) for item in payload))

        customer_dataset = self.db.query(FormDataset).filter(FormDataset.form_id == customer_form.id).one()
        options = self.client.get(
            f"/api/v1/forms/{sales_form.id}/lookup-sources/{customer_dataset.id}/options",
            params={"label_field": "customer_name", "value_field": "customer_id"},
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        self.assertEqual(options.status_code, 200)
        option_payload = options.json()
        self.assertEqual(option_payload["total_options"], 2)
        self.assertEqual(option_payload["options"][0]["value"], "CUST-002")
        self.assertEqual(option_payload["options"][1]["label"], "Ada Lovelace")

    def test_public_lookup_requires_explicit_public_dataset_enablement(self):
        directory_form = FormService.create_form(
            self.db,
            project_id=self.project.id,
            title="Public Directory",
            blueprint={
                "meta": {"title": "Public Directory"},
                "schema": [
                    {"key": "customer_id", "type": "string", "required": True},
                    {"key": "customer_name", "type": "string", "required": True},
                ],
                "ui": [
                    {
                        "id": "screen_1",
                        "type": "screen",
                        "title": "Directory",
                        "children": [
                            {"type": "input_text", "bind": "customer_id", "label": "Customer ID", "required": True},
                            {"type": "input_text", "bind": "customer_name", "label": "Customer Name", "required": True},
                        ],
                    }
                ],
                "logic": [],
            },
        )
        lookup_form = FormService.create_form(
            self.db,
            project_id=self.project.id,
            title="Public Lookup Consumer",
            blueprint={
                "meta": {"title": "Public Lookup Consumer"},
                "schema": [{"key": "selected_customer", "type": "string", "required": False}],
                "ui": [],
                "logic": [],
            },
        )

        directory_form.is_public = True
        lookup_form.is_public = True
        self.db.add(directory_form)
        self.db.add(lookup_form)
        self.db.commit()

        FormService.publish_form(self.db, directory_form.id, published_by=self.user.id)
        FormService.publish_form(self.db, lookup_form.id, published_by=self.user.id)

        directory_dataset = self.db.query(FormDataset).filter(FormDataset.form_id == directory_form.id).one()
        SubmissionService.create_submission(
            self.db,
            form_id=directory_form.id,
            data={"customer_id": "PUB-001", "customer_name": "Public Ada"},
            user_id=self.user.id,
        )

        disabled_response = self.client.get(
            f"/api/v1/public/forms/{lookup_form.slug}/lookup-sources/{directory_dataset.id}/options",
            params={"label_field": "customer_name", "value_field": "customer_id"},
        )
        self.assertEqual(disabled_response.status_code, 404)
        self.assertEqual(disabled_response.json()["detail"], "Lookup dataset not enabled")

        enable_lookup = self.client.patch(
            f"/api/v1/forms/{directory_form.id}/dataset",
            json={"lookup_enabled": True, "public_lookup_enabled": False},
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        self.assertEqual(enable_lookup.status_code, 200)

        private_only_response = self.client.get(
            f"/api/v1/public/forms/{lookup_form.slug}/lookup-sources/{directory_dataset.id}/options",
            params={"label_field": "customer_name", "value_field": "customer_id"},
        )
        self.assertEqual(private_only_response.status_code, 404)
        self.assertEqual(private_only_response.json()["detail"], "Lookup dataset not available for public forms")

        enable_public_lookup = self.client.patch(
            f"/api/v1/forms/{directory_form.id}/dataset",
            json={"public_lookup_enabled": True},
            headers={"Authorization": f"Bearer {self._token()}"},
        )
        self.assertEqual(enable_public_lookup.status_code, 200)
        self.assertTrue(enable_public_lookup.json()["lookup_enabled"])
        self.assertTrue(enable_public_lookup.json()["public_lookup_enabled"])

        enabled_response = self.client.get(
            f"/api/v1/public/forms/{lookup_form.slug}/lookup-sources/{directory_dataset.id}/options",
            params={"label_field": "customer_name", "value_field": "customer_id"},
        )
        self.assertEqual(enabled_response.status_code, 200)
        payload = enabled_response.json()
        self.assertEqual(payload["total_options"], 1)
        self.assertEqual(payload["options"][0]["value"], "PUB-001")
        self.assertEqual(payload["options"][0]["label"], "Public Ada")

    def _token(self) -> str:
        from app.services.auth_service import auth_service

        return auth_service.create_access_token({"sub": str(self.user.id)})