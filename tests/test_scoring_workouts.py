import math
from datetime import date

import pytest

from citizenship_score.config import ScoringConfig
from citizenship_score.models import Exercise, Set, Workout
from citizenship_score.scoring.workouts import (
    apply_weekly_consistency,
    best_e1rm_by_exercise,
    daily_workout_points,
    distinct_set_type_ids,
    effort_multiplier,
    epley_e1rm,
    historical_best_e1rm,
    is_scoreable_set,
    progress_bonus_points,
    raw_session_points,
    resolve_body_weights,
    score_workout_history,
    set_load,
    workout_set_loads,
)

CFG = ScoringConfig(excluded_set_type_ids=frozenset({"warmup"}))


def make_set(**kwargs):
    defaults = dict(
        weight="100",
        reps="10",
        rir="2",
        duration="",
        distance="",
        set_type_id="working",
        is_completed=True,
        record_type="normal",
    )
    defaults.update(kwargs)
    return Set(**defaults)


def make_exercise(exercise_id="ex1", exercise_type="weight_reps", sets=None):
    return Exercise(
        exercise_id=exercise_id,
        excercise_name="Bench Press",
        exercise_type=exercise_type,
        sets=sets or [make_set()],
    )


def make_workout(workout_id, day, body_weight="80", exercises=None):
    return Workout(
        id=workout_id,
        title="Session",
        body_weight=body_weight,
        workout_perform_date=day,
        total_volume="0",
        exercises=exercises if exercises is not None else [make_exercise()],
    )


# --- RIR multipliers ---------------------------------------------------


@pytest.mark.parametrize(
    "rir,expected",
    [(0, 1.2), (1, 1.2), (2, 1.0), (3, 1.0), (4, 0.7), (10, 0.7), (None, 1.0)],
)
def test_effort_multiplier(rir, expected):
    assert effort_multiplier(rir, CFG) == expected


# --- set_load ------------------------------------------------------------


def test_set_load_formula():
    # (100 * 10 / 80) * 1.0 (rir=2 -> band 2-3 -> 1.0)
    assert set_load(100, 10, 2, 80, CFG) == pytest.approx((100 * 10 / 80) * 1.0)


def test_set_load_uses_default_body_weight_if_zero():
    assert set_load(100, 10, None, 0, CFG) == pytest.approx(
        (100 * 10 / CFG.default_body_weight) * 1.0
    )


# --- is_scoreable_set: warm-up / incomplete / non weight_reps exclusion --


def test_incomplete_flag_is_ignored():
    """`is_completed` is unreliable in real Lyfta data (whole workouts come
    back with it false even for clearly-performed sets), so a set with
    usable weight/reps still scores regardless of this flag."""
    ex = make_exercise(sets=[make_set(is_completed=False)])
    assert is_scoreable_set(ex, ex.sets[0], CFG) is True


def test_warmup_set_excluded():
    ex = make_exercise(sets=[make_set(set_type_id="warmup")])
    assert is_scoreable_set(ex, ex.sets[0], CFG) is False


def test_non_weight_reps_exercise_excluded():
    ex = make_exercise(exercise_type="cardio", sets=[make_set()])
    assert is_scoreable_set(ex, ex.sets[0], CFG) is False


def test_missing_weight_or_reps_excluded():
    ex = make_exercise(sets=[make_set(weight="")])
    assert is_scoreable_set(ex, ex.sets[0], CFG) is False


def test_normal_set_included():
    ex = make_exercise(sets=[make_set()])
    assert is_scoreable_set(ex, ex.sets[0], CFG) is True


def test_distinct_set_type_ids():
    w = make_workout(
        "1",
        date(2026, 1, 1),
        exercises=[make_exercise(sets=[make_set(set_type_id="working"), make_set(set_type_id="warmup")])],
    )
    assert distinct_set_type_ids([w]) == {"working", "warmup"}


# --- body weight resolution ----------------------------------------------


def test_resolve_body_weight_uses_most_recent_prior_when_missing():
    w1 = make_workout("1", date(2026, 1, 1), body_weight="80")
    w2 = make_workout("2", date(2026, 1, 5), body_weight="")
    resolved = resolve_body_weights([w1, w2], CFG)
    assert resolved["1"] == 80.0
    assert resolved["2"] == 80.0  # carried forward


def test_resolve_body_weight_falls_back_to_default_if_never_known():
    w1 = make_workout("1", date(2026, 1, 1), body_weight="")
    resolved = resolve_body_weights([w1], CFG)
    assert resolved["1"] == CFG.default_body_weight


def test_resolve_body_weight_does_not_look_forward():
    # Only a LATER workout has a known body weight; the earlier one should
    # NOT borrow it (fallback looks backward only).
    w1 = make_workout("1", date(2026, 1, 1), body_weight="")
    w2 = make_workout("2", date(2026, 1, 5), body_weight="80")
    resolved = resolve_body_weights([w1, w2], CFG)
    assert resolved["1"] == CFG.default_body_weight
    assert resolved["2"] == 80.0


# --- sqrt diminishing returns on session points --------------------------


def test_raw_session_points_sqrt_diminishing_returns():
    assert raw_session_points([100.0], CFG) == pytest.approx(10 * math.sqrt(100.0))
    # doubling load does not double points
    single = raw_session_points([100.0], CFG)
    double = raw_session_points([200.0], CFG)
    assert double < 2 * single


def test_raw_session_points_zero_when_no_loads():
    assert raw_session_points([], CFG) == 0.0


# --- second session same day scores at half ------------------------------


