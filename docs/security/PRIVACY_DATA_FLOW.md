# Privacy data flow (initial)

Personal data held: email + password hash, profile (name, suburb, pay expectation), resume text, applications and events, notifications. Candidates choose what to apply with; employers only see a candidate who applied to one of their jobs, and only the profile, note and resume version attached to that application. Employer private notes and rejection reasons are never returned to candidates. `discoverable` defaults to false and every change writes a `consents` row.

Not yet built: data export, deletion workflow (the append-only triggers allow `DELETE` only when a transaction sets `app.allow_erasure`), retention schedules, embeddings handling, cookie/consent banner, APP-aligned collection notices. These need legal review.
