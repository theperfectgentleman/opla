"""add generic task context and automation provenance

Revision ID: 021_task_ctx
Revises: 020_catalog
Create Date: 2026-05-25 00:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '021_task_ctx'
down_revision = '020_catalog'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'project_tasks',
        sa.Column('context_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        'project_tasks',
        sa.Column('automation_rule_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(op.f('ix_project_tasks_automation_rule_id'), 'project_tasks', ['automation_rule_id'], unique=False)
    op.create_foreign_key(
        'fk_project_tasks_automation_rule_id_form_automation_rules',
        'project_tasks',
        'form_automation_rules',
        ['automation_rule_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_project_tasks_automation_rule_id_form_automation_rules', 'project_tasks', type_='foreignkey')
    op.drop_index(op.f('ix_project_tasks_automation_rule_id'), table_name='project_tasks')
    op.drop_column('project_tasks', 'automation_rule_id')
    op.drop_column('project_tasks', 'context_json')