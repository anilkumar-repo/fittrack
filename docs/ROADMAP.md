# RozFit roadmap (written 2026-11-16)

This plan combines three things:
- your 18 comments;
- the "Complete Product & Technical Implementation Plan";
- every reference picture in `Downloads/Refer` (69 screenshots and 3 screen recordings).

**Rule kept from your plan:** build on what exists, never rebuild it. That means the planner, progress, streak, Rozi, mobility, friends and trainer rules all stay.

Status key: ✅ done · 🟡 started · ⬜ planned

---

## 1. What each reference showed, and what RozFit takes from it

| Screens | What it shows | What RozFit does with it |
|---|---|---|
| 8009 | Our loading screen ("Getting your training space ready…") | ✅ Replaced with the bouncing Rozi you picked (comment 2). |
| 8010, 8011 | "You missed Saturday" after a real workout; the calendar shows 13–14 missed | ✅ **Fixed** (comment 3/15). See SETUP_AND_HISTORY "2026-11-16". |
| 8012, 8028 | Home "Day 1" with sleepy Rozi; Rozi/Profile scribbles on the dock | ✅ Rozi follows the time of day on rest days too. ✅ Dock now has Profile, with Rozi in the corner. |
| 8013 | Mobility player, with the page behind it scrolling | ✅ Page locks behind every sheet and player. |
| 8014 | "Recovery map that's always live" (paywall) | ⬜ Phase B: our own Recovery map (section 3). |
| 8015, v3 | Exercise picker with category pills, A–Z side strip, round add badges | ✅ A–Z strip in Library. ⬜ Phase D: the same picker for building your own workout. |
| 8016, 8031–8034 | Exercise detail with tabs: About / Anatomy / History / Charts / Records | ⬜ Phase D: tabs on our exercise guide, using data we already save. |
| 8020 | Notifications error: "row-level security … push_subscriptions" | ✅ Fixed in code + migration (waiting for "Yes, apply it"). |
| 8025 | Progress cut on the right | ✅ Safari-proof containment (see history). |
| 8029, 8030 | Strong-style logger: set types W/D/F, "Previous" column, rest timer ring with −10/+10 | 🟡 We have a logger + rest timer. ⬜ Phase D: set types, previous column, ±10 s. |
| 8035–8037 | Wheel pickers for birthday and height, ruler slider for weight, kg/lb and cm/ft toggles | ⬜ Phase A: onboarding v2 uses these pickers (much faster than typing). |
| 8038–8052 | Hevy onboarding: own vs guided, workouts per week, cardio, length, focus muscle, where you train, equipment by picture, "Your personalized program" | 🟡 We ask most of these. ⬜ Phase A: add *focus muscle*, *gym type → equipment presets*, equipment pictures, and a "Your program" summary card. |
| 8053–8055 | Welcome slides (log sets, measure progress, join community) | ⬜ Phase A: 3 short Rozi slides before sign-in. |
| 8056, 8057, v1 | Feed, suggested athletes, Discover/Search with Follow, empty-feed invite | ⬜ Phase C: Community (section 4). |
| 8058, 8059 | Exercise "How to" with numbered steps, Summary / History / Leaderboard | ⬜ Phase D: numbered steps + a friends leaderboard per exercise. |
| 8060–8079 | Gymverse onboarding: goal, "did you know" facts, experience, gym type, equipment toggles, duration wheel, Health access, stats check, calorie/protein, schedule first workout, reminders, "building your plan" progress | ⬜ Phase A: "Building your plan…" animated step (Rozi assembles the plan), "When's your first workout?" (Today / Tomorrow / Not sure), and the notification ask *at the end of onboarding* (better acceptance). ⬜ Phase G: calories/protein. |
| 8080 | Paywall | Not planned. RozFit stays free. |
| 8081, 8083, 8085 | Apple Watch setup card; Settings with Apple Watch / Apple Health "Connect" | ⬜ Phase F (section 6). It needs the native wrapper. |
| 8082–8086, v1 | Settings grouped: Account, Preferences, Guides, Help, social links; Profile with ☰ | ✅ Profile + ☰ → Settings. ⬜ Phase A: Settings regrouped into these sections with a search. |
| v2 recording | Home "Recovery Status" carousel: muscles ready 6/6, train 0/3, move 0/10k; this week radar; stretch & recover; muscle readiness with an animated figure | ⬜ Phase B: Home recovery carousel (section 3). |
| v3 recording | Cardio list with moving 3D exercise loops; tap opens a sheet with a loop + instructions | ⬜ Phase E: motion pictures (section 5). |

