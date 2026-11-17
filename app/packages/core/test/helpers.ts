import type { Account, Bill, Goal, Income, StsInput, TermPlan, Transaction } from "../src";

// local calendar date with a 1-based month
export const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

// yyyy-mm-dd for readable assertions
export const ymd = (date: Date | null | undefined) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : null;

export const chequing = (balance: number, id = "chq"): Account => ({ id, type: "chequing", balance });
export const savings = (balance: number, id = "sav"): Account => ({ id, type: "savings", balance });

export const bill = (over: Partial<Bill> = {}): Bill => ({
  id: "b1",
  name: "Rent",
  amount: 100_000,
  dueDate: d(2027, 1, 20),
  isPaid: false,
  isRecurring: false,
  frequency: null,
  ...over,
});

export const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1",
  name: "Laptop",
  amount: 30_000,
  amountSaved: 0,
  dueDate: d(2027, 3, 31),
  priority: 1,
  isRecurring: false,
  isCompleted: false,
  lastContributionAt: null,
  ...over,
});

export const income = (over: Partial<Income> = {}): Income => ({
  id: "i1",
  amount: 120_000,
  frequency: "biweekly",
  nextPaymentDate: d(2027, 1, 15),
  ...over,
});

export const termPlan = (over: Partial<TermPlan> = {}): TermPlan => ({
  id: "t1",
  name: "Winter OSAP",
  amount: 400_000,
  startDate: d(2027, 1, 6),
  endDate: d(2027, 4, 30),
  isActive: true,
  ...over,
});

export const txn = (over: Partial<Transaction> = {}): Transaction => ({
  id: "x1",
  amount: 1_000,
  date: d(2027, 1, 10),
  merchantName: "Tim Hortons",
  categoryId: "food",
  ...over,
});

// empty STS input with monthly budgeting
export const stsInput = (over: Partial<StsInput> = {}): StsInput => ({
  accounts: [],
  bills: [],
  goals: [],
  incomes: [],
  termPlans: [],
  transactions: [],
  categories: [],
  settings: { budgetPeriod: "monthly", minimumMonthlySpend: 0 },
  ...over,
});
