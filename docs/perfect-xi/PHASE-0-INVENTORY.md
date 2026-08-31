# Perfect XI, native iOS build
## Phase 0: inventory of the existing web build

Source read: `perfectxis32v5.zip`, file `index.html`.
Size: 1,596,312 bytes, 11,328 lines.

The file splits into exactly three parts:

| Part | Lines | What it is |
|---|---|---|
| CSS | 63 to 2,409 | 2,346 lines of styles. All of this gets rebuilt. |
| HTML body | 2,410 to 3,052 | The static screens. All of this gets rebuilt. |
| JavaScript | 3,053 to 11,247 | 8,193 lines. This is where the value is. |
| HTML tail | 11,248 to 11,328 | Dynasty, Progress, Versus and modal screens, injected after the script. |

Line 3,054 on its own is 827,068 bytes. That single line is the whole player
database as clean JSON. It lifts out untouched.

---

## 1. The database, verified

I did not take the marketing numbers on trust. I loaded the data section into
Node, ran the correction pass the game runs at startup, and counted.

| Thing | Marketing copy says | Actually is |
|---|---|---|
| Club seasons | 714 | **712** |
| Distinct players | 3,008 | **3,003** |
| Player rows (a player can appear in many club seasons) | n/a | **11,077** |
| Distinct clubs | n/a | **51** |
| Seasons covered | 1992 to 2026 | **1992 to 2026, 35 seasons** |

The small gap is drift, not a bug. Worth knowing so we do not print a wrong
number in the App Store description or on the collection screen.

The data arrives in three layers and they must be applied in order:

1. `SQUADS` on line 3,054. 692 club seasons, JSON, 1992 to 2025.
2. Forty hand written `SQUADS['Club|Year']=[...]` blocks for 2025/26 and
   2026/27, lines 3,162 to 3,917. Twenty overwrite 2025, twenty add 2026.
3. A correction pass, lines 3,918 to 3,949. `PXDB_REMOVE` deletes 471 duplicate
   player rows so nobody appears at two clubs in the same season. `PXDB_RATING`
   re-anchors 997 ratings to real awards. Then `Southampton|2025` and
   `Ipswich|2025` are deleted outright.

Recommendation: run all three layers once on my machine at build time and ship
a single finished `squads.json`. The phone should never run the correction
pass. It saves startup time and removes a whole class of "did the fix apply"
bug.

Other data tables, all portable as is:

`FM` (12 formations with attack and defence modifiers), `PL_SEASONS`,
`SIM_LEAGUE`, `AT20_CLUBS`, `CLUB_COLOURS`, `ACHIEVEMENTS` (53 of them),
`PX_EVENTS` (5 weekly events), `PXP_DAILY` (5), `PXP_WEEKLY` (4), `PXP_ASC` (6),
`PXP_SHOP` (5), `DY_POS`, `DY_INJ`, `DY_FIRST` and `DY_LAST` (youth name pools),
`DY_POSVAL`, `DY_STAFF`, `DY_STAR`, `DY_INFRA`, `DY_STYLE`, `DY_MENT`, `DY_FIT`,
`DY_SCEN` (5 career scenarios), `DY_CAP` (stadium capacities), `DY_RIVALS`,
`CONTINENTAL_CLUBS` (36), `NATIONAL_CLUBS`, `WC_SQUADS` (48 nations),
`WC_TEAMS` (48 nations with flags, ratings, groups, confederations), `WC_KO`,
`DC` (the three Dixon-Coles constants).

---

## 2. Every screen in the web build

Twenty four full screens. Everything with `class="screen"`.

**Core draft flow**
| id | Screen |
|---|---|
| `home` | Front door. Hero draft button, World Cup card, Play today tiles, Your game rows, chip row. |
| `ss` | Setup. Formation picker, era range slider, mode, ratings toggle, Blitz toggle, mini pitch preview. |
| `sd` | Draft. The spin wheel, era card, reroll counter, player list, live pitch, move bar. |
| `sc` | Squad complete. Final XI, overall panel, pre-season odds card, lineup list. |
| `sv` | Season live. Rolling match feed, form strip, live table position, skip button. |
| `sr` | Results. Final record, verdict, trophy cabinet, cups, extra stats, awards, squad summary, fixtures, media card, full table, share. |

