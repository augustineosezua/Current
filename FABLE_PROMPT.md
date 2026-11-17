# Prompt for Claude Fable: make Current a financial success

You are acting as a combined product strategist, fintech business analyst and senior engineer for **Current**, a budgeting app built by Augustine, a solo developer and Computing student at Queen's University in Ontario, under his studio Chicken Labs. Your job is to read the real state of the project and the vision below, check the facts that matter, and produce **the best realistic plan for turning Current into a financial success**. Be honest even if the honest answer is uncomfortable: if the current direction can't make meaningful money, say so and say what would.

Today's date is whatever your environment reports. This brief was written on **November 16, 2026**. Anything marked "as of Nov 2026" may have changed, so re-check it before relying on it.

---

## 1. Read the project first

If you have access to the repository (you're running in Claude Code from the repo root, or the files are attached), read these before anything else, in this order:

1. `ROADMAP.md`: the current plan and the source of truth for decisions. It includes the bank-linking decision, locked rules, Phases 0 to 3, the hands-off growth track (G.1 to G.9), Free vs Plus, and the scope guard.
2. `decisions.MD` and `STS-steps.MD`: architecture decisions and Safe-to-Spend implementation notes.
3. `README.md`.
4. `app/api/prisma/schema.prisma`: the data model.
5. `app/api/src/lib/safe-to-spend.ts`, `lib/savings.ts`, `lib/bills.ts`: the core logic.
6. `app/api/src/plaid/*.ts`: all API routes live here, not in `server.ts`.
7. `app/web/app/*/page.tsx`: the web pages (dashboard, transactions, bills, savings, accounts, settings, onboarding).
8. `git log -10`: check whether anything has been committed since `b16ce03` (May 8, 2026). If it has, your plan must reflect the newer state, and you should say what changed.

Never read or print secrets: skip `.env`, `env.txt` and anything that looks like credentials.

If you have **no** repository access, work from the brief in sections 2 to 5 and say clearly at the top of your output that you couldn't inspect the code.

---

## 2. Where the product actually is (verified Nov 15 to 16, 2026)

- **Stack:** Node.js + Express API, Next.js (a newer version with breaking changes; see `app/web/AGENTS.md`), Tailwind v4 + shadcn/Radix, PostgreSQL + Prisma, Better Auth (cookie-based, email verification and password reset through Resend), and Plaid (Canada, sandbox only). A React Native + Expo mobile app is planned but not started. REST only.
- **Code state:** `main` is at `b16ce03` ("fix: fallback to current balance", May 8, 2026), and the local copy is identical, so nothing newer is sitting unpushed. Augustine describes the web version as "beta complete".
- **Built:**
  - Auth.
  - Plaid link, token exchange, webhook sync with a cursor, manual sync.
  - **Safe-to-Spend (STS):** chequing balances + expected income − unpaid bills due this month (or within 7 days) − scheduled savings − committed goals − a minimum-spend floor, plus an "available after next paycheque" figure.
  - Income sources with frequencies.
  - Bills with transaction matching.
  - Savings goals with priority reorder, manual allocation, and reconciliation against real savings balances.
  - Soft-deleting users with reactivation.
  - Paginated transactions.
  - All main web pages.
  - Draft T&Cs and privacy policy (PIPEDA-oriented, Ontario law, liability capped at CAD $50).
- **Not built:**
  - Any way to use the app without Plaid. Every transaction requires a Plaid ID, and STS errors when there are no linked accounts.
  - Categories or category budgets.
  - Charts.
  - Scheduled notifications.
  - Stripe billing.
  - A production domain.
  - The mobile app.
  - Analytics.
- **Known defects:**
  - Calculating STS writes to the database by rolling income dates forward, which breaks the project's command-query separation rule.
  - `commitSafeToSpendAllocations` is never called.
  - `needsReAuth` is set by the webhook but never read, so a broken bank link would silently produce stale STS numbers.
  - `env.txt` sits in the repo root and isn't in `.gitignore`.
- **Users and revenue:** none. Not launched.

## 3. The vision and decisions so far

Everything here was decided in a planning session on Nov 15 to 16, 2026, and is written into `ROADMAP.md`. You may challenge any of it, but say explicitly when you're recommending a reversal and why.

- **Positioning:** a budgeting app for Canadian university students and young adults. It wins on what generic trackers can't do:
  - One **Safe-to-Spend** number that already knows your bills and goals, plus a **daily** version ("$23/day until Friday").
  - Budgeting **by paycheque or by school term**.
  - **Term plans** that spread lump-sum student money (OSAP, scholarships, co-op pay) over the weeks it has to last.
  - French support.
  - "No bank login required."
- **Bank linking decision:** launch **manual-first**. The Plaid code stays in `main` behind a server flag `PLAID_ENABLED` that ships off. It may become an opt-in Plus feature only if all three hold: a re-link flow has shipped, RBC and TD connections are verified in production, and a beta on Plaid's free Trial plan shows linked users retain better. Remove it permanently if Canadian open banking rules end up requiring aggregator-fed apps to be accredited, or if Plaid pricing makes Plus unprofitable. This came from a structured for/against debate with an independent decider.
- **Roadmap shape:**
  - **Phase 0:** fixes, a Stripe/plan system, the Plaid flag, launch copy.
  - **Phase 1 (free core):**
    - Manual accounts and transactions, with balance check-ins and paid bills logging their own transaction.
    - Categories, with suggestions from the user's own history (no AI).
    - Category budgets with a Needs/Wants split and warnings at 90% and 100%.
    - Paycheque or term budget periods.
    - Daily STS and term plans.
    - Reminders and a weekly summary.
    - Insights, including like-for-like period comparison.
  - **Phase 2 (Plus):**
    - Quick add in plain English: history first, LLM only as a fallback, run server-side.
    - "Can I afford this?" (the math is done in code; the LLM only explains it).
    - The Plaid beta behind the flag.
    - Spend or withdraw from savings goals.
    - CSV/OFX import.
    - French.
  - **Phase 3:**
    - An Expo iOS app with offline logging.
    - The App Store listing and a review prompt.
    - A daily STS widget.
    - Free public web tools such as an OSAP budget calculator.
- **Free vs Plus (current draft):**
  - **Free:** manual tracking, STS and the daily number, categories and budgets, term plans, savings goals, reminders, insights, CSV export, French.
  - **Plus:** AI quick add, "Can I afford this?", import, goal withdrawals, and bank sync if it's ever enabled.
  - Pricing hasn't been set.
- **Explicitly not doing:** receipt scanning, open-ended AI chat, languages beyond English and French, investments or net worth, credit scores, couples or roommate budgets, lifetime pricing, Shortcuts integration.
- **Open question you must resolve: local-only storage.** Augustine is considering making the free tier **local-only on iOS** (no account, data on the device, included in iPhone backups) and making Plus the thing that adds an **account, cloud sync and backup, and web access**. What's been worked out so far:
  - **Upside:**
    - No signup friction.
    - A stronger privacy pitch.
    - Almost no server-held data, and so less breach exposure, for free users.
    - Lower running costs.
    - A Plus that's easy to explain.
  - **Costs:**
    - The free product can't be the website, because browsers clear local storage (Safari wipes script-writable storage after about 7 days without a visit). So the free launch has to wait for the Expo app.
    - The core logic has to move into a shared TypeScript package that runs on both the phone and the server.
    - Plus needs a sync engine. The proposed design is client-generated IDs, last-write-wins on `updatedAt`, and records marked deleted rather than removed.
    - Email reminders, referrals and AI become Plus-only or become local notifications.
  - **Cheaper alternative:** silent anonymous accounts (Better Auth has an anonymous plugin). The data stays server-side, with no sync engine, but the "your data never leaves your phone" claim is lost.
  - **No decision has been made.**

## 4. Founder constraints (treat as hard unless the math proves the plan can't work without breaking one; then flag it explicitly)

- Augustine builds alone, with Claude Code doing much of the implementation. Plan for one developer.
- **He will not do marketing himself.** That rules out outreach, posting, workshops, campus promotion, interviews, press pitching, community participation and UGC or creator content, and there is **no waitlist**. Growth has to come from the product, automation, search (ASO/SEO and free web tools), and at most **optional one-time setups of about an hour each** (paid ads with automated caps and stop rules; one-time launch listings that Claude drafts).
- The current hands-off growth track: analytics with activation defined as "entered a balance plus at least 5 transactions or a bill or term plan in the first 7 days", an automatic open beta, a referral loop that rewards Plus months on activation, a shareable term-plan card, lifecycle emails (CASL-compliant consent), self-serve campus reps rewarded only in Plus credit, embeddable calculators, an optional capped paid test, and optional launch listings.
- Locked engineering rules from `ROADMAP.md` still apply (command-query separation for STS, internal IDs in URLs, Plaid tokens server-side, and so on) unless you argue for changing one.

## 5. Market facts gathered so far (as of Nov 15 to 16, 2026; verify the ones your plan depends on)

- **DaTrack ("Budget Planner: DaTrack", iOS only, solo developer Quoc Phan):**
  - Ranked **#10 in Canada's free Finance chart** with only 2 Canadian ratings. A third-party tracker shows about 179 ratings on another storefront.
  - Launched around March 2026 and updated about 25 times since.
  - Its whole pitch is "no bank login, no account, data on device (iCloud)".
  - **Free:** manual logging, calendar, reminders, CSV export.
  - **Pro:** AI one-sentence logging, receipt scanning, AI chat, charts, category budgets, Needs/Wants with a Needs cap, recurring bills, savings funds, CSV/Excel import, flexible pay periods.
  - **Canadian pricing:** $6.99/month, or $39.99/year with a 7-day trial; lifetime $129.99 (a $99.99 launch lifetime also existed). Another storefront showed $4.99 and $29.99.
  - Available in 8 languages.
  - It has repeatedly renamed its App Store title to test keywords ("DaTrack: Daily Expense Tracker" → "Daily Expense Tracker: DaTrack" → "Budget Planner: DaTrack"), and it shows a review prompt after 10 logged expenses.
  - Its growth appears to be almost entirely App Store search.
- **An earlier DaTrack codebase** is public at `github.com/quoc48/expense_tracker`:
  - Flutter + Supabase with required accounts. Last commit Dec 7, 2025.
  - Vietnamese categories; receipt OCR with Gemini and OpenAI; on-device category learning; offline queue; budget alerts at 70/90/100%; month-over-month analytics.
  - It shipped AI keys inside the client, and there's no license file.
  - Notably, the developer moved from accounts and cloud to no-account, on-device storage for the commercial version.
- **Market signals:**
  - Monarch reportedly passed $100M ARR and 1M+ members, and analysts describe connected accounts as its moat.
  - Monarch launched in Canada after Mint shut down, with limited Canadian bank coverage at first.
  - An ASO guide notes that the Finance category is dominated by banks and fintechs, with the indie opportunity in niche budgeting (students, couples, specific currencies).
- **Trust data (both weak for students):**
  - Environics, March 2024: 27% of Canadians are likely to share data with a Canadian fintech.
  - Mastercard/Harris, 2021, mixed Canada and US sample: 86% of Gen Z connect accounts to apps.
- **Canadian open banking:**
  - The Consumer-Driven Banking Act received Royal Assent on March 26, 2026, and draft regulations appeared in Canada Gazette Part I on June 27, 2026. Fintech participation is opt-in, and the draft text doesn't address apps fed by an aggregator.
  - The Bank of Canada released draft accreditation guidelines on Nov 2, 2026, with comments due Dec 8. There's no go-live date.
  - If accreditation ever applies: a $2,500 application fee, at least $10,000 a year, professional indemnity and cyber insurance, and a yearly independent security assessment.
- **Plaid:**
  - The Trial plan gives 10 free production Items (for teams created on or after April 15, 2026), with no support.
  - Transactions is billed per Item per month while a token exists.
  - Production pricing is only shown during the production application.
- **Apple:**
  - In the Canadian storefront, digital subscriptions sold in the app must use Apple In-App Purchase.
  - External purchase links are permitted without an entitlement only in the US, with separate programs in the EU and Japan.
  - Verify the current commission, including whether the Small Business Program rate applies, and how web-purchased Plus can be honoured in the app.
- **Privacy law:** PIPEDA applies to manually entered financial data held on a server, as well as bank-synced data (breach reporting, 24-month breach records). Ontario's Consumer Protection Act, 2023 may limit consumer liability caps once in force; its status is unverified.

---

## 6. What to do

1. **Verify before you plan.** Use web research for anything that describes the world now: competitor pricing and rankings, Apple and Google commission and payment rules for Canada, open-banking status, LLM API costs, app category benchmarks, and the size of the Canadian post-secondary population and OSAP and student aid volumes. Label every number in your output as **Verified** (with the source and the date you checked), **Estimate** (with your reasoning), or **Assumption**. Don't invent statistics. If you can't find a benchmark, say so and give a range with reasoning.
2. **Audit the code against the vision.** Is the codebase a good base for the plan, or is it fighting it? Be concrete: which parts carry over, which need refactoring, and which should be dropped.
3. **Decide the storage question** (local-only free tier vs anonymous accounts vs accounts for everyone). Pick one, show the tradeoff in effort, privacy, activation, cost and conversion, and say what it does to the build order.
4. **Define financial success concretely**, in stages (for example: first paying user, covering running costs, $1k MRR, a meaningful income), with dates that are realistic for one developer. Show the model: users needed at each stage = target revenue ÷ (price × conversion × retention), net of store fees, payment fees, AI and infrastructure costs. Give a base, pessimistic and optimistic case.
5. **Pricing and packaging.**
   - Set prices for Canada (monthly, annual, trial).
   - Decide whether to offer a student-specific price.
   - Decide what's free vs paid, and test it against two goals: the free tier has to drive activation and referrals, and Plus has to be worth paying for.
   - Decide whether any lifetime option is wise given AI costs.
   - Decide how Apple IAP and Stripe coexist.
6. **Distribution under the no-marketing constraint.**
   - Which channels can realistically produce the user numbers from step 4: App Store search, web search and free tools, referrals and shareable cards, the optional capped paid test.
   - What each might plausibly yield.
   - What has to be true for the plan to work.
   - If no hands-off plan can reach a meaningful outcome, say so plainly. Then describe the smallest possible exception to the constraint that would change the result, and label it as an exception for Augustine to accept or reject.
7. **Consider other ways to make money** only if they beat the consumer plan on the numbers: for example licensing term-plan tools to universities or credit unions, or affiliate deals for student products. Note which of them need sales or outreach, since that conflicts with the founder constraints.
8. **Build the plan.** A sequenced plan for roughly the next 12 to 18 months that includes:
   - Milestones and what ships at each.
   - The metric that proves each milestone worked: activation rate, week-4 retention, free-to-paid conversion, and cost per activated user where paid tests run.
   - **Kill or pivot criteria**: what result, by when, means change course, and to what.
9. **Cut ruthlessly.** List every roadmap item that doesn't serve the plan, and say what to drop, delay or merge.
10. **Name the top risks** (competitive, platform, legal, technical, motivation and focus) with a mitigation for each.

## 7. Output

- If you have file access, write your plan to **`GROWTH_PLAN.md`** in the repo root. Don't modify code, `ROADMAP.md` or any other file. Otherwise, return the plan in your reply.
- **Structure:**
  1. **The verdict.** One paragraph: can Current become a financial success, on what path, and the single biggest change you'd make.
  2. **What I checked.** Files read and the git state, or a note that the code wasn't available, plus the key facts verified, with dates.
  3. **Code audit.**
  4. **The storage decision.**
  5. **What success means and the model** (the three cases, with the math shown).
  6. **Pricing and packaging.**
  7. **Distribution plan.**
  8. **The 12 to 18 month plan** (milestones, metrics, kill and pivot criteria).
  9. **What to cut.**
  10. **Risks.**
  11. **Proposed changes to ROADMAP.md.** A precise list of items to add, remove, reorder or rewrite, written so Claude Code can apply them later. Don't apply them yourself.
  12. **Open questions for Augustine.** At most 5, only ones whose answers would change the plan.
- **Style:** direct and specific. Write each section as integrated prose with inline context rather than splitting description from gaps, and use tables only for the financial model and the milestone plan. Lead each section with its most important point. **Don't use em dash characters anywhere.** Don't ask questions before starting; make reasonable assumptions, state them, and put genuine unknowns in the open questions at the end.
