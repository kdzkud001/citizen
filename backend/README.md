# Backend — Phase 1

FastAPI backend for the citizenship habit/workout tracker: auth (Supabase JWTs),
Postgres via SQLAlchemy + Alembic, the Lyfta sync pipeline, and the HTTP API
that wraps the Phase 0 `citizenship_score` scoring engine (unmodified).

## Setup

Requires Python 3.11+ and a Supabase project (Postgres + Auth).

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows PowerShell
# source .venv/bin/activate       # macOS/Linux

# citizenship-score is installed separately first: a relative `file://../`
# requirement in pyproject.toml is unreliable across pip versions/platforms
# (breaks on Windows in particular).
pip install -e ../
pip install -e ".[dev]"

cp ../.env.example ../.env   # fill in real values -- see below
```

### Environment variables (in the repo-root `.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql+psycopg://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres`. Use the **direct** connection (port 5432), not the pgbouncer transaction-pooler port (6543) -- psycopg's prepared statements don't play well with transaction pooling. SQLAlchemy's own engine already pools connections within this process (`app/db.py`), which is what actually matters at this app's scale; move to Supavisor/pgbouncer only if concurrent load grows well past a personal/small-group app. |
| `SUPABASE_URL` | Your project URL, e.g. `https://<project-ref>.supabase.co`. Used to build the JWKS endpoint for verifying access tokens. |
| `SUPABASE_JWT_SECRET` | Only needed if your project still uses the legacy shared HS256 secret (Project Settings → API → JWT Settings). A project migrated to JWT signing keys doesn't need it — see "Auth" below. |
| `CREDENTIAL_ENCRYPTION_KEY` | Fernet key encrypting Lyfta credentials at rest. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. |
| `LYFTA_SYNC_OVERLAP_DAYS` | Optional, default `1`. Overlap window subtracted from `last_synced_at` before each sync. |
| `ENABLE_INPROCESS_SCHEDULER` | Optional, default `false`. See "Scheduled sync" below. |

## Auth

