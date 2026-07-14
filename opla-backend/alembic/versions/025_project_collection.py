"""add project collection settings

Revision ID: 025_project_collection
Revises: 024_catalog_form_kind
Create Date: 2026-07-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '025_project_collection'
down_revision = '024_catalog_form_kind'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('collection_start_date', sa.Date(), nullable=True))
    op.add_column('projects', sa.Column('collection_end_date', sa.Date(), nullable=True))
    op.add_column(
        'projects',
        sa.Column('collection_time_start', sa.Time(), nullable=False, server_default='09:00:00'),
    )
    op.add_column(
        'projects',
        sa.Column('collection_time_end', sa.Time(), nullable=False, server_default='17:00:00'),
    )
    op.add_column('projects', sa.Column('expected_total_count', sa.Integer(), nullable=True))
    op.add_column(
        'projects',
        sa.Column('expected_weekly_count', sa.Integer(), nullable=True, server_default='1'),
    )
    # Backfill legacy rows so every project has at least one expectation target.
    op.execute("UPDATE projects SET expected_weekly_count = 1 WHERE expected_weekly_count IS NULL")


def downgrade() -> None:
    op.drop_column('projects', 'expected_weekly_count')
    op.drop_column('projects', 'expected_total_count')
    op.drop_column('projects', 'collection_time_end')
    op.drop_column('projects', 'collection_time_start')
    op.drop_column('projects', 'collection_end_date')
    op.drop_column('projects', 'collection_start_date')
