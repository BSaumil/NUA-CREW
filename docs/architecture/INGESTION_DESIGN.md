# Ingestion design (current implementation)

`admin run → active_permission() → connector.discover/fetch/parse → field filter (permitted_fields) → content hash → upsert (source, external_id) → job + job_version → expire absent records (snapshot feeds)`

- **Fail closed:** no active source + unrevoked in-window permission ⇒ run recorded as `rejected`, nothing fetched or indexed.
- **Idempotent:** unchanged hash ⇒ no new version; changed ⇒ job updated + new `job_versions` row; reappearing ⇒ republished.
- **Validation:** records that fail Pydantic validation (e.g. non-https apply URL) are counted `invalid` and never published. There is no LLM step, so no LLM output is auto-published.
- **Safety:** markup stripped; text is stored as data; fixture paths cannot escape `fixtures/`; `assert_safe_url` (https only, allow-listed host, public IPs only) is ready for network connectors.
- **Provenance:** attribution from the permission is stored on the job; raw filtered record is kept in `job_source_observations.raw`.
- **Takedown:** revoking a source unpublishes its jobs and revokes grants.
- **Pipeline (ADR-006):** durable Postgres queue with lease/reclaim, exponential-backoff retries, dead-letter list with audited operator requeue, per-source throttle and single-flight lock, circuit breaker, slot-keyed scheduler, stale-job expiry, and a `python -m app.worker` process. Admin endpoints: schedule, enqueue, tasks, requeue, reset-circuit, stats.
- **Missing:** outbox to an embedding queue, embeddings, OTel/Prometheus metrics, cross-source dedupe, any network connector (needs a signed licence), SSRF-hardened fetcher with size/decompression limits.
