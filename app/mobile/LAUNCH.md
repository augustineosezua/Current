# Phase 2 launch checklist

What the code in Phase 2 expects from outside the repo, plus the App Store listing copy (ROADMAP 2.0, 2.6, 2.7, 2.9). Everything here needs a person with the Apple, RevenueCat or Google Cloud login. Nothing in it is done yet.

## 1. Configuration

The app reads these at build time. Set them as EAS environment variables (or in a local `.env`, which is git-ignored):

| Variable | What it is |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat's **public** Apple API key (starts `appl_`). Without it, Plus can't be bought and the app runs as Free. |
| `EXPO_PUBLIC_PRIVACY_URL` | Public privacy policy URL, linked from the paywall. Apple requires it, along with the terms link, which already points to Apple's standard EULA. |

**AI is on-device only for now** (decided November 17, 2026). Nothing needs deploying: there's no server and no Anthropic key. The cloud fallback proxy (`app/api/src/ai`, `npm run start:ai`) stays in the repo, parked, and `CLOUD_AI_ENABLED` in `src/ai/index.ts` is `false`. Turning it on later means deploying the proxy with `ANTHROPIC_API_KEY` and `REVENUECAT_SECRET_KEY`, setting `EXPO_PUBLIC_AI_PROXY_URL`, flipping the flag, and restoring the cloud AI section of the privacy policy before release.

## 2. App Store Connect and RevenueCat (2.0)

**Status (November 18, 2026):** subscription group "Current Plus" (ID 22589704) with `currentmonthly` (CAD $4.99) and `currentplusyearly` (CAD $29.99 base, 7-day free trial from Nov 17, 2026, no end date), both available in all 175 storefronts with English (Canada) names and descriptions. RevenueCat project "Current": both products imported and attached to the `plus` entitlement; offering `default` (current) holds `$rc_monthly` -> `currentmonthly` and `$rc_annual` -> `currentplusyearly`. The old `plus_monthly` and `plus_yearly:monthly` products are inactive. Still to do: sign the Paid Apps Agreement, and upload a paywall screenshot as each subscription's review screenshot.

1. Enrol in the **App Store Small Business Program** before the first sale (15% commission).
2. Create one subscription group, "Current Plus", with two auto-renewing products:
   - Monthly: CAD $4.99.
   - Annual: CAD $29.99, with a **7-day free trial** as its introductory offer.
   Set Canada as the base storefront and let Apple generate the other prices. No lifetime product.
3. In RevenueCat, create an entitlement with the identifier **`plus`**, attach both products, and make a **current offering** with the standard `$rc_monthly` and `$rc_annual` packages. The paywall reads those two packages.
4. RevenueCat pricing (checked November 17, 2026, from secondary sources that disagree): most say it's free below US$2,500 a month in tracked revenue, then 1% of all of it. The roadmap's target for May 2028 is about $900 a month. Confirm the figure on RevenueCat's own pricing page.
5. The privacy policy already covers purchases (Apple and RevenueCat) and on-device AI (version 2.1, `legal/privacy.md`). Publish it and use its URL for `EXPO_PUBLIC_PRIVACY_URL`. After editing the Markdown, rebuild the PDFs with `python legal/build_pdfs.py` (needs `fpdf2`).

The trial is offered once, at activation (after the 5th logged entry or the first semester plan), never at first launch. The App Store review prompt comes after the 10th logged entry, never during onboarding and never within a day of a paywall.

## 3. Before each release (2.9)

- **Turn off the testing tools.** `DEBUG_TOOLS` in `src/lib/debug.ts` is `true` for now, so the "Pretend Plus is on" switch and the AI test set show in Settings in every build, release included. Set it to `false` before the App Store build, or anyone could unlock Plus for free.

- **On-device AI.** `@react-native-ai/apple` 0.13 (Callstack) supports iOS 26 and 27 and is wrapped in `src/ai/on-device.ts` so it can be swapped out. At build time, check Apple's current list of Apple Intelligence devices and languages, including whether fr-CA is supported. The app asks the model whether it supports the locale; when it doesn't, the AI features say they need Apple Intelligence, and the rest of the app works the same.
- **AI test set (50 cases).** On an iPhone with Apple Intelligence, run the development build and open Settings, then **AI test set**. Run it before each release and after every major iOS update. Also check the app on an iPhone *without* Apple Intelligence: the AI features should say they need it, and everything else should work.
- **Alternate icons.** These need a native rebuild (`expo prebuild --clean`). To redraw them, run `python scripts/make-icons.py assets/images --alternates` (needs Pillow).
- **French.** iOS lists French as a supported language through `expo-localization`'s `supportedLocales`. The app follows the phone's language; there's no in-app switch.

## 4. App Store listing (2.7, with the fr-CA listing for 2.6)

Limits: name 30 characters, subtitle 30, keywords 100 (comma-separated, no spaces after commas). Apple already indexes the name and subtitle, so the keywords field doesn't repeat their words.

### Canada, English

- **Name:** Current: Student Budget
- **Subtitle:** OSAP & paycheque budget
- **Keywords:** `money,tracker,spending,daily,allowance,bills,savings,expense,semester,college,university,osap,simple`
- **First screenshot:** the daily number, with "No account. No bank login." above it.

### Canada, French (fr-CA)

- **Name:** Current : budget étudiant
- **Subtitle:** Budget de paie et de session
- **Keywords:** `argent,dépenses,quotidien,factures,épargne,rafeo,université,cégep,suivi,simple,allocation`
- **First screenshot:** "Pas de compte. Pas de connexion bancaire."

### United States

- **Name:** Current: Student Budget
- **Subtitle:** Financial aid & paycheck plan
- **Keywords:** `refund,student,loan,money,tracker,spending,daily,allowance,bills,savings,college,semester,simple`
- **First screenshot:** "No account. No bank login."

### United Kingdom

- **Name:** Current: Student Budget
- **Subtitle:** Maintenance loan budget
- **Keywords:** `uni,student,finance,money,tracker,spending,daily,bills,savings,term,allowance,simple,planner`
- **First screenshot:** "No account. No bank login."

Every other English storefront uses the US listing. Record each monthly title or subtitle test in the keyword log at the bottom of `ROADMAP.md` (3.1).
