import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brand, dark, light, type Palette } from '../src/theme/tokens';

const css = readFileSync(resolve(__dirname, '../../../packages/ui/src/tokens.css'), 'utf8');

function block(selector: string, base: Record<string, string> = {}): Record<string, string> {
  const start = css.indexOf(selector + ' {');
  const end = css.indexOf('}', start);
  const out: Record<string, string> = { ...base };
  for (const m of css
    .slice(start, end)
    .matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|var\(--[a-z0-9-]+\))/g)) {
    const v = m[2]!;
    out[m[1]!] = v.startsWith('var(') ? out[v.slice(6, -1)]! : v;
  }
  return out;
}
const webLight = block(':root');
const webDark = block(":root[data-theme='dark']", webLight);

const KEYS: Record<keyof Palette, string> = {
  bg: 'bg',
  surface: 'surface',
  surface2: 'surface-2',
  text: 'text',
  muted: 'muted',
  border: 'border',
  primary: 'primary',
  primaryHover: 'primary-hover',
  onPrimary: 'on-primary',
  focus: 'focus',
  liveTint: 'live-tint',
  onLiveTint: 'on-live-tint',
  warnTint: 'warn-tint',
  onWarnTint: 'on-warn-tint',
  danger: 'danger',
  successTint: 'success-tint',
  onSuccessTint: 'on-success-tint',
  accentLive: 'accent-live',
  gold: 'nua-gold',
};

describe('native tokens stay in sync with the web design system', () => {
  it.each([
    ['light', light, webLight],
    ['dark', dark, webDark],
  ] as const)('%s palette equals tokens.css', (_n, native, web) => {
    for (const [k, cssKey] of Object.entries(KEYS)) {
      expect((native as Record<string, string>)[k]!.toLowerCase()).toBe(web[cssKey]!.toLowerCase());
    }
  });
  it('uses the specified brand colours', () => {
    expect(brand).toEqual({
      burgundy: '#6b1738',
      deepWine: '#3c0b21',
      obsidian: '#0b0b0c',
      ivory: '#f7f3ef',
      gold: '#c9a96e',
      teal: '#0fa3b1',
    });
  });
});

function lum(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe('WCAG AA text contrast used by native components', () => {
  const pairs: [keyof Palette, keyof Palette][] = [
    ['text', 'bg'],
    ['text', 'surface'],
    ['muted', 'bg'],
    ['muted', 'surface'],
    ['muted', 'surface2'],
    ['primary', 'bg'],
    ['primary', 'surface'],
    ['onPrimary', 'primary'],
    ['onLiveTint', 'liveTint'],
    ['onWarnTint', 'warnTint'],
    ['onSuccessTint', 'successTint'],
    ['danger', 'surface'],
    ['danger', 'bg'],
  ];
  it.each([
    ['light', light],
    ['dark', dark],
  ] as const)('%s', (_n, p) => {
    for (const [fg, bg] of pairs) expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it('teal and gold are accents only, never small text on ivory', () => {
    expect(ratio(brand.teal, brand.ivory)).toBeLessThan(4.5);
    expect(ratio(brand.gold, brand.ivory)).toBeLessThan(4.5);
  });
});