**World Cup**
| id | Screen |
|---|---|
| `wcHome` | Nation select, 48 team group grid. |
| `wcResult` | World XI nations draft result. |
| `wcTour` | Tournament hub, group stage and knockouts. |
| `wcSummary` | Tournament summary and records. |

**Dynasty, ten screens**
| id | Screen |
|---|---|
| `dyIntro` | Explains the mode, begin button. |
| `dyStart` | Standalone career start: mode, scenario, club. |
| `dyHub` | The club home. Budget, trophies, manager rating, board objective, squad, inbox. The single biggest render function in the file, 170 lines. |
| `dyTac` | Tactics: style, mentality, set pieces, familiarity. |
| `dyStaff` | Staff hiring and upgrades. |
| `dyInfra` | Stadium and facilities. |
| `dyFin` | Finances. |
| `dyYouth` | Academy and youth promotion. |
| `dyCon` | Contracts and renewals. |
| `dyMarket` | Transfer market. |

**Other**
| id | Screen |
|---|---|
| `pxProg` | Progress: level, XP, coins, missions, collection, ascension, shop. |
| `versus` | Head to head against a saved or shared XI. |
| `privacyScr` | Privacy text. |

**Overlays and modals, eleven**

`ov` place player, `pindexOv` player index search, `cov` confirm restart,
`wcMatch` live match playback (also reused for Premier League matches),
`histOv` draft history, `lbOv` best seasons leaderboard, `cabOv` trophy cabinet,
`vsPickOv` versus XI picker, `achPop` achievement toast, `pxWN` what's new,
`moveBar` the swap players bar.

---

## 3. Every game mode

Nine, not five.

1. **Premier League Draft.** The core loop. Spin lands on a real club season,
   you draft one player, repeat until the XI is full, then simulate 38 games.
2. **Blitz.** Not a separate mode in the web build. It is a toggle on the setup
   screen (`pxBlitzBtn`): pools cut to the top 3 picks and the season fires
   instantly. Your spec lists it as its own entry in the PLAY tab. That is a
   fine decision, it just needs building as a mode wrapper, not ported as one.
3. **Daily Challenge.** Same seeded spins worldwide, one attempt, shareable
   38 result grid.
4. **Weekly Event.** Rotates on a 7 day cycle: Nineties, Y2K, Moneyball
   (nothing above 85), Modern Era, Homegrown.
5. **Friend Duels.** Host generates a code, friend drafts the identical spin
   sequence, game declares a winner.
6. **Beat the Machine.** After a season, the Machine re-drafts your exact
   boards with best on paper picks and plays the same season.
7. **Dynasty.** Multi season career. Ageing, development, decline, retirement,
   injuries, youth academy, contracts, transfers, wages, revenue, stadium,
   facilities, staff, tactics, board objectives, sacking.
8. **World Cup 2026.** Two routes: pick a nation, or draft a World XI from the
   48 nation squads. Groups then knockouts with penalty shootouts.
9. **Versus.** Asynchronous head to head between two saved XIs, with codes.

Meta systems on top: PXP progression (XP, 
levels, coins, daily and weekly missions, streak, collection, ascension, shop),
53 achievements, trophy cabinet, draft history, best seasons leaderboard,
player index, Hall of Fame.

---

## 4. Portable logic versus DOM UI

425 top level functions. I brace matched every one and scanned its real body
for browser references.

| Category | Count |
|---|---|
| **Pure. No DOM, no globals. Copy and paste.** | **172** |
| **Portable maths, but reads or writes the global `gs` / `cfg` / `PXP`.** | **68** |
| **DOM or browser. Rebuild natively.** | **185** |

The middle 68 are the important ones to understand. They are not DOM code. They
are correct maths wrapped around global mutable state. `doMatch` is the clearest
example: it computes the score perfectly, then writes straight into `gs.wins`,
`gs.pts`, `gs.form` and calls `haptic()`. The fix is mechanical, not a rewrite:
take the state in as an argument, return the result, let the caller apply it.
**No number changes.**

