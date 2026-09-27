"""
Clan score = mean of members' rolling scores * participation factor, where
participation = fraction of members with at least one workout in the last
`clan_participation_window_days` (7) days.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig


@dataclass
class ClanMember:
    member_id: str
    rolling_score: float
    # Dates this member had at least one workout, for the participation check.
    workout_dates: Sequence[date]


def _participated_recently(member: ClanMember, as_of: date, config: ScoringConfig) -> bool:
    window_start = as_of - timedelta(days=config.clan_participation_window_days - 1)
    return any(window_start <= wd <= as_of for wd in member.workout_dates)


def participation_factor(
    members: Sequence[ClanMember], as_of: date, config: ScoringConfig = DEFAULT_CONFIG
) -> float:
    if not members:
        return 0.0
    active = sum(1 for m in members if _participated_recently(m, as_of, config))
    return active / len(members)


def clan_score(
    members: Sequence[ClanMember], as_of: date, config: ScoringConfig = DEFAULT_CONFIG
) -> float:
    if not members:
        return 0.0
    mean_rolling = sum(m.rolling_score for m in members) / len(members)
    return mean_rolling * participation_factor(members, as_of, config)
