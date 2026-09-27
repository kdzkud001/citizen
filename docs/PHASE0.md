# Phase 0 — Scoring Engine

Gamified habit and workout tracker. Users earn points from workouts (pulled from the Lyfta API) and
daily habits. Their rolling points determine a "citizenship class" (Outsider, Commoner, Citizen,
Noble, Elite), and users can form clans with friends.

**This task is PHASE 0 ONLY: build and test the scoring engine as a standalone Python package.**
Do NOT build a web server, database, mobile app, or UI yet.

## Tech
- Python 3.11+, httpx for HTTP, pydantic for data models, pytest for tests
- Scoring logic must be pure functions (no network or file I/O inside scoring code) so it can later
  be reused by a FastAPI backend
- Read the Lyfta API key from the `LYFTA_API_KEY` environment variable (support a `.env` file). Never
  hardcode it; add `.env` to `.gitignore`

## Lyfta API
- Live: `GET https://my.lyfta.app/api/v1/workouts` with header `Authorization: Bearer <key>`.
  Optional query params `from` and `to` (YYYY-MM-DD, UTC). Responses are paginated (fields:
  `current_page`, `total_pages`, `limit`). Rate limit: 60 req/min, 5000/day, so handle pagination and
  add basic backoff.
- Sandbox (no auth, same shape): `GET https://my.lyfta.app/api/sandbox/v1/workouts`. Save one
  response as a test fixture.
- Relevant fields per workout: `id`, `title`, `body_weight`, `workout_perform_date`, `total_volume`,
  `exercises[]`. Per exercise: `exercise_id`, `excercise_name` (note: misspelled in the API),
  `exercise_type` (e.g. `"weight_reps"`), `sets[]`. Per set: `weight`, `reps`, `rir`, `duration`,
  `distance` (all STRINGS, may be empty), `set_type_id` (string), `is_completed` (bool), `record_type`.
- Model these with pydantic, converting strings to numbers safely (empty string -> None).
- Which `set_type_id` means warm-up is not yet known. Make excluded set types a config value, and
  have the CLI print the distinct `set_type_id`s found in the data so this can be figured out.

## Scoring spec (put ALL constants in one config module so they can be tuned)

1. **Set load**, for completed, non-warm-up, `weight_reps` sets only:
   `set_load = (weight * reps / body_weight) * E`
   `E` from RIR: 0-1 -> 1.2, 2-3 -> 1.0, 4+ -> 0.7, missing -> 1.0
   If `body_weight` is missing, fall back to the user's most recent known body weight, else a
   configurable default.
2. **Session points** = `10 * sqrt(sum of set loads)`. Only the first session per calendar day
   scores fully; additional sessions that day score at 0.5x.
3. **Progress bonus**: per exercise, estimated 1RM = `weight * (1 + reps/30)` (Epley). If the
   session's best e1RM beats that exercise's best over the previous 6 weeks (and there IS prior
   history), +15 points. Max 3 bonuses per session.
4. **Weekly consistency**: user has a weekly session target (default 3). If met in a Monday-Sunday
   week, that week's workout points (sessions + bonuses) are multiplied by 1.2.
5. **Habits**: 10 points per completed habit, capped at 50 points per day. Just implement the
   scoring function taking a list of habit completions; no habit storage yet.
6. **Rolling score** = total points over the last 28 days.
7. **Class thresholds** on rolling score: Outsider <300, Commoner 300-1000, Citizen 1000-2000,
   Noble 2000-3500, Elite 3500+.
   Hysteresis: promote immediately on crossing a threshold; demote only after the rolling score has
   stayed more than 10% below the current class's lower threshold for 7 consecutive days. Implement
   as a function that walks a daily score history and returns the class for each day.
8. **Clan score** = mean of members' rolling scores * participation factor, where participation =
   fraction of members with at least one workout in the last 7 days.

Cardio and non-`weight_reps` exercises score 0 for now, but structure the code so a scorer for them
can be added later.

## Project structure (suggested)
- `src/<package>/lyfta_client.py`, `models.py`, `config.py`, `scoring/` (`workouts.py`, `habits.py`,
  `classes.py`, `clans.py`), `cli.py`
- `tests/` with fixtures from the sandbox plus hand-built edge cases
- `data/raw/` for fetched workout JSON (gitignored). Always save the raw API JSON before scoring,
  because the formula will change and rescoring history without refetching is required.

## CLI commands
- `fetch`: pull workouts (optionally `--from`/`--to`) and save raw JSON
- `score`: score saved workouts and print a per-session breakdown (sets counted, set loads, session
  points, bonuses), weekly totals, and today's rolling score and class
- `sandbox`: run the full pipeline on the sandbox data
- `simulate`: generate a synthetic daily history (e.g. consistent lifter vs. someone who quits after
  3 weeks) and print how their class changes over time, to sanity-check hysteresis

## Tests (required)
Cover: string-to-number parsing and empty fields; warm-up/incomplete sets excluded; RIR multipliers;
sqrt diminishing returns; second session same day at half; progress bonus only with prior history
and capped at 3; weekly consistency multiplier; habit daily cap; class thresholds at exact
boundaries; promotion and delayed demotion; clan mean and participation.

## Deliverables
Working package, passing tests, a README explaining setup (venv, `.env`), the CLI commands, and the
scoring formulas, and a short note listing any assumptions made. Work in small steps and run the
tests as you go. Ask before adding anything outside this scope.
