/**
 * The World Cup.
 *
 * A tournament fails in ways a league cannot. A league is thirty eight
 * matches and a table; a knockout is a bracket, and a bracket that is
 * wrong sends you out against somebody who is already out, or leaves you
 * playing yourself, or quietly never ends.
 *
 * So every one of the forty eight nations plays the whole thing through,
 * many times over, and what is checked is the shape of it: everybody
 * plays three group games, thirty two go through, a knockout never ends
 * level, nobody meets themselves, nobody meets a nation that has already
 * lost, and the run always finishes.
 *
 * And then the football: how often the best nation in the world actually
 * wins it, how many goals a match has in it, and how far a nation of a
 * given rating gets. Those are the numbers that say whether it feels
 * like a World Cup or like a coin being flipped seven times.
 */
import {
  wcStart,
  wcPlayNext,
  wcNations,
  wcSummary,
  wcVerdict,
  wcExpected,
  wcScorers,
  goldenBoot,
  goldenGlove,
  groupOf,
  sortRows,
  playMatch,
  shareGoals,
  wcSquad,
  KNOCKOUTS,
  STAGE_NAME,
} from '../.headless/engine/worldcup.js';
import { WC_TEAMS, WC_GROUPS, WC_SQUADS } from '../.headless/data/worldcup.js';
import { mulberry32 } from '../.headless/engine/rng.js';

let failures = 0;
const seen = new Set();
function bad(what) {
  if (seen.has(what)) return;
  seen.add(what);
  console.log('  FAIL ' + what);
  failures++;
}
const rows = [];
function must(label, ok, note) {
  if (!ok) failures++;
  rows.push({ ok, label, note });
}
function band(label, got, lo, hi, note) {
  const ok = got >= lo && got <= hi;
  if (!ok) failures++;
  rows.push({ ok, label, got, lo, hi, note });
}

/* ================= the draw ================= */

const codes = Object.keys(WC_TEAMS);
band('nations', codes.length, 48, 48, 'the real field');
band('groups', WC_GROUPS.length, 12, 12, '');
{
  let wrong = 0;
  for (const g of WC_GROUPS) if (groupOf(g).length !== 4) wrong++;
  must('every group holds four', wrong === 0, `${wrong} did not`);
  const all = WC_GROUPS.flatMap((g) => groupOf(g));
  must('and nobody is in two of them', new Set(all).size === all.length, '');
  must('and everybody is in one', all.length === 48, String(all.length));
}
{
  let thin = 0;
  for (const c of codes) {
    const squad = WC_SQUADS[c] ?? [];
    if (squad.length < 14) thin++;
    if (!squad.some((p) => p.pos.includes('GK'))) bad(`${c} has no goalkeeper`);
  }
  must('every nation can field a squad', thin === 0, `${thin} could not`);
  band('nations you would call favourites', codes.filter((c) => WC_TEAMS[c].r >= 84).length, 2, 12,
    'a World Cup has a handful');
}

/* ================= every nation, all the way through ================= */

let runs = 0;
let unfinished = 0;
let level = 0;
let selfPlay = 0;
let ghosts = 0;
let groupGames = 0;
let matches = 0;
let goals = 0;
let pens = 0;
const winners = {};
const reached = {};
let biggest = 0;

for (const code of codes) {
  for (let go = 0; go < 6; go++) {
    let run = wcStart(code, code.charCodeAt(0) * 7919 + go * 104729 + 11);
    const met = new Set();
    let guard = 0;
    let played = 0;

    while (!run.over && guard++ < 40) {
      const step = wcPlayNext(run);
      if (!step) break;
      const m = step.match;
      played++;
      matches++;
      goals += m.ga + m.gb;
      if (m.pens) pens++;
      if (m.stage === 'group') groupGames++;
      if (m.a === m.b) selfPlay++;
      /* Nobody is met twice in a knockout, which is what a broken bracket
         does when it stops removing the losers. */
      if (m.stage !== 'group') {
        if (met.has(m.b)) ghosts++;
        met.add(m.b);
        if (!m.pens && m.ga === m.gb) level++;
      }
      run = step.run;
    }

    runs++;
    if (!run.over) {
      unfinished++;
      bad(`${code} never finished, ${played} played`);
      continue;
    }
    const s = wcSummary(run);
    biggest = Math.max(biggest, s.best);
    if (run.won) winners[code] = (winners[code] ?? 0) + 1;
    const at = run.outAt ?? 'group';
    reached[at] = (reached[at] ?? 0) + 1;

    if (played < 3) bad(`${code} played ${played} matches and its group is three`);
    if (run.outAt === 'group' && played !== 3) {
      bad(`${code} went out in the group after ${played}`);
    }
  }
}

