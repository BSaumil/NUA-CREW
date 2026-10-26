# ADR-007: Mobile authentication, offline cache and account lifecycle

**Status:** accepted (mobile app v0.1).

**Tokens.** Mobile sign-in (`client: "mobile"`) returns a 30-minute access token plus a **rotating, single-use refresh token** (random 384 bits, stored as SHA-256). The app keeps the access token in memory and the refresh token in Keychain/Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Refresh lifetime is 30 days sliding with a 90-day absolute cap per sign-in ("family"). **Reuse of a retired token revokes the whole family** (theft/replay signal) — the replay returns 401 and persists the revocation. The client shares one in-flight refresh between concurrent requests, because a second parallel refresh would look like reuse. Web apps are unchanged (no refresh token; they use httpOnly cookies, ADR-004). Password change and "sign out of all devices" revoke every refresh token. Employer accounts are refused by the app and the freshly issued token is revoked.

**Offline.** Only public job data (`jobs`, `job` queries) is persisted for offline reading. Applications, profile, resumes, notifications and saved items live in memory because AsyncStorage is unencrypted. The cache is wiped on sign-out and account deletion. "Near me" is never restored from disk; the position is requested again each session.

**Location.** Foreground, coarse, rounded to two decimals (~1.1 km) before leaving the phone; the API uses it for one query and does not store or log it. Distances come from approximate suburb centroids (not a licensed gazetteer) and are straight-line.

**Push.** Opt-in, token registered only after the OS permission is granted. Delivery is a worker step with an adapter (disabled by default): only notifications from the last 24 h, never for users who turned push off, payload carries identifiers only, dead tokens deleted, each notification processed once. The token follows the most recent sign-in on a device.

**Account lifecycle.** In-app export and erasure (store requirement). Erasure deletes the candidate and everything cascading from them; `application_events` and `audit_events` no longer have a foreign key to `users`, so append-only history survives (audit rows keep only the orphaned id). Businesses must go through support.

**Trade-offs.** Expo push means a third-party processor sees token + alert text; a native FCM/APNs adapter can replace it. Web `localStorage` credential storage exists only for development/testing builds.
