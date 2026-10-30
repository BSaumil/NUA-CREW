# Device test plan (Android and iOS)

Nothing here has been run on a real device: this project has had no phone, no TestFlight and no
Play Console access. This is what to do when those exist. Record each result with the build number,
device, OS version and date; do not tick a line you did not run.

## Builds
- Android: internal testing track (Play Console). iOS: TestFlight. Profiles are in `apps/mobile/eas.json`
  with placeholder ids; replace them with the real bundle id and package name first.
- Run `pnpm --filter @nua-crew/mobile test` and `pnpm --filter @nua-crew/mobile bundle:check` before each build.

## Devices (minimum)
A small Android phone (about 360 dp wide), a current Android phone, an older iPhone with the
smallest screen you support, and a current iPhone. Test once with the largest system text size and
once with a screen reader (TalkBack and VoiceOver).

## Journeys to walk
Sign up and sign in; keep signed in after closing the app; sign out everywhere.
Worker: add roles and experience; search and filter by role; read why a job matches; apply; reply
to an invitation; share availability; accept a shift; check in and out; ask for a correction.
Business: guided job post with a role; pay check below the minimum (publishing must be blocked) and
at the minimum; publish; review applicants; invite consenting talent; approve a correction;
mark and reverse a no-show.
Delete the account in the app.

## Things that only a device shows
Keyboard covering a field; safe-area and notch overlap; back-button behaviour on Android; deep links
from a notification; offline banner and cached public jobs; biometric lock; location permission
text and rounding; push notification text is generic (no names); screen-reader order and labels for
every button; focus after a sheet closes; large text not clipping.

## Exit
Store submission needs the privacy and data-safety forms (`docs/` store privacy draft, for counsel),
signed builds and your accounts. None of that is done.
