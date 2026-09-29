from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class DailyScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date
    workout_points: float
    habit_points: float
    rolling_score: float
    class_name: str


class ScoreSummary(BaseModel):
    today: DailyScoreOut
    points_to_next_class: float | None
    history: list[DailyScoreOut]


class SessionBreakdown(BaseModel):
    workout_id: str
    title: str | None
    body_weight: float
    scored_sets: int
    set_loads: list[float]
    raw_session_points: float
    same_day_factor: float
    session_points: float
    bonus_points: float


class DailyWorkoutsOut(BaseModel):
    date: date
    sessions: list[SessionBreakdown]


class WheelSpokeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: str
    percent: float
    completions: int
    target: float
    tracking: bool


class WheelWindowOut(BaseModel):
    start: date
    end: date
    spokes: list[WheelSpokeOut]


class WheelOut(BaseModel):
    days: int
    current: WheelWindowOut
    previous: WheelWindowOut
