# Current Roadmap (November 2026)

This file is the handoff from planning to Claude Code. It says where Current stands, what to build next, in what order, and what we are deliberately not building. Read the whole file before starting any item. It was rewritten on November 16, 2026 to follow `GROWTH_PLAN.md`, which holds the reasoning, the financial model and the sources behind every change.

## Kickoff prompt (paste into Claude Code from the repo root)

```
Read ROADMAP.md, GROWTH_PLAN.md, decisions.MD and STS-steps.MD. We are working through
ROADMAP.md one item at a time, starting with 0.4 and then 0.8. For each item: read the files it
points to, then show me a short plan (core function signatures, local table changes, screens
touched). Wait for my OK only when the item says "confirm with Augustine"; otherwise implement
it. After each item run the core tests, the type checks and lint, then tick the item's checkbox
in ROADMAP.md and summarize what changed in two or three lines. Do not change anything listed
under "Rules" without asking. Do not do feature work in app/web or app/api beyond what an item
names. Build G.1 alongside Phase 1 and G.2 before the Phase 2 launch. Skip items marked
(optional, one-time) unless I ask.
```

## Where Current stands

Verified against `main` at `b16ce03` ("fix: error getting transactions from plaid", May 8 2026). The commit before it, `8d2cf8b`, is "feat: fallback to current balance". Nothing has been committed since, and the local repo is at the same commit, so this is the real state of the code.

Built and working (web and API): Better Auth with email verification and password reset (Resend); Plaid link, token exchange, webhook sync with cursor, manual `/api/sync`; Safe-to-Spend (`app/api/src/lib/safe-to-spend.ts`) with bills, scheduled savings, committed goals, spending floor and an "available after next paycheque" amount; income sources with frequencies; bills CRUD with transaction matching (`lib/bills.ts`); savings goals with priority reorder, manual allocate and reconciliation against savings account balances (`lib/savings.ts`); soft delete with reactivation; paginated transactions; web pages for dashboard, transactions, bills, savings, accounts, settings, onboarding and legal. Routes live in `app/api/src/plaid/*.ts`, not in `server.ts`.

Not built: any way to use Current without Plaid, categories or category budgets, charts, scheduled notifications, billing, a production domain, the mobile app, analytics.

Things the documents used to imply that are not true: `decisions.MD` holds one sentence (late unpaid bills count against STS), so the locked rules live only in this file; `app/packages/types`, `ui` and `utils` exist but are empty; there are no tests and no test runner anywhere in the repo.

Why the existing code is frozen instead of extended: `calculateSafeToSpend` interleaves eight Prisma calls with the math, does arithmetic on floats, is month-based throughout, counts spending by Plaid category names, and writes to the database while reading (the income loop near line 395). All routes assume a session and a Postgres user, and the web pages are large client components with nothing portable to React Native. The domain design carries over; most of the code does not. The old STS function is the behavioural reference for the new one.

## Product direction

Current is an iOS budgeting app for students and young adults in Canada, the US and the UK. Competitors like DaTrack win App Store search with manual-first logging, privacy ("no bank login"), category budgets, charts, reminders and AI quick add. Current matches only the parts people need and wins on what generic trackers don't do: one Safe-to-Spend number that already knows your bills and goals, a daily version of it ("$23/day until Friday"), budgeting by paycheque or by school term, and term plans that spread lump-sum student money over the weeks it has to last.

Term plans are presented by storefront: OSAP, scholarships and co-op pay in Canada (en and fr-CA), financial aid refunds in the US, maintenance loans in the UK. The app ships in every English-language storefront because Canada alone is too small for search-driven growth (see `GROWTH_PLAN.md` section 5).

The app needs no account and no bank connection. Budget data lives on the phone. Paying users can add an account to sync their budget and use it on the web (3.7).

## Decision: bank linking (November 15, 2026)

**Keep the Plaid code in `main`, behind a server-side `PLAID_ENABLED` flag that stays OFF. Don't delete it.** This came out of a for/against debate plus an independent review. The reasoning, so it doesn't get relitigated:

- Canada's Consumer-Driven Banking Act doesn't currently put anything on Current. Fintech participation is opt-in, the draft regulations (Canada Gazette Part I, June 27 2026) don't address apps that get data through an aggregator like Plaid, and nothing has a go-live date. The Bank of Canada's draft accreditation guidelines (Nov 2 2026) are open for comment until Dec 8. If accreditation ever applied, it would mean a $2,500 application fee, at least $10,000 a year, insurance and a yearly independent security assessment.
- Removing Plaid doesn't remove the privacy obligations for anything held on a server. Plaid access tokens don't work without the client ID and secret, so Plaid's extra risk is a full server compromise rather than a leaked database row.
- The real blocker is reliability. Canadian Plaid links break: Monarch lists an RBC issue open since September 2025 and TD problems. Current has no re-link flow, so a broken link would give confidently wrong STS numbers.
- Trust surveys conflict (Environics 2024: 27% likely to share data with a Canadian fintech; Mastercard 2021: 86% of Gen Z link accounts, but that sample mixes Canada and the US). Only our own beta could say whether students want linking.

