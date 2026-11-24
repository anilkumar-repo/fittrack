# RozFit UI redesign: audit and phased plan (2026-11-24)

I walked every main screen at phone size (375 px) as a brand-new user: onboarding, Home, Train, Progress, Friends, Profile, Settings, Library and Rozi, in light and dark mode. I also measured the stylesheet and read the three reference sites. This document is the plan. We build it one phase at a time, and each phase ends with screenshots and a check before the next one starts.

## 1. The big picture

RozFit has lovely parts: Rozi, the welcome screen, the body pictures, the glass dock and the warm orange. But it has grown feature by feature, so every screen invents its own layout. Your friends' confusion comes from three root causes:

1. **No single design system.** The tokens exist, but most of the CSS bypasses them. Measured in `app/globals.css` (3,905 lines):
   - 35 font sizes and 28 corner radii (a clean system has about 6–8 of each);
   - about 370 raw colour values;
   - 184 padding values and 99 shadows;
   - 72 `!important` overrides and 96 media queries.

   That is why screens feel uneven.
2. **Too many doors to the same rooms.**
   - 23 pages, 8 navigation entries, and the same places linked from 2–4 spots: the profile picture is in both the top bar and the dock; Progress, Friends and Rozi are in both the dock and the Profile menu; the Settings menu links back to Profile.
   - Chats sit in the top bar, but Friends sits in the dock.
   - Progress pages (streak, recovery, week report) are scattered in the Profile menu.
3. **Everything shouts equally.**
   - Each card has its own tint, size and illustration, so nothing wins.
   - On Home, the one thing you came for ("Start workout") is below the fold.
   - On Train, four huge body pictures fill the first screen.

### The core idea for the new design: "one clear next step"

Every screen answers one question, has one primary action, and leads with one hero number. Rozi is the guide who tells you the next step; it isn't decoration on every card. The app should feel calm, warm and fast, like a coach who knows you.

## 2. Audit against your 15 principles

| # | Principle | What I found (examples) | Rating |
|---|---|---|---|
| 1 | Visual hierarchy | Home: "Start workout" is below the hero and the recovery card. Train: 4 large figure cards fill screen one. Progress: three zero tiles and a BMI card come before any training progress. Cards compete in 5 tints. | 🔴 |
| 2 | Information architecture | 23 routes. Progress content is split across Progress, Streak, Recovery, Report and Achievements. Social is split across Friends, Feed, Chats, Buddies, Discover and People. Library, Routines and Mobility are separate. | 🔴 |
| 3 | Navigation and discoverability | The dock has 5 items plus Rozi. The avatar is shown twice. Chats is a top-bar icon. The dock hides on the Rozi page only. The Profile menu repeats the dock. The "Back" link and page titles behave differently from page to page. | 🔴 |
| 4 | Typography and readability | 35 sizes and 6 weights (400–900). Titles wrap awkwardly ("Tuesday, November / 24"). Page titles and eyebrows differ per screen. | 🟠 |
| 5 | Color and contrast | One orange accent, but mint is also used for "selected" (units toggle, Library chips) and blue glass for the hero. The rainbow Settings icons clash with the orange Profile icons. | 🟠 |
| 6 | Spacing and consistency | 184 padding values. Gaps are uneven: onboarding slides have a big empty band, Rozi chat is half empty, Train chips touch the play button. | 🔴 |
| 7 | Interaction design | "Start workout" appears twice on Train (floating and at the bottom). Swap buttons sit outside the rows. Library has 3 overlapping filter systems (category tiles, chips plus "More filters", A–Z). | 🟠 |
| 8 | Feedback and system states | Toasts and the save state are good. Empty states are weak: "6/6 muscles ready" on day 1, and a wall of locked badges. | 🟠 |
| 9 | Task efficiency | Starting a workout takes Home → scroll → Start, or Train → scroll. Logging is fine once started. | 🟠 |
| 10 | Accessibility and inclusivity | Labels exist (aria). To check: contrast of muted text on glass, target sizes on chips and the A–Z index, a reduced-motion pass, and focus rings. | 🟠 |
| 11 | Onboarding and personalization | Install sheet on first load → 3 slides → **21 questions** → a 7-card tour, before the first workout. The day-1 hero is a sweating, worried Rozi. The missed-day sheet says "your trainer sees this" to people with no trainer. | 🔴 |
| 12 | Data visualization | Weekly progress is shown three times on Home (ring, "Train 0/3", week strip). The muscle picture doesn't match the target text. Charts are good where they exist (exercise stats). | 🟠 |
| 13 | Trust and transparency | Good: sync state, privacy notes, approval cards. Bad: internal "Rules 2026.11.12.1" in every footer. Guilt tone ("Hmph. We missed one."). | 🟠 |
| 14 | Motion and micro-interactions | The dock shrink, glass glider and celebrations are nice but uneven. There are no shared timings, and heavy blur is everywhere. | 🟠 |
| 15 | Responsive design and performance | The phone-first layout works. Heavy `backdrop-filter` blur on many stacked layers costs battery and frame rate on mid-range Android. The desktop sidebar is a separate design. | 🟠 |

