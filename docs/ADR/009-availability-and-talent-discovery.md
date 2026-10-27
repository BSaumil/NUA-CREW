# ADR-009 — Work preferences, availability and consent-based talent discovery

Status: accepted (2026-10-27). Extends ADR-003 (isolation) and builds on the consent history in ADR-005's data rules.

## Context

Candidates need to say what kind of work they want (permanent, temporary, or both), when they can work, and who may find them. Employers need to search people who agreed to be found, without the platform becoming a hidden talent directory, a bidding market for pay, or a way to learn someone's private calendar.

## Decisions

**Separate facts.** Employment basis (`engagement_basis`: employee / contractor / unspecified), duration (`duration_type`) and hours pattern (`hours_pattern`) are separate columns on jobs. `employment_type` stays for compatibility. A "shift" is a way of scheduling work, not a legal category. A contractor preference is a stated preference, never proof of status; there is no ABN check for it. The migration backfills only what the old type truly implies (full_time / part_time / casual → employee + that hours pattern); duration is never guessed and `contract` / `shift` imply nothing.

**Preferences per kind.** `work_preferences` has one row per (candidate, kind). "Both" is two rows, so neither side overwrites the other; switching a kind off keeps its fields. A never-set kind (`null`) is distinct from set-but-off. Permanent notice period / start date (`available_from`) is a different thing from being free for a shift tonight.

**Availability model.** Recurring weekly windows (several per day; an end at or before the start runs overnight) are stored in the worker's IANA zone (`candidate_profiles.time_zone`, default Australia/Melbourne). Exceptions are dated overrides, all day or a time window; unavailable always wins. Commitments are UTC instants (held / confirmed) with venue zone context. `app/services/availability.py` is pure and answers an absolute UTC interval:
`confirmed` / `held` (commitment overlap) → `unavailable` (blocked or outside declared times) → `available` (wholly covered) → `unknown` (nothing shared). Unknown is never read as available. `offered` is reserved for a future offer flow and is never produced. DST: wall-clock times resolve with fold=0, so a time in the spring-forward gap moves to the first valid instant and a repeated hour resolves to its first occurrence; a 22:00–06:00 window lasts 7 or 9 real hours on a changeover night. Tested for Melbourne 4 Oct 2026 and 4 Apr 2027 and a Saturday shift ending Sunday. Confirmed commitments cannot overlap (checked under a per-candidate row lock); applications never create one.

**Privacy of the tables.** All five new tables are FORCE-RLS, candidate-only. Employers get no direct read; a test proves the database returns zero rows to an employer session.

**Discovery requires consent twice.** A candidate is searchable for a kind only if the master `discoverable` switch is on AND that kind is enabled AND its `discoverable` consent is on. Each change writes to the append-only-style consent history and the audit log. Turning a kind off withdraws its consent, and turning it back on asks again. Profile completeness never opts anyone in.

**Search is a whitelist.** `POST /v1/employers/{id}/talent/search` is recruiter+, verified employers only, rate limited (per employer and per user), paged (≤25, a request scans at most 400 rows) and audited with the candidate ids shown. It runs in `system_scope` because employers cannot read the tables, and returns only: first name + last initial, headline, suburb/state, up to 8 skills, kinds offered, availability for the asked window collapsed to available / unavailable / unknown (held, confirmed and declared-unavailable are indistinguishable), weekly-hours fit, pay fit, notice / start date (permanent only), a "prefers your business" label and a list of what is unknown. Never returned: the private pay floor, the calendar, commitments, exceptions, blocked employers, email, postcode, exact location or the account id. The reference is an HMAC per (employer, candidate), so employers cannot correlate a person across organisations.

**No ranking, no probing.** Results are ordered by an arbitrary stable key. "Prefers your business" is a label, not a boost. Pay fit is only ever `compatible` or `not_confirmed` against the disclosed pay of the employer's own job, so repeated searches cannot binary-search a worker's floor. There is no age, gender, ethnicity, disability or similar field to filter on, and nothing scores, rejects or hires anyone.

**Employer preferences.** `follow` is a label to that employer; `hide_from` removes the person from that employer's search; `mute` removes that employer's jobs from the person's own search. Hide is best effort: it matches the employer record, so it cannot hide someone from a business trading under another entity or from people who already know them. The UI says so.

**Invitations.** There is no messaging path, so there is no Send button; the page states why. `invite_available` is false in the API.

## Known gaps and risks

- Overlap of confirmed commitments is enforced in the service under a row lock, not by a database exclusion constraint (needs `btree_gist`, which the least-privilege migrator cannot create).
- A time-window search reveals one bit (free or not) about each candidate for that window; the window is capped at 14 days and searches are rate limited and audited.
- Refs derive from the JWT secret; rotating it changes all refs (acceptable until invitations exist).
- Native keyboard behaviour, screen readers, Hermes `toLocaleString` formatting of commitment times and real DST on a handset are unverified on devices.
- Counsel review is needed for the discovery notice, the Privacy Act position on search and the anti-discrimination position before any real use.
