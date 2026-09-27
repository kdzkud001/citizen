"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-27

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "app"


def upgrade() -> None:
    # Every app table lives in a private `app` schema, never `public` --
    # a Supabase project's Data API (PostgREST) can expose `public` tables
    # directly to anon/authenticated clients if that schema's role grants
    # are enabled, entirely bypassing this backend's own ownership checks.
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

    op.create_table(
        "profiles",
        # References Supabase's own auth.users -- that schema is managed by
        # Supabase, not our migrations, but it already exists by the time
        # this migration runs. ON DELETE CASCADE means deleting a Supabase
        # user cleans up everything hanging off their profile automatically.
        sa.Column("id", postgresql.UUID(as_uuid=True), sa.ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("display_name", sa.String(), nullable=True),
        sa.Column("weekly_session_target", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=SCHEMA,
    )

    op.create_table(
        "lyfta_connections",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("method", sa.String(), nullable=False, server_default="api_key"),
        sa.Column("encrypted_credential", sa.Text(), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("method IN ('api_key', 'oauth')", name="ck_lyfta_method"),
        schema=SCHEMA,
    )

    op.create_table(
        "workouts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("lyfta_workout_id", sa.String(), nullable=False),
        sa.Column("perform_date", sa.Date(), nullable=False),
        sa.Column("raw_json", postgresql.JSONB(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "lyfta_workout_id", name="uq_workouts_user_lyfta_id"),
        schema=SCHEMA,
    )
    op.create_index(
        "ix_workouts_user_perform_date", "workouts", ["user_id", "perform_date"], schema=SCHEMA
    )

    op.create_table(
        "habits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=SCHEMA,
    )

    op.create_table(
        "habit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "habit_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.habits.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("completed_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("habit_id", "completed_on", name="uq_habit_logs_habit_day"),
        schema=SCHEMA,
    )

    op.create_table(
        "daily_scores",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("workout_points", sa.Float(), nullable=False, server_default="0"),
        sa.Column("habit_points", sa.Float(), nullable=False, server_default="0"),
        sa.Column("rolling_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("class_name", sa.String(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=SCHEMA,
    )

    op.create_table(
        "clans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("invite_code", sa.String(), nullable=False, unique=True),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=SCHEMA,
    )

    op.create_table(
        "clan_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "clan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.clans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey(f"{SCHEMA}.profiles.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_table("clan_members", schema=SCHEMA)
    op.drop_table("clans", schema=SCHEMA)
    op.drop_table("daily_scores", schema=SCHEMA)
    op.drop_table("habit_logs", schema=SCHEMA)
    op.drop_table("habits", schema=SCHEMA)
    op.drop_index("ix_workouts_user_perform_date", table_name="workouts", schema=SCHEMA)
    op.drop_table("workouts", schema=SCHEMA)
    op.drop_table("lyfta_connections", schema=SCHEMA)
    op.drop_table("profiles", schema=SCHEMA)
    op.execute(f"DROP SCHEMA IF EXISTS {SCHEMA}")