**Turn the flag on (as a Plus feature) only when all three hold:** a re-link flow has shipped, RBC and TD links are verified working in production, and a beta on Plaid's free Trial plan (10 production connections) shows linked users retain better than manual users. **Remove Plaid permanently** if the final rules or Bank of Canada guidance require aggregator-fed apps to be accredited, or if Plaid's production pricing makes Plus unprofitable.

**Status under the November 16 storage decision:** free users have no account and Plus accounts only arrive with 3.7, so the Plaid beta is parked for this whole roadmap. Its spec is kept under "Later".

**Watch:** the outcome of the Dec 8 accreditation consultation, final Canada Gazette Part II publication of the regulations (targeted late 2026 or early 2027), and Plaid's production pricing.

## Decision: storage and platform (November 16, 2026)

**iOS first. Free is local-only, with no account. Plus is bought through Apple In-App Purchase and unlocks the paid features on the device at launch. Shortly after launch (item 3.7), Plus also adds an optional account with cloud sync and web access, so paying users can use Current in a browser.** Augustine confirmed on November 16, 2026 that web access for paying users is a committed feature, not a conditional one.

- App Store search is the only acquisition channel that works without marketing, so the iOS app comes first, not last.
- All budget data lives on the device in expo-sqlite. It is included in iPhone and iCloud device backups, and CSV export is free.
- For free users, and for Plus users who never turn sync on, Current holds no financial records on a server, which removes most breach exposure and makes selling outside Canada practical.
- AI runs on Apple's on-device model wherever the iPhone supports it, so nothing leaves the phone. On iPhones that can't run it, AI features fall back to a stateless cloud proxy after a one-time disclosure; the proxy receives the question and the figures needed to answer it and stores nothing (see 2.9). Copy says "your budget lives on your phone", never "nothing ever leaves it".
- The web app and the API are frozen until item 3.7, which rewires them as a signed-in companion for Plus users. Until then the Next.js project hosts only the public calculators (3.4) and the legal pages, the Cloud Run API runs only the AI fallback proxy (2.9), and Postgres can stay off.
- The web never sells anything. A Plus user creates their account inside the app, and the web only signs them in and checks that Plus is active. That keeps Stripe out of the project and keeps the app clear of Apple's payment rules.
- Once a Plus user turns sync on, their budget is stored on the server, so the privacy obligations for held financial data (PIPEDA breach reporting and records) apply to those users. Free users are unaffected, and the copy must make the difference plain.
- The cost: referral credits and lifecycle email still have no account to attach to for free users, and a free user who loses a phone without a backup loses data.

## Rules (locked decisions, ask before changing)

- `app/packages/core` is pure: no database, network, file or clock access. Every function takes plain data and `now` as arguments and returns a result. This is how Command-Query Separation is kept: calculating STS can never write anything.
- Money is integer cents everywhere in `core` and in the local database. No floats.
- Amount sign convention matches Plaid (positive = money out), so logic stays uniform if imports or bank sync ever arrive.
- Analytics never receives amounts, merchant names, notes or account names.
- AI is on-device first. The cloud fallback is used only when the on-device model is unavailable, and only after the user has seen the one-time disclosure and left the "Cloud AI" setting on.
- The AI proxy stores nothing, logs no request bodies, and holds the LLM key server-side. The key is never shipped in the app.
- AI answers only about the user's own budget. It declines advice on investments, loans, taxes and credit.
- Purchases use Apple IAP only. No external purchase links and no mention of web pricing inside the app.
- The LLM never does arithmetic. Code computes; the model only parses text or writes an explanation from numbers it is given.
- No feature work in `app/web` or `app/api` unless an item names it.
- For the frozen server code: Plaid `access_token` stays server-side; URLs and API params use internal Postgres IDs, never Plaid `account_id`; bank linking stays behind `PLAID_ENABLED` (default `false`); REST, not GraphQL.
- Savings goals use the virtual priority allocation engine, not per-account linking.
- Next.js here is a newer version with breaking changes: read `node_modules/next/dist/docs/` before writing web code (see `app/web/AGENTS.md`).
- When restyling, change markup and styles only, never TypeScript structure, export names or signatures.

---

## Phase 0: foundation (M0, Nov 16 to Dec 20, 2026)

