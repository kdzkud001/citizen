from datetime import date, timedelta

import pytest

from citizenship_score.config import ScoringConfig
from citizenship_score.scoring.classes import (
    class_name_for_score,
    classes_with_hysteresis,
    rolling_scores,
    score_classes,
)

CFG = ScoringConfig()


def d(offset: int) -> date:
    return date(2026, 1, 1) + timedelta(days=offset)


# --- rolling window --------------------------------------------------------


def test_rolling_score_sums_last_28_days_inclusive():
    # 100 points every day for 30 days
    daily = {d(i): 100.0 for i in range(30)}
    rolling = rolling_scores(daily, CFG)
    # day 27 (0-indexed) is the 28th day -> full 28*100
    assert rolling[d(27)] == pytest.approx(2800.0)
    # day 29 -> window is days 2..29 (28 days), still 2800 since all days have 100
    assert rolling[d(29)] == pytest.approx(2800.0)
    # day 0 -> window only has 1 real day of data (missing days count as 0)
    assert rolling[d(0)] == pytest.approx(100.0)


def test_rolling_score_treats_gaps_as_zero():
    daily = {d(0): 100.0, d(5): 50.0}
    rolling = rolling_scores(daily, CFG)
    assert rolling[d(5)] == pytest.approx(150.0)


def test_rolling_score_fills_every_calendar_day_between_entries():
    daily = {d(0): 100.0, d(5): 50.0}
    rolling = rolling_scores(daily, CFG)
    # Days 1-4 have no workout entries but must still appear, since the
    # rolling score (and the demotion streak that depends on it) is defined
    # every calendar day, not just on days with activity.
    assert set(rolling.keys()) == {d(i) for i in range(6)}
    assert rolling[d(2)] == pytest.approx(100.0)  # day 0's points still in the 28-day window


def test_demotion_counts_calendar_days_not_just_workout_days():
    # A sparse history: one big day, then NOTHING recorded for a long
    # stretch. The gap must still count as consecutive calendar days below
    # threshold, not collapse into a single hysteresis-loop iteration.
    cfg = ScoringConfig(rolling_window_days=1)
    daily = {d(0): 500.0, d(30): 0.0}  # only 2 dict entries, but 30 real days apart
    classes = classes_with_hysteresis(rolling_scores(daily, cfg), cfg)
    by_date = {c.date: c.class_name for c in classes}
    # 500 -> Commoner on day 0; rolling_window=1 means day 1 onward has
    # rolling score 0 (well below the 270 demotion line), so by day 7 it
    # should have demoted, long before day 30.
    assert by_date[d(7)] == "Outsider"
    assert len(classes) == 31  # every calendar day from d(0) to d(30) inclusive


# --- class thresholds at exact boundaries -----------------------------------


@pytest.mark.parametrize(
    "score,expected",
    [
        (0, "Outsider"),
        (299.999, "Outsider"),
        (300, "Commoner"),
        (999.999, "Commoner"),
        (1000, "Citizen"),
        (1999.999, "Citizen"),
        (2000, "Noble"),
        (3499.999, "Noble"),
        (3500, "Elite"),
        (10000, "Elite"),
    ],
)
def test_class_name_for_score_boundaries(score, expected):
    assert class_name_for_score(score, CFG) == expected


# --- promotion is immediate --------------------------------------------------


def test_promotion_is_immediate_on_crossing():
    # rolling score jumps straight from 0 to 3600 (Elite) in one day
    daily = {d(0): 0.0, d(1): 3600.0}
    classes = classes_with_hysteresis(rolling_scores(daily, CFG), CFG)
    by_date = {c.date: c.class_name for c in classes}
    assert by_date[d(0)] == "Outsider"
    assert by_date[d(1)] == "Elite"


def test_promotion_can_skip_multiple_bands_at_once():
    daily = {d(0): 3600.0}
    classes = classes_with_hysteresis(rolling_scores(daily, CFG), CFG)
    assert classes[0].class_name == "Elite"


# --- demotion is delayed -----------------------------------------------------


def _rolling_history(scores_by_offset: dict[int, float]) -> dict[date, float]:
    return {d(off): score for off, score in scores_by_offset.items()}


def test_demotion_requires_seven_consecutive_days_below_threshold():
    cfg = ScoringConfig(rolling_window_days=1)  # use rolling==daily for a simple test
    # Start solidly in Commoner (threshold 300, so demotion line = 270)
    # then drop to 250 (>10% below 300) for 6 days -- should NOT demote yet.
    daily = {d(0): 500.0}
    for i in range(1, 7):
        daily[d(i)] = 250.0
    classes = classes_with_hysteresis(rolling_scores(daily, cfg), cfg)
    by_date = {c.date: c.class_name for c in classes}
    assert by_date[d(0)] == "Commoner"
    for i in range(1, 7):
        assert by_date[d(i)] == "Commoner", f"day {i} should not have demoted yet"


def test_demotion_fires_on_seventh_consecutive_day():
    cfg = ScoringConfig(rolling_window_days=1)
    daily = {d(0): 500.0}
    for i in range(1, 8):
        daily[d(i)] = 250.0  # 250 < 270 (10% below 300) for 7 days
    classes = classes_with_hysteresis(rolling_scores(daily, cfg), cfg)
    by_date = {c.date: c.class_name for c in classes}
    assert by_date[d(7)] == "Outsider"
    # confirm it was still Commoner the day before
    assert by_date[d(6)] == "Commoner"


def test_demotion_streak_resets_if_score_recovers():
    cfg = ScoringConfig(rolling_window_days=1)
    daily = {d(0): 500.0}
    for i in range(1, 7):
        daily[d(i)] = 250.0  # 6 days below the line
    daily[d(7)] = 500.0  # recovers for one day -- streak should reset
    for i in range(8, 14):
        daily[d(i)] = 250.0  # another 6 days below (not yet 7 in a row)
    classes = classes_with_hysteresis(rolling_scores(daily, cfg), cfg)
    by_date = {c.date: c.class_name for c in classes}
    assert by_date[d(13)] == "Commoner"  # only 6 consecutive days below since the reset


def test_not_below_by_more_than_ten_percent_never_demotes():
    cfg = ScoringConfig(rolling_window_days=1)
    daily = {d(0): 500.0}
    for i in range(1, 20):
        daily[d(i)] = 280.0  # below 300 but NOT below 270 (the 10% line)
    classes = classes_with_hysteresis(rolling_scores(daily, cfg), cfg)
    assert all(c.class_name == "Commoner" for c in classes)


def test_lowest_class_never_demotes_further():
    cfg = ScoringConfig(rolling_window_days=1)
    daily = {d(i): 0.0 for i in range(20)}
    classes = classes_with_hysteresis(rolling_scores(daily, cfg), cfg)
    assert all(c.class_name == "Outsider" for c in classes)


def test_score_classes_end_to_end():
    daily = {d(i): 200.0 for i in range(35)}
    classes = score_classes(daily, CFG)
    assert len(classes) == 35
