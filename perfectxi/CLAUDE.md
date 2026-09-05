# Perfect XI, native iOS app

Native React Native rebuild of the browser game at perfectxi.app. Free,
no subscriptions, nothing to buy, and it works offline apart from duels.
Paid for by adverts, which arrived late and are deliberately confined:
see the hard constraint below. A collection of football games shaped
like NYT Games: the front door is today, the games are the content.

Full background, the source inventory, the decisions and the ten phase plan
live in `../docs/perfect-xi/PHASE-0-INVENTORY.md`. Read it before starting a
new phase.

## Working with Mo

- He is non-technical and judges everything by looking at his iPhone. He does
  not read code. Describe what to check on the phone, not what changed in the
  file.
- One step at a time. Finish it, say what to look at, wait for his answer.
- **No em-dashes** in anything written for him or in UI copy. This includes
  commit messages and on-screen text.
- Back up before every write. Anchor edits on file content actually read,
  never assumed.
- If a change does not land, say "PATCH FAILED" plainly rather than carrying on.
- He is on Windows with PowerShell. Give exact commands, and do not assume he
  is already in the right folder.
- He has an Apple Developer account, App Store Connect, and EAS set up under
  the Expo account `hearthapplication`. He is protective of build quota, so do
  not spend a build when a dev server reload would do.

## Hard constraints

- **Adverts live in two places and nowhere else.** One rewarded advert
  somebody chose to watch, in the shop, for a pack or coins. One full
  screen advert at a break in play, after a season or a tournament has
  finished, capped at one every four minutes. Never during a match. Never
  in the Daily, the Weekly or a duel, because those are scored against
  other people and an advert that buys an advantage is cheating. No
  banners anywhere. `src/game/ads.ts` is the only file that talks to the
  SDK.

- **The privacy page is the truth.** It says what the adverts see and
  what they do not. If the advert behaviour changes, that page changes in
  the same commit or the App Store listing becomes a lie.

- **No social studio.** The web build has a "Make social posts from this XI"
  feature. It is not coming to the app. Do not build it, do not link to it,
  do not leave a button for it anywhere.

- **Never use a WebView.** Apple guideline 4.2 rejects repackaged websites.
  Every screen is rebuilt natively. This is not negotiable.
- **Never change the tuned maths.** The Dixon-Coles constants, the Dynasty
  ageing, valuation, wage and finance curves are already balanced: 2.75 goals
  per game, champions near 90 points, a 92 rated 23 year old worth about
  £125m. Port them exactly. Golden number tests guard this from Phase 2.
- **`src/engine` and `src/data` import nothing from React or React Native.**
  Plain modules. This is what lets the engine run headless in tests and
  unchanged inside a Supabase edge function for replay validation.
- **Real database figures in all copy**: 712 club seasons, 3,003 players,
  51 clubs, 35 seasons, 1992 to 2026. Not the old marketing numbers.

## Decisions already made

- Blitz stays a toggle on the draft setup screen, not its own mode tile.
- Duels and Versus are merged into one PLAY entry.
- Online leaderboard and live 1v1 are in scope, on Supabase, with Game Center
  layered on top. Version 1.0 does not ship until online is in.
- Leaderboards are verified by replaying submitted runs server side, which
  works because a seed plus config plus eleven picks fully determines a
  season. Game Center scores alone are client submitted and spoofable.
- The engine carries an `ENGINE_VERSION`. Client and server must replay with
  the same build or honest players get rejected after an app update.

## Navigation

One native stack rooted at Home. **No tab bar, no drawer, no persistent
chrome of any kind.** Home lists every mode; tapping one pushes a full screen
mode with a back button in its header; back returns to Home. Inside a mode you
see that mode and nothing else.

Dynasty is the one exception: its own sections live inside it as a grid on the
Dynasty hub, each pushing a screen whose back returns to the hub, and the
hub's back returns to Home.

## Where things are