## 3. The new structure

### Navigation: 4 tabs + Rozi

```
[ Today ]  [ Workouts ]   (Rozi)   [ Progress ]  [ Together ]
```

- **Today:** Home and Train merged. Today's workout card is first, with one big Start button above the fold. Below it: Rozi's one-line note, the week strip (shown once), and a compact recovery row.
- **Workouts:** the Library, My routines, Stretch & mobility and Plan custom in one place, with one search box and one filter row.
- **Rozi (centre, raised):** the chat. The dock stays visible here too.
- **Progress:** one hub with sections in this order: This week (ring + strip) → Strength (records, charts, plateaus) → Body (weight, BMI) → Streak calendar → Badges (earned first, the next 2 to earn, the rest folded away).
- **Together:** Friends, Feed, Chats (with the unread badge here), Train together and Trainer, as segments at the top of one page.
- **You:** opened from the avatar at the top right only. Profile, Your plan, Settings, Install and Help in one sheet.
- **Remove the duplicates:**
  - the avatar from the dock and the chat icon from the top bar;
  - the Profile "menu of everything";
  - the footer version (moves to Settings → About).
- **Old URLs** (`/streak`, `/recovery`, `/report`, `/feed`, `/chats`, …) keep working, so notifications and links don't break. They open the right section of the new hub.

### Page anatomy (every screen the same)

- **Large title**, shrinking on scroll. One line, with no date eyebrow except on Today.
- **One primary button** per screen, always the same style (dark ink, full width or pill). Secondary actions are text or outline only.
- **Cards:** one style. Solid surface, one radius, one shadow. No tinted cards except semantic ones (success, warning, Rozi tip). No cards inside cards.
- **Glass** only on floating layers (dock, sheets, top bar), not on content cards. This calms the look and helps performance.

## 4. The design system (Phase 1 deliverable: `docs/DESIGN.md` + tokens)

| Token | New scale |
|---|---|
| Type | 6 sizes: 12 caption · 14 body-small · 16 body · 20 title-s · 28 title · 40 display. Weights: 400, 600, 800. Line height 1.45 body, 1.15 titles. Numbers use tabular figures. |
| Spacing | 4-point steps: 4 · 8 · 12 · 16 · 24 · 32 · 48. Page gutter 16. Card padding 16. Gap between cards 12. |
| Radius | 3: 10 (fields, chips) · 20 (cards, sheets) · pill (buttons, tabs). |
| Colour | One brand orange (actions and highlights). One ink. Two surfaces. Semantic colours: success green, warning amber, danger red, and recovery mint (used **only** for recovery and readiness). No other tints. AA contrast checked. |
| Elevation | 3 shadows: flat, raised, floating. Blur only on floating layers. |
| Motion | 150 ms (press and hover), 250 ms (sheets and tabs), 400 ms (celebrations). One easing. Lists stagger 40 ms. Everything off with `prefers-reduced-motion`. |
| Targets | At least 44×44 px for every tappable item. |

**Shared components to build once and use everywhere:** PageHeader, Button (primary / secondary / text), Card, ListRow, Chip / Segmented control, Stat (one hero number + label + delta), Sheet, EmptyState (Rozi + one sentence + one action), Toast, ProgressRing, WeekStrip.

**Guard:** a stylelint rule (or a simple test) that fails on raw colours, font sizes and radii outside the tokens, so the system can't drift again.

## 5. Strong ideas that make it feel special

