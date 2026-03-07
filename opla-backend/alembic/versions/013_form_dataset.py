"""add form datasets

Revision ID: 013_form_dataset
Revises: 013_artifacts
Create Date: 2026-03-07 20:35:00.000000

"""

from typing import Dict, Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "013_form_dataset"
down_revision: Union[str, Sequence[str], None] = "013_artifacts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


dataset_status_enum = postgresql.ENUM(
    "active",
    "archived",
    name="form_dataset_status",
    create_type=False,
)
field_status_enum = postgresql.ENUM(
    "active",
    "legacy",
    name="form_dataset_field_status",
    create_type=False,
)


def _extract_schema_fields(blueprint: Dict | None) -> list[Dict]:
    schema = (blueprint or {}).get("schema") or []
    extracted: list[Dict] = []
    if not isinstance(schema, list):
        return extracted

    for index, field in enumerate(schema):
        if not isinstance(field, dict):
            continue

        identifier = (
            field.get("id")
            or field.get("field_id")
            or field.get("dataset_field_id")
            or field.get("key")
            or f"field_{index + 1}"
        )
        extracted.append(
            {
                "identifier": str(identifier),
                "key": field.get("key") or str(identifier),
                "label": field.get("label") or field.get("title") or field.get("key") or str(identifier),
                "field_type": field.get("type"),
                "definition": field,
            }
        )

    return extracted


def _build_schema_change_summary(previous_blueprint: Dict | None, current_blueprint: Dict | None) -> Dict:
    previous_fields = {field["identifier"]: field for field in _extract_schema_fields(previous_blueprint)}
    current_fields = {field["identifier"]: field for field in _extract_schema_fields(current_blueprint)}
    previous_ids = set(previous_fields)
    current_ids = set(current_fields)

    modified = []
    for identifier in sorted(previous_ids & current_ids):
        if (previous_fields[identifier].get("definition") or {}) != (current_fields[identifier].get("definition") or {}):
            modified.append(
                {
                    "field_identifier": identifier,
                    "previous_key": previous_fields[identifier].get("key"),
                    "current_key": current_fields[identifier].get("key"),
                }
            )

    return {
        "added": sorted(current_ids - previous_ids),
        "removed": sorted(previous_ids - current_ids),
        "modified": modified,
        "backfilled": True,
    }


def _sync_dataset_fields(
    bind,
    form_dataset_fields,
    dataset_id,
    schema_version_number: int,
    blueprint: Dict | None,
    field_state: Dict[str, Dict],
) -> None:
    current_fields = _extract_schema_fields(blueprint)
    current_by_identifier = {field["identifier"]: field for field in current_fields}

    for identifier, field in current_by_identifier.items():
        existing = field_state.get(identifier)
        if existing:
            bind.execute(
                form_dataset_fields.update()
                .where(form_dataset_fields.c.id == existing["id"])
                .values(
                    field_key=field.get("key"),
                    label=field.get("label"),
                    field_type=field.get("field_type"),
                    status="active",
                    retired_in_version_number=None,
                    metadata_json=field.get("definition"),
                )
            )
            existing["status"] = "active"
            existing["retired_in_version_number"] = None
            continue

        field_id = uuid.uuid4()
        bind.execute(
            form_dataset_fields.insert().values(
                id=field_id,
                dataset_id=dataset_id,
                field_identifier=identifier,
                field_key=field.get("key"),
                label=field.get("label"),
                field_type=field.get("field_type"),
                status="active",
                introduced_in_version_number=schema_version_number,
                retired_in_version_number=None,
                metadata_json=field.get("definition"),
            )
        )
        field_state[identifier] = {"id": field_id, "status": "active", "retired_in_version_number": None}

    for identifier, existing in field_state.items():
        if identifier in current_by_identifier or existing.get("status") == "legacy":
            continue
        bind.execute(
            form_dataset_fields.update()
            .where(form_dataset_fields.c.id == existing["id"])
            .values(status="legacy", retired_in_version_number=schema_version_number)
        )
        existing["status"] = "legacy"
        existing["retired_in_version_number"] = schema_version_number


