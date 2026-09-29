"""
Pydantic data models for Lyfta workouts and habit completions.

The Lyfta API reports several numeric fields as strings, and some of those
strings may be empty (meaning "no value"). All parsing of that raw shape
happens here, at the model boundary, so the rest of the codebase only ever
sees clean `float | None` / `int | None` values.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


_NULL_LIKE_STRINGS = {"", "null", "none", "nan"}


def _empty_to_none(value: Any) -> Any:
    """
    Treat an empty/whitespace-only string, or the literal strings "null" /
    "none" (seen in real API responses, case-insensitive), as "no value".
    """
    if isinstance(value, str) and value.strip().lower() in _NULL_LIKE_STRINGS:
        return None
    return value


def _to_float(value: Any) -> float | None:
    value = _empty_to_none(value)
    if value is None:
        return None
    return float(value)


def _to_int(value: Any) -> int | None:
    value = _empty_to_none(value)
    if value is None:
        return None
    # Tolerate numeric strings like "3.0" as well as plain "3".
    return int(float(value))


def _to_duration_seconds(value: Any) -> float | None:
    """
    Parse a set's `duration` field. Real API data has been observed sending
    plain seconds ("90"), but also "MM:SS" / "HH:MM:SS" strings for timed
    (e.g. cardio/hold) sets. Converts either shape to total seconds.
    """
    value = _empty_to_none(value)
    if value is None:
        return None
    if isinstance(value, str) and ":" in value:
        parts = [float(p) for p in value.split(":")]
        seconds = 0.0
        for part in parts:
            seconds = seconds * 60 + part
        return seconds
    return float(value)


class Set(BaseModel):
    """A single set within an exercise."""

    weight: float | None = None
    reps: int | None = None
    rir: int | None = None
    duration: float | None = None
    distance: float | None = None
    set_type_id: str | None = None
    is_completed: bool = False
    record_type: str | None = None

    @field_validator("weight", "distance", mode="before")
    @classmethod
    def _parse_float_fields(cls, value: Any) -> float | None:
        return _to_float(value)

    @field_validator("duration", mode="before")
    @classmethod
    def _parse_duration_field(cls, value: Any) -> float | None:
        return _to_duration_seconds(value)

    @field_validator("reps", "rir", mode="before")
    @classmethod
    def _parse_int_fields(cls, value: Any) -> int | None:
        return _to_int(value)

    @field_validator("set_type_id", mode="before")
    @classmethod
    def _coerce_set_type_id(cls, value: Any) -> str | None:
        if value is None:
            return None
        return str(value)


class Exercise(BaseModel):
    """
    One exercise within a workout. Note the API misspells `excercise_name`
    -- we accept that on the wire but expose the correctly spelled
    `exercise_name` attribute internally.
    """

    model_config = ConfigDict(populate_by_name=True)

    exercise_id: str
    exercise_name: str | None = Field(default=None, alias="excercise_name")
    exercise_type: str | None = None
    sets: list[Set] = Field(default_factory=list)

    @field_validator("exercise_id", mode="before")
    @classmethod
    def _coerce_exercise_id(cls, value: Any) -> str:
        return str(value)


class Workout(BaseModel):
    """A single workout session as returned by the Lyfta API."""

    id: str
    title: str | None = None
    body_weight: float | None = None
    workout_perform_date: date
    total_volume: float | None = None
    exercises: list[Exercise] = Field(default_factory=list)

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_id(cls, value: Any) -> str:
        return str(value)

    @field_validator("body_weight", "total_volume", mode="before")
    @classmethod
    def _parse_float_fields(cls, value: Any) -> float | None:
        return _to_float(value)

    @field_validator("workout_perform_date", mode="before")
    @classmethod
    def _parse_date(cls, value: Any) -> Any:
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return datetime.fromisoformat(value).date()
        return value


class HabitDefinition(BaseModel):
    """A user-defined habit: which category it counts toward and how many
    days a week the user aims to do it."""

    habit_id: str
    category: str
    weekly_target: int = Field(default=7, ge=1, le=7)
    active: bool = True


class HabitCompletion(BaseModel):
    """A single completed habit on a given day."""

    habit_id: str
    completed_on: date
