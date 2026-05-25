"""add submission review lifecycle

Revision ID: 017_submission_review
Revises: 016_task_journey_fields
Create Date: 2026-05-23 18:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "017_submission_review"
down_revision: Union[str, Sequence[str], None] = "016_task_journey_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    review_status = sa.Enum("submitted", "approved", "rejected", name="submission_review_status")
    review_status.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "submissions",
        sa.Column("review_status", review_status, nullable=False, server_default="submitted"),
    )
    op.add_column("submissions", sa.Column("reviewed_by", sa.UUID(), nullable=True))
    op.add_column("submissions", sa.Column("reviewed_at", sa.DateTime(), nullable=True))
    op.add_column("submissions", sa.Column("review_comment", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_submissions_reviewed_by_users",
        "submissions",
        "users",
        ["reviewed_by"],
        ["id"],
    )
    op.alter_column("submissions", "review_status", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_submissions_reviewed_by_users", "submissions", type_="foreignkey")
    op.drop_column("submissions", "review_comment")
    op.drop_column("submissions", "reviewed_at")
    op.drop_column("submissions", "reviewed_by")
    op.drop_column("submissions", "review_status")
    sa.Enum(name="submission_review_status").drop(op.get_bind(), checkfirst=False)