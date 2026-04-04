# Current Figma Blueprint

## Goal

Design a production-ready mobile and web UI for **Current**, a fintech budgeting product centered on a single calming decision signal: **Safe-To-Spend**.

This blueprint is intended for direct Figma construction with:

- Separate pages: `Design System`, `Mobile Screens`, `Web Screens`
- Reusable components
- Token-driven styling
- Auto Layout throughout
- Clean, deterministic naming for handoff

## Product Positioning

- Audience: students, young adults, people who feel stressed by money apps
- Core emotion: relief, calm, control
- Anti-patterns: clutter, dashboards packed with metrics, spreadsheet behavior, neon fintech noise
- Primary UI promise: one number that matters, explained clearly on demand

## Visual Direction

- Dark, immersive surfaces using only the approved palette
- Large, high-confidence typography for Safe-To-Spend
- Spacious card stacks with clear vertical rhythm
- Soft elevation and rounded geometry
- Gold reserved for savings and progress, never as a competing CTA color

## Required Figma Pages

### 1. Design System

Sections:

- `Foundations / Colors`
- `Foundations / Typography`
- `Foundations / Spacing`
- `Foundations / Radius`
- `Foundations / Elevation`
- `Components / Buttons`
- `Components / Cards`
- `Components / Inputs`
- `Components / Toggles`
- `Components / Transaction Row`
- `Components / Progress`
- `Components / Navigation`
- `Components / Modal`
- `Components / Empty States`

### 2. Mobile Screens

Screen groups:

- `01 Onboarding`
- `02 Link Bank`
- `03 Account Categorization`
- `04 Home`
- `05 Safe-To-Spend Breakdown`
- `06 Transactions`
- `07 Add Transaction`
- `08 Savings Insights`
- `09 Settings`

### 3. Web Screens

Screen groups:

- `01 Home`
- `02 Transactions`
- `03 Savings Insights`
- `04 Link Bank`
- `05 Safe-To-Spend Breakdown`
- `06 Settings`

## Naming Convention

### Page Names

- `Design System`
- `Mobile Screens`
- `Web Screens`

### Frame Names

- `Mobile / Onboarding / Slide 01`
- `Mobile / Link Bank / Default`
- `Mobile / Link Bank / Loading`
- `Mobile / Home / Default`
- `Mobile / Home / Pull Refresh`
- `Web / Home / Default`
- `Web / Transactions / Filtered`

### Component Names

- `Button / Variant=Primary, State=Default, Size=Large`
- `Button / Variant=Secondary, State=Hover, Size=Large`
- `Card / Type=Default`
- `Input / Type=Text, State=Filled`
- `Toggle / Type=Include, State=On`
- `Transaction Row / State=Default`
- `Progress / Type=Savings, State=Default`
- `Nav / Platform=Mobile`
- `Nav / Platform=Web`
- `Modal / Type=Sheet`
- `Empty State / Type=Transactions`

### Layer Naming

- `Section / Hero`
- `Section / Accounts`
- `Section / Savings Progress`
- `Section / Upcoming Bills`
- `Section / Recent Transactions`
- `Section / Spending Breakdown`
- `Section / Insights`
- `Text / Title`
- `Text / Body`
- `Icon / Leading`
- `Icon / Trailing`

## Foundations

Use the token values defined in [current-design-tokens.json](c:/Users/augustine/Desktop/projects/fintech/design-mcp/current-design-tokens.json).

### Colors

Only these hex values are allowed:

- `#1A1A2E` // background-blue-black
- `#16213E` // buttons, cards, nav mossy blue
- `#5EB3FF` // pop blue CTA and highlights
- `#F5C400` // gold
- `#FFFFFF` // white
- `#3ecf8e` // green for income

Rule:

- Derive all secondary fills, dividers, overlays, and shadows from the same colors with opacity changes only.

### Typography

Primary font: `Manrope`

Styles:

- `Type / H1`
- `Type / H2`
- `Type / Body`
- `Type / Caption`

Additional role style:

- `Type / Safe-To-Spend`

### Spacing

Use an 8pt grid only:

- `8, 16, 24, 32, 40, 48, 64, 80, 96`

### Radius

- `Radius / SM = 12`
- `Radius / MD = 20`
- `Radius / LG = 28`
- `Radius / Pill = 999`

### Elevation

- `Elevation / SM`
- `Elevation / MD`
- `Elevation / LG`

## Component System

All components must use Auto Layout, expose text layers for overrides, and preserve size across states.

### Buttons

Variants:

- Primary
- Secondary
- Ghost

States:

- Default
- Hover
- Pressed
- Disabled
- Loading

Sizes:

- Medium
- Large

Behavior:

- Primary uses brand blue fill and dark text reversal only if needed for legibility
- Secondary uses layered card fill with blue border
- Ghost uses transparent fill with text emphasis
- Loading keeps original width and replaces label with spinner + caption

### Cards

Card types:

- Default Container
- Summary Card
- Insight Card
- Bill Card
- Savings Card

Structure:

- Top label
- Primary content area
- Optional supporting metric
- Optional trailing action

### Inputs

Types:

- Text
- Amount
- Date
- Search

States:

- Empty
- Filled
- Focused
- Error

### Toggles

Required toggles:

- `Safe-To-Spend Inclusion`
- `Spending`
- `Savings`

States:

- On
- Off
- Disabled

### Transaction Row

Content:

- Merchant
- Category
- Date
- Amount
- Leading category badge
- Optional account label

States:

- Default
- Pressed
- Flagged

### Progress Bars

Use gold for savings progress only.

Variants:

- Linear
- Goal Summary
- Milestone Highlight

### Navigation

Required:

- Mobile bottom nav
- Web top nav + utility area

### Modal

Required:

- Bottom sheet for mobile
- Centered dialog for web

### Empty States

Required empty states:

- No transactions yet
- No linked accounts
- No upcoming bills
- No savings goals

## Mobile Screen Specs

### 1. Onboarding Flow

Create three centered onboarding screens with large breathing room and a single illustration-free, typography-led layout.

Frames:

- `Mobile / Onboarding / Slide 01`
- `Mobile / Onboarding / Slide 02`
- `Mobile / Onboarding / Slide 03`

Content:

- Slide 1: `Stop guessing what you can spend`
- Slide 2: `Real-time Safe-To-Spend`
- Slide 3: `Based on income, bills, goals`

Layout:

- Logo mark or wordmark at top
- Large H1 centered vertically
- Supporting body copy below
- Pagination dots
- Bottom CTA: `Get Started`

### 2. Link Bank Screen

Frames:

- `Mobile / Link Bank / Default`
- `Mobile / Link Bank / Loading`
- `Mobile / Link Bank / Error`

Content:

- Title: `Link your bank`
- Body: short reassurance about secure sync
- Primary CTA: `Link Bank Account`
- Plaid-style modal placeholder as nested modal frame
- Loading copy: `Fetching your accounts...`

Behavior:

- Loading uses same card shell, swapping the CTA area for a progress row
- Error is text-driven with retry CTA, no new red hue

### 3. Account Categorization Screen

Frame:

- `Mobile / Account Categorization / Default`

Layout:

- Vertical account list in cards
- Each row shows bank/account name, balance, account type
- Controls for `Spending`, `Savings`, and `Include in Safe-To-Spend`

Behavior:

- Make toggle logic visually obvious and low stress
- Use short supporting helper copy beneath the page title

### 4. Homepage

Frame:

- `Mobile / Home / Default`

Additional state:

- `Mobile / Home / Pull Refresh`

Hierarchy:

1. `Section / Hero`
2. `Section / Accounts`
3. `Section / Savings Progress`
4. `Section / Upcoming Bills`
5. `Section / Recent Transactions`
6. `Section / Spending Breakdown`
7. `Section / Insights`

Hero requirements:

- Safe-To-Spend number is visually dominant
- Period label directly above or below: `Until Mar 28`
- Tappable breakdown affordance
- Blue is reserved primarily for this number and key CTA

Additional requirements:

- Floating `Add Transaction` button
- Pull-to-refresh state with subtle progress indicator
- Accounts as simple balance cards, not analytic widgets
- Savings progress uses gold
- Upcoming bills shows top 3 only
- Recent transactions is a compact readable list
- Spending breakdown is a simplified chart built from the existing palette only
- Insights are short text nudges like:
  - `You're on track this week`
  - `Subscriptions hit in 2 days`
  - `You can spend $42 today and stay safe`

### 5. Safe-To-Spend Breakdown Modal

Frame:

- `Mobile / Safe-To-Spend Breakdown / Default`

Structure:

- Current balance
- Expected income before next period end
- Upcoming bills
- Savings transfers
- Buffer
- Final Safe-To-Spend number

Rules:

- Make the math legible line by line
- Every row tappable for explanation
- End with a high-confidence summary line

### 6. Transactions Screen

Frame:

- `Mobile / Transactions / Default`

Layout:

- Sticky header with title and search
- Filter chips for `Account` and `Date`
- Grouped transaction rows by day or week

Rules:

- Keep rows highly scannable
- Emphasize merchant first, metadata second
- Amount alignment should be consistent

### 7. Add Transaction Modal

Frame:

- `Mobile / Add Transaction / Default`

Fields:

- Amount
- Merchant
- Category
- Date

Extras:

- Smart suggestion chips beneath Merchant and Category
- Primary CTA at bottom
- Preserve keyboard-safe spacing

### 8. Savings Insights Page

Frame:

- `Mobile / Savings Insights / Default`

Content:

- Goal progress hero with gold progress treatment
- Growth chart
- Account-by-account savings breakdown
- Key insights copy blocks

Rules:

- Gold is the feature accent here
- Keep chart minimal and reassuring, not trader-like

### 9. Settings Page

Frame:

- `Mobile / Settings / Default`

Sections:

- Accounts
- Income & Goals
- Bills
- Preferences

Layout:

- Group settings into card sections
- Keep rows simple with trailing chevrons or toggles

## Web Screen Specs

Web should feel like the same product, not a new dashboard. Keep the calm composition and use a centered content column with supportive side rails only where necessary.

### Web Layout Rules

- Use `1440` width desktop frames
- Main content width target: `1200`
- Left-to-right emphasis can increase, but Safe-To-Spend remains the largest element on the page
- Cards should breathe more horizontally, not multiply in density

### 1. Home

Frame:

- `Web / Home / Default`

Layout:

- Top app bar with nav, account switcher, notifications, avatar
- Hero row:
  - Safe-To-Spend block on the left
  - Savings progress card on the right
- Lower grid:
  - Accounts overview
  - Upcoming bills
  - Transactions
  - Spending breakdown
  - Insights

Grid suggestion:

- Hero: `8 / 4`
- Lower content: `8 / 4` with stacked cards in the right column

### 2. Transactions

Frame:

- `Web / Transactions / Default`

Layout:

- Title and summary
- Filter bar: Account, Date, Search
- Large card containing transaction table-like list

Rules:

- Avoid spreadsheet visuals
- Use roomy rows, muted dividers, and clear hierarchy

### 3. Savings Insights

Frame:

- `Web / Savings Insights / Default`

Layout:

- Goal progress hero
- Growth chart
- Goal cards
- Insight rail

### 4. Link Bank

Frames:

- `Web / Link Bank / Default`
- `Web / Link Bank / Loading`

Layout:

- Centered sync card with modal overlay pattern
- Secure messaging and trusted CTA

### 5. Safe-To-Spend Breakdown

Frame:

- `Web / Safe-To-Spend Breakdown / Default`

Layout:

- Centered dialog with two-column breakdown:
  - left: explanation
  - right: step-by-step math summary

### 6. Settings

Frame:

- `Web / Settings / Default`

Layout:

- Left side section navigation
- Right side content panels

## Interaction Notes

### Mobile

- Tap states should darken or tint the active card/button using blue opacity
- Pull-to-refresh should feel soft and quick, never heavy
- Floating action button stays visible over long lists

### Web

- Hover states only add slight lift, outline, or opacity change
- Focus states use blue ring treatment
- Modals darken the app shell with an overlay derived from `#16213E`

### Loading States

- Skeletons should use white at low opacity over blue-black surfaces
- Keep layout stable during loading

### Error States

- Rely on copy, iconography, and structure instead of introducing unauthorized colors
- Use clear recovery CTA and brief reassuring message

### Empty States

- Empty states should be kind, brief, and action-oriented
- Each empty card needs exactly one next step

## Home Screen Content Model

### Account Overview

Represent 2-4 accounts max on the default mobile home:

- Everyday Checking
- Student Savings
- Credit Builder

### Upcoming Bills

Show top 3:

- Rent
- Phone
- Spotify

### Recent Transactions

Examples:

- Grocery Outlet
- TTC Reload
- Coffee Island
- Payroll Deposit

### Insights

Use short, calm copy:

- `You can spend confidently today.`
- `Bills are covered through Mar 28.`
- `Saving pace is up 12% from last month.`

## Build Order

1. Create `Design System` page and foundations first.
2. Build all reusable components and states.
3. Compose mobile screens from components.
4. Adapt the same system into web layouts.
5. Validate every screen for naming, Auto Layout, and token usage.

## QA Checklist

- Every screen uses Auto Layout
- No unnamed frames or layers
- No colors outside the approved palette
- Safe-To-Spend is the largest visual element on home
- Gold appears only in savings-related contexts
- Buttons, cards, inputs, toggles, progress, nav, modal, and empty states exist as reusable components
- Mobile and web are visibly related, not duplicated blindly
- All loading, empty, hover, tap, and error states are represented

## Delivery Note

If direct Figma write access is available, this blueprint should be implemented exactly as a token-first component system, then assembled into screens without detached instances or hardcoded layout values.
