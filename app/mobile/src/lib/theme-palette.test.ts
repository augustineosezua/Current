import { describe, expect, it } from 'vitest';

import { THEME_IDS, THEMES } from './theme-palette';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('2.11 themes keep text readable', () => {
  for (const id of THEME_IDS) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${id} ${mode}: ink and muted meet AA on page and cards, ink on fields, button text on buttons`, () => {
        const paper = THEMES[id][mode];
        for (const surface of [paper.bg, paper.card]) {
          expect(contrast(paper.ink, surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(paper.muted, surface)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(paper.ink, paper.field)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(paper.onCta, paper.cta)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
