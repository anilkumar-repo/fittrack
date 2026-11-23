# Rozi Level 4 + exercise library — remaining roadmap

Date: 2026-11-23. Based on `ROZI_LEVEL_4_CURRENT_STATE_AUDIT.md` and `EXERCISE_LIBRARY_AUDIT.md`. This doc maps the ChatGPT plan's Milestones 0–10 onto what is already built, and adds my changes to that plan.

Legend: ✅ done · 🟡 partly done · ⬜ not started. "DB" = needs a migration (dry run first, applied only after you say "Yes, apply it").

## 1. The plan's milestones vs reality

| Plan milestone | Status | Notes |
|---|---|---|
| M0 Local audit | ✅ 2026-11-23 | These four docs. |
| M1 Level 3 security + action foundation | ✅ | Built in Agent Phase 1 (2026-11-19); security Phase A applied. |
| M2 Level 3 frontend | ✅ | Built in Agent Phase 2 (2026-11-23). |
| M3 Exercise library audit | ✅ 2026-11-23 | Done as part of M0: `EXERCISE_LIBRARY_AUDIT.md`, `EXERCISE_LIBRARY_COVERAGE.md`. |
| M4 Exercise library expansion | ⬜ | Re-scoped below (about 50 high-priority additions, not 200). |
| M5 Rozi exercise intelligence | 🟡 | Equipment-aware swaps, muscle filters, `plan_custom_workout` and home/gym plans already exist. What's left is variation and alias understanding. |
| M6 Level 4 planning | ⬜ | Re-scoped below (goal plan as a sequence of weeks, not a generic task graph). |
| M7 Level 4 execution | ⬜ | |
| M8 Advanced fitness intelligence | 🟡 | Weekly report, progress, recovery and missed-day reshuffle exist. Missing: plateau detection and post-workout recap. |
| M9 Personalization + scheduling | ⬜ | `pg_cron` push exists. |
| M10 Final validation | ⬜ | |

## 2. Remaining work, in the order I recommend

| # | Step | Size | DB | Needs from you |
|---|---|---|---|---|
| **R1** | **Ship and verify Level 3.** Merge the feature branch → `develop` → `main`, set `ROZI_ACTIONS=on`, deploy. Then a live check of all 6 action types: approve, reject, expiry, double tap, the "What Rozi changed" list. | ½ day | — | merge + deploy (you) |
| **R2** | **Re-test gpt-oss-20b** Telugu/Hindi (Q42–60). Add about 10 action-proposal cases to the benchmark ("swap bench for something", "log 2 glasses of water"): does the model propose the right action, with the right arguments? | ½ day | — | — |
| **R3** ✅ 2026-11-23 | **Library foundation (no new exercises yet).** (a) Fix the metadata errors listed in the audit (walk/march pattern `carry` → `cardio`, cardio machines need `cardio_machine`, EZ-bar curls). (b) Controlled `MuscleGroup` values for primary/secondary muscles (today they are free text). (c) Add `aliases` and `variationOf` to the exercise itself and merge the two alias lists (`SEARCH_ALIASES` in `exercise-library.ts` and `EXERCISE_ALIASES` in `rozi-ai/tools.ts`) into one. (d) A library quality test: unique IDs, names and aliases; valid enums; every `fallbackId` and `variationOf` exists. **All existing IDs are kept.** | 2 d | — | — |
| **R4** ✅ 2026-11-23 (migration applied) | **Equipment keys:** `resistance_band`, `kettlebell` (maybe `dip_station`, `jump_rope`). These are added to onboarding and Settings equipment pickers. | 1 d | small: widen the `profiles_available_equipment_check` constraint (it lists the allowed keys) | "Yes, apply it" |
| **R5** ✅ 2026-11-23 (migration applied) | **Time and distance tracking.** Today a target like "30–60 sec" or "20 min" is only text, and logged sets store weight + reps. Add `trackingType: reps \| time \| distance_time` to the exercise, plus duration and distance on logged sets, so planks, wall sits, dead hangs, walks, runs and rows log properly. This must happen **before** cardio is added. | 3 d | small (duration/distance columns on `workout_set_logs`) | "Yes, apply it" |
| **R6** 🟡 batches A ✅ (22 upper) and B ✅ (12 lower + core) 2026-11-23; C next | **Library expansion, high priority:** about 50 exercises (the list in `EXERCISE_LIBRARY_COVERAGE.md` §6), each with steps, cues, cautions, muscles, equipment, fallback, video link and a swap test. Delivered in 3 batches (upper body, lower body + core, cardio + home), each reviewed by you. | 1 wk | — | review each batch |
| **R7** | **Rozi variation intelligence** (rest of M5). "Military press", "RDL", "pec deck fly" and similar resolve through the single alias list, without asking the model to guess. Rozi explains a variation ("incline works more upper chest") from metadata. | 1–2 d | — | — |
| **R8** | **Level 4: goals and plans.** One `rozi_goals` row (type, target, deadline, reason). A plan is a short list of weekly steps. Each step is a Level 3 action or a check. You approve the **whole plan once**; small steps inside it run without asking again; anything that changes your plan, profile or targets still asks. Validator: safe rate (e.g. ≤ 1% body weight per week), training days, recovery, age rules. | ~2 wk | `rozi_goals`, `rozi_plan_steps` | "Yes, apply it" |
| **R9** | **Level 4: monitoring and replanning.** A weekly check compares progress with the plan ("2 of 3 workouts, weight −0.4 kg"). If you're behind, Rozi proposes a change (a card) and never changes the plan on its own. Pause / resume / cancel a plan. | 1 wk | small | — |
| **R10** | **Memory you control.** "Rozi remembers" list: only things the profile doesn't already hold ("knee hurts on lunges", "prefers mornings"). Rozi asks before saving anything. You can view, edit and delete. | 3–4 d | `rozi_memory` | "Yes, apply it" |
| **R11** | **Scheduled check-ins** (opt-in). `pg_cron` builds the weekly summary from your data **without an AI call** (free and private); the AI runs only when you open it. | 3 d | small | consent wording OK |
| **R12** | **Advanced intelligence:** plateau detection (no e1RM gain for 3+ weeks → suggest a variation from R6), post-workout recap, "why this workout". | 1 wk | — | — |
| **R13** | **Security review + final validation** (M10): RLS and advisors on every new table, race tests, prompt-injection tests on goals and memory, both providers, latency and cost check, staging pass. | 3–4 d | — | deploy approval |

