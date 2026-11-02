# NUA CREW — Website SEO, Indexing and Features: Handoff for ChatGPT (2026-10-31)

**Paste this first:** *You are the lead web engineer and SEO lead for NUA CREW. Read this whole file, then `CLAUDE.md`, `docs/BRAND_IDENTITY.md`, `docs/MASTER_BRIEF.md` and `docs/product/WEBSITE.md`. Work only in `apps/site` unless a work package says otherwise. Do the work packages in the order given. Every change goes through a branch and pull request with green CI. Do not flip the site to indexable, deploy anything other than via a merged PR, or publish claims that are not true today. Report what you verified and what you could not.*

---

## 1. Mission and definition of done

Make `https://iksaa.com.au` a fast, accessible, honest, fully search-ready marketing website, and add the missing website features, so that **flipping one switch (`NUA_SITE_INDEXABLE=true`) is all that remains** once the owner clears the legal and brand gates in section 7.

Done means:

1. Every public page has a unique title, a 120–160 character description, a canonical URL, complete Open Graph and Twitter metadata, and valid structured data that states only true things.
2. `robots.txt`, `sitemap.xml`, icons, web manifest and share images are correct and tested, in both `noindex` and `indexable` modes.
3. Lighthouse (mobile) is at or above 95 for Performance, 100 for Accessibility, and 100 for Best Practices and SEO on every page. Core Web Vitals are inside "good" thresholds (LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms). **None of these has been measured yet** (see section 4).
4. The new features in section 6 that the owner approved are built, tested and documented.
5. All existing tests stay green, the SEO tests listed in section 9 are added, and `docs/IMPLEMENTATION_TRACKER.md` and `docs/product/WEBSITE.md` are updated.
6. A launch runbook exists for the indexing steps in section 8.

---

## 2. Ground truth (verified 31 October 2026)

