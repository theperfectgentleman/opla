"""Add project workspace lifecycle state

Revision ID: 007_project_workspace_state
Revises: 006_form_versions_runtime
Create Date: 2026-03-06 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "007_project_workspace_state"
down_revision: Union[str, Sequence[str], None] = "006_form_versions_runtime"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
                    CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'archived');
                END IF;
            END
            $$;
            """
        )
    )

    project_status = postgresql.ENUM(
        "planning",
        "active",
        "paused",
        "archived",
        name="project_status",
        create_type=False,
    )

    op.add_column(
        "projects",
        sa.Column("status", project_status, nullable=False, server_default=sa.text("'planning'")),
    )
    op.add_column("projects", sa.Column("activated_at", sa.DateTime(), nullable=True))
    op.add_column("projects", sa.Column("paused_at", sa.DateTime(), nullable=True))
    op.add_column("projects", sa.Column("archived_at", sa.DateTime(), nullable=True))

    bind.execute(sa.text("UPDATE projects SET status = 'active', activated_at = created_at WHERE status = 'planning'"))


def downgrade() -> None:
    op.drop_column("projects", "archived_at")
    op.drop_column("projects", "paused_at")
    op.drop_column("projects", "activated_at")
    op.drop_column("projects", "status")
    op.execute(sa.text("DROP TYPE IF EXISTS project_status"))