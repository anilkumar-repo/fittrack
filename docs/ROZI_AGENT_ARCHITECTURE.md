# Rozi agent — architecture (Phase 0 audit, 2026-11-19)

**Status:** audit only, no application code changed. This file describes Rozi **as it is today** (Level 2) and the **proposed** shape for Level 3 (actions with approval) and Level 4 (supervised multi-step plans). Plan: `ROZI_AGENT_IMPLEMENTATION_PLAN.md`. Rules: `ROZI_AGENT_PERMISSION_MODEL.md`.

## 1. Where Rozi is today: Level 2+ (tool-using, one confirm-to-apply card)

```
Phone (Ask Rozi screen, rozi-chat-screen.tsx)
  │  question + conversationId (+ sign-in token). Never history, never a user id.
  ▼
POST /api/rozi/chat (app/api/rozi/chat/route.ts, maxDuration 60 s)
  │  handler.ts: sign-in → body check → consent → AI configured → profile → 18+ (date of birth) →
  │  history from DB (owner-checked) → rozi_start_question (6/min, 60/day, per-person lock) →
  │  mask emails/phones → ask
  ▼
fallback.ts: ROZI_AI_CHAIN = groq gpt-oss-20b → groq gpt-oss-120b → gemini-3.5-flash-lite
  │  per question; cooldowns; 40 s budget; safety blocks never routed around
  ▼
conversation.ts: up to 3 rounds × 5 tool calls; selectTools() sends only the tools a question needs
  │
  ▼
tools.ts (14 tools, all READ-ONLY) ── run FitTrack's existing modules on the person's own data:
  planner · progress · recovery · streak · weekly report · body/BMI · exercise library · mobility ·
  achievements · rozi-plan · exercise-swap (suggest only)
  │  returns a small JSON result for the model + a card for the screen
  ▼
Reply text + cards → saved by the server only (rozi_save_ai_reply, service role) → shown with cards
  │
  ▼  The one "action" today: Rozi's swap / plan cards. The PERSON taps a button and the APP (browser)
     applies it with the existing client code (useExerciseSwap / startPlan / saveRoutine). The model never writes.
```

When the AI is off or busy, Rozi answers on the phone (`rozi-chat.ts` intents) from the same data, with no network AI.

### Data the AI can see
Only what tools return: workouts, sets, weights, recovery, streak, body weight/height/BMI, goal, level, equipment, age, typical day. Never: name, email, phone, account id, sign-in token, keys (checked by `privacy-e2e.test.ts`).

## 2. Inventory (verified in the repository)

### 2.1 Read-only tools (`src/lib/rozi-ai/tools.ts`)
| Tool | Uses | Writes? |
| --- | --- | --- |
| get_workout_for_day, get_next_workout | planner `generateWorkout` / saved session | No |
| get_workout_history | progress `recordedSessionStatus` | No |
| get_progress | progress `calculatePersonalRecords`, `buildExercisePerformance` | No |
| get_recovery | recovery `muscleRecovery` | No |
| get_streak | rozi `calculateStreak` | No |
| get_weekly_report | recovery `weeklyReport` | No |
| get_body_stats | body `bmi` | No |
| get_exercise_info | exercise-library (alternatives, deadlift rule) | No |
| get_mobility_suggestion | mobility `suggestionForDay` | No |
| get_achievements | achievements | No |
| plan_custom_workout | rozi-plan `planWorkout` (suggests; card has Start / Save) | No |
| suggest_exercise_swap | exercise-swap (choices; card applies) | No |
| get_my_profile | profile + trainer equipment rules | No |

