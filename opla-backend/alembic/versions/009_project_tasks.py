"""add project tasks

Revision ID: 009_project_tasks
Revises: 008_project_role_templates
Create Date: 2026-03-06 23:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "009_project_tasks"
down_revision: Union[str, Sequence[str], None] = "008_project_role_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_tasks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("todo", "in_progress", "done", "blocked", "cancelled", name="project_task_status"),
            nullable=False,
            server_default="todo",
        ),
        sa.Column("starts_at", sa.DateTime(), nullable=True),
        sa.Column("due_at", sa.DateTime(), nullable=True),
        sa.Column("assigned_accessor_id", sa.UUID(), nullable=True),
        sa.Column(
            "assigned_accessor_type",
            postgresql.ENUM("user", "team", name="accessor_type", create_type=False),
            nullable=True,
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_tasks_project_id"), "project_tasks", ["project_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_project_tasks_project_id"), table_name="project_tasks")
    op.drop_table("project_tasks")
    sa.Enum(name="project_task_status").drop(op.get_bind(), checkfirst=False)