import type { Account, Category, Transaction } from "./types";

export const CSV_HEADER = ["Date", "Amount", "Merchant", "Category", "Account", "Note"] as const;

// quote a cell when it needs it, and defuse text a spreadsheet would run as a formula
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// YYYY-MM-DD in local time
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// signed decimal from integer cents, without going through a float
function decimal(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

// every transaction as CSV, newest first as given; money out is negative, the way bank exports show it
export function transactionsToCsv(
  transactions: readonly (Transaction & { note?: string | null })[],
  categories: readonly Category[],
  accounts: readonly Account[],
): string {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name ?? ""]));
  const lines = [CSV_HEADER.join(",")];

  // one row per transaction
  for (const t of transactions) {
    lines.push(
      [
        isoDay(t.date),
        decimal(-t.amount),
        cell(t.merchantName ?? ""),
        cell((t.categoryId && categoryNames.get(t.categoryId)) || ""),
        cell((t.accountId && accountNames.get(t.accountId)) || ""),
        cell(t.note ?? ""),
      ].join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
