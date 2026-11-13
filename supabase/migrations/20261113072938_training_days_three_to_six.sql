-- Clients may now train 3 to 6 days a week (was 2 to 4). One rest day stays required.
alter table public.profiles drop constraint if exists profiles_sessions_per_week_check;
alter table public.profiles drop constraint if exists profiles_training_days_count;

alter table public.profiles
  add constraint profiles_sessions_per_week_check check (sessions_per_week between 3 and 6),
  add constraint profiles_training_days_count check (cardinality(training_days) between 3 and 6);
