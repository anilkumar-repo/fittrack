-- Fix: since Discover + profiles (20261118190000), every profile save from the app failed with
-- "permission denied for function is_adult".
-- The findable trigger runs on every insert and update of public.profiles and calls private.is_adult(), which signed-in
-- users may not execute. The trigger function ran with the caller's rights, so the call was refused and the whole save
-- failed (profile picture, name, plan, settings).
-- Same fix as the other profile trigger (private.keep_buddy_plan): run the trigger function with its owner's rights.
-- It only reads and adjusts the row being saved (findable off when not an adult, username lower-cased), so this grants
-- nothing else. search_path stays empty.

alter function private.enforce_findable() security definer;
alter function private.enforce_findable() set search_path = '';
revoke all on function private.enforce_findable() from public, anon, authenticated;
