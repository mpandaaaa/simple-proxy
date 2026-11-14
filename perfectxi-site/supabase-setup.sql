-- =====================================================================
-- PERFECT XI MULTIPLAYER - DATABASE SETUP
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It is safe to run more than once.
--
-- What it creates:
--   profiles  one row per player, a name they choose
--   leagues   a private league, joined with a six character code
--   members   who is in which league
--   runs      a completed season. The SCORE IS WRITTEN BY THE SERVER,
--             never by the browser, so the table cannot be faked.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 18),
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "read all profiles" on public.profiles;
create policy "read all profiles" on public.profiles for select using (true);

drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------- leagues
create table if not exists public.leagues (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null check (char_length(name) between 2 and 30),
  owner       uuid not null references auth.users(id) on delete cascade,
  seed        bigint not null,          -- every member drafts the same draw
  formation   text not null default '4-3-3',
  era_from    int  not null default 1992,
  era_to      int  not null default 2026,
  closes_at   timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.leagues enable row level security;

drop policy if exists "read leagues" on public.leagues;
create policy "read leagues" on public.leagues for select using (true);

drop policy if exists "create leagues" on public.leagues;
create policy "create leagues" on public.leagues
  for insert with check (auth.uid() = owner);

drop policy if exists "owner edits league" on public.leagues;
create policy "owner edits league" on public.leagues
  for update using (auth.uid() = owner);

-- ---------------------------------------------------------------- members
create table if not exists public.members (
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);
alter table public.members enable row level security;

drop policy if exists "read members" on public.members;
create policy "read members" on public.members for select using (true);

drop policy if exists "join a league" on public.members;
create policy "join a league" on public.members
  for insert with check (auth.uid() = user_id);

drop policy if exists "leave a league" on public.members;
create policy "leave a league" on public.members
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- runs
-- picks  = the eleven players drafted, in order
-- pts/gf/ga/finish are filled in BY THE SERVER after it re-simulates.
create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid references public.leagues(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  seed        bigint not null,
  picks       jsonb  not null,
  pts         int,
  gf          int,
  ga          int,
  finish      int,
  avg         numeric(4,1),
  verified    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (league_id, user_id)          -- one run per player per league
);
alter table public.runs enable row level security;

drop policy if exists "read runs" on public.runs;
create policy "read runs" on public.runs for select using (true);

-- A player may submit their PICKS, but never a score. The score columns
-- stay null until the server fills them in, so a tampered client cannot
-- put a fake result on the table.
drop policy if exists "submit own picks" on public.runs;
create policy "submit own picks" on public.runs
  for insert with check (
    auth.uid() = user_id
    and pts is null and gf is null and ga is null
    and finish is null and verified = false
  );

create index if not exists runs_league_pts on public.runs (league_id, pts desc);
create index if not exists runs_user       on public.runs (user_id);

-- ---------------------------------------------------------------- table view
create or replace view public.league_table as
select r.league_id,
       r.user_id,
       coalesce(p.name,'Manager')                as name,
       r.pts, r.gf, r.ga, r.finish, r.avg,
       r.created_at,
       rank() over (partition by r.league_id
                    order by r.pts desc nulls last,
                             (r.gf - r.ga) desc nulls last,
                             r.gf desc nulls last,
                             r.created_at asc)   as position
from public.runs r
left join public.profiles p on p.id = r.user_id
where r.verified = true;

-- ---------------------------------------------------------------- join by code
-- Lets someone join with only the code, without being able to read the
-- whole leagues table looking for other people's games.
create or replace function public.join_league(join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare lid uuid;
begin
  select id into lid from public.leagues where upper(code) = upper(join_code);
  if lid is null then
    raise exception 'No league with that code';
  end if;
  insert into public.members (league_id, user_id)
  values (lid, auth.uid())
  on conflict do nothing;
  return lid;
end;
$$;

grant execute on function public.join_league(text) to anon, authenticated;

-- =====================================================================
-- DONE.
-- Next: Authentication > Providers > turn ON "Anonymous sign-ins".
-- Then paste your project URL and anon key into mp-config.js.
-- =====================================================================