1. **"Your next step" card.** Rozi picks one thing for you right now: start today's workout, log yesterday's, drink water, stretch, or rest. That replaces the three competing Home cards.
2. **Start in one tap.** A long-press on the Today tab or the home-screen icon (a PWA shortcut) jumps straight into today's workout.
3. **A focused workout mode.** Once started, the screen becomes a calm, full-screen player: one exercise at a time, a big set logger, the rest timer as a ring, and swipe to the next move. The dock hides (it does now, but inconsistently).
4. **Progress that tells a story.** One headline per week ("Squat up 5 kg this month 💪"), then the charts. Plateaus from R12 show as a friendly tip, never an alarm.
5. **Onboarding in under a minute.** 6 questions (name, goal, days, session length, equipment, level), then straight into a first workout. The other 15 answers are asked later, one at a time, when they matter (Rozi: "Want sets tuned to your body? Add your height"). No install sheet until after the first finished workout. Three 1-line tips instead of the 7-card tour.
6. **Kind tone everywhere.**
   - A missed day becomes "No worries. Want to move it to today?" Never guilt, never a blocking sheet on open.
   - Trainer wording only shows when you have a trainer.
7. **Rozi's moods mean something.** Happy when you're on track, sleepy on rest days, proud after records. Never anxious on day 1.

## 6. The phases

Each phase is shippable on its own, keeps old URLs working, and ends with:
- before/after screenshots at 375, 390 and 430 px, light and dark;
- a contrast and target check;
- tests, type check, lint and build.

The plan rules still apply: you commit and deploy, I don't refactor app logic, and only the UI layer changes.

| Phase | What | Done when |
|---|---|---|
| **1. Foundation** ✅ 2026-11-24 | `docs/DESIGN.md`, new tokens in `globals.css`, the shared components above, and the token guard. Existing screens switch to tokens (no layout changes yet). | One type scale, spacing scale, radius set and shadow set in use. Raw values cut by ~80 %. Screens look the same or calmer. |
| **2. Navigation and shell** ✅ 2026-11-24 | The new dock (Today · Workouts · Rozi · Progress · Together), the You sheet from the avatar, one PageHeader, duplicates removed, old URLs redirected to the right section, the footer version moved. | Every page is reachable in ≤ 2 taps with no duplicate entry points. The dock is the same on every page. |
| **3. Today** ✅ 2026-11-24 | Home and Train merged. Workout card first with Start above the fold. The "next step" card. The week strip once. Compact recovery. Day-1 and rest-day states. | You can start a workout from opening the app in 1 tap. No repeated numbers on the screen. |
| **4. Workout mode** ✅ 2026-11-24 | The focused full-screen player: one exercise at a time, set logger, rest ring, swap inside the row, warm-up offered before Start. | A full workout is logged without scrolling hunts. Test with 3 friends. |
| **5. Progress hub** ✅ 2026-11-24 | One page in story order. Achievements folded. Good empty states. Streak, Recovery and Report as sections. | Progress, records and body all fit in one scroll. Old pages redirect. |
| **6. Together hub** ✅ 2026-11-24 | Friends, Feed, Chats, Train together and Trainer under one segmented page. The chat badge lives here. | Social actions are found without the top-bar icon. |
| **7. Workouts and Rozi** ✅ 2026-11-24 | Library, Routines and Mobility in one tab with one search and one filter row. Rozi chat: no empty half-screen, starter questions, the dock visible. | One filter system. Rozi's first screen is useful. |
| **8. Onboarding and first run** ✅ 2026-11-24 (UI polish only; all 21 questions kept) | 6 questions, then the first workout. Questions asked later one at a time. The install sheet moves after the first workout. 3 tips instead of the tour. Kind missed-day flow. | A new user starts a workout in < 60 seconds. |
| **9. Polish** ✅ 2026-11-24 | Motion timings, feedback states, an accessibility pass (contrast, targets, focus, reduced motion, screen reader), a blur and performance budget, the desktop layout from the same components. | Lighthouse accessibility ≥ 95. Smooth 60 fps scroll on a mid-range Android. Friends retest. |

## 7. What I need from you before Phase 1

1. **Navigation:** OK with the 4 tabs + Rozi structure above (Today · Workouts · Rozi · Progress · Together, with You behind the avatar)?
2. **Look:** keep the warm orange + glass identity but calmer (my recommendation), or explore a new direction first? I can make a clickable mockup of the new Today screen and dock before we touch the app.
3. **Onboarding:** OK to cut setup to 6 questions and ask the rest later?

## References used

