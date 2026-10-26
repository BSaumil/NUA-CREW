# Data model (as built)

Source of truth: `services/api/app/models.py` and `services/api/alembic/versions/`. All tables use UUID primary keys and UTC timestamps. Enumerations are `text` + CHECK constraints.

| Area        | Tables                                                                                           | Privacy class                                  |
| ----------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Identity    | `users`, `consents`, `audit_events`                                                              | Personal (email, hash); audit = append-only    |
| Candidate   | `candidate_profiles`, `candidate_skills`, `resumes`, `resume_versions`                           | Personal; resumes high sensitivity             |
| Employer    | `employers`, `employer_memberships`, `locations`                                                 | Business; membership personal                  |
| Jobs        | `jobs`, `job_versions`, `job_skills`, `skills`                                                   | Public once published                          |
| Sourcing    | `ingestion_sources`, `source_permissions`, `job_source_observations`, `source_fetch_runs`, `ingestion_tasks` | Operational; raw third-party payloads |
| Mobile      | `refresh_tokens` (hashed, rotating), `saved_jobs`, `saved_searches`, `device_tokens`                | Personal; push tokens are credentials          |
| Pipeline    | `applications`, `application_events`, `notifications`                                            | Personal; events append-only                   |

RLS is enabled and forced on 24 tables (ADR-003); `ingestion_tasks` is operator-only. Key constraints: unique `lower(email)`; `uq_applications_active (job_id, candidate_id) WHERE status <> 'withdrawn'`; `UNIQUE(source_id, external_id)`; pay CHECKs (`pay_min <= pay_max`, period required, `pay_basis` consistent with presence of pay); `origin='direct' ⇒ employer_id`, `origin='ingested' ⇒ apply_url`; `forbid_history_mutation()` triggers on `application_events` and `audit_events`.

**Not yet created** (from the brief): `identity_verifications`, `sessions`, `access_requests`, `deletion_requests`, all shift tables, `embeddings`, AI tables, billing tables, `feature_flags`, conversations/messages, interviews.
