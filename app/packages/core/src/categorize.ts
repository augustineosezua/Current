import { addMonthsClamped, daysBetween, startOfDay } from "./dates";
import type { Transaction } from "./types";

const HISTORY_MONTHS = 6;
const MIN_MATCHES = 3;

const DATE_PATTERNS = [
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
  /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g,
  /\b(today|yesterday|tonight|last night|this morning|tomorrow)\b/g,
  /\b(last |on )?(mon|tues|wednes|thurs|fri|satur|sun)day\b/g,
];
const AMOUNT_PATTERN = /[$£€]?\s?\d+(?:[.,]\d+)*\s?(\$|dollars?|bucks)?/g;

// lowercase and strip dates, amounts and punctuation so "Tim Hortons $4.50!" becomes "tim hortons"
export function normalizeMerchantText(text: string): string {
  let s = text.toLowerCase();
  for (const p of DATE_PATTERNS) s = s.replace(p, " ");
  s = s.replace(AMOUNT_PATTERN, " ");
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

// whole-word containment either way, or equality
function merchantMatches(merchant: string, text: string): boolean {
  if (!merchant || !text) return false;
  if (merchant === text) return true;
  const padded = (s: string) => ` ${s} `;
  return padded(text).includes(padded(merchant)) || padded(merchant).includes(padded(text));
}

export interface CategorySuggestion {
  categoryId: string;
  // share of matching transactions that used this category
  confidence: number;
  matches: number;
}

// most-used category among the last 6 months of matching merchants; null under 3 matches
export function suggestCategory(history: readonly Transaction[], text: string, now: Date): CategorySuggestion | null {
  const needle = normalizeMerchantText(text);
  if (!needle) return null;
  const today = startOfDay(now);
  const since = addMonthsClamped(today, -HISTORY_MONTHS);
  const counts = new Map<string, number>();
  let matches = 0;

  // tally categories of recent transactions whose merchant matches
  for (const t of history) {
    if (!t.categoryId || !t.merchantName) continue;
    if (daysBetween(since, t.date) < 0 || daysBetween(t.date, today) < 0) continue;
    if (!merchantMatches(normalizeMerchantText(t.merchantName), needle)) continue;
    matches++;
    counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  }
  if (matches < MIN_MATCHES) return null;

  let best: [string, number] | null = null;
  // pick the most-used category
  for (const entry of counts) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  if (!best) return null;
  return { categoryId: best[0], confidence: best[1] / matches, matches };
}