### 4a. Pure and portable, by system

**Seeded RNG and daily seeds**
`mulberry32`, `pxRand`, `pxEpochDay`, `pxpEpochDay`, `pxDailyId`, `pxDailyKey`,
`pxSeedRun`, `dyHash`, `dyRnd`, `dyGauss`, `wcRnd`, `wcPick`, `shuf`

**Dixon-Coles match engine**
`DC` constants, `dcTau`, `dcPois`, `dcParams`, `dcMatrix`, `dcDraw`,
`dcExpected`, `doMatch`, `genScorers`, `playOneMatch`, `poissonR`,
`calcOdds`, `strFromAvg`, `squadAvg`, `buildFinalTable`

**Draft and squad**
`posGroups`, `posCompat`, `posF`, `posOrd`, `posCol`, `posOrd`, `pxSquadChem`,
`pxChemBonus`, `pxFormPills`, `buildPIndex`, `pxCurrentEvent`,
`pxApplyEventByKey`, `pxStartSeeded`, `pxMakeDuelCode`, `encodeXI`, `decodeXI`

**Dynasty, the whole engine**
`dySeedTracks`, `dyTrackStep`, `dyAgeOne`, `dyRetireOdds`, `dyAgeFor`,
`dyAgeMult`, `dyValue`, `dyAgeValMul`, `dyContractMul`, `dyPlayerValue`,
`dyWage`, `dyWageBill`, `dyRevenue`, `dyAmortTotal`, `dyFinanceSeason`,
`dyBudgetFrom`, `dyBudgetFor`, `dyObjLabel`, `dyObjective`, `dyRollInjury`,
`dySeasonInjuries`, `dyMakeYouth`, `dyYouthName`, `dyScoutRange`,
`dyRenewCost`, `dyExpiring`, `dyStarters`, `dyBench`, `dyBenchSlots`,
`dyEnsureBench`, `dyBenchCover`, `dyAvg`, `dyOverall`, `dyClamp`, `dyRint`,
`dyOrd`, `dyPosCfg`, `dyStaffCost`, `dyStaffUpgradeCost`, `dyDevMult`,
`dyInjuryMult`, `dyYouthQuality`, `dyScoutBonus`, `dyStaffWages`,
`dyTicketYield`, `dyMatchdayRevenue`, `dyStadiumStep`, `dyStadiumCost`,
`dyStadiumPayback`, `dyInfraCost`, `dyTrainingMult`, `dyPosFit`,
`dyEffectiveAvg`, `dySetPieceShare`, `dyTacticLearn`, `dyTacticChanged`,
`dyScenById`, `dyClubOptions`, `dyClubsForScenario`, `dyStars`,
`dyBaseCapacity`, `dyRivalOf`, `dySignPlayer`, `dySellPlayer`, `dyMarketPool`,
`dyFillGaps`, `dyPromoteInto`, `dyStartCareer`, `dyProcessSeasonEnd`,
`dyMigrate`

`dyProcessSeasonEnd` at 92 lines and `dyStartCareer` at 53 are the two to be
most careful with. They are the beating heart of Dynasty.

**Progression, PXP**
`pxpNeed`, `pxpAdd`, `pxpTouchStreak`, `pxpNextResetTxt`, `pxpCollect`,
`pxpCollectionPct`, `pxpRollMissions`, `pxpProgress`, `pxpAscInfo`,
`pxpApplyAsc`, `pxpAscComplete`, `pxpBuy`

**World Cup and cups**
`simWCMatch`, `wcSimGoals`, `wcMakeGoals`, `wcSimShootout`, `wcScorerPool`,
`wcAssistPool`, `wcOppScorers`, `startWCTournament`, `advanceWCTournament`,
`commitWCMatch`, `pushKOMatch`, `simulateWCTournament`, `wcExpectedRank`,
`wcTourField`, `wcTourGoldenBoot`, `wcTourGoldenGlove`, `wcScoreStr`,
`pickOpp`, `simCupP`, `simCupMatch`, `simulateCups`

**Beat the Machine**
`pxMachineXI`, `pxMachineSeason`, `pxStartMachine`