- [x] **0.4 Repo hygiene.** `env.txt` sits in the repo root but `.gitignore` only covers `node_modules` and `.env`, so one `git add .` would push secrets. Add `env.txt`, `*.env*` and `.DS_Store` to `.gitignore`, and remove the two tracked `.DS_Store` files from git.
- [x] **0.7 Copy and legal.** Rewrite the privacy policy and T&Cs for a local-only app: no account, no bank connection, budget data on the device, AI on the device where supported and otherwise through a cloud service that stores nothing, anonymous analytics. Use "No account. No bank login." and "Your budget lives on your phone". Remove "recalculates in real time with every transaction" from the README, and remove "Bank-grade encryption" from the email footer in `app/api/src/lib/email.ts` (line 157). Confirm with Augustine: the CAD $50 liability cap is weak for Ontario consumers and the app will now be sold in other countries, so get it reviewed before launch. If that review isn't affordable, launch without the EU storefronts first.
- [x] **0.8 Build `app/packages/core`.** A TypeScript package with a test runner (vitest unless the repo setup argues otherwise), written test-first, using `safe-to-spend.ts`, `bills.ts`, `savings.ts` and `STS-steps.MD` as the behavioural reference. Contents:
  - `money`: integer-cent helpers and formatting by locale and currency.
  - `income`: `getNextPaymentDate(income, now): Date | null`, rolling forward by frequency in memory. `setMonth` on the 29th to 31st must clamp to the month's last day.
  - `period`: `getCurrentPeriod(settings, incomes, termPlans, now) -> {start, end}` for `monthly`, `paycheque` and `term` (details in 1.4).
  - `bills`: next occurrence by frequency (same clamping), and `status: "overdue" | "upcoming"`.
  - `goals`: the priority allocation engine, including the above-STS and below-STS split and per-period contribution.
  - `termPlan`: `reserve = amount * daysRemaining / totalDays`.
  - `sts`: `calculateSafeToSpend(input, now)` returning the total, the breakdown, `availableAfter {amount, date}`, and `{perDay, daysLeft, periodEnd}`. "Available after" must trigger on every path where STS is 0, which the old code does not do.
  - `categorize`: `suggestCategory(history, text)` (details in 1.2).
  - `reconcile`: savings reconciliation against savings balances.
  - Done when: `core` has no database or network import; there is a test for every rule in `STS-steps.MD`; and with one $4,000 term plan from Jan 6 to Apr 30 and nothing else, STS on day 1 is about $35 and grows by about $35 a day.

Superseded, do not build: **0.1** (STS writes to the DB) and the month-end clamp are satisfied by 0.8. **0.2** (`commitSafeToSpendAllocations` never called), **0.3** on the API, **0.5** (Stripe and `requirePlus`) and **0.6** (`PLAID_ENABLED` plumbing in the web app) are not needed, because the old server routes and web pages are not shipped in their current form.

## Phase 1: the free iOS app (M1, Jan 4 to Feb 28, 2027)

An Expo app in `app/mobile`, local-only on expo-sqlite, calling `core` for every calculation. The existing web pages are the reference for what each screen contains; the look comes from `app/mobile/DESIGN.md` once 1.0b is done. iOS builds go through Expo's cloud build service because the dev machine is Windows; testing needs a physical iPhone and an Apple Developer membership. Done when the app is on TestFlight and Augustine has used it daily for two weeks without touching the web app.

