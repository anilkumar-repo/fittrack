-- Exercise "Friends" leaderboard (Phase 4 gap):
--   1. profiles.share_lifts: the person's choice to share best lifts with friends (null = default: on, off under 18).
--   2. friend_stats.lift_bests: best set per exercise, { "<exercise id>": { "kg": 42.5, "reps": 8, "e1rm": 53.8, "date": "2026-11-12" } },
--      at most 60 exercises. Read through the existing friend_stats policies (friends and fellow challenge members only).
-- Both are additive with safe defaults; nothing existing changes.

alter table public.profiles
  add column if not exists share_lifts boolean;

comment on column public.profiles.share_lifts is 'Share best lifts with friends (exercise leaderboard). Null = default: on, off for anyone under 18.';

alter table public.friend_stats
  add column if not exists lift_bests jsonb not null default '{}'::jsonb;

alter table public.friend_stats drop constraint if exists friend_stats_lift_bests_check;
alter table public.friend_stats add constraint friend_stats_lift_bests_check
  check (jsonb_typeof(lift_bests) = 'object' and pg_column_size(lift_bests) <= 16384);

comment on column public.friend_stats.lift_bests is 'Best set per exercise (kg, reps, e1rm, date), only when the owner shares lifts; {} otherwise.';
