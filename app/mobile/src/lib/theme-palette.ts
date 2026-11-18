// ROADMAP 2.11 palette data. Pure, so vitest can check contrast (theme-palette.test.ts).
export type ThemeId = 'default' | 'mint' | 'sky' | 'lilac' | 'peach';

export interface Paper {
  bg: string;
  card: string;
  field: string;
  edge: string;
  // text and the primary button change with the theme too, so each one reads as its own look
  ink: string;
  muted: string;
  cta: string;
  onCta: string;
}

// default must match src/global.css
export const THEMES: Record<ThemeId, { light: Paper; dark: Paper }> = {
  default: {
    light: { bg: '#fbf5ec', card: '#ffffff', field: '#efe6da', edge: '#ffffff', ink: '#2a2420', muted: '#6e625a', cta: '#2a2420', onCta: '#ffffff' },
    dark: { bg: '#1c1916', card: '#2a2521', field: '#352f2a', edge: '#3a332d', ink: '#f6efe6', muted: '#b5a99c', cta: '#f6efe6', onCta: '#1c1916' },
  },
  mint: {
    light: { bg: '#bfe8cf', card: '#e9f8ee', field: '#a6dbbb', edge: '#e9f8ee', ink: '#0f3322', muted: '#2f5a44', cta: '#0f3322', onCta: '#ffffff' },
    dark: { bg: '#0b2016', card: '#133324', field: '#1c4532', edge: '#245540', ink: '#e3f7ea', muted: '#9fcdb2', cta: '#8fe0b0', onCta: '#0b2016' },
  },
  sky: {
    light: { bg: '#bcd9f7', card: '#e8f2fd', field: '#a3c7ee', edge: '#e8f2fd', ink: '#0d2742', muted: '#2d4c6e', cta: '#0d2742', onCta: '#ffffff' },
    dark: { bg: '#0a1a2c', card: '#122a45', field: '#1b3a5c', edge: '#234870', ink: '#e4f0fd', muted: '#9fbfe0', cta: '#8ec3f5', onCta: '#0a1a2c' },
  },
  lilac: {
    light: { bg: '#d6c8f5', card: '#f1ecfd', field: '#c2b0ee', edge: '#f1ecfd', ink: '#25163f', muted: '#4a3a6b', cta: '#3a2466', onCta: '#ffffff' },
    dark: { bg: '#160f2a', card: '#241a42', field: '#31255a', edge: '#3d2f6e', ink: '#efe9fd', muted: '#b8a9e0', cta: '#c3b0f7', onCta: '#160f2a' },
  },
  peach: {
    light: { bg: '#fbcdb3', card: '#fff0e7', field: '#f4b799', edge: '#fff0e7', ink: '#3d1a0a', muted: '#6b3a22', cta: '#3d1a0a', onCta: '#ffffff' },
    dark: { bg: '#24120a', card: '#3a1f12', field: '#4d2a19', edge: '#5e3520', ink: '#fdeee5', muted: '#e0b49c', cta: '#f7a985', onCta: '#24120a' },
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

// alternate icon names, matching app.json's expo-alternate-app-icons entries; null is the main icon
export const ICONS = [null, 'Mint', 'Night', 'Sky', 'Lilac', 'Butter'] as const;
export type IconName = (typeof ICONS)[number];