- [x] **1.0 App shell and local data.** Expo project, navigation, design tokens from `app/web/DESIGN.MD`, and local tables for accounts, transactions, bills, income, goals, term plans, categories and settings, with client-generated UUIDs, `updatedAt` on every row and deletes recorded as `deletedAt`, so a sync engine can be added later without a migration.
- [x] **1.0b Playful redesign (confirm with Augustine).** Done November 16, 2026: Augustine chose "Sticker Book" with an ink edge on every sticker and card as the change that separates it from DaTrack, and three tabs (Home, Activity, Plan) plus a separate + button. See `app/mobile/DESIGN.md`. Added November 16, 2026. The current look (dark navy, one blue, type only, "calm") reads as formal next to the budgeting apps students actually choose, and it won't carry the App Store screenshots that search growth depends on. Do this before 1.1 so every later screen is built once, in the new style.
  Step 1, pick a direction: mock three clearly different directions side by side on one page, each showing the same four screens (home with the daily number, add transaction, bills list, an empty state) plus the app icon and the first App Store screenshot. Look at the current top budgeting apps in the Canadian Finance chart first and say what each direction borrows and where it differs. Augustine picks one or mixes them. No app code before he picks.
  Step 2, write the system: `app/mobile/DESIGN.md` becomes the source of truth for the app. `app/web/DESIGN.MD` stays only as the record of the frozen web pages. Replace the tokens in `app/mobile/src/global.css` and restyle the 1.0 shell (`components/screen.tsx`, the five tab screens, the tab bar colours in `_layout.tsx`).
  Whichever direction wins must have:
  - Light and dark versions that follow the system setting. Dark-only is dropped.
  - Colour that carries meaning: a category colour set of about 12 (used by 1.2) and distinct colours for comfortable, tight and over. The six-colour limit and "gold only for savings" are dropped.
  - A display typeface with character for the number and headings and a plain legible face for body text, with tabular figures for money.
  - Personality in three places: category badges, empty states, and the daily number, whose colour and one line of copy change with its state (comfortable, tight, zero).
  - Motion and haptics: the number counts to its new value, and logging a transaction or paying a bill gives a small confirmation. Honour Reduce Motion.
  - A voice: short, casual, second person. Never a joke about being short of money and never guilt.
  - A matching app icon and splash screen.
  Limits: Safe-to-Spend stays the largest thing on the home screen. A stale or failed number is shown plainly, never decorated. Text meets WCAG AA contrast in both modes and scales with Dynamic Type. Use only emoji, SF Symbols and shapes drawn in code, nothing that needs a commissioned illustrator or a paid asset. No streaks, points or other game mechanics; those are features, and go in "Later" if wanted. Markup and styles only, per the Rules.
  Done when: Augustine has approved the direction, `app/mobile/DESIGN.md` exists, the 1.0 shell uses only its tokens in light and dark, and type checks and lint pass.
