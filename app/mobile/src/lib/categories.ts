// Category display helpers and the storefront's built-in merchant list. No Expo imports, so vitest can load it.
import {
  getMerchantSeeds,
  storefrontFromLocale,
  suggestCategory,
  type CategoryColor,
  type CategoryKind,
  type MerchantSeeds,
  type Storefront,
  type Transaction,
} from '@current/core';

import type { CategoryRecord } from '../db/records';

// literal classes per colour so Tailwind can see them
export const CATEGORY_FILLS: Record<CategoryColor, string> = {
  peach: 'bg-cat-peach',
  mint: 'bg-cat-mint',
  sky: 'bg-cat-sky',
  pink: 'bg-cat-pink',
  lilac: 'bg-cat-lilac',
  butter: 'bg-cat-butter',
  aqua: 'bg-cat-aqua',
  sand: 'bg-cat-sand',
  sage: 'bg-cat-sage',
  coral: 'bg-cat-coral',
  lavender: 'bg-cat-lavender',
  stone: 'bg-cat-stone',
};

// sticker fill class for a stored colour name; unknown names fall back to stone
export function fillFor(color: string): string {
  return CATEGORY_FILLS[color as CategoryColor] ?? CATEGORY_FILLS.stone;
}

// sticker for an entry with no category
export const UNCATEGORIZED = { emoji: '🏷️', fill: 'bg-field' } as const;

export const KIND_LABELS: Record<CategoryKind, string> = {
  needs: 'Need',
  wants: 'Want',
  savings: 'Savings',
  income: 'Money in',
};

// the four groups on the Categories screen, in order, with what each one means in plain words
export const KIND_GROUPS: readonly { kind: CategoryKind; title: string; blurb: string }[] = [
  { kind: 'needs', title: 'Needs', blurb: 'Stuff you have to pay for, like rent, groceries and getting around.' },
  { kind: 'wants', title: 'Wants', blurb: 'The fun stuff. Coffee, takeout, shopping, nights out.' },
  { kind: 'savings', title: 'Savings', blurb: 'Money you move into savings. It never counts as spending.' },
  { kind: 'income', title: 'Money in', blurb: 'Only shows up when you log money coming in, like a paycheque.' },
];

// emoji offered when making or editing a category
export const CATEGORY_EMOJI = [
  '🛒', '🍔', '☕', '🚌', '🏠', '📚', '💊', '🎉', '🛍️', '📺', '🐷', '💸',
  '🍕', '🍜', '🍺', '🚗', '⛽', '🚲', '✈️', '📱', '💡', '🎮', '🎬', '🎵',
  '🏋️', '💇', '🐶', '🎁', '👕', '💻', '🧺', '🏦', '🧾', '🌱', '⚽', '❤️',
] as const;

const VARIATION_SELECTOR = 0xfe0f;
const ZERO_WIDTH_JOINER = 0x200d;
const KEYCAP = 0x20e3;
const isSkinTone = (cp: number) => cp >= 0x1f3fb && cp <= 0x1f3ff;
const isFlagLetter = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;
const isTag = (cp: number) => cp >= 0xe0020 && cp <= 0xe007f;
// symbols and pictographs; plain letters, digits and punctuation never start a sticker
const startsEmoji = (cp: number) => cp >= 0x203c && !isSkinTone(cp) && !isTag(cp) && cp !== VARIATION_SELECTOR && cp !== KEYCAP;

// The last emoji in some typed text, kept whole: skin tones, joined sequences like 👩‍🍳, flags and keycaps
// stay one sticker. Walks code points by hand so it doesn't depend on the JS engine's Unicode tables.
export function lastEmoji(text: string): string | null {
  const cps = Array.from(text, (ch) => ch.codePointAt(0)!);
  let found: string | null = null;
  let i = 0;

  // read one cluster at a time, remembering the latest
  while (i < cps.length) {
    const start = i;
    const cp = cps[i]!;
    const keycapBase = (cp >= 0x30 && cp <= 0x39) || cp === 0x23 || cp === 0x2a;
    if (keycapBase && (cps[i + 1] === KEYCAP || (cps[i + 1] === VARIATION_SELECTOR && cps[i + 2] === KEYCAP))) {
      i += cps[i + 1] === KEYCAP ? 2 : 3;
    } else if (isFlagLetter(cp)) {
      i += isFlagLetter(cps[i + 1] ?? 0) ? 2 : 1;
    } else if (startsEmoji(cp)) {
      i++;
      // modifiers attach to the emoji before them; a joiner pulls in the emoji after it
      while (i < cps.length) {
        const next = cps[i]!;
        if (next === VARIATION_SELECTOR || isSkinTone(next) || isTag(next) || next === KEYCAP) i++;
        else if (next === ZERO_WIDTH_JOINER && i + 1 < cps.length) i += 2;
        else break;
      }
    } else {
      i++;
      continue;
    }
    found = String.fromCodePoint(...cps.slice(start, i));
  }
  return found;
}

// the App Store region is not readable from JS, so the device's locale region stands in for it
export function getStorefront(): Storefront {
  try {
    return storefrontFromLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'OTHER';
  }
}

let seeds: MerchantSeeds | null = null;

// built-in merchant list for this phone's region, built once
export function getSeeds(): MerchantSeeds {
  seeds ??= getMerchantSeeds(getStorefront());
  return seeds;
}

// categories that make sense for money going out, or coming in
export function categoriesFor(categories: readonly CategoryRecord[], direction: 'out' | 'in'): CategoryRecord[] {
  return categories.filter((c) => (direction === 'in' ? c.kind === 'income' : c.kind !== 'income'));
}

// category to pre-fill for some typed text: the user's history first, then the built-in list
export function suggestCategoryId(
  history: readonly Transaction[],
  options: readonly CategoryRecord[],
  text: string,
  now = new Date(),
): string | null {
  const suggestion = suggestCategory(history, text, now, { seeds: getSeeds(), categoryIds: options.map((c) => c.id) });
  return suggestion?.categoryId ?? null;
}
