# Current mobile: all app text

Every piece of user-facing text in the mobile app, grouped by screen. To change something, prompt with the ID, e.g. "change H4 to 'In the bank'".

**Since Phase 2 (2.6), the strings themselves live in `src/i18n/en.ts` (English, the source) and `src/i18n/fr.ts` (Canadian French).** The IDs below still describe where each line shows. Change English in `en.ts` and French in `fr.ts`; `i18n.test.ts` fails if a French line is missing or loses a `{placeholder}`. The Phase 2 screens are listed at the bottom by their key prefix.

`{curly}` parts are filled in by the app (amounts, dates, names). Keep them unless you want that info gone.

---

## Home (`src/app/(tabs)/index.tsx`)

| ID | Text | Where |
|----|------|-------|
| H1 | *Monday, Nov 16* (auto) | Date at top left |
| H2 | You haven't checked your balance in {days} days | Warning card under the big number when a balance is stale |
| H3 | Check it | Button in that warning card |
| H4 | In your accounts | Row under the big number, left side (total balance on the right) |
| H5 | Couldn't load your budget | Error title if data fails to load |
| H6 | How we got this number | Row that opens the breakdown |
| H7 | In your accounts / Bills due by {date} / Semester money for later / Saving for goals / Safe to spend | Breakdown rows |
| H8 | Semester money unlocking by {date} | Breakdown row when term money releases before the period ends |
| H9 | Over {N} days, until {weekday}, {date} | Last breakdown row, with {amount}/day |
| H10 | Your savings aren't counted here. Bills you've paid are already gone from your balance. | Note under the breakdown |
| H11 | Want to save a copy? | Monthly backup prompt title |
| H12 | Your budget lives on this phone and gets backed up with it to iCloud. Exporting a CSV takes a sec too. | Backup prompt text |
| H13 | Export / Later | Backup prompt buttons |

## Safe-to-spend card (`src/components/sts-hero.tsx`)

| ID | Text | Where |
|----|------|-------|
| S1 | Safe to spend today | Small heading at top of the big card |
| S2 | /day | Next to the big dollar number |
| S3 | You're good. That's {total} to last you till {weekday}, {date}. | Line under the number when money is comfortable (green) |
| S4 | Bit tight, but you'll make it to {weekday}, {date}. {total} total. | Same spot when money is tight |
| S5 | Nothing spare right now. About {amount} opens up {date}. | Same spot at $0, when money frees up soon |
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
| A3 | Hit + when you buy something. Takes about three seconds. | Empty state body |
| A4 | Money in | Row title for income with no "from" name |
| A5 | Spending | Row title for spending with no "where" name |
| A6 | Today / Yesterday / Tomorrow | Day group headings (from `src/lib/format.ts`, also used everywhere dates show) |
| A7 | Couldn't load your spending | Error title |
| A8 | This {paycheque / month / semester} · {start} to {end} | Small heading on the summary card at the top (`src/components/period-summary.tsx`) |
| A9 | {amount} spent | Big line on the summary card |
| A10 | {N}% less than this point last {paycheque / month / semester} | Comparison line (also "{N}% more than…" and "About the same as this point last…") |
| A11 | No spending yet this {paycheque / month / semester}. | Summary card with no spending |
| A12 | Uncategorized | Summary row for entries with no category |
| A13 | Everything else | Summary row after the six biggest categories |

## Plan tab (`src/app/(tabs)/plan.tsx`)

