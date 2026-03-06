"""add project role templates

Revision ID: 008_project_role_templates
Revises: 007_project_workspace_state
Create Date: 2026-03-06 22:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


revision: str = "008_project_role_templates"
down_revision: Union[str, Sequence[str], None] = "007_project_workspace_state"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    op.create_table(
        "project_role_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("permissions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("priority", sa.Integer(), nullable=False, server_default=sa.text("50")),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "slug", name="_project_role_template_slug_uc"),
    )

    op.add_column("project_access", sa.Column("role_template_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_project_access_role_template_id",
        "project_access",
        "project_role_templates",
        ["role_template_id"],
        ["id"],
    )
    op.alter_column(
        "project_access",
        "role",
        existing_type=postgresql.ENUM("collector", "analyst", "editor", name="project_role"),
        nullable=True,
    )

    organizations = connection.execute(sa.text("SELECT id FROM organizations")).fetchall()
    starter_roles = [
        {
            "name": "Project Manager",
            "slug": "project-manager",
            "description": "Owns delivery and operations for a project workspace.",
            "permissions": '["project.view","project.create","project.edit","project.manage_access","project.manage_lifecycle","team.view","team.manage","form.view","form.create","form.edit","form.publish","form.delete","submission.view_all","submission.review","submission.export","analysis.view","report.view","report.export","communication.field","communication.internal"]',
            "priority": 90,
        },
        {
            "name": "Field Supervisor",
            "slug": "field-supervisor",
            "description": "Coordinates field teams, monitors collection, and reviews submissions.",
            "permissions": '["project.view","team.view","team.manage","form.view","submission.view_team","submission.review","report.view","communication.field","communication.internal"]',
            "priority": 70,
        },
        {
            "name": "Field Personnel",
            "slug": "field-personnel",
            "description": "Runs forms in the field and submits data with minimal operational access.",
            "permissions": '["project.view","form.view","submission.create","submission.view_own"]',
            "priority": 40,
        },
        {
            "name": "Analyst",
            "slug": "analyst",
            "description": "Designs forms, examines data quality, and works on analysis outputs.",
            "permissions": '["project.view","form.view","form.create","form.edit","form.publish","submission.view_all","submission.export","analysis.view","analysis.export","report.view","report.export","communication.internal"]',
            "priority": 75,
        },
        {
            "name": "Stakeholder Viewer",
            "slug": "stakeholder-viewer",
            "description": "Consumes reports and outcomes without operational editing rights.",
            "permissions": '["project.view","analysis.view","report.view","communication.internal"]',
            "priority": 30,
        },
    ]

    for organization in organizations:
        org_id = organization[0]
        for role in starter_roles:
            existing = connection.execute(
                sa.text(
                    "SELECT 1 FROM project_role_templates WHERE org_id = :org_id AND slug = :slug"
                ),
                {"org_id": org_id, "slug": role["slug"]},
            ).first()
            if existing:
                continue

            connection.execute(
                sa.text(
                    """
                    INSERT INTO project_role_templates (id, org_id, name, slug, description, permissions, priority, is_system, created_at, updated_at)
                    VALUES (:id, :org_id, :name, :slug, :description, CAST(:permissions AS jsonb), :priority, true, NOW(), NOW())
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "org_id": org_id,
                    "name": role["name"],
                    "slug": role["slug"],
                    "description": role["description"],
                    "permissions": role["permissions"],
                    "priority": role["priority"],
                },
            )

    op.execute(
        sa.text(
            """
            UPDATE project_access pa
            SET role_template_id = prt.id
            FROM projects p
            JOIN project_role_templates prt ON prt.org_id = p.org_id
            WHERE pa.project_id = p.id
              AND (
                (pa.role = 'collector' AND prt.slug = 'field-personnel')
                OR (pa.role = 'analyst' AND prt.slug = 'analyst')
                OR (pa.role = 'editor' AND prt.slug = 'project-manager')
              )
            """
        )
    )


def downgrade() -> None:
    op.alter_column(
        "project_access",
        "role",
        existing_type=postgresql.ENUM("collector", "analyst", "editor", name="project_role"),
        nullable=False,
    )
    op.drop_constraint("fk_project_access_role_template_id", "project_access", type_="foreignkey")
    op.drop_column("project_access", "role_template_id")
    op.drop_table("project_role_templates")