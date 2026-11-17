-- Phase 2 onboarding: two optional answers on the profile.
--   focus_area: a muscle group that gets one extra set ("balanced" = none)
--   gym_type:   where the person trains; it only sets the starting equipment list
-- Both are optional (null for everyone who set up before), owned by the existing profile row policies.

alter table public.profiles
  add column if not exists focus_area text
    check (focus_area in ('balanced', 'chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core')),
  add column if not exists gym_type text
    check (gym_type in ('large_gym', 'small_gym', 'home', 'bodyweight'));

comment on column public.profiles.focus_area is 'Optional focus muscle group chosen in onboarding; adds one set to moves that train it.';
comment on column public.profiles.gym_type is 'Where the person usually trains (onboarding); sets the starting equipment list.';
