# NUA CREW — Approved brand rollout, 8 November 2026

Source: owner-uploaded NUA_Crew_Complete_Brand_Kit(1).zip. Approved tagline: **Where Talent Meets Opportunity**.

## Canonical assets
- Connected-people N symbol: packages/ui/assets/nua-crew-symbol.svg.
- Complete logo and embedded tagline: packages/ui/assets/nua-crew-logo.svg.
- Both assets are automatic traces of the owner-approved raster, not original designer vectors. Inspect before prepress or large-format printing.
- Colours: NUA burgundy #6B1738, artwork burgundy #890A31, deep wine #3C0B21, obsidian #111113, warm ivory #F6F0E5, white #FFFFFF.

## Current application mapping
| Surface | Implementation |
| --- | --- |
| All three Next.js navigation headers | Shared BrandLockup in packages/ui/src/brand.tsx with approved N and tagline |
| Marketing footer | Complete approved SVG master on ivory |
| All three web favicons / Apple icons | Symbol SVG and generated 180px Apple icon |
| Social sharing | Approved symbol, full company name and tagline in dynamic Open Graph artwork |
| Native app headers and welcome | Same approved N mark in apps/mobile/src/ui/brand.tsx, correct tagline |
| Native launcher, adaptive icon, notification, splash | Generated PNG files in apps/mobile/assets from approved traced vectors |
| Web/native theme | Updated burgundy/ivory/obsidian tokens; dark mode uses approved ivory treatment |

## Branding rules
- Use exactly NUA CREW and Where Talent Meets Opportunity; do not reintroduce Better Jobs. Stronger Teams. as the brand tagline.
- Maintain the master logo aspect ratio 1030:604; never stretch, outline or recolour outside the approved dark/light treatments.
- Do not double-print a tagline beneath a full master logo that already contains it.
- Use the symbol rather than the complete logo at small sizes. Maintain accessible labels and sufficient dark-mode contrast.
- Gold and teal are legacy functional UI accents, not logo colours.
- Keep NUA POS parent legal identity and do not include founder names. Do not enable NZ hiring, Stripe or uploads by changing artwork.

## Regeneration and release
To regenerate binary assets: Python 3.12 + Pillow==11.3.0 + CairoSVG==2.8.2, then run python scripts/brand/sync_brand_assets.py, and commit the result.
The temporary branch-scoped write-enabled generation workflow was removed before merge.
Icon changes require a new signed Android/iOS build and app-store acceptance before installed apps update.
QA: inspect desktop/mobile header and footer; favicon and Apple icon, Open Graph image; candidate/employer UI; Android adaptive crop/splash/notification; iPhone icon; accessible contrast; no small-screen overflow. Automated build tests do not substitute for real-device review.