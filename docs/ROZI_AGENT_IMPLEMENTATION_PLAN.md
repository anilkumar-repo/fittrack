# Rozi agent — implementation plan (Phase 0, 2026-11-19)

Upgrade Rozi from Level 2 (tool-using chat) to Level 3 (actions with explicit approval) and Level 4 (supervised multi-step plans), **incrementally**, behind feature flags, keeping today's chat working. Design: `ROZI_AGENT_ARCHITECTURE.md`. Rules: `ROZI_AGENT_PERMISSION_MODEL.md`.

**Nothing in this file is built yet.** Each phase: build → tests, typecheck, lint, build → report → your approval → next phase. Migrations are dry-run first and applied only after "Yes, apply it". No deploys by me.

## Before Phase 1 (from the audit)
| # | Finding | What it means |
| --- | --- | --- |
| F1 | Every existing write runs in the browser with the person's own sign-in (RLS / RPCs). | Server actions must call the same services with a **user-scoped** server client (the person's own RLS), not the service role. |
| F2 | The browser keeps state in memory and saves whole sessions with a debounce. | A server change could be overwritten by a stale browser save → add an `updated_at` version check to `save_workout_session` and reload after actions (Phase 1, first task). |
| F3 | The chat route has a 60 s limit; the free Groq tier has daily token limits (hit in the benchmark). | Level 4 must run in short resumable steps and use fixed task templates instead of long LLM planning. |
| F4 | `pg_cron` + `pg_net` already exist (push). | Scheduled reviews can reuse them later — no queue service needed. |
| F5 | Training days/goal are synced in buddy groups (`propose_buddy_plan`) and some fields are trainer-managed. | Actions must respect those flows (refuse with an explanation, or route to the buddy proposal). |
| F6 | Swap and "start plan" cards already apply changes through the browser. | They become the first two real actions (migrate, don't duplicate). |

## Phase 1 — Level 3 action system (~1 week · DB)
**Build**
1. Version check: `save_workout_session` refuses an older copy (`updated_at`); the app reloads and retries the person's edit. (Protects every later action.)
2. `src/lib/rozi-ai/actions/`: `action-types.ts` (union of action types + schemas), `action-registry.ts` (type → builder, executor, verifier, category), `action-validator.ts`, `action-approval.ts` (hash, expiry), `action-executor.ts` (claim → run existing service → verify → finish), `action-audit.ts`.
3. `src/lib/rozi-ai/permissions/permission-policy.ts`: A/B/C decision per action and context (buddy group, trainer-managed, sets done, rest day…).
4. `propose_action` tool for the model (Category B only; C refused with a reason).
5. First actions: `swap_exercise`, `start_plan_today`, `save_routine`, `update_training_preferences`, `log_body_weight`, `log_water`. (Training days and missed-day reasons in Phase 1b.)
6. API: `POST /api/rozi/actions/[id]/approve`, `/reject`, `GET /api/rozi/actions` (history).

**Migration** `rozi_actions` (closed table, RLS on, no direct access): id, user_id → auth.users (cascade), type, payload jsonb, payload_hash, idempotency_key (unique per user), status (check list), expires_at, timestamps (created, approved, executed), result jsonb, error text; functions `rozi_propose_action` (service role), `rozi_approve_action`, `rozi_reject_action` (owner), `rozi_claim_action`, `rozi_finish_action` (service role), `rozi_my_actions` (owner list).

**Tests:** the 12 Level 3 tests from your brief (approve, reject, expiry, changed payload, double approve, another user's action, bad input, provider failure executes nothing), a parallel double-approve test (like the Phase A concurrency test), and a stale-browser-save test.

## Phase 2 — Level 3 screens (~3–4 days · no DB)
Action proposal card (what / why / changes / Approve · Reject), live status card (pending → executing → completed/failed, never "done" before the server says so), retry on failure, Actions history sheet (completed, rejected, expired), mobile layouts, Rozi mascot style kept. Existing swap/plan cards switch to the action flow when `ROZI_ACTIONS=on`.

## Phase 3 — Level 4 planning engine (~1 week · DB)
`src/lib/rozi-ai/planning/`: `plan-types.ts`, `goal-interpreter.ts` (LLM → structured goal; asks for missing facts), `task-planner.ts` (**fixed templates** per goal type: strength, consistency, recovery, target weight, event; the LLM only fills parameters), `plan-validator.ts` (types, tools, dependencies, permissions, ≤ 12 tasks, no cycles, conflicts, duplicates), `plan-state.ts`.
**Migration** `rozi_plans` + `rozi_plan_tasks` (closed tables + owner/service functions; status transitions like actions).

## Phase 4 — Level 4 supervised execution (~1 week · small DB)
`plan-executor.ts` (runs ready tasks within ~20 s per step; A automatic, B → proposal + pause), `plan-monitor.ts` (deterministic checks from existing modules), `plan-replanner.ts` (only proposes). API `POST /api/rozi/plans/[id]/continue|pause|cancel`. Plan progress card. **Scheduled reviews: design document only**, implemented after approval (pg_cron + opt-in + push).

## Phase 5 — fitness intelligence (~1 week · no DB)
Built on existing engines, each with "what I saw · the data · why it matters · what I propose · approval needed?":
post-workout recap (on the celebration screen), weekly intelligence (Your week page), plateau detection (new deterministic helper over `buildExercisePerformance`; ≥ 3 sessions over ≥ 3 weeks, substitutions accounted for), recovery-aware day (continue / lighter / alternative / rest, from `muscleRecovery` + check-in rules).

## Phase 6 — memory and personalisation (~3–4 days · small DB, only if needed)
Most preferences already live in the profile (goal, days, length, focus, equipment, typical day, why). Add only what's missing: coaching style, exercise dislikes/limitations (not diagnoses), with "last confirmed" dates; view / edit / delete in Settings; never sent to providers unless the question needs it.

## Phase 7 — security, reliability, privacy review (~3 days)
RLS and ownership on every new table/function, approval binding, idempotency and races (parallel tests), prompt-injection tests (instructions inside tool results, history, memories), rate limits on approve/continue, audit logging without secrets, provider data handling (Groq zero-retention option, Gemini terms), repeatable SQL security script extended (`supabase/tests/`).

## Phase 8 — tests and benchmark (~3–4 days)
Level 3 and Level 4 test lists from the brief; extend the 60-question benchmark with ≥ 50 agent scenarios (actions, approvals, multi-step, replanning, failures, safety, injection, privacy, English/Telugu/Hindi) scored on task success, tool and action correctness, approval enforcement, data correctness, latency, tokens, cost — across gpt-oss-20b, gpt-oss-120b and Flash-Lite. Results in `docs/ROZI_AGENT_BENCHMARK.md`.

## Phase 9 — docs and release
Update the three agent docs, `ROZI_AGENT_BENCHMARK.md`, setup/env docs (`ROZI_ACTIONS`, `ROZI_PLANS` flags), known limitations. Release in steps: flags on for your account first, then everyone.

## Risks
| Risk | Mitigation |
| --- | --- |
| Stale browser save overwrites an action | version check + reload (Phase 1 step 1) |
| Double execution | idempotency key + locked claim + stored result |
| Model proposes something unsafe or unallowed | server-side policy + schemas; C always refused; tests |
| Approval by chat words in any language | approval only via the card's button + hash |
| Runaway plans / token cost on free tiers | fixed templates, ≤ 12 tasks, step budget, daily plan limits, deterministic monitoring |
| Buddy/trainer conflicts | policy refuses or routes to existing buddy proposal flow |
| More personal data to providers | same tools/fields only; masking; privacy test extended to actions and plans |
| Complexity for users | feature flags; small cards; history to undo by hand (the app's normal screens) |

## Affected existing files (modified, not rewritten)
`rozi-ai/tools.ts` (+ propose_action), `rozi-ai/prompt.ts` (action rules), `rozi-ai/handler.ts` + `app/api/rozi/chat/route.ts` (return proposals), `rozi-ai/cards.ts` + `components/app/rozi-cards.tsx` (new cards), `components/screens/rozi-chat-screen.tsx`, `components/app/swap-sheet.tsx` (route through actions when on), `lib/supabase-repository.ts` / `workout-port` (version check), new migrations under `supabase/migrations/`.

## Phase 1 — status (2026-11-19): built, tests pass, migration APPLIED (live security script 22/22), flag OFF

**Design:** decision D1 in the architecture doc (the server authorises and checks; the app applies through its existing save path). This replaces the planned version check on `save_workout_session`, which isn't needed under D1.

**Files created:**
- `src/lib/rozi-ai/actions/`:
  - `action-types.ts` (6 action types, statuses, parse);
  - `action-registry.ts` (builders from existing logic, and verifiers);
  - `action-approval.ts` (canonical JSON, sha256 payload hash, idempotency key);
  - `action-service.ts` (propose / start / reject / finish / list, the `propose_action` tool, the `ROZI_ACTIONS` flag);
  - `action-reader.ts` (server re-read);
  - `action-apply.ts` (apply in the app + `approveFlow`, applied only when `started_now`);
  - `actions.test.ts`.
- `src/lib/rozi-ai/permissions/permission-policy.ts` (A/B/C + refusals with where to go).
- `src/lib/rozi-ai/user-client.ts` (the person's own client from the token; now shared with the chat route).
- `src/components/app/use-rozi-action.ts` (approve / reject from a card; Phase 2 adds the card).
- `app/api/rozi/actions/route.ts` (GET history) and `app/api/rozi/actions/[id]/route.ts` (approve / reject / complete).
- `supabase/migrations/20261119150000_rozi_actions.sql` and `supabase/tests/rozi_actions_security.sql`.

**Files modified:**
- `conversation.ts`: optional server-side `extraTools`, awaited.
- `handler.ts` + chat `route.ts`: `propose_action` only when the flag is on and the service key is set.
- `cards.ts`: the `action` card type.
- `prompt.ts`: "never say something was changed".
- `exercise-swap.ts`: exported `findNamedExercise`.

**Existing modules reused:**
- exercise-swap (choices, rules, `swapInSession`);
- rozi-plan `planWorkout`, pro-tracking `routinePlan`, routines-store `saveRoutine`;
- onboarding/program options;
- the provider's `upsertSession` / `updateProfile`;
- `saveCloudProfile`, `saveCloudBodyWeightEntry`, `addCloudWater`, `loadOwnTrainingData`.

**Tests:**
- **App:** 378 pass (`actions.test.ts`: 12 tests covering builders, policy, hash, propose, apply, approve-once, verify, model-can-only-propose).
- **Database dry runs (rolled back):** 21 checks plus 5 after the `started_now` change, all passed:
  - closed table; the app can't propose or finish;
  - a changed hash is refused;
  - a double approval doesn't apply twice;
  - another person and anon are refused;
  - expiry, rejection and history work;
  - an action that never reported back is marked failed after 10 minutes.
- Type check and lint clean.

**Not yet:**
- the migration applied (needs your OK);
- the cards and history screen (Phase 2) — without them `ROZI_ACTIONS` must stay off;
- a live end-to-end run after deploy.

**Remaining risks:**
- the app closing mid-apply (handled as failed, never re-applied);
- water and weight are additive — approve-once protects them, but a person could still approve two *different* proposals;
- the `complete` route depends on `SUPABASE_SERVICE_ROLE_KEY` on the server.

## Phase 2 — status (2026-11-23): built and checked; switched off until you turn it on

**What you see:**
- **Approval card** (`rozi-action-card.tsx`), under Rozi's reply:
  - the type of change, a status chip, the title, why Rozi suggests it, and each change in plain words;
  - **Approve** and **Not now**, plus a line saying nothing changes until you approve, with a countdown to expiry.
- **Statuses:** Needs your OK → Saving… → Done (only after the server checked it), or Didn't work (with the reason), Not applied, or Expired.
  - Buttons lock while a tap is handled.
  - If the request doesn't get through (no connection), the card stays approvable with a message.
  - An expired card can't be approved.
- **What Rozi changed** (`rozi-actions-sheet.tsx`): a **Changes** button on the Ask Rozi screen. It appears only when actions are on and you're signed in with Rozi AI. Every proposal is listed with its outcome, newest first.
- **Cards from old chats show their real current status,** loaded from the server and shared by all cards on the screen (`RoziActionsContext`).

**Other new and changed files:**
- `src/lib/rozi-ai/actions/action-view.ts`: status → label, colour, whether buttons show, the note.
- `use-rozi-action.ts`: adds `list()`.
- `rozi-cards.tsx`: renders `action` cards.
- `rozi-chat-screen.tsx`: loads the history, provides the context, adds the Changes button and the sheet.
- `globals.css`: the styles, in light and dark.

**Checked:**
- **Tests:** 379 pass. New: card states (Done is never shown before completed; no Approve once expired or while working) and plain-words verification messages. Type check, lint (no new warnings) and build pass.
- **In the browser at phone width,** on a temporary page with the network calls intercepted (no real data touched; the page is deleted):
  - waiting cards look right;
  - an approved swap that couldn't be applied → "Didn't work" with the reason and no buttons;
  - a dropped connection → still approvable, "No connection. Try again.";
  - a server "completed" → Done, with nothing applied by the app;
  - Done, Expired and the history sheet look right.
- **Not checked:** a live run with the real AI and database. That needs `ROZI_ACTIONS=on` on a deployed server.

**To switch it on (your step):** in Vercel add `ROZI_ACTIONS=on` (`SUPABASE_SERVICE_ROLE_KEY` is already set) and redeploy. Off again: remove it, and Rozi goes back to Level 2 behaviour.

**Not in this phase:** the existing swap and "Start now / Save as routine" plan cards still apply directly when you tap them. They're your own taps, not the model's, so they stay as they are.

## Milestone 0 audit (2026-11-23)

The ChatGPT Level 4 plan has been audited against this plan.
- **Current state:** `ROZI_LEVEL_4_CURRENT_STATE_AUDIT.md`.
- **Order from here:** `ROZI_LEVEL_4_REMAINING_ROADMAP.md`, steps R1–R13. This order replaces the Phase 3–9 order above.
- **Changes from the Phase 3–4 design:**
  - A goal plan is a short ordered list of weekly steps, not a dependency graph.
  - You approve the whole plan once. Anything outside it still needs its own approval.
- **The exercise library foundation (R3–R6) now comes before Level 4.**
