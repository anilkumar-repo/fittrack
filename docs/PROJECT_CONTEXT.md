# FitTrack project context

This file is the durable handoff for people and coding assistants working on FitTrack. Read it before changing the application, database, workout rules, or release configuration. It describes the implementation in this repository; when in doubt, confirm behavior in the referenced source and migrations.

## Product and non-negotiable rules

FitTrack is a mobile-first workout planner for a beginner/restarting trainee. It supports daily workouts, readiness check-ins, exercise instructions, workout logging, post-session feedback, history and progress, optional body-weight tracking, and trainer controls.

- Workout generation is deterministic TypeScript. There is no AI API or paid model dependency.
- Do not invent a working load when history has no recorded load. The trainee chooses a comfortable load or leaves load unrecorded.
- The trainee's deadlift restriction defaults to off. No deadlift variation may be generated unless a trusted, authenticated trainer explicitly approves it for that client. Time or training phase never removes the restriction.
- A pain report reduces or stops relevant activity; it is never a reason to push harder. The app does not diagnose injuries.
- Preserve original plan snapshots, rule/template versions, workout logs, and audit history. Do not silently rewrite historic sessions when rules change.
- Only verified equipment should be treated as available. Unknown equipment uses a suitable alternative.
- Do not claim an unrecorded workout happened. Partial, planned, skipped, inferred rest, and completed sessions remain distinct.
- Never expose Supabase service-role or secret keys in browser code, `NEXT_PUBLIC_` variables, docs, logs, or Git.

## Stack and application shape

- Next.js App Router, React, TypeScript, CSS, and Supabase Auth/Postgres.
- `app/page.tsx` renders the main FitTrack app.
- `src/components/fit-track-app.tsx` owns the app shell, navigation, state loading, demo/cloud mode, and feature integration. `src/components/trainer-controls.tsx` is the trainer rule preview/edit surface.
- `app/auth/callback/route.ts` exchanges the Supabase email-link code for a cookie-backed session and redirects to the same origin with a safe error state on failure.
- `src/lib/supabase-browser.ts` creates the browser Supabase client only when the public URL and publishable key are configured.
- `src/lib/supabase-repository.ts` maps authenticated Supabase rows into the app model and persists profiles, sessions, logs, reviews, body weight, and trainer rule state. Row-level security and database guards are authoritative even if a UI check is bypassed.
- Without Supabase configuration, the app uses demo mode and browser-local persistence. This is useful for local UI exploration, not cross-device sync.
- The interface is styled in `app/globals.css`; preserve its mobile-first layout and test narrow widths when changing primary logging flows.

## Source map

| Area | Source of truth |
| --- | --- |
| Shared domain and persisted shapes | `src/lib/types.ts` |
| Built-in exercise and workout templates, cues, defaults, library instructions | `src/lib/templates.ts` |
| Exercise search, filters, restriction checks, equipment alternatives | `src/lib/exercise-library.ts` |
| Deterministic daily workout generation and selection reasons | `src/lib/planner.ts` |
| Trainer rule defaults, bounds, normalization, and sensitivity checks | `src/lib/trainer-rules.ts` |
| Logging validation, normalization, duplicate-safe persistence workflow | `src/lib/workout-tracking.ts` |
| Progress windows, consistency, performance, records, recovery summaries | `src/lib/progress.ts` |
| Cloud persistence, auth role checks, profile/rule/session mapping | `src/lib/supabase-repository.ts` |
| Main UI and mode wiring | `src/components/fit-track-app.tsx` |
| Trainer preview, confirmation, edit, and audit UI | `src/components/trainer-controls.tsx` |
| Email authentication callback | `app/auth/callback/route.ts` |
| Database schema, RLS, triggers, and validators | `supabase/migrations/` |
| Release, migration, backup, and recovery procedures | `docs/RELEASE_READINESS.md` |

## Main data model

`src/lib/types.ts` defines the shared app model. Important relationships are:

