-- Phase 3: persist confirmed equipment choices and form quality for conservative progression.
-- Existing profile/session ownership and RLS policies continue to govern these columns.

alter table public.profiles
  add column equipment_availability text not null default 'unknown'
    check (equipment_availability in ('unknown', 'verified')),
  add column available_equipment text[] not null default '{}'::text[]
    check (
      cardinality(available_equipment) <= 8
      and available_equipment <@ array['dumbbells', 'bench', 'cable_machine', 'leg_press', 'leg_curl_machine', 'rack', 'mat', 'chair']::text[]
    );

alter table public.workout_exercise_logs
  add column form_quality text not null default 'not_rated'
    check (form_quality in ('not_rated', 'sound', 'needs_practice'));
