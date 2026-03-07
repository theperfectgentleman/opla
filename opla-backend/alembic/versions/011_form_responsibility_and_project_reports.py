"""add form responsibility and project reports

Revision ID: 011_form_report_resp
Revises: 010_member_types_and_invitations
Create Date: 2026-03-07 16:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "011_form_report_resp"
down_revision: Union[str, Sequence[str], None] = "010_member_types_and_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    report_status_enum = postgresql.ENUM("draft", "published", "archived", name="project_report_status")
    report_status_enum.create(bind, checkfirst=True)

    op.add_column("forms", sa.Column("lead_accessor_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "forms",
        sa.Column(
            "lead_accessor_type",
            postgresql.ENUM("user", "team", name="accessor_type", create_type=False),
            nullable=True,
        ),
    )
    op.add_column("forms", sa.Column("assigned_accessor_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "forms",
        sa.Column(
            "assigned_accessor_type",
            postgresql.ENUM("user", "team", name="accessor_type", create_type=False),
            nullable=True,
        ),
    )
    op.add_column("forms", sa.Column("guest_accessor_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "forms",
        sa.Column(
            "guest_accessor_type",
            postgresql.ENUM("user", "team", name="accessor_type", create_type=False),
            nullable=True,
        ),
    )

    op.create_table(
        "project_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM("draft", "published", "archived", name="project_report_status", create_type=False),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("lead_accessor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "lead_accessor_type",
            postgresql.ENUM("user", "team", name="accessor_type", create_type=False),
            nullable=True,
        ),
        sa.Column("assigned_accessor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "assigned_accessor_type",
            postgresql.ENUM("user", "team", name="accessor_type", create_type=False),
            nullable=True,
        ),
        sa.Column("guest_accessor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "guest_accessor_type",
            postgresql.ENUM("user", "team", name="accessor_type", create_type=False),
            nullable=True,
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_reports_project_id"), "project_reports", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_reports_project_id"), table_name="project_reports")
    op.drop_table("project_reports")

    op.drop_column("forms", "guest_accessor_type")
    op.drop_column("forms", "guest_accessor_id")
    op.drop_column("forms", "assigned_accessor_type")
    op.drop_column("forms", "assigned_accessor_id")
    op.drop_column("forms", "lead_accessor_type")
    op.drop_column("forms", "lead_accessor_id")

    sa.Enum(name="project_report_status").drop(op.get_bind(), checkfirst=True)