- `Profile`: account identity, schedule, training start date, timezone, experience, confirmed equipment, and the trainer role flag used by the UI.
- `WorkoutPlan`: dated prescribed session, selected exercises, reasons, source template IDs, phase, template/rule versions, and a snapshot of trainer settings/revision. A generated day's plan is persisted and reused instead of being silently regenerated after refresh.
- `WorkoutSession`: a plan plus status, optional pre-workout check-in, exercise logs, post-workout review, and completion timestamp.
- `ExerciseLog`: planned set/repetition targets and actual set outcomes, completion status, substitution name, form quality, and notes.
- `CheckIn` and `WorkoutReview`: readiness/recovery/pain and post-workout effort/energy/discomfort feedback.
- `TrainerRuleSettings` and `TrainerRuleAudit`: bounded future-plan overrides and an immutable record of the previous/new settings and actor.
- `BodyWeightEntry`: optional dated measurement; it is not required for app use or progress calculations.

## Workout rules and safety behavior

`src/lib/planner.ts` is a pure, deterministic planner. It considers the approved schedule and training phase, prior completed/partial sessions, loads/reps, skipped exercises, check-ins/reviews, recent frequency, recovery, restrictions, and available equipment. It gives reasons for selections and modifications and snapshots the rule/template version.

- Rep progress comes before a small load step. A load step requires a recorded prior load, top-of-range performance, completed sets, explicitly sound form, and no pain report.
- Missing history never creates a guessed working weight.
- Duplicate exercises and redundant movement patterns are avoided. Adjacent sessions use history for variety when safe alternatives exist.
- Missed sessions are not crammed together. A long break leads to a lighter return session; rest and recovery plans are valid outcomes.
- Recovery rules reduce volume or recommend recovery based on fatigue. Pain is a hard safety signal in code, outside trainer-editable recovery settings.
- Equipment alternatives preserve the source movement in the session snapshot and explain the substitution.
- Deadlift approval is client-specific, explicit, trainer-authorized, and not time-based. The database rejects a saved plan containing a deadlift variation while approval is off.

Trainer edits are deliberately bounded. The trainer UI previews the next scheduled workout against saved client history before saving. Higher training demand or lower recovery protection requires confirmation; deadlift approval has a separate confirmation. The matching TypeScript and Postgres validators must be changed together, with tests, for future rule-bound changes.

## Exercise library and media

Exercise reference text is maintained in `src/lib/templates.ts`; query and alternative behavior is in `src/lib/exercise-library.ts`. The library uses beginner-friendly text, equipment requirements, muscles, difficulty, rep/rest guidance, and cautions. There is no bundled third-party image or video. Do not add exercise media until source, permission, license, and required attribution have been verified and recorded. A text guide is the fallback.

## Progress definitions

Progress calculations are in `src/lib/progress.ts` and should be changed only with tests and matching UI labels.

- Default consistency window: inclusive 28 calendar days ending on the selected/current date. Numerator is explicitly completed sessions on scheduled training dates. Denominator is scheduled training dates on or after the profile training-start date within that same window. Partial, planned, skipped, inferred rest, and no-record dates do not count as completed.
- Exercise performance uses actual completed set logs and shows prescribed targets separately. Substitutions are grouped under their recorded movement name.
- A personal record is the highest positive recorded load on a completed set with positive actual reps. No estimated one-rep maximum is calculated.
- Recovery metrics summarize available check-in/review values and skipped logs; absent values remain absent.
- Body weight is optional. No gap is filled with an invented value or workout.
- Cloud history currently reads at most 300 sessions and body-weight history at most 1,000 entries per account. Older records remain stored but are not currently loaded into these views.

## Supabase schema and access model

Apply migrations in filename order after checking the project's migration history. Do not recreate existing tables or reset data.

1. `20261027125945_20261027114450_fittrack_mvp.sql`: profiles, trainer rules, and workout session snapshots with owner policies.
2. `20261027130002_20261027150000_persistent_workout_tracking.sql`: trainer/client relationships and normalized check-in, exercise-log, set-log, and review records with row-level policies.
3. `20261027162804_20261027141721_phase_3_workout_generation.sql`: equipment/form-quality and workout generation data support.
4. `20261027162809_20261027153903_phase_5_progress_tracking.sql`: optional owner-only body-weight entries.
5. `20261027162818_20261027162000_phase_6_trainer_controls.sql`: bounded trainer settings/revisions, append-only audit, authorization guards, and the deadlift plan guard.

