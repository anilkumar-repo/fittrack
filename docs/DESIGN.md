# RozFit design system

The single source of truth for how RozFit looks and behaves. Every screen uses these tokens and components; a new value
needs a reason written here first. The plan and history live in `docs/UI_REDESIGN_PLAN.md`. The approved look is the
mockup at https://claude.ai/artifact/7cTxGV7mMkhBzr4u7rhRi2.

## 1. Principles

1. **One clear next step.** Each screen answers one question. It has one primary button and one hero number.
2. **Rozi guides.** Rozi's scenes mark moments: today's session, water, rest, records, celebrations. Rozi is never decoration on every card.
3. **Dark, warm, premium.** Deep ink with soft orange and teal light, frosted glass cards, and glowing orange actions.
4. **Kind.** No guilt, no blocking pop-ups when the app opens, and plain words.
5. **Fast.** Glass is used where it is seen, never stacked. Motion is short. Everything works with reduced motion.

## 2. Themes

- **Dark is the default** for people who haven't chosen a theme. Light stays in Settings → Appearance, built from the same token names.
- Tokens live in `app/globals.css`:
  - `:root` holds the scale tokens and the light colours;
  - `:root[data-theme="dark"]` holds the dark colours.

## 3. Colour (dark theme)

| Token | Value | Use |
|---|---|---|
| `--page` / `--page-bg` | `#0B0F12` with orange (top right) and teal (left) glows | App background |
| `--glass-fill` | gradient `rgba(255,255,255,.10)` → `.035` | Cards |
| `--glass-edge` | `1px solid rgba(255,255,255,.10)` | Card edge |
| `--ink` | `#F4F1EC` | Text |
| `--muted` | `#A3ABA9` | Secondary text (AA on the page) |
| `--faint` | `#939B9A` | Least important text (AA: 6.8:1 on the page, 5:1 on cards; light theme `#646F6E`, 4.6:1) |
| `--accent` | `#FF8A5C` | Actions, highlights, the active tab |
| `--button-primary-bg` | gradient `#FF9A6E` → `#F0683F`, text `#1A0C06` | The one primary button |
| `--success` / mint | `#6FD3BE` | Recovery, done sets, "ready" — nothing else |
| `--water` | `#7CC7FF` | Water only |
| `--warn` / `--danger` | amber / coral red | Warnings, errors |

Never put white text on orange; use the dark `--on-accent`. Colours that must be told apart also differ in lightness.

## 4. Type

The system font (SF on iPhone, Roboto on Android). Weights: 400 body, 600–700 labels, 800 titles and numbers. Numbers use
`font-variant-numeric: tabular-nums`.

| Token | px | Use |
|---|---|---|
| `--text-2xs` | 10 | Badge counts only |
| `--text-xs` | 11 | Dock labels, tiny captions |
| `--text-sm` | 12 | Captions, eyebrows, chips |
| `--text-md` | 13 | Secondary lines |
| `--text-base` | 15 | Body |
| `--text-lg` | 17 | Emphasised body, list titles |
| `--text-xl` | 20 | Card titles |
| `--text-2xl` | 22 | Section titles |
| `--text-3xl` | 26 | Page titles |
| `--text-4xl` | 30 | Hero titles, big numbers |
| `--text-5xl` | 40 | Celebrations |

Display words (the giant "Day 1", 54–72 px) are the only sizes outside the scale.

*Phase 1 maps every existing size to the nearest token (±2 px). Later phases narrow the set as screens are rebuilt.*

## 5. Space, radius, elevation

- **Spacing:** `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 24 · `--space-6` 32 · `--space-7` 48.
  - Page gutter 16. Card padding 16 (hero cards 20). Gap between cards 12.
- **Radius:** `--radius-xs` 6 · `--radius-sm` 12 (fields, thumbs) · `--radius-md` 16 (inner cards, set rows) · `--radius-lg` 22 (cards) · `--radius-xl` 28 (sheets, hero) · `--radius-pill` 999 (buttons, chips, dock).
- **Elevation:** `--shadow-1` (flat), `--shadow-2` (cards), `--shadow-3` (floating: dock, sheets, menus).
- **Glass:** `--glass-blur` on cards and floating layers. Never blur inside a blurred parent.

## 6. Motion

- `--dur-fast` 150 ms: press and hover.
- `--dur-med` 250 ms: tabs, sheets, the dock resizing.
- `--dur-slow` 400 ms: celebrations.
- Easing: `--ease` `cubic-bezier(.2,.8,.2,1)`.
- Lists stagger by 40 ms.
- Press feedback: `scale(.97)`.
- `prefers-reduced-motion: reduce` turns transitions and animations off.

## 7. Layout and navigation

- **Dock:** Today · Workouts · (Rozi, raised) · Progress · Together.
  - It is the same on every page and hides in Rozi chat and workout mode.
  - It shrinks to an icon-only pill while scrolling down and returns on scroll up or at the top.
- **Tab bars** (`.segmented`, `.library-chips`) work like the dock: tap a tab, or press and slide the orange lens.
  Keep them to one row that fits the screen.
- **Top bar:** large page title, plus your picture at the top right, which opens Profile. Profile's ☰ holds the plan, settings and the rest.
- **Targets:** at least 44 × 44 px.
- **Content:** max 560 px wide on phones and tablets.

## 8. Components (`src/components/ui/`)

| Component | Notes |
|---|---|
| `Button` | `variant`: primary (orange glow, one per screen) · glass · text. `size`: md (44) / lg (54). |
| `Card` | Glass card. `tone`: default · water · success · warning. Never nest cards. |
| `PageHeader` | Eyebrow, title, optional trailing action. |
| `ListRow` | Icon/thumb, title, detail, trailing value or chevron. At least 56 px tall. |
| `Segmented` | 2–5 options. The selected one is a lighter pill. |
| `Stat` | One hero number, label, optional delta. |
| `EmptyState` | A Rozi scene, one sentence, one action. |
| `Chip` | Static tag (muscles, filters). |

Their CSS lives in `globals.css` under "UI kit" and uses tokens only.

## 9. Accessibility (Phase 9)

- Every text colour passes WCAG AA (4.5:1) on its background in both themes.
- A visible focus ring (`--accent`, 2 px) on everything you can tap, for keyboard and switch users.
- `prefers-reduced-motion`: animations and transitions are off app-wide.
- `prefers-reduced-transparency`: solid cards instead of glass.
- Tap targets: 44 px or more. The two 7-day calendars (40 px and 37 px wide on a phone) are the known exceptions. They are well above WCAG's 24 px minimum.
- Glass budget: about 8 blurred layers on a screen, never a blur inside a blur.

## 10. Guard

`src/lib/design-guard.test.ts` (it ignores comments) fails the test run when `globals.css` gains a raw font size or single-value radius
outside the tokens, or more raw colours than the recorded ceiling. Lower the ceiling as screens move to tokens; never raise it.
