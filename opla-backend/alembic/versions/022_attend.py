"""add project attendance records

Revision ID: 022_attend
Revises: 021_task_ctx
Create Date: 2026-05-25 01:10:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '022_attend'
down_revision = '021_task_ctx'
branch_labels = None
depends_on = None


def upgrade() -> None:
    attendance_status = postgresql.ENUM('checked_in', 'checked_out', name='project_attendance_status', create_type=False)
    attendance_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'project_attendance_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('attendance_date', sa.Date(), nullable=False),
        sa.Column('status', attendance_status, nullable=False),
        sa.Column('check_in_at', sa.DateTime(), nullable=False),
        sa.Column('check_in_location_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('check_in_note', sa.Text(), nullable=True),
        sa.Column('check_in_image_uri', sa.String(), nullable=True),
        sa.Column('check_in_signature', sa.String(), nullable=True),
        sa.Column('check_out_at', sa.DateTime(), nullable=True),
        sa.Column('check_out_location_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('check_out_note', sa.Text(), nullable=True),
        sa.Column('check_out_image_uri', sa.String(), nullable=True),
        sa.Column('check_out_signature', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE', name='fk_project_attendance_project_id_projects'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE', name='fk_project_attendance_user_id_users'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_id', 'user_id', 'attendance_date', name='uq_project_attendance_project_user_date'),
    )
    op.create_index(op.f('ix_project_attendance_records_project_id'), 'project_attendance_records', ['project_id'], unique=False)
    op.create_index(op.f('ix_project_attendance_records_user_id'), 'project_attendance_records', ['user_id'], unique=False)
    op.create_index(op.f('ix_project_attendance_records_attendance_date'), 'project_attendance_records', ['attendance_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_project_attendance_records_attendance_date'), table_name='project_attendance_records')
    op.drop_index(op.f('ix_project_attendance_records_user_id'), table_name='project_attendance_records')
    op.drop_index(op.f('ix_project_attendance_records_project_id'), table_name='project_attendance_records')
    op.drop_table('project_attendance_records')
    postgresql.ENUM(name='project_attendance_status').drop(op.get_bind(), checkfirst=True)