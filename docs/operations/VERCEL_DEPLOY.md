# Deploying to Vercel (iksaa.com.au)

Status (2026-10-28): **nothing is deployed yet.** The Vercel connection available to the build agent can read the team (`sam-nua`, Hobby plan, no projects) but gets `403 forbidden` on creating projects, and the Vercel GitHub integration is installed for the GitHub account `Sam-NUA`, not for `BSaumil/NUA-CREW`. A person with the Vercel dashboard needs to do steps 1–2 once.

## What can run on Vercel
| Part | On Vercel? | Notes |
| --- | --- | --- |
| `apps/site` (public site, iksaa.com.au) | Yes, now | Static; needs no API or database |
| `apps/web` (NUA CREW Jobs web) and `apps/employer` (NUA CREW Hire) | Yes, but only useful once the API exists | Server actions call the API; set `API_BASE_URL` |
| `services/api` (FastAPI) | Possible (Python runtime, Fluid compute) | Needs Postgres and Redis (below) |
| Postgres 16 with RLS, Redis | Not on Vercel itself | Vercel Marketplace (Neon, Upstash) are separate, usage-billed resources: needs an owner decision |
| `app.worker` (ingestion loop, push, expiry sweep) | Not as written | A long-running loop does not fit serverless; it would become a Vercel Cron job hitting a protected endpoint (not built) |
| Android and iOS apps | No | Built with EAS and published to the stores |

Vercel's Hobby plan is for non-commercial use; a commercial site needs the Pro plan.

## 1. Let Vercel read the repository
Either install the Vercel GitHub app on the `BSaumil` account for `NUA-CREW`, or move/fork the repository under `Sam-NUA`. Without this, Vercel cannot link the repo.

## 2. Create the site project (dashboard → Add New → Project → import `NUA-CREW`)
- Project name: `nua-crew-site`
- Framework preset: Next.js; **Root Directory: `apps/site`** (leave "Include source files outside of the Root Directory" on)
- Install/build commands: defaults (pnpm is detected from `pnpm-lock.yaml`; the repo pins `pnpm@11.25.0`, so if the build says the pnpm version is unsupported, set `ENABLE_EXPERIMENTAL_COREPACK=1`)
- Production branch: `main` (the site code is on PR #4 until it is merged)
- Environment variables (Production and Preview):

| Variable | Value now | Later |
| --- | --- | --- |
| `NUA_SITE_URL` | `https://iksaa.com.au` | |
| `NUA_APP_URL` | `https://app.iksaa.com.au` | |
| `NUA_HIRE_URL` | `https://hire.iksaa.com.au` | |
| `NUA_PRODUCT_LIVE` | leave unset | `true` when the app hosts are live |
| `NUA_CONTACT_EMAIL` | leave unset until a mailbox exists | the real address |
| `NUA_SITE_INDEXABLE` | leave unset (site is `noindex`) | `true` to allow search engines |

## 3. Attach the domain
Project → Settings → Domains → add `iksaa.com.au` and `www.iksaa.com.au` (redirect `www` to the apex). Vercel then shows the exact DNS records to create at the registrar that holds `iksaa.com.au`; typically an `A` record for the apex and a `CNAME` for `www`. Use the values the dashboard shows. Nothing is purchased by adding a domain you already own.

## 4. Product apps and API (needs decisions)
1. Choose managed Postgres and Redis (for example Neon and Upstash through the Vercel Marketplace) and approve the cost.
2. Create the least-privilege roles with `db/roles/bootstrap.sql` as a database administrator (includes `btree_gist`), then run Alembic as the migrator role.
3. API project `nua-crew-api` (root `services/api`): `NUA_DATABASE_URL` (runtime role), `NUA_MIGRATION_DATABASE_URL` (migrator, for the migration step only, not the runtime), `NUA_REDIS_URL`, a long random `NUA_JWT_SECRET`, `NUA_ENV=production`, `NUA_CORS_ORIGINS` for the two app hosts, `NUA_PUSH_PROVIDER` when push credentials exist. `NUA_ENV=production` also makes the API refuse a database role that bypasses RLS.
4. Projects `nua-crew-web` (root `apps/web`, domain `app.iksaa.com.au`) and `nua-crew-hire` (root `apps/employer`, domain `hire.iksaa.com.au`) with `API_BASE_URL=https://api.iksaa.com.au`; API domain `api.iksaa.com.au`.
5. Replace the worker loop with Vercel Cron and set `NUA_PRODUCT_LIVE=true` on the site.

Do not run the development seed in production; it is refused outside `NUA_ENV=development`.
