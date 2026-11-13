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
- Pages live under `app/(app)/`: `/` (overview), `/today` (also `/today?date=YYYY-MM-DD`), `/progress`, `/library`, and `/settings`. `app/(app)/layout.tsx` keeps the shared state and navigation mounted while moving between them. `app/error.tsx` and `app/not-found.tsx` are the full-page error and missing-page messages.
- `src/components/app/fit-track-provider.tsx` owns shared state: demo/cloud mode, account loading, session saving, and profile updates, exposed through `useFitTrack()`. `src/components/app/use-workout-day.ts` gives one date's saved session and plan and saves the `planned` session. `src/components/app/app-shell.tsx` is the sidebar, top bar, messages, and mobile navigation. Each page's UI and its own form state is one file in `src/components/screens/`. `src/components/trainer-controls.tsx` is the trainer rule preview/edit surface.
- `app/auth/callback/route.ts` exchanges the Supabase email-link code for a cookie-backed session and redirects to the same origin with a safe error state on failure.
- `src/lib/supabase-browser.ts` creates the browser Supabase client only when the public URL and publishable key are configured.
- `src/lib/supabase-repository.ts` maps authenticated Supabase rows into the app model and persists profiles, sessions, logs, reviews, body weight, and trainer rule state. Row-level security and database guards are authoritative even if a UI check is bypassed.
- Without Supabase configuration, the app uses demo mode and browser-local persistence. This is useful for local UI exploration, not cross-device sync.
- Saving: each change updates the screen and a device draft at once; set/rep/review edits reach Supabase after an 800 ms pause in typing, and are flushed when the tab is hidden. Drafts left on a device are retried automatically at the next sign-in.
- Account loading happens once per signed-in user. Repeated `SIGNED_IN`/`TOKEN_REFRESHED` events for the same user must not reload state, because that would overwrite unsaved edits.
- A new account starts from the sign-in email's name, the device time zone, and today as the training start date. Completed or in-progress workouts logged in demo mode on that device are carried into the account on first sign-in (dates already saved in the account are left alone).
- First run shows the welcome steps (`src/components/app/welcome.tsx`): name, training days, session length, equipment. `FitTrackState.onboarded` records that they are done. For an account, a saved `profiles` row means onboarded; a brand-new account's profile row is written when the steps finish, not at sign-in.
- Sign-in is at `/sign-in`, in the top bar while signed out, on the first welcome step, and in Settings. Settings also holds trainer linking by invite code, the trainer's invite-code card, data download (`src/lib/account-data.ts`), and deleting workout history. The trainer role itself is still set once by an administrator in `app_metadata`.
- Workout logger (`src/components/app/exercise-log-card.tsx`, `rest-timer.tsx`, helpers in `src/lib/logging.ts`): each exercise shows last time's reps and load, a rest countdown starts when a set is ticked, phones show one exercise at a time, and a saved session can be reopened with "Edit entries". Weights are always stored in kilograms; kg/lb is a per-device display choice (`fittrack-weight-unit` in local storage). Planner advice text still quotes kilograms.
- Installable app: `app/manifest.ts`, icons in `public/icons/`, and `public/sw.js` (registered in production builds only) cache the app's own pages and files. It does not cache account data: a signed-in person who opens the app with no connection sees this device's local data until the connection returns. Unsynced sessions retry automatically when the browser reports it is back online.
- `stateRef` in the provider must be updated in the same place as every `setState` call. Page components save from their own effects, which run before the provider's effects; a stale ref there once overwrote the saved profile with the placeholder state.
- `.github/workflows/ci.yml` runs test, typecheck, lint, and build on pushes to `main` and on pull requests.
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
| Shared state, saving, account loading | `src/components/app/fit-track-provider.tsx` |
| One date's session and plan | `src/components/app/use-workout-day.ts` |
| Navigation shell | `src/components/app/app-shell.tsx` |
| Page UI (overview, today, progress, library, settings) | `src/components/screens/` |
| Exercise guide and history detail dialogs | `src/components/app/exercise-guide-modal.tsx`, `src/components/app/history-detail-modal.tsx` |
| Date helpers and page addresses | `src/lib/dates.ts` |
| Device drafts of unsynced sessions | `src/lib/pending-sessions.ts` |
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
- Recovery rules reduce volume or recommend recovery based on fatigue. Pain is a hard safety signal in code, outside trainer-editable recovery settings. Pain ticked in today's check-in always switches the day to recovery. A pain or discomfort report from the previous logged session lightens only the next session (fewer sets, no progression); it does not force a week of recovery (rules `2026.11.12.1`).
- Equipment alternatives preserve the source movement in the session snapshot and explain the substitution.
- Deadlift approval is client-specific, explicit, trainer-authorized, and not time-based. The database rejects a saved plan containing a deadlift variation while approval is off.

