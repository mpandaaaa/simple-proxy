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

## 7. Proposed project structure

The one rule that matters: **`src/engine` and `src/data` import nothing from
React or React Native.** Plain JavaScript modules. That is what makes the
Phase 2 headless season test possible, and it is what keeps the tuned maths
away from UI churn forever.

```
perfectxi/
  app/                        expo-router. Routes only, thin.
    _layout.tsx
    (tabs)/_layout.tsx
    (tabs)/today.tsx
    (tabs)/play.tsx
    (tabs)/career.tsx
    (tabs)/you.tsx
    draft/setup.tsx  draft/spin.tsx  draft/complete.tsx
    draft/season.tsx  draft/results.tsx
    dynasty/...       ten routes mirroring the ten Dynasty screens
    worldcup/...      four routes
    versus/...

  src/
    engine/                   PURE. No React, no RN. Node-runnable.
      rng.ts                  mulberry32, seeds, daily ids
      constants.ts            DC, thresholds
      formations.ts           FM
      match/dixonColes.ts     dcTau dcPois dcParams dcMatrix dcDraw dcExpected
      match/simulate.ts       doMatch, playOneMatch, genScorers, season loop
      match/odds.ts           calcOdds, strFromAvg, squadAvg
      draft/pool.ts           spin pools, era filters, event filters
      draft/chemistry.ts      pxSquadChem, pxChemBonus
      draft/machine.ts        pxMachineXI, pxMachineSeason
      dynasty/ageing.ts       dySeedTracks dyTrackStep dyAgeOne dyRetireOdds
      dynasty/value.ts        dyValue dyPlayerValue dyWage
      dynasty/finance.ts      dyRevenue dyFinanceSeason dyBudgetFrom
      dynasty/staff.ts        DY_STAFF and multipliers
      dynasty/infra.ts        stadium and facilities
      dynasty/tactics.ts      DY_STYLE, DY_MENT, dyTacticalDeltas maths
      dynasty/youth.ts        dyMakeYouth, scouting
      dynasty/contracts.ts    dyExpiring, dyRenewCost
      dynasty/market.ts       dyMarketPool, dySignPlayer, dySellPlayer
      dynasty/season.ts       dyProcessSeasonEnd, dyStartCareer
      dynasty/scenarios.ts    DY_SCEN, dyClubOptions
      worldcup/               tournament, matches, shootouts
      cups/                   simulateCups
      progression/            PXP, missions, streak, collection, ascension
      versus/                 simVersus, encodeXI, decodeXI

    data/                     BAKED at build time. Never corrected on device.
      squads.json             712 club seasons, corrections already applied
      wcSquads.json  wcTeams.json
      clubColours.json  plSeasons.json  achievements.ts
      index.ts                typed loaders

    save/                     migration safe from day one
      storage.ts              MMKV wrapper
      schema.ts               SCHEMA_VERSION, typed shapes
      migrations/             one file per version bump
      slices/                 run, dynasty, progression, history, cabinet, settings

    ui/
      tokens.ts               the pine emerald palette, spacing, radius, motion
      type.ts                 Barlow Condensed / Inter / Anton, tabular numerals
      components/             Button, Card, Pill, StatSlot, NumberSlot, Sheet,
                              PitchSlot, FormStrip, TableRow, Countdown
      NumberSlot has a built in overflow guard. Word values use Pill. Always.

    native/
      haptics.ts  share.ts  notifications.ts  gameCenter.ts  widget.ts

    features/                 screen level logic, hooks, view models
      today/ draft/ dynasty/ worldcup/ duels/ progress/

  scripts/
    extract-db.mjs            rebuilds src/data/*.json from index.html
    sim-season.mjs            Phase 2 proof: simulate a season, print a table

  __tests__/
    engine/                   golden number tests, see below

  widget/                     iOS widget extension, added in Phase 5
```

**Why `scripts/extract-db.mjs` matters.** When you update ratings for 27/28
next summer, you edit the source and re-run one command. You do not hand edit
a 800KB JSON file. This is a five minute job now that saves a day later.

**The golden number tests.** Before we change a single line of the engine, I
will write tests that lock in the tuned behaviour: 2.75 goals per game across a
large simulated sample, champions landing near 90 points, a 92 rated 23 year
old valued near 125 million pounds. If a refactor moves any of those, the test
goes red and I stop. That is how we guarantee the maths you tuned survives the
port.

---

## 8. Three things I need you to decide

**1. Blitz.** In the web build it is a toggle on the setup screen, not a mode.
Your app spec lists it as its own tile in the PLAY tab. I would build it as a
proper mode tile, since a tab of five modes reads better than a tab of four
with a hidden toggle. Confirm.

**2. The Versus mode.** Your four tab spec lists "Friend Duels" under PLAY but
the web build has two separate things: Duels (seeded code, same spins) and
Versus (async, two saved XIs, head to head). Do you want both, or should Versus
fold into Duels?

**3. The player count in copy.** Real numbers are 712 club seasons and 3,003
players, not 714 and 3,008. I will use the real ones everywhere in the app and
the store listing unless you say otherwise.

---

## 9. What happens next, once you confirm section 7

Phase 1: new Expo project, four tab shell, design tokens, three fonts, EAS dev
build on your phone so you can judge it before anything else is built.

Nothing gets written until you say the structure is right.
