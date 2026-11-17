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
| H6 | How it's calculated | Row that opens the breakdown |
| H7 | In your accounts / Bills due by {date} / Term money for later weeks / Held back for goals / Safe to spend | Breakdown rows |
| H8 | Term money freeing up by {date} | Breakdown row when term money releases before the period ends |
| H9 | Over {N} days, until {weekday} {date} | Last breakdown row, with {amount}/day |
| H10 | Savings accounts never count. Bills already paid are already out of your balance. | Note under the breakdown |
| H11 | Back up now? | Monthly backup prompt title |
| H12 | Your budget lives on this phone and is included in iCloud device backups. A CSV copy takes a few seconds. | Backup prompt text |
| H13 | Export a copy / Not now | Backup prompt buttons |

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
| A8 | This {paycheque / month / term} · {start} to {end} | Small heading on the summary card at the top (`src/components/period-summary.tsx`) |
| A9 | {amount} spent | Big line on the summary card |
| A10 | {N}% less than this point last {paycheque / month / term} | Comparison line (also "{N}% more than…" and "About the same as this point last…") |
| A11 | Nothing spent yet this {paycheque / month / term}. | Summary card with no spending |
| A12 | Uncategorized | Summary row for entries with no category |
| A13 | Everything else | Summary row after the six biggest categories |

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
| P13 | A trip, a laptop, or just a cushion? Add it and we'll hold a little back every paycheque. | Goals empty state body |
| P14 | Term money | Section heading |
| P15 | Got a lump sum for the term? | Term money empty state title |
| P16 | Add it and we'll spread it over the weeks it has to last, so it's still there in April. | Term money empty state body |
| P17 | {amount} released so far, {amount}/week, lasts until {date} | Line on a term money card |
| P18 | Ended {date} | Line on a term money card that has finished |
| P19 | Add term money | Button under the term money cards |
| P20 | One lot of term money at a time for now. | Shown instead of P19 when one is already running |
| P21 | {saved} of {target} | Progress line on a goal |
| P22 | {amount} held back this {paycheque / month / term} · by {date} | Detail line on a goal being funded (otherwise "By {date}") |
| P23 | Fully saved | Detail line on a finished goal |
| P24 | The goal at the top is funded first. | Note under the goals list (2+ goals) |
| P25 | Add a goal | Button under the goals list |
| P26 | Two goals at a time for now. | Shown instead of P25 with two unfinished goals |

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
| L17 | Category | Category picker label (chips are the user's categories; also on the bill sheet) |

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

## Budget screen (`src/app/budget.tsx`)

| ID | Text | Where |
|----|------|-------|
| U1 | Budget | Screen title and chips label |
| U2 | By paycheque / By month / By term | Budget period chips |
| U3 | Right now that's {start} to {end}. | Under the chips |
| U4 | Add a payday below to budget by paycheque. Until then we go by month. | Under the chips when paycheque is picked with no payday |
| U5 | Add term money on the Plan tab to budget by term. Until then we go by month. | Under the chips when term is picked with no term money |
| U6 | Paydays | Section heading |
| U7 | Payday | Row title for a payday with no name |
| U8 | Next {day} · {frequency} | Under each payday ("No upcoming payday" when there isn't one) |
| U9 | No paydays yet. Add one and your daily number runs from one payday to the next. | Shown with no paydays |
| U10 | Add a payday | Button |

## Payday sheet (`src/app/income.tsx`)

| ID | Text | Where |
|----|------|-------|
| Y1 | Add a payday / Edit payday | Sheet title |
| Y2 | What is it? | Name label (placeholder "Part-time job") |
| Y3 | How much? / How often? / Next payday | Field labels |
| Y4 | We never add this to your balance for you. Log it with + when it lands. | Note |
| Y5 | Save / Delete payday | Buttons |

## Term money sheet (`src/app/term-plan.tsx`, wording by region in `src/lib/term.ts`)

| ID | Text | Where |
|----|------|-------|
| M1 | Add term money / Edit term money | Sheet title |
| M2 | OSAP, a scholarship or co-op pay: money that lands once and has to last the term. | Intro in Canada |
| M3 | A financial aid refund or a scholarship: money that lands once and has to last the term. | Intro in the US |
| M4 | A maintenance loan or a bursary: money that lands once and has to last the term. | Intro in the UK |
| M5 | A loan, grant or scholarship: money that lands once and has to last the term. | Intro elsewhere |
| M6 | OSAP / Financial aid refund / Maintenance loan / Term money | Name placeholder, and the name used if left empty |
| M7 | What is it? / How much? / It has to last from / Until | Field labels |
| M8 | The last day has to come after the first. | Shown when the dates are the wrong way round |
| M9 | That's about {amount} a week until {date}. | Preview once the form is filled in |
| M10 | Count it in your balance once it lands. We hold back the part meant for later weeks. | Note |
| M11 | Save / Delete term money | Buttons |

## Goal sheet (`src/app/goal.tsx`)

| ID | Text | Where |
|----|------|-------|
| N1 | Add a goal / Edit goal | Sheet title |
| N2 | What's it for? | Name label (placeholder "Laptop") |
| N3 | How much? / By when? | Field labels |
| N4 | Set money aside | Heading on an unfinished goal |
| N5 | {saved} of {target} so far. Move it to savings in your banking app, then log it here. | Under N4 with a savings account |
| N6 | {saved} of {target} so far. Move it somewhere you won't spend it, then log it here. It comes out of your balance. | Under N4 with no savings account |
| N7 | How much now? | Amount label |
| N8 | Set it aside | Button |
| N9 | Set aside {amount} for {goal} | Toast afterwards |
| N10 | Saved for {goal} | Name of the entry it logs, seen in Activity (`src/db/plan.ts`) |
| N11 | Save / Delete goal | Buttons |

## Categories (`src/app/categories.tsx`, `src/app/category.tsx`)

| ID | Text | Where |
|----|------|-------|
| R1 | Categories | Screen title |
| R2 | Need / Want / Savings / Money in | Kind shown on each row and as chips in the sheet (`src/lib/categories.ts`) |
| R3 | Add a category | Button, and sheet title (new) |
| R4 | Edit category | Sheet title (editing) |
| R5 | Name | Name label (placeholder "Takeout") |
| R6 | Sticker / Colour / What kind? | Picker labels |
| R12 | Or type your own | Field under the sticker grid (placeholder "Switch to the emoji keyboard") |
| R7 | Money you move to savings never counts as spending. | Note when Savings is picked |
| R8 | Shows up when you log money coming in. | Note when Money in is picked |
| R9 | Deleting keeps your entries. They just lose the sticker. | Above the delete button |
| R10 | Save / Delete category | Buttons |
| R11 | Groceries, Eating out, Coffee, Transit, Rent & bills, School, Health, Fun, Shopping, Subscriptions, Savings, Income | The 12 starting categories (`app/packages/core/src/categories.ts`) |

## Reminders screen (`src/app/reminders.tsx`)

| ID | Text | Where |
|----|------|-------|
| W1 | Reminders | Screen title |
| W2 | Notifications aren't on yet / Turn on notifications | Card and button before iOS has been asked |
| W3 | Notifications are off for Current in iPhone Settings / Open Settings | Card and button when iOS notifications are off |
| W4 | Bills coming up · 3 days before a bill is due. | First switch |
| W5 | Sunday summary · What you spent this week and your daily number. | Second switch |
| W6 | Balance checks · When your balance hasn't been checked for over a week. | Third switch |
| W7 | Never more than one a day. They're made on your phone, not sent from a server. | Note at the bottom |

## Notifications (`src/lib/reminder-text.ts`)

| ID | Text | Where |
|----|------|-------|
| X1 | {bill} is due {weekday} | Bill reminder title (one bill) |
| X2 | {amount}. It's already set aside in your daily number. | Bill reminder body (one bill) |
| X3 | {N} bills due {weekday} | Bill reminder title (several) |
| X4 | {names}: {amount} in all. Already set aside in your daily number. | Bill reminder body (several) |
| X5 | Quick balance check? | Balance reminder title |
| X6 | It's been over a week. Ten seconds keeps your daily number honest. | Balance reminder body |
| X7 | Your week | Sunday summary title |
| X8 | Spent {amount} this week, {amount} less/more than last week. Mostly {categories}. {amount}/day until {weekday}. | Sunday summary body (shorter when there is no last week, or nothing logged) |
| X9 | Open Current to see how your week went. | Sunday summary body for Sundays further out |

## Settings (`src/app/settings.tsx`)

| ID | Text | Where |
|----|------|-------|
| G1 | Settings | Screen title |
| G2 | Accounts | Card title |
| G3 | Balances, check-ins, and adding cash or savings. | Accounts card subtext |
| G4 | Your budget lives on your phone | Last card title |
| G5 | No account. No bank login. It's included in iCloud device backups, and you can export everything you've logged as a CSV any time. | Last card text |
| G6 | Budget | Card title |
| G7 | By paycheque, month or term, and when you get paid. | Budget card subtext |
| G8 | Categories | Card title |
| G9 | Rename them, change their stickers, or add your own. | Categories card subtext |
| G10 | Reminders | Card title |
| G11 | Bills coming up, your Sunday summary and balance checks. | Reminders card subtext |
| G12 | Export CSV | Button on the last card |
| G13 | Couldn't export: {error} | Error line on the last card |

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
