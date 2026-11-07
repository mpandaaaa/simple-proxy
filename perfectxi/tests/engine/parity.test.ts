/**
 * The port must reproduce the web game exactly.
 *
 * For each case, the ORIGINAL web code (loaded from source/web/index.html in
 * a sandbox) and the port play the same squad on the same seed. Every match,
 * scoreline, scorer, assist, clean sheet and the whole final table must
 * agree, and both must have drawn the same count of random numbers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWebGame } from '../../scripts/lib/web-sandbox.mjs';
import { counted, mulberry32 } from '../../src/engine/rng';
import { calcOdds, squadAvg, squadStrength, squadChemistry } from '../../src/engine/strength';
import { dcExpected, dcMatrix } from '../../src/engine/match/dixonColes';
import { finalTable, playNext, startSeason, SIM_LEAGUE, FORMATIONS } from '../../src/engine/season';
import { testCases } from '../helpers/squads';

const quiet = console.log;
console.log = () => {};
const web = loadWebGame();
console.log = quiet;

/** Bring a value out of the sandbox realm so deepStrictEqual compares data, not prototypes. */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const CASES = testCases(250);

test('Dixon-Coles expected goals and score matrix match the web across the strength range', () => {
  for (const fname of Object.keys(FORMATIONS)) {
    const fm = FORMATIONS[fname];
    for (let a = 0.2; a <= 0.99; a += 0.07)
      for (let b = 0.2; b <= 0.99; b += 0.11)
        for (const home of [true, false]) {
          web.gs.dynastyCtx = null;
          assert.deepEqual(dcExpected(a, b, home, fm), plain(web.dcExpected(a, b, home, web.FM[fname])));
        }
  }
  for (const [l, m] of [[0.12, 0.12], [1.4, 1.1], [2.9, 0.4], [6, 6], [0.5, 3.3]])
    assert.deepEqual(dcMatrix(l, m, -0.13), plain(web.dcMatrix(l, m, -0.13)));
});

test('squad strength, chemistry and pre-season odds match the web', () => {
  for (const c of CASES) {
    web.gs.squad = clone(c.squad);
    assert.equal(squadChemistry(c.squad), web.pxSquadChem());
    assert.equal(squadStrength(c.squad), web.strFromAvg(web.squadAvg(null) + web.pxChemBonus()));
    const avg = squadAvg(c.squad);
    assert.equal(avg, web.squadAvg(null));
    assert.deepEqual(calcOdds(avg, c.squad), plain(web.calcOdds(avg)));
  }
});

test(`${CASES.length} full seasons match the web match for match`, () => {
  assert.equal(SIM_LEAGUE.length, 19);
  for (const [i, c] of CASES.entries()) {
    // --- the original web game ---
    const g = web.gs;
    g.squad = clone(c.squad);
    g.playerStats = {}; // what startDraft does before every new run
    g.dynastyCtx = null;
    g._ascHostile = c.ascHostile;
    g.xgF = 0; g.xgA = 0; // web bug: nothing ever resets these, so xG leaks between seasons
    web.cfg.formation = c.formation;
    web.pxSeedRun(c.seed);
    web.goSimulate();
    while (g.plIdx < 38) { web.plComputeNext(); g.plIdx++; }
    const wTable = plain(web.buildFinalTable());
    const wMatches = plain(g.matchResults);
    const wStats = plain(g.playerStats);

    // --- the port ---
    const rnd = counted(mulberry32(c.seed));
    const st = startSeason({ squad: clone(c.squad), formation: c.formation, rnd, ascHostile: c.ascHostile });
    while (st.next < 38) playNext(st);
    const pTable = finalTable(st);

    const tag = `case ${i} (${c.formation}, seed ${c.seed}${c.ascHostile ? ', hostile' : ''})`;
    assert.equal(rnd.draws(), g._draws, `${tag}: random draw count`);
    assert.deepEqual(
      st.matches.map(({ xg, ...m }) => m),
      wMatches,
      `${tag}: matches`,
    );
    assert.deepEqual(pTable, wTable, `${tag}: final table`);
    assert.deepEqual(st.playerStats, wStats, `${tag}: player stats`);
    assert.equal(st.cleanSheets, g.cleanSheets, `${tag}: clean sheets`);
    assert.equal(st.longestStreak, g.longestStreak, `${tag}: longest streak`);
    assert.equal(st.biggestWin ? `${st.biggestWin.gf}-${st.biggestWin.ga}` : '-', g.biggestWin, `${tag}: biggest win`);
    assert.equal(st.xgF, g.xgF, `${tag}: xG for`);
    assert.equal(st.xgA, g.xgA, `${tag}: xG against`);
    assert.deepEqual(st.form, plain(g.form), `${tag}: form`);
  }
});