| ID | Text | Where |
|----|------|-------|
| P1 | Plan | Screen title |
| P2 | Bills | Section heading |
| P3 | No bills yet | Empty state title |
| P4 | Rent, your phone plan, Spotify, whatever you pay regularly. We take these out before working out your daily number. | Empty state body |
| P5 | Add a bill | Button under the bills list |
| P6 | Due {day} | Under each bill name |
| P7 | Overdue · {day} | Under a bill that's overdue |
| P8 | Paid | Under a paid bill |
| P9 | Paid {bill}, {amount} logged | Toast after tapping a bill's checkmark |
| P10 | Undo | Button in that toast (also used in the bill sheet toast) |
| P11 | Goals | Section heading |
| P12 | Nothing saved for yet | Goals empty state title |
| P13 | Saving up for a trip, a laptop, or just a cushion? Add it and we'll put a bit aside every paycheque. | Goals empty state body |
| P14 | Semester money | Section heading |
| P15 | Got a lump sum for the semester? | Term money empty state title |
| P16 | Add it and we'll spread it out week by week so it lasts the whole semester. | Term money empty state body |
| P17 | {amount} a week · {amount} unlocked so far · lasts till {date} | Line on a term money card |
| P18 | Ended {date} | Line on a term money card that has finished |
| P19 | Add semester money | Button under the term money cards |
| P20 | You can have one semester plan going at a time. | Shown instead of P19 when one is already running |
| P21 | {saved} of {target} | Progress line on a goal |
| P22 | {amount} set aside this {paycheque / month / semester} · by {date} | Detail line on a goal being funded (otherwise "By {date}") |
| P23 | All saved up | Detail line on a finished goal |
| P24 | We fill up the top goal first. | Note under the goals list (2+ goals) |
| P25 | Add a goal | Button under the goals list |
| P26 | You can have three goals going at once. | Shown instead of P25 with three unfinished goals |

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
| O2 | How much is in your account? | Step 1 heading |
| O3 | Ballpark is fine, you can fix it later. It stays on your phone. | Step 1 subtext |
| O4 | Balance | Step 1 amount label |
| O5 | Next | Button on steps 1 and 2 |
| O6 | When's your next payday? | Step 2 heading |
| O7 | Job, allowance, anything that comes in regularly. Your budget runs from one payday to the next. | Step 2 subtext |
| O8 | How much? | Step 2 amount label |
| O9 | How often? | Step 2 frequency label |
| O10 | Next payday | Step 2 date label |
| O11 | Skip, I don't get paid regularly | Step 2 skip button |
| O12 | Any bills coming up? | Step 3 heading |
| O13 | Rent, phone, subscriptions. We take these out first so your daily number is real. | Step 3 subtext |
| O14 | What is it? | Step 3 bill name label (placeholder "Rent") |
| O15 | How much? | Step 3 bill amount label |
| O16 | Next due | Step 3 date label |
| O17 | Repeats | Step 3 repeat label |
| O18 | Monthly / Just once | Step 3 repeat chips |
| O19 | Add another bill | Step 3 button that saves the bill and clears the form |
| O20 | Show me my number | Step 3 finish button |
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
| U2 | By paycheque / By month / By semester | Budget period chips |
| U3 | Right now that's {start} to {end}. | Under the chips |
| U4 | Add a payday below first. Until then it goes by month. | Under the chips when paycheque is picked with no payday |
| U5 | Add semester money on the Plan tab first. Until then it goes by month. | Under the chips when term is picked with no term money |
| U6 | Paydays | Section heading |
| U7 | Payday | Row title for a payday with no name |
| U8 | Next {day} · {frequency} | Under each payday ("No upcoming payday" when there isn't one) |
| U9 | No paydays yet. Add one and your budget runs payday to payday. | Shown with no paydays |
| U10 | Add a payday | Button |
| U11 | This budget ends | Date row on the Budget screen (tap to pick a day) |
| U12 | Want it to end on a different day? Tap the date and pick one. Your daily number gets worked out to that day. | Under U11 normally |
| U13 | You picked this date. Once it passes, things go back to normal. | Under U11 when a date has been picked |
| U14 | Go back to the normal end | Button when a date has been picked |
| U15 | Pick today or a day after it. | Error if a past day gets through |

## Payday sheet (`src/app/income.tsx`)

| ID | Text | Where |
|----|------|-------|
| Y1 | Add a payday / Edit payday | Sheet title |
| Y2 | What is it? | Name label (placeholder "Part-time job") |
| Y3 | How much? / How often? / Next payday | Field labels |
| Y4 | This doesn't get added to your balance on its own. Log it with + when it comes in. | Note |
| Y5 | Save / Delete payday | Buttons |

## Semester money sheet (`src/app/term-plan.tsx`, wording by region in `src/lib/term.ts`)

| ID | Text | Where |
|----|------|-------|
| M1 | Add semester money / Edit semester money | Sheet title |
| M2 | OSAP, a scholarship, co-op pay. Money that comes in once and has to last the whole semester. | Intro in Canada |
| M3 | A financial aid refund or a scholarship. Money that comes in once and has to last the whole semester. | Intro in the US |
| M4 | A maintenance loan or a bursary. Money that comes in once and has to last the whole term. (UK students say term.) | Intro in the UK |
| M5 | A loan, grant or scholarship. Money that comes in once and has to last the whole semester. | Intro elsewhere |
| M6 | OSAP / Financial aid refund / Maintenance loan / Semester money | Name placeholder, and the name used if left empty |
| M7 | What is it? / How much? / Starts / Has to last until | Field labels |
| M8 | The end date needs to be after the start. | Shown when the dates are the wrong way round |
| M9 | That works out to about {amount} a week till {date}. | Preview once the form is filled in |
| M10 | Once it hits your account, include it in your balance. We'll hold back the part that's for later weeks. | Note |
| M11 | Save / Delete semester money | Buttons |

## Goal sheet (`src/app/goal.tsx`)

| ID | Text | Where |
|----|------|-------|
| N1 | Add a goal / Edit goal | Sheet title |
| N2 | What's it for? | Name label (placeholder "Laptop") |
| N3 | How much? / By when? | Field labels |
| N4 | Put money in | Heading on an unfinished goal |
| N5 | {saved} of {target} so far. Move it to savings in your bank app, then log it here. | Under N4 with a savings account |
| N6 | {saved} of {target} so far. Put it somewhere you won't spend it, then log it here. It comes out of your balance. | Under N4 with no savings account |
| N7 | How much now? | Amount label |
| N8 | Add it | Button |
| N9 | Added {amount} to {goal} | Toast afterwards |
| N10 | Saved for {goal} | Name of the entry it logs, seen in Activity (`src/db/plan.ts`) |
| N11 | Save / Delete goal | Buttons |

## Categories (`src/app/categories.tsx`, `src/app/category.tsx`)

| ID | Text | Where |
|----|------|-------|
| R1 | Categories | Screen title |
| R2 | Needs / Wants / Savings / Money in | Kind shown on each row and as chips in the sheet (`src/lib/categories.ts`) |
| R3 | Add a category / New category | Button / sheet title (new) |
| R4 | Edit category | Sheet title (editing) |
| R5 | Name | Name label (placeholder "Takeout") |
| R6 | Sticker / Colour / What kind is it? | Picker labels |
| R12 | Or type your own | Field under the sticker grid (placeholder "Tap here, then use the emoji keyboard") |
| R7 | (the picked kind's line from R14) | Note under the kind chips, always shown |
| R8 | The arrows change the order they show up in when you're logging something. | Note under the grouped list |
| R9 | Anything you've already logged stays. It just shows up as uncategorized. | Above the delete button |
| R10 | Save / Delete category | Buttons |
| R13 | When you log something, you pick one of these. That's how Activity shows where your money went. Tap one to rename it or change its sticker. | Intro at the top of the Categories screen |
| R14 | Needs: Stuff you have to pay for, like rent, groceries and getting around. / Wants: The fun stuff. Coffee, takeout, shopping, nights out. / Savings: Money you move into savings. It never counts as spending. / Money in: Only shows up when you log money coming in, like a paycheque. | Group headings and their lines on the Categories screen, and the kind chips in the sheet (`src/lib/categories.ts`) |
| R11 | Groceries, Eating out, Coffee, Transit, Rent & bills, School, Health, Fun, Shopping, Subscriptions, Savings, Income | The 12 starting categories (`app/packages/core/src/categories.ts`) |

## Reminders screen (`src/app/reminders.tsx`)

| ID | Text | Where |
|----|------|-------|
| W1 | Reminders | Screen title |
| W2 | Notifications are off right now / Turn them on | Card and button before iOS has been asked |
| W3 | Notifications are blocked in your iPhone settings / Open Settings | Card and button when iOS notifications are off |
| W4 | Bills · A heads-up 3 days before something's due. | First switch |
| W5 | Sunday recap · How your week went, plus your daily number. | Second switch |
| W6 | Balance check · A nudge if you haven't checked your balance in a week. | Third switch |
| W7 | Max one a day. They come from your phone, not from us. | Note at the bottom |

## Notifications (`src/lib/reminder-text.ts`)

| ID | Text | Where |
|----|------|-------|
| X1 | {bill} is due {weekday} | Bill reminder title (one bill) |
| X2 | {amount}. Your daily number already accounts for it. | Bill reminder body (one bill) |
| X3 | {N} bills due {weekday} | Bill reminder title (several) |
| X4 | {names}, {amount} total. Your daily number already accounts for them. | Bill reminder body (several) |
| X5 | Mind checking your balance? | Balance reminder title |
| X6 | It's been over a week. Takes a few seconds and keeps your number accurate. | Balance reminder body |
| X7 | Your week | Sunday summary title |
| X8 | Spent {amount} this week, {amount} less/more than last week. Mostly {categories}. {amount}/day until {weekday}, {date}. | Sunday summary body (shorter when there is no last week, or nothing logged) |
| X9 | Tap to see how your week went. | Sunday summary body for Sundays further out |

## Settings (`src/app/settings.tsx`)

| ID | Text | Where |
|----|------|-------|
| G1 | Settings | Screen title |
| G2 | Accounts | Card title |
| G3 | Your balances, plus any cash or savings accounts. | Accounts card subtext |
| G4 | Your budget lives on your phone | Last card title |
| G5 | No account, no bank login. It gets backed up with your iPhone to iCloud, and you can export everything as a CSV whenever you want. | Last card text |
| G6 | Budget | Card title |
| G7 | By paycheque, month or semester, plus your paydays. | Budget card subtext |
| G8 | Categories | Card title |
| G9 | The labels you sort your spending into. | Categories card subtext |
| G10 | Reminders | Card title |
| G11 | Bill heads-ups, your Sunday recap and balance nudges. | Reminders card subtext |
| G12 | Export CSV | Button on the last card |
| G13 | Couldn't export: {error} | Error line on the last card |

## Accounts list (`src/app/accounts.tsx`)

| ID | Text | Where |
|----|------|-------|
| C1 | Accounts | Screen title |
| C2 | Chequing / Savings / Cash | Type shown under each account name |
| C3 | · checked {today / yesterday / N days ago} | After the type, when the balance has been checked |
| C5 | Add an account | Button at the bottom |

## Account sheet (`src/app/account.tsx`)

| ID | Text | Where |
|----|------|-------|
| D1 | Add an account | Sheet title (new) |
| D2 | Edit account | Sheet title (editing) |
| D3 | Name | Name label (placeholder "Chequing") |
| D4 | Type | Type label |
| D5 | Chequing / Savings / Cash | Type chips |
| D6 | Savings don't count toward your daily number. | Note shown when Savings is picked |
| D7 | What's in it right now? / Balance | Balance label (new account / editing, filled in with the current balance) |
| D9 | Changing this just updates the number. It won't show up as spending. | Note under the balance when editing |
| D8 | Save | Main button |
| D9 | Delete account | Bottom button (only with 2+ accounts) |

## Balance check-in sheet (`src/app/check-in.tsx`)

| ID | Text | Where |
|----|------|-------|
| K1 | Check your balance | Sheet title |
| K2 | We think {account} has {amount}. Check your bank app and type in what it actually says. | Intro text |
| K3 | Real balance | Amount label |
| K4 | That matches. All good. | Shown when the typed balance matches |
| K5 | That's {amount} less/more than we had. | Shown when it doesn't match |
| K6 | Confirm | Button when it matches |
| K7 | Log the difference | Button when it doesn't match |
| K8 | Just fix the balance | Second button when it doesn't match |

## Shared bits

| ID | Text | Where |
|----|------|-------|
| F1 | Just once / Daily / Weekly / Every 2 weeks / 1st and 15th / Monthly / Yearly | Repeat/frequency chips and the "· monthly" after bill due dates (`src/lib/format.ts`) |
| F2 | Pick a date | Date field before a date is chosen (`src/components/date-field.tsx`) |
| F3 | That didn't save: {error} | Error line on every form |
| F4 | Balance check-in | Name given to the entry a check-in logs, seen in Activity (`src/db/ledger.ts`) |
| F6 | Close | Spoken label of the × in every sheet's top right (`src/components/form.tsx`) |
| F5 | Chequing | Name of the account onboarding creates (`src/db/ledger.ts`) |

## Quick add, hold the + button (`src/components/tab-bar.tsx`)

| ID | Text | Where |
|----|------|-------|
| Q1 | Semester money | Top bubble |
| Q2 | Goal | Second bubble |
| Q3 | Bill | Third bubble |
| Q4 | Money in | Bubble nearest the + |

## Phase 2 screens (keys in `src/i18n/en.ts`)

| Prefix | Screen |
|---|---|
| `plus.*` | Paywall (`src/app/plus.tsx`), including every feature line and the fine print |
| `ai.*` | Cloud AI disclosure (`src/app/cloud-ai.tsx`) and the AI-off and failed lines |
| `afford.*` | Can I afford this? (`src/app/afford.tsx`), including the figure labels given to the model |
| `limit.*`, `plan.limit*`, `alert.*` | Category limits: the sheet, the Plan section, banners and notifications |
| `insights.*` | Insights (`src/app/insights.tsx`) |
| `recap.*`, `notify.weekRecap` | Weekly recap (`src/app/recap.tsx`) |
| `ask.*` | Ask Current (`src/app/ask.tsx`): suggestions, the decline line and figure labels |
| `import.*`, `bank.*` | Import (`src/app/import.tsx`) |
| `appearance.*`, `theme.*`, `icon.*` | Themes and app icons (`src/app/appearance.tsx`) |
| `add.quick*` | Quick add on the Log spending sheet |
| `goal.takeOut*`, `goal.paidFor`, `goal.took` | Taking money out of a goal |
| `settings.plus*`, `settings.cloudAi*` | The Plus and Cloud AI cards in Settings |
