# Perfect XI iOS: the current plan

Updated 7 November 2026. This supersedes the phase plan in
`PHASE-0-INVENTORY.md`, which describes the August web build and is kept as
history.

## What changed since August

The port now follows the **live web game, build s67-1**, snapshotted into
`perfectxi/source/web/`. The August zip was lost when its container was
recycled, and the live site is newer in any case: it is the balance players
actually have.

What the live web game has that the August build did not:

| | |
|---|---|
| **Multiplayer** | Live rooms where everyone drafts at once against a clock and all squads share one league, plus asynchronous leagues. CPU managers fill empty seats. |
| **A backend** | Supabase project `fmupfnknfyiiddwgjlvk`, anonymous sign in, server written scores (`score-run`, `simulate-room` edge functions), realtime room channels. |
| **The Daily** | Back as its own module since 11 October 2026, seeded from the date, submitted to the server (`px_daily_submit`). |
| **Progress sync** | Level, streak and collection mirrored to the server with a recovery code, so a new device keeps its progress. |
| **Champions League** | 36 team league phase, play-offs, two legged knockouts. |
| **Real ages** | Dates of birth for 3,062 players. |
| **Match ratings** | Per player ratings after matches, feeding performance linked development in Dynasty. |

What the live web game **removed** in release S54, "replaced by
multiplayer": Friend Duels and Beat the Machine.

Database: **706 club-seasons, 2,978 players**, 51 clubs, 35 seasons,
1992 to 2026. These are what the app shows.

## Decisions taken

These were taken on Mo's instruction to finish the app without stopping for
each step. Each is reversible; flag any that are wrong.

1. **The app is a native client of the existing backend**, not a second
   backend. iPhone and web players share rooms, leagues, the Daily and
   leaderboards. That fixes the empty lobby problem outright, and it is what
   the backend and `app-config.js` launch switch were evidently built for.
2. **The app follows S54.** No Duels and no Beat the Machine. Multiplayer
   takes their place, as on the web. Versus stays.
3. **Champions League joins the scope**, alongside World Cup 2026.
4. **Balance is locked as shipped.** The live engine gives about 3.0 goals
   a game in your matches and champions on about 93 points, not the 2.75 and
   90 in the original brief. Nothing is retuned.
5. **The server's answer wins online.** The phone runs Hermes and the server
   runs Deno; their `Math.exp` can differ in the last digit, which could
   flip a result in rare cases. Online results are taken from the server and
   the phone displays them.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | Shell, four tabs, tokens, fonts, haptics, versioned saves | Done |
| 2 | Season engine and database, proven identical to the web | Done |
| 3 | Draft end to end: spins, boards, Prime and Career ratings, eras, rerolls, chemistry, Blitz toggle, live match playback, results, share card | Next |
| 4 | Dynasty: ageing with real dates of birth, match ratings, development, injuries, youth, contracts, transfers, finances, staff, stadium, tactics, the board | |
| 5 | Today tab and the Daily, streaks, the daily reset notification, home screen widget | |
| 6 | World Cup 2026, Champions League, Versus | |
| 7 | Online: anonymous identity shared with the web, live rooms and leagues, server scored Daily, progress sync and recovery codes, moderation | |
| 8 | Game Center achievements | |
| 9 | App Store readiness: privacy labels, review notes, screenshots, metadata, accessibility pass | |
| 10 | Build, upload, submit for review | |

Each phase ports the web's engine code for that mode into `src/engine` with
its own parity test against the web snapshot, the same way Phase 2 did.

## App Store risks known now

- **4.2 minimum functionality.** No WebView anywhere. Native widget, push,
  haptics, share sheet and Game Center make the app case plain.
- **1.2 user generated content.** Display names are visible in multiplayer
  rooms. Needs a name filter, a way to report a player, and a way to block
  one, before submission.
- **5.1.1(v) account deletion.** The anonymous online identity carries a
  display name and saved progress. Settings must offer a way to delete that
  online data. Cheap to build, a common rejection when missing.
- **5.1.2 privacy labels.** Supabase stores an anonymous user id, display
  name, scores and progress. These must be declared accurately.
- **3.2.2.** The web's in-game promotion already offers no reward for
  installing. Keep it that way.

## Only Mo can do

- Look at each phase on the phone.
- Accept Apple agreements, approve 2FA, and confirm the privacy and export
  compliance answers are true.
- Say yes to "Submit for Review".
- Flip `LIVE: true` and paste the App Store id into the web game's
  `app-config.js` on approval day.

## Web game bugs found while porting

Not fixed in the web game, worth fixing there:

- Season xG (`gs.xgF`, `gs.xgA`) is never reset, so a second season in the
  same session shows xG carried over from the first.
- The 19 rival clubs use a simpler Poisson model than your matches, and
  each one's fixture list cycles through the league by index, itself
  included. Bottom clubs can finish with single figure points and goals.
- The pre-season card can say "projected 5th" alongside a 57% title
  chance; the two come from different formulas.