**Versus**
`vsStrength`, `vsXg`, `vsPickScorers`, `simVersus`, `vsXiAvg`, `vsModeLabel`,
`vsAssignCode`, `vsPersistCode`

**Formatting helpers that come along free**
`ordinal`, `pxOrdinalWord`, `inits`, `lastName`, `seasonStr`, `rtgCol`,
`finishCol`, `posFinishLabel`, `seasonGrade`, `staticVerdict`, `dyFmtM`,
`dyBar`, `getExpectedFinish`, `pxResultGrid`, `pxShareText`, `pxShareDaily`,
`tagC`, `pxClubCode`, `pxClubDisc`

### 4b. Does not port, rebuild natively

All 185 DOM functions. The heaviest are:

`dyHubRender` 170 lines, `buildWCSummary` 157, `drawShareCard` 146,
`renderPLHistory` 101, `renderWCTourHub` 98, `pxProgRender` 93,
`buildFixturesList` 88, `buildTable` 87, `showSquadComplete` 84,
`showCabinetModal` 84, `buildNationsResult` 83, `doSpin` 78, `dyPromoteFlow` 74,
`buildMediaCard` 74, `renderPLHub` 74, `dyStartRender` 72, `showShareModal` 72.

Special cases worth calling out now:

- `drawShareCard` draws the result card on an HTML canvas. On iOS this becomes
  a React Native view captured with `react-native-view-shot`, then handed to
  the native share sheet. Better result, and it is a native feature Apple can
  see.
- `pxTone`, `pxSfx`, `wcTone`, `wcSound`, `playSpinSound`, `playSeasonEndSound`
  synthesise audio with the Web Audio API. These need short bundled audio files
  plus `expo-audio`. The logic that decides *when* to play is portable, the
  sound generation is not.
- `haptic()` is a three line `navigator.vibrate` stub. It becomes real Taptic
  Engine feedback via `expo-haptics`. Immediate, obvious upgrade on device.
- `pxConfetti`, `pxBurst`, `pxShake`, `pxPop`, `pxSignedReveal`, `spinTextAnim`,
  `pxCountUp` are the game feel layer. All rebuild on Reanimated. The spin
  reveal is the single most important animation in the app and deserves proper
  time.
- `cloudOn`, `cloudHeaders`, `cloudReq`, `cloudCode`, `pxiHandle` are an
  optional Supabase backend. It is switched **off** in this build,
  `PXI_CLOUD={url:'',key:''}`. Do not port it. Game Center replaces it and gives
  us verified leaderboards with no server, exactly as your plan says.

---

## 5. Saved data in the web build

Thirteen storage keys, no schema version on most of them:

`pxi_run_v1` (resume, has a `v:1`), `pxi_dyn2` (dynasty, has `v:2` and already
has a `dyMigrate` function), `pxi_meta_v1` (PXP), `pxi-history`, `pxi-cabinet`,
`pxi-wc-history`, `pxi-saved-xis`, `pxi_shared_xis`, `pxi_leaderboard`,
`pxi-handle`, `pxi_fx` (settings), `pxi_daily_*` (one key per day),
`pxi_pending_club`, `pxi_s27b_seen`.

Note `pxi_daily_*` writes a new key every single day and never cleans up. That
is a slow leak. The new save layer should hold daily results in one bounded
record.

Your instinct is right and the code proves it: Dynasty already carries a
version number and a migration function because it got burned. The new layer
gets one versioned envelope, one migration chain, from day one.

---

## 6. Design system

Good news. The CSS `:root` block in the web build already matches the pine
emerald spec you gave me, exactly. Same hex values for bg, the three surfaces,
borders, text tiers, accent, gold, danger and all four position colours. It
also already has an 8pt spacing scale, a radius scale, a type scale, elevation
tokens and motion tokens.

So the design tokens are a straight transcription, not a redesign. Fonts are
Inter, Barlow Condensed and Anton, all three on Google Fonts and all three
available through `@expo-google-fonts`.

---

## 7. Decisions taken

Confirmed 31 Aug 2026.

