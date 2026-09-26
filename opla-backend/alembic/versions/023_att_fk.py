"""fix attendance foreign key cascade

Revision ID: 023_att_fk
Revises: 022_attend
Create Date: 2026-05-25 01:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '023_att_fk'
down_revision = '022_attend'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 022 already creates the cascading FKs under these names. Older databases
    # used the default *_fkey names, which this revision replaces.
    existing = {
        fk["name"]
        for fk in sa.inspect(op.get_bind()).get_foreign_keys("project_attendance_records")
    }
    if {
        "fk_project_attendance_project_id_projects",
        "fk_project_attendance_user_id_users",
    } <= existing:
        return

    op.execute(
        "ALTER TABLE project_attendance_records DROP CONSTRAINT IF EXISTS project_attendance_records_project_id_fkey"
    )
    op.execute(
        "ALTER TABLE project_attendance_records DROP CONSTRAINT IF EXISTS project_attendance_records_user_id_fkey"
    )
    op.create_foreign_key(
        'fk_project_attendance_project_id_projects',
        'project_attendance_records',
        'projects',
        ['project_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'fk_project_attendance_user_id_users',
        'project_attendance_records',
        'users',
        ['user_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('fk_project_attendance_project_id_projects', 'project_attendance_records', type_='foreignkey')
    op.drop_constraint('fk_project_attendance_user_id_users', 'project_attendance_records', type_='foreignkey')
    op.create_foreign_key('project_attendance_records_project_id_fkey', 'project_attendance_records', 'projects', ['project_id'], ['id'])
    op.create_foreign_key('project_attendance_records_user_id_fkey', 'project_attendance_records', 'users', ['user_id'], ['id'])