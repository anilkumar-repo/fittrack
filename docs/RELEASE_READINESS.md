# FitTrack release readiness

## Trainer controls

Trainer rules are bounded and deterministic. They can change repetition-based template targets, progression increments, recovery cutoffs, and the equipment source used by future plans. Foundation-phase set caps remain in the planner. Pain-triggered recovery is fixed in code and is not editable. The database also rejects trainer settings outside the same allowed ranges and rejects a workout snapshot containing a deadlift variation unless the target client has an explicit trainer approval.

The rules UI previews the next scheduled workout against saved client history before saving. Changes that reduce recovery protection or raise training demand require a browser confirmation. Deadlift approval has a separate confirmation and never expires by date. Existing workout snapshots keep their rule version, rule revision, and settings snapshot.

Trusted authorization uses `auth.app_metadata.role = 'trainer'` and an active `trainer_clients` row. Do not assign trainer roles using user-editable `user_metadata`. Provision the role and relationship through a trusted Supabase administrator process. Trainers can read and edit only linked clients; clients retain control of their profile and workout logs. The database trigger writes old/new rule values, trainer ID, client ID, and timestamp to the append-only `trainer_rule_audit` table. Authenticated users have read-only audit access limited to their own client record or an active linked client.

To adjust the in-repository safety bounds, update `src/lib/trainer-rules.ts`, the matching database validator in `supabase/migrations/20261027162818_20261027162000_phase_6_trainer_controls.sql`, and tests together. Keep the hard pain stop and deadlift approval independent from editable settings. Exercise overrides currently support only the repetition-based exercises offered by the trainer panel; timed and per-side movements remain at their library targets.

## Environment and authentication

The browser uses only these values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Copy `.env.example` to `.env.local` for local work. Set the site URL to `http://localhost:3000` locally and to the protected preview origin when testing a Vercel preview. Add the matching `/auth/callback` URL to Supabase Auth's redirect allow-list. The callback reports a safe sign-in error without exposing tokens. No service-role key is read by the client or documented in a public variable. `.env.local` is ignored by Git; `.env.example` contains empty placeholders only.

Configure Supabase email sign-in and Auth URL settings in the project dashboard. The connected database integration can apply SQL migrations but does not configure email delivery or the Auth redirect allow-list. Use the same authenticated account across devices for workout sync; RLS scopes records by `auth.uid()` and active trainer relationship.

## Database migration and rollback

The live project previously had the Phase 1 and Phase 2 migrations applied; its tables had no workout/profile rows at the Phase 6 audit. The migration sequence for the current code is Phase 3 equipment/form-quality fields, Phase 5 optional body-weight history, and Phase 6 trainer settings/audit/security guards. Review migration status before applying SQL. These changes add columns, a table, constraints, triggers, and policies; they do not delete or rewrite workout rows.

Before a future migration against populated data, create and verify a database backup using the backup options available on the current Supabase plan. Do not upgrade a plan for this purpose without approval. Keep a copy of the migration files and the application revision used for the change. Verify the new columns, RLS flags, trainer rule audit table, and security advisor results after applying.

The preferred rollback is an application rollback to the last known-good release while leaving additive columns and audit history in place. This keeps saved sessions and audit evidence intact. To reset a client's settings, use an authorized trainer to save the conservative defaults; that reset is recorded in the audit history. Do not drop the audit table or reverse the additive migration while its data is needed. A structural rollback would require a verified backup, a maintenance decision, and confirmation that no saved plan or release depends on the added fields.

## Release and recovery procedure

1. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` locally.
2. Apply reviewed migrations in order and inspect Supabase security/performance advisors.
3. Configure only public Supabase URL/publishable-key variables in the Vercel Preview environment. Keep deployment protection enabled.
4. Verify the preview sign-in callback and exercise the full flow with separate client and linked trainer accounts. Check that an unlinked trainer and a client cannot change trainer rules, and that a client cannot save a deadlift plan while the restriction is off.
5. Confirm a trainer change creates one audit row and a newly generated session stores its trainer rule revision. Confirm existing session snapshots are unchanged.
6. Keep production promotion, Git commits/pushes, plan changes, and data deletion out of this release step unless separately approved.

## Current Vercel status (2026-10-27)

The connected Vercel deployment tool returned a deployment with `target: production` after a preview was requested. It reached `READY` at `fittrack-gvp8vgriy-anilkumarm.vercel.app` and received the aliases `fittrack-inky-eta.vercel.app` and `fittrack-anilkumarm.vercel.app`. The project currently reports `live: false`, and SSO protection is enabled for deployments except custom domains. Treat this as a production-target deployment, not a verified preview. The connected tools did not expose a deployment or alias removal operation. Before sharing or using a preview, inspect this deployment in Vercel and remove or otherwise deactivate the aliases there; then create a verified Preview deployment only after confirming the tool reports `target: preview`.

If sync fails, the app keeps the in-progress session on-device and presents a retry action. Preserve that browser's local data until sync succeeds. For a database incident, stop rule changes, preserve audit history, restore only through a verified backup or Supabase recovery process, and confirm row counts and access policies before reopening sign-in. Do not use service-role credentials in the client to work around an RLS failure.

## Known release gaps

- Real trainer/client authorization requires administrator-provisioned `app_metadata` roles and active relationship rows.
- Supabase Auth email delivery and callback allow-lists need dashboard configuration.
- Cross-device, two-account RLS behavior must be smoke-tested with real accounts; local automated tests do not simulate Supabase JWT claims.
- The history reader is still capped at 300 sessions per account; older sessions remain stored but are not loaded into the app.
- No production deployment is part of Phase 6. Keep any preview behind Vercel SSO protection.
