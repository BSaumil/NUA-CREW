# API contracts

The live OpenAPI document is generated from code: `pnpm contracts` writes `packages/contracts/openapi.json` and `schema.d.ts`; CI fails if they drift. Errors use `{"error": {"code", "message"}}` (validation errors use FastAPI's `{"detail": [...]}`).

| Area      | Endpoints                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Auth      | `POST /v1/auth/register/{candidate,employer}`, `POST /v1/auth/login`, `GET /v1/auth/me`                                         |
| Candidate | `GET/PUT /v1/candidate/profile`, `PUT /v1/candidate/consents/talent-discovery`, resumes CRUD + versions, applications list/get/withdraw |
| Public    | `GET /v1/jobs` (q, suburb, state, employment_type, category, skill, page), `GET /v1/jobs/{id}`                                  |
| Candidate + job | `GET /v1/jobs/{id}/match`, `POST /v1/jobs/{id}/applications` (optional `Idempotency-Key`)                                |
| Employer  | `/v1/employers/{eid}` locations, members, jobs (CRUD, publish, unpublish, close), job applicants, application detail, status, private notes |
| Admin     | employer verification; ingestion source create / grant permission / run / takedown / schedule / enqueue / reset-circuit; tasks list + requeue; stats |
| Mobile    | `POST /v1/auth/refresh`, `/logout`, `/logout-all`; saved jobs (`/v1/candidate/saved-jobs`, `/ids`), saved searches CRUD, `POST/DELETE /v1/devices`, `PUT /v1/candidate/notification-settings`, `GET /v1/account/export`, `POST /v1/account/password`, `DELETE /v1/account`, `POST /v1/notifications/read-all`; search adds `min_hourly`, `near_lat/near_lng/radius_km`, `sort`, `posted_within_days` |
| Misc      | `GET /v1/notifications`, `POST /v1/notifications/{id}/read`, `/healthz`, `/readyz`                                              |

Authorisation rules: employer routes require membership (404 otherwise); write routes require `recruiter`+; member management and locations require `owner`; admin routes require `role=admin`.