| Item | State |
|---|---|
| Repo | `github.com/BSaumil/NUA-CREW`, default branch `main`, tip `d3057556d4181dd993aa5f2bcafd41373421fd9c` (merge of PR #20) |
| Site app | `apps/site`: Next.js `^16.4.3` (App Router), React `^19.1.10`, TypeScript `~5.9.3`, `lucide-react 0.468.0`, pnpm `11.25.0`, Node 22. Static prerendered pages. |
| **Read before coding** | `apps/site/AGENTS.md` says this Next.js has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing metadata, route handlers or image config. Do not rely on memory of older Next.js APIs. |
| Hosting | Vercel project `nua-crew-site` (`prj_d0KGaH2XnFHppJMlnW9JOLtgTodz`, team slug `bsaumil`, team id `team_U8hjJWj8ACvV3NUxbRIzBldT`), root directory `apps/site`, production deploys automatically from `main` |
| Production deployment | `dpl_575XEsLEBwZnNHengd5ijbJ2Fjjt`, READY, aliases include `iksaa.com.au` |
| Domains on the project | `iksaa.com.au` (verified) and `nua-crew-site.vercel.app`. **`www.iksaa.com.au` is not attached.** `app.iksaa.com.au` and `hire.iksaa.com.au` are referenced in code but nothing is deployed there. |
| Vercel env vars | **None are set** on the project (the listing returned an empty array). So the code defaults apply: not indexable, product not live. |
| Indexing today | **Blocked on purpose.** Live `robots.txt` is `User-agent: *` / `Disallow: /`, and every page has `<meta name="robots" content="noindex, nofollow">`. The sitemap exists and lists 16 URLs but is not referenced from `robots.txt` while not indexable. |
| Preview protection | The project has Vercel SSO protection for everything except custom domains, so `*.vercel.app` URLs are behind a login. Not re-verified in this session whether `nua-crew-site.vercel.app` is publicly reachable; check before indexing (section 8, step 2). |
| Plan | `docs/operations/VERCEL_DEPLOY.md` says Vercel Hobby is non-commercial and a commercial site needs Pro. Confirm the plan. |
| Analytics / cookies / third-party scripts | None, deliberately. A test fails if any request leaves the site's own origin. |
| Brand status | The footer says: *"NUA CREW is a product name; no separate registration or trade mark status is claimed."* Brand clearance is still an open owner/counsel item. |
| Business identity (from `apps/site/lib/business.ts`, checked against ABN Lookup 30 Oct 2026) | NUA POS / NUA AUS, ABN 54 299 131 653, 7 Rowe Street, Alphington VIC 3078, `info@nuapos.com.au` |
| Product status | Apps are not published; billing is off; hiring product is in pre-launch testing. `SITE.productLive` is false. |

### Recent work (so you do not redo it)

| PR | What |
|---|---|
| #13 | Home hero image and two illustrations on the candidate web app (`apps/web`) |
| #15 | Fixed a flaky worker test (clock pinned mid-slot) |
| #19 | Replaced 10 marketing images with clean artwork; fixed feature-card cropping; caption contrast |
| #20 | **Removed all eight banner images**, rebuilt visuals: photo-led home hero, six feature rows, HTML interface previews, five-step journey, Android/iPhone mockups, pricing comparison table. Deleted ten decorated feature images. |

### What exists now in `apps/site/app` (relevant files)

- `layout.tsx`: global metadata (`metadataBase`, title template `%s · NUA CREW`, default description, Open Graph with `/illustrations/hospitality-team.webp` 1200×900, `robots` flag), header, footer.
- `robots.ts`, `sitemap.ts`: driven by `SITE.indexable` and the `PAGES` list in `lib/site.ts`.
- `lib/site.ts`: env-driven `SITE` (`NUA_SITE_URL`, `NUA_APP_URL`, `NUA_HIRE_URL`, `NUA_PRODUCT_LIVE`, `NUA_CONTACT_EMAIL`, `NUA_SITE_INDEXABLE`), `NAV`, `PAGES`.
- `visuals.tsx`: `FeatureImage`, `FeatureRows`, `PreviewFrame`, `JobSearchPreview`, `HiringDashboardPreview`, `ConversationPreview`, `JourneySteps`, `AdOptionsComparison`.
- `components.tsx`: `Section`, `Cards`, `Card`, `Steps`, `Faq`, `PageHero` (with `visual` and `aside` slots), `Cta`, `Phone`, `DeviceMockup`, screen components.
- `visual-showcase.tsx` (six clean illustrations), `feature-explorer.tsx`, `app-walkthrough.tsx`, `journey-preview.tsx`, `price-preview.tsx`.
- `site.css` (about 2,000 lines; the last block is the photography-era layout). Utility `nua-sr-only` comes from `@nua-crew/ui`.
- `public/brand-kit/features/` (six clean 1448×987 WebP illustrations), `public/illustrations/hospitality-team.webp` (1200×900, an **illustration, not a photograph**).

---

## 3. Hard rules (non-negotiable; from `CLAUDE.md` plus what the tests enforce)

**Truthfulness and brand**
- Brand is **NUA** (master) and **NUA CREW** (product), all caps. Never show HIRIVO or Shiftmate. **Never state that the name, domain or trade mark is available, registered or cleared.**
- Colours: Burgundy `#6B1738`, Deep Wine `#3C0B21`, Ivory `#F7F3EF`, Gold `#C9A96E`, Teal `#0FA3B1` for meaningful status only. Fonts: Manrope (display) and Inter (body). Tagline: *Better Jobs. Stronger Teams.*
- No AI claims on the public site (a test fails on the word "AI" and "artificial intelligence"). No owner personal names anywhere (a test fails on them).
- No testimonials, ratings, statistics, awards, "best" claims, store links or invented figures. Pay labels are only *disclosed*, *estimated* or *not disclosed*. Match scores are estimates, never hire probabilities. "Verified" is not endorsement. Software never makes hiring decisions.
- **Never invent or fill in Fair Work figures.** Any pay or award content must come from a cited primary source and be reviewed.
- Concept screens and previews must stay labelled as illustrations with fictional sample data. Never present them as screenshots of a working product.
- Treat all third-party data as untrusted.

**Process**
- No production deploys, merges to `main`, live billing, real scraping, purchases or registrations without explicit owner approval. Work on a branch, open a PR, wait for green CI, and only merge when the owner has said so for that change.
- Never commit credentials. Never disable tests, lint or type checks to get green.

**Tests that will fail if you are careless** (all in `tests/e2e/specs/site.spec.ts` and the repo gates)
- Axe accessibility scan of every page in light and dark mode: no serious or critical violations.
- Forbidden-text scan: no `\bai\b`, no "artificial intelligence", no owner names, no "registered trademark", "™", "®", "domain is available", "name is available".
- A 360 px viewport with no sideways scrolling on every page.
- **No request may leave the site's own origin.** Adding Google Analytics, Tag Manager, third-party fonts or embeds fails this test. Self-hosted or same-origin analytics need an explicit, reviewed test change.
- A test asserts the site is `noindex` and that the sitemap uses the configured domain. When you add indexable mode, make that test **env-aware**; do not delete it.
- `A$10` must not appear on the pricing page; planned prices are A$19, A$30 and A$49 only.

---

## 4. Current SEO audit

| Area | State today | Gap | Priority |
|---|---|---|---|
| Indexing switch | `NUA_SITE_INDEXABLE` unset, so `noindex` plus `Disallow: /` | Correct for now. Flip only after section 7 gates. | Owner gate |
| `<title>` | Present on all 16 pages via template | Check uniqueness and length (50–60 characters). Home title is `NUA CREW — Better Jobs. Stronger Teams.` | P1 |
| Meta description | Written for 11 pages; **5 pages use only the site default** (`/community-guidelines`, `/cookies`, `/employer-terms`, `/legal`, `/terms`) and `/` has none of its own | Several are short: `/apps` ≈79, `/contact` ≈79, `/features` ≈88, `/privacy` ≈100 characters. Aim for 120–160, unique, accurate. | P1 |
| Canonical | Set on every page (confirmed `https://iksaa.com.au/pricing` in live HTML) | Keep; add a test | P1 |
| Open Graph / Twitter | Site-wide only: same title, description and image on **every** page; no `og:url`; image is 1200×900 (4:3) | Per-page title/description/url; add a 1200×630 share image; keep `twitter:card=summary_large_image` | P1 |
| Structured data (JSON-LD) | **None** | Add the safe set in WP2 | P1 |
| `robots.txt` | Correct for both modes | Add a test; add `Sitemap:` only in indexable mode (already done) | P2 |
| `sitemap.xml` | 16 URLs, `changefreq` only | Add `lastModified`; drop `changefreq`; test it matches `PAGES` | P2 |
| Icons / manifest | `app/icon.svg` only | No `favicon.ico`, no `apple-touch-icon`, no 192/512 PNG, no `manifest`. The SVG logo is a **vector recreation**, not official artwork (`docs/DECISIONS_AND_BLOCKERS.md`). | P1 |
| Images | `next/image` with dimensions, alt text, lazy loading; hero is `priority` | `next.config.ts` has no `images` block, so AVIF is not enabled. Photo placeholders are illustrations. | P2 |
| Performance | Static prerendered pages; fonts self-hosted via `@fontsource-variable/*` | **No Lighthouse, WebPageTest or field data measured.** Need a baseline and a budget in CI. | P1 |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; Vercel adds HSTS (`max-age=63072000`, no `includeSubDomains`/`preload`) | No CSP; no `security.txt` | P3 |
| Redirects / hosts | `www.iksaa.com.au` not attached; `*.vercel.app` alias exists | Attach `www` and redirect to the apex; decide how to handle the `vercel.app` alias | P2 (owner DNS) |
| 404 | Custom page, `noindex` | Fine | — |
| Internal linking | Good navigation and footer; each page links onward | Add contextual links and descriptive anchor text in body copy | P2 |
| Content depth | Product pages only | No guides, no about page, no accessibility statement | P2 |
| Search tooling | None configured | Search Console and Bing verification, IndexNow, rich-result testing | Launch step |
| Analytics | None, by design | Decide on a privacy-first option (WP7) | Owner decision |

---

## 5. Work packages (do in this order; one PR each unless noted)

Branch names like `feat/site-seo-wp1-metadata`. Each PR runs: `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`, then CI must pass `web`, `api`, `dependency-audit` and `e2e`.

### WP1 — Metadata system (P1)
**Why:** the whole site currently shares one Open Graph block and some pages share one description.
**Do:**
- Add `apps/site/lib/seo.ts` with a `buildMetadata({ title, description, path, image })` helper that returns `title`, `description`, `alternates.canonical`, `openGraph` (`title`, `description`, `url`, `type`, `siteName`, `locale: 'en_AU'`, `images`) and `twitter`. Use it in every `page.tsx`.
- Write unique descriptions (120–160 characters) for all 16 pages, including the five that use the default and the home page. Use plain, true wording. No superlatives, no AI, no claims of availability.
- Keep the title template `%s · NUA CREW`; keep titles about 50–60 characters.
**Acceptance:** an e2e or unit test iterates `PAGES` and asserts: unique title; description 110–165 characters and unique; canonical equals `SITE.url + path` (`/` has no trailing slash issue); `og:url` equals canonical; `og:image` URL returns 200 as an image.
**Files:** `lib/seo.ts`, every `app/**/page.tsx`, `app/layout.tsx`, test file.

### WP2 — Structured data (P1)
**Do:** a small `JsonLd` component (`<script type="application/ld+json">` with escaped JSON) and builders in `lib/seo.ts`.
- **`Organization`**: use only facts in `lib/business.ts` (name, ABN as `identifier`, address, email). Reference the NUA POS parent honestly. Add `sameAs` only for profiles that really exist.
- **`WebSite`**: name `NUA CREW`, url. **Do not add `SearchAction`** (there is no site search).
- **`BreadcrumbList`** on inner pages.
- **`FAQPage`** on pages that render the `Faq` component (home, how it works, help, pricing), generated from the same data as the visible FAQ so they cannot diverge. Note Google now limits FAQ rich results to a few site types, so treat this as low-value but harmless.
**Do not add:** `JobPosting` (no real, authorised jobs exist), `Product`/`Offer` (billing is not live and prices are planned), `AggregateRating`/`Review` (no reviews exist), `SoftwareApplication` with store links or ratings (apps are not published).
**Acceptance:** a test parses every page's JSON-LD, checks it is valid JSON, contains only the allowed `@type` values, and that every FAQ question in the JSON-LD also appears in the visible page text. Validate samples in Google's Rich Results Test and the schema.org validator and record the results in the PR.

### WP3 — Robots, sitemap and indexing mode (P2)
**Do:**
- `sitemap.ts`: add `lastModified` (a per-page constant map updated when content changes, or the build date; do not fake dates), remove `changefreq`, keep it driven by `PAGES`. Never list `noindex` pages.
- Keep `robots.ts` as is. Consider also emitting an `X-Robots-Tag` header in non-indexable mode so non-HTML files (images) are covered.
- Make the existing "crawlers stay away" e2e test **env-aware** (assert `noindex` when `NUA_SITE_INDEXABLE` is not `true`; assert `index, follow` and an allowing `robots.txt` with the sitemap line when it is). Run the suite once in each mode.
**Acceptance:** both modes tested; sitemap URL set equals `PAGES`; every sitemap URL returns 200 and is self-canonical.

### WP4 — Icons, manifest and share images (P1; blocked in part by artwork)
**Do:**
- Add `apple-touch-icon` (180×180), PNG icons (192, 512, plus a maskable 512), `favicon.ico`, and `app/manifest.ts` (`name` NUA CREW, `short_name` NUA CREW, `theme_color` `#3C0B21`, `background_color` `#F7F3EF`, `display: standalone`, `lang: en-AU`).
- Create a proper **1200×630** share image per section (home, job seekers, employers, how it works, pricing) built from the clean illustrations or the team image, with no baked-in paragraphs. Use Next's file-based `opengraph-image` or static files.
**Blocker:** the icon source is a recreated vector, not the official logo (`docs/DECISIONS_AND_BLOCKERS.md`). Build the pipeline from `brand/svg/app-icon.svg` now, and replace the source when the owner supplies the official artwork.
**Acceptance:** each icon and image returns 200 with the right dimensions; the manifest validates; share images pass a quick visual check at small sizes.

### WP5 — Content and information architecture (P2)
**Do:** review each page's `<h1>`/`<h2>` structure (one `h1`, logical `h2`/`h3`), add contextual internal links with descriptive anchor text, and tighten the first 150 words of each page around its real intent (job seekers: find hospitality work and see pay clearly; employers: post a role with disclosed pay; how it works; pricing; apps status). Do not stuff keywords. Do not add claims.
**Intent map (no volumes are asserted; measure in Search Console after launch):**
| Page | Primary intent | Must stay true |
|---|---|---|
| `/` | What NUA CREW is, for employers and job seekers | Pre-launch status, Melbourne first |
| `/job-seekers` | Find hospitality work with clear pay | Free for job seekers; pay labelled |
| `/employers` | Hire hospitality staff with disclosed pay | Verification is not endorsement; people decide |
| `/how-it-works` | How invitations, availability and messaging work | Consent-based; no automatic hiring |
| `/pricing` | Planned advertising cost | Planned only; billing off; GST pending |
| `/apps` | Where the apps stand | Not in app stores; no store links |

### WP6 — Performance, delivery and security hardening (P1 for measurement, P2 for the rest)
**Do:**
- **Baseline first:** run Lighthouse (mobile) on all 16 pages against a production build and record scores and Core Web Vitals in `docs/reports/SITE_PERFORMANCE_BASELINE.md`. Add a Lighthouse CI job (or a `scripts/` script) with budgets so regressions fail the PR.
- Enable AVIF in `next.config.ts` (`images.formats: ['image/avif','image/webp']`), and verify output sizes. Confirm the hero is the LCP element and loads with high priority.
- Confirm fonts do not cause layout shift (`font-display`, preload) by measuring, not assuming.
- Caching: the clean images reuse fixed paths. If you want long-lived immutable caching, switch to content-hashed filenames and update references; otherwise keep revalidation. Do not disable caching site-wide.
- Add `public/.well-known/security.txt` (contact `info@nuapos.com.au`, expiry date, policy page) once the owner confirms the contact.
- Add a Content-Security-Policy **only** after testing; Next.js inline scripts need nonces or hashes. Start in report-only mode. Consider HSTS `includeSubDomains`/`preload` only once all subdomains are HTTPS (owner decision).
**Acceptance:** committed baseline report; CI budget; headers verified with a script; no regression in the e2e suite.

### WP7 — Measurement and webmaster tools (P2, owner decisions)
**Do:**
- Add verification support via the Next metadata `verification` field (Google and Bing) driven by env vars, so no secrets or tokens are committed.
- If the owner approves analytics: prefer a **cookie-less, first-party-hosted** option (for example Vercel Web Analytics and Speed Insights, which load from the site's own path on Vercel, or a self-hosted tool). Update `/cookies` and `/privacy` to describe it accurately, add a consent decision if anything sets identifiers, and update the "no foreign requests" test deliberately. Do not add Google Analytics or Tag Manager without owner and counsel sign-off.
- Add IndexNow only after launch (section 8).
**Acceptance:** nothing loads from another origin unless explicitly approved; privacy text matches the implementation.

### WP8 — Accessibility statement and WCAG 2.2 AA review (P2)
**Do:** add `/accessibility` (a plain statement: target WCAG 2.2 AA, known limitations, how to report a problem with a response time the owner can keep). Re-run axe in light and dark, test keyboard-only navigation, visible focus, reduced motion, 200% zoom and a screen reader on the home page and one other page. Add the page to `PAGES`, the footer and the sitemap.
**Acceptance:** axe clean in both modes on the new page; manual test notes in the PR.

### WP9 — Real photography (P1 for quality, blocked on the owner)
**Do now:** make the image slots photo-ready: a `Photo` component wrapper (still `next/image`), a rights register `docs/product/IMAGE_RIGHTS.md` (file, source, licence, licence URL or invoice number, model/property releases, date, permitted uses) and a lint-style test that fails if a file in `public/photography/` has no register entry.
**Needs the owner:** licensed or commissioned photography (café, restaurant, kitchen, floor, hotel and events teams; a manager reviewing applicants). Do not source images from unlicensed web results or generate people to imitate real staff. Brief for photographers: authentic Australian hospitality settings, natural light, warm tones that sit with burgundy and ivory, no logos of other brands, signed releases, 3:2 originals at 3000 px or more.
**Acceptance:** with photos supplied, replace the home hero and the how-it-works team image, keep alt text accurate, and re-check the layout at all five widths.

### WP10 — Launch waitlist and contact form (feature; needs owner decisions)
**Why:** the site has no way to capture interest or accept an enquiry; it publishes a mailbox only.
**Needs the owner first:** vendor and cost (a transactional email service and a small managed database, for example through the Vercel Marketplace), who receives enquiries, retention period, and sign-off on the privacy wording.
**Build:** two lists (job seekers, employers) plus a contact form, as a server action or route handler with: explicit consent checkbox, **double opt-in**, one-click unsubscribe, honeypot plus rate limiting, no unnecessary fields, and storage of only name/email/list/consent timestamp. Comply with the **Spam Act 2003** (consent, sender identification, unsubscribe) and the **Privacy Act 1988** (collection notice). Update `/privacy` and `/cookies`. Never reuse the data for anything the person did not agree to.
**Acceptance:** e2e tests for success, validation, duplicate, bot trap and unsubscribe; no third-party client scripts; tenant data and the API are untouched (this is a separate, minimal store).

### WP11 — Guides and content hub (feature; reviewed content only)
**Do:** add a `/guides` section with a typed content model (MDX or TypeScript data), index and article templates with `Article` structured data (author = the organisation, real publish and modified dates), breadcrumb, related links and a table of contents. Candidate topics: how to write a clear hospitality job ad with disclosed pay; what an RSA certificate is and how to check local requirements; running split shifts and availability fairly; what an invitation is and is not (this repeats the product's own rules).
**Rules:** every guide needs a named reviewer and primary-source citations. Anything about awards, pay rates, leave or classification must link to the Fair Work Ombudsman or the relevant Victorian or federal source and must not state figures unless quoted and cited. No invented statistics. Counsel review for anything legal.
**Acceptance:** content passes the forbidden-text and accessibility tests; each guide has a source list; internal links connect guides to product pages.

### WP12 — Later phases (do not start without approval)
- **Public job pages and suburb/role pages:** `docs/MASTER_BRIEF.md` allows SEO-indexable job pages with structured data "only where authorized and accurate". This needs the API deployed, licensed or direct employer data, and `JobPosting` markup with real `validThrough`, correct pay labelling, and removal (410) of expired jobs. Do not generate thin programmatic pages.
- **App deep links and store pages:** only after the apps are published: `apple-itunes-app` meta, `.well-known/assetlinks.json`, Apple app-site-association, store badges.
- **Subdomains:** `app.` and `hire.` are logged-in products. When they exist they must be `noindex` and point canonical references back to the marketing site. Check `apps/web` and `apps/employer` for their own robots handling; this was not reviewed in this session.

---

## 6. Feature backlog summary

| Feature | Value | Effort | Gate |
|---|---|---|---|
| Per-page metadata and share images | High | Low | none |
| Structured data (safe set) | Medium | Low | none |
| Icons, manifest | Medium | Low | official logo for the final art |
| Lighthouse CI and performance budget | High | Medium | none |
| `/accessibility` statement | Medium | Low | owner confirms response commitment |
| `security.txt` | Low | Low | owner confirms contact |
| Real photography | High | Medium | owner licenses photos |
| Waitlist and contact form | High | Medium–High | vendor, cost, privacy sign-off |
| Guides hub | High (long term) | High | named reviewers, citations |
| Privacy-first analytics | Medium | Low | owner and counsel decision |
| Public job and suburb pages | Very high (later) | Very high | API deployed, authorised data |
| App deep links and store badges | Medium | Low | apps published |
| `/about` page (who is behind NUA CREW, using only `lib/business.ts` facts) | Medium (trust) | Low | owner approves wording |

---

## 7. Owner and counsel decisions (you cannot do these; keep the list visible in every PR)

**Blocking the flip to indexable**
1. **Brand clearance** (IP Australia, ASIC, domain, social handles). Until cleared, the footer must keep its current "no registration or trade mark status is claimed" line.
2. **Counsel review** of Terms, Employer terms, Privacy, Cookies and Community guidelines text. Confirm with the owner which of these are final; `docs/product/WEBSITE.md` still lists legal text as needing counsel.
3. **Official logo artwork** to replace the recreated vector.
4. **Decision on indexing now versus at launch.** Recommendation: build everything behind the flag now, and index at (or just before) launch so that "pre-launch" pages are not the first impression in search. If the owner wants earlier indexing, index only the marketing pages and keep every statement accurate.
5. **Vercel plan** appropriate for commercial use, and who owns the account.
6. **DNS**: attach `www.iksaa.com.au` and redirect it to the apex; add Search Console and Bing verification records.

**Needed for features**
7. Vendor, budget and retention for the waitlist and contact form (WP10).
8. Licensed photography and releases (WP9).
9. Analytics decision (WP7) and, if approved, privacy wording.
10. Confirmation of the contact address used in `security.txt`, the accessibility statement and the footer (code currently defaults to the NUA POS support mailbox).

---

## 8. Indexing and launch procedure (run only after section 7 items 1–6)

1. **Pre-flight (a PR):** all WP1–WP4 merged; baseline report committed; CI green; e2e passes in **both** modes.
2. **Verify duplicates:** fetch `https://nua-crew-site.vercel.app/` and any preview URLs while logged out. Confirm they are protected or that every page's canonical points to `https://iksaa.com.au/...`.
3. **Flip the switch (owner approval, recorded in the PR or runbook):** in Vercel, set `NUA_SITE_INDEXABLE=true` for **Production only** (and `NUA_SITE_URL=https://iksaa.com.au`). Redeploy production. Leave `NUA_PRODUCT_LIVE` unset until `app.` and `hire.` actually exist.
4. **Verify live:** `robots.txt` allows crawling and lists `https://iksaa.com.au/sitemap.xml`; no page carries `noindex`; every sitemap URL returns 200; canonical, Open Graph and JSON-LD are present; spot-check with the URL Inspection tool.
5. **Register:** verify the domain property in Google Search Console (DNS TXT) and Bing Webmaster Tools; submit the sitemap in both; submit `IndexNow` if used.
6. **Monitor for 4 weeks:** coverage and indexing reports, Core Web Vitals (field data), queries and clicks, crawl errors, manual actions. Fix, do not guess. Record findings in `docs/reports/`.
7. **Rollback:** unset `NUA_SITE_INDEXABLE` and redeploy to return to `noindex`. For urgent removal use the Search Console removals tool.

---

## 9. Verification checklist and commands

```bash
pnpm install --frozen-lockfile        # use CI=true in non-interactive shells
pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build
make site                              # dev server on http://localhost:3002
pnpm --filter ./apps/site build && pnpm --filter ./apps/site exec next start -p 3100
pnpm e2e                               # needs the API, Postgres (pgvector) and Chrome; CI runs it
```

**Add these tests (suggested file: `tests/e2e/specs/seo.spec.ts`)**
- For every `PAGES` entry: unique title, description 110–165 characters and unique, canonical equals `SITE.url + path`, `og:url` equals canonical, `og:image` resolves, exactly one `h1`.
- JSON-LD parses; only allowed `@type` values; FAQ items match visible text.
- `robots.txt` and the sitemap in both indexing modes; no `noindex` anywhere in indexable mode; `noindex` everywhere otherwise.
- Icons, manifest and share images resolve with the correct dimensions.
- Images: every `<img>` has `alt` (empty only if purely decorative), loaded width > 0, and no broken or distorted images at 360, 390, 768, 1024 and 1440 px.
- Existing guards stay: axe light and dark, forbidden text, 360 px overflow, no foreign requests.

**Browser QA to repeat on every visual change:** five widths, light and dark, keyboard focus, reduced motion, 200% zoom, plus before/after screenshots in the PR.

**Useful, repeatable scripts that were only run ad hoc this session and are not in the repo:** a Playwright sweep over all pages and widths (overflow, broken or distorted images, missing alt, banner references, off-origin requests), and an axe sweep in light and dark. Turn both into committed scripts under `scripts/` and call them from CI.

---

## 10. Lessons and gotchas from this session

- **No licensed photography exists in the repo.** `public/illustrations/hospitality-team.webp` is an illustration. Do not describe it as a photograph.
- Ten older feature images with baked-in decorative lines and slogans were **deleted** (still in git history and the original kit). Do not restore them without cleaning.
- The site has **no separate "Temporary Shifts" page**; shift content is a section on `/how-it-works`.
- `pnpm install` stops on a prompt in non-interactive shells; run it with `CI=true`.
- Prettier is enforced in CI (`pnpm format:check`). Run `npx prettier --write` on touched files.
- `PageHero` takes either `visual` (an intact illustration) or `aside` (an HTML preview). Do not reintroduce wide banners or `object-fit: cover` on illustrations.
- Hero caption text sits on Deep Wine; it inherits ivory text for contrast. Do not set a grey colour on it.
- `apps/site/AGENTS.md`: read the bundled Next.js docs before using any Next API.
- A flaky API test (`test_worker_pass_schedules_and_drains`) was fixed in PR #15 by pinning the clock mid-slot.
- This build environment could not browse the internet or run a browser against production. Anything that needs the live web (Search Console, Rich Results Test, PageSpeed, field data) must be run by you or the owner with real access.

---

## 11. Appendix

### Page inventory (as of `d305755`)
| Route | Title (before template) | Own description | Canonical | JSON-LD |
|---|---|---|---|---|
| `/` | `NUA CREW — Better Jobs. Stronger Teams.` | no (site default) | yes | no |
| `/job-seekers` | For job seekers | yes (≈166) | yes | no |
| `/employers` | For employers | yes (≈154) | yes | no |
| `/how-it-works` | How it works | yes (≈145) | yes | no |
| `/features` | Explore the features | yes (≈88, short) | yes | no |
| `/pricing` | Pricing | yes (≈127) | yes | no |
| `/trust` | Trust & privacy | yes (≈121) | yes | no |
| `/apps` | App and web status | yes (≈79, short) | yes | no |
| `/help` | Help and quick answers | yes (≈122) | yes | no |
| `/contact` | Contact | yes (≈79, short) | yes | no |
| `/privacy` | Privacy policy | yes (≈100, short) | yes | no |
| `/terms` | Terms of use | no (default) | yes | no |
| `/employer-terms` | Employer terms | no (default) | yes | no |
| `/community-guidelines` | Community guidelines | no (default) | yes | no |
| `/cookies` | Cookies and website data | no (default) | yes | no |
| `/legal` | Legal and business details | no (default) | yes | no |

(Description lengths were measured from source and are approximate.)

### Environment variables (set in Vercel, Production and Preview as noted)
| Variable | Now | Meaning |
|---|---|---|
| `NUA_SITE_URL` | unset → `https://iksaa.com.au` | Canonical origin |
| `NUA_APP_URL` / `NUA_HIRE_URL` | unset → `app.` / `hire.` subdomains | Product hosts (nothing deployed) |
| `NUA_PRODUCT_LIVE` | unset | `true` links "Log in / Register" to the product hosts |
| `NUA_CONTACT_EMAIL` | unset → `info@nuapos.com.au` | Published contact address |
| `NUA_SITE_INDEXABLE` | unset → `noindex` | `true` allows search engines (Production only, after section 7) |

### Related documents
`CLAUDE.md` · `docs/MASTER_BRIEF.md` · `docs/BRAND_IDENTITY.md` · `docs/product/WEBSITE.md` · `docs/operations/VERCEL_DEPLOY.md` · `docs/DECISIONS_AND_BLOCKERS.md` · `docs/legal-launch-gates/AUSTRALIA.md` · `docs/IMPLEMENTATION_TRACKER.md` · `tests/e2e/specs/site.spec.ts`

### What was verified in this session and what was not
**Verified:** repo state and PR history; production deployment READY on `d305755` with `iksaa.com.au` aliased; all 16 pages return 200 with the new visuals; live `robots.txt` is `Disallow: /`; live pages carry `noindex, nofollow`; live sitemap lists 16 URLs; project env vars are empty; project domains are `iksaa.com.au` and `nua-crew-site.vercel.app`; per-page canonical present; no JSON-LD in source; icon set is `icon.svg` only; CI green on all four jobs for PRs #19 and #20; local axe (light and dark), overflow, broken/distorted-image and forbidden-text checks pass on all 16 pages at five widths.
**Not verified:** Lighthouse and Core Web Vitals; whether `nua-crew-site.vercel.app` is publicly reachable; behaviour of search engines; Terms and Privacy text status; the robots handling of `apps/web` and `apps/employer`; the Vercel plan; real-device behaviour; any real browser run against production (the build environment blocked it).

---

## Implementation status update — 1 November 2026 (ChatGPT)

This section supersedes the original "Current SEO audit" status *only for the items explicitly listed below*. The original handoff remains the baseline and backlog. Source work is on `feat/site-seo-foundation-20261101`; **do not mark these deployed or merged until the corresponding CI/PR and Vercel statuses are confirmed.**

| Package | Status in branch | Notes |
| --- | --- | --- |
| WP1 — Metadata | IMPLEMENTED, QA REQUIRED | One `lib/seo.ts` registry covers the 16 existing pages, with unique 120–165 character descriptions, titles, self canonicals, route-aware OG URL/title/description and Twitter cards. The existing 1200×900 illustration is a temporary share image; correct 1200×630 artwork remains outstanding. |
| WP2 — JSON-LD | PARTIAL | Root layout now emits factual `Organization` (NUA POS operator; ABN, contact and address) and `WebSite` data. Breadcrumb and visible-FAQ-coupled JSON-LD still need their own tested implementation. No `JobPosting`, `Review`, `Offer`, store or hiring outcome claims. |
| WP3 — Sitemap/crawl | PARTIAL | Sitemap now contains an actual content-revision date, with no `changeFrequency`. Pre-launch `noindex` and robots disallow remain; `X-Robots-Tag` is emitted while indexing is off. Both-mode crawler assertions have been updated in e2e source. A full dual-mode CI run remains required. |
| WP4 — Icons/manifest/share | PARTIAL | Lightweight manifest references the provisional SVG concept icon. Official identity artwork, favicon/Apple PNG sizes and 1200×630 section share images are still outstanding. |
| WP6 — Performance | PARTIAL | AVIF and WebP are offered by Next's image optimizer. No Lighthouse score or Core Web Vitals result is claimed. Baseline and budgets remain outstanding. |
| WP7 — Search verification | IMPLEMENTED, UNCONFIGURED | Google and Bing verification metadata read optional environment variables; no verification value or third-party tracker was committed. No analytics installed. |
| WP8–WP12 | NOT STARTED / OWNER GATED | No registration form, waitlist, paid tools, published jobs, analytics, store links, legal claims or search indexing were activated. |

**Next owner/counsel decisions:** brand clearance, review of legal policies, official icon, whether to index at launch, commercial Vercel plan, `www` DNS redirect, any analytics, and image rights. Do **not** set `NUA_SITE_INDEXABLE=true` or `NUA_PRODUCT_LIVE=true` as part of this branch.

**Review/verification checklist:** GitHub CI green; Vercel preview READY; page-level metadata visible at 16 URLs; `robots.txt` and `sitemap.xml` still pre-launch; JSON-LD parses with only allowed types; no external origin requests or forbidden claims; the share image resolves. Document exactly which additional launch gates remain.
