# Private document vault deployment runbook

This source implements candidate document storage and explicit per-application sharing on web and the shared Android/iOS app. Uploads default to disabled. Do not advertise them as publicly available until staging acceptance and production configuration are complete.

## Configuration

Settings use the `NUA_` environment prefix. Never commit provider credentials.

| Setting | Production requirement |
| --- | --- |
| `NUA_DOCUMENT_STORAGE` | `s3`; `disabled` is the safe default; `local` is development-only. |
| `NUA_DOCUMENT_S3_BUCKET` | Dedicated private AWS S3 bucket in the selected Australian region. |
| `NUA_DOCUMENT_S3_REGION` | Defaults to `ap-southeast-2`. Confirm account/data residency requirements. |
| `NUA_DOCUMENT_CLAMD_HOST` | Reachable private ClamAV service with maintained signatures. |
| `NUA_DOCUMENT_CLAMD_PORT` | Defaults to `3310`; internal network only, never public internet. |

Use the normal AWS credential chain with scoped workload credentials. Grant the API only GetObject/PutObject on its `documents/*` prefix, and the deletion worker DeleteObject on that prefix. Deny public ACLs, enable all four S3 Block Public Access settings, enforce TLS, use server-side encryption, and configure retention/backups deliberately. This implementation does not automatically provision or verify bucket policy. No public or presigned URLs are returned. API downloads authenticate and check application consent/membership on every request.

Versioned buckets and backups need an explicit permanent-erasure retention policy: deleting a current object alone does not erase older versions/backups. Set this policy before accepting real personal documents. Moving the bucket or prefix requires draining deletion jobs and migrating existing bytes first; rows do not retain a historical bucket name.

Run migrations through the schema-owner connection; API and worker must use the existing non-superuser, non-BYPASSRLS runtime role. Document migration head is `a44b95ef1004`, following the current hospitality migration `b44c05ef1004`. Run the worker with the same storage configuration as the API. Its durable deletion queue retries failures; monitor backlog and attempts. Do not downgrade the document migration until all files have been removed through the API and cleanup is drained. Account deletion cascades enqueue object cleanup transactionally.

## File and consent model

- Resume: PDF. Certificates: PDF/JPG/PNG. Maximum 4 MiB/file, 30 saved reservations/candidate, 10 shared files/application. Web proxy stays below the Vercel function request size ceiling.
- Server-generated UUID object paths; user filenames never become storage paths. Immutable saved bytes; a changed file requires a new reservation. Stable retry keys reject mismatching metadata.
- Malware scanning fails closed: only an exact clean ClamAV response releases bytes. Signature checks reject type mismatches. PDFs must be unencrypted, 1–200 pages, without root actions or JavaScript/embedded-file name entries. This is not a complete content-disarm service or qualification verification.
- Resumes/certificates are private. Candidates explicitly select attachments when applying. Employers see only selected files through that application; withdrawal/removal blocks subsequent access. Previously downloaded employer copies cannot be recalled.
- RSA issuer, state, completion and refresher/review date are self-reported. No automatic Australia-wide qualification validity. A scanner result never marks a qualification verified.
- Native picking/sharing uses temporary OS cache copies with best-effort cleanup; downloaded share copies are removed after the share operation. Test OS share completion, failure and cache cleanup on physical devices. Recipients can save an external copy. Do not persist bytes or signed links in AsyncStorage.

## Required acceptance before release

1. Migrate an isolated PostgreSQL database with runtime RLS role; run `uv run python -m pytest tests/test_document_vault.py -q` plus the existing API suite. Verify account deletion cascades, IDOR, tenant switching, withdrawn applications and queued cleanup.
2. Use an actual isolated S3 bucket and actual ClamAV. Upload clean fixtures and an approved antivirus test fixture; scanner outage and ambiguous reply must fail closed without a ready file. Validate encryption and absence of public access externally.
3. Verify API restart durability, interrupted uploads, retry metadata/hash mismatch, full vault recovery, deletion retries, backups/version removal policy and redacted logs.
4. Test candidate/employer web against reachable staging; verify request origins, attachment headers, file size rejection and keyboard/screen-reader states.
5. Build/install Android and iOS test binaries; exercise camera permission denial, PDF/document providers, interrupted network, account/business switching, share sheet and temporary copy cleanup. A Hermes export is not an APK/IPA or device test.

No storage/scanner infrastructure or real credentials were provisioned in this implementation pass. Status readiness reports configuration presence; it is not a provider connectivity health probe. Implement monitored operational probes before launch.
