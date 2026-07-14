"""project pinned analytics questions

Revision ID: 026_project_pinned_analytics
Revises: 025_project_collection
Create Date: 2026-07-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '026_project_pinned_analytics'
down_revision = '025_project_collection'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'project_pinned_analytics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('saved_questions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('project_id', 'question_id', name='uq_project_pinned_question'),
    )


def downgrade() -> None:
    op.drop_table('project_pinned_analytics')
