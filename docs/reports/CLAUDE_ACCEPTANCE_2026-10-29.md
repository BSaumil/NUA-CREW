# Claude release acceptance — C1/C2 first slice (29 October 2026)

## Baseline

- Branch `feat/claude-release-acceptance-20261029` from remote `feat/hiring-acceptance-shifts-20261028`, SHA `f208965ca1813920746a48796753a05648cdae77`.
- The brief's integrated baseline `2067f6e` (`feat/documents-awards-20261029`) was not obtainable (unpushed, no bundle). The owner chose the remote branch as baseline. Codex-owned document and award work is therefore not present here.
- The two uncommitted account-management files from another checkout were not available; nothing was merged or reset.

## Checks (all run locally against an isolated PostgreSQL `nua_crew_test`)

| Check | Result |
| --- | --- |
| `ruff check`, `ruff format --check`, `mypy app` | clean |
| `pytest` at baseline | 215 passed |
| `pytest` after this change | 224 passed (9 new) |
| Migration upgrade/downgrade round trip (`tests/test_migrations.py`) | pass, including the new migration |
| `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` | pass (mobile 211, ui 39, api-client 2) |

Not run: browser e2e on this slice, native builds, physical devices, screenshots.

## Changes

- Migration `a33b94de1003`: `shift_attendance_events` and `shift_timesheet_versions`, forced RLS (read only through a booking the caller can see; writes system scope only), append-only triggers.
- `app/routers/attendance.py`, `app/services/attendance.py`: candidate check-in/out (opens 1 h before start, server clock, idempotent retries), correction requests (need employer approval; original events never edited; one pending per kind; no future or out-of-window claims), employer no-show (after 30 min grace, refused if the worker checked in or has a correction waiting), reversal, notifications, audit events, timesheet history endpoints for both sides.
- `shifts.py`: every timesheet submission and decision writes an immutable version row; a no-show mark blocks hours until reversed. `BookingOut.attendance` is derived from the event log.
- Contracts regenerated (`packages/contracts`).
- No automatic monetary penalties anywhere.

## Still needed

- Attendance and history screens on web and the shared Expo app (API only so far).
- Employer account closure, ownership transfer and consent-based team invitations (needs the two uncommitted files).
- Concurrency tests for booking at scale, daylight-saving and overnight shifts for check-in windows.
- Device acceptance, five real screenshots, Maestro/Detox coverage, C3 website checks and C4 readiness items.
- Schema ownership: the new tables do not overlap Codex's document/award tables; confirm before merging.
