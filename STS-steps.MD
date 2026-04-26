# STS Implementation Tasks

## 1. Schema Changes

> Do this first. Everything else depends on it.

- [x] ~~Remove `accountCategory` from `bankAccounts`~~
- [x] ~~Remove `includeInCalculations` from `bankAccounts`~~
- [x] ~~Add `isSavingsAccount Boolean @default(false)` to `bankAccounts`~~
- [x] ~~Remove `monthlySavingsGoal` from `userSettings`~~
- [x] ~~Remove `safeToSpendPeriod` from `userSettings`~~
- [x] ~~Add `desiredMinimumMonthlySpend Decimal @default(0)` to `userSettings`~~
- [x] ~~Remove `isSavingsContribution` from `Transaction`~~
- [x] ~~Remove `TransferPairId` from `Transaction`~~
- [x] ~~Decide whether to drop `budgetMonth` entirely or keep for historical snapshots~~ — kept, budget period endpoints marked DEPRECATED
- [x] ~~Write and run migrations for all of the above~~

---

## 2. Update Existing Endpoints

- [x] ~~`GET /api/accounts` — remove any logic referencing `accountCategory` or `includeInCalculations`~~
- [x] ~~`DELETE /api/delete-bank-account` — currently deletes by `plaidAccountId`, update to delete by internal `id`~~
- [x] `PATCH /api/settings` — remove `monthlySavingsGoal` and `safeToSpendPeriod` handling, add `desiredMinimumMonthlySpend` — **bug: wrong field name (`desireMinimumSpend`) + syntax error (`! ==`) in user-settings.ts:71**
- [?] `GET /api/bills` — add a flag in the response distinguishing overdue unpaid bills from upcoming unpaid bills
- [x] ~~`POST /api/exchange-public-token` — update `setBankAccounts` to remove `accountCategory` assignment, set `isSavingsAccount: false` as default~~

---

## 3. New Endpoints

- [x] ~~`PATCH /api/accounts/:id/savings-toggle` — flips `isSavingsAccount` on a bank account, ownership check against `userId`~~ — exists as `POST /api/accounts/savings-toogle` in user-update-details.ts (note: typo in route + using POST not PATCH)
- [x] ~~`PATCH /api/settings/income` — lets users manually set `paychequeAmount`, `paychequeFrequency`, and `nextPaychequeDate` for irregular income~~ — exists in user-update-details.ts (note: missing leading `/` on route)
- [x] ~~`GET /api/sts` — core calculation endpoint, returns STS number plus "Available after" if applicable~~ — exists as `GET /api/safe-to-spend`
- [ ] `GET /api/savings-reconciliation` — returns `savings_account_total`, `goals_total`, the gap, and which goals are underfunded based on priority allocation
- [x] ~~`GET /api/bills/suggestions` — fuzzy matches unpaid bills against recent transactions, returns suggestions for user to confirm~~ — exists as stub in get-user-details.ts (placeholder data, not real logic yet)

---

## 4. Write STS Calculation Logic

> Lives in `src/lib/sts.ts`. Test logic here before wiring to the endpoint.

- [x] Sum `availableBalance` across all non-savings accounts
- [x] Exclude credit accounts from balance sum (`accountType === 'credit'`)
- [x] Filter bills to unpaid ones due this calendar month plus any overdue unpaid ones
- [x] Run priority allocation algorithm across active `budgetItem` records (highest to lowest `priority`)
- [x] Calculate monthly requirement per goal
  - Recurring monthly goal: flat `amount`
  - One-time goal: `(amount - amountSaved) / months_until_dueDate`
  - Handle `months_until_dueDate < 1` edge case — treat as full remaining `amount` due this month — **Math.max(1, ...) handles this**
- [x] Protect `desiredMinimumMonthlySpend` before goal allocation — **referenced but `if` block is empty, no actual return**
- [x] Flow leftover back into STS if everything is fully funded
- [x] Floor STS at 0 — **function currently returns nothing**

---

## 5. Write "Available after" Logic

> Can live in `src/lib/sts.ts` alongside the STS calculation.

- [ ] Only trigger when STS = 0
- [ ] Check if `nextPaychequeDate` is in the future and within the current calendar month
- [ ] Advance `nextPaychequeDate` lazily at read time based on `paychequeFrequency` if the stored date has already passed
- [ ] Calculate available amount using balance + paycheque minus bills and goal reservations
- [ ] Floor at 0

---

## 6. Write Savings Reconciliation Logic

> Lives in `src/lib/savings.ts`.

- [ ] Sum `availableBalance` across all designated savings accounts
- [ ] Sum `amountSaved` across all active goals (`!isCompleted && !isDeleted`)
- [ ] Calculate the gap
- [ ] Run priority allocation to identify which specific goals are underfunded
- [ ] Return underfunded goals ranked by priority

---

## 7. Write Bill Fuzzy Matching Logic

> Lives in `src/lib/bills.ts`.

- [ ] Query unpaid bills for the user
- [ ] Query transactions dated within 3 days of each bill's `dueDate`
- [ ] Match on amount within a $1.00 tolerance
- [ ] Return suggestions only, never auto-confirm

---

## 8. Fix Plaid Sync Logic

- [ ] `new-user.ts` — write cursor back to `plaidUser.cursor` after each sync so subsequent syncs don't re-fetch everything from scratch
- [x] ~~Remove any remaining logic writing `isSavingsContribution` or `TransferPairId` during transaction sync~~

---

## Order of Operations

```
1. Schema changes + migrations
2. Update existing endpoints (nothing broken)
3. Write utility functions (sts.ts, savings.ts, bills.ts)
4. Wire utility functions to new endpoints
5. Fix Plaid sync logic
6. "Available after" and reconciliation last (depend on core STS being solid)
```