"""
Habit scoring: 10 points per completed habit, capped at 50 points per day.

No habit storage in Phase 0 -- this just scores whatever list of
completions it's given.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig
from citizenship_score.models import HabitCompletion


def score_habits_for_day(num_completed: int, config: ScoringConfig = DEFAULT_CONFIG) -> float:
    """Points for a single day given a count of completed habits."""
    if num_completed <= 0:
        return 0.0
    raw = num_completed * config.habit_points_per_completion
    return min(raw, config.habit_daily_points_cap)


def score_habit_completions(
    completions: Iterable[HabitCompletion],
    config: ScoringConfig = DEFAULT_CONFIG,
) -> dict[date, float]:
    """
    Group completions by calendar day and return day -> points, applying the
    per-completion value and the daily cap.
    """
    counts: dict[date, int] = defaultdict(int)
    for completion in completions:
        counts[completion.completed_on] += 1
    return {day: score_habits_for_day(count, config) for day, count in counts.items()}
