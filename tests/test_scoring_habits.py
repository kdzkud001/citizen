from datetime import date

from citizenship_score.config import ScoringConfig
from citizenship_score.models import HabitCompletion
from citizenship_score.scoring.habits import score_habit_completions, score_habits_for_day

CFG = ScoringConfig()


def test_zero_completions_is_zero_points():
    assert score_habits_for_day(0, CFG) == 0.0


def test_points_scale_linearly_below_cap():
    assert score_habits_for_day(3, CFG) == 30.0


def test_daily_cap_applies():
    # 10 completions * 10 points = 100, capped at 50
    assert score_habits_for_day(10, CFG) == 50.0


def test_cap_boundary_exact():
    # 5 completions * 10 = exactly 50, the cap
    assert score_habits_for_day(5, CFG) == 50.0
    assert score_habits_for_day(6, CFG) == 50.0


def test_score_habit_completions_groups_by_day():
    completions = [
        HabitCompletion(habit_id="water", completed_on=date(2026, 1, 1)),
        HabitCompletion(habit_id="stretch", completed_on=date(2026, 1, 1)),
        HabitCompletion(habit_id="water", completed_on=date(2026, 1, 2)),
    ]
    result = score_habit_completions(completions, CFG)
    assert result[date(2026, 1, 1)] == 20.0
    assert result[date(2026, 1, 2)] == 10.0


def test_score_habit_completions_empty_list():
    assert score_habit_completions([], CFG) == {}
