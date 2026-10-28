# Public website (`apps/site`)

A static marketing site for everything NUA CREW does: job seekers (Jobs), employers (Hire), how it works (permanent/temporary preferences, availability, invitations, messaging), pricing preview, trust and privacy, apps status, contact and legal placeholder. Brand: NUA CREW tokens and components from `packages/ui` (burgundy, deep wine, ivory, gold, teal; Manrope + Inter; 12/20 px radii), light and dark. No cookies, forms, analytics, third-party scripts or API calls.

Run: `make site` (http://localhost:3002) · build: `pnpm --filter @nua-crew/site build` · tests: `tests/e2e/specs/site.spec.ts` (every page, axe light/dark, 360 px, no foreign requests, truthfulness checks).

## Domain and deployment
The site is configured for `iksaa.com.au` (with `app.` and `hire.` subdomains reserved for the product). Deployment to Vercel is described in `docs/operations/VERCEL_DEPLOY.md`; it is not deployed yet. All addresses come from environment variables, so no code change is needed to switch hosts:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NUA_SITE_URL` | `https://iksaa.com.au` | Canonical origin (sitemap, metadata) |
| `NUA_APP_URL` / `NUA_HIRE_URL` | `https://app.iksaa.com.au` / `https://hire.iksaa.com.au` | Product app origins |
| `NUA_PRODUCT_LIVE` | unset | `true` links Log in / Find work / Register to the app hosts. Unset: those buttons go to the launch-status page, so nothing links to a host that does not exist |
| `NUA_CONTACT_EMAIL` | unset | Published contact address. Unset: none is shown (we do not invent a mailbox) |
| `NUA_SITE_INDEXABLE` | unset | `true` allows search engines; otherwise `noindex` and a disallow-all robots.txt |

## Content rules
Every claim maps to shipped, tested behaviour; no testimonials, statistics, logos or "best" claims. The apps page states they are not in the stores and links no store. Pricing is labelled a preview (billing is off; A$30 promotion is an add-on, unconfirmed; tax unresolved). Legal page says Terms and Privacy Policy are pending legal review. The phone illustrations use fictional sample data and are labelled so. Update copy when product behaviour changes.

## Not done
Real logo artwork (the SVG is the working concept), Open Graph image, Terms and Privacy Policy text (needs counsel), store badges (nothing is published), contact form (would need a backend and a privacy notice), analytics (deliberately none), and deployment (needs owner approval and a domain).
