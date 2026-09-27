# Citizenship Score — Phase 0

Pure-Python scoring engine for the gamified habit/workout tracker. This phase covers **only**
the scoring engine: no web server, no database, no UI. Everything here is designed to be
imported later by a FastAPI backend.

## Setup

Requires Python 3.11+.

```bash
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -e ".[dev]"

cp .env.example .env   # then fill in your real LYFTA_API_KEY
```

`LYFTA_API_KEY` is only needed for the live `fetch` command. The `sandbox` command works
without any key. `.env` is gitignored — never commit it.

Run the tests:

```bash
pytest
```

## CLI

Installed as the `citizenship-score` console script (or run as `python -m citizenship_score.cli`).

```bash
# Pull your own workouts from the live API and save the raw JSON to data/raw/
citizenship-score fetch [--from YYYY-MM-DD] [--to YYYY-MM-DD]

# Score a saved raw JSON file (defaults to the most recently fetched one)
citizenship-score score [--in path/to/file.json] [--habits path/to/habits.json]
                         [--exclude-set-types "0,2"] [--as-of YYYY-MM-DD]

# Fetch from the sandbox endpoint (no auth) and run the full pipeline on it
citizenship-score sandbox [--habits ...] [--exclude-set-types ...] [--as-of ...]

# Generate synthetic daily histories and print class transitions, to
# sanity-check the promotion/demotion hysteresis
citizenship-score simulate [--scenario consistent|quits|both] [--days 120]
```

`score` and `sandbox` both print:
- the distinct `set_type_id`s seen in the data (legend: `0`=normal, `1`=warm-up, `2`=left,
  `3`=right, `5`=drop set, `7`=partial reps. `config.EXCLUDED_SET_TYPE_IDS` excludes `1`
  by default — pass `--exclude-set-types` to override for a single run)
- a per-session breakdown: scored sets, set loads, session points, progress bonus
- weekly totals, including whether the consistency multiplier applied
- the rolling score and class as of the latest day in the data (or `--as-of`)

`--habits` optionally takes a JSON file of `[{"habit_id": "...", "completed_on": "YYYY-MM-DD"}, ...]`
to fold habit points into the same daily total. There's no habit storage in this phase — this is
just a convenience for exercising `scoring/habits.py` end-to-end.

Raw fetched JSON is always saved under `data/raw/` (gitignored) before scoring, so historical
data can be rescored later without refetching, once the formulas change.

## Scoring formulas

All constants live in `src/citizenship_score/config.py` — nothing below is hardcoded in the
scoring functions.

**Set load** (non-warm-up, `weight_reps` sets with usable weight/reps only):
```
set_load = (weight * reps / body_weight) * E
E from RIR: 0-1 -> 1.2, 2-3 -> 1.0, 4+ -> 0.7, missing -> 1.0
```
If `body_weight` is missing for a session, the most recently known body weight (looking
backward in time only) is used; if none is known yet, a configurable default.

**Session points**: `10 * sqrt(sum of that session's set loads)`. Only the first session of a
calendar day scores fully; later sessions that day score at 0.5x. "First" is determined by each
workout's position in the input list — see **Assumptions** below.

**Progress bonus**: per exercise, estimated 1RM (Epley) = `weight * (1 + reps/30)`. If a
session's best e1RM for an exercise beats that exercise's best over the prior 6 weeks (42 days,
strictly before the session's date) — and prior history exists — +15 points, capped at 3 bonuses
per session.

**Weekly consistency**: if a user hits their weekly session target (default 3) in a Monday–Sunday
week, that week's workout points (sessions + bonuses) are multiplied by 1.2x.

**Habits**: 10 points per completed habit, capped at 50/day.

**Rolling score**: sum of (workout points + habit points) over the trailing 28 days, computed for
every calendar day (not just days with recorded activity — rest days still matter, since old
points fall out of the window).

**Class thresholds** (on rolling score): Outsider < 300, Commoner 300–1000, Citizen 1000–2000,
Noble 2000–3500, Elite 3500+. Promotion is immediate on crossing a threshold (and can skip
multiple bands in one day). Demotion only fires after the rolling score has stayed more than 10%
below the *current* class's lower threshold for 7 consecutive calendar days, and drops exactly one
class at a time — see **Assumptions**.

**Clan score**: `mean(members' rolling scores) * participation`, where participation = fraction of
members with at least one workout in the trailing 7 days.

Cardio and other non-`weight_reps` exercises score 0 for now; `is_scoreable_set` is the single
choke point to extend when a cardio scorer is added later.

## Assumptions

These were either called out as open questions before writing code, or surfaced while testing
against the real sandbox/live API and had to be resolved to get a working pipeline:

- **Same-day session ordering.** The Lyfta API only gives a calendar date
  (`workout_perform_date`), not a timestamp, so there's no reliable signal for which of two
  same-day sessions happened "first." `daily_workout_points` uses each workout's position in the
  caller-provided list as that signal — the CLI passes workouts in API-fetch order. If the API
  turns out to preserve real chronological order, this is correct as-is; if not, this is the one
  place to revisit (e.g. by using workout `id` as a proxy, or asking the API for a timestamp
  field this task's spec didn't mention).
- **Progress-bonus lookback** = 42 days strictly before the session's own date (same-day sessions
  are not treated as "history" for each other).
