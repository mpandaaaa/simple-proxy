# Perfect XI, native iOS app

Native React Native rebuild of the browser game at perfectxi.app. Free, no
ads, no subscriptions, works offline. A collection of football games shaped
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
app/soon.tsx         holding screen for a mode not built yet
src/engine/          the game, free of React. sim, draft, formations, rng
src/data/squads.ts   GENERATED. 712 club-seasons, do not hand edit
src/game/run.ts      the run in progress, held outside React
src/ui/tokens.ts     pine emerald palette, spacing, radii, tap targets
src/ui/type.ts       Anton, Barlow Condensed, Inter across three roles
src/ui/feel.ts       reduce motion and haptics, both gated in one place
src/ui/components/   Screen ModeScreen Surface Pill NumberSlot Button
                     Toggle Press Row Hero Choice Pitch
src/save/            versioned storage, migration chain, settings slice
scripts/             extract-db, sim-season, golden
vendor/index.html    the web build, not committed. Needed to rebuild the data
```

`Press` is the press state used by anything bigger than a button: a spring
scale on the native thread, no setState, no scale at all under Reduce Motion.

`NumberSlot` carries an overflow guard and takes digits only. Word values go
in `Pill`, never a numeric slot.

Every saved record is wrapped in `{v, t, data}` and migrated on read. Reads
never throw and never return a half migrated value.

## Status

Phase 1 (shell, tokens, fonts, haptics, save layer) and Phase 2 (engine and
database) are done, and the four tab bar has been replaced by the stack
described above.

The database is extracted from `vendor/index.html` by `scripts/extract-db.mjs`,
which runs the web build's own three data layers and correction pass in Node
and writes `src/data/squads.ts`. The phone never runs the correction pass.
Verified output: 712 club-seasons, 51 clubs, 35 seasons, 11,077 rows, 3,003
distinct players.

The draft is wired end to end: setup, spin, board, pick, 38 game season,
final table and grade, with progress banked to the save layer.

**Still to build**: everything else on the home screen. Those rows push
`app/soon.tsx`, which carries the mode's real description from the site. The
next real piece is Dynasty.

### Two native libraries are deliberately not installed yet

Reanimated and FlashList both need a new EAS build, and adding either one now
would stop the current dev build loading any of this work. So press states run
on RN's own Animated with the native driver, and the board list is a FlatList.
Add both in a single build when there is another native reason to build.

## Commands

```
npm install
npx expo start --dev-client            # add --tunnel if the phone cannot find it
npm run typecheck                      # tsc --noEmit
npx expo-doctor                        # must stay at 21/21
npm run sim                            # draft an XI and play a season, headless
npm run golden                         # the numbers that say the maths is intact
npm run extract-db                     # rebuild src/data from vendor/index.html
```

Verify with typecheck, expo-doctor and golden before committing. Port 8081 is
taken by another project on Mo's machine, so the dev server runs on 8082.
