"""project thread channels and messages

Revision ID: 029_project_thread_messages
Revises: 028_form_submission_media
Create Date: 2026-07-14 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql import text


revision = '029_project_thread_messages'
down_revision = '028_form_submission_media'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('project_threads', sa.Column('kind', sa.String(), nullable=True))
    op.add_column(
        'project_threads',
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='SET NULL'), nullable=True),
    )
    op.add_column('project_threads', sa.Column('archived_at', sa.DateTime(), nullable=True))

    conn = op.get_bind()
    # Promote one stub per project to general; archive the rest so unique indexes can apply.
    conn.execute(text("""
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY project_id
                       ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
                   ) AS rn
            FROM project_threads
        )
        UPDATE project_threads t
        SET kind = CASE WHEN r.rn = 1 THEN 'general' ELSE 'legacy' END,
            title = CASE WHEN r.rn = 1 AND (t.title IS NULL OR btrim(t.title) = '') THEN 'General' ELSE t.title END,
            archived_at = CASE WHEN r.rn = 1 THEN NULL ELSE COALESCE(t.archived_at, now()) END
        FROM ranked r
        WHERE t.id = r.id
    """))
    conn.execute(text("UPDATE project_threads SET kind = 'general' WHERE kind IS NULL"))

    op.alter_column('project_threads', 'kind', nullable=False, server_default='general')
    op.create_index('ix_project_threads_kind', 'project_threads', ['kind'])
    op.create_index('ix_project_threads_team_id', 'project_threads', ['team_id'])
    op.create_index(
        'uq_project_threads_general',
        'project_threads',
        ['project_id'],
        unique=True,
        postgresql_where=sa.text("kind = 'general' AND archived_at IS NULL"),
    )
    op.create_index(
        'uq_project_threads_team',
        'project_threads',
        ['project_id', 'team_id'],
        unique=True,
        postgresql_where=sa.text("kind = 'team' AND team_id IS NOT NULL AND archived_at IS NULL"),
    )

    op.create_table(
        'project_thread_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('thread_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_threads.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('mentions_json', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('edited_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )

    op.create_table(
        'project_thread_notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('thread_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_threads.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('project_thread_messages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('kind', sa.String(), nullable=False, server_default='mention'),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('project_thread_notifications')
    op.drop_table('project_thread_messages')
    op.drop_index('uq_project_threads_team', table_name='project_threads')
    op.drop_index('uq_project_threads_general', table_name='project_threads')
    op.drop_index('ix_project_threads_team_id', table_name='project_threads')
    op.drop_index('ix_project_threads_kind', table_name='project_threads')
    op.drop_column('project_threads', 'archived_at')
    op.drop_column('project_threads', 'team_id')
    op.drop_column('project_threads', 'kind')
