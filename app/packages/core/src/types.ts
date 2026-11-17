import type { Cents } from "./money";

export type AccountType = "chequing" | "savings" | "cash";

export interface Account {
  id: string;
  name?: string;
  type: AccountType;
  balance: Cents;
  // when the user last confirmed the real balance
  lastCheckInAt?: Date | null;
}

export type CategoryKind = "needs" | "wants" | "savings" | "income";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
}

// positive amount = money out (Plaid convention)
export interface Transaction {
  id: string;
  accountId?: string;
  amount: Cents;
  date: Date;
  merchantName: string | null;
  categoryId: string | null;
  createdFromBill?: boolean;
}
