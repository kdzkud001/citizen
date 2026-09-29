"""
Habit scoring. Habits are a full pillar alongside workouts:

- Per-completion points (15 each), capped per day (90).
- Balance bonus (+15) on any day with completions in 3+ distinct
  categories -- a scored Lyfta workout that day counts as Fitness.
- Weekly consistency (+25 per habit whose weekly_target is met in a
  Monday-Sunday week), credited on that week's Sunday, at most 6 habits
  per week.

The two bonuses sit outside the daily cap. All numbers come from config.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import date, timedelta

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig
from citizenship_score.models import HabitCompletion, HabitDefinition


def score_habits_for_day(num_completed: int, config: ScoringConfig = DEFAULT_CONFIG) -> float:
    """Per-completion points for one day, before bonuses."""
    if num_completed <= 0:
        return 0.0
    return min(num_completed * config.habit_points_per_completion, config.habit_daily_points_cap)


def balance_bonus_for_day(categories: set[str], config: ScoringConfig = DEFAULT_CONFIG) -> float:
    if len(categories) >= config.balance_bonus_min_categories:
        return config.balance_bonus_points
    return 0.0


def _week_sunday(day: date) -> date:
    return day + timedelta(days=6 - day.weekday())


def _dedupe(completions: Iterable[HabitCompletion]) -> set[tuple[str, date]]:
    """A habit can only be completed once per day."""
    return {(c.habit_id, c.completed_on) for c in completions}


def weekly_consistency_bonus(
    habits: Sequence[HabitDefinition],
    completions: Iterable[HabitCompletion],
    config: ScoringConfig = DEFAULT_CONFIG,
    as_of: date | None = None,
) -> dict[date, float]:
    """
    Sunday -> bonus for that Monday-Sunday week. Weeks whose Sunday falls
    after `as_of` are still in progress and earn nothing yet. Archived
    habits still count for weeks they were met in: points already earned
    stay earned.
    """
    targets = {h.habit_id: h.weekly_target for h in habits}
    counts: dict[tuple[str, date], int] = defaultdict(int)
    for habit_id, day in _dedupe(completions):
        counts[(habit_id, _week_sunday(day))] += 1

    habits_met: dict[date, int] = defaultdict(int)
    for (habit_id, sunday), count in counts.items():
        target = targets.get(habit_id)
        if target is not None and count >= target:
            habits_met[sunday] += 1

    return {
        sunday: min(n, config.habit_weekly_consistency_max_habits) * config.habit_weekly_consistency_points
        for sunday, n in habits_met.items()
        if as_of is None or sunday <= as_of
    }


def score_habit_completions(
    completions: Iterable[HabitCompletion],
    habits: Sequence[HabitDefinition],
    workout_days: Iterable[date] = (),
    config: ScoringConfig = DEFAULT_CONFIG,
    as_of: date | None = None,
) -> dict[date, float]:
    """
    Day -> total habit points (per-completion points + balance bonus +
    weekly consistency bonus). `workout_days` are days with at least one
    scored Lyfta workout, which count as Fitness toward the balance bonus.
    """
    completions = list(completions)
    categories = {h.habit_id: h.category for h in habits}
    workout_day_set = set(workout_days)
    unique = _dedupe(completions)

    counts: dict[date, int] = defaultdict(int)
    day_categories: dict[date, set[str]] = defaultdict(set)
    for habit_id, day in unique:
        counts[day] += 1
        if habit_id in categories:
            day_categories[day].add(categories[habit_id])

    result: dict[date, float] = {}
    for day, count in counts.items():
        cats = day_categories[day] | ({config.fitness_category} if day in workout_day_set else set())
        result[day] = score_habits_for_day(count, config) + balance_bonus_for_day(cats, config)

    for sunday, bonus in weekly_consistency_bonus(habits, completions, config, as_of).items():
        result[sunday] = result.get(sunday, 0.0) + bonus
    return result
