"""add member types and invitations

Revision ID: 010_member_types_and_invitations
Revises: 009_project_tasks, 5c4b43dbcbc6
Create Date: 2026-03-07 09:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "010_member_types_and_invitations"
down_revision: Union[str, Sequence[str], None] = ("009_project_tasks", "5c4b43dbcbc6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    member_type_enum = postgresql.ENUM("internal", "contractor", name="member_type")
    invitation_type_enum = postgresql.ENUM("organization", "team", name="invitation_type")
    invitation_member_type_enum = postgresql.ENUM(
        "internal",
        "contractor",
        name="invitation_member_type",
    )
    invitation_delivery_mode_enum = postgresql.ENUM(
        "email",
        "short_link",
        "generated_link",
        "pin_code",
        name="invitation_delivery_mode",
    )
    invitation_approval_mode_enum = postgresql.ENUM("auto", "review", name="invitation_approval_mode")
    invitation_lifecycle_status_enum = postgresql.ENUM(
        "pending",
        "approved",
        "accepted",
        "revoked",
        "declined",
        name="invitation_lifecycle_status",
    )

    member_type_enum.create(bind, checkfirst=True)
    invitation_type_enum.create(bind, checkfirst=True)
    invitation_member_type_enum.create(bind, checkfirst=True)
    invitation_delivery_mode_enum.create(bind, checkfirst=True)
    invitation_approval_mode_enum.create(bind, checkfirst=True)
    invitation_lifecycle_status_enum.create(bind, checkfirst=True)

    op.add_column(
        "org_members",
        sa.Column(
            "member_type",
            postgresql.ENUM("internal", "contractor", name="member_type", create_type=False),
            nullable=False,
            server_default="internal",
        ),
    )

    op.create_table(
        "invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "invitation_type",
            postgresql.ENUM("organization", "team", name="invitation_type", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "member_type",
            postgresql.ENUM("internal", "contractor", name="invitation_member_type", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "delivery_mode",
            postgresql.ENUM(
                "email",
                "short_link",
                "generated_link",
                "pin_code",
                name="invitation_delivery_mode",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "approval_mode",
            postgresql.ENUM("auto", "review", name="invitation_approval_mode", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending",
                "approved",
                "accepted",
                "revoked",
                "declined",
                name="invitation_lifecycle_status",
                create_type=False,
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("invited_email", sa.String(), nullable=True),
        sa.Column("token", sa.String(), nullable=True),
        sa.Column("pin_code", sa.String(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("claimed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("accepted_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["accepted_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["claimed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_invitations_token"),
        sa.UniqueConstraint("pin_code", name="uq_invitations_pin_code"),
    )


def downgrade() -> None:
    op.drop_table("invitations")
    op.drop_column("org_members", "member_type")

    sa.Enum(name="invitation_lifecycle_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="invitation_approval_mode").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="invitation_delivery_mode").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="invitation_member_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="invitation_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="member_type").drop(op.get_bind(), checkfirst=True)