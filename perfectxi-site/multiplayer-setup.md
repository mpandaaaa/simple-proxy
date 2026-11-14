# Turning multiplayer on

Everything is built. It needs a database behind it, and only you can create
that, because it needs an account in your name. This takes about fifteen
minutes and costs nothing to start.

Until you do this, the game works exactly as it does now. The Leagues card
says "not set up yet" instead of breaking.

---

## 1. Make a Supabase project

Go to **supabase.com**, sign up, and create a new project.

- Pick a region close to your players. For a mostly UK audience, **London**.
- Choose a database password and keep it somewhere safe. You will not need
  it for this, but you will if you ever want direct access.
- Wait about two minutes for it to finish setting up.

The free tier is genuinely free: 200 people connected at once, two million
realtime messages a month, 50,000 players. You only pay if you outgrow it.

**One catch worth knowing:** free projects go to sleep after seven days with
no traffic, and take 10 to 30 seconds to wake up. If the site is quiet, the
first person of the week will see a pause. Paying $25 a month removes that.

## 2. Create the tables

In the left sidebar click **SQL Editor**, then **New query**.

1. Open `supabase-setup.sql`, copy all of it, paste it in, press **Run**.
2. Open `supabase-players.sql`, do the same. This one is larger, around
   3,000 rows, so give it a few seconds.

You should see "Success" both times. Running them twice does no harm.

## 3. Allow players in without a signup

Left sidebar, **Authentication**, then **Providers** (or **Sign In / Up**).

Find **Anonymous sign-ins** and turn it **on**.

This is what lets someone play a league without making an account. They get
an invisible identity on their device. No email, no password, no friction.

## 4. Add the scoring function

This is the part that stops people cheating, so it matters.

In the sidebar click **Edge Functions**, then **Create a function**. Name it
exactly:

```
score-run
```

Paste in the contents of `supabase/functions/score-run/index.ts` and deploy.

If you prefer the command line and have the Supabase CLI installed:

```
supabase functions deploy score-run
```

## 5. Paste your two values into the game

Sidebar, **Project Settings**, then **API**. You need two things:

- **Project URL**, which looks like `https://abcdefghijk.supabase.co`
- **anon public** key, a long string starting `eyJ...`

Open `mp-config.js` and fill them in:

```js
window.PXI_MP = {
  URL:  "https://abcdefghijk.supabase.co",
  KEY:  "eyJhbGciOi...",
  ...
};
```

Both are safe to publish. The anon key is designed to be visible in a
browser. What keeps your data safe is the rules in step 2, not secrecy.

**Never put the `service_role` key in this file.** That one is a master key
and belongs only in the Edge Function, where Supabase provides it
automatically.

## 6. Deploy and test

Upload the site as usual, then:

1. Open the game, tap **Leagues**. It should say "Play your mates" rather
   than "not set up yet".
2. Create a league. You should get a six character code.
3. Tap **Play your season** and finish a draft.
4. Your result should appear in the table within a few seconds.
5. Open the invite link on another device or in a private window and join
   with the code. Play, and watch both results appear.

---

## How the cheating protection works

This is worth understanding, because it is the difference between a real
leaderboard and a decorative one.

The browser never sends a score. It sends only two things: the seed of the
draw, and the names of the eleven players it drafted.

The Edge Function then looks every one of those players up in the database
to get their real rating, re-runs the same match engine from the same seed,
and writes the result itself. The database rules physically prevent a
browser from writing to the score columns at all.

So someone can open the console and try to submit a 99 point season, and
the table will still show what their actual XI would have achieved.

**One gap I want to be straight about.** The server checks that all eleven
players exist and that their ratings are real. It does not yet check that
those players were actually available on the spins the wheel gave them. A
determined person could submit a legal but impossible XI. Closing that
needs the club-season database on the server too, which is a bigger job and
a sensible second step once leagues are being used.

## What it costs

| Players | Cost |
|---|---|
| A few friends | Free |
| A few hundred a month | Free |
| A few thousand a month | Free, or $25 to stop it sleeping |
| Tens of thousands | $25 plus a little usage |

## If something goes wrong

**"Not set up yet"** — `mp-config.js` is empty or has a typo.

**"Could not connect"** — the URL or key is wrong, or the project is asleep.
Open your Supabase dashboard to wake it and try again.

**Scores stay blank** — the `score-run` function is not deployed, or it
errored. Check its logs under Edge Functions.

**"No league with that code"** — codes are six characters and not
case-sensitive. Check for a typed O instead of a zero; the code alphabet
deliberately leaves out look-alike characters, so if you see one, it is a
typo.
