// integer number of cents; never a float
export type Cents = number;

// true for safe integers only
export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

// guard against floats sneaking into calculations
export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be integer cents, got ${value}`);
  }
  return value;
}

// sum a list of cent amounts
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

// parse user-entered text like "$1,234.56", "4.50" or "12,50" into cents
export function toCents(input: string | number): Cents | null {
  // numbers are dollars; round once at the boundary
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }

  const negative = /^\s*-|\(.*\)/.test(input);
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let decimalIndex = -1;

  // pick the decimal separator: the later of the two when both appear
  if (lastDot !== -1 && lastComma !== -1) {
    decimalIndex = Math.max(lastDot, lastComma);
  } else if (lastDot !== -1 || lastComma !== -1) {
    const idx = lastDot !== -1 ? lastDot : lastComma;
    const sep = cleaned[idx];
    const digitsAfter = cleaned.length - idx - 1;
    const occurrences = cleaned.split(sep ?? "").length - 1;
    // a lone separator with 1-2 digits after it is a decimal point
    if (occurrences === 1 && digitsAfter > 0 && digitsAfter <= 2) decimalIndex = idx;
  }

  const wholePart = (decimalIndex === -1 ? cleaned : cleaned.slice(0, decimalIndex)).replace(/[.,]/g, "");
  const fracPart = decimalIndex === -1 ? "" : cleaned.slice(decimalIndex + 1).replace(/[.,]/g, "");
  const whole = wholePart === "" ? 0 : Number.parseInt(wholePart, 10);
  const frac = Number.parseInt((fracPart + "00").slice(0, 2), 10);
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

// format cents for display in the user's locale and currency
export function formatMoney(cents: Cents, locale = "en-CA", currency = "CAD"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

// whole units for headline numbers, rounded down so it never overstates what's safe
export function formatMoneyWhole(cents: Cents, locale = "en-CA", currency = "CAD"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Math.floor(cents / 100),
  );
}
