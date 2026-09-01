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

## Where things are

```
app/(tabs)/          the four tabs: today, play, career, you
src/ui/tokens.ts     pine emerald palette, spacing, radii, tap targets
src/ui/type.ts       Anton, Barlow Condensed, Inter across three roles
src/ui/components/   Screen Surface Pill NumberSlot Button Tile Toggle
src/ui/icons.tsx     hand drawn SVG tab icons
src/save/            versioned storage, migration chain, settings slice
```

`NumberSlot` carries an overflow guard and takes digits only. Word values go
in `Pill`, never a numeric slot.

Every saved record is wrapped in `{v, t, data}` and migrated on read. Reads
never throw and never return a half migrated value.

## Status

Phase 1 is complete: Expo SDK 57 shell, four tab navigation, design tokens,
three fonts, real haptics, and the versioned save layer with working settings.
Nothing is wired to an engine yet, so on screen numbers are placeholders and
cards are tagged "Not wired yet".

**Phase 2 is next**: port the engine and database from the web build as plain
modules, add `ENGINE_VERSION`, and prove it with a headless script that
simulates a season and prints a realistic table, plus the golden number tests.

The source `index.html` is the 1.6MB single file web build. The player
database is one JSON line inside it. Apply the three data layers in order
(base, the 2025/26 and 2026/27 blocks, then the correction pass) once at build
time via `scripts/extract-db.mjs` and ship a finished `squads.json`. The phone
should never run the correction pass.

## Commands

```
npm install
npx expo start --dev-client            # add --tunnel if the phone cannot find it
npm run typecheck                      # tsc --noEmit
npx expo-doctor                        # must stay at 21/21
```

Verify with typecheck and expo-doctor before committing. Both were clean at
the end of Phase 1.
