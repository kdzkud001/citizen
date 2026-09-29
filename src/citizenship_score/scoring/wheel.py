"""
Wellness wheel: per category, how much of the user's own targets they hit
over a window of N days.

- Habit categories: completions / (sum of the category's active habits'
  weekly_target * days / 7).
- Fitness: (scored Lyfta sessions + Fitness habit completions) /
  (weekly_session_target * days / 7 if Lyfta is connected, plus Fitness
  habits' weekly targets * days / 7).
- Percent is capped at 100. A category is not tracking when it has no
  active habits -- and for Fitness, also no Lyfta connection. Non-tracking
  categories report percent 0.

Only currently active habits count, both toward targets and completions.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig
from citizenship_score.models import HabitCompletion, HabitDefinition


@dataclass
class WheelSpoke:
    category: str
    percent: float
    completions: int
    target: float
    tracking: bool


def wellness_wheel(
    habits: Sequence[HabitDefinition],
    completions: Iterable[HabitCompletion],
    scored_session_dates: Iterable[date],
    weekly_session_target: int,
    lyfta_connected: bool,
    window_end: date,
    days: int | None = None,
    config: ScoringConfig = DEFAULT_CONFIG,
) -> list[WheelSpoke]:
    """One spoke per config category, in config order, for the window
    [window_end - days + 1, window_end]."""
    days = days or config.wheel_window_days
    window_start = window_end - timedelta(days=days - 1)

    def in_window(d: date) -> bool:
        return window_start <= d <= window_end

    active = {h.habit_id: h for h in habits if h.active}
    completed = {(c.habit_id, c.completed_on) for c in completions if c.habit_id in active and in_window(c.completed_on)}
    sessions = sum(1 for d in scored_session_dates if in_window(d))

    spokes = []
    for category in config.habit_categories:
        category_habits = [h for h in active.values() if h.category == category]
        count = sum(1 for habit_id, _ in completed if active[habit_id].category == category)
        target = sum(h.weekly_target for h in category_habits) * days / 7
        tracking = bool(category_habits)

        if category == config.fitness_category:
            count += sessions
            if lyfta_connected:
                target += weekly_session_target * days / 7
            tracking = tracking or lyfta_connected

        percent = min(100.0, 100.0 * count / target) if tracking and target > 0 else 0.0
        spokes.append(
            WheelSpoke(category=category, percent=percent, completions=count, target=target, tracking=tracking)
        )
    return spokes
