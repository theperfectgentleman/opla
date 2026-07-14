"""project attention hooks and items

Revision ID: 027_project_attention
Revises: 026_project_pinned_analytics
Create Date: 2026-07-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '027_project_attention'
down_revision = '026_project_pinned_analytics'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'project_attention_hooks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('severity_default', sa.String(), nullable=False, server_default='warning'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('config_json', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('project_id', 'kind', name='uq_project_attention_hook_kind'),
    )

    op.create_table(
        'project_attention_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('hook_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_attention_hooks.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('severity', sa.String(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False, index=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('deep_link', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='open', index=True),
        sa.Column('dedupe_key', sa.String(), nullable=False),
        sa.Column('source_submission_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('submissions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_tasks.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_attendance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_attendance_records.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_thread_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_threads.id', ondelete='SET NULL'), nullable=True),
        sa.Column('dismissed_at', sa.DateTime(), nullable=True),
        sa.Column('dismissed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('project_id', 'dedupe_key', name='uq_project_attention_dedupe'),
    )


def downgrade() -> None:
    op.drop_table('project_attention_items')
    op.drop_table('project_attention_hooks')
