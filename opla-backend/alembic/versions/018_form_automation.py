"""add form automation rules

Revision ID: 018_form_automation
Revises: 017_submission_review
Create Date: 2026-05-23 19:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "018_form_automation"
down_revision: Union[str, Sequence[str], None] = "017_submission_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    event_enum = sa.Enum(
        "submission_created",
        "submission_reviewed",
        "submission_approved",
        name="form_automation_event",
    )
    action_enum = sa.Enum("create_task", name="form_automation_action")
    event_enum.create(op.get_bind(), checkfirst=True)
    action_enum.create(op.get_bind(), checkfirst=True)

    table_event_enum = postgresql.ENUM(
        "submission_created",
        "submission_reviewed",
        "submission_approved",
        name="form_automation_event",
        create_type=False,
    )
    table_action_enum = postgresql.ENUM(
        "create_task",
        name="form_automation_action",
        create_type=False,
    )

    op.create_table(
        "form_automation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("event_type", table_event_enum, nullable=False),
        sa.Column("action_type", table_action_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("conditions_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("action_config_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_form_automation_rules_form_id"), "form_automation_rules", ["form_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_form_automation_rules_form_id"), table_name="form_automation_rules")
    op.drop_table("form_automation_rules")
    sa.Enum(name="form_automation_action").drop(op.get_bind(), checkfirst=False)
    sa.Enum(name="form_automation_event").drop(op.get_bind(), checkfirst=False)