# Tenant, consent and document threat model (4 November 2026)

Extends `docs/security/THREAT_MODEL.md`. Tests named below exist in `services/api/tests`; they ran green in CI on the merged heads and, for the whole suite, locally (357 passed).

## Access matrix
| Actor | Own data | Another candidate's data | Another employer's data | Documents |
| --- | --- | --- | --- | --- |
| Candidate | Read/write | Denied (`test_candidates_are_isolated_from_each_other`, `test_candidate_isolation`) | n/a | Own only |
| Employer member | Own business, jobs, applicants | Only via an application to its own jobs (`test_employer_sees_only_applicants_to_its_own_jobs`, `test_no_candidate_leak_without_application`) | Denied (`test_other_employer_sees_nothing_of_a`, `test_employer_tenant_isolation`) | Only files a candidate explicitly shared on an application; vault tables not queryable (`test_document_rls_is_forced_and_employers_cannot_query_vault`) |
| Viewer role | Read-only | — | Denied | — |
| Anonymous | Public job rows only (`test_anonymous_sees_only_public_rows`) | Denied | Denied | Denied |
| Runtime role | Cannot bypass RLS or alter schema (`test_runtime_role_cannot_bypass_rls`, `test_runtime_role_is_not_the_owner_and_cannot_change_the_schema`) | — | — | — |

## Consent and contact
Worker discovery respects consent per kind and a master switch; employers reach people only through invitations; invitation quotas, an employer-wide decline cooldown, and "one conversation per accepted invitation" are enforced (ADR-009, ADR-010; `test_invitations.py`, `test_availability*.py`). A candidate block closes the thread for the employer (verified in the browser and by API in `invitations.spec.ts`).

## Documents
- Private by default; shared per application, revocable; withdrawal revokes access; account erasure queues storage cleanup (`test_private_document_application_sharing_withdrawal_and_durable_delete`, `test_account_erasure_keeps_private_storage_cleanup_without_the_profile`).
- **Uploads are disabled** (`NUA_DOCUMENT_STORAGE=disabled`). Private S3-compatible storage and malware scanning are **not connected**. Do not enable uploads before both exist and are tested.
- Versioned buckets and backups need an explicit permanent-erasure policy (`docs/DOCUMENT_VAULT_SETUP.md`).

## Country
A country value or filter never authorises access; membership and RLS do. Client-supplied tenant, business or country claims are not trusted; the server derives the workplace country from the owned venue.

## Residual risks
No MFA or breach check; no device attestation; no CSP yet; database owner can disable audit triggers (see the base threat model). Real malware scanning, scanner-outage behaviour and storage-grant expiry are untested because they are not connected. Revoked-download denial is tested at API level, not against real storage.
