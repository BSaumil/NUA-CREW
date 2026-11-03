# Controlled pilot preparation — 31 October 2026

Scope: invitation-only candidate/employer test cohort. Employees remain free across Australia. Billing stays disabled; no real card payments, payroll or store release. Preparing this runbook does not open registration.

## Evidence and release gate

Record evidence per gate in `readiness.json`, including exact release commit, reviewer, timestamp and run/device reference. `pnpm pilot:check <40-character-release-commit>` exits nonzero until every required gate has evidence for that commit. Tests of the gate run in CI; the readiness manifest intentionally remains pending. It is a review aid, not an authentication control or deployment command.

## Order of work

1. Provision an isolated, owner-approved staging API, PostgreSQL runtime/migrator roles and a scheduled worker. Do not reuse production candidate data. Keep FORCE RLS and non-bypass runtime roles.
2. Connect the approved identity/recovery provider, private S3 storage and ClamAV service. Do not enable local filesystem storage outside development. Test clean/rejected files, scanner outage, account export/deletion and queued storage removal. Never place credentials in this manifest or screenshots.
3. Run migrations on an empty staging database, then run real PostgreSQL tenant/RLS/concurrency tests and the complete browser hiring journey. Keep uploaded file tests isolated and mark scanner doubles as doubles.
4. Build internal Android and iOS packages using owner-approved identifiers, API and signing. Debug APK/simulator workflow artifacts are development tools; they do not establish physical-device acceptance.
5. Execute `DEVICE_ACCEPTANCE.md` on actual Android/iPhone devices. Record OS, model, build commit and pass/fail evidence. Verify provider push, offline recovery, document picker/camera, keyboard, larger text, TalkBack/VoiceOver and account switching.
6. Run backup → restore into a fresh database and storage namespace. Verify integrity and deletion queue; set alerts for worker/scanner/API failures. Record rollback target and a successful rehearsal.
7. Obtain the business/legal review and explicit owner pilot release approval. Use fixture or expressly consenting testers, scoped access and a support contact. Only then invite the cohort. No invitations or messages are sent by this implementation.

## Stop and rollback

Stop new pilot invitations if tenant isolation, credential deletion, document access, malware scanning or attendance integrity fails. Disable document intake on scanner/storage failure; preserve metadata and queued deletions. Keep database history intact. Roll API/clients back together only when contracts and migration compatibility have been checked. Do not downgrade the document migration with stored documents or pending cleanup; drain through normal deletion controls first. A main merge does not promote a Vercel alias or enable public registration.

## Existing launch dependencies

Managed production identity/recovery, durable private storage/scanner, monitored worker, provider-backed push, signing and actual devices are still required. Award data retains its source/verification status; this phase does not assert new legal wage figures. Stripe account-backed sandbox acceptance and any future live approval remain separate work.
