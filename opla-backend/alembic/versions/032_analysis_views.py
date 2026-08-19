"""Allow multiple analytic views per form. Persist org reports.

Revision ID: 032_analysis_views
Revises: 031_vocab_rename
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "032_analysis_views"
down_revision = "031_vocab_rename"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for constraint in inspector.get_unique_constraints("form_datasets"):
        columns = constraint.get("column_names") or []
        if columns == ["form_id"] or (len(columns) == 1 and columns[0] == "form_id"):
            op.drop_constraint(constraint["name"], "form_datasets", type_="unique")
    for index in inspector.get_indexes("form_datasets"):
        columns = index.get("column_names") or []
        if index.get("unique") and columns == ["form_id"]:
            op.drop_index(index["name"], table_name="form_datasets")
    op.create_table(
        "org_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("source_project_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("team_grants", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("comments", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("org_reports")
    op.create_unique_constraint("form_datasets_form_id_key", "form_datasets", ["form_id"])