- [ ] **1.1 Manual accounts and transactions.** Accounts are `chequing | savings | cash` with a balance. Adding, editing or deleting a transaction adjusts its account balance in the same local database transaction.
  Onboarding: under 60 seconds, no signup. Starting balance, next income (amount, frequency, date), then bills. The first screen after it shows the Safe-to-Spend number.
  Balance check-ins: manual balances drift, so the user can enter the real balance; record `lastCheckInAt`, show the drift (entered minus calculated), and offer "Log the difference as Uncategorized" or "Just update my balance". STS shows "Balance last checked N days ago" when it's over 7 days. This is a launch requirement: a confident wrong number is the product's worst failure.
  Paid bills log themselves: marking a bill paid creates a transaction for the bill amount (today or a chosen date, bill name as merchant, the bill's category, the chosen account, default main chequing), links it to the bill and flags it `createdFromBill`. Marking the bill unpaid deletes that transaction only if the flag is set. Recurring bills create their next occurrence. The UI says "Logged $X from Rent" with undo.
- [ ] **1.2 Categories.** About 12 defaults, each with `name, emoji, color, kind: needs | wants | savings | income, sortOrder`, editable by the user. Category suggestions with no AI: `suggestCategory` normalizes the text (lowercase, strip amounts, dates and punctuation), looks at the last 6 months of the user's transactions whose merchant matches, and returns the most-used category with a confidence equal to its share of matches, or nothing with fewer than 3 matches. New users are seeded from a small built-in merchant list per storefront (Tim Hortons, Presto and Loblaws in Canada, and equivalents for the US and UK). The add-transaction form pre-fills the suggestion.
- [ ] **1.4 Budget by paycheque or by term.** A `budgetPeriod: "monthly" | "paycheque" | "term"` setting, defaulting to `paycheque` when an income with a next date exists, otherwise `monthly`. Monthly is the calendar month, paycheque runs from the last income date to the next, term uses the active term plan's dates. STS's bill cutoff is `max(periodEnd, now + 7 days)`, overdue unpaid bills always count, and the minimum-spend floor is prorated to the period length. Update `decisions.MD` with this rule when it ships.
- [ ] **1.5 Daily Safe-to-Spend.** `perDay = safeToSpend / max(1, daysLeft)`. "$23/day until Friday" is the home screen headline with the total underneath and a "how it's calculated" breakdown.
- [ ] **1.6 Term plans.** `termPlan {name, amount, startDate, endDate, isActive}`, e.g. "Winter OSAP, $4,000, Jan 6 to Apr 30". STS subtracts the straight-line reserve for future weeks. A card shows "$X released so far, $Y/week, lasts until Apr 30". The preset label on the create screen follows the storefront (OSAP, financial aid refund, maintenance loan). Free users get one active term plan.
- [ ] **1.7 Reminders (local notifications).** Bill due in 3 days, a Sunday summary (spent vs last week, top 3 categories, current daily STS), and "check your balance" when the last check-in is over 7 days old. Separate toggles for each, and never more than one notification a day. No email.
- [ ] **1.8 Current-period summary.** Spending by category for the current period and a one-line like-for-like comparison ("12% less than this point last paycheque": day 10 compared to day 10). History and charts beyond the current period are Plus (2.8).
- [ ] **1.9 Bills, goals and export.** Bills list with overdue first. Savings goals with priority reorder and manual allocate, two goals on Free. CSV export of all transactions, plus a monthly "back up now" prompt and clear copy that data is included in iCloud device backups.

## Phase 2: Plus and launch (M2, Mar 1 to Apr 15, 2027)

Done when the app is live in all English-language storefronts and the first paying user arrives by April 30, 2027.

This phase is full for six weeks that include April exams. If it runs late, do not move the launch date. Slip items to the first releases after launch in this order: 2.5 import, 2.12 rollover budgets, 2.11 themes, 2.10 weekly recap. Everything else is needed for launch.

- [ ] **2.0 Purchases and paywall.** Apple IAP through RevenueCat (check its current free-tier limit before integrating). Products: Plus monthly $4.99 CAD, Plus annual $29.99 CAD with a 7-day free trial. No lifetime product. Set Canada as the base price and let Apple's price tiers generate the other storefronts. Enrol in the App Store Small Business Program before the first sale. The trial is offered once, at activation (after the fifth logged transaction or the first term plan), not at first launch. The paywall lists the AI features on every iPhone, since the cloud fallback makes them work everywhere.
- [ ] **2.1 Quick add in plain English (Plus).** "coffee 4.50" or "uber home last night 18" becomes `{amount, date, merchantName, categoryId, confidence}`, history first and model second. Step 1, in code: a regex pass pulls out the amount and simple dates ("today", "yesterday", "last night", weekdays), and `suggestCategory` picks the category. If that finds an amount and confidence is at least 0.7, use it with no model call. Step 2, only otherwise: the AI layer (2.9) parses the text with structured output, given the user's category list. Count which path answered (`history | on-device | cloud`). The app shows the parsed result for one-tap confirm and never saves without it.
- [ ] **2.2 "Can I afford this?" (Plus).** `core` computes the answer: does the amount fit today's STS, or after the next paycheque or term release, and what does it do to `perDay`. Result: `{verdict: "yes" | "tight" | "wait", newPerDay, waitUntil?}`. The AI layer (2.9) is given only those numbers and writes a one-paragraph explanation. The verdict works without the explanation.
- [ ] **2.3 Category budgets with Needs/Wants (Plus).** A limit per category per budget period, a Needs/Wants split, and left/over per category. Limits are guidance only and don't feed into STS (bills and goals are already counted, so this would double count). Local notifications and a banner when a category crosses 90% ("$12 left in Food until Friday") and 100% ("$8 over"), once per threshold per period.
- [ ] **2.4 Spend or withdraw from a savings goal (Plus).** Works like allocate but decreases `amountSaved` (floor 0) and can link the purchase it paid for. Reconciliation reflects it automatically. Also unlocks unlimited goals and unlimited term plans.
- [ ] **2.5 Import (Plus).** CSV, and OFX/QFX where offered, from TD, RBC, Scotiabank, BMO and CIBC first, detected by header row or file type, parsed on the device. Skip any row that matches an existing transaction on date, amount and merchant.
- [ ] **2.6 French (fr-CA), free.** App strings and the fr-CA App Store listing. No web or email translation.
- [ ] **2.7 App Store listing and review prompt.** Keyword-led title and subtitle per storefront: student budget, OSAP and paycheque budget in Canada; financial aid refund, student loan budget and paycheck budget in the US; maintenance loan and student budget in the UK. "No account. No bank login." in the first screenshot. In-app review prompt after the 10th logged transaction, never during onboarding or right after a paywall.
- [ ] **2.8 Insights (Plus).** Spending by category, week and day for any range, like-for-like comparison by category, an 8-week bar chart and a month calendar coloured by daily spend where tapping a day filters the list.
- [ ] **2.9 AI layer: on-device first, cloud fallback.** One module in the app, `ai`, with one interface and two backends. Build this before 2.1, 2.2, 2.10 and 2.13.
  On-device: Apple's Foundation Models framework through a community React Native package (Callstack's `@react-native-ai/apple` is the first candidate; check that it is maintained and supports the current iOS before committing, and wrap it so it can be swapped). It needs iOS 26 or later and an Apple Intelligence-capable iPhone with Apple Intelligence turned on. Confirm the supported device list and languages in Apple's documentation at build time, including whether fr-CA is supported.
  Cloud fallback: a small stateless proxy on the existing Express API (`POST /ai/parse`, `/ai/explain`, `/ai/ask`, `/ai/recap`) that calls Claude Haiku with structured output. It checks the caller's Plus entitlement through RevenueCat, rate-limits per install, stores nothing and logs no bodies.
  Selection: at runtime, use on-device when available. Otherwise use the cloud, after a one-time screen that says "This iPhone can't run AI on the device. AI features will send your question and the figures needed to answer it to our server. Nothing is stored." with a "Cloud AI" toggle in settings. With the toggle off, AI features are hidden and quick add still works from history.
  The model is small (context reported at 4,000 to 8,000 tokens), so it is never given transaction history. It gets a short instruction, the user's text, and numbers computed by `core`.
  Quality: keep a fixed set of about 50 test inputs with expected results. Run it against both backends before each release and after every major iOS update, because Apple changes the model with the OS.
  Analytics records which backend answered and whether it failed, never the content.
