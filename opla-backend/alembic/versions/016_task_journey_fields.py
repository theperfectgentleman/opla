"""add journey planning fields to project tasks

Revision ID: 016_task_journey_fields
Revises: 015_merge_heads
Create Date: 2026-05-23 17:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "016_task_journey_fields"
down_revision: Union[str, Sequence[str], None] = "015_merge_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    task_kind = sa.Enum("general", "journey_visit", name="project_task_kind")
    task_kind.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "project_tasks",
        sa.Column("kind", task_kind, nullable=False, server_default="general"),
    )
    op.add_column("project_tasks", sa.Column("visit_date", sa.Date(), nullable=True))
    op.add_column("project_tasks", sa.Column("source_submission_id", sa.UUID(), nullable=True))
    op.create_index(op.f("ix_project_tasks_source_submission_id"), "project_tasks", ["source_submission_id"], unique=False)
    op.create_foreign_key(
        "fk_project_tasks_source_submission_id_submissions",
        "project_tasks",
        "submissions",
        ["source_submission_id"],
        ["id"],
    )
    op.alter_column("project_tasks", "kind", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_project_tasks_source_submission_id_submissions", "project_tasks", type_="foreignkey")
    op.drop_index(op.f("ix_project_tasks_source_submission_id"), table_name="project_tasks")
    op.drop_column("project_tasks", "source_submission_id")
    op.drop_column("project_tasks", "visit_date")
    op.drop_column("project_tasks", "kind")
    sa.Enum(name="project_task_kind").drop(op.get_bind(), checkfirst=False)