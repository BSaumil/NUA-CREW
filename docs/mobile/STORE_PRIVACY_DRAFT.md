# Store privacy answers — DRAFT for counsel review (not a legal statement)

Based on what the code does today. Re-check before every submission. The app contains **no analytics, advertising or attribution SDKs**.

| Data | Collected? | Linked to user | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Name, email | Yes | Yes | Account, applying | Required |
| Profile (headline, suburb, skills, preferences, minimum pay) | Yes (user-entered) | Yes | Matching estimates, applications | Min pay is private; employers never see it |
| Resume text | Yes (user-entered) | Yes | Applications | Shared with an employer only when the user applies with it |
| Approximate location | **Used, not stored** | No | "Near me" search | Coarse, rounded to ~1 km, sent per request, never persisted by the API |
| Push token | Yes (if push enabled) | Yes | Notifications | Deleted on sign-out, account deletion or provider "not registered" |
| Applications, saved jobs/searches, notifications | Yes | Yes | Core functionality | |
| Work preferences (permanent/temporary, hours, travel, notice period, pay floor) | Yes (user-entered) | Yes | Matching, optional talent discovery | Pay floor is private and never shown to employers |
| Weekly availability, one-off changes, booked work | Yes (user-entered) | Yes | Answering "free for this time?" for employers who the person allowed to find them | Employers never see the calendar, only free / not free / unknown for a time they ask about |
| Employer preferences (prefer / hide / mute) | Yes (user-entered) | Yes | Discovery and job filtering | Never shown to employers |
| Talent-discovery consent (per kind) | Yes | Yes | Consent record | History kept; off by default |
| Device label (e.g. "Pixel 9") | Yes | Yes | Shows/revokes signed-in devices; refresh-token family | |
| Diagnostics / crash data | No | — | — | None collected yet |
| Contacts, photos, microphone, camera, precise location, health | No | — | — | Permissions are blocked in the manifest |

**Third parties:** Expo's push service receives the push token plus notification title/body when push is enabled (`NUA_PUSH_PROVIDER=expo`). No other third party receives user data.
**Tracking (Apple ATT):** none — no tracking, so no ATT prompt.
**Account deletion:** in-app (Settings → Delete my account), erases profile, resumes, applications, saved items, devices and sessions; audit history is kept without personal data. Employer-held hiring records about the applicant are erased with the application — whether employers must retain them is an open legal question (`docs/legal-launch-gates/AUSTRALIA.md`).
**Data export:** in-app JSON export.
**Children:** not designed for under-16s; age rating and terms need counsel.

**Talent discovery (new):** verified employers can see first name and last initial, headline, suburb, up to 8 skills, and free/not free/unknown for a time they ask about, only for people who turned it on for that kind of work. Counsel must review the notice and the Privacy Act position before real use (ADR-009).
