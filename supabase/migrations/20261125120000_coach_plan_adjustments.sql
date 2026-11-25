-- R14 Coach review: the plan changes a person approved (or let Rozi apply) after their weekly review.
--
-- One JSON object on the person's own profile row. It is read and written only through the existing profile RLS
-- (a person can read and update only their own row), so no new policy, function or grant is needed. The app
-- validates the shape when it reads it; the database keeps it an object and small.
--
-- Shape (docs/ROZI_AGENT_ARCHITECTURE.md §13):
--   { "v": 1, "swaps": { "<fromExerciseId>": "<toExerciseId>" }, "setDelta": -1 | 0 | 1,
--     "lightWeekStart": "YYYY-MM-DD" | null, "autoApply": boolean, "history": [ ...last 20 changes, for undo ] }

alter table public.profiles
  add column if not exists plan_adjustments jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_plan_adjustments_shape;

alter table public.profiles
  add constraint profiles_plan_adjustments_shape
  check (jsonb_typeof(plan_adjustments) = 'object' and pg_column_size(plan_adjustments) <= 16384);

comment on column public.profiles.plan_adjustments is
  'R14 coach review: approved plan changes (exercise swaps, set nudge, own lighter week, auto-apply, undo history). Owner-only via profiles RLS.';
