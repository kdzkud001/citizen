"""
Every tunable constant for the scoring engine lives here, so the formulas can
be adjusted without touching the scoring code itself.
"""

from __future__ import annotations

from dataclasses import dataclass


# --------------------------------------------------------------------------
# Lyfta API
# --------------------------------------------------------------------------

LYFTA_LIVE_BASE_URL = "https://my.lyfta.app/api/v1"
LYFTA_SANDBOX_BASE_URL = "https://my.lyfta.app/api/sandbox/v1"

# Requests per minute / per day the Lyfta API allows. The client throttles to
# stay under these.
LYFTA_RATE_LIMIT_PER_MINUTE = 60
LYFTA_RATE_LIMIT_PER_DAY = 5000

# Base delay (seconds) for exponential backoff on 429/5xx responses.
LYFTA_BACKOFF_BASE_SECONDS = 1.0
LYFTA_BACKOFF_MAX_RETRIES = 5

# Lyfta `set_type_id` legend (confirmed against real account data):
#   "0" -> normal
#   "1" -> warm-up
#   "2" -> left (unilateral exercise, left side)
#   "3" -> right (unilateral exercise, right side)
#   "5" -> drop set
#   "7" -> partial reps
# Only "1" (warm-up) is excluded from scoring; left/right/partial-rep sets
# still count.
EXCLUDED_SET_TYPE_IDS: frozenset[str] = frozenset({"1"})

# Only this exercise_type is scored in Phase 0. Everything else (cardio etc.)
# scores 0 but is still modeled, so a scorer can be plugged in later.
SCORED_EXERCISE_TYPES: frozenset[str] = frozenset({"weight_reps"})


# --------------------------------------------------------------------------
# Set load (per-set scoring)
# --------------------------------------------------------------------------

# RIR (reps in reserve) -> effort multiplier E. Checked in order; first
# matching (lo, hi) band wins. `hi` of None means "and above".
RIR_EFFORT_BANDS: tuple[tuple[int, int | None, float], ...] = (
    (0, 1, 1.2),
    (2, 3, 1.0),
    (4, None, 0.7),
)
RIR_EFFORT_DEFAULT = 1.0  # used when rir is missing

# Fallback body weight (in whatever unit the API reports, e.g. kg) used when
# a workout has no body_weight AND the user has no prior known body weight.
DEFAULT_BODY_WEIGHT = 75.0


# --------------------------------------------------------------------------
# Session points
# --------------------------------------------------------------------------

SESSION_POINTS_MULTIPLIER = 10.0

# Only the first session of a calendar day scores fully; later same-day
# sessions score at this fraction.
ADDITIONAL_SESSION_SAME_DAY_FACTOR = 0.5


# --------------------------------------------------------------------------
# Progress bonus
# --------------------------------------------------------------------------

PROGRESS_BONUS_POINTS = 15.0
PROGRESS_BONUS_MAX_PER_SESSION = 3
PROGRESS_BONUS_LOOKBACK_DAYS = 42  # "previous 6 weeks", strictly before the session date


# --------------------------------------------------------------------------
# Weekly consistency
# --------------------------------------------------------------------------

DEFAULT_WEEKLY_SESSION_TARGET = 3
WEEKLY_CONSISTENCY_MULTIPLIER = 1.2


# --------------------------------------------------------------------------
# Habits
# --------------------------------------------------------------------------

HABIT_POINTS_PER_COMPLETION = 10.0
HABIT_DAILY_POINTS_CAP = 50.0


# --------------------------------------------------------------------------
# Rolling score / classes
# --------------------------------------------------------------------------

ROLLING_WINDOW_DAYS = 28

# (name, lower_threshold_inclusive). Ordered lowest -> highest. A score
# belongs to the highest band whose lower threshold it meets or exceeds.
CLASS_THRESHOLDS: tuple[tuple[str, float], ...] = (
    ("Outsider", float("-inf")),
    ("Commoner", 300.0),
    ("Citizen", 1000.0),
    ("Noble", 2000.0),
    ("Elite", 3500.0),
)

# Demotion only fires after the rolling score has stayed more than this
# fraction below the current class's lower threshold for
# DEMOTION_CONSECUTIVE_DAYS consecutive days.
DEMOTION_THRESHOLD_FRACTION = 0.10
DEMOTION_CONSECUTIVE_DAYS = 7


# --------------------------------------------------------------------------
# Clans
# --------------------------------------------------------------------------

CLAN_PARTICIPATION_WINDOW_DAYS = 7


@dataclass(frozen=True)
class ScoringConfig:
    """
    Bundles the tunables actually threaded through the scoring functions, so
    call sites can override a value (e.g. in tests) without monkeypatching
    module globals. Defaults mirror the module-level constants above.
    """

    excluded_set_type_ids: frozenset[str] = EXCLUDED_SET_TYPE_IDS
    scored_exercise_types: frozenset[str] = SCORED_EXERCISE_TYPES
    rir_effort_bands: tuple[tuple[int, int | None, float], ...] = RIR_EFFORT_BANDS
    rir_effort_default: float = RIR_EFFORT_DEFAULT
    default_body_weight: float = DEFAULT_BODY_WEIGHT
    session_points_multiplier: float = SESSION_POINTS_MULTIPLIER
    additional_session_same_day_factor: float = ADDITIONAL_SESSION_SAME_DAY_FACTOR
    progress_bonus_points: float = PROGRESS_BONUS_POINTS
    progress_bonus_max_per_session: int = PROGRESS_BONUS_MAX_PER_SESSION
    progress_bonus_lookback_days: int = PROGRESS_BONUS_LOOKBACK_DAYS
    weekly_session_target: int = DEFAULT_WEEKLY_SESSION_TARGET
    weekly_consistency_multiplier: float = WEEKLY_CONSISTENCY_MULTIPLIER
    habit_points_per_completion: float = HABIT_POINTS_PER_COMPLETION
    habit_daily_points_cap: float = HABIT_DAILY_POINTS_CAP
    rolling_window_days: int = ROLLING_WINDOW_DAYS
    class_thresholds: tuple[tuple[str, float], ...] = CLASS_THRESHOLDS
    demotion_threshold_fraction: float = DEMOTION_THRESHOLD_FRACTION
    demotion_consecutive_days: int = DEMOTION_CONSECUTIVE_DAYS
    clan_participation_window_days: int = CLAN_PARTICIPATION_WINDOW_DAYS


DEFAULT_CONFIG = ScoringConfig()
