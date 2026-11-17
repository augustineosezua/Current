// all dates are treated as local calendar days; time of day is ignored

const DAY_MS = 86_400_000;

// local midnight of the given day
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// shift by whole calendar days
export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

// calendar days from a to b, DST-safe
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

// day count of a range with both ends included
export function inclusiveDays(start: Date, end: Date): number {
  return daysBetween(start, end) + 1;
}

// number of days in a month (month is 0-based)
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// add months keeping the anchor day, clamped to the month's last day
export function addMonthsClamped(d: Date, months: number, anchorDay = d.getDate()): Date {
  const total = d.getMonth() + months;
  const year = d.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return new Date(year, month, Math.min(anchorDay, daysInMonth(year, month)));
}

// first day of the month
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// last day of the month
export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// calendar-day comparison helpers
export function isSameDay(a: Date, b: Date): boolean {
  return daysBetween(a, b) === 0;
}

// true when day falls within [start, end], both inclusive
export function isWithin(day: Date, start: Date, end: Date): boolean {
  return daysBetween(start, day) >= 0 && daysBetween(day, end) >= 0;
}

// later of two dates
export function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}
