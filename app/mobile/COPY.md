# Current mobile: all app text

Every piece of user-facing text in the mobile app, grouped by screen. To change something, prompt with the ID, e.g. "change H4 to 'In the bank'".

`{curly}` parts are filled in by the app (amounts, dates, names). Keep them unless you want that info gone.

---

## Home (`src/app/(tabs)/index.tsx`)

| ID | Text | Where |
|----|------|-------|
| H1 | *Monday, Nov 16* (auto) | Date at top left |
| H2 | Balance last checked {days} days ago | Warning card under the big number when a balance is stale |
| H3 | Check now | Button in that warning card |
| H4 | In your accounts | Row under the big number, left side (total balance on the right) |
| H5 | Couldn't load your budget | Error title if data fails to load |

## Safe-to-spend card (`src/components/sts-hero.tsx`)

| ID | Text | Where |
|----|------|-------|
| S1 | Safe to spend today | Small heading at top of the big card |
| S2 | /day | Next to the big dollar number |
| S3 | You're in good shape. That's {total} until {weekday}. | Line under the number when money is comfortable (green) |
| S4 | Tight, but it gets you to {weekday}. {total} in all. | Same spot when money is tight |
| S5 | Nothing spare right now. About {amount} frees up {date}. | Same spot at $0, when money frees up soon |
| S6 | Nothing spare right now. | Same spot at $0, nothing coming |

## Tab bar (`src/components/tab-bar.tsx`)

| ID | Text | Where |
|----|------|-------|
| T1 | Home | First tab |
| T2 | Activity | Second tab |
| T3 | Plan | Third tab |

## Activity tab (`src/app/(tabs)/activity.tsx`)

| ID | Text | Where |
|----|------|-------|
| A1 | Activity | Screen title |
| A2 | Nothing logged yet | Empty state title (no transactions) |
| A3 | Tap + to log your first purchase. It takes about three seconds. | Empty state body |
| A4 | Money in | Row title for income with no "from" name |
| A5 | Spending | Row title for spending with no "where" name |
| A6 | Today / Yesterday / Tomorrow | Day group headings (from `src/lib/format.ts`, also used everywhere dates show) |
| A7 | Couldn't load your activity | Error title |

## Plan tab (`src/app/(tabs)/plan.tsx`)

| ID | Text | Where |
|----|------|-------|
| P1 | Plan | Screen title |
| P2 | Bills | Section heading |
| P3 | No bills yet | Empty state title |
| P4 | Add rent, your phone and subscriptions so they're set aside before your daily number. | Empty state body |
| P5 | Add a bill | Button under the bills list |
| P6 | Due {day} | Under each bill name |
| P7 | Overdue · {day} | Under a bill that's overdue |
| P8 | Paid | Under a paid bill |
| P9 | Logged {amount} from {bill} | Toast after tapping a bill's checkmark |
| P10 | Undo | Button in that toast (also used in the bill sheet toast) |
| P11 | Goals | Section heading |
| P12 | Nothing saved for yet | Goals empty state title |
| P13 | A trip, a laptop, or just a cushion? Add it and we'll set a little aside every paycheque. | Goals empty state body |

## Log spending sheet, the + button (`src/app/add.tsx`)

| ID | Text | Where |
|----|------|-------|
| L1 | Log spending | Sheet title when "Spent" is picked |
| L2 | Log money in | Sheet title when "Got paid" is picked |
| L3 | Edit | Sheet title when editing an existing entry |
| L4 | Spent | Left toggle chip |
| L5 | Got paid | Right toggle chip |
| L6 | How much? | Amount label |
| L7 | Where? | Name field label (spending) |
| L8 | From? | Name field label (money in) |
| L9 | Tim Hortons | Placeholder in the name field (spending) |
| L10 | Paycheque | Placeholder in the name field (money in) |
| L11 | When? | Date label |
| L12 | Account | Account picker label (only shows with 2+ accounts) |
| L13 | Log it | Main button (new entry) |
| L14 | Save | Main button (editing) |
| L15 | Delete | Button under Save when editing |
| L16 | Couldn't open this | Sheet title if the entry fails to load |

## Onboarding, first launch (`src/app/onboarding.tsx`)

