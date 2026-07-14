"""form submission media index

Revision ID: 028_form_submission_media
Revises: 027_project_attention
Create Date: 2026-07-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '028_form_submission_media'
down_revision = '027_project_attention'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'form_submission_media',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('submission_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('form_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('forms.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('field_bind', sa.String(), nullable=False),
        sa.Column('field_label', sa.String(), nullable=True),
        sa.Column('field_type', sa.String(), nullable=False),
        sa.Column('media_kind', sa.String(), nullable=False, index=True),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('mime_type', sa.String(), nullable=True),
        sa.Column('byte_size', sa.Integer(), nullable=True),
        sa.Column('payload', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('submission_id', 'field_bind', name='uq_submission_media_field'),
    )
    op.create_index(
        'ix_form_submission_media_form_created',
        'form_submission_media',
        ['form_id', 'created_at'],
    )
    op.create_index(
        'ix_form_submission_media_project_created',
        'form_submission_media',
        ['project_id', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_form_submission_media_project_created', table_name='form_submission_media')
    op.drop_index('ix_form_submission_media_form_created', table_name='form_submission_media')
    op.drop_table('form_submission_media')
