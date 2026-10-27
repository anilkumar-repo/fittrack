# FitTrack Workout Planner

A mobile-first workout planner for a beginner training plan. Workout generation uses deterministic, versioned rules in this repository; it does not call a paid AI API.

For the architecture, source map, database/access model, safety rules, metric definitions, setup, and current release handoff, see [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md). Release and recovery procedures are in [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md).

## Current features

- Dashboard, weekly schedule, and a progress view with dated session statuses, exercise trends, recorded-load personal records, recovery feedback, optional body-weight history, and selectable saved workouts.
- Searchable exercise library with muscle, movement-pattern, equipment, and difficulty filters; each entry includes target muscles, beginner-friendly steps, equipment, sets/reps, rest, and applicable cautions.
- Exercise names in today’s workout open the same library guide. Before a planned workout starts, an equipment-safe alternative can be saved while keeping the source template in the session snapshot.
- Exercise references are text-first. No third-party exercise image or video is included; when a legacy entry lacks new instructions, the guide falls back to its existing cues.
- Pre-workout check-in for energy, soreness, pain/discomfort, and recovery.
- Per-exercise planned sets/reps, completed sets, actual reps/weight, completion status, skipped movements, substitutions, and notes.
- Post-workout effort, energy, discomfort, and notes.
- In-progress sessions autosave. A session stays marked in progress until its related entries save; failed cloud writes remain on this device with a retry action.
- Each session keeps a snapshot of the workout template and rule versions used to make it.
- A deterministic daily engine uses the approved weekly schedule, phase, completion history, loads, reps, skipped exercises, check-ins, post-workout feedback, and recent training frequency.
- Generated plans are saved as `planned` sessions for their date and reused after refresh. Starting a workout saves the check-in-adjusted plan snapshot.
- Confirmed equipment is selectable in Trainer settings. Unknown equipment uses equipment-free alternatives; each substitution and modification keeps a reason and the source-template snapshot.
- Progress reps before considering a small load step. Load increases require the top of the rep range, completed sets, explicitly sound form, no pain report, and a recorded prior load. The engine never invents a working weight.
- No duplicate exercises or movement patterns within a session. Adjacent training days avoid repeating recent movement patterns where a safe alternative exists. Missed days are not crammed into another session; a break of 14 days or more creates a lighter return session.
- Low readiness or high soreness reduces volume; pain reports switch the plan to optional recovery and display guidance to stop painful activity and seek professional assessment when appropriate.
- Deadlift variations remain off by default. Only a trusted trainer account with an active client relationship can approve them for that client; existing plan snapshots do not change.
- Demo mode stores workouts you log in this browser and starts with no completed history. Signed-in accounts store profiles and workout sessions in Supabase so the same account can retrieve them on another device.

## Run locally

Use Node.js 22.6 or later.

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Without Supabase settings, the app uses demo mode. Demo sessions persist across refreshes in the same browser; cross-device sync requires Supabase authentication and the migrations below.

## Supabase persistence