| ID | Text | Where |
|----|------|-------|
| O1 | Step {n} of 3 · No account. No bank login. | Small line at the top of every step |
| O2 | What can you spend right now? | Step 1 heading |
| O3 | Your chequing balance, roughly. You can correct it any time, and it stays on your phone. | Step 1 subtext |
| O4 | Balance | Step 1 amount label |
| O5 | Next | Button on steps 1 and 2 |
| O6 | When are you paid next? | Step 2 heading |
| O7 | A job, an allowance, anything regular. We'll budget from one payday to the next. | Step 2 subtext |
| O8 | How much? | Step 2 amount label |
| O9 | How often? | Step 2 frequency label |
| O10 | Next payday | Step 2 date label |
| O11 | Skip, no regular income | Step 2 skip button |
| O12 | Any bills coming up? | Step 3 heading |
| O13 | Rent, phone, subscriptions. They're set aside before your daily number. | Step 3 subtext |
| O14 | What is it? | Step 3 bill name label (placeholder "Rent") |
| O15 | How much? | Step 3 bill amount label |
| O16 | Next due | Step 3 date label |
| O17 | Repeats | Step 3 repeat label |
| O18 | Monthly / Just once | Step 3 repeat chips |
| O19 | Add another bill | Step 3 button that saves the bill and clears the form |
| O20 | Show my number | Step 3 finish button |
| O21 | Back | Button on steps 2 and 3 |

## Bill sheet (`src/app/bill.tsx`)

| ID | Text | Where |
|----|------|-------|
| B1 | Add a bill | Sheet title (new) |
| B2 | Edit bill | Sheet title (editing) |
| B3 | What is it? | Name label (placeholder "Rent") |
| B4 | How much? | Amount label |
| B5 | Next due | Date label |
| B6 | Repeats | Repeat label (chips come from F1) |
| B7 | Save | Main button |
| B8 | Paid it? | Heading for the pay section on an unpaid bill |
| B9 | Paid on | Date label in that section |
| B10 | From | Account picker in that section |
| B11 | Mark paid | Button in that section |
| B12 | Mark unpaid | Button on a paid bill |
| B13 | Delete bill | Bottom button when editing |

## Settings (`src/app/settings.tsx`)

| ID | Text | Where |
|----|------|-------|
| G1 | Settings | Screen title |
| G2 | Accounts | First card title |
| G3 | Balances, check-ins, and adding cash or savings. | First card subtext |
| G4 | Your budget lives on your phone | Second card title |
| G5 | No account. No bank login. | Second card subtext |

## Accounts list (`src/app/accounts.tsx`)

| ID | Text | Where |
|----|------|-------|
| C1 | Accounts | Screen title |
| C2 | Chequing / Savings / Cash | Type shown under each account name |
| C3 | · checked {today / yesterday / N days ago} | After the type, when the balance has been checked |
| C4 | Check balance | Button on each account card |
| C5 | Add an account | Button at the bottom |

## Account sheet (`src/app/account.tsx`)

| ID | Text | Where |
|----|------|-------|
| D1 | Add an account | Sheet title (new) |
| D2 | Edit account | Sheet title (editing) |
| D3 | Name | Name label (placeholder "Chequing") |
| D4 | Type | Type label |
| D5 | Chequing / Savings / Cash | Type chips |
| D6 | Savings never count towards your daily number. | Note shown when Savings is picked |
| D7 | What's in it right now? | Starting balance label (new accounts only) |
| D8 | Save | Main button |
| D9 | Delete account | Bottom button (only with 2+ accounts) |

## Balance check-in sheet (`src/app/check-in.tsx`)

| ID | Text | Where |
|----|------|-------|
| K1 | Check your balance | Sheet title |
| K2 | We have {account} at {amount}. Open your banking app and type what it really says. | Intro text |
| K3 | Real balance | Amount label |
| K4 | Spot on. Nothing to fix. | Shown when the typed balance matches |
| K5 | That's {amount} less/more than we had. | Shown when it doesn't match |
| K6 | Confirm | Button when it matches |
| K7 | Log the difference as Uncategorized | Button when it doesn't match |
| K8 | Just update my balance | Second button when it doesn't match |

## Shared bits

| ID | Text | Where |
|----|------|-------|
| F1 | Just once / Daily / Weekly / Every 2 weeks / 1st and 15th / Monthly / Yearly | Repeat/frequency chips and the "· monthly" after bill due dates (`src/lib/format.ts`) |
| F2 | Pick a date | Date field before a date is chosen (`src/components/date-field.tsx`) |
| F3 | Couldn't save: {error} | Error line on every form |
| F4 | Balance check-in | Name given to the entry a check-in logs, seen in Activity (`src/db/ledger.ts`) |
| F5 | Chequing | Name of the account onboarding creates (`src/db/ledger.ts`) |
