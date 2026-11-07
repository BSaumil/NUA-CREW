# NUA CREW — Owner-approved brand rollout handoff
**8 November 2026** · **Status: draft, not safe to merge until exact artwork is committed and CI passes.**

## Source of truth
The owner supplied `NUA_Crew_Complete_Brand_Kit(1).zip` containing the approved connected-people N symbol, burgundy NUA + black CREW, exact tagline **Where Talent Meets Opportunity**, transparent horizontal logo, icon variants, Open Graph image, and brand guidelines. This ZIP is user-supplied, **not available to GitHub Actions automatically**. Do not replace it with an approximation, the previous turquoise/gold generic N mark, a newly generated image or a stock banner.

## Mandatory asset installation by Claude Code or a local developer
1. Obtain the exact ZIP from the owner/uploaded project artifact, **without copying personal secrets**.
2. From the NUA-CREW repo root, run:
   ```bash
   python3 scripts/install_brand_kit.py '/path/to/NUA_Crew_Complete_Brand_Kit(1).zip'
   ```
3. Commit the resulting `apps/{site,web,employer}/public/brand/` assets, `apps/{site,web,employer}/app/favicon.ico`, mobile `apps/mobile/assets/` assets and `docs/brand/NUA_CREW_OFFICIAL_BRAND_GUIDE.md` **to this branch**.
4. **Block merge if any referenced image is missing**. Add a CI assertion that exact assets exist and are valid SVG/PNG/ICO. Confirm the approved source ZIP's hashes, file dimensions and transparent background where applicable.
5. The full master logo already contains the tagline; the marketing footer has been changed to avoid repeating it. Verify its 1030×604 viewBox renders legibly at header size; if not, use the approved symbol-only asset plus accessible text in compact nav, and full logo in appropriate hero/footer contexts. Do not crop or stretch.
6. The icon files in the ZIP include several square backgrounds; **Android adaptive icon foreground and notification icon may need transparent monochrome symbol-only exports**. Generate these faithfully from the supplied vector, not new artwork. Check iOS icon safe areas and Expo splash contrast.
7. Update any remaining old lockups in mobile screens, transactional email headers, onboarding, PDFs, PWA manifests, SEO/social previews and store listing artwork. Never introduce a public personal name or unapproved business identity. Preserve feature and payment gates.
8. Run all relevant CI: web lint/typecheck/build, API, dependency audit, E2E, Android/iOS simulator builds; take real responsive screenshots of website, candidate and employer nav/login and native splash/icons on light/dark themes. Check 320px/390px/768px/desktop, alt text, no duplicate tagline and no 404 assets.
9. Merge this brand PR only after asset install + green CI. Vercel marketing deployment can then happen independently. Candidate/employer projects remain protected and should not be publicly activated.

## Work already done on this branch
- Shared `BrandMark` and `BrandLockup` reference exact approved SVG asset paths for each web app.
- Public `TAGLINE` changed to `Where Talent Meets Opportunity`.
- Marketing Open Graph metadata points to the approved static social artwork; candidate and employer metadata aligned.
- The obsolete standalone footer tagline was removed to avoid duplicating the text already in the full logo.
- Installer script added. **Binary assets still need to be committed by Claude or a local developer.**

## Release restrictions
No changes to AWS, Stripe, live hiring, NZ launch, DNS, production DB or user permissions. This is visual branding only.