```
app/_layout.tsx      the stack, reduce motion aware
app/index.tsx        Home, the only hub
app/draft/           setup, board, season
app/dynasty/         the career. start hub season summer market tactics
                     squad academy staff club finances history
app/ucl/            the Champions League. index draft hub match report
app/cup/            the knockout, any era. index hub match
app/hall.tsx         every season kept, ranked
app/cabinet.tsx      silverware and the achievement catalogue, ten shelves
app/settings.tsx     sound, speed, voice, reminder, backup, what is saved
app/welcome.tsx      the three cards a new player sees, once
app/stats.tsx        every mode's totals, in one place
app/dynasty/slots.tsx  three careers, and which one you are playing
app/soon.tsx         holding screen for a mode not built yet
src/engine/          the game, free of React. sim, draft, formations, rng
src/data/squads.ts   GENERATED. 712 club-seasons, do not hand edit
src/data/dynasty.ts  GENERATED. birth years, ageing curves, capacities
data/perfectxi-database.json  the source of truth, committed
src/game/run.ts      the run in progress, held outside React
src/ui/tokens.ts     pine emerald palette, spacing, radii, tap targets
src/ui/layout.ts     how much room this screen has, and how many columns
src/ui/ucl.ts        the Champions League blue, and its match night
src/ui/type.ts       Anton, Barlow Condensed, Inter across three roles
src/ui/feel.ts       reduce motion and haptics, both gated in one place
src/ui/sound.ts      the cues, gated on the sound setting, loaded once
assets/sfx/          GENERATED by npm run sounds. Do not hand edit
src/ui/components/   Screen ModeScreen Surface Pill NumberSlot Button
                     Toggle Press Row Hero Choice Pitch
src/game/award.ts    handing out achievements, in one place
src/game/reset.ts    throwing a save away, memory as well as disk
src/game/backup.ts   the whole save to a file, and back again
src/game/remind.ts   the one notification, off unless asked for
src/save/            versioned storage, migration chain, settings slice
web/app-privacy.html the app's privacy policy as a page, for the App
                     Store listing. the website has its own, different,
                     already live at perfectxi.app/privacy
scripts/             extract-db, sim-season, golden
vendor/index.html    the web build, not committed. Reference only now
```

`Press` is the press state used by anything bigger than a button: a spring
scale on the native thread, no setState, no scale at all under Reduce Motion.

## Phone and tablet

The app ships on both, and the rule is one sentence: **text stays in a
column, everything else uses the room.** A line of body text the full
width of a thirteen inch iPad is harder to read, not easier, so prose
stays capped at `READABLE`. A wall of cards, a league table or a row of
mode tiles is scanned rather than read, and on a tablet it should fill
the space instead of sitting in a phone sized ribbon down the middle.

`Screen` and `ModeScreen` take a `wide` prop that says which kind of page
this is. `useLayout()` in `src/ui/layout.ts` answers how much room there
actually is and how many columns fit, measured from the window rather
than from the device, so it is right in split screen and right the
instant an iPad is turned.

Cell widths are worked out in points, never percentages. Four cells at
twenty five percent plus three gaps is wider than the row and the fourth
wraps. `npm run layout` proves every grid fits at eleven real window
sizes.

The phone is locked to portrait and the iPad is not, which is set in
`app.config.js` with the two `UISupportedInterfaceOrientations` keys.

`NumberSlot` carries an overflow guard and takes digits only. Word values go
in `Pill`, never a numeric slot.

Every saved record is wrapped in `{v, t, data}` and migrated on read. Reads
never throw and never return a half migrated value.

## Status

Phase 1 (shell, tokens, fonts, haptics, save layer) and Phase 2 (engine and
database) are done, and the four tab bar has been replaced by the stack
described above.

The database is `data/perfectxi-database.json`, committed, and
`scripts/import-db.mjs` turns it into `src/data/squads.ts` and
`src/data/dynasty.ts`. It validates every row, refuses to write if a
formation multiplier disagrees with the engine, and sorts the club-seasons
so a seed always lands in the same place. Verified output: 712 club-seasons,
51 clubs, 35 seasons, 11,077 rows, 3,003 distinct players, plus 3,062 dated
players, 25 stadium capacities and 21 derbies for Dynasty.

`scripts/extract-db.mjs` mined the same data out of `vendor/index.html` and
is kept only as a record of where it came from.

The draft is wired end to end: setup, spin, board, pick, 38 game season,
final table and grade, with progress banked to the save layer.

Dynasty is built to the specification in `DYNASTYSPEC.md`. You take a real
club and its real squad, and everything the spec asks for is in: the five
jobs, the fourteen man roster, ageing on the tuned curves, retirement,
per player match ratings, form beating the age curve, the books with PSR
and points deductions, the board, transfers, contracts that add years,
the academy with a scouting fog, staff, the stadium and the facilities.