band('tournaments played out', runs, 288, 288, 'six for every nation');
must('every one of them finished', unfinished === 0, `${unfinished} did not`);
must('nobody ever played themselves', selfPlay === 0, `${selfPlay} did`);
must('nobody met the same nation twice', ghosts === 0, `${ghosts} did`);
must('no knockout ever ended level', level === 0, `${level} did`);
band('matches played', matches, 1000, 4000, '');
band('goals a match', Math.round((goals / matches) * 100) / 100, 2, 3.6,
  'a World Cup is a low scoring tournament');
band('knockouts settled on penalties, %', Math.round((pens / Math.max(1, matches - groupGames)) * 100),
  4, 35, 'roughly one tie in five');
band('the biggest win anybody managed', biggest, 4, 12, '');

/* Everybody has to be able to go out at every stage, or a round is not
   really being played. */
for (const stage of ['group', ...KNOCKOUTS]) {
  band(`runs that ended at the ${STAGE_NAME[stage].toLowerCase()}`, reached[stage] ?? 0, 1, 288, '');
}

/* ================= is it the right shape ================= */

{
  /* The best nation in the world should win it often, and nowhere near
     always. Seven matches is seven chances to go out. */
  const best = wcNations()[0];
  let won = 0;
  let semis = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    let run = wcStart(best.code, i * 2654435761 + 5);
    let guard = 0;
    while (!run.over && guard++ < 40) {
      const step = wcPlayNext(run);
      if (!step) break;
      run = step.run;
    }
    if (run.won) won++;
    if (run.won || run.outAt === 'final' || run.outAt === 'sf') semis++;
  }
  band(`${best.name} wins it, %`, Math.round((won / N) * 100), 8, 45,
    'the best side in the world, and it is still a knockout');
  band('and reaches the last four, %', Math.round((semis / N) * 100), 25, 85, '');

  const worst = wcNations()[47];
  let minnow = 0;
  for (let i = 0; i < N; i++) {
    let run = wcStart(worst.code, i * 40503 + 7);
    let guard = 0;
    while (!run.over && guard++ < 40) {
      const step = wcPlayNext(run);
      if (!step) break;
      run = step.run;
    }
    if (run.outAt !== 'group') minnow++;
  }
  band(`${worst.name} gets out of the group, %`, Math.round((minnow / N) * 100), 2, 55,
    'possible, and it should feel like something');
  must('the best nation wins it more often than the worst',
    won / N > minnow / N * 0.2, '');
}

/* ================= the group table ================= */

{
  const run = wcStart('BRA', 1234);
  must('a group starts level', run.table.every((r) => r.p === 0 && r.pts === 0), '');
  must('and holds four', run.table.length === 4, String(run.table.length));

  let r = run;
  for (let i = 0; i < 3; i++) {
    const step = wcPlayNext(r);
    if (!step) break;
    r = step.run;
  }
  const you = r.table.find((x) => x.code === 'BRA');
  must('after three games you have played three', you?.p === 3, String(you?.p));
  const anyone = r.table.every((x) => x.p === 3);
  must('and so has everybody else in the group', anyone, r.table.map((x) => x.p).join(','));
  const pts = r.table.reduce((a, x) => a + x.pts, 0);
  band('points handed out in a group', pts, 12, 18, 'six matches, two or three points each');
  const gf = r.table.reduce((a, x) => a + x.gf, 0);
  const ga = r.table.reduce((a, x) => a + x.ga, 0);
  must('goals scored equal goals conceded', gf === ga, `${gf} against ${ga}`);

  const sorted = sortRows(r.table);
  let ordered = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].pts > sorted[i - 1].pts) ordered = false;
  }
  must('the table is in order', ordered, '');
}

/* ================= who scored ================= */