---

## 2. Trainers (comment 5) — recommendation

**Today:** a client makes a code and the trainer types it in. A client sees one trainer.

**Recommended:** many trainers per person, three ways to connect. Each way needs consent from both sides.

1. **From Friends (your idea):** on a friend's card, choose ⋯ → **Ask to be my trainer**. The friend gets a request ("Anil wants you as their trainer · Accept / Decline"). No code to type, because you're already friends. This becomes the main way.
2. **Trainer code (kept):** for a trainer who isn't a friend yet, for example at a new gym. The client shares a code and the trainer enters it. This is the flow that already works.
3. **QR at the gym:** the trainer shows a QR on their phone. The client scans it, lands on `/join/<code>`, and taps "Add as my trainer". This is the fastest way in person.

Rules:
- Each link is per gym or person and can be ended by either side at any time.
- A client can have several trainers, for example a gym coach and a yoga coach.
- Each trainer sees only what the client allows: workouts, body, missed reasons.
- If two trainers change the same rule, the latest change wins and shows in the audit.

Database (one migration, Phase A): `trainer_clients` already exists.
- Add a `status` of `requested` and an `origin` (`friend`, `code` or `qr`).
- Add an RPC `request_trainer(friend_id)`, plus `respond_trainer_request`.
- Add a per-link `shares` JSON.
- Remove the `limit(1)` in the app, so every active trainer loads.

---

## 3. Recovery map + Home recovery carousel (comments 11.1, 12) — Phase B

This is our own design, not a copy. It reuses `MusclePicture`, `regionsForExercises`, check-ins and reviews, as your plan asks.
- **Home "Recovery" card (a swipeable carousel, 4 slides):**
  1. *Muscles ready* ring (for example 5/6 ready), *Workouts this week* ring (2/3) and *Water* ring.
  2. *This week* radar: chest, back, shoulders, arms, legs and core, filled by the sets you logged.
  3. *Stretch & recover*: today's mobility pick, with its picture moving.
  4. *Readiness*: the body figure tinted by status.
- **`/recovery` page:** front and back body. Tap a muscle to see the last date trained, sets, soreness you reported, the exercises used, and a matching stretch routine.
- **Statuses:** recently trained (red), recovering (amber), ready (green), reported soreness or pain (striped), not enough data (grey). The page always says: "a guide from your logs, not a medical measurement".
- **Rozi** says one line on it, for example "Legs still recovering — upper body or a stretch today?"

---

## 4. Community: Feed, Discover, Chats (comment 12) — Phase C

- **Feed:** posts made from finished workouts. A post carries the title, a note, a photo (optional), the muscle map, the moves with sets and best weights, likes and comments. Who sees it is set per post: friends or public.
- **Discover:** search by name, suggested people (friends of friends, the same gym, similar goals), a Follow button and *Invite friends*.
- **Chats:** one-to-one and small groups (for example "Gym buddies"), with Rozi stickers (the 17 faces) and a "Share my workout" card. Supabase Realtime carries the messages.
- **Safety:**
  - Report and block.
  - Private by default for under-18s.
  - Photos are checked for size and type.
  - No location is shared.
- **Database:** `posts`, `post_media`, `post_likes`, `post_comments`, `follows`, `conversations`, `conversation_members` and `messages`, all protected by row-level security. The existing `friends` stays (friends = mutual follows).

---

## 5. Motion pictures (comments 12, 18) — Phase E

The moving 3D figures in the references belong to that app, so we make our own:
- **Path 1 (fast, cheap):** a 2–4 frame "flip" loop built from our own figure pictures (start and end positions). We already have most start/end pictures; a CSS sprite animation shows them.
- **Path 2 (best):** short looping clips (WebM/MP4, about 200 KB each), generated from our figure style. I'll write prompts per exercise like the image prompts. They play muted, in a loop and inline, and pause when off screen.
- **Rozi micro-animations:** Rozi bounces on "Workout done", waves on Home in the morning, and yawns at night (a CSS keyframe, no new art).

---

## 6. Apple Watch, Apple Health, Google Fit (comment 18) — Phase F

A web app (PWA) **cannot** talk to Apple Watch or read Apple Health; Apple only allows that from a real app. Plan:
1. Wrap RozFit with **Capacitor** (the same Next.js code inside a native shell) to make iOS and Android apps.
2. **Apple Health / Health Connect (Android):** read steps, sleep, resting heart rate and body weight, and write finished workouts. This is opt-in; data never overrides safety rules.
3. **Apple Watch companion (SwiftUI):** today's workout list, a set checkmark, a rest timer on the wrist, and heart rate during the session.
4. Publish to TestFlight first, then the App Store and Play Store. You need an Apple Developer account (USD 99/year) and a Google Play account (USD 25 once).