- **Rolling/clan windows are inclusive of "today"**: 28 days = `[today-27, today]`, clan
  participation = `[today-6, today]`.
- **Demotion is single-step per qualifying 7-day period**, not a snap straight to whatever band
  the score currently falls in. A user who crashes from Elite to near-zero drops one class every
  time a fresh 7-consecutive-day violation completes, rather than falling straight to Outsider in
  one move. This reads as more in the spirit of "hysteresis" (gradual, resistant to whiplash) but
  is a judgment call, flagged before implementation and not corrected, so implemented as stated.
- **`simulate`'s two scenarios** ("consistent" and "quits after 3 weeks") are a synthetic 3x/week
  (Mon/Wed/Fri) session generator with a fixed points-per-session value, starting from a fixed
  epoch date for reproducible output. No specific parameters were given for these, so the values
  were chosen to comfortably demonstrate promotion and (in the "quits" case) delayed demotion
  within a ~90-120 day window.
- **Real-data surprises found via testing against the live/sandbox API** (not guesses — actually
  observed in responses):
  - Numeric-looking set fields (`duration`, `distance`, `rir`) sometimes arrive as the literal
    string `"null"` (not just `""`); both are treated as "no value."
  - `duration` is sometimes `"MM:SS"` or `"H:MM:SS"` rather than a plain number of seconds;
    parsed to total seconds either way. (Not currently used in scoring, since only `weight_reps`
    sets score in Phase 0, but the model has to parse it without crashing.)
  - The paginated response wraps the workout list under `"workouts"`, with `count`,
    `total_records`, `current_page`, `total_pages`, `limit` alongside it (confirmed against the
    live sandbox endpoint; the spec only said "fields: current_page, total_pages, limit").
  - Distinct `set_type_id`s actually seen on a real account: `0, 1, 2, 3, 5, 7`, resolved to:
    `0`=normal, `1`=warm-up, `2`=left, `3`=right, `5`=drop set, `7`=partial reps. Only `1`
    is excluded from scoring by default.
  - **`is_completed` is unreliable and is now ignored.** On a real account, whole workouts —
    including clearly-performed ones with real weight/reps (e.g. a 315lb squat) — come back
    with `is_completed: false` on every single set, while other workouts have it `true` on
    every set (it's never mixed within one workout). This lines up with recency (all of the
    account's most recent sessions at the time of testing were all-`false`), suggesting it
    reflects some Lyfta-side "finished/synced" state rather than "this set was actually
    performed." `is_scoreable_set` now scores any non-warm-up `weight_reps` set that has usable
    weight/reps, regardless of `is_completed`.
- **A real bug caught by testing against real data, not just synthetic fixtures**: the initial
  `rolling_scores` implementation only computed a value for days that had a recorded entry. On
  sparse real workout history (gaps of a week or more between sessions), this silently collapsed
  multi-week gaps into a single step of the demotion-streak counter, since the day-by-day walk in
  `classes_with_hysteresis` iterated only over days present in the dict. Fixed by having
  `rolling_scores` fill in every calendar day between the first and last recorded day (defaulting
  missing days to 0 points), so "7 consecutive days" means real calendar days. Covered by
  `test_demotion_counts_calendar_days_not_just_workout_days` in `tests/test_scoring_classes.py`.
- **`.env` loading** uses `python-dotenv` (one dependency beyond the stated httpx/pydantic/pytest
  stack, added per your go-ahead to include relevant libraries as needed).
- **CLI framework**: stdlib `argparse`, to avoid adding click/typer when argparse covers the four
  subcommands cleanly.
