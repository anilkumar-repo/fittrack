-- Keep the pg_net extension out of the public schema (Supabase security advice). Its functions stay in "net".
drop extension if exists pg_net;
create extension pg_net with schema extensions;
