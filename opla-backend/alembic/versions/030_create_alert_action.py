"""add create_alert automation action and attention provenance

Revision ID: 030_create_alert_action
Revises: 029_project_thread_messages
Create Date: 2026-07-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '030_create_alert_action'
down_revision = '029_project_thread_messages'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE form_automation_action ADD VALUE IF NOT EXISTS 'create_alert'")

    op.add_column(
        'project_attention_items',
        sa.Column(
            'source_automation_rule_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('form_automation_rules.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )
    op.create_index(
        'ix_project_attention_items_source_automation_rule_id',
        'project_attention_items',
        ['source_automation_rule_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_project_attention_items_source_automation_rule_id', table_name='project_attention_items')
    op.drop_column('project_attention_items', 'source_automation_rule_id')
    # Postgres cannot easily remove enum values; leave create_alert in place.