- [ ] **2.10 Weekly recap (Plus).** On Sunday, `core` computes the week's figures (spent vs last week, top categories, biggest change, daily number now) and the AI layer writes three or four sentences from them. Shown in the app, with the free Sunday notification (1.7) linking to it for Plus users. If no model is available it shows the figures without the prose.
- [ ] **2.11 Themes and app icons (Plus).** A handful of colour themes built on the 1.0b design tokens and four to six alternate app icons. Cosmetic only.
- [ ] **2.12 Rollover budgets (Plus).** A per-category toggle on 2.3: unused budget carries into the next period, and overspending reduces it, computed in `core`. Off by default.
- [ ] **2.13 Ask Current (Plus).** A chat screen bounded to the user's own budget. The model never does math and never sees raw history: it chooses from a fixed set of tools that `core` answers (spending by category and range, Safe-to-Spend and the daily number, upcoming bills, goal progress, how long term money lasts, and the 2.2 afford check), then writes the reply from the returned numbers. Three or four suggested questions sit above the keyboard. It declines anything outside the budget, per the Rules. Each answer shows the figures it used, so a wrong sentence can be checked against the numbers. Conversations are kept on the device only and are not synced.

## Phase 3: search and seasons (M3 and M4, Apr 16 to Oct 31, 2027)

- [ ] **3.1 Release rhythm.** A release at least every three weeks, and one title or subtitle keyword test per month, recorded in a short log at the bottom of this file with installs before and after.
- [ ] **3.2 US and UK presets and listings.** Storefront-specific term-plan presets, merchant seeds and listings, plus locale-aware currency formatting checked end to end.
- [ ] **3.4 Free web calculators.** Three public, no-login pages on the existing Next.js project, running `core`: an OSAP term budget calculator, a US financial aid refund calculator and a UK maintenance loan calculator. Each ends in an App Store link and has an "Embed this calculator" snippet (an iframe with a "Powered by Current" link).
- [ ] **3.7 Plus account, cloud sync and web access.** Committed, and the main build of M3 (May to July 2027). Target: live before the August 15 freeze. If it is not stable by then, hold it until October rather than ship it into back to school.
  Account: created inside the app by a Plus user (Better Auth, email and password, reusing the existing verification and reset emails). Optional even for Plus: a subscriber who never turns sync on stays local-only.
  Sync: every local row already has a client-generated UUID, `updatedAt` and `deletedAt` (1.0). Add `POST /api/sync/push` and `GET /api/sync/pull?since=` on the existing Express API, storing rows per user in new Postgres tables that mirror the local ones, with last-write-wins on `updatedAt` and tombstones for deletes. The server stores and returns rows and does no budget math.
  Entitlement: the API checks that Plus is active through RevenueCat's server API before accepting a push or serving a pull. When Plus lapses, the phone keeps all its data and works as Free; the server copy becomes read-only for 30 days and is then deleted, and the user is told this before it happens.
  Web: rewire the existing pages (dashboard, transactions, bills, savings, accounts, settings) to load synced rows and run `core` in the browser, exactly as the phone does. Remove the Plaid onboarding and link screens from the signed-in flow. The web has a login page and no signup, no pricing and no purchase; a visitor without Plus is sent to the App Store.
  Restyle the rewired pages to the 1.0b design system (`app/mobile/DESIGN.md`) so the web and the phone look like one product.
  The web has no AI features in this item; they stay on the phone.
  The old server-side `calculateSafeToSpend` and the Plaid-era tables are not used by any of this and stay frozen.
  Before it ships: add a "Cloud sync" section to the privacy policy, add account and server-data deletion in the app (Apple requires in-app account deletion), and turn Postgres backups on.
  Done when: a Plus user logs a transaction on the phone and sees the same Safe-to-Spend number on the web within a few seconds, and an edit made on the web appears on the phone.