### 2.2 Operations that already change state (all in the app today)
| Operation | Existing code | Where it runs | Database path |
| --- | --- | --- | --- |
| Save / update a day's workout (start, log, swap) | `saveCloudSession` → `persistWorkoutSession` | browser, user's token | `save_workout_session` RPC (atomic) |
| Swap an exercise | `exercise-swap.ts` `swapInSession` + `useExerciseSwap` | browser | same as above |
| Start Rozi's plan today | `startPlan` (rozi-chat-screen) → `routinePlan` | browser | same as above |
| Save a routine | `routines-store.ts` `saveRoutine` | browser | `routines` table (RLS) |
| Change goal, days, session length, focus, equipment, typical day | `saveCloudProfile` | browser | `profiles` upsert (RLS) |
| Training days / goal while in a buddy group | `propose_buddy_plan` | browser | RPC (needs the buddies' agreement) |
| Log body weight | `saveCloudBodyWeightEntry` | browser | `body_weight_entries` (RLS) |
| Log / remove water | `addCloudWater` / `removeCloudWater` | browser | `water_logs` (RLS) |
| Missed-day reason | `saveCloudMissedDay` | browser | `record_missed_workout` RPC |
| Delete all workout data | `deleteMyWorkoutData` | browser | `delete_my_workout_data` RPC |
| Trainers, friends, chats, feed posts, public profile, push | various repositories | browser | RPCs |

**Important finding:** every existing write runs **in the browser** with the person's own sign-in and relies on RLS and RPC checks. The app keeps an in-memory copy of the state (FitTrackProvider) and saves whole sessions with a short debounce. A server-side action that changes the same session could be **overwritten by a stale browser save**. Any server-executed action must handle this (§4.3).

### 2.3 Relevant tables
`profiles`, `workout_sessions` + `workout_check_ins`, `workout_exercise_logs`, `workout_set_logs`, `workout_reviews` (saved together by `save_workout_session`), `routines`, `body_weight_entries`, `water_logs`, missed-day reasons (via `record_missed_workout`), `rozi_conversations`, `rozi_messages`, `trainer_rules`, `trainer_rule_audit`, `trainer_clients`, `trainer_profiles`, buddy tables. Scheduling: `pg_cron` + `pg_net` already exist (push notifications).

### 2.4 Never for the agent
Account deletion, delete-all-data, security/sign-in settings, push subscriptions, trainer rules and deadlift approval (trainer-only), removing trainers or friends, posting to the feed or chats, public-profile visibility, anything financial, and any medical diagnosis. See the permission model.

## 3. Level 3 design: actions with explicit approval

```
Model ── proposes ──► propose_action tool (server)          ◄── new, not a DB writer
                       │ validate input (zod-like schema per action type)
                       │ permission policy (A / B / C) ── C → refused, explained
                       │ build the exact change from EXISTING logic (e.g. swapInSession, goal options)
                       │ payload hash = sha256(type + canonical payload + user)
                       ▼
                    rozi_actions row (status: awaiting_approval, expires_at = +30 min)  ◄── new table (closed, functions only)
                       │ card to the screen: what / why / what changes / Approve · Reject
Person taps Approve ──► POST /api/rozi/actions/:id/approve  (token → user; id; payload hash from the card)
                       │ rozi_approve_action(): owner? hash matches? not expired? status awaiting? → approved (single use)
                       ▼
                    executor (server, user-scoped Supabase client = the person's own RLS):
                       │ rozi_claim_action(): approved → executing (row lock; a second click gets "already running")
                       │ run the EXISTING service (persistWorkoutSession, saveRoutine, saveCloudProfile …)
                       │ verify: re-read and compare with the expected result
                       │ rozi_finish_action(): executing → completed | failed (result / error stored)
                       ▼
                    card updates from the server state; the app reloads the changed data
```

* **The model never writes.** It can only *propose*; proposals are rebuilt and validated by server code from the person's real data.
* **Approval is bound** to the user, the action id, the payload hash, an expiry and single use — never to chat words like "sounds good".
* **Idempotency:** a unique idempotency key + the `approved → executing` transition under a row lock; re-clicks, refreshes and retries see the stored result.
* **Audit:** every proposal and outcome stays in `rozi_actions` (no extra personal data), visible in an "Actions" list.
* **Feature flag:** `ROZI_ACTIONS=on` (server) — off keeps today's Level 2 behaviour exactly.

## 4. Level 4 design: supervised plans

```
Goal ("stronger in 12 weeks") → goal interpreter (LLM, structured JSON; asks for missing facts)
  → context (read-only tools, automatic) → plan generator (FIXED task templates per goal type; LLM fills
    parameters only) → plan validator (types, tools, dependencies, permissions, ≤ 12 tasks, depth ≤ 1,
    retries ≤ 2, conflicts) → persisted rozi_plans + tasks
  → executor advances in SHORT steps (each request ≤ ~20 s, well inside the 60 s limit):
      Category A tasks run automatically · Category B tasks become action proposals and PAUSE the plan
  → verification after every action → monitor (deterministic thresholds from existing modules)
  → replanning = a NEW proposal, never an automatic change → final report
```

### 4.1 Resumable execution without new infrastructure
No queue service. A plan is a database row with tasks; the screen (or a later visit) calls `POST /api/rozi/plans/:id/continue`, which runs the next ready tasks within a time budget and returns. Pause, resume, cancel, retry and expiry are status transitions done by database functions.

### 4.2 Scheduled reviews (design only until approved)
`pg_cron` already runs push notifications. A weekly review would: (1) compute deterministic facts in SQL or a server route, (2) create **proposals only**, (3) send a push if the person opted in. Needs consent settings, a server route callable by cron, and your approval.

### 4.3 The stale-browser-save risk (must be solved in Phase 1)
Option chosen: **server executes, browser reloads.** After an action completes, the card tells the app to reload that day's session / profile before allowing more edits; session saves carry the session's `updated_at` and the database refuses an older copy (optimistic concurrency check added to `save_workout_session`). Actions on a workout that is **in progress on this phone** apply through the same path, then reload.

## 5. Files (current → proposed)
| Area | Today | Proposed (new unless noted) |
| --- | --- | --- |
| Tools | `rozi-ai/tools.ts` | unchanged; + `propose_action` tool |
| Actions | — | `rozi-ai/actions/{action-types,action-registry,action-validator,action-executor,action-approval,action-audit}.ts` |
| Permissions | prompt rules + DB checks | `rozi-ai/permissions/{permission-types,permission-policy}.ts` |
| Plans | — | `rozi-ai/planning/{plan-types,goal-interpreter,task-planner,plan-validator,plan-executor,plan-monitor,plan-replanner,plan-state}.ts` |
| API | `app/api/rozi/chat` | `app/api/rozi/actions/[id]/{approve,reject}`, `app/api/rozi/plans/[id]/{continue,cancel}` |
| DB | rozi_conversations, rozi_messages | `rozi_actions`, `rozi_plans`, `rozi_plan_tasks` (closed tables + functions); `save_workout_session` version check |
| UI | `rozi-cards.tsx`, `rozi-chat-screen.tsx` | action proposal / status cards, Actions history sheet, plan progress card |

## 6. Decision D1 — who applies an approved change (2026-11-19, Phase 1)

**Chosen: the app applies it; the server authorises, records and checks it.**
1. **Rozi proposes:** the model calls `propose_action`. Server code rebuilds the exact change from your data (`action-registry.ts`), applies the policy (`permission-policy.ts`), hashes it, and records it (`rozi_propose_action`, service role).
2. **You approve:** you tap Approve. `rozi_start_action(id, hash)` runs as you, checks owner, hash and expiry, and moves the action `awaiting_approval → executing` once. Only that call gets `started_now`.
3. **The app applies it:** only with `started_now`, through its normal save path (`action-apply.ts`: the same `save_workout_session`, routines, profile, weight and water code the screens use).
4. **The server checks the result:** the app reports back, the server re-reads your data as you (`action-reader.ts`), checks it (`verifyAction`), and records `completed` or `failed` (`rozi_finish_action`, service role).

**Why:**
- **Single writer:** the browser already writes everything and keeps the state (finding F1/F2), so this needs no rewrite of the workout save and has no stale-copy race.
- **Same protection:** the approval system guards against the model, prompt injection and replays. The person can already edit their own data, so letting the app apply an approved change opens no new access.
- **Unchanged:** the model still never writes. Approval is still bound to owner, id, hash, expiry and single use. The result is still checked by the server.

**Trade-off:** if the app closes between approving and reporting back, the action stays `executing`. After 10 minutes the next look marks it `failed`; it is never re-applied, and you can ask again.

The `approved` status stays in the list for compatibility; Phase 1 approves and starts in one step (`awaiting_approval → executing`).
