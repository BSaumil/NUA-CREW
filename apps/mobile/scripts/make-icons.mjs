// Renders store/launcher icons from the brand glyph geometry (brand/svg/glyph.svg).
// Usage: node scripts/make-icons.mjs   (needs Playwright's Chromium; see tests/e2e)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, '../../../tests/e2e/package.json'));
const { chromium } = require('@playwright/test');

const GLYPH = (ivory, gold, teal) => `
  <path d="M288 776V248L736 776V248" fill="none" stroke="${ivory}" stroke-width="112" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M288 776V224L736 776" fill="none" stroke="${gold}" stroke-width="28" stroke-linecap="round"/>
  <circle cx="288" cy="776" r="28" fill="${teal}"/><circle cx="736" cy="248" r="56" fill="${teal}"/>`;

// The glyph occupies x/y 176..848 of a 1024 box; scale it about the centre to fit a safe zone.
const svg = ({ size, bg, scale, colors }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${GLYPH(...colors)}</g>
</svg>`;

const BRAND = ['#F7F3EF', '#C9A96E', '#0FA3B1'];
const WHITE = ['#FFFFFF', '#FFFFFF', '#FFFFFF'];
const targets = [
  // iOS icons must be opaque squares; the OS applies the rounded mask.
  ['icon.png', { size: 1024, bg: '#3C0B21', scale: 1.0, colors: BRAND }],
  // Android adaptive foreground: keep the glyph inside the central 66% safe zone.
  ['adaptive-icon.png', { size: 1024, bg: null, scale: 0.82, colors: BRAND }],
  ['splash-icon.png', { size: 1024, bg: null, scale: 0.6, colors: BRAND }],
  // Android notification icons are alpha masks: white on transparent.
  ['notification-icon.png', { size: 256, bg: null, scale: 0.9, colors: WHITE }],
  ['favicon.png', { size: 64, bg: '#3C0B21', scale: 1.0, colors: BRAND }],
];

mkdirSync(resolve(here, '../assets'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, opts] of targets) {
  await page.setViewportSize({ width: opts.size, height: opts.size });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(opts)}</body>`);
  await page.screenshot({ path: resolve(here, '../assets', name), omitBackground: true });
  console.log('wrote', name);
}
await browser.close();
