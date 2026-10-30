# Enhancement items 4–10 — 31 October 2026

Base: explicit `main` at `865845e14f05cd85682b653ff54cc53daae0f268` (PR #9). Branch: `feat/product-pilot-readiness-20261031`. The archived `7f0ce15` wallet was selectively reconciled; its separate award engine, account/team changes and competing attendance tables were not imported. Existing main hospitality and append-only attendance APIs remain authoritative.

| Item | Implemented in this branch | Acceptance / remaining gate |
| --- | --- | --- |
| 4. Private document wallet | PDF resumes; PDF/JPEG/PNG certificates and camera picking; explicit application attachments; authenticated downloads; withdrawal/removal access revocation; immutable bytes and retry keys; forced RLS; durable deletion queue; private export metadata | Scanning/storage disabled by default. Actual private S3/ClamAV, backup erasure policy and device permission/share testing still required. |
| 5. Employer role-and-pay wizard | Existing role/award engine preserved; pay choices retained when returning from result; readable base-reference explanation; mobile award load recovery; classification/coverage confirmation resets; role/state changes invalidate native pay check | Supplied wage data keeps existing verification status. No new wage figures or compliance guarantees introduced. |
| 6. Dashboards | Candidate web/native overview and employer web hiring tasks; counts from authoritative APIs; errors display unavailable rather than zero; existing native employer dashboard retained | Staging/device acceptance required before public availability. |
| 7. Shifts/timesheets | Web shift offers, confirmation/cancellation, actual hours and review; shared Android/iOS check-in/out, correction request/review, attendance history and every hours version | Server derives venue-local correction time; skipped/repeated DST times rejected. Existing no-show review policy preserved. No payroll or location verification implied. |
| 8. Notifications/recovery | Candidate/employer web notifications with read controls; employer native alerts; audience-aware attendance/message destinations; read failure feedback; web retry boundaries; native input retained after errors | Actual push provider/device delivery and production identity recovery remain external acceptance work. No real notifications sent during implementation. |
| 9. Mobile/accessibility | New unit/regression checks; browser small-screen light/dark accessibility scenarios and screenshots; empty-state actions independently screen-reader reachable; native build workflow covers PR changes | Real TalkBack/VoiceOver, physical keyboard/camera/network/signing acceptance remains unverified. CI simulator/debug builds and Hermes exports are separate evidence. |
| 10. Controlled pilot | Invitation-only pilot runbook, device acceptance record and exact-commit evidence checker with regression tests | All release evidence gates intentionally pending. No public signup activation, Vercel alias promotion, live billing or store submission. |

## Local verification before publication

- Workspace typecheck and lint pass, all eight packages; formatting and diff checks pass.
- Mobile Jest: 236 tests, 36 suites pass. Shared UI: 43 tests pass. Pilot evidence checker: three tests pass.
- Python isolated units: 51 pass; Ruff and mypy pass (74 application source files).
- Three Next.js production builds pass. Stale local Turbopack persistence was cleared after its cache failed to open; clean builds use the normal default commands.
- Android/iOS Metro + Hermes compilation passes. These are not signed binaries or device acceptance.
- Contracts regenerated from current API. One Alembic head after placing wallet migration after main hospitality migration.

Fresh isolated PostgreSQL/RLS and complete browser CI are required for this branch. Historical PR #9 results are not acceptance evidence for the new wallet or attendance UI. Final CI results belong in the pull request after they complete.

## Release ownership

No public account activation, paid infrastructure provisioning, credentials or real personal documents were used. Marketing website source and business branding from PR #9 are preserved. Existing archived account/team work remains separately preserved. See `docs/pilot/CONTROLLED_PILOT.md` and `docs/DOCUMENT_VAULT_SETUP.md` for provider and operational dependencies.