- [ ] **3.5 Late-August offer.** An Apple introductory or promotional offer on the annual plan for the last two weeks of August and the first two of January.
- [ ] **3.3 Daily STS home-screen widget (Plus).** Only after the app is stable, in M4. It needs a native Swift target, so expect slow debugging without a Mac.
- [ ] **3.6 Freeze for back to school.** From August 15 to September 30, ship fixes only.

## Phase 4: second act (M5, Nov 1, 2027 to Feb 28, 2028), choose one

Pick exactly one, using the October 31, 2027 checkpoint. (The former 4.a, sync and web access, is now committed as 3.7.)

- [ ] **4.b More listing languages.** If installs are the constraint: four more App Store listing and app-string languages. This overrides the English and French limit in "Not doing".
- [ ] **4.c "Student deals" screen.** If installs are healthy but conversion is not, and the app has passed 5,000 installs: one clearly labelled affiliate screen for student bank accounts and similar, joined through a self-serve affiliate network. No tracking of what users do in the app.

## Growth track (hands-off, with one accepted exception)

Augustine won't do outreach, posting, workshops or campus promotion. Growth comes from App Store search first, then the calculators and the share card. The one number that matters is **activated installs**: entered a balance and logged at least 5 transactions, or set up a bill or a term plan, within 7 days of install. Track week-4 retention, install-to-trial and install-to-paid next to it.

- [ ] **G.1 Measure first.** Anonymous product analytics (PostHog or similar) with a random install ID and no session recording. Events: install, first balance, first transaction, first bill, first term plan, activation, weekly active, paywall shown, trial started, purchase, share card exported. Never send amounts, merchant names, notes or account names. Build alongside Phase 1.
- [ ] **G.2 Feedback and day-7 survey.** An in-app feedback button that opens a pre-filled email to Augustine with the page and app version. On day 7, a 3-question in-app survey: what almost made you quit, what you'd pay for, what to fix first. Answers go to analytics as free text only if the user taps send.
- [ ] **G.4 Shareable term plan card.** An exportable image like "My winter OSAP lasts until April 30: $245/week", showing only the numbers the user chooses, with a small Current line and an App Store link. Opt-in, nothing posted automatically. Build in M3.
- [ ] **G.8 Apple Search Ads keyword test (optional, one-time).** Augustine can't run ads before January 2027, which doesn't affect this: there is nothing to advertise until the app is live in April 2027, and the test is planned for back to school. About $300 in late August 2027 on exact-match student keywords, with an automated rule that pauses at $3 per install. The purpose is to learn which keywords produce activated installs and then put those words in the title. It is not a growth channel: an install is worth about $0.46 in the base case.
- [ ] **G.10 Calculator outreach (accepted exception, one-time).** Accepted by Augustine on November 16, 2026. After 3.4 is live: one session of about two hours in which Claude drafts and Augustine approves about 25 emails to university financial aid offices, student unions and student newspapers, offering the free embeddable calculator for their money-resources pages. No follow-up, no posting, no ongoing relationship. This is the only approved outreach.

Removed from this roadmap: G.3 referral credits, G.5 lifecycle emails, G.6 campus reps. They need accounts, and only Plus users will have them. Removed outright: G.9 launch listings. G.7 embeds are merged into 3.4.

## Free vs Plus

| Free | Plus |
|---|---|
| Manual accounts and transactions | AI quick add |
| Balance check-ins | "Can I afford this?" |
| Safe-to-Spend + daily number | Ask Current (AI chat about your own budget) |
| Sunday summary notification | Weekly AI recap |
| | Category budgets, Needs/Wants, 90% and 100% alerts, rollover |
| Bills with reminders | Insights and comparisons beyond the current period |
| One term plan | Unlimited term plans |
| Two savings goals | Unlimited goals, spend/withdraw from goals |
| Categories with suggestions from history | CSV/OFX import |
| Current-period spending summary | Home-screen widget |
| CSV export, French | Themes and app icons |
| | Account, cloud sync and web access (from 3.7) |

AI features run on the phone where Apple's on-device model is available and through the cloud fallback elsewhere (2.9).

**Pricing:** $4.99 a month, $29.99 a year with a 7-day free trial. No lifetime option (dropped by Augustine on November 16, 2026, since Plus now includes cloud sync with an ongoing cost). No separate student price: the base price is the student price, and seasonal offers (3.5) do the rest. For reference, DaTrack charges $6.99 a month, $39.99 a year and $99.99 to $129.99 lifetime in Canada.

## Not doing (scope guard)

Before 3.7: accounts, cloud sync, and any feature work in the web app or the API other than the 2.9 AI proxy.