One deliberate departure from the site, which is documented in
`src/engine/dynasty.ts`: transfer value uses the specification's quadratic
rather than the sixth power the site actually runs, because the sixth
power priced a 70 rated squad player at £22m. Both agree at the top.

Play today is built: the Daily in `app/daily.tsx`, the Weekly Event in
`app/weekly.tsx` and Duels in `app/duel.tsx`, with their rules in
`src/engine/daily.ts`, `weekly.ts` and `duel.ts` so they can be checked
headlessly. A duel can be played two ways: a fourteen character code
carrying the seed, the rules and the score to beat, which uploads nothing,
or a live opponent found through `src/net/lobby.ts`. `src/net` is the only
thing that talks to Supabase, and every call in it returns null rather
than throwing, so the game still works with the connection dead.

Both tournaments are built. The World Cup is the real 2026 format, forty
eight nations in twelve groups with the eight best thirds going through.
The Champions League is the real post-2024 format: one table of thirty
six, eight matchdays against eight different opponents, the top eight
straight to the last sixteen, ninth to twenty fourth into a two legged
play-off, and everybody below that finished. Its league phase can be
skipped; from the play-off on it is one match at a time.

Both can be entered two ways: take a nation or a club, or draft an XI
from every squad in the competition and take somebody's place in the draw
with it.

Every match in both is watched through `MatchLive`, the same broadcast
the league season uses, fed by `src/game/tournamentMatch.ts` which adds
the three things a knockout needs and a league never does: extra time,
penalties kick by kick, and named scorers for the other side. The
Champions League passes its own blue palette in.

**Still to build elsewhere**: the player index and a settings screen.
Those rows push `app/soon.tsx`, which carries the mode's real description
from the site.

### The native libraries are in

Reanimated, FlashList, gesture handler and SVG all came in with earlier
builds. The September 2026 build added the last four:

- `expo-audio`, playing the cues in `assets/sfx`. Those are rendered by
  `npm run sounds` from the web build's own oscillator specs, so the app
  sounds like the site rather than like a different game.
- `expo-sensors`, which tilts the card shine. One listener for the whole
  app, reference counted, off under Reduce Motion.
- `react-native-view-shot` and `expo-sharing`, for the 1080 by 1350 share
  card captured off screen from `ShareCard`.

Anything else native needs another build, so batch it.

## Commands

```
npm install
npx expo start --dev-client            # add --tunnel if the phone cannot find it
npm run typecheck                      # tsc --noEmit
npx expo-doctor                        # must stay at 21/21
npm run sim                            # draft an XI and play a season, headless
npm run golden                         # the numbers that say the maths is intact
npm run import-db                      # rebuild src/data from data/perfectxi-database.json
npm run sounds                         # rebuild assets/sfx
npm run cups                           # the cup win rates
npm run dynasty                        # the ageing, valuation and wage numbers
npm run career                         # every club can field an XI
npm run career-run                     # a hundred seasons of Dynasty, end to end
npm run save                           # old careers still load
npm run playtoday                      # the week, and every duel code
npm run worldcup                       # the tournament, and every bracket
npm run tourney                        # the minute by minute broadcast
npm run wcdraft                        # what a drafted World XI is worth
npm run ucl                            # the league phase and the format
npm run ucldraft                       # what a drafted Champions XI is worth
npm run audit                          # the fault classes that reach a phone
npm run layout                         # every grid at every window size
npm run stores                         # every saved record survives a bad disk
npm run privacy                        # manifest and both privacy pages agree
npm run source                         # the mistakes that reached a phone once
npm run cabinet                        # every achievement can be earned
npm run tscreens                       # every field a tournament screen reads
npm run slots                          # no career can write over another
npm run dyneurope                      # a played campaign counts once
npm run cup                            # every bracket halves cleanly
npm run verify                         # all of the above
```

What to build next lives in `docs/NEXT.md`.

Run `npm run verify` before committing. It covers typecheck, the source
rules, the golden numbers, the Dynasty numbers, the club check and the
save migrations. Then expo-doctor, which must stay at 21/21. Port 8081 is
taken by another project on Mo's machine, so the dev server runs on 8082.
