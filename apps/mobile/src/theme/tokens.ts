/**
 * NUA CREW colour tokens for native. Mirrors packages/ui/src/tokens.css; a test fails if they drift.
 * Teal and gold are accents only (never small text on light surfaces): see the contrast test.
 */
export const brand = {
  burgundy: '#6b1738',
  deepWine: '#3c0b21',
  obsidian: '#0b0b0c',
  ivory: '#f7f3ef',
  gold: '#c9a96e',
  teal: '#0fa3b1',
} as const;

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primaryHover: string;
  onPrimary: string;
  focus: string;
  liveTint: string;
  onLiveTint: string;
  warnTint: string;
  onWarnTint: string;
  danger: string;
  successTint: string;
  onSuccessTint: string;
  accentLive: string;
  gold: string;
};

export const light: Palette = {
  bg: brand.ivory,
  surface: '#ffffff',
  surface2: '#efe9e2',
  text: brand.obsidian,
  muted: '#55504b',
  border: '#d9d0c6',
  primary: brand.burgundy,
  primaryHover: '#55122d',
  onPrimary: '#ffffff',
  focus: '#0b0b0c',
  liveTint: '#d7f1f3',
  onLiveTint: '#07424a',
  warnTint: '#fdeccf',
  onWarnTint: '#5a3a00',
  danger: '#a4161a',
  successTint: '#dcefdc',
  onSuccessTint: '#14400f',
  accentLive: brand.teal,
  gold: brand.gold,
};

export const dark: Palette = {
  bg: '#14080e',
  surface: '#1f0f17',
  surface2: '#2a1620',
  text: '#f7f3ef',
  muted: '#cbbfb6',
  border: '#4a2c39',
  primary: '#e8c3d2',
  primaryHover: '#f3dbe5',
  onPrimary: '#3c0b21',
  focus: '#f7f3ef',
  liveTint: '#0c3f46',
  onLiveTint: '#c9f0f3',
  warnTint: '#4a3410',
  onWarnTint: '#fdeccf',
  danger: '#ff9a9d',
  successTint: '#183a15',
  onSuccessTint: '#d7f0d4',
  accentLive: brand.teal,
  gold: brand.gold,
};

export const radius = { button: 12, card: 20, chip: 999 } as const;
export const space = (n: number) => n * 8;
export const MIN_TOUCH = 44;
