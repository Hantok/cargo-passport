"""example cargo wording

The seed files say "example cargo" instead of "mock cargo", but the deploy runs migrations and
does not re-ingest the seed, so rows already in the database keep the old text. Idempotent updates.

Revision ID: d4e7b2c9a1f6
Revises: c3f5a8d1b704
Create Date: 2026-11-15 23:20:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'd4e7b2c9a1f6'
down_revision: Union[str, Sequence[str], None] = 'c3f5a8d1b704'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""UPDATE materials SET notes = replace(notes, 'instrument mock cargo.', 'instrument example cargo.')
                  WHERE notes LIKE '%instrument mock cargo.%'""")
    op.execute("""UPDATE sources SET title = 'Example cargo and material flammability evidence'
                  WHERE id = 'doc-env-material-flammability' AND title LIKE 'Mock cargo%'""")


def downgrade() -> None:
    pass
