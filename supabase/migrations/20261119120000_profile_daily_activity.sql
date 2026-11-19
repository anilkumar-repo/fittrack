-- Onboarding: "How active is your typical day?" (outside workouts). Optional; null for everyone who set up before.
-- Used for the water target (+0 / +250 / +500 ml), sitting-reset stretch suggestions and Rozi's view of the profile.
-- Owned by the existing profile row policies, like focus_area and gym_type.

alter table public.profiles
  add column if not exists daily_activity text
    check (daily_activity in ('seated', 'light', 'on_feet', 'active'));

comment on column public.profiles.daily_activity is 'Optional onboarding answer: how active a typical day is outside workouts (seated, light, on_feet, active).';
