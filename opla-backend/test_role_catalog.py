import unittest
import uuid

from app.core.database import SessionLocal
from app.models.org_member import OrgMember
from app.models.organization import Organization
from app.models.project_role_template import ProjectRoleTemplate
from app.models.role_template import OrgRole, OrgRoleAssignment
from app.models.user import User
from app.services.organization_service import OrganizationService


class RoleCatalogTests(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.suffix = uuid.uuid4().hex[:10]
        self.owner = User(
            email=f"roles-owner-{self.suffix}@example.com",
            full_name="Roles Owner",
            password_hash="not-used",
            is_active=True,
        )
        self.db.add(self.owner)
        self.db.commit()
        self.db.refresh(self.owner)

    def tearDown(self):
        self.db.rollback()
        org_ids = [row[0] for row in self.db.query(Organization.id).filter(Organization.slug.like(f"roles-org-{self.suffix}%")).all()]
        if org_ids:
            self.db.query(OrgMember).filter(OrgMember.org_id.in_(org_ids)).delete(synchronize_session=False)
            self.db.query(OrgRoleAssignment).filter(OrgRoleAssignment.org_id.in_(org_ids)).delete(synchronize_session=False)
            self.db.query(ProjectRoleTemplate).filter(ProjectRoleTemplate.org_id.in_(org_ids)).delete(synchronize_session=False)
            self.db.query(OrgRole).filter(OrgRole.org_id.in_(org_ids)).delete(synchronize_session=False)
            self.db.query(Organization).filter(Organization.id.in_(org_ids)).delete(synchronize_session=False)
        self.db.query(User).filter(User.id == self.owner.id).delete(synchronize_session=False)
        self.db.commit()
        self.db.close()

    def test_create_organization_seeds_starter_roles(self):
        org = OrganizationService.create_organization(self.db, f"Roles Org {self.suffix}", self.owner.id)
        role_slugs = {
            role.slug
            for role in self.db.query(OrgRole).filter(OrgRole.org_id == org.id).all()
        }

        self.assertEqual(
            role_slugs,
            {
                "org-admin",
                "project-manager",
                "field-supervisor",
                "field-personnel",
                "analyst",
                "stakeholder-viewer",
            },
        )

        project_role_slugs = {
            role.slug
            for role in self.db.query(ProjectRoleTemplate).filter(ProjectRoleTemplate.org_id == org.id).all()
        }

        self.assertEqual(
            project_role_slugs,
            {
                "project-manager",
                "field-supervisor",
                "field-personnel",
                "analyst",
                "stakeholder-viewer",
            },
        )

    def test_create_role_rejects_unknown_permission(self):
        org = OrganizationService.create_organization(self.db, f"Roles Org {self.suffix}", self.owner.id)

        with self.assertRaises(ValueError):
            OrganizationService.create_role(
                self.db,
                org.id,
                name="Broken Role",
                description="Should fail",
                permissions=["submission.create", "permission.that.does.not.exist"],
                priority=10,
            )

    def test_system_role_permissions_can_be_tuned(self):
        org = OrganizationService.create_organization(self.db, f"Roles Org {self.suffix}", self.owner.id)
        role = self.db.query(OrgRole).filter(OrgRole.org_id == org.id, OrgRole.slug == "field-personnel").first()

        updated = OrganizationService.update_role(
            self.db,
            org.id,
            role.id,
            name=None,
            description="Field role with team visibility",
            permissions=["project.view", "form.view", "submission.create", "submission.view_own", "team.view"],
            priority=45,
        )

        self.assertIsNotNone(updated)
        self.assertEqual(updated.permissions, ["project.view", "form.view", "submission.create", "submission.view_own", "team.view"])
        self.assertEqual(updated.priority, 45)


if __name__ == "__main__":
    unittest.main()