"""Add form versions and runtime metadata

Revision ID: 006_form_versions_runtime
Revises: 5c4b43dbcbc6
Create Date: 2026-03-05 12:10:00.000000

"""
from typing import Sequence, Union
import uuid
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "006_form_versions_runtime"
down_revision: Union[str, Sequence[str], None] = "5c4b43dbcbc6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'form_version_kind') THEN
                    CREATE TYPE form_version_kind AS ENUM ('draft', 'live');
                END IF;
            END
            $$;
            """
        )
    )

    form_version_kind = postgresql.ENUM("draft", "live", name="form_version_kind", create_type=False)

    op.add_column("forms", sa.Column("published_version", sa.Integer(), nullable=True))
    op.add_column("forms", sa.Column("published_at", sa.DateTime(), nullable=True))

    op.add_column("submissions", sa.Column("form_version_number", sa.Integer(), nullable=True))

    op.create_table(
        "form_versions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("form_id", sa.UUID(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("kind", form_version_kind, nullable=False),
        sa.Column("slot_index", sa.Integer(), nullable=True),
        sa.Column("blueprint", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("changelog", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_form_versions_form_id", "form_versions", ["form_id"], unique=False)
    op.create_index(
        "ix_form_versions_active_live",
        "form_versions",
        ["form_id"],
        unique=True,
        postgresql_where=sa.text("kind = 'live' AND is_active = true"),
    )
    op.create_index(
        "ix_form_versions_active_draft_slot",
        "form_versions",
        ["form_id", "slot_index"],
        unique=True,
        postgresql_where=sa.text("kind = 'draft' AND is_active = true"),
    )

    # Backfill existing forms so older workspaces keep a valid draft/live lineage.
    forms = bind.execute(
        sa.text(
            """
            SELECT id, blueprint_draft, blueprint_live, version, created_at, updated_at
            FROM forms
            """
        )
    ).mappings().all()

    for form in forms:
        has_live = form["blueprint_live"] is not None
        live_version = int(form["version"] or 1)
        draft_version = (live_version + 1) if has_live else 1
        published_at = form["updated_at"] or form["created_at"]

        if form["blueprint_draft"] is not None:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO form_versions
                    (id, form_id, version_number, kind, slot_index, blueprint, created_by, changelog, is_active, created_at, published_at)
                    VALUES
                    (:id, :form_id, :version_number, 'draft', :slot_index, CAST(:blueprint AS JSONB), NULL, NULL, true, :created_at, NULL)
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "form_id": form["id"],
                    "version_number": draft_version,
                    "slot_index": 1,
                    "blueprint": json.dumps(form["blueprint_draft"]),
                    "created_at": form["updated_at"] or form["created_at"],
                },
            )

        if has_live:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO form_versions
                    (id, form_id, version_number, kind, slot_index, blueprint, created_by, changelog, is_active, created_at, published_at)
                    VALUES
                    (:id, :form_id, :version_number, 'live', NULL, CAST(:blueprint AS JSONB), NULL, 'Backfilled from legacy form row', true, :created_at, :published_at)
                    """
                ),
                {
                    "id": uuid.uuid4(),
                    "form_id": form["id"],
                    "version_number": live_version,
                    "blueprint": json.dumps(form["blueprint_live"]),
                    "created_at": published_at,
                    "published_at": published_at,
                },
            )

            bind.execute(
                sa.text(
                    """
                    UPDATE forms
                    SET published_version = :published_version,
                        published_at = :published_at
                    WHERE id = :form_id
                    """
                ),
                {
                    "form_id": form["id"],
                    "published_version": live_version,
                    "published_at": published_at,
                },
            )


def downgrade() -> None:
    op.drop_index("ix_form_versions_active_draft_slot", table_name="form_versions")
    op.drop_index("ix_form_versions_active_live", table_name="form_versions")
    op.drop_index("ix_form_versions_form_id", table_name="form_versions")
    op.drop_table("form_versions")

    op.drop_column("submissions", "form_version_number")

    op.drop_column("forms", "published_at")
    op.drop_column("forms", "published_version")

    op.execute(sa.text("DROP TYPE IF EXISTS form_version_kind"))
