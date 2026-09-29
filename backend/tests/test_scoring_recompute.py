from datetime import date, timedelta

from citizenship_score.config import DEFAULT_CONFIG
from citizenship_score.models import Workout
from citizenship_score.scoring.workouts import score_workout_history

from app.models.daily_score import DailyScore
from app.models.profile import Profile
from app.models.workout import WorkoutRecord
from app.services.scoring import build_score_history, recompute_user_scores

RAW_WORKOUT = {
    "id": "1",
    "title": "Leg Day",
    "body_weight": "80",
    "workout_perform_date": "2026-01-10",
    "total_volume": "0",
    "exercises": [
        {
            "exercise_id": "1",
            "excercise_name": "Squat",
            "exercise_type": "weight_reps",
            "sets": [
                {
                    "weight": "100",
                    "reps": "10",
                    "rir": "2",
                    "duration": "",
                    "distance": "",
                    "set_type_id": "0",
                    "is_completed": True,
                    "record_type": None,
                }
            ],
        }
    ],
}


def test_build_score_history_matches_phase0_pipeline_on_activity_day():
    """The DB-facing wrapper must not silently diverge from what the raw
    citizenship_score pipeline itself computes for that day."""
    as_of = date(2026, 1, 10)
    rows = build_score_history([RAW_WORKOUT], [], [], DEFAULT_CONFIG, as_of=as_of)
    row = next(r for r in rows if r["date"] == as_of)

    expected = score_workout_history([Workout.model_validate(RAW_WORKOUT)], DEFAULT_CONFIG)[as_of]
    assert row["workout_points"] == expected
    assert row["rolling_score"] == expected  # the only day of activity in the 28-day window
    assert row["habit_points"] == 0.0


def test_decay_through_today_with_no_new_activity():
    """A stale user (no new workouts) must still show a decayed rolling
    score as of today, not the score frozen at their last activity."""
    activity_day = date(2026, 1, 10)
    far_future = activity_day + timedelta(days=DEFAULT_CONFIG.rolling_window_days + 5)

    rows = build_score_history([RAW_WORKOUT], [], [], DEFAULT_CONFIG, as_of=far_future)
    today_row = next(r for r in rows if r["date"] == far_future)

    assert today_row["rolling_score"] == 0.0  # the one workout has fallen out of the window
    assert today_row["class_name"] == "Outsider"


def test_recompute_user_scores_persists_daily_scores(db_session, user_id):
    uid = user_id
    db_session.add(Profile(id=uid))
    db_session.add(
        WorkoutRecord(
            user_id=uid,
            lyfta_workout_id="1",
            perform_date=date(2026, 1, 10),
            raw_json=RAW_WORKOUT,
        )
    )
    db_session.commit()

    recompute_user_scores(db_session, uid, as_of=date(2026, 1, 10))

    row = db_session.get(DailyScore, (uid, date(2026, 1, 10)))
    assert row is not None
    assert row.workout_points > 0
    assert row.rolling_score == row.workout_points


def test_recompute_is_deterministic(db_session, user_id):
    uid = user_id
    db_session.add(Profile(id=uid))
    db_session.add(
        WorkoutRecord(
            user_id=uid, lyfta_workout_id="1", perform_date=date(2026, 1, 10), raw_json=RAW_WORKOUT
        )
    )
    db_session.commit()

    recompute_user_scores(db_session, uid, as_of=date(2026, 1, 10))
    first = db_session.get(DailyScore, (uid, date(2026, 1, 10))).rolling_score

    recompute_user_scores(db_session, uid, as_of=date(2026, 1, 10))
    second = db_session.get(DailyScore, (uid, date(2026, 1, 10))).rolling_score

    assert first == second
