"""product vocabulary rename — field_visit, directory, messages

Revision ID: 031_vocab_rename
Revises: 030_create_alert_action
"""

from __future__ import annotations

import json
import re
from typing import Any

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision = "031_vocab_rename"
down_revision = "030_create_alert_action"
branch_labels = None
depends_on = None

# JSON key / value replacements for blueprint and automation payloads
_JSON_REPLACEMENTS: list[tuple[str, str]] = [
    ('"catalog_form_id"', '"directory_form_id"'),
    ('"catalog_form_title"', '"directory_form_title"'),
    ('"catalog_key_field_id"', '"directory_key_field_id"'),
    ('"catalog_label_field_id"', '"directory_label_field_id"'),
    ('"catalog_source_type"', '"directory_source_type"'),
    ('"catalog_cascade_filter_column"', '"directory_cascade_filter_column"'),
    ('"catalog_is_active"', '"directory_is_active"'),
    ('"project_catalog"', '"project_directory"'),
    ('"catalog_form"', '"directory_form"'),
    ('"catalog"', '"directory"'),
    ('"journey_visit"', '"field_visit"'),
    ('"mobile_desk"', '"mobile_agent"'),
    ('"mobile_yard"', '"mobile_pulse"'),
    ('"desk"', '"agent"'),
    ('"yard"', '"pulse"'),
]


def _migrate_json_text(raw: str | None) -> str | None:
    if raw is None:
        return None
    text_value = raw if isinstance(raw, str) else json.dumps(raw)
    for old, new in _JSON_REPLACEMENTS:
        text_value = text_value.replace(old, new)
    return text_value


def _migrate_jsonb_column(conn, table: str, column: str) -> None:
    rows = conn.execute(text(f"SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL")).fetchall()
    for row_id, payload in rows:
        if payload is None:
            continue
        migrated = _migrate_json_text(json.dumps(payload))
        if migrated is None:
            continue
        conn.execute(
            text(f"UPDATE {table} SET {column} = CAST(:payload AS jsonb) WHERE id = :id"),
            {"payload": migrated, "id": row_id},
        )


def upgrade() -> None:
    conn = op.get_bind()

    # --- Tasks: journey_visit → field_visit, visit_date → scheduled_date ---
    op.execute("ALTER TYPE project_task_kind RENAME VALUE 'journey_visit' TO 'field_visit'")
    op.alter_column("project_tasks", "visit_date", new_column_name="scheduled_date")

    # --- Forms: catalog kind → directory, column renames ---
    op.execute("ALTER TYPE form_kind RENAME VALUE 'catalog' TO 'directory'")
    op.alter_column("forms", "catalog_key_field_id", new_column_name="directory_key_field_id")
    op.alter_column("forms", "catalog_label_field_id", new_column_name="directory_label_field_id")

    op.alter_column("submissions", "catalog_is_active", new_column_name="directory_is_active")

    # --- Project SKU table ---
    op.rename_table("project_catalog_items", "project_directory_items")
    op.execute(
        "ALTER INDEX IF EXISTS ix_project_catalog_items_project_id "
        "RENAME TO ix_project_directory_items_project_id"
    )
    op.execute(
        "ALTER INDEX IF EXISTS ix_project_catalog_items_project_sku "
        "RENAME TO ix_project_directory_items_project_sku"
    )

    # --- Messages (was threads) ---
    op.rename_table("project_threads", "project_message_channels")
    op.rename_table("project_thread_messages", "project_messages")
    op.rename_table("project_thread_notifications", "project_message_notifications")

    op.alter_column("project_messages", "thread_id", new_column_name="channel_id")
    op.alter_column("project_message_notifications", "thread_id", new_column_name="channel_id")
    op.alter_column("project_attention_items", "source_thread_id", new_column_name="source_channel_id")

    # Rename indexes on message channels (best-effort)
    for old, new in [
        ("ix_project_threads_kind", "ix_project_message_channels_kind"),
        ("ix_project_threads_team_id", "ix_project_message_channels_team_id"),
        ("uq_project_threads_general", "uq_project_message_channels_general"),
        ("uq_project_threads_team", "uq_project_message_channels_team"),
        ("ix_project_thread_messages_thread_id", "ix_project_messages_channel_id"),
    ]:
        op.execute(f"ALTER INDEX IF EXISTS {old} RENAME TO {new}")

    # --- JSONB payloads ---
    _migrate_jsonb_column(conn, "forms", "blueprint_draft")
    _migrate_jsonb_column(conn, "forms", "blueprint_live")
    _migrate_jsonb_column(conn, "form_automation_rules", "action_config_json")
    _migrate_jsonb_column(conn, "form_automation_rules", "conditions_json")
    _migrate_jsonb_column(conn, "project_tasks", "context_json")
    _migrate_jsonb_column(conn, "submissions", "metadata_json")


def downgrade() -> None:
  raise NotImplementedError("Vocabulary migration is not reversible")
