# Current: Growth Plan

Written November 16, 2026. Every number is labelled **Verified** (source, checked Nov 16, 2026), **Estimate** (reasoning given) or **Assumption**. All prices are CAD unless marked.

## Decisions made after the first draft (November 16, 2026)

This plan was written against the old roadmap. Augustine then made the decisions below, `ROADMAP.md` was rewritten to match, and the sections that follow have been updated so the two files agree. Where they ever differ, `ROADMAP.md` is the source of truth.

- **Accepted:** selling in every English-language storefront, building the iOS app first, freezing the web app until sync ships, and the tighter free tier.
- **Accepted:** the one-time calculator outreach (the only exception to the no-marketing rule).
- **Changed:** web access for paying users is committed. Account, cloud sync and web access ship in M3 (roadmap item 3.7), and the web sells nothing.
- **Rejected:** the lifetime option. "No lifetime pricing" stands, which lowers revenue per install from $0.59 to $0.46 in the base case.
- **Added:** AI runs on Apple's on-device model first, with a stateless cloud fallback for iPhones that can't run it. Plus gains Ask Current (a bounded AI chat), a weekly AI recap, themes and app icons, and rollover budgets.
- **Noted:** no ads before January 2027. This changes nothing, because the only ad test is planned for late August 2027.

## 1. The verdict

Current can cover its costs and plausibly reach about $900 to $1,000 a month in net revenue within 18 to 20 months, but not on the path in the old roadmap, and a "meaningful income" (about $4,000 a month) only happens in the optimistic case. The old roadmap spends Phases 0 to 2 on a web app that has no hands-off way to acquire users and leaves the one channel that works without marketing, App Store search, to Phase 3. It also limits the product to Canadian students, and the best evidence available says that market is too small for search alone: DaTrack, a polished generic tracker updated 25 times, has 11 ratings in Canada against 786 in the US. The single biggest change I would make is to **build the iOS app next, local-only, and sell it in every English-language storefront**, keeping Safe-to-Spend and term plans as the wedge. Term plans are not an OSAP-only idea: US financial aid refunds and UK maintenance loans are the same lump-sum problem in markets ten times larger. The web app is frozen until it returns in M3 as a signed-in companion for paying users, Plaid stays off, Stripe is not built, and at launch the server is only a small AI fallback proxy and a few public calculators.

## 2. What I checked

I had full repository access. I read `ROADMAP.md`, `decisions.MD`, `STS-steps.MD`, `README.md`, `app/api/prisma/schema.prisma`, `lib/safe-to-spend.ts`, `lib/bills.ts`, `lib/savings.ts`, the route list across `app/api/src/plaid/*.ts`, `server.ts`, `lib/crypto.ts`, both `package.json` files, the web config, and the structure and data fetching of the web pages. I did not open `.env` or `env.txt`.

The git state matches the brief with one correction. `HEAD` is `b16ce03`, dated May 8, 2026, and nothing has been committed since, so the code has been untouched for six months. Its message is "fix: error getting transactions from plaid"; the title "fix: fallback to current balance" that the brief and `ROADMAP.md` attach to it belongs to the previous commit, `8d2cf8b`. Three more things differ from what the documents imply: `decisions.MD` contains a single sentence (late unpaid bills count against STS), so the "locked rules" live only in `ROADMAP.md`; `app/packages/types`, `ui` and `utils` exist but are empty; and there are no tests and no test runner anywhere in the repo.

Facts checked on Nov 16, 2026:

