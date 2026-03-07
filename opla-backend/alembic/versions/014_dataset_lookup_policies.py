"""add dataset lookup policy flags

Revision ID: 014_dataset_lookup
Revises: 013_form_dataset
Create Date: 2026-03-07 22:35:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014_dataset_lookup"
down_revision: Union[str, Sequence[str], None] = "013_form_dataset"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "form_datasets",
        sa.Column("public_lookup_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("form_datasets", "public_lookup_enabled")