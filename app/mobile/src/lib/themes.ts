// ROADMAP 2.11: Plus colour themes and alternate app icons. Cosmetic only. A theme swaps the page, cards, fields,
// sticker edge, text, muted text and primary button in both light and dark; mood and category colours stay. Every
// text pair keeps its WCAG AA contrast (checked in theme-palette.test.ts).
import { Uniwind } from 'uniwind';

import { THEMES, type Paper, type ThemeId } from './theme-palette';

export { ICONS, THEME_IDS, THEMES, type IconName, type ThemeId } from './theme-palette';

function vars(paper: Paper): Record<string, string> {
  return {
    '--color-bg': paper.bg,
    '--color-card': paper.card,
    '--color-field': paper.field,
    '--color-edge': paper.edge,
    '--color-ink': paper.ink,
    '--color-muted': paper.muted,
    '--color-cta': paper.cta,
    '--color-on-cta': paper.onCta,
  };
}

// apply a theme to both appearances; an unknown name, or losing Plus, falls back to the default
export function applyTheme(id: string, isPlus: boolean): void {
  const theme = THEMES[(isPlus && id in THEMES ? id : 'default') as ThemeId];
  Uniwind.updateCSSVariables('light', vars(theme.light));
  Uniwind.updateCSSVariables('dark', vars(theme.dark));
}
