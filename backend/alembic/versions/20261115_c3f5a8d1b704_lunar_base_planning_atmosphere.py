"""lunar-base-nasa cabin: cited NASA planning atmosphere (34 % O2, 56.5 kPa)

The cabin O2 and pressure of `lunar-base-nasa` were `unknown`, so a route into the lunar base showed
"unknown -> unknown". NASA Artemis requirements for sustained missions target 8.2 psi (56.5 kPa) and
34 % O2 (ICES-2026-324, Sec. I, p. 3). This writes those two values with their source; the base stays
`planned` (maturity), and the other cabin dimensions stay unknown. Same data as seed/environments.yaml.
Data-only and idempotent. Downgrade puts the two dimensions back to unknown.

Revision ID: c3f5a8d1b704
Revises: b1d0c4a7e2f9
Create Date: 2026-11-15 22:30:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c3f5a8d1b704'
down_revision: Union[str, Sequence[str], None] = 'b1d0c4a7e2f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SOURCE = "ices-2026-324"
LOCATOR = "Sec. I Introduction, p. 3 (PDF p. 3)"
NOTE_O2 = ("NASA Artemis requirements for sustained missions target an average pressure of 8.2 psi (56.5 kPa) "
           "and a 34% oxygen concentration. Planning target, not a built habitat.")
NOTE_P = "8.2 psi = 56.5 kPa. Planning target for sustained missions, not a built habitat."
NOTE_UNKNOWN = "Interior pressure / oxygen: Unknown / unknown."


def upgrade() -> None:
    op.execute(f"""
        INSERT INTO sources (id, kind, title, url, publisher, published_on, access_notes)
        SELECT '{SOURCE}', 'paper',
               'Surface Vehicle Atmospheric Considerations for Moon to Mars Exploration (ICES-2026-324)',
               'https://ntrs.nasa.gov/citations/20260002050',
               'NASA Johnson Space Center / Marshall Space Flight Center (55th International Conference on Environmental Systems)',
               '2026',
               'Quote checked on PDF p. 3 (Sec. I Introduction). A planning target for sustained missions, not a specification of a built habitat; the paper also notes NASA teams test a vehicle atmosphere below 30% O2.'
        ON CONFLICT (id) DO NOTHING
    """)
    for dim, value, note in (("o2_fraction", "0.34", NOTE_O2), ("pressure_kpa", "56.5", NOTE_P)):
        op.execute(f"""
            INSERT INTO environment_conditions (environment_id, space, dimension, value_min, value_max, status, source_id, locator, note)
            SELECT 'lunar-base-nasa', 'cabin', '{dim}', {value}, {value}, 'sourced', '{SOURCE}', '{LOCATOR}', '{note}'
            WHERE EXISTS (SELECT 1 FROM environments WHERE id = 'lunar-base-nasa')
            ON CONFLICT (environment_id, space, dimension) DO UPDATE SET
              value_min = EXCLUDED.value_min, value_max = EXCLUDED.value_max, status = 'sourced',
              source_id = EXCLUDED.source_id, locator = EXCLUDED.locator, note = EXCLUDED.note
        """)


def downgrade() -> None:
    op.execute(f"""
        UPDATE environment_conditions SET value_min = NULL, value_max = NULL, status = 'unknown',
          source_id = 'doc-env-dimensions', locator = '§1 Environments covered, row NASA lunar surface base',
          note = '{NOTE_UNKNOWN}'
        WHERE environment_id = 'lunar-base-nasa' AND space = 'cabin'
          AND dimension IN ('o2_fraction', 'pressure_kpa') AND source_id = '{SOURCE}'
    """)