A dedicated Supabase project is configured for FitTrack in `ap-south-1` (project ref `cjdvgtqxanetaegbkojv`, [project dashboard](https://supabase.com/dashboard/project/cjdvgtqxanetaegbkojv)). The Phase 1–6 migration sequence is applied, including the Phase 3 equipment/form-quality fields, Phase 5 owner-only body-weight table, and Phase 6 trainer settings, audit history, bounded validation, and deadlift plan guard. At the Phase 6 audit, every FitTrack public table had RLS enabled and zero rows. No workout data was changed.

The local `.env.local` file is ignored by Git and contains the project's public API URL and publishable key. If setting up another machine, copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` to the project API URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key from Supabase **Project Settings → API Keys**. This key is intended for browser use; never put a service-role or secret key in a `NEXT_PUBLIC_` variable or frontend code.
- `NEXT_PUBLIC_SITE_URL` to `http://localhost:3000` for local use.

The app uses email one-time-password links. In Supabase **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback`. After a Vercel preview exists, add that preview origin and its `/auth/callback` URL. Email sign-in must be enabled for the project. The connected Supabase integration can create projects and apply SQL migrations, but it cannot edit these Auth dashboard settings; the browser dashboard also requires a separate Supabase sign-in.

For future migrations, install the Supabase CLI, run `supabase login`, `supabase link --project-ref <project-ref>`, review the pending SQL, then use `supabase db push` from this folder. The Phase 2 migration keeps Phase 1 JSON snapshots and backfills their check-ins, exercise logs, sets, and reviews into related tables. Phase 3 adds columns to existing RLS-protected profile and exercise-log tables. Phase 5 creates `public.body_weight_entries`, grants only authenticated select/insert/update, and applies owner-only row-level policies; trainers do not receive access to these private measurements. Phase 6 adds append-only trainer-rule audits and rejects invalid rule settings or unapproved deadlift plans at the database boundary.

Once the Auth URL settings are saved, restart the local app. Open **Trainer settings → Account & sync**, request a magic link, and sign in. Sessions, check-ins, set logs, and reviews then load from Supabase and can be retrieved by the same account on another device.

The database enforces ownership with row-level security. Clients can read and write their own records. A trainer can read only records for an active relationship in `public.trainer_clients`; trainers can change a client's deadlift rule but cannot edit the client's workout logs. Relationship rows are provisioned by a trusted administrator, for example in the Supabase SQL Editor after verifying both user IDs:

```sql
insert into public.trainer_clients (trainer_id, client_id, status)
values ('<trainer-auth-user-id>', '<client-auth-user-id>', 'active')
on conflict (trainer_id, client_id) do update set status = 'active';
```

Set the trainer's trusted `app_metadata.role` to `trainer` through a secure Supabase Auth administration process. Do not use user-editable `user_metadata` for permissions, and never expose an admin/service-role key in this app. A trainer role without an active client relationship grants no access to client records.

## Local checks and workout flow

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The progress view defines consistency as explicitly completed sessions on scheduled days divided by scheduled days on or after the training start date in the inclusive 28-day window ending today. Partial, planned, skipped, unrecorded, and inferred rest days are not counted as completed. A personal record is the highest positive load on a completed set with actual reps recorded; no estimated one-rep max is calculated. Substitutions are grouped under their logged movement name. Progress rules live in `src/lib/progress.ts`.

The current Supabase reader loads up to 300 recent workout sessions and 1,000 body-weight entries. Older rows remain stored but are not included in the displayed history, charts, or record calculations until the reader is paginated.

The automated suite covers deterministic plan generation, trainer-only deadlift approval, equipment substitutions, progression and missing history, recovery and pain handling, rest days, missed days, date consistency, planned-session persistence, incomplete workouts, validation, owner/trainer permissions, duplicate submissions, progress calculations and empty states, optional-weight validation, historical actual-versus-prescribed values, and bounded trainer rule validation. It does not connect using authenticated Supabase JWTs. The live migration, policies, triggers, and settings validator were checked; two authenticated accounts (client and linked trainer) are still needed for the full cross-device and RLS smoke test.

Exercise reference text is maintained in `src/lib/templates.ts`; search, filters, equipment-aware alternatives, and restriction checks live in `src/lib/exercise-library.ts`. The guidance is written for FitTrack and checked against general beginner safety guidance from the [NHS strength exercise guide](https://www.nhs.uk/live-well/exercise/strength-exercises/) and [MedlinePlus exercise injury prevention guidance](https://medlineplus.gov/ency/patientinstructions/000859.htm). It is general information, not diagnosis or individualized clinical advice. No exercise media is currently bundled, so there are no media permissions or third-party media licenses to manage.

In demo mode, open **Today’s workout** and note the saved plan version and its reasons. Confirm equipment in **Trainer settings** to see equipment-aware substitutions, complete the check-in, and start the workout. Log reps, load if known, and form quality; refresh to confirm the in-progress session remains in the same browser. Complete the review and save the session, then open **Progress → Session history** to inspect the plan snapshot, substitutions, exercise details, and feedback.

## Adjusting workout rules

- `src/lib/templates.ts` is the source for exercise templates, movement patterns, equipment requirements, safe alternatives, set/rep defaults, and version numbers.
- `src/lib/templates.ts` also holds the exercise library’s authored target-muscle labels, difficulty, step-by-step text, and cautions. Keep attribution/source/license/permission details with any future media, and only render media after those details are verified.
- `src/lib/exercise-library.ts` contains pure search/filter rules, equipment-aware alternatives, and the deadlift restriction gate; its tests are in `src/lib/exercise-library.test.ts`.
- `src/lib/planner.ts` contains the deterministic generation engine: phase threshold, recovery thresholds, missed-day behavior, adjacent-day variety, progression criteria, substitutions, and user-facing reasons. `src/lib/trainer-rules.ts` contains validated trainer override limits and the fixed pain/restriction boundary; the matching database validation is in the Phase 6 migration.
- `src/lib/progress.ts` contains date-window, consistency, timeline, actual-performance, personal-record, recovery, and optional body-weight calculations. Update these formulas with tests when changing dashboard metric definitions.
- Keep deadlift authorization tied to the persisted trainer approval flag. Training time or phase progression must never enable it automatically.
- Add or change rules with tests in `src/lib/planner.test.ts`, then bump `RULE_VERSION` or `TEMPLATE_VERSION` so each saved workout identifies the logic that produced it.

## GitHub and Vercel setup

The local `origin` points to the private `anilkumar-repo/fittrack` repository, and Vercel reports a GitHub link for that repository. The Vercel Hobby project has SSO deployment protection enabled. A source-based deployment unexpectedly completed with `target: production` after a preview was requested; it is READY with deployment aliases while the project reports `live: false`. Treat it as a production-target deployment, not a preview. Inspect and deactivate/remove its aliases in Vercel before sharing the app or creating another deployment. See [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) for the current deployment details and [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md) for release checks.

Git pushes may trigger Vercel automatically. Use a non-production branch and verify a resulting deployment reports `target: preview`; do not push to the production branch without explicit release approval. The `outputs/` folder, `.env.local`, `.vercel`, and build artifacts are excluded from the source repository.

Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` to Vercel's Preview and Development environments. Do not add a service-role or secret key. Keep deployment protection enabled while testing.

## Phase 6 trainer controls and release notes

Authorized trainers can preview and save bounded exercise-template, progression, recovery, and equipment changes for active linked clients. Sensitive changes require confirmation; pain recovery remains fixed; deadlift approval is separate, explicit, audited, and never time-based. New workout snapshots include the exact trainer rule revision and settings used. Database RLS and validation remain authoritative if a user bypasses the interface.

See [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md) for trainer authorization setup, environment variables, migration order, backup and rollback guidance, preview checks, and remaining release gaps. Phase 6 adds `supabase/migrations/20261027162818_20261027162000_phase_6_trainer_controls.sql`.
