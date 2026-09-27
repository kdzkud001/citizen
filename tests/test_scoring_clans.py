from datetime import date, timedelta

import pytest

from citizenship_score.config import ScoringConfig
from citizenship_score.scoring.clans import ClanMember, clan_score, participation_factor

CFG = ScoringConfig()
TODAY = date(2026, 1, 15)


def test_clan_score_full_participation():
    members = [
        ClanMember("a", rolling_score=1000.0, workout_dates=[TODAY]),
        ClanMember("b", rolling_score=2000.0, workout_dates=[TODAY - timedelta(days=1)]),
    ]
    # mean = 1500, participation = 1.0
    assert clan_score(members, TODAY, CFG) == pytest.approx(1500.0)


def test_clan_score_partial_participation():
    members = [
        ClanMember("a", rolling_score=1000.0, workout_dates=[TODAY]),
        ClanMember("b", rolling_score=2000.0, workout_dates=[TODAY - timedelta(days=30)]),  # stale
    ]
    # mean = 1500, participation = 0.5
    assert clan_score(members, TODAY, CFG) == pytest.approx(750.0)


def test_clan_score_zero_participation():
    members = [
        ClanMember("a", rolling_score=1000.0, workout_dates=[]),
        ClanMember("b", rolling_score=2000.0, workout_dates=[]),
    ]
    assert clan_score(members, TODAY, CFG) == 0.0


def test_clan_score_empty_clan():
    assert clan_score([], TODAY, CFG) == 0.0


def test_participation_factor_boundary_of_window():
    window_days = CFG.clan_participation_window_days
    edge_date = TODAY - timedelta(days=window_days - 1)  # oldest day still inside the window
    just_outside = TODAY - timedelta(days=window_days)  # one day too old
    members = [
        ClanMember("a", rolling_score=1000.0, workout_dates=[edge_date]),
        ClanMember("b", rolling_score=1000.0, workout_dates=[just_outside]),
    ]
    assert participation_factor(members, TODAY, CFG) == pytest.approx(0.5)
