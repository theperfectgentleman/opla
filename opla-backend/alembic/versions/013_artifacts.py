"""add project assets and threads

Revision ID: 013_artifacts
Revises: 012_report_canvas
Create Date: 2026-03-07 20:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "013_artifacts"
down_revision: Union[str, Sequence[str], None] = "012_report_canvas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    asset_kind_enum = postgresql.ENUM("document", "image", "audio", "link", name="project_asset_kind")
    asset_kind_enum.create(bind, checkfirst=True)

    op.create_table(
        "project_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column(
            "kind",
            postgresql.ENUM("document", "image", "audio", "link", name="project_asset_kind", create_type=False),
            nullable=False,
            server_default="document",
        ),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_assets_project_id"), "project_assets", ["project_id"], unique=False)

    op.create_table(
        "project_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("reply_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_threads_project_id"), "project_threads", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_threads_project_id"), table_name="project_threads")
    op.drop_table("project_threads")

    op.drop_index(op.f("ix_project_assets_project_id"), table_name="project_assets")
    op.drop_table("project_assets")

    sa.Enum(name="project_asset_kind").drop(op.get_bind(), checkfirst=True)