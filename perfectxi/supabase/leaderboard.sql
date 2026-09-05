-- Perfect XI, the leaderboard.
--
-- Run this once in the Supabase SQL editor. It is safe to run again: every
-- statement checks first, so a second run changes nothing.
--
-- The rule this whole file exists to enforce is one sentence: a phone may
-- ask what the board says, and may not write to it. Every row is written
-- by the edge function, which replays the run before it accepts it. A
-- client that could insert its own row could put itself top and stay
-- there, and one person doing that makes the board worthless to everyone.
--
-- Nothing here identifies anybody. A player is a random id made on their
-- own device and a handle they typed. There is no account, no email and
-- nothing to sign in to.

-- ---------------------------------------------------------------------
-- the board
-- ---------------------------------------------------------------------

create table if not exists public.leaderboard (
  id           uuid primary key default gen_random_uuid(),

  -- which board, for example 'daily-1263'. One row per player per board.
  board        text        not null,

  -- a random id made on the device the first time one was needed
  player       text        not null,
  -- the only thing another player ever sees
  handle       text        not null,

  -- what the server worked out by replaying, never what the phone claimed
  pts          integer     not null,
  gf           integer     not null,
  ga           integer     not null,
  rating       integer     not null,

  -- the build that played it, so a season simulated by two different
  -- versions of the engine is never ranked against itself
  engine       integer     not null,

  -- the run itself, kept so any row can be re-checked later. It is also
  -- what makes a dispute answerable: the whole season can be replayed
  -- from it by anybody with the same build.
  picks        jsonb       not null,

  created_at   timestamptz not null default now(),

  constraint leaderboard_one_per_player unique (board, player),
  constraint leaderboard_handle_len     check (char_length(handle) between 1 and 18),
  constraint leaderboard_board_len      check (char_length(board) between 1 and 40),
  constraint leaderboard_sane           check (
    pts between 0 and 114 and gf >= 0 and ga >= 0 and rating between 0 and 99
  )
);

-- The one query the app makes: the top of a board, best first.
create index if not exists leaderboard_board_rank
  on public.leaderboard (board, pts desc, (gf - ga) desc, gf desc, created_at asc);

-- Used only by the sweeper below.
create index if not exists leaderboard_created
  on public.leaderboard (created_at);

-- ---------------------------------------------------------------------
-- who may do what
-- ---------------------------------------------------------------------

alter table public.leaderboard enable row level security;

-- Anybody may read a board. There is nothing private on it.
drop policy if exists leaderboard_read on public.leaderboard;
create policy leaderboard_read
  on public.leaderboard for select
  to anon, authenticated
  using (true);

-- And nobody may write to it. There is deliberately no insert, update or
-- delete policy: with row level security on, no policy means no access.
-- The edge function uses the service role, which bypasses this, and it is
-- the only thing that does. Adding an insert policy here would undo the
-- entire point of replaying runs.

-- ---------------------------------------------------------------------
-- keeping it small
-- ---------------------------------------------------------------------

-- A Daily is only interesting while people are playing it. Sixty days is
-- long enough for a streak to mean something and short enough that the
-- table never becomes a museum.
create or replace function public.sweep_leaderboard()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.leaderboard where created_at < now() - interval '60 days';
$$;

-- Schedule it if pg_cron is available. If it is not, the table simply
-- grows slowly and can be swept by hand; that is not worth failing over.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'perfectxi-sweep-leaderboard',
      '17 4 * * *',
      'select public.sweep_leaderboard()'
    );
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;
