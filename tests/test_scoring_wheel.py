from datetime import date, timedelta

import pytest

from citizenship_score.config import ScoringConfig
from citizenship_score.models import HabitCompletion, HabitDefinition
from citizenship_score.scoring.wheel import wellness_wheel

CFG = ScoringConfig()
END = date(2026, 2, 1)


def habit(habit_id, category, weekly_target=7, active=True):
    return HabitDefinition(habit_id=habit_id, category=category, weekly_target=weekly_target, active=active)


def daily(habit_id, days, end=END):
    return [HabitCompletion(habit_id=habit_id, completed_on=end - timedelta(days=i)) for i in range(days)]


def wheel(habits=(), completions=(), sessions=(), weekly_session_target=3, lyfta=False, end=END, days=28):
    spokes = wellness_wheel(habits, completions, sessions, weekly_session_target, lyfta, end, days, CFG)
    return {s.category: s for s in spokes}


def test_one_spoke_per_category_in_config_order():
    spokes = wellness_wheel([], [], [], 3, False, END, 28, CFG)
    assert [s.category for s in spokes] == list(CFG.habit_categories)


def test_habit_category_percent():
    # Daily habit (target 7/week) done 14 of 28 days -> 14 / 28 = 50%.
    result = wheel([habit("read", "Mind")], daily("read", 14))
    assert result["Mind"].completions == 14
    assert result["Mind"].target == pytest.approx(28)
    assert result["Mind"].percent == pytest.approx(50.0)
    assert result["Mind"].tracking is True


def test_targets_sum_across_a_categorys_habits():
    habits = [habit("read", "Mind", 7), habit("puzzle", "Mind", 3)]
    result = wheel(habits, daily("read", 28))
    assert result["Mind"].target == pytest.approx((7 + 3) * 4)  # 40 over 4 weeks
    assert result["Mind"].percent == pytest.approx(70.0)


def test_percent_capped_at_100():
    habits = [habit("read", "Mind", weekly_target=1)]
    result = wheel(habits, daily("read", 28))  # 28 completions vs a target of 4
    assert result["Mind"].percent == 100.0


def test_no_active_habits_means_not_tracking():
    result = wheel([habit("read", "Mind", active=False)], daily("read", 28))
    assert result["Mind"].tracking is False
    assert result["Mind"].percent == 0.0
    assert result["Spirit"].tracking is False


def test_archived_habit_completions_excluded():
    habits = [habit("read", "Mind"), habit("old", "Mind", active=False)]
    result = wheel(habits, daily("read", 7) + daily("old", 28))
    assert result["Mind"].completions == 7


def test_completions_outside_window_ignored():
    old = [HabitCompletion(habit_id="read", completed_on=END - timedelta(days=28))]  # day 29
    result = wheel([habit("read", "Mind")], old)
    assert result["Mind"].completions == 0


def test_fitness_counts_sessions_against_session_target_when_connected():
    sessions = [END - timedelta(days=i) for i in range(0, 28, 2)]  # 14 sessions
    result = wheel(sessions=sessions, weekly_session_target=3, lyfta=True)
    assert result["Fitness"].tracking is True
    assert result["Fitness"].completions == 14
    assert result["Fitness"].target == pytest.approx(12)  # 3/week * 4 weeks
    assert result["Fitness"].percent == 100.0


def test_fitness_combines_sessions_and_fitness_habits():
    habits = [habit("walk", "Fitness", weekly_target=2)]
    sessions = [END - timedelta(days=i) for i in range(6)]  # 6 sessions
    result = wheel(habits, daily("walk", 4), sessions, weekly_session_target=3, lyfta=True)
    assert result["Fitness"].completions == 6 + 4
    assert result["Fitness"].target == pytest.approx((3 + 2) * 4)
    assert result["Fitness"].percent == pytest.approx(50.0)


def test_fitness_not_tracking_without_habits_or_lyfta():
    sessions = [END]  # stale sessions from a since-disconnected account
    result = wheel(sessions=sessions, lyfta=False)
    assert result["Fitness"].tracking is False
    assert result["Fitness"].percent == 0.0


def test_fitness_tracks_with_habits_but_no_lyfta():
    habits = [habit("walk", "Fitness", weekly_target=7)]
    result = wheel(habits, daily("walk", 7), lyfta=False)
    assert result["Fitness"].tracking is True
    assert result["Fitness"].target == pytest.approx(28)  # no session target without Lyfta


def test_previous_window_is_the_n_days_before():
    habits = [habit("read", "Mind")]
    # Done every day of the previous window only.
    completions = daily("read", 28, end=END - timedelta(days=28))
    current = wheel(habits, completions, end=END)
    previous = wheel(habits, completions, end=END - timedelta(days=28))
    assert current["Mind"].percent == 0.0
    assert previous["Mind"].percent == 100.0


def test_custom_window_length_scales_target():
    habits = [habit("read", "Mind", weekly_target=7)]
    result = wheel(habits, daily("read", 7), days=7)
    assert result["Mind"].target == pytest.approx(7)
    assert result["Mind"].percent == 100.0
