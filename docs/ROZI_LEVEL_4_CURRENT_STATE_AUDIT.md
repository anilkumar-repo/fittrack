# Rozi Level 4 — current state audit (Milestone 0)

Date: 2026-11-23. Read-only audit: no application code, database or Git state was changed to produce it.

## 1. Git state (local vs remote)

| Item | Finding |
|---|---|
| Current branch | `feature/2026-11-17-phase1-liquid-glass` |
| Local vs its remote | Up to date (0 ahead / 0 behind). Working tree clean. |
| HEAD | `5464bd9 rozi` (2026-11-23) — Agent Phase 1 (actions engine) + Phase 2 (approval cards) |
| vs `origin/develop` and `origin/main` | 1 ahead / 21 behind. The 21 are merge commits only; there is no content difference. |
| `origin/main` (`9e2ef5f`, 2026-11-19) | Does **not** contain the actions code. |

**What this means:** the Level 3 database objects (`rozi_actions` table and functions) are live in Supabase, but the code that uses them only exists on the feature branch. Setting `ROZI_ACTIONS=on` on production does nothing until the branch is merged into `develop` and then `main` and deployed.

## 2. Status matrix

Statuses: COMPLETE · PARTIALLY IMPLEMENTED · MISSING · IMPLEMENTED BUT UNVERIFIED · NEEDS REFACTORING.

| Capability | Status | Evidence | Gap |
|---|---|---|---|
| Read-only tools | COMPLETE | 14 tools in `src/lib/rozi-ai/tools.ts` (profile, workout for day, next workout, history, progress, recovery, streak, weekly report, body stats, exercise info, mobility, achievements, `plan_custom_workout`, `suggest_exercise_swap`). 60-question benchmark in `docs/benchmark/`. | gpt-oss-20b Telugu/Hindi re-test (Q42–60) still owed. |
| Action registry | COMPLETE | `actions/action-types.ts` — 6 types: `swap_exercise`, `start_plan_today`, `save_routine`, `update_training_preferences`, `log_body_weight`, `log_water`. `action-registry.ts` `buildAction` / `verifyAction`. | Only 6 types; no goal or milestone actions (Level 4). |
| Action validation | COMPLETE | The server builds every change itself from the tool arguments and the user's own data; the model never supplies the final payload. Tested in `actions.test.ts`. | — |
| Action approval | IMPLEMENTED BUT UNVERIFIED | Hash-bound approval (sha256 of user + type + canonical JSON), 30-minute expiry, single use. Approval cards in `rozi-action-card.tsx`. 22 SQL security checks in `supabase/tests/rozi_actions_security.sql` passed on the live DB (rolled back). | Never exercised end to end on a deployed build (not on `main`). |
| Action execution | IMPLEMENTED BUT UNVERIFIED | The app applies the change through its existing save path (`action-apply.ts`), only when `rozi_start_action` returns `started_now`. The server then re-reads the data and verifies it (`readForVerify` → `verifyAction` → `rozi_finish_action`). | Same — needs a live check after deploy. |
| Idempotency | COMPLETE | `started_now` is true only on the first start; a second approve does not apply again. Covered by SQL and unit tests. | — |
| Action audit history | COMPLETE | Every proposal and outcome is kept in `rozi_actions`. "What Rozi changed" sheet (`rozi-actions-sheet.tsx`), `GET /api/rozi/actions`. | No undo yet (see roadmap). |
| Permission enforcement | COMPLETE | `permissions/permission-policy.ts`: A = read tools, B = approved actions, C = refused. Table has RLS on and no policies; SECURITY DEFINER functions with `search_path=''` and `auth.uid()` owner checks. | — |
| Goal interpretation | MISSING | Only single-turn intents exist (`rozi-chat.ts` intents, `plan_custom_workout`). Nothing turns "lose 5 kg by March" into a structured goal. | Whole module. |
| Multi-step planning | MISSING | No plan object or planner for multi-step goals. (`rozi-plan.ts` builds one workout, not a goal plan.) | Whole module. |
| Task dependencies | MISSING | — | Whole module. |
| Plan validation | MISSING | Single actions are validated; no plan-level validation (limits, safety, conflicts). | Whole module. |
| Resumable execution | MISSING | Actions are single-step; no plan state machine (pause / resume / cancel). | Whole module. |
| Monitoring | PARTIALLY IMPLEMENTED | Read-side data exists: weekly report, progress, recovery, streak, missed days. Nothing compares progress with a goal plan. | Goal-progress monitor. |
| Replanning | MISSING | `missed-days.ts` reshuffles a missed workout, but there is no plan-level replanning. | Whole module. |
| User-controlled memory | MISSING | Only chat history (server-stored). No "Rozi remembers: …" list that the user can see, edit and delete. | Whole module. |
| Scheduled workflows | PARTIALLY IMPLEMENTED | `pg_cron` sends push reminders. No scheduled Rozi check-ins or reports. | Scheduled agent jobs. |
| Security and RLS | COMPLETE | Phase A applied: date of birth (18+), DB-only history, per-person lock and limits in the DB, degraded in-memory limiter, masking, server-only AI replies, RLS test scripts; Supabase advisors clean after each migration. | Repeat the advisors and RLS scripts for each new Level 4 table. |
| Tests and benchmarks | PARTIALLY IMPLEMENTED | 379 unit tests passing; 60-question AI benchmark; 22 SQL action checks. | No Level 4 tests (nothing to test yet); no live end-to-end test of actions; 20b re-test pending. |

## 3. Summary

- **Level 3 (action-taking agent): built.** It is complete in code and tests and applied in the database. It is unverified live because it is not on `main`.
- **Level 4 (goal-based planning agent): not started.** Goals, plans, dependencies, plan validation, resumable execution, replanning, memory and scheduled check-ins are all missing. Monitoring and scheduling have useful building blocks.
- **The plan's Milestones 1 and 2 are already done.** Only the live verification is left.

## 4. Recommended next milestone

**Milestone 2.5: ship and verify Level 3** (small, needs your approval for the merge and deploy):

1. Merge the feature branch into `develop`, then `main` (you, through GitHub Desktop).
2. Set `ROZI_ACTIONS=on` in Vercel and deploy (you).
3. Live check: approve, reject, expiry and double-tap for each of the 6 action types.
4. Re-test gpt-oss-20b Telugu/Hindi (Q42–60).

**Then Milestone 3/4: the exercise library.** See `EXERCISE_LIBRARY_AUDIT.md`. Rozi's planning quality depends on it, so it should come before Level 4.
