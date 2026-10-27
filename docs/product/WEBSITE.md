# Public website (`apps/site`)

A static marketing site for everything NUA CREW does: job seekers (Jobs), employers (Hire), how it works (permanent/temporary preferences, availability, invitations, messaging), pricing preview, trust and privacy, apps status, contact and legal placeholder. Brand: NUA CREW tokens and components from `packages/ui` (burgundy, deep wine, ivory, gold, teal; Manrope + Inter; 12/20 px radii), light and dark. No cookies, forms, analytics, third-party scripts or API calls.

Run: `make site` (http://localhost:3002) · build: `pnpm --filter @nua-crew/site build` · tests: `tests/e2e/specs/site.spec.ts` (every page, axe light/dark, 360 px, no foreign requests, truthfulness checks).

## Placeholder domain
The site uses `nua-crew.example` (reserved, never resolves; RFC 2606), `app.nua-crew.example`, `hire.nua-crew.example` and `hello@nua-crew.example`. Nothing claims a real domain or trade mark. While the address is a placeholder the site sends `noindex` and a disallow-all `robots.txt`.

**When the owner provides the domain, set environment variables only (no code change):**

| Variable | Purpose |
| --- | --- |
| `NUA_SITE_URL` | This site's canonical origin (sitemap, metadata) |
| `NUA_APP_URL` | NUA CREW Jobs web app origin (login/register/jobs links) |
| `NUA_HIRE_URL` | NUA CREW Hire origin |
| `NUA_CONTACT_EMAIL` | Contact address |
| `NUA_SITE_INDEXABLE=true` | Allow search engines (set only when live) |

## Content rules
Every claim maps to shipped, tested behaviour; no testimonials, statistics, logos or "best" claims. The apps page states they are not in the stores and links no store. Pricing is labelled a preview (billing is off; A$30 promotion is an add-on, unconfirmed; tax unresolved). Legal page says Terms and Privacy Policy are pending legal review. The phone illustrations use fictional sample data and are labelled so. Update copy when product behaviour changes.

## Not done
Real logo artwork (the SVG is the working concept), Open Graph image, Terms and Privacy Policy text (needs counsel), store badges (nothing is published), contact form (would need a backend and a privacy notice), analytics (deliberately none), and deployment (needs owner approval and a domain).