- **impeccable.style:** its anti-patterns ("cards in cards", "everything equal", "status-chip soup"), "only one should win" for title versus action, micro-interaction timings (150 ms press), and contrast and target checks.
- **getdesign.md:** one `DESIGN.md` as the single source of truth for tokens, components and the reasons behind them.
- **ui.watermelon.sh:** a React component catalogue. Useful as a reference for blocks and animations, not as design rules. Check licences before copying any code.

## 8. Decisions after mockup v1 (2026-11-24)

The mockup: https://claude.ai/artifact/7cTxGV7mMkhBzr4u7rhRi2 (v2 is the dark version)

Your feedback on v1: "keep more glass", keep the exercise library as it is but resized with its mascots, use the Rozi images, Profile with its other details behind a three-line menu, and a "Dark and premium" look.

These replace parts of §3 and §4:
- **Look: dark and premium, glass-first.**
  - Background: ink `#0B0F12` with soft orange and teal glows.
  - Cards: frosted glass (gradient fill, a thin light edge, blur 24 px). This replaces "glass only on floating layers".
  - Primary buttons: an orange gradient with a soft glow and dark text, for contrast.
  - Text: `#F4F1EC`, muted `#A3ABA9`.
  - Mint `#6FD3BE` only for recovery and done sets.
  - A light theme stays available, using the same tokens.
- **Performance guard for glass:** blur only on visible cards (no stacked blur inside blur), and a cheaper fallback on low-end devices (`prefers-reduced-transparency` / a setting).
- **Rozi everywhere:** the app already has about 45 Rozi scenes and 17 faces. Every main screen gets a real scene:
  - Today: time-of-day training;
  - Workouts: the body-area mascots;
  - Progress: report card;
  - Together: cheer;
  - Rozi: chat hello;
  - workout mode: workout;
  - finish: done-day or personal record;
  - badges: trophy.
- **Workouts tab:** keeps the current Library design (mascot category tiles, Stretch & mobility tile, chips, A–Z list), resized: 2-column tiles about 112 px tall with 84 px mascots.
- **Profile:** a page, opened from the avatar at the top right. It shows the avatar, name, plan, stats, level and badges. The ☰ button at its top right opens the rest: Your plan, Notifications, Appearance, Rozi memory & data, Install, Help, Sign in/out. This replaces the "You sheet" and the separate Settings page.
- **Still the same:** the dock (Today · Workouts · Rozi · Progress · Together), the focused workout mode, the type and spacing scales, 44 px targets.

### Mockup v3 changes (2026-11-24)

- **Water reminder on Today:** a glass card with Rozi's water scene, litres against the daily target, a glowing blue bar, a "behind pace" hint, and one-tap **+ Glass 250 ml** / **+ Bottle 500 ml**. Water uses its own cool blue (`#7CC7FF`), never orange or mint. It reuses the app's existing water target and push nudges.
- **The dock hides in Rozi chat.** Opening Rozi hides the dock completely, so the chat and its input use the whole screen. A ← back button returns to the tab you came from.
- **The dock resizes on scroll** (every other tab):
  - Scrolling down shrinks it to a slim pill (icons only, Rozi smaller).
  - Scrolling up, or reaching the top, brings it back to full size with labels.
  - Uses 250 ms transitions and is instant with reduced motion.
  - Switching tabs always shows the full dock.


### Decision on onboarding (2026-11-24)

Your words: "are we skipping 21 questions and making 6 questions? if yes dont do that keep that same and make ui polish".

- **Keep all 21 setup questions, unchanged, in the same order.** This replaces idea 5 in §5 ("6 questions, ask the rest later") and the Phase 8 row's "6 questions" scope.
- **Phase 8 is now UI polish of the existing setup flow only**, using the design system:
  - spacing (for example the empty band on the intro slides);
  - one selection style;
  - type sizes;
  - buttons;
  - the progress bar;
  - dark-theme readability.
- No question is added, removed, merged or moved later.

## Follow-up: phone review (2026-11-24)

After the 9 phases, a real-iPhone pass fixed:
- the Today card overlap (split title, smaller Rozi, streak above the button);
- Progress folds (records, history) and the even body weight form;
- the page-switch flicker (the fade-up animation is removed);
- Settings sections opening mid-page;
- the area beside the dock;
- a lighter orange.

The details are in `docs/SETUP_AND_HISTORY.md`.

A second pass (2026-11-25) fixed:
- the water card (a glass orb with waves, the undo button tidied);
- tab bars sliding like the dock;
- the motion when opening and closing an exercise;
- text-link arrows.
