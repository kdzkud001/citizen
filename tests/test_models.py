from datetime import date

from citizenship_score.models import Exercise, HabitCompletion, Set, Workout


def test_set_parses_empty_strings_as_none():
    s = Set(
        weight="",
        reps="",
        rir="",
        duration="",
        distance="",
        set_type_id="1",
        is_completed=True,
        record_type="normal",
    )
    assert s.weight is None
    assert s.reps is None
    assert s.rir is None
    assert s.duration is None
    assert s.distance is None


def test_set_parses_literal_null_string_as_none():
    # Real API data has been observed sending the literal string "null"
    # (not just "") for empty numeric fields.
    s = Set(weight="100", reps="8", rir="null", duration="null", distance="Null", set_type_id="1")
    assert s.rir is None
    assert s.duration is None
    assert s.distance is None


def test_set_parses_numeric_strings():
    s = Set(weight="100.5", reps="8", rir="2", duration="", distance="", set_type_id="1")
    assert s.weight == 100.5
    assert s.reps == 8
    assert s.rir == 2


def test_set_parses_plain_seconds_duration():
    s = Set(duration="90", set_type_id="1")
    assert s.duration == 90.0


def test_set_parses_mm_ss_duration():
    # Real API data has been observed sending "MM:SS" for timed sets.
    s = Set(duration="2:30", set_type_id="1")
    assert s.duration == 150.0


def test_set_parses_hh_mm_ss_duration():
    s = Set(duration="1:02:30", set_type_id="1")
    assert s.duration == 3750.0


def test_set_defaults():
    s = Set()
    assert s.is_completed is False
    assert s.set_type_id is None


def test_exercise_accepts_misspelled_api_field():
    ex = Exercise(exercise_id=123, excercise_name="Bench Press", exercise_type="weight_reps", sets=[])
    assert ex.exercise_id == "123"
    assert ex.exercise_name == "Bench Press"


def test_exercise_accepts_correct_spelling_too():
    ex = Exercise(exercise_id="1", exercise_name="Squat", exercise_type="weight_reps")
    assert ex.exercise_name == "Squat"


def test_workout_parses_date_and_body_weight():
    w = Workout(
        id=1,
        title="Push Day",
        body_weight="82.3",
        workout_perform_date="2026-01-15",
        total_volume="1200",
        exercises=[],
    )
    assert w.id == "1"
    assert w.body_weight == 82.3
    assert w.workout_perform_date == date(2026, 1, 15)
    assert w.total_volume == 1200.0


def test_workout_parses_iso_datetime_string():
    w = Workout(
        id=2,
        workout_perform_date="2026-01-15T10:30:00Z",
        body_weight=None,
    )
    assert w.workout_perform_date == date(2026, 1, 15)


def test_workout_missing_body_weight_is_none():
    w = Workout(id=3, workout_perform_date="2026-01-15", body_weight="")
    assert w.body_weight is None


def test_habit_completion_roundtrip():
    h = HabitCompletion(habit_id="drink-water", completed_on="2026-01-15")
    assert h.habit_id == "drink-water"
    assert h.completed_on == date(2026, 1, 15)
