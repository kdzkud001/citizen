"""
Rolling score and citizenship class, with promotion/demotion hysteresis.

- Rolling score on a given day = total points over the trailing
  `rolling_window_days` (28), inclusive of that day.
- Promotion happens immediately when the rolling score crosses into a
  higher class's band.
- Demotion only happens after the rolling score has stayed more than
  `demotion_threshold_fraction` (10%) below the *current* class's lower
  threshold for `demotion_consecutive_days` (7) consecutive days. A
  demotion drops exactly one class -- see README assumptions for why.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig


def rolling_scores(
    daily_points: dict[date, float], config: ScoringConfig = DEFAULT_CONFIG
) -> dict[date, float]:
    """
    Compute a rolling score for EVERY calendar day from the earliest to the
    latest day in `daily_points` (inclusive), not just days that happen to
    have an entry. Rest days matter: the rolling score is defined daily
    (points fall out of the trailing window as days pass even with no new
    activity), and `classes_with_hysteresis` depends on walking true
    consecutive calendar days -- otherwise a gap of inactive days would
    silently collapse into a single step of the demotion streak counter.
    """
    if not daily_points:
        return {}
    window = config.rolling_window_days
    start_day = min(daily_points)
    end_day = max(daily_points)

    result: dict[date, float] = {}
    day = start_day
    while day <= end_day:
        window_start = day - timedelta(days=window - 1)
        total = 0.0
        d = window_start
        while d <= day:
            total += daily_points.get(d, 0.0)
            d += timedelta(days=1)
        result[day] = total
        day += timedelta(days=1)
    return result


def _band_for_score(score: float, config: ScoringConfig) -> int:
    """Index into config.class_thresholds for the band a raw score falls into."""
    band = 0
    for i, (_, lower) in enumerate(config.class_thresholds):
        if score >= lower:
            band = i
    return band


def class_name_for_score(score: float, config: ScoringConfig = DEFAULT_CONFIG) -> str:
    """The class a score belongs to with NO hysteresis (pure threshold lookup)."""
    return config.class_thresholds[_band_for_score(score, config)][0]


@dataclass
class DailyClass:
    date: date
    rolling_score: float
    class_name: str


def classes_with_hysteresis(
    rolling: dict[date, float], config: ScoringConfig = DEFAULT_CONFIG
) -> list[DailyClass]:
    """
    Walk a daily rolling-score history in date order and return the class
    for each day, applying promotion/demotion hysteresis.
    """
    if not rolling:
        return []

    days = sorted(rolling.keys())
    thresholds = config.class_thresholds
    result: list[DailyClass] = []

    current_band = _band_for_score(rolling[days[0]], config)
    below_streak = 0

    for day in days:
        score = rolling[day]
        natural_band = _band_for_score(score, config)

        if natural_band > current_band:
            # Promote immediately on crossing a higher threshold.
            current_band = natural_band
            below_streak = 0
        elif current_band > 0:
            lower_threshold = thresholds[current_band][1]
            demotion_line = lower_threshold * (1 - config.demotion_threshold_fraction)
            if score < demotion_line:
                below_streak += 1
                if below_streak >= config.demotion_consecutive_days:
                    current_band -= 1
                    below_streak = 0
            else:
                below_streak = 0
        else:
            below_streak = 0

        result.append(DailyClass(date=day, rolling_score=score, class_name=thresholds[current_band][0]))

    return result


def score_classes(
    daily_points: dict[date, float], config: ScoringConfig = DEFAULT_CONFIG
) -> list[DailyClass]:
    """Convenience entry point: daily points -> rolling scores -> classes."""
    rolling = rolling_scores(daily_points, config)
    return classes_with_hysteresis(rolling, config)