On this whole roadmap: lifetime pricing, Stripe or any purchase on the web, web signup, accounts for free users, a web-only feature the phone doesn't have, referral credits, lifecycle email, campus reps, launch listings (Product Hunt, Hacker News, BetaList) and the Plaid beta.

At any point: receipt scanning, AI chat beyond the bounded Ask Current in 2.13 (no general assistant, no financial advice), AI features on the web, languages beyond English and French (unless 4.b is chosen), investments or net worth, credit scores, couples or shared budgets and roommate splitting, a separate student price with verification, Shortcuts integration, an Android app (fallback only, if Apple becomes a problem), licensing to universities or credit unions.

If an idea isn't on this page, it goes in the "Later" list at the bottom of this file instead of into code.

## Checkpoints

| Milestone | Dates | Proof it worked |
|---|---|---|
| M0 Foundation | Nov 16 to Dec 20, 2026 | `core` is pure and has a test for every rule in `STS-steps.MD`. |
| M1 Free app | Jan 4 to Feb 28, 2027 | On TestFlight by Feb 28; used daily for two weeks. |
| M2 Plus and launch | Mar 1 to Apr 15, 2027 | First paying user by Apr 30, 2027. Activation of at least 30% of installs. |
| M3 Search engine | Apr 16 to Jul 31, 2027 | Running costs (about $40 a month before sync, about $75 after) covered by July. At least 300 installs a month by July. Week-4 retention of at least 15%. Install-to-trial of at least 5%. Sync and web access (3.7) live for Plus before Aug 15. |
| M4 Back to school | Aug 1 to Oct 31, 2027 | At least 1,000 installs a month in September. Install-to-paid of at least 1.5%. At least 100 ratings at 4.5 or better. Net revenue of at least $250 a month. |
| M5 Second act | Nov 1, 2027 to Feb 28, 2028 | Net revenue of at least $600 a month by end of February 2028. |
| M6 Verdict | Mar 1 to May 31, 2028 | About $900 a month net by May 2028 (base case without a lifetime option), on course for $1,000 by mid-2028. |

Kill and pivot criteria:

- **June 30, 2027.** If activation is under 20% or week-4 retention under 10%, stop all growth and feature work and rebuild onboarding and the logging loop until they clear the bar.
- **October 31, 2027.** If installs are under 500 a month after back to school, pivot the listing, not the app: lead with "daily spending number" and "paycheque budget" for a general young-adult audience, keep term plans as a feature, and choose 4.b. If installs are fine but install-to-paid is under 1%, move the trial offer to the end of onboarding and move the second savings goal behind Plus.
- **February 28, 2028.** If net revenue is under $250 a month, stop building. Keeping the app in the store with sync and the AI fallback running costs about $75 a month, so leave it running only while Plus revenue covers that; otherwise give Plus users 60 days' notice, switch sync off and keep the local-only app live for about $15 a month.
- **Any time.** If no commit lands for 30 days outside exam periods, cut the current milestone's remaining scope in half instead of extending its date.

## Later

- **Plaid opt-in beta (parked).** Needs accounts and sync (3.7) first, and would be for Plus accounts only. Then, before the flag can go on: a re-link flow (read `needsReAuth`, open Plaid Link in update mode, and make STS show "Bank connection needs attention" instead of a number while any linked account is stale); a visible "Disconnect bank" button that calls `/item/remove` and deletes that bank's accounts, transactions and tokens; data minimization (Transactions product only, a retention window, nothing stored that STS doesn't use); plain consent copy ("Optional. Read-only. We never see your password."); and a Plaid section in the privacy policy. Beta on Plaid's Trial plan (10 production connections, no support, and removing a connection doesn't free its slot), comparing 30-day retention of linked vs manual users and verifying RBC and TD in production.
- **Web-app manual mode.** The original 1.1 schema work (`plaidTransactionId` optional, `source` enum, `isManual` accounts, `Transaction.accountId` referencing `bankAccounts.id`) is not needed: 3.7 stores synced rows in new tables and leaves the Plaid-era tables alone.
- **Plus feature candidates, to be picked by what the day-7 survey says people would pay for:** a subscriptions view (detects repeating charges and shows the yearly cost), a what-if planner ("what if I work 10 hours a week", shown as a change to the daily number), a payday plan (proposes how to split a paycheque across bills, goals and spending, confirmed in one tap), and a student loan tracker (what you'll owe at graduation, from numbers the user enters, with careful wording).
- **Email reminders and weekly summary** through Resend, with a `notificationLog` for idempotency and CASL consent for anything promotional. Only with accounts.

## Keyword test log

| Date | Storefront | Change | Installs before (30 days) | Installs after (30 days) |
|---|---|---|---|---|
