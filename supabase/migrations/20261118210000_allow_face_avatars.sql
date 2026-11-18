-- Fix: choosing a round Rozi face as your profile picture failed ("Profile could not be saved").
-- The picker saves faces as "face:<name>" (public/rozi/faces/v1), but the avatar checks on profiles and friend_stats
-- were written before faces existed and only allowed "photo:https://…", "rozi:<mood>" and "color:#rrggbb".
-- Same rules as before, plus "face:<name>" (lowercase letters, numbers and dashes, up to 30).

alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (
  char_length(avatar) <= 500 and (avatar = '' or avatar ~ '^(photo:https://|rozi:[a-z0-9-]{1,30}$|face:[a-z0-9-]{1,30}$|color:#[0-9a-fA-F]{6}$)')
);

alter table public.friend_stats drop constraint if exists friend_stats_avatar_check;
alter table public.friend_stats add constraint friend_stats_avatar_check check (
  char_length(avatar) <= 500 and (avatar = '' or avatar ~ '^(photo:https://|rozi:[a-z0-9-]{1,30}$|face:[a-z0-9-]{1,30}$|color:#[0-9a-fA-F]{6}$)')
);
