// Pure conversions between SQLite rows and @current/core types. No Expo imports, so vitest can run them.
import type {
  Account,
  AccountType,
  Bill,
  BudgetPeriodKind,
  Category,
  CategoryKind,
  Cents,
  Frequency,
  Goal,
  Income,
  ReminderSettings,
  TermPlan,
  Transaction,
} from '@current/core';

export type SQLValue = string | number | null;
export type Row = Record<string, SQLValue>;

export interface SyncMeta {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type AccountRecord = Account & SyncMeta & {
  name: string;
  isMain: boolean;
  lastCheckInAt: Date | null;
  sortOrder: number;
};
export type CategoryRecord = Category & SyncMeta & { emoji: string; color: string; sortOrder: number };
export type TransactionRecord = Transaction & SyncMeta & { note: string | null; billId: string | null; createdFromBill: boolean };
export type BillRecord = Bill & SyncMeta & { categoryId: string | null; accountId: string | null; previousBillId: string | null };
export type IncomeRecord = Income & SyncMeta;
export type GoalRecord = Goal & SyncMeta;
export type TermPlanRecord = TermPlan & SyncMeta;

// settings keys and their value types, stored as JSON
export interface Settings {
  budgetPeriod: BudgetPeriodKind | null;
  minimumMonthlySpend: Cents;
  // true once the first-run setup has been finished
  onboarded: boolean;
  // which local notifications are switched on
  reminders: ReminderSettings;
  // ISO time of the last CSV export or dismissed backup prompt
  backupNudgedAt: string | null;
  // 'YYYY-MM-DD' the user picked for the current budget to end, or null; ignored once it has passed
  budgetEndsOn: string | null;
}
export const DEFAULT_SETTINGS: Settings = {
  budgetPeriod: null,
  minimumMonthlySpend: 0,
  onboarded: false,
  reminders: { bills: true, summary: true, checkIn: true },
  backupNudgedAt: null,
  budgetEndsOn: null,
};
export type SettingKey = keyof Settings;

// settings rows (id = key, value = JSON) -> Settings, defaults for missing or unreadable keys
export function settingsFromRows(rows: readonly Row[]): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    const key = str(r.id);
    if (!(key in DEFAULT_SETTINGS) || r.deletedAt != null) continue;
    try {
      (settings as unknown as Record<string, unknown>)[key] = JSON.parse(str(r.value));
    } catch {
      // keep the default
    }
  }
  return settings;
}

