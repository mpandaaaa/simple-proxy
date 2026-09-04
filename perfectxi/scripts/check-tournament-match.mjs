/**
 * The knockout broadcast, measured.
 *
 * A minute by minute match is only worth anything if it cannot disagree
 * with the result it came from. So this plays real tournaments, turns
 * every match into its ninety minutes, and checks the story against the
 * scoreline it was built from: the goals, the extra time, the shootout,
 * and the same match told twice telling it the same way.
 */
import {
  STAGE_NAME,
  wcNations,
  wcPlayNext,
  wcSquad,
  wcStart,
  wcTeam,
} from '../.headless/engine/index.js';
import { buildTournament } from '../.headless/game/tournamentMatch.js';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const PLACEHOLDER = /\{[psa]\}/;

function tapeFor(step, voice) {
  const m = step.match;
  const a = wcTeam(m.a);
  const b = wcTeam(m.b);
  return buildTournament({
    seed: step.run.seed,
    n: Math.max(0, step.run.played.length - 1),
    comp: STAGE_NAME[m.stage],
    me: { name: a.n, rating: a.r, squad: wcSquad(m.a) },
    opp: { name: b.n, rating: b.r, squad: wcSquad(m.b) },
    gf: m.ga,
    ga: m.gb,
    gf90: typeof m.ga90 === 'number' ? m.ga90 : m.ga,
    ga90: typeof m.gb90 === 'number' ? m.gb90 : m.gb,
    et: Boolean(m.et),
    pens: m.pens,
    scorers: step.scorers,
    voice,
  });
}

const nations = wcNations();
let matches = 0;
let withEt = 0;
let withPens = 0;
let goals = 0;
let words = 0;

for (let i = 0; i < nations.length; i++) {
  for (let r = 0; r < 3; r++) {
    let run = wcStart(nations[i].code, 9000 + i * 31 + r);
    let guard = 0;
    while (!run.over && guard++ < 12) {
      const step = wcPlayNext(run);
      if (!step) break;
      run = step.run;
      matches++;

      const m = step.match;
      /* Both commentators, so a second voice cannot quietly disagree with
         the scoreline the first one told. */
      const voice = matches % 2 ? 'dry' : 'classic';
      const t = tapeFor(step, voice);
      const again = tapeFor(step, voice);

      if (JSON.stringify(t) !== JSON.stringify(again)) {
        fail(`not deterministic: ${m.a} v ${m.b} ${STAGE_NAME[m.stage]}`);
      }

      const full = t.full;
      if (full !== (m.et ? 120 : 90)) fail(`full is ${full} on a match with et=${Boolean(m.et)}`);
      if (t.momentum.length !== full + 1) {
        fail(`momentum is ${t.momentum.length} long, wanted ${full + 1}`);
      }

      /* The story has to add up to the score. */
      const scored = { me: 0, opp: 0 };
      let last = null;
      let hts = 0;
      let fts = 0;
      let ets = 0;
      let shootouts = 0;
      const pens = { me: 0, opp: 0 };
      let minute = -1;

      for (const e of t.events) {
        if (!e.text || PLACEHOLDER.test(e.text)) fail(`bad line: "${e.text}"`);
        if (e.min < 0 || e.min > full) fail(`event at ${e.min} in a ${full} minute match`);
        if (e.min < minute) fail(`events out of order at ${e.min} after ${minute}`);
        minute = e.min;
        if (e.kind === 'goal') {
          scored[e.side]++;
          goals++;
          if (!e.scorer) fail('a goal with nobody scoring it');
        }
        if (e.kind === 'ht') hts++;
        if (e.kind === 'ft') fts++;
        if (e.kind === 'et') ets++;
        if (e.kind === 'shootout') shootouts++;
        if (e.kind === 'pen' && e.good) pens[e.side]++;
        words += e.text.split(/\s+/).length;
        last = e;
      }

      if (scored.me !== m.ga || scored.opp !== m.gb) {
        fail(`told ${scored.me}-${scored.opp}, banked ${m.ga}-${m.gb}`);
      }
      if (hts !== 1) fail(`${hts} half times`);
      if (fts !== 1) fail(`${fts} full times`);
      if (m.et) {
        withEt++;
        if (ets !== 1) fail(`${ets} extra time calls on a match that went to extra time`);
      } else if (ets) {
        fail('extra time called on a match that did not go to it');
      }
      if (m.pens) {
        withPens++;
        if (shootouts !== 1) fail(`${shootouts} shootouts`);
        if (pens.me !== m.pens.a || pens.opp !== m.pens.b) {
          fail(`shootout told ${pens.me}-${pens.opp}, banked ${m.pens.a}-${m.pens.b}`);
        }
        if (last.kind !== 'pen') fail('a shootout that does not end on a penalty');
      } else if (shootouts) {
        fail('a shootout in a match that never had one');
      }

      /* The panel has to agree with the football. */
      const s = t.stats;
      if (s.shots[0] < m.ga || s.shots[1] < m.gb) fail('fewer shots than goals');
      if (s.onTarget[0] > s.shots[0] || s.onTarget[1] > s.shots[1]) {
        fail('more on target than shots');
      }
      if (s.possession < 20 || s.possession > 80) fail(`possession of ${s.possession}`);
    }
  }
}

console.log('');
console.log(`  ${matches} matches told minute by minute`);
console.log(`  ${withEt} went to extra time, ${withPens} to penalties`);
console.log(`  ${goals} goals, all of them accounted for`);
console.log(`  ${Math.round(words / matches)} words of commentary a match`);
console.log('');

if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('The broadcast never disagrees with the result.\n');
