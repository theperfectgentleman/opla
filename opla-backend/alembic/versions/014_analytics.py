"""analytics saved questions and dashboards

Revision ID: 014_analytics
Revises: 013_form_dataset
Create Date: 2026-03-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "014_analytics"
down_revision = "013_form_dataset"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_questions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("query_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("viz_type", sa.String(length=50), nullable=False, server_default="table"),
        sa.Column("viz_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("cache_ttl_seconds", sa.Integer(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_questions_org_id"), "saved_questions", ["org_id"], unique=False)
    op.create_index(op.f("ix_saved_questions_project_id"), "saved_questions", ["project_id"], unique=False)

    op.create_table(
        "analytics_dashboards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("layout_config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_analytics_dashboards_org_id"), "analytics_dashboards", ["org_id"], unique=False)
    op.create_index(op.f("ix_analytics_dashboards_project_id"), "analytics_dashboards", ["project_id"], unique=False)

    op.create_table(
        "dashboard_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dashboard_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("viz_override", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dashboard_id"], ["analytics_dashboards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["question_id"], ["saved_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_dashboard_cards_dashboard_id"), "dashboard_cards", ["dashboard_id"], unique=False)
    op.create_index(op.f("ix_dashboard_cards_question_id"), "dashboard_cards", ["question_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_dashboard_cards_question_id"), table_name="dashboard_cards")
    op.drop_index(op.f("ix_dashboard_cards_dashboard_id"), table_name="dashboard_cards")
    op.drop_table("dashboard_cards")

    op.drop_index(op.f("ix_analytics_dashboards_project_id"), table_name="analytics_dashboards")
    op.drop_index(op.f("ix_analytics_dashboards_org_id"), table_name="analytics_dashboards")
    op.drop_table("analytics_dashboards")

    op.drop_index(op.f("ix_saved_questions_project_id"), table_name="saved_questions")
    op.drop_index(op.f("ix_saved_questions_org_id"), table_name="saved_questions")
    op.drop_table("saved_questions")
