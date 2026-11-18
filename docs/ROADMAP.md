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

## 9. All phases (updated 2026-11-16; you pick the order)

Phase 0 (fixes, Profile, Rozi dock, Ask Rozi v0, install sheet, A–Z strip, CI) is ✅ done.
Every phase below includes **UI work taken from your reference screenshots**, not only features.
The 🎨 lines are what you'll *see* change; references are the screenshot numbers in `Downloads/Refer`.
Size is rough calendar time for me to build + check; DB = needs a database migration (shown to you first).

### Phase 1 — Liquid Glass 2: the look upgrade (UI only) · ✅ done 2026-11-17 · no DB
The quickest way to make the whole app feel new; everything after builds on these pieces.
- 🎨 **Glass system v2:** clearer frosted glass with a light edge highlight; the dock gets a sliding "lens" under the active tab (like iOS); sheets slide up with a grab handle and swipe down to close (v3 recording, 8015).
- 🎨 **Big titles that shrink on scroll**, with a frosted header (8056, 8082).
- 🎨 **Filter pills with counts** ("Stretching 90 · Core 55 · Cardio 25") and an orange active pill (8015, v3).
- 🎨 **List rows** with round picture, small orange badge, info button; **segmented controls** (Front / Side / Back) (v1, 8015).
- 🎨 **Rings and big numbers** for stats (6/6 ready, 0/3 train) with a fill animation; numbers count up (v2 recording).
- 🎨 **Micro-motion:** buttons press in, cards lift, confetti on finish, Rozi bounces/waves; respects "reduce motion".
- 🎨 **Settings regrouped** iOS-style: Account · Preferences · Health · Guides · Help · Follow us, with icons and a search (8082–8086, v1).
- 🎨 **Empty states with Rozi** everywhere ("No shared workouts" style, v1).
- 🎨 Dark mode pass on every screen.

### Phase 2 — Onboarding v2 · ✅ done 2026-11-17 (migration applied) · small DB (focus muscle, gym type)
- 🎨 **Wheel pickers** for birthday and height, **ruler slider** for weight, kg/lb and cm/ft toggles (8035–8037).
- 🎨 Option cards with radio dots, "Recommended" tags, step progress bar, Skip (8038–8041, 8060–8068).
- **Focus muscle** with body icons; **where you train** (large gym / small gym / home / bodyweight) → equipment preset; equipment list with pictures and toggles + search (8042–8051, 8066–8067).
- "**Did you know**" fact card and "**You've come to the right place**" with Rozi (8061, 8064).
- 🎨 "**Building your plan… 21% → 100%**" animated screen with Rozi assembling the plan (8076–8078).
- "**Your personalized program**" summary card: goal, equipment, level bars, workouts/week bars (8052).
- "**When's your first workout?** Today / Tomorrow / Not sure" and the **notification ask with a preview card** at the end (8073, 8075).
- Stats check with "Your BMI is 24.4" toast (8071). Welcome slides before sign-in (8053–8055).

### Phase 3 — Recovery · ✅ done 2026-11-17 · no DB
- 🎨 **Home "Recovery status" carousel** (swipe, dots): rings (muscles ready / train / water) → "This week" radar → "Stretch & recover" with the move animating → readiness body (v2 recording).
- 🎨 **`/recovery` body map** front / side / back, colour by status, tap a muscle for last trained, sets, soreness, matching stretch (8014, v1).
- **Weekly Rozi report** (every Monday): workouts, best lifts, muscles trained, recovery, next week.

### Phase 4 — Pro workout tracking · ✅ done 2026-11-17 (migration applied) · small DB (set type, routines)
- 🎨 **Exercise picker sheet**: search, category pills, A–Z strip, multi-select with "Start (3)" button, info sheet per move (8015, v3).
- 🎨 **Logger like Strong/Hevy**: set types (W warm-up, D drop set, F failure), **Previous** column, weight × reps, check marks turning green, "+ Add set" (8029, 8053).
- 🎨 **Rest timer ring** with −10 s / +10 s / Skip, and a Rest on/off switch (8030, v3).
- 🎨 **Exercise detail tabs**: About · How to (numbered steps) · History · Charts · Records (est. 1RM table, best set, volume) · Friends leaderboard (8016, 8031–8034, 8058–8059).
- **Build your own routine** + "My routines" cards with a "Ready" bar (v1, v2).
- 💡 **Plate calculator + warm-up builder** (idea 5).

### Phase 5 — Motion · ✅ first part done 2026-11-17 · no DB
Done: Rozi micro-animations by mood, pulsing muscle highlight, staggered recovery colours, frame player with 6 moving
stretches (cat-cow, glute bridge, arm swings, 90/90, kneeling hip extension, adductor rock-back), thumbnails match.
Still open: frames for the other ~125 stretches (3-panel strips), moving pictures for strength exercises (need new
pictures first: they only have muscle maps today), and short real clips.
- 🎨 Moving exercise pictures: first 2–4 frame loops from our own pictures, then short clips (v3 recording).
- 🎨 Animated muscle highlight on the body; Rozi micro-animations (wave in the morning, yawn at night, cheer on finish).