// calendar date -> 'YYYY-MM-DD' in local time
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 'YYYY-MM-DD' -> local midnight, which is what core expects
export function fromDateString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date string: ${s}`);
  return new Date(y, m - 1, d);
}

// nullable versions of the date and instant helpers
function dateOrNull(v: SQLValue): Date | null {
  return typeof v === 'string' ? fromDateString(v) : null;
}
function instantOrNull(v: SQLValue): Date | null {
  return typeof v === 'string' ? new Date(v) : null;
}
function str(v: SQLValue): string {
  return String(v);
}
function strOrNull(v: SQLValue): string | null {
  return v == null ? null : String(v);
}
function num(v: SQLValue): number {
  return Number(v);
}
function bool(v: SQLValue): boolean {
  return v === 1 || v === '1';
}

// sync columns shared by every table
function meta(r: Row): SyncMeta {
  return { createdAt: str(r.createdAt), updatedAt: str(r.updatedAt), deletedAt: strOrNull(r.deletedAt) };
}

// row -> record, one per table
export const fromRow = {
  account: (r: Row): AccountRecord => ({
    id: str(r.id),
    ...meta(r),
    name: str(r.name),
    type: str(r.type) as AccountType,
    balance: num(r.balance),
    isMain: bool(r.isMain),
    lastCheckInAt: instantOrNull(r.lastCheckInAt),
    sortOrder: num(r.sortOrder),
  }),
  category: (r: Row): CategoryRecord => ({
    id: str(r.id),
    ...meta(r),
    name: str(r.name),
    emoji: str(r.emoji),
    color: str(r.color),
    kind: str(r.kind) as CategoryKind,
    sortOrder: num(r.sortOrder),
  }),
  transaction: (r: Row): TransactionRecord => ({
    id: str(r.id),
    ...meta(r),
    accountId: strOrNull(r.accountId) ?? undefined,
    amount: num(r.amount),
    date: fromDateString(str(r.date)),
    merchantName: strOrNull(r.merchantName),
    categoryId: strOrNull(r.categoryId),
    note: strOrNull(r.note),
    billId: strOrNull(r.billId),
    createdFromBill: bool(r.createdFromBill),
  }),
  bill: (r: Row): BillRecord => ({
    id: str(r.id),
    ...meta(r),
    name: str(r.name),
    amount: num(r.amount),
    dueDate: fromDateString(str(r.dueDate)),
    isPaid: bool(r.isPaid),
    isRecurring: bool(r.isRecurring),
    frequency: strOrNull(r.frequency) as Frequency | null,
    anchorDay: r.anchorDay == null ? undefined : num(r.anchorDay),
    categoryId: strOrNull(r.categoryId),
    accountId: strOrNull(r.accountId),
    previousBillId: strOrNull(r.previousBillId),
  }),
  income: (r: Row): IncomeRecord => ({
    id: str(r.id),
    ...meta(r),
    name: strOrNull(r.name) ?? undefined,
    amount: num(r.amount),
    frequency: str(r.frequency) as Frequency,
    nextPaymentDate: dateOrNull(r.nextPaymentDate),
    anchorDay: r.anchorDay == null ? undefined : num(r.anchorDay),
  }),
  goal: (r: Row): GoalRecord => ({
    id: str(r.id),
    ...meta(r),
    name: str(r.name),
    amount: num(r.amount),
    amountSaved: num(r.amountSaved),
    dueDate: fromDateString(str(r.dueDate)),
    priority: num(r.priority),
    isRecurring: bool(r.isRecurring),
    isCompleted: bool(r.isCompleted),
    lastContributionAt: instantOrNull(r.lastContributionAt),
  }),
  termPlan: (r: Row): TermPlanRecord => ({
    id: str(r.id),
    ...meta(r),
    name: str(r.name),
    amount: num(r.amount),
    startDate: fromDateString(str(r.startDate)),
    endDate: fromDateString(str(r.endDate)),
    isActive: bool(r.isActive),
  }),
};

// writable fields per table: everything except id and sync columns
export type Fields<T> = Omit<T, 'id' | keyof SyncMeta>;

// record fields -> column values; booleans become 0/1, calendar dates 'YYYY-MM-DD', instants ISO
export const toRow = {
  account: (a: Partial<Fields<AccountRecord>>): Row =>
    pick(a, {
      name: a.name,
      type: a.type,
      balance: cents(a.balance),
      isMain: flag(a.isMain),
      lastCheckInAt: a.lastCheckInAt === null ? null : a.lastCheckInAt?.toISOString(),
      sortOrder: a.sortOrder,
    }),
  category: (c: Partial<Fields<CategoryRecord>>): Row =>
    pick(c, { name: c.name, emoji: c.emoji, color: c.color, kind: c.kind, sortOrder: c.sortOrder }),
  transaction: (t: Partial<Fields<TransactionRecord>>): Row =>
    pick(t, {
      accountId: t.accountId,
      amount: cents(t.amount),
      date: t.date && toDateString(t.date),
      merchantName: t.merchantName,
      categoryId: t.categoryId,
      note: t.note,
      billId: t.billId,
      createdFromBill: flag(t.createdFromBill),
    }),
  bill: (b: Partial<Fields<BillRecord>>): Row =>
    pick(b, {
      name: b.name,
      amount: cents(b.amount),
      dueDate: b.dueDate && toDateString(b.dueDate),
      isPaid: flag(b.isPaid),
      isRecurring: flag(b.isRecurring),
      frequency: b.frequency,
      anchorDay: b.anchorDay,
      categoryId: b.categoryId,
      accountId: b.accountId,
      previousBillId: b.previousBillId,
    }),
  income: (i: Partial<Fields<IncomeRecord>>): Row =>
    pick(i, {
      name: i.name,
      amount: cents(i.amount),
      frequency: i.frequency,
      nextPaymentDate: i.nextPaymentDate === null ? null : i.nextPaymentDate && toDateString(i.nextPaymentDate),
      anchorDay: i.anchorDay,
    }),
  goal: (g: Partial<Fields<GoalRecord>>): Row =>
    pick(g, {
      name: g.name,
      amount: cents(g.amount),
      amountSaved: cents(g.amountSaved),
      dueDate: g.dueDate && toDateString(g.dueDate),
      priority: g.priority,
      isRecurring: flag(g.isRecurring),
      isCompleted: flag(g.isCompleted),
      lastContributionAt: g.lastContributionAt === null ? null : g.lastContributionAt?.toISOString(),
    }),
  termPlan: (p: Partial<Fields<TermPlanRecord>>): Row =>
    pick(p, {
      name: p.name,
      amount: cents(p.amount),
      startDate: p.startDate && toDateString(p.startDate),
      endDate: p.endDate && toDateString(p.endDate),
      isActive: flag(p.isActive),
    }),
};

// money must already be integer cents; refuse floats rather than round silently
function cents(v: number | undefined): number | undefined {
  if (v !== undefined && !Number.isSafeInteger(v)) throw new Error(`Amount must be integer cents, got ${v}`);
  return v;
}
function flag(v: boolean | undefined): number | undefined {
  return v === undefined ? undefined : v ? 1 : 0;
}

// keep only the columns whose field was present in the input, so partial updates don't null others
function pick(input: object, columns: Record<string, SQLValue | undefined>): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(columns)) {
    if (key in input) row[key] = value === undefined ? null : value;
  }
  return row;
}
