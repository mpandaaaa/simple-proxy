# Perfect XI, native iOS app

Native React Native rebuild of the browser game at perfectxi.app. Free, no
ads, no subscriptions. Single player works offline; multiplayer, the Daily
and progress sync use the same Supabase backend as the web game.

**Read `../docs/perfect-xi/PLAN.md` before starting work.** It has the
current phases, the decisions taken, the App Store risks and what only Mo
can do. `PHASE-0-INVENTORY.md` beside it describes the August web build and
is history.

## Working with Mo

- He is non-technical and judges everything by looking at his iPhone. He
  does not read code. Describe what to check on the phone, not what changed
  in the file.
- **He has asked for the app to be finished and taken to submission without
  stopping for approval at each step.** Work through the phases. Stop only
  for a phone check at the end of a phase, for something only he can do
  (Apple agreements, 2FA, confirming privacy answers), or for a decision
  that would be expensive to get wrong. Always ask before Submit for Review.
- **No em-dashes** in anything written for him or in UI copy, commit
  messages included.
- Anchor edits on file content actually read, never assumed. If a change
  does not land, say "PATCH FAILED" plainly.
- Windows and PowerShell. Give exact commands; do not assume he is already
  in the right folder.
- Expo account `hearthapplication`. He is protective of build quota: do not
  spend a build when a dev server reload would do.

## Hard constraints

- **Never use a WebView.** Apple guideline 4.2. Every screen is native.
- **Never retune the maths.** The engine is ported from the live web game
  and proven identical by `tests/engine/parity.test.ts`. The shipping
  balance is about 3.0 goals a game and champions on about 93 points,
  locked by `tests/engine/golden.test.ts`. A change that moves either is a
  balance change and needs Mo's decision plus an `ENGINE_VERSION` bump.
- **`src/engine` and `src/data` import nothing from React, React Native or
  Expo.** That is what lets the engine run headless and on the server.
- **Preserve the order of random draws.** Seeded runs (the Daily,
  multiplayer rooms) depend on it. Port functions draw for draw.
- **Database figures come from `src/data/meta.json`**, never typed into
  copy: 706 club-seasons, 2,978 players, 51 clubs, 35 seasons, 1992 to 2026.

## The source

`source/web/` is a snapshot of the live site (build s67-1): `index.html`
plus every script it loads. `scripts/lib/web-sandbox.mjs` loads the
original main script into a Node vm behind a stub browser, so the real web
functions can be called. Two uses:

- `npm run extract-db` reads the finished, corrected tables into `src/data/`.
- Each engine port gets a parity test that runs the web function and the
  port on the same seed and requires identical output.

When porting a mode, read the web function first, port it line for line,
then write its parity test. Do not "tidy" the maths.

## Decisions already made

- Blitz stays a toggle on the draft setup screen.
- Duels and Beat the Machine are gone, as on the web since release S54.
  Multiplayer replaces them. Versus stays.
- The app is a client of the existing Supabase backend; iPhone and web
  players share rooms, leagues, the Daily and leaderboards.
- Champions League and World Cup 2026 are both in scope.
- Online results come from the server; the phone displays them.

## Where things are

```
app/(tabs)/          the four tabs: today, play, career, you
src/engine/          rng, match/dixonColes, strength, season, version
src/data/            extracted JSON; meta.json has counts and the source hash
src/ui/              tokens, type, components, icons
src/save/            versioned storage, migration chain, settings slice
source/web/          the live web game snapshot (not bundled)
scripts/             extract-db, sim-season, lib/web-sandbox
tests/engine/        parity and golden tests
```

`NumberSlot` carries an overflow guard and takes digits only. Word values go
in `Pill`. Every saved record is wrapped in `{v, t, data}` and migrated on
read.

## Status

Phases 1 and 2 are done. **Phase 3, the draft end to end, is next.**

## Commands

```
npm install
npm test                    # parity and golden tests
npm run typecheck           # app and node configs
npm run sim -- 2026         # print a full simulated season
npm run extract-db          # rebuild src/data from source/web
npx expo-doctor             # must stay at 21/21
npx expo start --dev-client # add --tunnel if the phone cannot find it
```

Before committing: `npm test`, `npm run typecheck` and `npx expo-doctor`
must all be clean.