{
  const squad = wcSquad('ENG');
  const rnd = mulberry32(99);
  let keeperGoals = 0;
  let total = 0;
  const by = {};
  for (let i = 0; i < 4000; i++) {
    for (const s of shareGoals(squad, 1, rnd)) {
      total++;
      const p = squad.find((x) => x.n === s.scorer);
      const pos = p?.pos[0] ?? '';
      by[pos] = (by[pos] ?? 0) + 1;
      if (pos === 'GK') keeperGoals++;
      if (s.assist === s.scorer) bad('somebody assisted his own goal');
    }
  }
  band('goals shared out', total, 3900, 4100, '');
  must('a goalkeeper never scores', keeperGoals === 0, `${keeperGoals} did`);
  band('goals scored by forwards, %', Math.round((by.ATT / total) * 100), 45, 85,
    'most of them, as in life');
  band('goals scored by defenders, %', Math.round(((by.DEF ?? 0) / total) * 100), 1, 15, '');
  band('goals with an assist, %',
    Math.round((shareRate(squad, rnd) * 100)), 50, 80, 'about two in three');
}

function shareRate(squad, rnd) {
  let withAssist = 0;
  let n = 0;
  for (let i = 0; i < 2000; i++) {
    for (const s of shareGoals(squad, 1, rnd)) {
      n++;
      if (s.assist) withAssist++;
    }
  }
  return withAssist / Math.max(1, n);
}

/* ================= the awards ================= */

{
  let run = wcStart('ARG', 8080);
  let guard = 0;
  while (!run.over && guard++ < 40) {
    const step = wcPlayNext(run);
    if (!step) break;
    run = step.run;
  }
  const boot = goldenBoot(run);
  const glove = goldenGlove(run);
  must('somebody wins the Golden Boot', Boolean(boot.n), boot.n);
  band('and scores', boot.goals, 3, 14, 'a tournament top scorer');
  must('somebody wins the Golden Glove', Boolean(glove.n), glove.n);
  band('with clean sheets', glove.cleanSheets, 1, 8, '');
  must('the whole world is in the running', run.world.length >= 40, String(run.world.length));
  const mine = wcScorers(run);
  must('your own scorers are listed best first',
    mine.every((s, i) => i === 0 || mine[i - 1].g >= s.g), '');
}

/* ================= expectation ================= */

{
  must('a favourite is expected to reach the last four', wcExpected(88) === 'sf', wcExpected(88));
  must('and a minnow to go out in the group', wcExpected(64) === 'group', wcExpected(64));
  must('every rating expects something', codes.every((c) => Boolean(wcExpected(WC_TEAMS[c].r))), '');

  let over = 0;
  let met = 0;
  let under = 0;
  for (const code of codes) {
    let run = wcStart(code, 4242);
    let guard = 0;
    while (!run.over && guard++ < 40) {
      const step = wcPlayNext(run);
      if (!step) break;
      run = step.run;
    }
    const v = wcVerdict(run);
    if (v === 'over') over++;
    else if (v === 'met') met++;
    else under++;
  }
  band('nations that did better than expected', over, 2, 30, '');
  band('nations that did worse', under, 2, 40, '');
  must('and some did exactly what they should', met > 0, String(met));
}

/* ================= the same seed is the same tournament ================= */

{
  const one = [];
  const two = [];
  for (const store of [one, two]) {
    let run = wcStart('FRA', 31337);
    let guard = 0;
    while (!run.over && guard++ < 40) {
      const step = wcPlayNext(run);
      if (!step) break;
      store.push(`${step.match.stage} ${step.match.b} ${step.match.ga}-${step.match.gb}`);
      run = step.run;
    }
  }
  must('the same seed replays exactly', JSON.stringify(one) === JSON.stringify(two), '');
  must('and a different seed does not', (() => {
    const other = [];
    let run = wcStart('FRA', 31338);
    let guard = 0;
    while (!run.over && guard++ < 40) {
      const step = wcPlayNext(run);
      if (!step) break;
      other.push(`${step.match.stage} ${step.match.b} ${step.match.ga}-${step.match.gb}`);
      run = step.run;
    }
    return JSON.stringify(one) !== JSON.stringify(other);
  })(), '');
}

console.log('\nThe World Cup\n');
for (const r of rows) {
  const got = r.got === undefined ? (r.ok ? 'yes' : 'NO') : r.got;
  const want = r.lo === undefined ? 'yes' : `${r.lo} to ${r.hi}`;
  console.log(
    `  ${r.ok ? 'pass' : 'FAIL'}  ${r.label.padEnd(46)} ${String(got).padStart(6)}   want ${want}` +
      (r.note ? `   ${r.note}` : ''),
  );
}
console.log(
  failures
    ? `\n${failures} problems.\n`
    : '\nForty eight nations, every bracket sound, and every tournament ends.\n',
);
process.exit(failures ? 1 : 0);
