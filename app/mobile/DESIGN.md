# Current design system: Sticker Book

The source of truth for how the iOS app looks, moves and talks. `app/web/DESIGN.MD` is only the record of the frozen web pages. Tokens live in `src/global.css`; screens use them through Tailwind classes (Uniwind), never raw hex values.

Chosen by Augustine on November 16, 2026 (ROADMAP 1.0b), from three directions mocked side by side: <https://claude.ai/artifact/8xCRXnPZD5LRXATG8AAdpG>.

## The idea

A budget that feels like a sticker book: warm paper, chunky type, and die-cut stickers for categories. It should feel friendly and a little handmade, never like a bank.

**What sets it apart.** DaTrack and other trackers also give each category an emoji and a pastel colour. Current's difference is the **ink edge**: every sticker, card, the tab pill and the + button has a 2px ink outline and a hard 3px offset shadow with no blur (`components/raised.tsx`). Soft pastel apps have no edge at all. Keep this edge on anything new that sits on top of the page; drop it only for flat text rows inside a card.

## Colour

All colour comes from tokens. Light and dark follow the system setting automatically.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | #FBF5EC | #1C1916 | Page |
| `card` | #FFFFFF | #2A2521 | Cards, tab pill |
| `field` | #EFE6DA | #352F2A | Inputs, round icon buttons |
| `ink` | #2A2420 | #F6EFE6 | Main text |
| `muted` | #6E625A | #B5A99C | Secondary text (AA on `bg` and `card`) |
| `edge` | #2A2420 | #0B0A09 | Sticker outline and hard shadow |
| `cta` / `on-cta` | #2A2420 / #FFF | #F6EFE6 / #1C1916 | Primary buttons |
| `brand` / `on-brand` | #FF7A59 / #2A1008 | same | The + button, app icon, screenshots. Nowhere else. |

**Daily number moods.** The hero card's colour and its line of copy follow `getStsMood` in `core`:

| Mood | When | Surface / text (light) | Surface / text (dark) |
|---|---|---|---|
| comfortable | $15/day or more | `good` #CDEFD9 / #0F3D22 | #1F3B2B / #A7F3C4 |
| tight | under $15/day | `tight` #FFE8A3 / #5C4300 | #3D3216 / #FFD966 |
| zero | nothing safe to spend | `zero` #E6E0F5 / #3F3566 | #2C2740 / #D6CCFF |

Zero is lilac, not red. Running out is never shown as an alarm.

**Category stickers** (1.2), the same in both modes, since emoji sit on them and no text needs contrast against them: `cat-peach` #FFD9C7, `cat-mint` #CDEFD9, `cat-sky` #CFE6FF, `cat-pink` #FFD6E8, `cat-lilac` #E3D9FF, `cat-butter` #FFF0A8, `cat-aqua` #C8F0EE, `cat-sand` #F1E3CC, `cat-sage` #DCE9C8, `cat-coral` #FFC9BF, `cat-lavender` #D9DCFF, `cat-stone` #E4DED6.

## Type

- **Display: Bricolage Grotesque** (800 `font-display`, 700 `font-display-bold`). The daily number, screen titles, section headings and big amounts.
- **Body: DM Sans** (400 `font-sans`, 500 `font-sans-medium`, 700 `font-sans-bold`). Everything else.
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
- `Toast` (`useToast`): the ink pill confirmation above the tab bar, with an optional Undo.
- `TabBar`: a floating pill with three tabs (Home, Activity, Plan) and a separate coral **+** button to its right that opens the Log spending sheet. Settings opens from the gear on Home; bills, goals and term plans live under Plan.

## Motion and haptics

- The daily number counts from its old value to its new one in 600ms with an ease-out (`useCountUp`).
- Logging spending and marking a bill paid give a short confirmation: a medium impact haptic, plus an ink pill toast with Undo for bills ("Logged $45 from Phone"). The + button gives a medium impact as it's pressed.
- Reduce Motion: counts jump straight to the value, and no element slides or springs. Haptics stay.

## Voice

Short, casual, second person. Talk like a friend who's good with money, not a bank.

- Comfortable: "You're in good shape. That's $92 until Friday."
- Tight: "Tight, but it gets you to Friday. $24 in all."
- Zero: "Nothing spare right now. About $310 frees up Fri, Nov 20."
- Empty: "Nothing logged yet. Tap + to log your first purchase. It takes about three seconds."

Never joke about being short of money, never guilt ("you overspent again"), and never celebrate spending. Never use red for money states.

## Limits

- Safe-to-Spend stays the largest thing on Home.
- A stale or failed number is shown plainly: a flat `card` row with plain text and one button ("Balance last checked 9 days ago", "Check now"). No sticker, tilt or mood colour on it.
- Text meets WCAG AA in both modes. Check new token pairs before adding them.
- Art is emoji, SF Symbols and shapes drawn in code only. No illustrations, mascots or paid assets.
- No streaks, points or other game mechanics.

## App icon and splash

A mint sticker with two ink waves, tilted 8°. On coral in light mode; on near-black with a cream die-cut edge in dark mode (`assets/images/icon.png`, `icon-dark.png`). The splash is the sticker alone on `bg` (`splash-icon.png`). They are drawn by `scripts/make-icons.py` (needs Pillow): run `python scripts/make-icons.py assets/images` from `app/mobile` to regenerate them. Don't hand-edit the PNGs.