def test_second_session_same_day_scores_half():
    day = date(2026, 1, 1)
    w1 = make_workout("1", day)
    w2 = make_workout("2", day)
    daily = daily_workout_points([w1, w2], CFG)
    session1_points = daily[day].breakdown[0]["session_points"]
    session2_points = daily[day].breakdown[1]["session_points"]
    raw1 = daily[day].breakdown[0]["raw_session_points"]
    raw2 = daily[day].breakdown[1]["raw_session_points"]
    assert raw1 == pytest.approx(raw2)  # identical sessions -> identical raw points
    assert session2_points == pytest.approx(session1_points * 0.5)


def test_session_order_in_input_list_determines_first():
    day = date(2026, 1, 1)
    # w2 listed first, so it should get full credit even though its id sorts
    # after w1's -- ordering is by input position, not id.
    w2 = make_workout("2", day)
    w1 = make_workout("1", day)
    daily = daily_workout_points([w2, w1], CFG)
    assert daily[day].breakdown[0]["workout_id"] == "2"
    assert daily[day].breakdown[0]["same_day_factor"] == 1.0
    assert daily[day].breakdown[1]["workout_id"] == "1"
    assert daily[day].breakdown[1]["same_day_factor"] == 0.5


# --- progress bonus --------------------------------------------------------


def test_epley_formula():
    assert epley_e1rm(100, 10) == pytest.approx(100 * (1 + 10 / 30))


def test_no_bonus_without_prior_history():
    w = make_workout("1", date(2026, 2, 1))
    assert progress_bonus_points(w, [w], CFG) == 0.0


def test_bonus_awarded_when_beating_prior_best():
    old = make_workout(
        "1", date(2026, 1, 1), exercises=[make_exercise(sets=[make_set(weight="90", reps="10")])]
    )
    new = make_workout(
        "2", date(2026, 2, 1), exercises=[make_exercise(sets=[make_set(weight="120", reps="10")])]
    )
    bonus = progress_bonus_points(new, [old, new], CFG)
    assert bonus == CFG.progress_bonus_points


def test_no_bonus_when_not_beating_prior_best():
    old = make_workout(
        "1", date(2026, 1, 1), exercises=[make_exercise(sets=[make_set(weight="120", reps="10")])]
    )
    new = make_workout(
        "2", date(2026, 2, 1), exercises=[make_exercise(sets=[make_set(weight="90", reps="10")])]
    )
    bonus = progress_bonus_points(new, [old, new], CFG)
    assert bonus == 0.0


def test_bonus_capped_at_max_per_session():
    old_exercises = [
        make_exercise(exercise_id=f"ex{i}", sets=[make_set(weight="50", reps="5")]) for i in range(5)
    ]
    new_exercises = [
        make_exercise(exercise_id=f"ex{i}", sets=[make_set(weight="100", reps="5")]) for i in range(5)
    ]
    old = make_workout("1", date(2026, 1, 1), exercises=old_exercises)
    new = make_workout("2", date(2026, 2, 1), exercises=new_exercises)
    bonus = progress_bonus_points(new, [old, new], CFG)
    assert bonus == CFG.progress_bonus_points * CFG.progress_bonus_max_per_session


def test_history_outside_lookback_window_ignored():
    too_old = make_workout(
        "1", date(2025, 1, 1), exercises=[make_exercise(sets=[make_set(weight="90", reps="10")])]
    )
    new = make_workout(
        "2", date(2026, 2, 1), exercises=[make_exercise(sets=[make_set(weight="120", reps="10")])]
    )
    # too_old is way outside the 42-day lookback -> no history -> no bonus
    assert historical_best_e1rm("ex1", date(2026, 2, 1), [too_old], CFG) is None
    assert progress_bonus_points(new, [too_old, new], CFG) == 0.0


# --- weekly consistency multiplier ----------------------------------------


def test_weekly_consistency_multiplier_applied_when_target_met():
    cfg = ScoringConfig(excluded_set_type_ids=frozenset({"warmup"}), weekly_session_target=3)
    # Monday 2026-01-05 is the start of an ISO week; put 3 sessions in it.
    days = [date(2026, 1, 5), date(2026, 1, 6), date(2026, 1, 7)]
    workouts = [make_workout(str(i), d) for i, d in enumerate(days)]
    daily = daily_workout_points(workouts, cfg)
    final = apply_weekly_consistency(daily, cfg)
    for d in days:
        expected = (daily[d].session_points + daily[d].bonus_points) * cfg.weekly_consistency_multiplier
        assert final[d] == pytest.approx(expected)


def test_weekly_consistency_multiplier_not_applied_when_target_missed():
    cfg = ScoringConfig(excluded_set_type_ids=frozenset({"warmup"}), weekly_session_target=3)
    days = [date(2026, 1, 5), date(2026, 1, 6)]  # only 2 sessions
    workouts = [make_workout(str(i), d) for i, d in enumerate(days)]
    daily = daily_workout_points(workouts, cfg)
    final = apply_weekly_consistency(daily, cfg)
    for d in days:
        expected = daily[d].session_points + daily[d].bonus_points
        assert final[d] == pytest.approx(expected)


def test_score_workout_history_end_to_end():
    days = [date(2026, 1, 5), date(2026, 1, 6), date(2026, 1, 7)]
    workouts = [make_workout(str(i), d) for i, d in enumerate(days)]
    result = score_workout_history(workouts, ScoringConfig(excluded_set_type_ids=frozenset({"warmup"})))
    assert set(result.keys()) == set(days)
    assert all(v > 0 for v in result.values())
