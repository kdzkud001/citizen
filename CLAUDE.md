# Citizenship — gamified habit/workout tracker

Users earn points from Lyfta workouts and self-tracked habits; a rolling
28-day score determines a "citizenship class" (Outsider → Commoner → Citizen
→ Noble → Elite), with promotion/demotion hysteresis and clans.

## Repo layout

- **`src/citizenship_score/`** — Phase 0, the scoring engine. Pure Python,
  no network/DB I/O in scoring code. Installed as `citizenship-score`; the CLI
  entry point is `citizenship-score` (or `python -m citizenship_score.cli`).
  Its own README (`README.md`) has the full formula reference and a running
  list of real-data surprises found while testing against the live/sandbox
  Lyfta API.
- **`backend/`** — Phase 1, the FastAPI HTTP API. Own venv, own
  `pyproject.toml`, own README (`backend/README.md` — setup, env vars,
  running migrations/tests/sync jobs, assumptions). Depends on
  `citizenship_score` as an editable install (`pip install -e ../` — see that
  README for why it's not a normal pyproject dependency entry on Windows).
- **`app/`** — Phase 2, the Expo (React Native + TypeScript) mobile app.
  Own `package.json`/node_modules. Own README (`app/README.md` — env vars,
  running the backend on your LAN for Expo Go, the manual test checklist,
  assumptions). Talks to the backend only, never Supabase directly except
  for auth. Nested `app/AGENTS.md` (Expo-authored) has Expo-specific
  conventions — read it before touching anything Expo/EAS/React-Native
  API-shaped, its warning about Expo's frequent breaking changes is real.

## Conventions

- **Never modify scoring logic in `citizenship_score` from the backend.**
  If something in `backend/` seems to need a scoring-engine change, that's a
  real bug or spec gap — flag it and ask before touching `src/citizenship_score`.
  The one exception already made: `is_scoreable_set` ignores `is_completed`
  entirely (see `README.md` → Assumptions) because real Lyfta data returns
  whole workouts — including clearly-performed ones — with every set flagged
  incomplete.
- **Backend tables live in a private `app` Postgres schema, never `public`.**
  A Supabase project's Data API can expose `public` tables directly to
  `anon`/`authenticated` clients, bypassing the backend's own ownership
  checks — see `backend/README.md` → Assumptions.
- **`daily_scores` (backend) is a cache, never a source of truth.** It must
  always be safely rebuildable from `workouts.raw_json` + `habit_logs` via
  `app.services.scoring.recompute_user_scores`. Always store the full raw
  Lyfta JSON on fetch, never only derived fields — old formulas need to be
  rescoreable from raw data at any time.
- **Two separate venvs**: run Phase 0's CLI/tests from `citizenship-app/`
  root, Phase 1's API/tests from `citizenship-app/backend/`. Don't mix them
  into one environment.
- **Habits are a full scoring pillar, on par with workouts** (this is not a
  gym-centric app). Each habit has a `category` from
  `citizenship_score.config.HABIT_CATEGORIES` (`Mind`, `Spirit`,
  `Discipline`, `Body`, `Fitness`) and a `weekly_target` (1–7). Scoring:
  15/completion capped at 90/day; +15 balance bonus on days with 3+
  categories (a scored Lyfta workout counts as `Fitness`); +25 per habit
  meeting its weekly target in a Mon–Sun week, credited that Sunday, capped
  at 6 habits/week. The wellness wheel (`scoring/wheel.py`, `GET /me/wheel`,
  the Home radar chart) is per-category percent of those targets. Category
  lists exist in three places that must stay in sync: the engine config
  (source of truth), `app/constants/habits.ts`, and the `HabitCategory` type
  in `app/types/api.ts`. The backend validates against the engine config, so
  a new category needs no DB migration. Full formulas: `README.md`; spec:
  `docs/PHASE2.md`.
- **Set-type legend** (Lyfta `set_type_id`, confirmed against real account
  data): `0`=normal, `1`=warm-up (excluded from scoring), `2`=left,
  `3`=right, `5`=drop set, `7`=partial reps.
- **Commits**: one commit per working, tested piece — not one giant commit
  at the end of a phase.

## Running things

```bash
# Phase 0
cd citizenship-app
.venv\Scripts\Activate.ps1
pytest

# Phase 1
cd citizenship-app/backend
.venv\Scripts\Activate.ps1
docker compose up -d   # test Postgres
pytest
uvicorn app.main:app --host 0.0.0.0 --reload   # 0.0.0.0 so Expo Go on your phone can reach it

# Phase 2
cd citizenship-app/app
npm start
npx tsc --noEmit && npx expo lint && npx jest   # before calling any change done
```
