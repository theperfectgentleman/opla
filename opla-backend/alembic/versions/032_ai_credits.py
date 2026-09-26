"""per-organisation AI credit wallet

Revision ID: 032_ai_credits
Revises: 031_vocab_rename
"""

from __future__ import annotations

import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text

from app.services.ai_credit_catalog import AI_ACTION_CATALOG

revision = "032_ai_credits"
down_revision = "031_vocab_rename"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "org_ai_credit_balances",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("organization_id"),
        sa.CheckConstraint("balance >= 0", name="ck_org_ai_credit_balances_nonnegative"),
    )

    op.create_table(
        "org_ai_action_costs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action_key", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("credit_cost", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "action_key", name="uq_org_ai_action_costs_org_action"),
        sa.CheckConstraint("credit_cost >= 0", name="ck_org_ai_action_costs_nonnegative"),
    )
    op.create_index("ix_org_ai_action_costs_organization_id", "org_ai_action_costs", ["organization_id"])

    op.create_table(
        "ai_credit_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entry_type", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("action_key", sa.String(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("related_entry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["related_entry_id"], ["ai_credit_ledger.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("balance_after >= 0", name="ck_ai_credit_ledger_balance_after_nonnegative"),
        sa.CheckConstraint(
            "entry_type IN ('top_up', 'spend', 'refund')",
            name="ck_ai_credit_ledger_entry_type",
        ),
    )
    op.create_index("ix_ai_credit_ledger_organization_id", "ai_credit_ledger", ["organization_id"])
    op.create_index("ix_ai_credit_ledger_created_at", "ai_credit_ledger", ["created_at"])

    conn = op.get_bind()
    org_ids = [row[0] for row in conn.execute(text("SELECT id FROM organizations")).fetchall()]
    now = datetime.utcnow()
    for org_id in org_ids:
        conn.execute(
            text(
                """
                INSERT INTO org_ai_credit_balances (organization_id, balance, created_at, updated_at)
                VALUES (:org_id, 0, :now, :now)
                """
            ),
            {"org_id": org_id, "now": now},
        )
        for spec in AI_ACTION_CATALOG:
            conn.execute(
                text(
                    """
                    INSERT INTO org_ai_action_costs
                        (id, organization_id, action_key, label, credit_cost, updated_at)
                    VALUES
                        (:id, :org_id, :action_key, :label, :credit_cost, :now)
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "org_id": org_id,
                    "action_key": spec["action_key"],
                    "label": spec["label"],
                    "credit_cost": spec["credit_cost"],
                    "now": now,
                },
            )


def downgrade() -> None:
    op.drop_index("ix_ai_credit_ledger_created_at", table_name="ai_credit_ledger")
    op.drop_index("ix_ai_credit_ledger_organization_id", table_name="ai_credit_ledger")
    op.drop_table("ai_credit_ledger")
    op.drop_index("ix_org_ai_action_costs_organization_id", table_name="org_ai_action_costs")
    op.drop_table("org_ai_action_costs")
    op.drop_table("org_ai_credit_balances")
