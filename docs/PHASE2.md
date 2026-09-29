# Phase 2 — Mobile app

Mobile app for the citizenship habit/workout tracker. The FastAPI backend (Phase 1) is done and
verified end-to-end against real Supabase and Lyfta data. The app consumes its API; backend
behavior doesn't change without asking first. If the app needs something the API doesn't provide,
propose the endpoint change and wait for approval.

## Stack
- Expo (React Native) with TypeScript, in `app/`. Expo Router for navigation.
- Supabase JS client for sign-up/sign-in **only**, using the publishable key. Session persisted
  securely (expo-secure-store or the Supabase-recommended adapter). The Supabase secret key must
  never appear anywhere in the app.
- All data comes from the FastAPI backend, with the Supabase access token as a Bearer token. Token
  refresh and expired sessions handled cleanly.
- TanStack Query for fetching/caching, with loading and error states on every screen.
- Backend base URL from config. Development runs on a phone with Expo Go, so never `127.0.0.1`:
  document running uvicorn on `0.0.0.0`, finding the laptop's LAN IP, and allowing it through
  Windows Firewall.

## Auth
Sign up, sign in, sign out. Supabase has email confirmation on by default: handle the "check your
email" state properly, and document how to turn confirmation off in the dashboard for development.

## Screens
1. **Onboarding** (first sign-in): display name, weekly session target, and connecting Lyfta, with a
   plain-words explanation of where to get a personal API key (my.lyfta.app/developers). Skippable.
2. **Home**: current class shown prominently as a badge, rolling score, points needed for next class
   with a progress bar, a simple 28-day chart of daily points, today's points, and the **wellness
   wheel** (see below). Pull-to-refresh triggers a Lyfta sync then refetches scores.
3. **Workouts**: recent sessions with points, expandable to show scored sets and any progress bonus.
4. **Habits**: today's checklist with one-tap completion (and undo), a toggle to view/edit yesterday
   (the backend only allows today and yesterday), and add/archive habits. Habits are **grouped by
   category**, and users set each habit's **category and weekly target** when creating or editing
   it.
5. **Clan**: if not in one, create or join by invite code. If in one: clan score, participation,
   member leaderboard, and a share button for the invite code (native share sheet). Leave clan with
   confirmation; the owner can regenerate the code.
6. **Settings**: display name, weekly target, Lyfta connection status and last sync, manual sync,
   disconnect, sign out.

### Wellness wheel (Home)
A radar chart with one spoke per category (Mind, Spirit, Discipline, Body, Fitness) on a 0–100
scale, from `GET /me/wheel?days=28`. The current window is filled and the previous window is a
dashed outline. Non-tracked categories are greyed out and labeled "not tracking". Tapping a spoke
opens that category's habits. Drawn with react-native-svg (confirmed to work in Expo Go), not a
heavy chart library.

## Look and feel
The "world" theme comes through: each class (Outsider, Commoner, Citizen, Noble, Elite) gets its own
color and simple icon/badge, used consistently. Clean and readable over flashy. Dark mode
supported. No copyrighted characters or assets.

## Out of scope
Push notifications, Lyfta OAuth, app store publishing, backend deployment, animations beyond basic
transitions. Ask before adding anything else.

## Quality
- TypeScript strict mode, API response types in one place matching the backend schemas.
- Tests for the API client and key logic (e.g. points-to-next-class display, wheel geometry), not
  every screen.
- A manual test checklist in `app/README.md` covering every screen, the wheel, and the full two-user
  clan flow.

## Deliverables
Working app runnable with Expo Go, updated README (setup, running the backend on LAN, running the
app, the manual checklist), and a list of assumptions. Commit after each working piece.

---

## Change request: habits as a full pillar, and the wellness wheel

This is not a gym-centric app. General habits (reading, Bible, making bed, eating well, …) count on
par with workouts. Previously habits were worth 10 pts capped at 50/day, so someone doing every
habit daily but never lifting was stuck at Citizen.

**Habit model.** Each habit has a category (`Mind`, `Spirit`, `Discipline`, `Body`, `Fitness`, a
config list) and a user-set `weekly_target` (1–7, default 7). A scored Lyfta workout counts as
Fitness. Existing habits migrated to `Discipline` / 7.

**Habit scoring** (all constants in the engine config):
- 15 points per completed habit, daily cap 90.
- Balance bonus: +15 on any day with completed habits in 3+ distinct categories (a scored Lyfta
  workout counts as Fitness). Outside the daily cap.
- Weekly consistency: +25 per habit whose `weekly_target` is met in a Monday–Sunday week.
  *Decided:* credited on that week's Sunday (nothing mid-week), and **capped at 6 habits (150 pts)
  per week** so adding trivial habits can't raise the ceiling without bound.
- Workout scoring and class thresholds unchanged.

**Wheel data.** A pure engine function computes, per category over N days (default 28): percent
(0–100, capped), completions, target, and a tracking flag. Habit categories: completions ÷ (sum of
active habits' `weekly_target` × days/7). Fitness: scored Lyfta sessions + Fitness habit completions
against the weekly session target plus Fitness habits' targets. `tracking=false` for categories with
no active habits (and for Fitness, also no Lyfta connection). `GET /me/wheel?days=28` returns the
current window and the previous window of the same length.

**Balance check** (`citizenship-score simulate`, steady-state rolling 28-day score):

| Scenario | Rolling | Class | Target |
|---|---|---|---|
| habits-only (6 daily habits, 4 categories) | 3,540 | Elite | near top of Noble |
| gym-only (3×/week at the real-data median 161.1 pts) | 2,320 | Noble | around low Noble |
| habits + gym | 5,860 | Elite | Elite |
| many-habits (10 daily habits) | 3,540 | Elite | (shows the weekly cap holding) |

Habits-only lands 40 points into Elite rather than near the top of Noble. Thresholds are not retuned
without sign-off.

---

## Redesign: mockup layout

The app was restyled to follow a design mockup (dark navy "kingdom" look, glowing class card,
pillar-colored habit rows), keeping the radar chart.

*Decided:*
- **Scope:** reskin plus the screens the current API can feed. No backend changes.
- **Tabs:** Home, Habits, Wellness, Clan, Profile. Workouts and the class ladder are pushed screens.
- **Classes:** the current five (Outsider → Elite), with unchanged thresholds.
- **Name:** "Citizenship". The mockup's "LYFTA" branding isn't used; Lyfta is the third-party
  workout source.

**Screens.**
- **Home:** greeting and avatar, a class hero card linking to the ladder, today's points, today's
  habits with one-tap check-off, a wellness-balance card, the latest workout, and the 28-day chart.
- **Wellness:** the radar, an overall balance figure (average of tracked pillars), balance
  insights (strongest/lowest pillar, biggest change on the previous window) and per-pillar bars.
- **Class ladder:** every class with its point range, the current one highlighted.
- **Auth:** a night-sky backdrop with an original SVG castle skyline.

**Colors.** Pillar colors are the data-viz dark categorical steps in wheel order (Mind blue,
Spirit magenta, Discipline gold, Body green, Fitness orange), validated for colorblind separation
against the navy surfaces. The mockup's blue/purple Mind/Spirit pair failed that check.

**Deferred** (need backend work, artwork, or their own spec):
- A Mon–Sun habit strip. The API only returns today/yesterday.
- A Progress screen with 90-day/all-time totals and points by pillar. This needs an engine change.
- A global clan leaderboard.
- Clan chat.
- The "virtual world" screen.
- Workout duration/calories.
