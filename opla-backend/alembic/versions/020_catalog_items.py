"""add project catalog items

Revision ID: 020_catalog
Revises: 019_form_auto_cascade
Create Date: 2026-05-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '020_catalog'
down_revision = '019_form_auto_cascade'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'project_catalog_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sku_code', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('default_price', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(), nullable=True),
        sa.Column('brand', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('price_editable', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_project_catalog_items_project_id'), 'project_catalog_items', ['project_id'], unique=False)
    op.create_index('ix_project_catalog_items_project_sku', 'project_catalog_items', ['project_id', 'sku_code'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_project_catalog_items_project_sku', table_name='project_catalog_items')
    op.drop_index(op.f('ix_project_catalog_items_project_id'), table_name='project_catalog_items')
    op.drop_table('project_catalog_items')