| Question | Decision |
|---|---|
| Blitz | Stays a toggle on the setup screen, not a mode tile. |
| Duels and Versus | Merged into one thing in the PLAY tab. |
| Player counts in copy | Use the real figures: 712 club seasons, 3,003 players. |
| Online leaderboard and 1v1 | **Added to scope.** Supabase for both, Game Center layered on top. |
| Launch timing | Version 1.0 waits for online. No offline-only ship. |

### A correction to the original brief

The brief said Game Center "solves verified leaderboards with NO backend". The
no backend half is true. The verified half is not. Game Center scores are
submitted by the phone, so they can be faked. It is harder than faking a plain
web request, but it is not verification.

What makes this fixable is a property this game happens to have: **Perfect XI is
fully deterministic.** A seed, a config and eleven picks completely determine
the 38 game season. Nothing else touches it. So a server can replay any
submitted run and check the score rather than trust it.

Because the engine is being built as plain JavaScript with no React in it, the
identical engine file runs unchanged inside a Supabase edge function. Replay
validation therefore costs almost nothing to build. It is a free consequence of
the Phase 2 structure.

---

## 8. The online layer

Everything single player still runs with no network at all. Online features
degrade quietly: the leaderboard shows the last cached board, duels say they
need a connection. The offline promise survives intact.

### Identity, with no sign up screen

Supabase anonymous auth issues a stable id on first launch, held in MMKV. The
player picks a display name, exactly as the web game already does with its
`pxi-handle` key. No email, no password, no sign up screen, nothing to forget.
The App Store copy can still say no accounts, truthfully.

Game Center sign in is layered on when available and silently skipped when not.

### Leaderboard, actually verified

The client submits the seed, the config, the eleven picks and its claimed
points. An edge function replays the run with the same engine and compares. A
mismatch is rejected, not stored. Only validated runs reach the board.

Boards: Daily Challenge per day, current Weekly Event, all time best season,
and Dynasty measured on trophies and seasons survived.

**One thing that will silently break this if we do not handle it now.** Client
and server must replay with the *same* engine build, or an app update starts
rejecting honest players. So the engine carries an `ENGINE_VERSION`, every
submission carries it, and the server keeps recent versions and replays with the
matching one. This is cheap to build now and very expensive to retrofit after
the board has real scores on it.

### Live 1v1

The whole match rides on determinism, which makes it far simpler than it sounds:

1. Server pairs two players and picks one seed.
2. Both phones derive the identical eleven boards from that seed.
3. Each round has a 15 second pick timer. Picks reveal together, with a haptic.
4. After eleven rounds both phones simulate the same fixtures from the same
   seed, so both arrive at the same result with nothing to sync.
5. Head to head result card, native share sheet.

Disconnects do not hang the match: the missing player auto-picks the best
available and the game finishes.

**The empty lobby problem, designed out.** A new app has nobody queueing.
Three defences, in order: invite a friend by code, which the web build already
generates; the Machine as an instant opponent after 20 seconds of no match,
clearly labelled, using the already tuned `pxMachineXI`; and the existing
seeded async duel as the always works fallback.

### One App Store risk worth knowing now

A free text display name shown to other players counts as user generated
content, and Apple asks for moderation tooling under guideline 1.2. Cheap to
satisfy if we do it up front: a profanity filter on names, a report button on
the duel result screen, and a block list. Expensive as a rejection three days
before launch.

---

## 9. Project structure

The one rule that matters most:

> **`src/engine` and `src/data` import nothing from React or React Native.**

That is what makes the Phase 2 headless test possible, what keeps the tuned
maths safe from UI churn, and now also what lets the same engine run on the
server for replay validation. One rule, three payoffs.

