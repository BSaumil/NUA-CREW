import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/tokens.css'), 'utf8');

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

const light = block(':root');
const dark = block(":root[data-theme='dark']", light);

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

// Foreground/background pairs actually used for text in components.css.
const PAIRS: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['primary', 'surface-2'],
  ['on-primary', 'primary'],
  ['on-primary', 'primary-hover'],
  ['on-live-tint', 'live-tint'],
  ['on-warn-tint', 'warn-tint'],
  ['on-success-tint', 'success-tint'],
  ['danger', 'surface'],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('WCAG AA text contrast (%s)', (_name, tokens) => {
  it.each(PAIRS)('%s on %s >= 4.5:1', (fg, bg) => {
    expect(tokens[fg], `missing token ${fg}`).toBeDefined();
    expect(tokens[bg], `missing token ${bg}`).toBeDefined();
    expect(ratio(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('brand palette matches tokens.json', () => {
  it('uses the specified brand hex values', () => {
    expect(light['nua-burgundy']).toBe('#6b1738');
    expect(light['nua-deep-wine']).toBe('#3c0b21');
    expect(light['nua-ivory']).toBe('#f7f3ef');
    expect(light['nua-gold']).toBe('#c9a96e');
    expect(light['nua-teal']).toBe('#0fa3b1');
    expect(light['nua-obsidian']).toBe('#0b0b0c');
  });
  it('documents why teal/gold are never used as small text on ivory', () => {
    expect(ratio(light['nua-teal']!, light['nua-ivory']!)).toBeLessThan(4.5);
    expect(ratio(light['nua-gold']!, light['nua-ivory']!)).toBeLessThan(4.5);
  });
});
