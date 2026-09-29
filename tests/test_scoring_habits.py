from datetime import date, timedelta

from citizenship_score.config import ScoringConfig
from citizenship_score.models import HabitCompletion, HabitDefinition
from citizenship_score.scoring.habits import (
    balance_bonus_for_day,
    score_habit_completions,
    score_habits_for_day,
    weekly_consistency_bonus,
)

CFG = ScoringConfig()
MONDAY = date(2026, 1, 5)
SUNDAY = MONDAY + timedelta(days=6)


def habit(habit_id: str, category: str = "Discipline", weekly_target: int = 7, active: bool = True):
    return HabitDefinition(habit_id=habit_id, category=category, weekly_target=weekly_target, active=active)


def done(habit_id: str, day: date) -> HabitCompletion:
    return HabitCompletion(habit_id=habit_id, completed_on=day)


# --- per-completion points and the daily cap -------------------------------


def test_zero_completions_is_zero_points():
    assert score_habits_for_day(0, CFG) == 0.0


def test_points_scale_linearly_below_cap():
    assert score_habits_for_day(3, CFG) == 45.0


def test_cap_boundary_exact():
    # 6 completions * 15 = exactly 90, the cap
    assert score_habits_for_day(6, CFG) == 90.0
    assert score_habits_for_day(7, CFG) == 90.0


def test_duplicate_completions_same_day_count_once():
    habits = [habit("read", "Mind")]
    result = score_habit_completions([done("read", MONDAY), done("read", MONDAY)], habits, config=CFG)
    assert result[MONDAY] == 15.0


def test_empty_is_empty():
    assert score_habit_completions([], [], config=CFG) == {}


# --- balance bonus -----------------------------------------------------------


def test_balance_bonus_needs_three_distinct_categories():
    assert balance_bonus_for_day({"Mind", "Spirit"}, CFG) == 0.0
    assert balance_bonus_for_day({"Mind", "Spirit", "Body"}, CFG) == 15.0


def test_balance_bonus_same_category_counts_once():
    habits = [habit("a", "Mind"), habit("b", "Mind"), habit("c", "Spirit")]
    result = score_habit_completions([done(h, MONDAY) for h in "abc"], habits, config=CFG)
    assert result[MONDAY] == 45.0  # 3 * 15, only 2 distinct categories -> no bonus


def test_balance_bonus_awarded_on_top_of_capped_points():
    habits = [habit(f"h{i}", cat) for i, cat in enumerate(["Mind", "Spirit", "Body"] * 3)]
    result = score_habit_completions([done(h.habit_id, MONDAY) for h in habits], habits, config=CFG)
    assert result[MONDAY] == 90.0 + 15.0  # 9 completions capped at 90, then the bonus


def test_scored_workout_counts_as_fitness_for_balance():
    habits = [habit("read", "Mind"), habit("bible", "Spirit")]
    completions = [done("read", MONDAY), done("bible", MONDAY)]

    without_workout = score_habit_completions(completions, habits, workout_days=[], config=CFG)
    with_workout = score_habit_completions(completions, habits, workout_days=[MONDAY], config=CFG)

    assert without_workout[MONDAY] == 30.0
    assert with_workout[MONDAY] == 30.0 + 15.0


def test_fitness_habit_and_workout_same_day_is_one_category():
    habits = [habit("read", "Mind"), habit("walk", "Fitness")]
    completions = [done("read", MONDAY), done("walk", MONDAY)]
    result = score_habit_completions(completions, habits, workout_days=[MONDAY], config=CFG)
    assert result[MONDAY] == 30.0  # Mind + Fitness = 2 categories


# --- weekly consistency bonus -----------------------------------------------


def test_weekly_bonus_credited_on_sunday_when_target_met():
    habits = [habit("read", "Mind", weekly_target=3)]
    completions = [done("read", MONDAY + timedelta(days=i)) for i in range(3)]
    assert weekly_consistency_bonus(habits, completions, CFG) == {SUNDAY: 25.0}


def test_weekly_bonus_not_awarded_below_target():
    habits = [habit("read", "Mind", weekly_target=4)]
    completions = [done("read", MONDAY + timedelta(days=i)) for i in range(3)]
    assert weekly_consistency_bonus(habits, completions, CFG) == {}


def test_weekly_bonus_weeks_are_monday_to_sunday():
    habits = [habit("read", "Mind", weekly_target=2)]
    # Sunday + following Monday straddle two weeks: 1 completion in each.
    completions = [done("read", SUNDAY), done("read", SUNDAY + timedelta(days=1))]
    assert weekly_consistency_bonus(habits, completions, CFG) == {}


def test_weekly_bonus_waits_for_the_week_to_close():
    habits = [habit("read", "Mind", weekly_target=1)]
    completions = [done("read", MONDAY)]
    # Target met on Monday, but Sunday hasn't arrived as of Wednesday.
    assert weekly_consistency_bonus(habits, completions, CFG, as_of=MONDAY + timedelta(days=2)) == {}
    assert weekly_consistency_bonus(habits, completions, CFG, as_of=SUNDAY) == {SUNDAY: 25.0}


def test_weekly_bonus_capped_at_max_habits():
    habits = [habit(f"h{i}", weekly_target=1) for i in range(10)]
    completions = [done(h.habit_id, MONDAY) for h in habits]
    assert weekly_consistency_bonus(habits, completions, CFG) == {SUNDAY: 6 * 25.0}


def test_weekly_bonus_counts_archived_habits():
    habits = [habit("read", "Mind", weekly_target=1, active=False)]
    assert weekly_consistency_bonus(habits, [done("read", MONDAY)], CFG) == {SUNDAY: 25.0}


def test_weekly_bonus_added_to_sunday_total():
    habits = [habit("read", "Mind", weekly_target=7)]
    completions = [done("read", MONDAY + timedelta(days=i)) for i in range(7)]
    result = score_habit_completions(completions, habits, config=CFG, as_of=SUNDAY)
    assert result[MONDAY] == 15.0
    assert result[SUNDAY] == 15.0 + 25.0