```
perfectxi/
  app/                        expo-router. Routes only, kept thin.
    (tabs)/today.tsx  play.tsx  career.tsx  you.tsx
    draft/  dynasty/  worldcup/  duels/

  src/engine/                 PURE. No React, no RN. Runs in Node and Deno.
    version.ts                ENGINE_VERSION. Load bearing, see section 8.
    rng.ts                    mulberry32, seeds, daily ids
    constants.ts              DC, thresholds
    formations.ts             FM
    match/dixonColes.ts       dcTau dcPois dcParams dcMatrix dcDraw dcExpected
    match/simulate.ts         doMatch, genScorers, the season loop
    match/odds.ts             calcOdds, strFromAvg, squadAvg
    draft/pool.ts             spin pools, era and event filters
    draft/chemistry.ts        draft/machine.ts (also the 1v1 bot)
    dynasty/ageing.ts value.ts finance.ts staff.ts infra.ts
    dynasty/tactics.ts youth.ts contracts.ts market.ts season.ts scenarios.ts
    worldcup/  cups/  progression/  versus/
    replay.ts                 rebuild a run from seed plus picks

  src/data/                   BAKED at build time. Never corrected on device.
    squads.json               712 club seasons, corrections already applied
    wcSquads.json  wcTeams.json  clubColours.json  achievements.ts

  src/save/                   migration safe from day one
    storage.ts  schema.ts  migrations/  slices/

  src/online/
    client.ts                 supabase client, anonymous session
    identity.ts               player id, display name, profanity filter
    leaderboard.ts            submit, fetch, cache
    duel/matchmaking.ts       queue, pairing, bot fallback
    duel/channel.ts           realtime wire
    duel/protocol.ts          typed messages, shared with the server
    moderation.ts             report, block
    sync.ts                   offline queue and retry

  src/ui/
    tokens.ts  type.ts
    components/               Button Card Pill StatSlot NumberSlot Sheet
                              PitchSlot FormStrip TableRow Countdown
                              NumberSlot has the overflow guard built in.
                              Word values use Pill. Always.

  src/native/                 haptics share notifications gameCenter widget
  src/features/               today draft dynasty worldcup duels progress online

  supabase/
    migrations/               the SQL schema
    functions/validate-run/   replays with the pinned engine version
    functions/matchmake/      pairs two waiting players

  scripts/
    extract-db.mjs            rebuilds src/data/*.json from index.html
    sim-season.mjs            Phase 2 proof: simulate, print a table
    bundle-engine.mjs         copies the versioned engine into the functions

  __tests__/engine/           the golden number tests
  widget/                     iOS widget extension, added at Phase 5
```

### Two pieces worth explaining

**`scripts/extract-db.mjs`.** When ratings get updated for 27/28 next summer,
the source is edited and one command is run. Nobody hand edits an 800KB JSON
file. Five minutes now, a day saved later.

**`scripts/bundle-engine.mjs`.** Copies the engine into the edge functions with
its version stamped, so client and server can never drift apart. This is the
thing that stops replay validation quietly rejecting real players after an
update.

### The golden number tests

Before a line of the engine is touched, tests lock in the tuned behaviour:
2.75 goals per game across a large sample, champions landing near 90 points, a
92 rated 23 year old valued near 125 million. If a refactor moves any of those,
the test goes red and work stops. That is the guarantee the balance survives
the port, and it is also what makes replay validation trustworthy.

---

## 10. Build order

Ten phases. Version 1.0 ships at the end of phase 10.

| Phase | What |
|---|---|
| 1 | New Expo project, four tab shell, design tokens, three fonts, EAS dev build on the phone. |
| 2 | Engine and database as plain modules. `ENGINE_VERSION`. Headless season test and the golden number tests. |
| 3 | Draft end to end: spin, pick, simulate, results, share card. |
| 4 | Dynasty. The biggest single piece. |
| 5 | Today tab, Daily Challenge, streaks, push notification, home screen widget. |
| 6 | Blitz toggle, Beat the Machine, World Cup, Duels with Versus merged in. |
| 7 | Online spine: Supabase project, schema, anonymous identity, replay validation, global leaderboards, moderation tooling. |
| 8 | Live 1v1: matchmaking, realtime draft, pick timers, bot fallback, disconnect handling. |
| 9 | Game Center: achievements, friends leaderboard, the native module. |
| 10 | App Store assets, review preparation, submission. |

Guideline 4.2 is comfortably answered by the end of this: native navigation,
haptics, push, a home screen widget, Game Center, and online multiplayer.
Nothing about this reads as a repackaged website.

---

## 11. Next step

Phase 1, on your confirmation of section 9: new Expo project, the four tab
shell, the design tokens, the three fonts, and an EAS dev build on your phone
so you can judge the feel before anything else is built.
