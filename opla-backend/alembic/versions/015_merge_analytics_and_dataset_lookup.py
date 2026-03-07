"""merge analytics and dataset lookup heads

Revision ID: 015_merge_heads
Revises: 014_analytics, 014_dataset_lookup
Create Date: 2026-03-07 22:55:00.000000

"""

from typing import Sequence, Union


revision: str = "015_merge_heads"
down_revision: Union[str, Sequence[str], None] = ("014_analytics", "014_dataset_lookup")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass