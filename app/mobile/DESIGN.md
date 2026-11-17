# Current design system: Sticker Book

The source of truth for how the iOS app looks, moves and talks. `app/web/DESIGN.MD` is only the record of the frozen web pages. Tokens live in `src/global.css`; screens use them through Tailwind classes (Uniwind), never raw hex values.

Chosen by Augustine on November 16, 2026 (ROADMAP 1.0b), from three directions mocked side by side: <https://claude.ai/artifact/8xCRXnPZD5LRXATG8AAdpG>.

## The idea

A budget that feels like a sticker book: warm paper, chunky type, and die-cut stickers for categories. It should feel friendly and a little handmade, never like a bank.

**Softened November 17, 2026.** Augustine found the original ink outline and hard offset shadow too brutalist, and asked for the look of direction A in the mockup canvas. Cards, the tab pill and the + button now sit on a soft ledge: a short 3px shadow plus a wide faint blur (`--color-ledge`, `--color-glow`, drawn in `components/raised.tsx`). Pressing one settles it 2px onto the ledge. Category stickers keep the die-cut look with a white edge (`--color-edge`) and a small ledge. Nothing gets a dark outline any more; a selected chip or swatch is marked with a 2px `ink` ring.

## Colour

All colour comes from tokens. Light and dark follow the system setting automatically.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | #FBF5EC | #1C1916 | Page |
| `card` | #FFFFFF | #2A2521 | Cards, tab pill |
| `field` | #EFE6DA | #352F2A | Inputs, round icon buttons |
| `ink` | #2A2420 | #F6EFE6 | Main text |
| `muted` | #6E625A | #B5A99C | Secondary text (AA on `bg` and `card`) |
| `edge` | #FFFFFF | #3A332D | White die-cut edge around stickers |
| `ledge` / `glow` | rgba(42,36,32,.10) / .08 | rgba(0,0,0,.35) / .30 | Soft shadow under cards: short ledge + wide blur |
| `cta` / `on-cta` | #2A2420 / #FFF | #F6EFE6 / #1C1916 | Primary buttons |
| `brand` / `on-brand` | #FF7A59 / #2A1008 | same | The + button, app icon, screenshots. Nowhere else. |

**Daily number moods.** The hero card's colour and its line of copy follow `getStsMood` in `core`:

| Mood | When | Surface / text (light) | Surface / text (dark) |
|---|---|---|---|
| comfortable | $15/day or more | `good` #CDEFD9 / #0F3D22 | #1F3B2B / #A7F3C4 |
| tight | under $15/day | `tight` #FFE8A3 / #5C4300 | #3D3216 / #FFD966 |
| zero | nothing safe to spend | `zero` #E6E0F5 / #3F3566 | #2C2740 / #D6CCFF |

Zero is lilac, not red. Running out is never shown as an alarm.

**Category stickers** (1.2). A category stores one of these colour names; `src/lib/categories.ts` maps it to the class. An entry with no category gets a 🏷️ on `field`. The same in both modes, since emoji sit on them and no text needs contrast against them: `cat-peach` #FFD9C7, `cat-mint` #CDEFD9, `cat-sky` #CFE6FF, `cat-pink` #FFD6E8, `cat-lilac` #E3D9FF, `cat-butter` #FFF0A8, `cat-aqua` #C8F0EE, `cat-sand` #F1E3CC, `cat-sage` #DCE9C8, `cat-coral` #FFC9BF, `cat-lavender` #D9DCFF, `cat-stone` #E4DED6.

## Type

- **Display: Fredoka** (700 `font-display`, 600 `font-display-bold`). Rounded and playful. The daily number, screen titles, section headings and big amounts. Switched from Bricolage Grotesque on November 17, 2026, for a more playful feel.
- **Body: Nunito** (500 `font-sans`, 600 `font-sans-medium`, 800 `font-sans-bold`). Rounded to match Fredoka, easy to read, with tabular figures for money. Everything else.
- Money always uses `tabular-nums`, so digits don't shift while the number counts.
- The daily number is `text-sts` (96px) in whole dollars, always rounded down (`formatMoneyWhole`), so it never shows more than is safe. It shrinks to fit rather than wrap.
- Use the Tailwind text scale for everything else, and respect Dynamic Type (don't turn off font scaling).

## Shape and space

- Radius: `rounded-sm` 12, `rounded-md` 20, `rounded-lg` 28, `rounded-full` for pills and the + button.
- Spacing on a 4px base. Screens use `px-5` with `gap-5` between blocks.
- Tilt: stickers sit at -6° to 6° (`Sticker` `tilt` -2 to 2). The hero card tilts 1° and the + button -6°. Text inside never tilts on its own.
- Touch targets are at least 44×44.

## Components

- `Raised`: the ink-edge surface. Takes `shape` (a literal radius class) and `surface` (a bg class).
- `Sticker`: an emoji on a `cat-*` fill with an ink edge and a tilt. Sizes `sm` 36, `md` 44, `lg` 80. Decorative, so screen readers skip it; the row's text carries the meaning.
- `StsHero`: the daily number card. Its colour and copy come from its mood, and the number counts to its new value.
- `EmptyState`: a pile of 2 or 3 large stickers, a title and one line saying what to do next.
- `Sheet`, `Field`, `AmountField`, `Chips`, `Button` (`components/form.tsx`): the pieces every form sheet is built from. `Button` is `primary` (ink-edge pill, one per sheet), `secondary` (flat `field` pill) or `plain` (text only: Skip, Delete).
- `DateField`: a date row that opens a month calendar drawn in code.
- `CategoryPicker`: wrapping chips with the category's emoji and name. The chosen chip takes the category's `cat-*` fill with an ink edge and `text-on-brand`, the one text colour that passes contrast on every sticker fill in both modes. Tapping the chosen chip clears it.
- `PeriodSummary`: the card at the top of Activity. Total spent this budget period, one like-for-like line, then a row per category (small sticker, name, share, amount). No charts; those are Plus (2.8).
- `BackButton`: the round chevron at the top of pushed screens.
- `Toast` (`useToast`): the ink pill confirmation above the tab bar, with an optional Undo.
- `TabBar`: a floating pill with three tabs (Home, Activity, Plan) and a separate coral **+** button to its right that opens the Log spending sheet. Settings opens from the gear on Home; bills, goals and term plans live under Plan.

## Motion and haptics

- The daily number counts from its old value to its new one in 600ms with an ease-out (`useCountUp`).
- Logging spending and marking a bill paid give a short confirmation: a medium impact haptic, plus an ink pill toast with Undo for bills ("Logged $45 from Phone"). The + button gives a medium impact as it's pressed.
- Reduce Motion: counts jump straight to the value, and no element slides or springs. Haptics stay.

## Voice

Short, casual, second person. Talk like a friend who's good with money, not a bank, and not a chatbot. Say "semester", not "term" (UK copy keeps "term", since that's what students there say).

- Comfortable: "You're good. That's $92 to last you till Friday, Nov 20."
- Tight: "Bit tight, but you'll make it to Friday, Nov 20. $24 total."
- Zero: "Nothing spare right now. About $310 opens up Fri, Nov 20."
- Empty: "Nothing logged yet. Hit + when you buy something. Takes about three seconds."

Never joke about being short of money, never guilt ("you overspent again"), and never celebrate spending. Never use red for money states.

Avoid the stuff that reads as machine-written: "X: Y" setups ("OSAP or co-op pay: money that..."), stiff verbs ("is set aside", "is funded", "released"), slogans ("keeps your number honest"), and lists of three for rhythm. If it sounds like a notice, rewrite it the way you'd text it.

## Limits

- Safe-to-Spend stays the largest thing on Home.
- The breakdown ("How we got this number") and the monthly backup prompt on Home are flat `card` rows too, so nothing competes with the number.
- A stale or failed number is shown plainly: a flat `card` row with plain text and one button ("You haven't checked your balance in 9 days", "Check it"). No sticker, tilt or mood colour on it.
- Text meets WCAG AA in both modes. Check new token pairs before adding them.
- Art is emoji, SF Symbols and shapes drawn in code only. No illustrations, mascots or paid assets.
- No streaks, points or other game mechanics.

## App icon and splash

A mint sticker with two ink waves, tilted 8°. On coral in light mode; on near-black with a cream die-cut edge in dark mode (`assets/images/icon.png`, `icon-dark.png`). The splash is the sticker alone on `bg` (`splash-icon.png`). They are drawn by `scripts/make-icons.py` (needs Pillow): run `python scripts/make-icons.py assets/images` from `app/mobile` to regenerate them. Don't hand-edit the PNGs.

## Liquid glass (added November 17, 2026)

Only controls that float over content are glass: the tab pill, the + button (glass tinted `brand`) and the quick-add stack. Cards, sheets and stickers stay solid so money stays easy to read. Drawn by `components/glass.tsx`, which uses iOS 26 liquid glass and falls back to a solid `card` on the soft ledge on older systems.

Quick add: tap + to log spending. Hold it for 250ms (half the iOS context-menu hold) to raise four sticker bubbles, nearest first: Money in, Bill, Goal, Semester money. A dim backdrop closes it, and the + turns into an ×. Keep it to four; payday and accounts live in Settings.