def upgrade() -> None:
    bind = op.get_bind()
    dataset_status_enum.create(bind, checkfirst=True)
    field_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "form_datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("status", dataset_status_enum, nullable=False, server_default="active"),
        sa.Column("lookup_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("current_schema_version_number", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_form_version_number", sa.Integer(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["form_id"], ["forms.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("form_id"),
    )
    op.create_index(op.f("ix_form_datasets_form_id"), "form_datasets", ["form_id"], unique=False)
    op.create_index(op.f("ix_form_datasets_slug"), "form_datasets", ["slug"], unique=False)

    op.create_table(
        "form_dataset_schema_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("form_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("schema_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("blueprint_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("change_summary_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["form_datasets.id"]),
        sa.ForeignKeyConstraint(["form_version_id"], ["form_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_form_dataset_schema_versions_unique",
        "form_dataset_schema_versions",
        ["dataset_id", "version_number"],
        unique=True,
    )
    op.create_index(
        op.f("ix_form_dataset_schema_versions_dataset_id"),
        "form_dataset_schema_versions",
        ["dataset_id"],
        unique=False,
    )

    op.create_table(
        "form_dataset_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("field_identifier", sa.String(), nullable=False),
        sa.Column("field_key", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("field_type", sa.String(), nullable=True),
        sa.Column("status", field_status_enum, nullable=False, server_default="active"),
        sa.Column("introduced_in_version_number", sa.Integer(), nullable=False),
        sa.Column("retired_in_version_number", sa.Integer(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["dataset_id"], ["form_datasets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_form_dataset_fields_unique",
        "form_dataset_fields",
        ["dataset_id", "field_identifier"],
        unique=True,
    )
    op.create_index(op.f("ix_form_dataset_fields_dataset_id"), "form_dataset_fields", ["dataset_id"], unique=False)

    op.add_column("submissions", sa.Column("dataset_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("submissions", sa.Column("dataset_schema_version_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(None, "submissions", "form_datasets", ["dataset_id"], ["id"])
    op.create_foreign_key(None, "submissions", "form_dataset_schema_versions", ["dataset_schema_version_id"], ["id"])

    form_datasets = sa.table(
        "form_datasets",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("form_id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String()),
        sa.column("slug", sa.String()),
        sa.column("status", dataset_status_enum),
        sa.column("lookup_enabled", sa.Boolean()),
        sa.column("current_schema_version_number", sa.Integer()),
        sa.column("last_form_version_number", sa.Integer()),
        sa.column("metadata_json", postgresql.JSONB(astext_type=sa.Text())),
    )
    form_dataset_schema_versions = sa.table(
        "form_dataset_schema_versions",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("dataset_id", postgresql.UUID(as_uuid=True)),
        sa.column("form_version_id", postgresql.UUID(as_uuid=True)),
        sa.column("version_number", sa.Integer()),
        sa.column("schema_snapshot", postgresql.JSONB(astext_type=sa.Text())),
        sa.column("blueprint_snapshot", postgresql.JSONB(astext_type=sa.Text())),
        sa.column("change_summary_json", postgresql.JSONB(astext_type=sa.Text())),
        sa.column("published_at", sa.DateTime()),
    )
    form_dataset_fields = sa.table(
        "form_dataset_fields",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("dataset_id", postgresql.UUID(as_uuid=True)),
        sa.column("field_identifier", sa.String()),
        sa.column("field_key", sa.String()),
        sa.column("label", sa.String()),
        sa.column("field_type", sa.String()),
        sa.column("status", field_status_enum),
        sa.column("introduced_in_version_number", sa.Integer()),
        sa.column("retired_in_version_number", sa.Integer()),
        sa.column("metadata_json", postgresql.JSONB(astext_type=sa.Text())),
    )
    submissions = sa.table(
        "submissions",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("form_id", postgresql.UUID(as_uuid=True)),
        sa.column("form_version_number", sa.Integer()),
        sa.column("dataset_id", postgresql.UUID(as_uuid=True)),
        sa.column("dataset_schema_version_id", postgresql.UUID(as_uuid=True)),
    )

    forms = bind.execute(
        sa.text(
            """
            SELECT id, title, slug, version, published_version, published_at, blueprint_live
            FROM forms
            WHERE blueprint_live IS NOT NULL AND (published_version IS NOT NULL OR version > 0)
            """
        )
    ).mappings().all()

    for form in forms:
        dataset_id = uuid.uuid4()
        published_version = form["published_version"] or form["version"] or 1
        bind.execute(
            form_datasets.insert().values(
                id=dataset_id,
                form_id=form["id"],
                name=form["title"],
                slug=form["slug"],
                status="active",
                lookup_enabled=False,
                current_schema_version_number=published_version,
                last_form_version_number=published_version,
                metadata_json={"source": "migration_backfill"},
            )
        )

        live_versions = bind.execute(
            sa.text(
                """
                SELECT id, version_number, blueprint, published_at
                FROM form_versions
                WHERE form_id = :form_id AND kind = 'live'
                ORDER BY version_number ASC
                """
            ),
            {"form_id": form["id"]},
        ).mappings().all()

        if not live_versions:
            live_versions = [
                {
                    "id": None,
                    "version_number": published_version,
                    "blueprint": form["blueprint_live"],
                    "published_at": form["published_at"],
                }
            ]

        schema_version_ids: Dict[int, uuid.UUID] = {}
        field_state: Dict[str, Dict] = {}
        previous_blueprint = None

        for live_version in live_versions:
            version_number = live_version["version_number"] or published_version
            schema_version_id = uuid.uuid4()
            blueprint = live_version["blueprint"] or {}
            bind.execute(
                form_dataset_schema_versions.insert().values(
                    id=schema_version_id,
                    dataset_id=dataset_id,
                    form_version_id=live_version["id"],
                    version_number=version_number,
                    schema_snapshot=blueprint.get("schema") or [],
                    blueprint_snapshot=blueprint,
                    change_summary_json=_build_schema_change_summary(previous_blueprint, blueprint),
                    published_at=live_version["published_at"],
                )
            )
            schema_version_ids[version_number] = schema_version_id
            _sync_dataset_fields(bind, form_dataset_fields, dataset_id, version_number, blueprint, field_state)
            previous_blueprint = blueprint

        current_schema_version_number = max(schema_version_ids) if schema_version_ids else published_version
        bind.execute(
            form_datasets.update()
            .where(form_datasets.c.id == dataset_id)
            .values(current_schema_version_number=current_schema_version_number)
        )

        bind.execute(
            submissions.update()
            .where(submissions.c.form_id == form["id"])
            .values(dataset_id=dataset_id)
        )

        for version_number, schema_version_id in schema_version_ids.items():
            bind.execute(
                submissions.update()
                .where(
                    sa.and_(
                        submissions.c.form_id == form["id"],
                        submissions.c.form_version_number == version_number,
                    )
                )
                .values(dataset_schema_version_id=schema_version_id)
            )

        current_schema_version_id = schema_version_ids.get(current_schema_version_number)
        if current_schema_version_id is not None:
            bind.execute(
                submissions.update()
                .where(
                    sa.and_(
                        submissions.c.form_id == form["id"],
                        submissions.c.dataset_schema_version_id.is_(None),
                    )
                )
                .values(dataset_schema_version_id=current_schema_version_id)
            )


def downgrade() -> None:
    op.drop_constraint(op.f("submissions_dataset_schema_version_id_fkey"), "submissions", type_="foreignkey")
    op.drop_constraint(op.f("submissions_dataset_id_fkey"), "submissions", type_="foreignkey")
    op.drop_column("submissions", "dataset_schema_version_id")
    op.drop_column("submissions", "dataset_id")

    op.drop_index(op.f("ix_form_dataset_fields_dataset_id"), table_name="form_dataset_fields")
    op.drop_index("ix_form_dataset_fields_unique", table_name="form_dataset_fields")
    op.drop_table("form_dataset_fields")

    op.drop_index(op.f("ix_form_dataset_schema_versions_dataset_id"), table_name="form_dataset_schema_versions")
    op.drop_index("ix_form_dataset_schema_versions_unique", table_name="form_dataset_schema_versions")
    op.drop_table("form_dataset_schema_versions")

    op.drop_index(op.f("ix_form_datasets_slug"), table_name="form_datasets")
    op.drop_index(op.f("ix_form_datasets_form_id"), table_name="form_datasets")
    op.drop_table("form_datasets")

    bind = op.get_bind()
    field_status_enum.drop(bind, checkfirst=True)
    dataset_status_enum.drop(bind, checkfirst=True)