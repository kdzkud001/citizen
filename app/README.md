# Mobile app — Phase 2

Expo (React Native + TypeScript) app for the citizenship habit/workout
tracker. Consumes the Phase 1 FastAPI backend; all data lives there, this
app is just the client. Built with Expo Router, Supabase JS (auth only),
and TanStack Query.

## Setup

Requires Node 18+ and the Expo Go app on your phone (App Store / Play
Store).

```bash
cd app
npm install
cp .env.example .env   # fill in real values -- see below
```

### Environment variables (`app/.env`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The **anon/publishable** key -- public by design, safe to ship in the app. **Never** put the `service_role`/secret key here; it must never appear in mobile app code. |
| `EXPO_PUBLIC_API_BASE_URL` | Your laptop's LAN IP + backend port, e.g. `http://10.74.195.102:8000`. **Not** `127.0.0.1`/`localhost` -- see below. |

Any `EXPO_PUBLIC_*` var is inlined into the JS bundle at build time by
Expo itself; nothing else (dotenv, app.config.js) is needed for these.

## Running the backend on your LAN

Expo Go runs on your phone, a separate device from your laptop -- it can't
reach `127.0.0.1` (that would mean "the phone itself"). Instead:

1. **Bind uvicorn to all interfaces**, not just localhost:
   ```bash
   cd ../backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
2. **Find your laptop's LAN IP** (PowerShell):
   ```powershell
   Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "169.254*" -and $_.IPAddress -ne "127.0.0.1" }
   ```
   Use the one on your Wi-Fi adapter (not a VPN or virtual-switch adapter).
3. **Allow it through Windows Firewall** (one-time, needs an elevated/Admin
   PowerShell):
   ```powershell
   New-NetFirewallRule -DisplayName "Citizenship backend (uvicorn dev, port 8000)" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
   ```
   Scoped to TCP port 8000, inbound only, `Private` network profile only
   (your home Wi-Fi) -- not exposed on public networks.
4. Put that IP in `EXPO_PUBLIC_API_BASE_URL` (`.env`), e.g.
   `http://10.74.195.102:8000`.
5. **Your phone must be on the same Wi-Fi network as your laptop.** If
   you use a VPN on your laptop (e.g. ProtonVPN), turn it off while
   testing -- depending on how it routes traffic, your phone may not be
   able to reach your laptop's LAN IP at all with it on.

Verify from your laptop first: `curl http://<your-lan-ip>:8000/health`
should return `{"status":"ok"}` before trying it from the phone.

## Running the app

```bash
npm start
```

Scan the QR code with Expo Go (Android: Expo Go's own scanner; iOS: the
Camera app). The app talks to whatever `EXPO_PUBLIC_API_BASE_URL` points
at, so make sure the backend is running and reachable first.

## Email confirmation (sign-up)

Supabase has email confirmation on by default: after sign-up, the app
shows a "check your email" screen and there's no session until the
confirmation link is clicked. For faster local dev iteration, you can turn
it off: **Supabase Dashboard → Authentication → Sign In / Providers →
Email → toggle "Confirm email" off.** Remember to turn it back on before
any real users sign up.

## Manual test checklist

Walk through this on your phone after any significant change.

**Auth**
- [ ] Sign up with a new email -- see the "check your email" screen (or,
      with confirmation off, land straight in onboarding)
- [ ] Sign in with a wrong password -- see an error, not a crash
- [ ] Sign in with the confirmed account -- lands in onboarding (first
      time) or Home (already onboarded)
- [ ] Force-quit and reopen the app -- still signed in (session persisted)

**Onboarding**
- [ ] Set a display name and weekly target, skip Lyfta -- lands on Home
- [ ] Repeat onboarding (new account), this time paste a real Lyfta API
      key and connect successfully

**Home**
- [ ] Class badge, rolling score, today's points all render
- [ ] Progress bar and "N points to <next class>" look sane
- [ ] 28-day chart renders with no crash on a brand-new (all-zero) account
- [ ] Pull to refresh -- triggers a sync (if Lyfta connected) and score
      updates

**Workouts**
- [ ] Recent sessions list with points
- [ ] Tap a session -- expands to show set loads and bonus points
- [ ] Empty state renders sanely with no workouts

**Habits**
- [ ] Add a habit, tap to complete it -- checkmark + score bump on Home
- [ ] Tap again -- undoes it (unchecks, score drops back)
- [ ] Switch to "Yesterday" -- shows yesterday's completion state
      independently of today's
- [ ] Archive a habit -- disappears from the list

**Clan**
- [ ] Not in a clan: create one -- becomes owner, appears on own
      leaderboard
- [ ] Second account: join with the invite code -- appears on both
      accounts' leaderboards
- [ ] Share button opens the native share sheet with the invite code
- [ ] Owner sees "Regenerate invite code"; the other member doesn't
- [ ] Non-owner leaves with confirmation -- clan screen reverts to
      create/join

**Settings**
- [ ] Edit display name / weekly target, save -- reflected on Home
- [ ] Lyfta: manual sync, disconnect, reconnect
- [ ] Sign out -- back at sign-in, and signing back in restores state

## Assumptions

- **Onboarding-completion is tracked locally on-device** (AsyncStorage), not
  a backend field. Reinstalling the app or signing in on a second device
  shows onboarding again -- acceptable at personal scale; flagged rather
  than silently adding a backend field for it.
- **Session storage uses Expo's own documented `LargeSecureStore` pattern**
  (AES-encrypted blob in AsyncStorage, key in SecureStore) rather than
  react-native-get-random-values + raw SecureStore, specifically so the app
  keeps working in Expo Go (that native module isn't bundled there).
- **A 401 that survives one refresh-and-retry signs the user out globally**
  (`lib/queryClient.ts`), rather than surfacing as a per-screen error.
- **The clan leaderboard sorts client-side** by rolling score (the backend
  returns members in an unspecified order) -- purely a display concern, not
  a data change.
- **Class colors** are a validated 5-slot categorical palette (data-viz
  skill's `validate_palette.js`, both light and dark mode passing every CVD
  gate) -- always paired with the class name label and a distinct icon, per
  that skill's "never color alone" rule, since 3 of the 5 read below 3:1
  contrast against their own page background in light mode.
