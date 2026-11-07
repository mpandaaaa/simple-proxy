/**
 * Golden numbers: the balance players actually experience, locked in.
 *
 * The parity test proves the port equals the web snapshot. This file is the
 * second line of defence: it holds even if the snapshot is refreshed, so a
 * web-side retune cannot slip into the app unnoticed.
 *
 * Everything here is seeded, so it is fully deterministic. The bands record
 * what the shipping engine produces (web build s67-1), measured over 1,500
 * realistic Prime Mode drafts. If a change moves one, that is a balance
 * change and needs a decision, then an ENGINE_VERSION bump.
 *
 * Note: the brief remembered 2.75 goals a game and champions near 90 points.
 * The live engine produces about 3.0 and 93. Those are what is locked here,
 * because that is the game people are playing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/engine/rng';
import { simulateSeason, FORMATIONS } from '../../src/engine/season';
import { squadAvg } from '../../src/engine/strength';
import { DC } from '../../src/engine/match/dixonColes';
import league from '../../src/data/league.json';
import meta from '../../src/data/meta.json';
import { ENGINE_VERSION, ENGINE_SOURCE_BUILD } from '../../src/engine/version';
import { draftXI } from '../helpers/squads';

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

test('engine constants are the tuned ones and match the extracted data', () => {
  assert.deepEqual({ ...DC }, { GAMMA: 0.27, RHO: -0.13, BASE: 0.13 });
  assert.deepEqual({ ...DC }, league.DC);
  assert.equal(ENGINE_VERSION, 1);
  assert.equal(ENGINE_SOURCE_BUILD, meta.sourceBuild);
});

test('database is the corrected s67-1 set', () => {
  assert.deepEqual(
    { ...meta.counts },
    {
      clubSeasons: 706, players: 2978, playerRows: 10976, clubs: 51,
      seasons: 35, firstSeason: 1992, lastSeason: 2026, datesOfBirth: 3062,
    },
  );
});

test('a fixed run always produces the same season', () => {
  const rnd = mulberry32(11);
  const sq = draftXI(rnd, '4-3-3');
  const r = simulateSeason({ squad: sq, formation: '4-3-3', rnd: mulberry32(2026) });
  const fingerprint = r.matches.map((m) => `${m.gf}${m.ga}`).join('');
  assert.deepEqual(
    { finish: r.finish, pts: r.pts, w: r.wins, d: r.draws, l: r.losses, gf: r.gf, ga: r.ga, fingerprint },
    GOLDEN_RUN,
  );
});

test('season balance over 1,500 realistic drafts', () => {
  const rnd = mulberry32(4242);
  const fms = Object.keys(FORMATIONS);
  const gpg: number[] = [], pts: number[] = [], champ: number[] = [], last: number[] = [], avg: number[] = [];
  let titles = 0;
  for (let i = 0; i < 1500; i++) {
    const fm = fms[Math.floor(rnd() * fms.length)];
    const sq = draftXI(rnd, fm);
    const r = simulateSeason({ squad: sq, formation: fm, rnd: mulberry32(Math.floor(rnd() * 2 ** 31)) });
    gpg.push((r.gf + r.ga) / 38);
    pts.push(r.pts);
    champ.push(r.table[0].pts);
    last.push(r.table[19].pts);
    avg.push(squadAvg(sq));
    if (r.finish === 1) titles++;
  }
  const within = (label: string, v: number, lo: number, hi: number) =>
    assert.ok(v >= lo && v <= hi, `${label} = ${v.toFixed(3)}, expected ${lo} to ${hi}`);

  within('drafted XI average', mean(avg), 82, 83.5);
  within('goals per game in your matches', mean(gpg), 2.95, 3.15);
  within('your points', mean(pts), 72, 76);
  within('champion points', mean(champ), 92, 95);
  within('bottom club points', mean(last), 12, 18);
  within('share of seasons you win the league', titles / 1500, 0.02, 0.07);
});

// Recorded from the engine at ENGINE_VERSION 1. Regenerate only on purpose.
const GOLDEN_RUN = {"finish":4,"pts":79,"w":25,"d":4,"l":9,"gf":81,"ga":44,"fingerprint":"4121000130023121511140001113106050211303102041424020214321312023410424031010"};