- **DaTrack, Canadian App Store page** (apps.apple.com/ca/app/id6760328162). **Verified:** title "Budget Planner: DaTrack", 11 ratings at 4.4, **#49 in Finance** (the brief said #10 a day or two earlier, so the rank is volatile), Pro Monthly $6.99, Pro Yearly $39.99 with a 7-day trial, lifetime $99.99 (launch) and $129.99, version 2.9.2, 25 versions since May, 8 languages. Its description now leads with "Budget by paycheck". The US page shows **786 ratings at 4.8** and US$4.99 / US$34.99.
- **Canadian post-secondary population.** **Verified:** about 2.3 million enrolments in public colleges and universities in 2023/24 (Statistics Canada, The Daily, Nov 20, 2025).
- **OSAP.** **Verified (news reports, not an official table):** about 473,000 recipients and roughly $2.0B in aid in 2024-25. From August 1, 2026 the provincial grant share is capped at 25%, down from as much as 85%, so far more Ontario student money now arrives as loans (announced Feb 12, 2026; Centennial College FAQ, CP reporting).
- **Apple commission.** **Verified (secondary sources):** the Small Business Program rate is 15% for developers under US$1M in proceeds, and it requires enrolment. Entitlement-free external purchase links exist only on the US storefront. **Not verified from Apple's own text:** whether a subscription bought on the web can be honoured in a Canadian-storefront app that offers no IAP; developer forum reports say App Review expects the same item to be sold through IAP as well. The plan avoids depending on this.
- **Subscription benchmarks.** **Verified (RevenueCat State of Subscription Apps 2026, via RevenueCat's blog and recaps):** freemium apps convert a median 2.1% of downloads to paid by day 35, against 10.7% for trial-led hard paywalls; year-one retention is about 27 to 28% either way; 35% of annual cancellations happen in month one. I could not find finance-specific figures, so these are all-category medians.
- **Apple Search Ads.** **Verified (AppTweak, SplitMetrics, Mobile Action; mixed years):** US finance median cost per install US$9.65 (2025); Canada all-category cost per acquisition US$2.81 (2026); Canada finance about US$18.85 (2024). No 2026 Canada finance figure exists publicly.
- **LLM cost.** **Verified (third-party price trackers, not Anthropic's page):** Claude Haiku 5.5 at US$0.10 per million input tokens and US$0.50 per million output tokens.
- **Stripe Canada.** **Verified (stripe.com/ca/pricing):** 2.9% + $0.30 on domestic cards, plus 0.7% for Billing.
- **Open banking.** **Verified:** final Consumer-Driven Banking Regulations are still unpublished; the Bank of Canada's advisory committee notes (July 21, 2026) target late 2026 or early 2027.
- **Ontario Consumer Protection Act, 2023.** **Verified (secondary, July 2026):** passed but still not in force; no proclamation date found.

## 3. Code audit

The codebase is a reasonable Plaid-synced web app and a poor base for the plan, because nearly everything valuable in it is welded to the two things the plan removes: a server database and Plaid. The honest summary is that the domain design carries over and most of the code does not.

What carries over is the thinking. The STS algorithm (balance, minus unpaid bills to a cutoff, minus goal contributions by priority, protecting a spending floor, with an "available after next paycheque" fallback), the virtual priority allocation for goals, the bill recurrence rules, income frequencies and the savings reconciliation idea are all sound and are the product's actual asset. The web pages are a finished visual reference for the mobile screens. Better Auth, Resend, the Prisma schema and the AES-256-GCM token encryption in `lib/crypto.ts` are solid and become useful again if Plus sync is ever built.

What needs rewriting rather than refactoring is `calculateSafeToSpend`. It is 420 lines that interleave eight Prisma calls with the math, so it cannot run on a phone or be unit tested as written. It does arithmetic on floats via `toNumber()`, which is how a budgeting app ends up a cent off. It is month-based throughout (`startOfMonth`, the goal `lastPaymentDate` month check), which fights paycheque and term periods. Its spending floor counts "already spent" by matching Plaid category names (`category: { hasSome: SPENDING_CATEGORIES }`), so with manual transactions the floor would never shrink. It contains the known write (the `prisma.income.update` loop at line 395), and the `setMonth` month-end overflow exists both there and in `lib/bills.ts`. `STS-steps.MD` also records that "available after" does not trigger in every STS-equals-zero path. The right move is a new pure function in a shared package that takes plain data in integer cents and returns the result, written test-first, with the old function as the behavioural reference.

What should be frozen or dropped: all seven route files live under `src/plaid/` and assume a session and a Postgres user; the web pages are client components of 800 to 1,500 lines each that fetch in `useEffect`, so no UI code is portable to React Native; `Transaction.plaidTransactionId` is required and `accountId` references `plaidAccountId`; `budgetMonth` is already deprecated; `commitSafeToSpendAllocations` is dead. None of this needs fixing under the new plan because none of it ships. The `ROADMAP.md` Phase 0 and Phase 1 schema migrations (1.1 in particular) are real work whose only purpose is to make the web app manual-capable, and I recommend not doing them.

Two things should be fixed this week regardless. `.gitignore` covers only `node_modules` and `.env`, while `env.txt` sits untracked in the root and two `.DS_Store` files are tracked. And `lib/email.ts` line 157 puts "Bank-grade encryption" in the email footer, which is the kind of claim the privacy positioning should not make.

## 4. The storage decision

**Decision: local-only on iOS for everyone at launch, with no accounts. Plus at launch is an on-device unlock through Apple IAP. Account, cloud sync and web access are added to Plus in M3, about three months after launch.** The first draft made that last part conditional on user demand; Augustine made it a commitment. Free users never need an account.

**As decided:** Augustine made web access for paying users a committed feature. Launch is unchanged (free is local-only, Plus unlocks on the device), and account, sync and web access are built in M3 as `ROADMAP.md` item 3.7 instead of being one of three M5 options. The web sells nothing and Stripe is still not built. This adds a server and database back for Plus users who turn sync on (roughly $25 to $40 a month more, **Estimate**), restores PIPEDA obligations for their synced data, and takes most of M3's build time.

The reasoning for launching without it is that the sync engine is the expensive part and nothing at launch needs it. The old roadmap's item 3.1 already committed to most of local-first's cost: offline logging in expo-sqlite, client-generated IDs, STS computed on the device including pending transactions, and on-device category suggestions. Going fully local removes the other half (the API dependency, signup, email verification, the manual-mode migration) instead of adding to it. Backup is covered by the app's database being included in iPhone and iCloud device backups, plus free CSV export.

On the five dimensions the brief asks for:

- **Effort.** Local-only without sync is the smallest build: one shared `core` package and one Expo app. Anonymous accounts look cheaper because the API exists, but they still require the whole manual-mode migration (1.1) plus an offline queue on the client. Accounts for everyone is the roadmap as written, the largest of the three.
- **Privacy and legal.** Local-only means Current holds no financial records, so PIPEDA breach exposure nearly disappears, and selling outside Canada does not drag in a second privacy regime for stored data. AI runs on Apple's on-device model where the iPhone supports it, so nothing leaves the phone. The honest caveat is older iPhones: there, AI features use a cloud fallback that receives the question and the figures needed to answer it, stores nothing, and is disclosed before first use. The claim is "your budget lives on your phone", not "nothing ever leaves it". Anonymous accounts lose the claim entirely, which is the exact claim DaTrack's developer abandoned accounts to gain.
- **Activation.** No signup, no email verification, first number on screen in under a minute. I found no verified benchmark for signup-wall drop-off in finance apps, so I am not putting a number on it, but the direction is not in doubt.
- **Cost.** Running cost falls to an Apple developer membership, a domain and a near-idle AI proxy: about $40 a month at launch, and about $75 a month once sync is running (**Estimate**). Postgres stays off until then.
- **Conversion.** This is the real cost at launch. Until M3, Plus cannot be sold as "sync and web", and for free users referral credits and lifecycle emails have no account to attach to and a lost phone without a backup loses data. I accept that because the paid features people demonstrably buy in this category (DaTrack's Pro list) are all on-device.

The effect on build order is total: the Expo app moves from Phase 3 to first, the old roadmap's web Phases 0 and 1 are not built, and Stripe is not built at all.

## 5. What success means and the model

Success is defined in four stages: a first paying user, covering running costs (about $40 a month at launch and about $75 once sync is running), $1,000 a month net, and a meaningful income, which I set at $4,000 a month net because that is roughly a new graduate's part-time income and the point where continuing is clearly rational.

Revenue per install is the unit that matters. Prices are from section 6; Apple takes 15% under the Small Business Program. Net per sale is $25.49 on a $29.99 annual plan and $4.24 on each $4.99 month. There is no lifetime option. AI cost is negligible: on-device requests are free, and a cloud-fallback request of about 600 input and 100 output tokens costs roughly US$0.0001, so even 300 a month is about four cents (**Estimate** from the verified token prices). Monthly subscribers are assumed to pay for four months on average (**Assumption**). Renewals after year one (about 28% of annual subscribers, **Verified** benchmark) are left out, which makes the model conservative for year two.

| | Pessimistic | Base | Optimistic |
|---|---|---|---|
| Installs that become payers | 1.0% (**Assumption**: half the freemium median) | 2.0% (**Verified** median is 2.1%) | 4.0% (**Assumption**: trial-led paywall, strong fit) |
| Payer mix annual / monthly | 55 / 45 | 70 / 30 | 70 / 30 |
| Net revenue per payer, first year | $21.65 | $22.93 | $22.93 |
| **Net revenue per install** | **$0.22** | **$0.46** | **$0.92** |
| Installs per year to cover $900 costs (with sync) | 4,200 | 2,000 | 1,000 |
| Installs per year for $1,000 a month | 55,400 | 26,200 | 13,100 |
| Installs per year for $4,000 a month | 221,700 | 104,700 | 52,300 |

The math for one cell: base net per payer = 0.70 × $25.49 + 0.30 × (4 × $4.24) = $22.93, times 2.0% = $0.46 per install, and $12,000 ÷ $0.46 ≈ 26,200 installs. The first draft of this plan included a $79.99 lifetime option, which put the base case at $0.59 per install; Augustine dropped it.

The install side is where honesty matters. The only real comparable is DaTrack. If 1 to 3% of its installers leave a rating (**Assumption**; it prompts after 10 expenses), 786 US ratings imply roughly 26,000 to 79,000 US installs in eight months, and 11 Canadian ratings imply roughly 400 to 1,100. So a well-run generic tracker gets on the order of 50 to 140 installs a month from Canada and 3,000 to 10,000 from the US (**Estimate**). A Canada-only student app on search alone would earn a few hundred to a few thousand dollars a year in the base case. That is why the plan goes worldwide.

| Steady-state installs, month 12 after launch (**Estimate**) | Pessimistic | Base | Optimistic |
|---|---|---|---|
| Worldwide installs per month | 500 | 2,000 | 6,000 |
| Net revenue per install | $0.22 | $0.46 | $0.92 |
| **Net revenue per month** | **$110** | **$920** | **$5,500** |
| First paying user | May 2027 | April 2027 | April 2027 |
| Covers running costs | early 2028 | July 2027 | May 2027 |
| $1,000 a month | not reached | mid-2028, with first renewals | late 2027 |
| $4,000 a month | not reached | not reached | spring 2028 |

The base case is a small real business by mid-2028, not a salary. The pessimistic case is a $1,300-a-year hobby that costs about $900 a year to run. Paid acquisition does not rescue either: at $0.46 per install against install costs of US$2.81 and up in Canada, ads lose money at any scale until conversion is several times the median.

## 6. Pricing and packaging

**Plus is $4.99 a month or $29.99 a year with a 7-day free trial on the annual plan. There is no lifetime option.** That undercuts DaTrack's Canadian $6.99 and $39.99 by about a quarter, which is the right place for a student product with fewer ratings. Set the Canadian price as the base and let Apple's price tiers generate the other storefronts.

There is no separate student price. Verifying student status needs a vendor and a flow, and the base price already is the student price. The seasonal lever is Apple's built-in introductory and promotional offers in late August and early January, which need no accounts.

**Lifetime pricing was considered and rejected.** The first draft recommended a $79.99 lifetime option on the grounds that a local-only user costs almost nothing to serve. Augustine dropped it once Plus gained cloud sync, which does have an ongoing cost, and because a lifetime tier that excluded sync would have been hard to explain. The price of that decision is in section 5: about $0.13 less per install in the base case.

**The free tier is tighter than the old roadmap's table.** The old free tier was stronger than DaTrack's entire Pro tier, and a freemium median of 2.1% falls further when free has everything. Free keeps everything that makes Current different and drives ratings: manual accounts and logging, Safe-to-Spend and the daily number, bills with reminders, one term plan, two savings goals, categories with history-based suggestions, the current period's spending summary, CSV export and French. Plus gets depth: AI quick add, "Can I afford this?", Ask Current (an AI chat bounded to the user's own budget), a weekly AI recap, category budgets with Needs/Wants, rollover and the 90% and 100% alerts, insights and period comparisons beyond the current period, unlimited term plans and goals, goal withdrawals, CSV/OFX import, themes and app icons, account with cloud sync and web access from M3, and the home-screen widget in M4. The trial is offered once, at the moment of activation (after the fifth logged transaction or first term plan), not as a wall at first launch.

**AI is on-device first.** Apple's on-device model is free per request and keeps the data on the phone, which is why a chat feature moved off the "not doing" list. It only exists on Apple Intelligence-capable iPhones on iOS 26 or later (**Verified**, secondary sources; the exact device list was not confirmed), it is small (about 3 billion parameters, with a context window reported at 4,000 to 8,000 tokens) and Apple changes it with each major iOS release. So the model is never given transaction history and never does arithmetic: code computes, the model words the answer. Phones that can't run it use a stateless Claude Haiku fallback after a one-time disclosure. React Native access is through a community package, which is a dependency risk noted in section 10.

**Apple IAP is the only way to pay, and Stripe is not built.** All purchases go through IAP, managed with RevenueCat so there is no receipt server to write (its free tier limit is an **Assumption** I did not verify; check before integrating). Enrol in the Small Business Program before the first sale. When web access ships, the web has a login and no signup, pricing or checkout: a Plus user creates the account in the app and the server checks the entitlement through RevenueCat. That avoids the unresolved question of how Apple treats web-purchased subscriptions in Canada.

## 7. Distribution plan

App Store search is the plan, and everything else is a multiplier on it. Under the no-marketing constraint there are four channels, and only the first can produce the install numbers in section 5.

**App Store search (expected to supply 80% or more of installs).** DaTrack shows the method works for a solo developer: a keyword-led title, frequent releases, a review prompt at a good moment, and localized listings. Current does the same with a different angle per storefront. The Canadian listing targets student budget, OSAP and paycheque budgeting in English and fr-CA; the US listing targets financial aid refund, student loan budget, paycheck budget and daily spending allowance; the UK listing targets maintenance loan and student budget. The app itself needs only locale-aware currency formatting and three preset labels on the term-plan screen. What has to be true: the listing reaches a few hundred ratings above 4.5 (the review prompt after the tenth transaction is the mechanism), a release ships at least every three weeks, and one title or subtitle keyword test runs per month. The OSAP grant-to-loan shift in August 2026 is a real tailwind for the Canadian keywords.

**Free web calculators (expected 5 to 15% of installs, slowly).** Three public pages on the existing Next.js project: an OSAP term budget calculator, a US financial aid refund calculator and a UK maintenance loan calculator, each running the same `core` term-plan math and ending in an App Store link. These take months to rank and I have no verified search volumes, so I am treating them as a cheap option, not a pillar.

**Share card (small).** The term-plan image ("My winter OSAP lasts until April 30: $245/week") with an App Store link works without accounts. Finance is not a category people share from, so expect a low single-digit share of installs.

**Capped paid test (information, not growth).** One Apple Search Ads campaign of about $300 in late August 2027, on exact-match student keywords, with a stop rule at $3 per install. Its purpose is to learn which keywords convert to activated users, then put those words in the title. It cannot be a growth channel at $0.46 per install. Augustine can't run ads before January 2027, which does not affect this timing.

Referral credits, campus reps and lifecycle emails are removed because they need accounts and email addresses, and only Plus users who turn sync on will have them. Local notifications replace the emails.

Stated plainly: hands-off distribution can plausibly deliver the base case, and it cannot deliver a meaningful income unless the optimistic install and conversion numbers both happen. **The smallest exception that would change this, which Augustine accepted on November 16, 2026:** one two-hour session, once, in which Claude drafts and Augustine approves about 25 emails to university financial aid offices, student unions and student newspapers offering the free embeddable calculator for their money-resources pages. No follow-up, no relationship, no posting. A handful of university-domain links is the difference between calculators that rank and calculators that do not, and it is the only thing I found that is both small and compounding.

Other revenue was considered and only one idea survives. Licensing term-plan tools to universities or credit unions requires sales calls and procurement, which breaks the founder constraint outright. An affiliate "student deals" screen (student bank accounts and similar, joined through a self-serve affiliate network with no outreach) could roughly match Plus revenue per install if 1% of installers open an account at a $50 payout (**Assumption**; I did not verify Canadian payouts). It also undercuts the privacy pitch if done carelessly. Revisit it once the app has passed 5,000 installs, as a single clearly labelled screen, and not before.

## 8. The 12 to 18 month plan

Dates assume one student developer working with Claude Code, with December and April exams. One practical note: the working machine is Windows, so iOS builds go through Expo's cloud build service and testing needs a physical iPhone; the home-screen widget needs a native Swift target and is deliberately late for that reason.

| Milestone | Dates | What ships | Proof it worked |
|---|---|---|---|
| M0 Foundation | Nov 16 to Dec 20, 2026 | Repo hygiene (0.4). `app/packages/core`: pure, tested TypeScript in integer cents for STS, `getNextPaymentDate` with month-end clamping, budget periods, daily STS, term-plan reserve, bill recurrence, goal allocation, `suggestCategory`. | Core has no Prisma import and a test for every rule in `STS-steps.MD`, including the roadmap's term-plan example ($4,000, Jan 6 to Apr 30, about $35 on day 1). |
| M1 Free app | Jan 4 to Feb 28, 2027 | Expo iOS app, local-only on expo-sqlite: 60-second onboarding (balance, next income, bills), manual logging, STS and daily number, bills with paid-bill auto-logging and balance check-ins, goals, one term plan, categories, local notifications, CSV export, anonymous analytics with no amounts or merchants. | On TestFlight by Feb 28. Augustine uses it daily for two weeks without touching the web app. |
| M2 Plus and launch | Mar 1 to Apr 15, 2027 | RevenueCat IAP and paywall, the AI layer (on-device first, cloud fallback), AI quick add, "Can I afford this?", Ask Current, weekly recap, category budgets with alerts and rollover, insights, goal withdrawals, import, themes, review prompt, en and fr-CA listings, privacy policy and terms. Live in all English-language storefronts. Import, rollover, themes and the recap may slip to the first releases after launch. | First paying user by Apr 30, 2027. Activation of at least 30% of installs (**Assumption** as a target; no verified benchmark). |
| M3 Search engine | Apr 16 to Jul 31, 2027 | Plus account, cloud sync and web access (the main build). A release every three weeks. Monthly title and subtitle test. US and UK term-plan presets and listings. Three web calculators, then the one-time outreach. Share card. | Running costs covered by July 2027. At least 300 installs a month by July. Week-4 retention of at least 15%. Install-to-trial of at least 5%. Sync and web live before Aug 15. |
| M4 Back to school | Aug 1 to Oct 31, 2027 | Promotional offer for late August. Home-screen widget (Plus). The $300 Apple Search Ads keyword test. No other new features. | At least 1,000 installs a month in September. Install-to-paid of at least 1.5%. At least 100 ratings worldwide at 4.5 or better. Net revenue of at least $250 a month. |
| M5 Decide the second act | Nov 1, 2027 to Feb 28, 2028 | Exactly one of: (b) four more listing languages if installs are the constraint; (c) the affiliate screen if installs are healthy but conversion is not. Plus features chosen from the day-7 survey. January 2028 term push. | Net revenue of at least $600 a month by end of February 2028. |
| M6 Verdict | Mar 1 to May 31, 2028 | Iteration on whichever M5 option was chosen. | Base case: about $900 a month net by May 2028, on course for $1,000 by mid-2028. |

**Kill and pivot criteria.**

- **June 30, 2027.** If activation is under 20% or week-4 retention under 10%, stop all growth and feature work and rebuild onboarding and the logging loop until they clear the bar. Nothing downstream works if the product does not hold people.
- **October 31, 2027.** If installs are under 500 a month after back-to-school, the student positioning is not winning search. Pivot the listing, not the app: lead with "daily spending number" and "paycheque budget" for a general young-adult audience, keep term plans as a feature, and add listing languages. If installs are fine but install-to-paid is under 1%, move the trial offer to the end of onboarding and move the second savings goal behind Plus.
- **February 28, 2028.** If net revenue is under $250 a month, stop building. With sync and the AI fallback running the app costs about $75 a month, so keep it running only while Plus revenue covers that; otherwise give Plus users 60 days' notice, switch sync off and keep the local-only app live for about $15 a month as a portfolio piece with real users.
- **Any time.** If no commit lands for 30 days outside exam periods, cut the current milestone's remaining scope in half instead of extending its date.

## 9. What to cut

Item numbers in this section refer to the old roadmap, before it was rewritten. The cuts are large because most of that roadmap served the web app. Drop Phase 0 items 0.1, 0.2, 0.3, 0.5 and 0.6 as web and API work: the CQS fix and the month-end clamp are satisfied by writing `core` correctly, the dead commit function and the Plaid flag stop mattering when the server does not ship, and Stripe is not built. Keep 0.4 and the copy rules in 0.7. Drop all of 1.1's Prisma migration and endpoints; its behaviours (check-ins, paid bills logging themselves, onboarding with a manual account) move into the app. Fold 1.2 through 1.6 and 1.8 into `core` plus app screens, and replace 1.7's email job with local notifications.

Drop 2.3, the Plaid beta, entirely for this horizon. Free users have no account, Plus accounts only arrive in M3, and the three conditions in the bank-linking decision cannot be met by a solo developer before 2028. The decision's logic stands; the code stays in the repo untouched.

Delay French in the web app and email templates in French; the web returns in M3 only as a synced companion for Plus. Drop G.3 referral credits, G.5 lifecycle emails and G.6 campus reps. Drop G.9 launch listings: Product Hunt and Hacker News audiences are not students and it is marketing by another name. Merge G.7 embeds into the calculators, and G.8 into the single Apple Search Ads test. Keep G.1, simplified to anonymous events, and G.2's in-app feedback button and day-7 survey.

## 10. Risks

- **Competitive.** DaTrack's listing already says "Budget by paycheck", and its developer ships weekly; a term-plan feature could be copied in a week. The mitigation is to own the specific searches (OSAP, financial aid refund, maintenance loan) and the one-number experience, and to be the cheaper option. Do not compete on receipt scanning, and keep Ask Current bounded to the user's own budget instead of chasing a general assistant.
- **Platform.** The entire plan runs through one store. Rankings are volatile (DaTrack moved from #10 to #49 in days), finance apps draw closer review, and Apple's payment rules are changing by region. Mitigate by using IAP only, keeping no external purchase links, shipping small frequent updates, and keeping an Android build as the M5 fallback since Expo makes it cheap.
- **On-device AI.** The model only exists on newer iPhones, Apple changes it with each major iOS release, and React Native reaches it through a community package that was announced as a preview. Mitigate by wrapping it behind one interface with the cloud fallback, keeping a fixed test set that runs against both before each release and after each iOS update, and making every AI feature degrade to plain numbers when no model answers. A wrong AI sentence about money is a trust problem, so each answer shows the figures it used and the model declines financial advice.
- **Legal.** Local-only removes most exposure for free users, but Plus users who turn sync on have financial data on the server (breach reporting and records under PIPEDA, and the UK and EU equivalents where sold), and the AI fallback and analytics still process personal information. Keep the proxy stateless, send no amounts or merchants to analytics, and say exactly this in the policy. The $50 liability cap needs a lawyer's eye before launch, and Ontario's new Consumer Protection Act could weaken it once proclaimed. If that review is unaffordable, launch without the EU storefronts first.
- **Technical.** There are no tests today, the STS math uses floats, and date handling has known bugs. The `core` package with integer cents and tests is M0 for this reason. Local-only adds a data-loss risk when a phone is lost without a backup; mitigate with an explicit "back up now" CSV export prompt each month and clear copy about iCloud backups.
- **Wrong numbers.** A manually maintained balance drifts, and a confident wrong Safe-to-Spend number is the product's worst failure. Balance check-ins and the "last checked N days ago" label are launch requirements, not polish.
- **Motivation and focus.** The repo has been idle for six months, the plan asks for a new platform, and revenue will be near zero until at least mid-2027. Mitigate with milestones short enough to finish between exam periods, fixed checkpoint dates that force a decision, and a scope guard that stays as strict as the roadmap's.

## 11. Proposed changes to ROADMAP.md

**Applied on November 16, 2026.** The list below is kept as a record of what was proposed. Four later decisions changed the result, and `ROADMAP.md` reflects them: item 2 and item 8 (sync and web access are committed as 3.7, not a conditional M5 option), item 10 and item 12 (no lifetime option; lifetime pricing is back under "not doing"), and item 6 (AI is on-device first with a cloud fallback, and Phase 2 gained Ask Current, the weekly recap, themes and rollover budgets). Item 9 also gained G.10, the accepted outreach.

1. **Correct** "Where Current stands": `b16ce03` is "fix: error getting transactions from plaid"; "fix: fallback to current balance" is `8d2cf8b`. Note that `decisions.MD` holds one sentence and `app/packages/*` are empty.
2. **Add** a new section after "Decision: bank linking" titled "Decision: storage and platform (November 16, 2026)": iOS first; local-only with no accounts; Plus is an on-device IAP unlock; sync and web access are a conditional M5 item; the app ships in all English-language storefronts.
3. **Rewrite** "Product direction" to say the audience is students and young adults in Canada, the US and the UK, with term plans presented as OSAP, financial aid refund or maintenance loan by storefront.
4. **Replace** Phase 0 with: 0.4 repo hygiene (unchanged); 0.7 copy rules (keep, plus remove "Bank-grade encryption" from `lib/email.ts`); new 0.8 "Build `app/packages/core`" with the contents of M0 above. Mark 0.1, 0.2, 0.3, 0.5 and 0.6 as "Superseded by core / not needed while the server is not shipped".
5. **Rewrite** Phase 1 as "The free iOS app (M1)". Convert 1.1 to 1.8 from schema-and-endpoint specs to `core` functions plus Expo screens backed by expo-sqlite. Remove every Prisma migration and REST endpoint from those items. Change 1.7 to local notifications.
6. **Rewrite** Phase 2 as "Plus and launch (M2)": RevenueCat IAP, the paywall and trial timing from section 6, 2.1 and 2.2 behind a stateless `POST /parse` and `POST /afford-explain` proxy, 1.3 budgets and 1.8 extended insights moved here, 2.4, 2.5. **Remove** 2.3. **Move** 2.6 French to app strings and the fr-CA listing only.
7. **Rewrite** Phase 3 as "Search and seasons (M3, M4)": 3.2 extended to US and UK listings and monthly keyword tests; 3.3 widget as a Plus feature in M4; 3.4 three calculators with embeds. **Remove** 3.1, now Phase 1.
8. **Add** Phase 4 "Second act (M5), choose one": sync and web access, more listing languages, or the affiliate screen, with the selection rules from section 8.
9. **Growth track:** keep G.1 (anonymous events, activation defined as an entered balance plus 5 transactions or a bill or a term plan within 7 days of install), G.2 feedback and survey, G.4. Remove G.3, G.5, G.6 and G.9. Merge G.7 into 3.4. Rewrite G.8 as the single $300 Apple Search Ads test with a $3-per-install stop rule.
10. **Replace** the Free vs Plus table with the split in section 6, and replace "Pricing is TBD" with $4.99 monthly, $29.99 annual with a 7-day trial, $79.99 lifetime for on-device Plus only.
11. **Rules:** keep CQS, the sign convention and the Plaid rules as written for the frozen server code. Add: money is integer cents in `core`; `core` imports no database or network code; analytics never receives amounts, merchant names or notes; the AI proxy stores nothing.
12. **Not doing:** remove "lifetime pricing". Add: Stripe, web app feature work, referral credits, lifecycle email, campus reps, launch listings, Plaid beta, all until the M5 decision.
13. **Add** the milestone table and the four kill and pivot criteria from section 8 as a new final section, "Checkpoints".
14. **Update** the kickoff prompt to start at 0.4 and 0.8, and to run `core` tests after every item.

## 12. Open questions for Augustine

1. ~~Will you sell outside Canada from launch?~~ **Accepted** when the roadmap changes were applied.
2. **Still open:** do you have an iPhone to test on, and is it one that can run Apple's on-device model (so you can test both AI paths)? Are you willing to pay for the Apple Developer Program now? You are on Windows, so everything else can run through Expo's cloud builds, but M1 cannot start without a test iPhone and the membership.
3. ~~Do you accept freezing the web app?~~ **Resolved:** frozen until M3, when it returns as web access for Plus.
4. ~~A lifetime option, and moving budgets and insights to Plus?~~ **Resolved:** lifetime rejected; the tighter free tier accepted.
5. ~~Will you accept or reject the one-time, two-hour calculator outreach in section 7?~~ **Accepted by Augustine on Nov 16, 2026.** It runs once, after the three calculators are live in M3.
