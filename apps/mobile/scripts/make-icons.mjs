/* global document -- used inside page.waitForFunction, which runs in the browser */
// Builds the app's icon and splash assets from the APPROVED brand kit in brand/kit (never redrawn).
// Usage: node scripts/make-icons.mjs   (needs Playwright's Chromium; see tests/e2e)
//
//  icon.png               iOS/App Store: the kit's ivory app icon, flattened to opaque RGB.
//  adaptive-icon.png      Android adaptive foreground: symbol alone on transparent, inside the 66% safe zone.
//                         Its background colour is set in app.config.ts (warm ivory, same as the iOS icon).
//  notification-icon.png  Android notification icon: alpha mask, white silhouette of the symbol.
//  splash-icon.png        Splash: the approved full logo (tagline built in) on transparent; ivory is set in config.
//  favicon.png            Web favicon from the kit's 64px icon.
//  brand/symbol.png, brand/logo.png   In-app artwork (see src/ui/brand.tsx).
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = resolve(here, '../../../brand/kit');
const assets = resolve(here, '../assets');
const require = createRequire(resolve(here, '../../../tests/e2e/package.json'));
const { chromium } = require('@playwright/test');

// Data URIs: Chromium will not load file:// images into a page made with setContent().
const url = (rel) => `data:image/png;base64,${readFileSync(resolve(kit, rel)).toString('base64')}`;
mkdirSync(resolve(assets, 'brand'), { recursive: true });

// Straight copies of approved artwork.
copyFileSync(
  resolve(kit, 'logos/NUA_CREW_symbol_transparent.png'),
  resolve(assets, 'brand/symbol.png'),
);
copyFileSync(
  resolve(kit, 'logos/NUA_CREW_primary_transparent.png'),
  resolve(assets, 'brand/logo.png'),
);
copyFileSync(resolve(kit, 'icons/NUA_CREW_icon_64.png'), resolve(assets, 'favicon.png'));

const page_ = (size, inner, bg = 'transparent') =>
  `<body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">${inner}</div></body>`;

const targets = [
  // Opaque square: the OS applies the rounded mask, and the App Store rejects icons with alpha.
  [
    'icon.png',
    1024,
    `<img src="${url('icons/NUA_CREW_app_icon_ivory_1024.png')}" width="1024" height="1024">`,
    '#F6F0E5',
    false,
  ],
  // Symbol is 392x343; 500px wide keeps its diagonal inside the 676px (66%) safe circle.
  [
    'adaptive-icon.png',
    1024,
    `<img src="${url('logos/NUA_CREW_symbol_transparent.png')}" width="500">`,
    'transparent',
    true,
  ],
  // Alpha mask: invert(1) after brightness(0) turns every visible pixel white and keeps alpha.
  [
    'notification-icon.png',
    256,
    `<img src="${url('logos/NUA_CREW_symbol_transparent.png')}" width="200" style="filter:brightness(0) invert(1)">`,
    'transparent',
    true,
  ],
  [
    'splash-icon.png',
    1024,
    `<img src="${url('logos/NUA_CREW_primary_transparent.png')}" width="960">`,
    'transparent',
    true,
  ],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, inner, bg, transparent] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(page_(size, inner, bg));
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth > 0),
  );
  await page.screenshot({ path: resolve(assets, name), omitBackground: transparent });
  console.log('wrote', name);
}
await browser.close();