Supabase has moved from a single shared HS256 secret to per-project asymmetric
signing keys (ES256/RS256), published at
`{SUPABASE_URL}/auth/v1/.well-known/jwks.json` with zero-downtime rotation
([docs](https://supabase.com/docs/guides/auth/signing-keys)). `app/auth.py`
branches on each token's own `alg` header rather than assuming one scheme:
HS256 verifies against `SUPABASE_JWT_SECRET`, anything else resolves against
the JWKS endpoint by `kid` (cached, refetched on an unrecognized `kid`). This
means the backend keeps working across a project's migration from the legacy
secret to signing keys with no redeploy required.

A `profiles` row is created lazily on a user's first authenticated request
(`app/auth.py:get_current_profile`) rather than via a Supabase-side trigger on
`auth.users`, since that schema isn't ours to migrate.

## Database migrations

```bash
alembic upgrade head
```

The schema is defined once, in `alembic/versions/0001_initial_schema.py` — no
hand-edited schema; any future change goes through a new Alembic revision.

## Running the API

```bash
uvicorn app.main:app --reload
```

`GET /health` needs no auth. Every other endpoint requires
`Authorization: Bearer <supabase-access-token>`.

## Lyfta sync

- `POST /me/lyfta` validates the submitted key with one live test call before
  encrypting and saving it.
- `POST /me/lyfta/sync` triggers a manual sync for the calling user.
- **Scheduled sync, roughly hourly, for everyone connected:**
  ```bash
  python -m scripts.sync_all
  ```
  Run this from your OS's own scheduler (cron / Windows Task Scheduler) rather
  than relying on `ENABLE_INPROCESS_SCHEDULER=true`. An in-process APScheduler
  thread has no cross-process lock: the moment you run more than one `uvicorn`
  worker, every worker's scheduler fires the same job and double-syncs
  everyone. A cron-invoked script is trivially safe to run from exactly one
  place. The in-process option exists purely as a single-instance local-dev
  convenience.
- **Daily full recompute, independent of Lyfta sync:**
  ```bash
  python -m scripts.recompute_all
  ```
  Also schedule this once a day. It's what makes a habit-only user (or anyone
  who's disconnected Lyfta) still decay and demote through *today* — the
  hourly sync job only recomputes users it actually syncs, so someone who
  never connects Lyfta would otherwise have a `daily_scores` cache that goes
  stale forever. Also re-run it by hand whenever the scoring formula in
  `citizenship_score.config` changes, to rescore everyone's history.

## Tests

Tests run against a real Postgres (jsonb/uuid behavior isn't sqlite-portable)
that must never be your production database.

```bash
docker compose up -d      # starts a throwaway Postgres on localhost:55432
pytest
```

`tests/conftest.py` drops and recreates every table before each DB-touching
test, so `TEST_DATABASE_URL` (defaults to the docker-compose service above)
must point somewhere disposable. Tests mock the Lyfta API via
`httpx.MockTransport` (passed through `LyftaClient`'s existing `transport`
parameter) rather than a separate mocking library.

## API endpoints

- `GET /health` — no auth
- `GET /me`, `PATCH /me` — profile, including `weekly_session_target`
- `GET /me/lyfta` — connection status (`connected`, `last_synced_at`,
  `last_sync_status`); `POST /me/lyfta`, `DELETE /me/lyfta`, `POST /me/lyfta/sync`
- `GET /me/score` — today's points, rolling score, class, points to next
  class, and the last 28 days of daily scores
- `GET /me/workouts` — recent scored sessions with their per-set breakdown
- `GET /me/wheel?days=28` — wellness wheel: per category (`Mind`, `Spirit`,
  `Discipline`, `Body`, `Fitness`) `percent` (0–100), `completions`,
  `target`, `tracking`, for the current `days`-long window ending today and
  the same-length window before it (`days` 1–365)
- `POST /habits`, `PATCH /habits/{id}` — `name`, `category` (one of the
  engine's `HABIT_CATEGORIES`, default `Discipline`), `weekly_target`
  (1–7, default 7), and `active` (PATCH only; `false` archives)
- `GET /habits?for_date=YYYY-MM-DD` — each habit (with category and
  weekly target) plus `completed_on_date` for that date (today or yesterday
  only, defaults to today)
- `POST /habits/{id}/completions`, `DELETE /habits/{id}/completions/{date}`
  (only today or yesterday — no backfill)
- `POST /clans`, `POST /clans/join`, `POST /clans/leave`,
  `POST /clans/regenerate-code` (owner only), `GET /clans/me` — each returns
  `is_owner` (relative to the caller) plus a leaderboard of `members`
  (display name, rolling score, class only — never raw workouts or Lyfta info)

## Assumptions

- **Every table lives in a private `app` Postgres schema, not `public`.**
  A Supabase project's Data API (PostgREST) can expose `public`-schema
  tables directly to `anon`/`authenticated` clients if that schema's role
  grants are enabled — completely bypassing this backend's own ownership
  checks (this backend is meant to be the *only* access path to this data).
  Putting tables in a schema the Data API was never configured to expose
  avoids that regardless of a given project's Data API settings, with no
  RLS policies to author or maintain. `alembic_version` itself is the one
  exception, left in the default `public` schema — it holds nothing but
  migration version strings.
- **`profiles.id` has a real FK to `auth.users.id` (`ON DELETE CASCADE`)** —
  Supabase's own documented pattern for a `profiles` table, even though
  that schema is Supabase-managed rather than ours: it already exists by
  the time our migrations run, and the cascade means deleting a Supabase
  user cleans up every row hanging off their profile automatically. (Tests
  run against a plain Postgres container with no `auth` schema at all, so
  `tests/conftest.py` stubs a minimal `auth.users(id, email)` table.)
- **Profile creation is lazy**, not a Supabase `auth.users` trigger (see
  "Auth" above) — simpler, and keeps every piece of schema in Alembic's
  hands.
- **`lyfta_connections.encrypted_credential` holds a Fernet-encrypted JSON
  blob**, not a single plain string column, specifically so an OAuth method
  (`access_token`/`refresh_token`/`expires_at`) can be added later without an
  Alembic migration — only the JSON shape inside changes.
- **`daily_scores.class_name`**, not `class` (SQL/Python reserved word) —
  matches the name `citizenship_score`'s own `DailyClass` dataclass already
  uses.
- **`clan_members.user_id` is unique on its own**, not just as part of
  `(clan_id, user_id)`, since a user may be in at most one clan; a composite
  unique constraint wouldn't actually enforce that.
- **Recompute always rewrites full history**, seeding an explicit
  zero-point entry for "today" (UTC) before handing the combined
  workout+habit points to `citizenship_score.scoring.classes.score_classes`.
  That's the one deliberate wrapper step needed for decay/demotion to walk
  forward through a quiet day — `rolling_scores()` in Phase 0 only walks from
  the earliest to the *latest* day it's given, so without this a stale user
  would never decay.
- **A leaving clan owner is not specially handled** (no automatic ownership
  transfer or clan deletion) — out of scope for Phase 1 per the spec; flagging
  in case that's surprising.
- **`GET /me/workouts` recomputes the per-session breakdown on demand**
  (not cached in `daily_scores`, which only stores the rolled-up numbers) —
  fine at personal scale, would need caching if workout history grows large.
- **`GET /me/wheel` is computed live from raw data too**, not cached. The
  wheel uses the *currently* active habits for both windows, so archiving a
  habit also drops it from the previous window's comparison.
- **`daily_scores.habit_points` includes the balance and weekly bonuses**
  (no separate columns): the cache stores per-day totals, and the breakdown
  is always recomputable from `habit_logs` + `habits`.
- **Changing a habit's `category` or `weekly_target` recomputes the user's
  scores**, since the balance bonus and weekly bonus both depend on them.
  That applies to past weeks too: the cache is always derived from the
  habits' current settings.
- **A habit's `category` is checked by the API against the engine's
  `HABIT_CATEGORIES`, not by a DB CHECK constraint**, so adding a category
  is a config change with no migration. `weekly_target`'s 1–7 range is
  fixed, so the DB enforces it.
- **Sync's Lyfta key validation** makes one live call scoped to today's date
  range, to keep it cheap while still proving the key is accepted.