## 3. Where I disagree with the ChatGPT plan (and why)

1. **Milestones 1–2 are already done.** Re-doing them would waste a week. What's missing is only the live check (R1).
2. **Don't add every candidate.** The plan lists 212 names. About 60 are aliases or grip changes of exercises we have, and about 30 are not worth adding (sleds, Turkish get-ups, handstand push-ups, upright rows). The plan itself says "do not inflate the count". About 50 additions close every real gap.
3. **Fewer schema fields.** `forceType`, `mechanic`, `isBodyweight` and `locations` can all be derived from fields we already have (`movementPattern`, `requiredEquipment`). Storing them twice causes drift. Add only what can't be derived: `aliases`, `variationOf`, controlled muscle values, `trackingType`, and cardio `impact` / `intensity`.
4. **Cardio needs tracking before it needs exercises.** Adding "Running" while the logger only records weight × reps would give a broken experience. R5 comes before cardio in R6.
5. **No generic task-dependency engine.** Fitness goals are linear (week 1 → week 2 → …). A full dependency graph (DAG) is complex to build and test, and no user would notice it. A list of steps with an order, a status and "blocked by previous step" covers it.
6. **Approve the plan once, not every step.** Asking for approval on every small step would make Level 4 tiring. One approval of the whole plan is enough, plus re-approval for anything outside it. This fits our existing A/B/C permission model.
7. **Scheduled work without AI calls.** Weekly reports built in SQL cost nothing and send no personal data to a model until you open Rozi.

## 4. Extra ideas the plan doesn't have

- **Undo for Rozi's changes.** "Undo" on a done card for 10 minutes (swap back, delete the logged water). This makes people trust approvals.
- **"Busy gym" mode.** Tap "machine taken" on an exercise and Rozi offers the 3 best swaps that use free equipment *right now*, without changing your plan. It reuses `swapChoices`.
- **Plateau → variation.** When a lift stalls, Rozi suggests its variation from the new `variationOf` links (flat → incline, barbell → dumbbell) for 3 weeks, and then switches back.
- **Home-week auto-plan.** "I'm travelling next week, only bands." Rozi turns the plan into a band/bodyweight week with one approval. This needs R4 and R6.
- **Goal-aware rest-day missions** (your idea 3): the mission comes from the goal (fat-loss → a walk, muscle → mobility for the trained muscles).
- **Time-boxed sessions.** "I only have 25 minutes today." Rozi trims sets and exercises by priority, as a single Level 3 action.
- **Exercise-library coverage test in CI**, so no future edit breaks IDs or aliases.

## 5. Your "8. New ideas" — where they land now

| Idea | Status / where |
|---|---|
| 1 Rozi grows with you | ROADMAP item 12 (Phase 8 motivation) |
| 2 Gym-buddy live mode | ROADMAP item 13 |
| 3 Rest-day missions | Item 12. With Level 4 the mission comes from your goal (R8). |
| 4 Streak shield | Item 12 (streak repairs already exist) |
| 5 Plate calculator + warm-up | ✅ done |
| 6 "Why" wall | Item 12. The goal's reason (R8) becomes the "why". |
| 7 Trainer broadcast | ✅ done |
| 8 Monthly report card | Item 13. It can reuse the R11 weekly summary data. |
| 9 Gym check-in QR | Item 13 |
| 10 Form-check video | Phase 10 |
