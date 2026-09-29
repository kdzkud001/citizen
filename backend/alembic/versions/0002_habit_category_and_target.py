"""habit category and weekly target

Revision ID: 0002_habit_category_target
Revises: 0001_initial
Create Date: 2026-09-29

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_habit_category_target"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "app"


def upgrade() -> None:
    # Existing habits default to Discipline / every day (7).
    op.add_column(
        "habits",
        sa.Column("category", sa.String(), nullable=False, server_default="Discipline"),
        schema=SCHEMA,
    )
    op.add_column(
        "habits",
        sa.Column("weekly_target", sa.Integer(), nullable=False, server_default="7"),
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_habits_weekly_target", "habits", "weekly_target BETWEEN 1 AND 7", schema=SCHEMA
    )


def downgrade() -> None:
    op.drop_constraint("ck_habits_weekly_target", "habits", schema=SCHEMA, type_="check")
    op.drop_column("habits", "weekly_target", schema=SCHEMA)
    op.drop_column("habits", "category", schema=SCHEMA)