---

## 7. Your "Complete Product & Technical Implementation Plan" — review

It's a strong plan and matches the code. My changes:

- **Agree:** Rozi Chat first (P0), with deterministic answers from real data and no paid AI. ✅ **Rozi chat v0 is live at `/rozi`.** It covers today, next and last workout, this week, streak, records, stretches, weight and water, with a test for every suggested question (`src/lib/rozi-chat.ts`).
- **Change 1:** keep the folder structure we already use. Chat logic goes in `src/lib/rozi-chat*.ts` and screens in `src/components/screens/`, not a new `src/features/`. It's the same idea with less churn.
- **Change 2:** answer on the device first (the app already has all the person's data loaded), and only add `/api/rozi/chat` when chats need saving across devices. This is faster and cheaper, and nothing leaves the phone.
- **Change 3:** the recovery heatmap (P1) moves up next to the chat, because your references and comment 12 ask for it on Home.
- **Later, optional:** an AI model only for free-text questions the dictionary can't answer. It gets your summary data, never raw history, and is turned on per person.

---

## 8. New ideas of mine (unique to RozFit)

1. **Rozi grows with you.** Rozi gets new outfits, accessories and a little gym as your streak and level grow. Users can choose any unlocked Rozi as their avatar (the 17 faces are the start).
2. **Gym-buddy live mode.** Two friends start the same workout and see each other's sets tick in live, from different gyms or cities, with cheering stickers.
3. **Rest-day missions.** Instead of "nothing today", Rozi gives a 5-minute mission (a stretch, a walk, water) that keeps a "rest streak", so rest days feel like progress.
4. **Streak shield.** You earn one "shield" per 7-day streak and it covers a sick day automatically. This is kinder than repairs.
5. **Plate calculator + warm-up builder.** Type 80 kg and see which plates go on each side, plus auto warm-up sets (40% / 60% / 80%).
6. **"Why" wall.** Your reason ("for my kids", "fit for the wedding") shows as a photo card on tough days and in comeback reminders.
7. **Trainer broadcast.** A trainer sends one tip or changes one rule for all their clients at once.
8. **Monthly Rozi report card.** A shareable story image (Instagram-sized) with workouts, PRs, streak and Rozi's grade. It's free marketing.
9. **Gym check-in by QR.** A gym prints a RozFit QR; members scan it to log "at the gym", see gym leaderboards and find gym buddies.
10. **Form-check video (later).** Record a set; the trainer gets it in the chat with timestamped comments.

---

## 9. Phases (recommended order)

| Phase | What | Database? | Size |
|---|---|---|---|
| **0 — Fixes (this change)** ✅ | Wrong-date workouts, rest-day training, BMI asked twice, notifications RLS, Progress cut, mobility scroll lock, Rozi by time of day, Profile + Rozi dock, install sheet, A–Z strip, Rozi chat v0, CI branches | 1 migration (push claim) + 1 data repair | — |
| **A — Onboarding v2 + Settings + Trainers** | Wheel/ruler pickers, focus muscle, gym-type presets, "building your plan", first-workout day, notification ask at the end. Settings regrouped. Trainer from Friends + QR. New loading style | 1 migration (trainer requests) | ~1 week |
| **B — Recovery** | Home recovery carousel, `/recovery` body map, weekly Rozi report | none (computed from logs) | ~1 week |
| **C — Community** | Feed, Discover, follows, likes/comments, chats | 1 large migration + Storage bucket | ~2 weeks |
| **D — Pro tracking** | Set types W/D/F, previous column, ±10 s timer, exercise tabs (About/History/Charts/Records/How to), estimated 1RM, build your own routine with the A–Z picker | small migration (set type) | ~1–2 weeks |
| **E — Motion** | Exercise loops (flip frames first, then clips), Rozi micro-animations | none | ongoing |
| **F — Native + Health + Watch** | Capacitor iOS/Android, Apple Health / Health Connect, Watch companion | small (health samples) | ~3–4 weeks |
| **G — Nutrition + Voice** | Protein/calorie targets and logging; voice Rozi | 1 migration | ~2 weeks |

Each phase goes `feature/*` → `develop` (dev URL) → `main`, with tests, a preview check and a docs entry (see `BRANCHES_AND_ENVIRONMENTS.md`).
