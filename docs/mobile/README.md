# NUA CREW mobile app (iOS and Android)

Candidate app built with Expo (React Native), Expo Router and TypeScript in `apps/mobile`. It talks to the same API as the web apps through the generated `@nua-crew/contracts` types and `@nua-crew/api-client`. **No AI features** are in this release; matching is the explainable heuristic estimate the API already provides.

## What it does

| Area | Features |
| --- | --- |
| Onboarding & auth | Welcome carousel, sign-up/sign-in, biometric **app lock** (Face ID / fingerprint / passcode), sign out of this device or **all devices**, change password |
| Discover | Debounced search, filters (type, suburb, **pay floor normalised to $/hour**, posted-within, sort), **Near me** (coarse location, rounded to ~1 km, never stored), infinite scroll, pull-to-refresh, skeletons, empty/error/offline states |
| Job detail | Overview / **My match** (evidence per factor, "not evaluated" where unknown) / Company; disclosed-vs-estimated pay; verification explained as "not an endorsement"; stale-listing warning; share; **external jobs** open the employer's site only after an explicit "we can't track this" notice |
| Saved | Heart to save (optimistic, rolls back on error); saved jobs with "no longer accepting" flag; **saved searches with alerts** (max 20, at most one alert per search per hour) |
| Applications | Apply with a chosen resume + note, one active application per job, timeline of employer-made status changes, withdraw with confirmation |
| Alerts | In-app inbox with unread badge, mark all read, deep links; **push notifications** (opt-in, delivered by the worker when `NUA_PUSH_PROVIDER=expo`) |
| Profile | Profile strength meter (plain completeness, not a ranking), skills chips, work preferences, private minimum pay, resumes with versions |
| Privacy & store requirements | Talent-discovery consent (off by default), **export my data** (share sheet), **in-app account deletion** (required by both stores) |
| Quality | Dark mode + theme override, dynamic type (capped), 44 pt touch targets, screen-reader roles/labels, reduced-motion aware skeletons, brand tokens tested against the web design system |

## Run it

```bash
make install && make db-up && make migrate seed && make api     # API on :8000
cd apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:8000 pnpm start            # iOS simulator: press i
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000  pnpm android          # Android emulator reaches the host at 10.0.2.2
```

Sign in with `candidate-a@nua-crew.example.com` / `nua-dev-password-1` (seed data, fictional). On a physical phone use your computer's LAN IP. `pnpm web` runs the same screens in a browser (storage falls back to `localStorage` **for development only**).

## How it was verified (and what was not)

| Check | Result |
| --- | --- |
| `tsc` strict, `eslint` | clean |
| Jest (79): session/refresh logic, auth provider, API wiring, Discover, job detail/apply, applications, settings/deletion, components, token ↔ web parity, WCAG AA contrast | pass |
| `expo export` for **android** and **ios** (Hermes bytecode) | compiles (≈3.7 MB each) |
| `expo prebuild` for both platforms | succeeds; generated manifests audited (below) |
| Browser run of the real screens against the real API + DB (Playwright, `tests/e2e/specs/mobile-web.spec.ts`, 8 tests incl. axe in light/dark) | pass |
| **Not verified here:** running on a physical iPhone/Android device or emulator, Keychain/Keystore, biometrics, push delivery, share sheet/file export, location prompt, store builds | needs real devices/accounts |

Generated native config (from `app.config.ts`): iOS asks only for **Face ID** and **location while in use**; Android requests only `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `USE_BIOMETRIC`/`USE_FINGERPRINT` (+ `INTERNET`, `VIBRATE`); fine location, camera, microphone, storage and overlay permissions are explicitly removed.

## Build and release (owner actions required)

1. Register the real bundle id / package name (currently the placeholder `com.example.nuacrew`) and set `NUA_IOS_BUNDLE_ID` / `NUA_ANDROID_PACKAGE`. **Do this only after brand clearance.**
2. Create the EAS project (`eas init`), set `NUA_EAS_PROJECT_ID` (needed for push tokens) and real API URLs in `eas.json` (they are `.invalid` placeholders on purpose).
3. `eas build -p android --profile preview` (APK for testers) / `--profile production` (AAB). iOS needs an Apple Developer account for signing: `eas build -p ios`.
4. Complete store listings: privacy policy URL, Apple privacy "nutrition label", Google Play **Data safety** form, age rating, support URL, screenshots. Draft answers are in `docs/mobile/STORE_PRIVACY_DRAFT.md` (needs counsel review).
5. Server: run `make worker` so saved-search alerts and push delivery run; set `NUA_PUSH_PROVIDER=expo` and `NUA_REDIS_URL`.

## Known gaps

No messaging, interview scheduling, shifts (NUA CREW Local), resume file upload/camera scan, maps view, employer mobile app, localisation beyond en-AU, tablet layouts, deep links via https (needs a cleared domain), crash reporting, automated device-farm tests. Tracked in `docs/IMPLEMENTATION_TRACKER.md`.