Main tables are `profiles`, `trainer_rules`, `trainer_clients`, `workout_sessions`, `workout_check_ins`, `workout_exercise_logs`, `workout_set_logs`, `workout_reviews`, `body_weight_entries`, and `trainer_rule_audit`. Session snapshots retain the original plan while normalized child rows store actual outcomes.

Authorization is based on trusted `auth.app_metadata.role = 'trainer'` plus an active `trainer_clients` relationship. Never grant a trainer role through user-editable `user_metadata`. Clients own their profile, logs, and private body-weight entries. A trainer can read only active linked clients and edit only allowed trainer rules/restrictions; trainer access does not grant control of client workout logs. The audit table is append-only from the application and readable only by the client and authorized linked trainer. RLS and database triggers are the enforcement boundary; UI hiding is not authorization.

Provision trainer roles and client relationships only through a trusted Supabase administrator process after verifying both auth user IDs. Never add an admin/service-role credential to frontend config to work around an RLS failure.

## Local setup and checks

Use Node.js 22.6 or newer. Install dependencies with `npm install`, then run:

```sh
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

For local cloud mode, copy `.env.example` to the ignored `.env.local` and set these names:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Use only the project's public URL and publishable key in browser configuration. Do not put service-role or secret keys in `NEXT_PUBLIC_` variables. Add the local `/auth/callback` URL and each approved preview callback URL to Supabase Auth's redirect allow-list; enable the intended email sign-in method. The callback URL and site origin must match exactly. Do not put real credential values in this document or `.env.example`.

For schema work, read the relevant Supabase skill guidance, inspect remote migration history and existing data first, review SQL, apply only the intended additive migration, then inspect RLS and security/performance advisors. Before changes to a populated database, create and verify a backup using the current plan's available backup features. See `docs/RELEASE_READINESS.md` for recovery and rollback steps. Prefer application rollback while leaving additive schema and audit history intact.

## GitHub and Vercel state

- Local `origin` points to `https://github.com/anilkumar-repo/fittrack.git`.
- Vercel reports a GitHub link to `anilkumar-repo/fittrack` and a Hobby project with SSO deployment protection. Pushes may trigger Vercel Git deployments; check the resulting target before sharing or promoting anything.
- A source-based Vercel deployment was mistakenly created with `target: production` after a preview was requested. It is READY at `https://fittrack-gvp8vgriy-anilkumarm.vercel.app` and has aliases `fittrack-inky-eta.vercel.app` and `fittrack-anilkumarm.vercel.app`. The project currently reports `live: false`; SSO protection is enabled. This is not a verified preview. The connected Vercel tools did not expose a completed-deployment/alias removal operation. Inspect and deactivate/remove these aliases in Vercel before sharing the app or creating a preview. Never treat this deployment as production approval.
- Keep Vercel deployment protection enabled while testing. Use a feature branch for GitHub work and verify Vercel reports `target: preview`; do not push release changes to the production branch without separate approval.
- The workspace has no permission to claim a successful end-to-end production release. A real two-account RLS test and mobile browser walkthrough still need to be completed.
- Do not commit `.env.local`, `.vercel`, `.next`, `node_modules`, or build output. `.gitignore` excludes these; `.env.example` contains blank placeholders.

## Guidance for future coding assistants

1. Read this file and `docs/RELEASE_READINESS.md`; inspect `git status` and the latest migrations before editing.
2. Preserve the current UI, stored records, and versioned workout snapshots. Prefer small extensions to existing modules.
3. Put generation/validation logic in pure tested modules, not UI components. Update TypeScript and SQL validation together for rule changes.
4. Keep the deadlift gate, pain stop, role checks, and RLS independent of client-supplied UI state.
5. Use verified facts only for equipment, history, performance, and media licensing. Do not invent data.
6. Run the test, lint, typecheck, and build scripts after code changes. Do not claim live auth/RLS behavior until tested with real client and trainer accounts.
7. Do not deploy, promote, change plans, remove data, or commit/push unless the user explicitly asks. Before any deployment, confirm the target is Preview and that it is protected.
