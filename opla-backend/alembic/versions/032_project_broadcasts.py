"""project SMS broadcasts, per-recipient deliveries, and org opt-outs

Idempotent: every table and index is created only when missing, so re-running
this revision (or running it on a database where the tables were created by
hand) is safe. Nothing existing is altered.

Revision ID: 032_project_broadcasts
Revises: 031_vocab_rename
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "032_project_broadcasts"
down_revision = "031_vocab_rename"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def upgrade() -> None:
    existing = _tables()

    if "project_broadcasts" not in existing:
        op.create_table(
            "project_broadcasts",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("channel", sa.String(), nullable=False, server_default="sms"),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("sender_id", sa.String(), nullable=True),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("name_fallback", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False, server_default="queued"),
            sa.Column("audience_json", postgresql.JSONB(), nullable=True),
            sa.Column("recipient_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("estimated_credits", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("credits_used", sa.Float(), nullable=True),
            sa.Column("last_error", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
        )

    if "project_broadcast_deliveries" not in existing:
        op.create_table(
            "project_broadcast_deliveries",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("broadcast_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("project_broadcasts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("phone", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("sources", postgresql.JSONB(), nullable=True),
            sa.Column("team_names", postgresql.JSONB(), nullable=True),
            sa.Column("parts", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("status", sa.String(), nullable=False, server_default="queued"),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("provider_ref", sa.String(), nullable=True),
            sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("broadcast_id", "phone", name="uq_project_broadcast_delivery_phone"),
        )

    if "org_message_opt_outs" not in existing:
        op.create_table(
            "org_message_opt_outs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("phone", sa.String(), nullable=False),
            sa.Column("channel", sa.String(), nullable=False, server_default="sms"),
            sa.Column("reason", sa.String(), nullable=True),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
            sa.UniqueConstraint("org_id", "channel", "phone", name="uq_org_message_opt_out"),
        )

    for statement in (
        "CREATE INDEX IF NOT EXISTS ix_project_broadcasts_org_id ON project_broadcasts (org_id)",
        "CREATE INDEX IF NOT EXISTS ix_project_broadcasts_project_id ON project_broadcasts (project_id)",
        "CREATE INDEX IF NOT EXISTS ix_project_broadcasts_status ON project_broadcasts (status)",
        "CREATE INDEX IF NOT EXISTS ix_project_broadcasts_created_at ON project_broadcasts (created_at)",
        "CREATE INDEX IF NOT EXISTS ix_project_broadcast_deliveries_broadcast_id ON project_broadcast_deliveries (broadcast_id)",
        "CREATE INDEX IF NOT EXISTS ix_project_broadcast_deliveries_status ON project_broadcast_deliveries (status)",
        "CREATE INDEX IF NOT EXISTS ix_org_message_opt_outs_org_id ON org_message_opt_outs (org_id)",
    ):
        op.execute(statement)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS project_broadcast_deliveries")
    op.execute("DROP TABLE IF EXISTS project_broadcasts")
    op.execute("DROP TABLE IF EXISTS org_message_opt_outs")
