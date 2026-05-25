"""cascade delete form automation rules

Revision ID: 019_form_auto_cascade
Revises: 018_form_automation
Create Date: 2026-05-23 19:28:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "019_form_auto_cascade"
down_revision: Union[str, Sequence[str], None] = "018_form_automation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("form_automation_rules_form_id_fkey", "form_automation_rules", type_="foreignkey")
    op.create_foreign_key(
        "form_automation_rules_form_id_fkey",
        "form_automation_rules",
        "forms",
        ["form_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("form_automation_rules_form_id_fkey", "form_automation_rules", type_="foreignkey")
    op.create_foreign_key(
        "form_automation_rules_form_id_fkey",
        "form_automation_rules",
        "forms",
        ["form_id"],
        ["id"],
    )