### Phase 6 — Trainers v2 · ✅ done 2026-11-17 (migration applied) · DB
- ✅ Step A self-serve trainers (applied) · ✅ Step B Train together (applied) · ✅ Step C coach-buddy extras (applied) — Phase 6 complete
- Several trainers per person; **"Ask to be my trainer" from Friends**, trainer code (kept), **QR at the gym** (section 2).
- Per-trainer sharing switches; 💡 **trainer broadcast** to all clients (idea 7).
- 🎨 Trainer dashboard with client cards (streak, last workout, flags).

### Phase 7 — Community · ~2 weeks · large DB + photo storage
- ✅ **Step A Chats** (1:1 friends / trainer ↔ client, Train together group chat, Rozi stickers, workout cards, report/block, live + notifications): ✅ applied. Next steps: feed, discover, profiles.
- ✅ **Step B Feed** (friends-only workout posts, one private photo, 💪 likes, comments, report/delete, notifications): applied. Next: discover / profiles.
- ✅ **Step C Discover + profiles** (search by name/@username, opt-in findable (never under-18s), friends-of-friends suggestions, friend requests, profile pages with stats and posts, public profile card + checklist): applied.
- ✅ **Improvements (2026-11-18):** Rozi plans workouts on request (level, goal and equipment aware; Start now / Save as routine), focused Ask Rozi screen on phones, picker without A–Z, Train start button that grows on scroll, Friends page redesign (hub + Friends · Challenges · Invite). ✅ Face pictures allowed (`20261118210000`, applied). ✅ Profile saves fixed (`20261118220000_fix_profile_save_findable_trigger.sql`, applied). ✅ Workout screen fixes: movable two-size rest timer, dock slides away while logging, Rozi chat fills the screen, guide × pinned, lock-screen notification with rest-end time.
- 🎨 **Feed** of workout posts: muscle-map card, moves with sets × reps × kg, photo, likes, comments, share (v1 recording, 8056–8057).
- 🎨 **Discover / Search** with Follow buttons, suggested people, "Invite friends" (v1).
- 🎨 **Profile**: posts / followers / following, "Complete your profile 1/9" checklist, Overview · Routines · Media tabs (v1).
- 🎨 **Chats** 1:1 and groups with the 17 Rozi faces as stickers and "share my workout" cards.
- 💡 **Gym-buddy live mode** (idea 2), 💡 **gym check-in QR** (idea 9), 💡 **monthly report card** to share on Instagram (idea 8).
- Report / block, private by default for under-18s.

### Phase 8 — Rozi grows with you + motivation · ~1 week · small DB
- 💡 **Rozi evolves**: outfits, accessories, a little gym unlocked by streak and level (idea 1).
- 💡 **Rest-day missions** with a "rest streak" (idea 3); 💡 **Streak shield** earned every 7 days (idea 4); 💡 **"Why" wall** photo card (idea 6).
- **Ask Rozi v1**: saved chats, follow-up questions ("what about last month?"), more answers.
- **Rozi AI (Google Gemini `gemini-3.8-flash`)** — plan in `docs/ROZI_AI_INTEGRATION.md`. ✅ Stage 2 connection · ✅ Stage 3 tools + conversation · ✅ Groq provider · ✅ Stage 4 API and security · ✅ Stage 5 screen · ✅ Stage 6 history (applied) (2026-11-18) · Stage 5 screen · Stage 6 history (DB) · Stage 7 verify.

### Phase 9 — Native app + Apple Health + Apple Watch · ~3–4 weeks · small DB
- App Store / Play Store app (Capacitor wrapper around the same code).
- Apple Health / Health Connect: steps, sleep, heart rate, weight in; workouts out.
- 🎨 Watch companion: today's list, tick sets, rest timer, heart rate (8081, 8083).
- **Live Activity** (lock screen / Dynamic Island workout timer and rest countdown, like Apple Fitness). The PWA shows clock times in its notification for now (2026-11-18).
- Needs Apple Developer (USD 99/yr) and Google Play (USD 25 once).

### Phase 10 — Nutrition + Voice · ~2 weeks · DB
- Daily calorie and protein targets (8072), quick food log, weekly trend.
- Voice Rozi: ask by voice, Rozi reads answers and counts reps.
- 💡 Form-check video for trainers (idea 10).

### My recommendation
1. **Phase 1 (Liquid Glass 2)** first: you'll see the difference on every screen within a week, and phases 2–4 reuse its sheets, rings, pills and lists.
2. Then **Phase 3 (Recovery)** and **Phase 4 (Pro tracking)**: the features your recordings showed most.
3. **Phase 2 (Onboarding v2)** before you invite many new people.
4. Community, native app and nutrition after that.

Each phase: `feature/*` branch → dev site → `main`, with tests, phone/desktop light/dark checks, and a history entry.
