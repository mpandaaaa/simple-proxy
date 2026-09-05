# The leaderboard

Everything is written and checked. Two things need doing on the Supabase
dashboard, and neither takes long.

## Why it is built this way

A leaderboard that trusts the number a phone sends it is not a
leaderboard, it is a text box. Anyone who can read the network traffic
can put themselves top and stay there, and one person doing that makes
the board worthless to everybody else.

So the phone cannot write to the board at all. It sends the run it
played, and a function on the server replays that run with the same
engine that played it and works out the score for itself. Every number
that ends up on the board is one the server calculated. Nothing the
phone says about its score, its players or their ratings is ever stored.

This works because a seed and a config fix which club seasons a draft
deals, in order, and which players appear depends only on who has
already been taken. So a seed plus the eleven picks in the order they
were made replays the whole run, spin for spin, and produces exactly one
possible final table.

It is also why `src/engine` imports nothing from React. The same code
runs on the phone and on the server, so the two can never drift into
disagreeing about what a season does, and an honest player is never told
their season did not happen.

## What only you can do

### 1. Make the table

Supabase dashboard, SQL Editor, New query. Paste the whole of
`supabase/leaderboard.sql` and run it.

It is safe to run twice: every statement checks first, so a second run
changes nothing.

What it does: makes the table, adds the index the app queries on, turns
on row level security, and gives anybody permission to **read** the
board and nobody permission to write to it. That last part is the point.
There is deliberately no insert policy, which with security on means no
client can write whatever key it holds.

It also sets up a nightly sweep that deletes rows older than sixty days,
if the database has `pg_cron`. If it does not, nothing fails and the
table simply grows slowly.

### 2. Put the function up

The function needs the Supabase command line tool, and it needs to log
in once.

```powershell
cd C:\Users\44791\simple-proxy\perfectxi
npm run edge
npx supabase login
npx supabase link --project-ref fmupfnknfyiiddwgjlvk
npx supabase functions deploy submit-run
```

`npm run edge` packages the engine into
`supabase/functions/_engine`. That folder is generated: never edit it by
hand, and rebuild it whenever the engine changes. `npm run verify`
fails if it has fallen behind, because a server checking runs against an
older engine would start refusing seasons that were honestly played.

`npx supabase login` opens a browser and gives the tool permission. You
do not have to send me anything from it.

The function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
the environment, which Supabase sets for it automatically. There is
nothing to configure and no key for you to copy anywhere. Do not put the
service role key in the app: it is the one key that can write to the
board, and the app is deliberately unable to.

### 3. Check it works

Play the Daily on your phone. When the season finishes, the run is sent
on its own. Then open the Daily screen and tap **See how everyone did**.

You should see yourself on the board. If it says no connection, the
function is not up yet or the table does not exist.

## What is checked already

`npm run leaderboard` plays eleven real Daily puzzles end to end,
submits each honestly, and then submits fifteen forgeries:

- claiming more points than the season gave
- claiming more goals, or a tighter defence
- a player who was never on the board they claim to be from
- a player who does not exist at all
- the picks made in a different order
- more rerolls than the rules allow
- twelve picks, ten picks, no picks, picks that are not a list
- two players into the same slot, and a slot that does not exist
- a run from a different build of the engine

Every honest run has to be accepted and every forgery refused, each for
its own stated reason, so a real fault can never hide behind a rejection
that happened to come out the same way. It also proves that adding a
rating to a pick changes nothing, because no rating from a phone is ever
read, and that yesterday's run is refused on today's board.

## What is deliberately not there

**No accounts.** A player is a random id made on their own device and a
handle they typed. Nothing on the board identifies anybody.

**No Weekly board.** Not an oversight, and not something to add later
without changing what the Weekly is.

The Daily can have an honest board because it is one fixed puzzle: the
same seed for everybody, one attempt. The server knows what that seed
must be, so a run either replays to the claimed score or it does not.

The Weekly is deliberately the opposite. Its own comment in
`src/engine/weekly.ts` says why: the board is not fixed, every attempt
spins fresh, because a week of the same eleven names would be one puzzle
stretched over seven days rather than a rule to play with. The seed is
random per attempt and there is no limit on attempts.

That makes a Weekly high score board grindable. Somebody could run
thousands of seeds offline, keep the best and submit it, and the server
would verify it perfectly, because it is a real run. It is simply not a
run anybody played. No amount of checking catches that: the fault would
be in the contest, not in the verification.

The three ways out are a fixed weekly seed with one attempt, which
contradicts the design; a seed issued by the server, which would mean
needing a connection to play and breaks the offline promise; or ranking
something nobody can farm, like weeks played or a streak, which is a
table of commitment rather than of skill. None was worth having, so the
Weekly stays what it is.

**No global all time board.** A Daily is the same puzzle for everybody
on the same day, which is what makes comparing scores mean anything. An
all time board across different drafts would compare runs that were
never the same question.

**No Game Center yet.** It layers on top of this later. Game Center
scores are submitted by the client and can be forged, so it is a way to
show a board, not a way to trust one.

## If a submission is refused

The server says why, in one word. `engine` means the phone is on a
different build from the server, which is an update rather than
cheating: rebuild and redeploy the function. `score` means the replay
produced a different season, which after an engine change is the same
thing. The rest mean the run does not replay, which for an honest player
should never happen.
