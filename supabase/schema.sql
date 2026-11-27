-- VectorChase online database. Run once in the Supabase SQL editor.
-- Rules: Row Level Security is on everywhere. Players cannot write to any table directly:
-- usernames come from the signup trigger, and scores are inserted only by the Netlify function
-- (netlify/functions/submit-score.mjs) with the service key, after it has checked them.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles are public" on public.profiles for select using (true);
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Creates the profile when someone signs up. A bad or taken username makes the signup fail.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username) values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  map_id text not null,
  time_ms integer not null check (time_ms between 1000 and 1200000),
  created_at timestamptz not null default now()
);
create index scores_map_time on public.scores (map_id, time_ms);
create index scores_user_created on public.scores (user_id, created_at desc);
alter table public.scores enable row level security; -- no policies: clients cannot touch it
revoke all on public.scores from anon, authenticated;

-- What everyone may read: the best time per player per map (no emails, no ids).
create view public.leaderboard with (security_invoker = false) as
  select p.username, s.map_id, min(s.time_ms) as best_ms, count(*) as runs
  from public.scores s join public.profiles p on p.id = s.user_id
  where not p.banned
  group by p.username, s.map_id;
grant select on public.leaderboard to anon, authenticated;