Trainer edits are deliberately bounded. The trainer UI previews the next scheduled workout against saved client history before saving. Higher training demand or lower recovery protection requires confirmation; deadlift approval has a separate confirmation. The matching TypeScript and Postgres validators must be changed together, with tests, for future rule-bound changes.

## Exercise library and media

Exercise reference text is maintained in `src/lib/templates.ts`; query and alternative behavior is in `src/lib/exercise-library.ts`. The library uses beginner-friendly text, equipment requirements, muscles, difficulty, rep/rest guidance, and cautions.

Media:

- **Anatomy pictures** are AI-generated front-and-back muscle images supplied by the trainer (originals in `design/figures-incoming/`). They were processed once (background removed, one-sided muscle groups cropped to the front or back view, separate front and back files made) into `public/figures/`, named `{female|male}-{group}[-front|-back].webp`. `src/lib/muscle-images.ts` maps muscle groups to files; a test checks every file exists. They are used for today's targets on Train, the Home card, the exercise guide (a figure that turns between front and back on tap or drag), every exercise thumbnail, and the welcome screens. The neutral figure has no pictures and falls back to the drawn figure in `src/components/app/body-figure.tsx`. Check the image tool's terms allow commercial use before a public release.
- **Videos**: "Watch a demonstration" (`src/lib/exercise-media.ts`) opens a YouTube search for the exercise name in a new tab, labelled as unreviewed. To pin a specific video, the trainer adds its address to `TRAINER_DEMO_VIDEOS` after watching it. Never add a video address that has not been opened and checked.

Progress charts use `src/components/app/line-chart.tsx` (one measure per chart, hover or tap to read a session, table of exact values beside it).

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
6. `20261112074033_phase_7_atomic_session_save.sql`: `public.save_workout_session(jsonb)`, a security-invoker function that writes a session and its check-in, exercise logs, set logs, and review in one transaction. Applied to the live project on 2026-11-12 and checked there in a rolled-back transaction as an authenticated user (insert, update, child rows, deadlift guard). The app calls it first and falls back to the step-by-step save when the function is missing.
7. `20261112074535_phase_8_invites_and_data_controls.sql`: `trainer_invites` plus `create_trainer_invite()`, `accept_trainer_invite(code)`, `remove_my_trainers()`, and `delete_my_workout_data()`. Dry-run in a rolled-back transaction and then applied to the live project on 2026-11-12. These four functions are `security definer` on purpose (each acts only for `auth.uid()`), so the Supabase advisor lists them as callable by signed-in users; that is expected.

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

- The GitHub `origin` is https://github.com/anilkumar-repo/fittrack. At the 2026-10-27 check, `main` was at commit `246e02be75fc8bae3b71b9f5c83e8eb73fa7f65d` (`NEW`).
- The latest Vercel deployment is `READY`, `target: production`, from the same main commit. Deployment URL: https://fittrack-a92dmuoae-anilkumarm.vercel.app. Project aliases reported by Vercel: `fittrack-anilkumarm.vercel.app`, `fittrack-inky-eta.vercel.app`, and `fittrack-git-main-anilkumarm.vercel.app`.
- Vercel project metadata reports `live: false` despite the `READY` deployment. SSO protection is enabled with `all_except_custom_domains`, so the Vercel-hosted aliases remain protected. Public access and client readiness have not been verified.
- Vercel listed `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` for Production after the user configured them and redeployed. Environment values are intentionally excluded from this document. Preview did not list these variables at verification time; configure them separately before preview testing.
- Supabase migrations through Phase 6 and RLS were previously verified. Supabase Auth email-provider settings and redirect allow-lists, a real client/trainer two-account RLS check, and the mobile logging flow still need confirmation.
- Keep deployment protection enabled until authentication and RLS smoke tests pass. If external clients need access, decide on a custom domain or deployment-protection change only after those checks; do not assume SSO has been removed.
- Do not commit, push, change plans, remove aliases, or deploy production as part of a documentation update unless separately authorized. Verify the Vercel target before future releases.

## Guidance for future coding assistants

1. Read this file and `docs/RELEASE_READINESS.md`; inspect `git status` and the latest migrations before editing.
2. Preserve the current UI, stored records, and versioned workout snapshots. Prefer small extensions to existing modules.
3. Put generation/validation logic in pure tested modules, not UI components. Update TypeScript and SQL validation together for rule changes.
4. Keep the deadlift gate, pain stop, role checks, and RLS independent of client-supplied UI state.
5. Use verified facts only for equipment, history, performance, and media licensing. Do not invent data.
6. Run the test, lint, typecheck, and build scripts after code changes. Do not claim live auth/RLS behavior until tested with real client and trainer accounts.
7. Do not deploy, promote, change plans, remove data, or commit/push unless the user explicitly asks. Before any deployment, confirm the target is Preview and that it is protected.
