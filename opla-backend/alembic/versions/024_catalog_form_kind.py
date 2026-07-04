"""add catalog form kind

Revision ID: 024_catalog_form_kind
Revises: 023_att_fk
Create Date: 2026-07-03 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '024_catalog_form_kind'
down_revision = '023_att_fk'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add form_kind enum type
    op.execute("CREATE TYPE form_kind AS ENUM ('standard', 'catalog')")

    # Add kind column to forms table (default 'standard' for all existing forms)
    op.add_column(
        'forms',
        sa.Column(
            'kind',
            sa.Enum('standard', 'catalog', name='form_kind'),
            nullable=False,
            server_default='standard',
        ),
    )

    # Add catalog field designation columns to forms table
    op.add_column('forms', sa.Column('catalog_key_field_id', sa.String(), nullable=True))
    op.add_column('forms', sa.Column('catalog_label_field_id', sa.String(), nullable=True))

    # Add catalog_is_active to submissions (NULL for standard form submissions)
    op.add_column('submissions', sa.Column('catalog_is_active', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('submissions', 'catalog_is_active')
    op.drop_column('forms', 'catalog_label_field_id')
    op.drop_column('forms', 'catalog_key_field_id')
    op.drop_column('forms', 'kind')
    op.execute("DROP TYPE form_kind")
