// 2.1 Quick add: "coffee 4.50" or "uber home last night 18" -> a transaction draft.
// Code goes first (amount, simple dates, category from history); the model is asked only when that falls short.
import { suggestCategory, type SuggestOptions } from "./categorize";
import { addDays, startOfDay } from "./dates";
import { toCents, type Cents } from "./money";
import type { Category, Transaction } from "./types";

// history at or above this confidence answers on its own, with no model call
export const QUICK_ADD_MIN_CONFIDENCE = 0.7;

export interface QuickAddDraft {
  amount: Cents | null;
  date: Date;
  merchantName: string | null;
  categoryId: string | null;
  // share of matching history behind the category; 0 when there is none
  confidence: number;
}

export interface QuickAddResult extends QuickAddDraft {
  // true when code couldn't settle it and the AI layer should parse the text
  needsModel: boolean;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHORT_WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };

// phrases that name a day, and how far back each one points
const DATE_RULES: { pattern: RegExp; daysAgo: (m: RegExpMatchArray, today: Date) => number }[] = [
  { pattern: /\b(\d{1,2}) days? ago\b/, daysAgo: (m) => Number(m[1]) },
  { pattern: /\b(today|tonight|this morning|this afternoon)\b/, daysAgo: () => 0 },
  { pattern: /\b(yesterday|last night)\b/, daysAgo: () => 1 },
  {
    pattern: /\b(last |on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
    daysAgo: (m, today) => weekdayDaysAgo(WEEKDAYS.indexOf(m[2]!), today, m[1] === "last "),
  },
  {
    pattern: /\b(last |on )(sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/,
    daysAgo: (m, today) => weekdayDaysAgo(SHORT_WEEKDAYS[m[2]!]!, today, m[1] === "last "),
  },
];

// clock times and numeric dates, which hold digits that are never the amount
const NOT_AMOUNTS = [/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/g, /\b\d{1,2}:\d{2}\b/g, /\b\d{1,4}[/-]\d{1,2}([/-]\d{2,4})?\b/g];
const AMOUNT = /([$£€]\s?)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\d)(\s?(?:bucks|dollars?|quid))?/g;
const EDGE_WORDS = /^(at|on|for|from|to|in|and)\s+|\s+(at|on|for|from|to|in|and)$/;

// days back to the named weekday: the most recent one on or before today, or the week before with "last"
function weekdayDaysAgo(weekday: number, today: Date, last: boolean): number {
  const back = (today.getDay() - weekday + 7) % 7;
  return last && back === 0 ? 7 : back;
}

// blank out a match so later passes don't see it, keeping positions intact
function blank(text: string, match: RegExpMatchArray): string {
  return text.slice(0, match.index) + " ".repeat(match[0].length) + text.slice(match.index! + match[0].length);
}

// amount, day and leftover words from the text alone
export function parseQuickAdd(text: string, now: Date): { amount: Cents | null; date: Date; merchantName: string | null } {
  const today = startOfDay(now);
  let rest = ` ${text.toLowerCase()} `;
  let daysAgo = 0;
  let foundDate = false;

  // the first phrase that names a day wins; every one is removed from the merchant
  for (const rule of DATE_RULES) {
    const m = rest.match(rule.pattern);
    if (!m) continue;
    if (!foundDate) daysAgo = rule.daysAgo(m, today);
    foundDate = true;
    rest = blank(rest, m);
  }
  for (const p of NOT_AMOUNTS) rest = rest.replace(p, (s) => " ".repeat(s.length));

  // a number with a currency sign or word beats a bare one; otherwise the last number
  const candidates = [...rest.matchAll(AMOUNT)];
  const marked = candidates.find((m) => m[1] || m[3]);
  const chosen = marked ?? candidates[candidates.length - 1];
  let amount: Cents | null = null;
  if (chosen) {
    const cents = toCents(chosen[2]!);
    if (cents !== null && cents > 0) amount = cents;
    rest = blank(rest, chosen);
  }

  return { amount, date: addDays(today, -daysAgo), merchantName: tidyMerchant(rest, text) };
}

// leftover words as the user typed them, minus filler at the edges, first letter capitalized
function tidyMerchant(rest: string, original: string): string | null {
  // map the cleaned lowercase text back onto the original casing, position by position
  const padded = ` ${original} `;
  let kept = "";
  for (let i = 0; i < rest.length; i++) kept += rest[i] === " " ? " " : (padded[i] ?? rest[i]);
  let s = kept.replace(/[^\p{L}\p{N}&'\s-]/gu, " ").replace(/\s+/g, " ").trim();
  // strip filler words like "at" or "for" left hanging at either end
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(new RegExp(EDGE_WORDS.source, "i"), "").trim();
  }
  if (!s) return null;
  return s[0]!.toUpperCase() + s.slice(1);
}

// parse with code, pick the category from history (then the built-in list), and say whether the model is needed
export function quickAdd(
  text: string,
  now: Date,
  history: readonly Transaction[],
  options: SuggestOptions = {},
): QuickAddResult {
  const parsed = parseQuickAdd(text, now);
  const suggestion = parsed.merchantName ? suggestCategory(history, parsed.merchantName, now, options) : null;
  const confidence = suggestion?.confidence ?? 0;
  return {
    ...parsed,
    categoryId: suggestion?.categoryId ?? null,
    confidence,
    needsModel: parsed.amount === null || confidence < QUICK_ADD_MIN_CONFIDENCE,
  };
}

// what the model returns for a quick-add parse; empty strings mean "not found"
export interface ModelQuickAddParse {
  amount: string;
  merchant: string;
  category: string;
}

// fold the model's parse into code's: code keeps the amount and date it found, the model fills gaps and names the merchant
export function applyModelParse(local: QuickAddDraft, model: ModelQuickAddParse, categories: readonly Category[]): QuickAddResult {
  const modelCents = model.amount ? toCents(model.amount) : null;
  const wanted = model.category.trim().toLowerCase();
  const category = categories.find((c) => c.name.toLowerCase() === wanted || c.id === model.category);
  const merchant = model.merchant.trim();
  return {
    amount: local.amount ?? (modelCents !== null && modelCents > 0 ? modelCents : null),
    date: local.date,
    merchantName: merchant ? merchant[0]!.toUpperCase() + merchant.slice(1) : local.merchantName,
    categoryId: category?.id ?? local.categoryId,
    confidence: category ? QUICK_ADD_MIN_CONFIDENCE : local.confidence,
    needsModel: false,
  };
}
