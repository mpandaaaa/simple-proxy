/**
 * Everything the tournament screens read, across runs they actually play.
 *
 * The same idea as check-screens, pointed at the two tournaments. Almost
 * every bug that has reached a phone in this project has been a screen
 * handed a NaN, an undefined, a negative where there cannot be one, or a
 * name it has nothing to show for. So this plays World Cups and European
 * campaigns and walks every field the five screens touch, every match.
 */
import {
  STAGE_NAME,
  UCL_MATCHDAYS,
  UCL_STAGE_NAME,
  flagIn,
  goldenBoot,
  goldenGlove,
  groupOf,
  nameIn,
  ratingIn,
  squadIn,
  uclClub,
  uclClubs,
  uclGoldenBoot,
  uclNameOf,
  uclPlayNext,
  uclPosition,
  uclRatingOf,
  uclScorers,
  uclSkipLeague,
  uclSquadOf,
  uclStart,
  uclSummary,
  uclVerdict,
  uclWeakest,
  uclXiRating,
  uclDraftSquad,
  uclDraftStart,
  uclBoard,
  uclSlotsFor,
  uclDraftPlace,
  uclDraftDone,
  wcCustomSquad,
  wcDraftStart,
  wcBoard,
  wcSlotsFor,
  wcPlace,
  wcDraftDone,
  wcXiRating,
  wcNations,
  wcPlayNext,
  wcScorers,
  wcStart,
  wcSummary,
  wcTeam,
  wcVerdict,
  wcWeakest,
} from '../.headless/engine/index.js';
import { buildTournament } from '../.headless/game/tournamentMatch.js';

let bad = 0;
const seen = new Set();
const fail = (m) => {
  /* One of each, or a broken field prints six hundred times. */
  if (seen.has(m)) return;
  seen.add(m);
  console.log('  ' + m);
  bad++;
};

const num = (v, what, { min = -Infinity, max = Infinity } = {}) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fail(`${what} is ${v}`);
  if (v < min || v > max) return fail(`${what} is ${v}, outside ${min} to ${max}`);
};

const str = (v, what) => {
  if (typeof v !== 'string' || !v.trim()) fail(`${what} is ${JSON.stringify(v)}`);
};

/* ---------- a drafted XI, the way the game builds one ---------- */

function draftWorldXi(seed) {
  let st = wcDraftStart('4-3-3', seed);
  let guard = 0;
  while (!wcDraftDone(st) && guard++ < 30) {
    const board = wcBoard(st);
    const ok = board.map((p) => ({ p, sl: wcSlotsFor(st, p) })).find((x) => x.sl.length);
    if (!ok) break;
    st = wcPlace(st, ok.p, ok.sl[0]);
  }
  return wcDraftDone(st) ? st : null;
}

function draftChampionsXi(seed) {
  let st = uclDraftStart('4-3-3', seed);
  let guard = 0;
  while (!uclDraftDone(st) && guard++ < 30) {
    const board = uclBoard(st);
    const ok = board.map((p) => ({ p, sl: uclSlotsFor(st, p) })).find((x) => x.sl.length);
    if (!ok) break;
    st = uclDraftPlace(st, ok.p, ok.sl[0]);
  }
  return uclDraftDone(st) ? st : null;
}

/* ---------- the World Cup screens ---------- */

const nations = wcNations();
let wcMatches = 0;

function walkWorldCup(run, label) {
  /* The hub: who you are, the rail, the group table, the fixture. */
  str(nameIn(run, run.you), `${label} name`);
  str(flagIn(run, run.you), `${label} flag`);
  num(ratingIn(run, run.you), `${label} rating`, { min: 40, max: 99 });
  if (!squadIn(run, run.you).length) fail(`${label} has no squad`);

  str(STAGE_NAME[run.stage], `${label} stage name`);
  if (run.outAt !== null && !STAGE_NAME[run.outAt]) fail(`${label} went out at ${run.outAt}`);

  const letter = wcTeam(run.you)?.g;
  if (!letter || groupOf(letter).length !== 4) fail(`${label} is in a group of ${groupOf(letter ?? 'A').length}`);

  let played = -1;
  for (const row of run.table) {
    str(wcTeam(row.code)?.n ?? '', `${label} table row`);
    num(row.p, `${label} row played`, { min: 0, max: 3 });
    num(row.pts, `${label} row points`, { min: 0, max: 9 });
    if (row.w + row.d + row.l !== row.p) fail(`${label} row does not add up`);
    if (row.pts !== row.w * 3 + row.d) fail(`${label} row points do not match its results`);
    if (played < 0) played = row.p;
    else if (row.p !== played) fail(`${label} table has clubs on ${played} and ${row.p} games`);
  }

  for (const m of run.played) {
    num(m.ga, `${label} goals for`, { min: 0, max: 15 });
    num(m.gb, `${label} goals against`, { min: 0, max: 15 });
    str(wcTeam(m.b)?.n ?? '', `${label} opponent name`);
    if (typeof m.ga90 === 'number' && m.ga90 > m.ga) fail(`${label} scored fewer by the end than at ninety`);
    if (m.pens && m.ga !== m.gb) fail(`${label} went to penalties from ${m.ga}-${m.gb}`);
  }
  for (const f of run.ahead) {
    if (f.a !== run.you) fail(`${label} has a fixture that is not its own`);
    str(wcTeam(f.b)?.n ?? '', `${label} upcoming opponent`);
  }

  /* The report. */
  const sum = wcSummary(run);
  num(sum.w, `${label} wins`, { min: 0, max: 7 });
  num(sum.gf, `${label} scored`, { min: 0 });
  if (sum.w + sum.d + sum.l !== sum.played) fail(`${label} record does not add up`);
  if (sum.played !== run.played.length) fail(`${label} played count disagrees with its matches`);
  for (const s of wcScorers(run)) {
    str(s.n, `${label} scorer`);
    num(s.g, `${label} scorer goals`, { min: 0, max: 20 });
  }
  const boot = goldenBoot(run);
  const glove = goldenGlove(run);
  if (run.over) {
    str(boot.n, `${label} golden boot`);
    str(glove.n, `${label} golden glove`);
    num(boot.goals, `${label} boot goals`, { min: 0, max: 30 });
    num(glove.cleanSheets, `${label} glove clean sheets`, { min: 0, max: 12 });
    const v = wcVerdict(run);
    if (v !== 'over' && v !== 'met' && v !== 'under') fail(`${label} verdict is ${v}`);
  }
}

for (let i = 0; i < nations.length; i++) {
  const custom =
    i % 7 === 0
      ? (() => {
          const st = draftWorldXi(3000 + i);
          return st
            ? {
                name: 'Your World XI',
                flag: '\u{1F30D}',
                rating: wcXiRating(st),
                squad: wcCustomSquad(st),
              }
            : null;
        })()
      : null;

  let run = wcStart(custom ? wcWeakest() : nations[i].code, 2000 + i, custom);
  walkWorldCup(run, `${nations[i].code} start`);

  let guard = 0;
  while (!run.over && guard++ < 12) {
    const step = wcPlayNext(run);
    if (!step) break;
    run = step.run;
    wcMatches++;

    /* The match screen: the broadcast it is handed. */
    const m = step.match;
    const tape = buildTournament({
      seed: run.seed,
      n: run.played.length - 1,
      comp: STAGE_NAME[m.stage],
      me: { name: nameIn(run, m.a), rating: ratingIn(run, m.a), squad: squadIn(run, m.a) },
      opp: { name: nameIn(run, m.b), rating: ratingIn(run, m.b), squad: squadIn(run, m.b) },
      gf: m.ga,
      ga: m.gb,
      gf90: typeof m.ga90 === 'number' ? m.ga90 : m.ga,
      ga90: typeof m.gb90 === 'number' ? m.gb90 : m.gb,
      et: Boolean(m.et),
      pens: m.pens,
      scorers: step.scorers,
    });
    num(tape.full, 'broadcast length', { min: 90, max: 120 });
    if (tape.momentum.length !== tape.full + 1) fail('broadcast momentum is the wrong length');
    for (const e of tape.events) str(e.text, 'a line of commentary');

    walkWorldCup(run, `${nations[i].code} after ${m.stage}`);
  }
  if (!run.over) fail(`${nations[i].code} has a run that never ended`);
}

console.log('');
console.log(`  ${nations.length} World Cups, ${wcMatches} matches, every field a screen reads`);

/* ---------- the Champions League screens ---------- */

const clubs = uclClubs();
let uclMatches = 0;

function walkUcl(run, label) {
  str(uclNameOf(run, run.you), `${label} name`);
  num(uclRatingOf(run, run.you), `${label} rating`, { min: 40, max: 99 });
  if (!uclSquadOf(run, run.you).length) fail(`${label} has no squad`);
  str(UCL_STAGE_NAME[run.stage], `${label} stage name`);
  num(uclPosition(run), `${label} position`, { min: 1, max: 36 });
  if (!run.custom && !uclClub(run.you)) fail(`${label} is a club the database does not have`);

  if (run.table.length !== 36) fail(`${label} table holds ${run.table.length}`);
  let played = -1;
  let pts = 0;
  let gf = 0;
  let ga = 0;
  for (const row of run.table) {
    str(uclNameOf(run, row.club), `${label} table row`);
    num(row.p, `${label} row played`, { min: 0, max: UCL_MATCHDAYS });
    if (row.w + row.d + row.l !== row.p) fail(`${label} row does not add up`);
    if (row.pts !== row.w * 3 + row.d) fail(`${label} row points do not match its results`);
    if (played < 0) played = row.p;
    else if (row.p !== played) fail(`${label} table has clubs on ${played} and ${row.p} games`);
    pts += row.pts;
    gf += row.gf;
    ga += row.ga;
  }
  if (gf !== ga) fail(`${label} table has ${gf} scored and ${ga} conceded`);
  num(pts, `${label} points handed out`, { min: 0, max: 18 * UCL_MATCHDAYS * 3 });

  for (const m of run.played) {
    num(m.ga, `${label} goals for`, { min: 0, max: 15 });
    num(m.gb, `${label} goals against`, { min: 0, max: 15 });
    str(m.b, `${label} opponent`);
    if (m.stage === 'league' && (m.n < 0 || m.n >= UCL_MATCHDAYS)) {
      fail(`${label} has a league match on matchday ${m.n + 1}`);
    }
    if (m.stage !== 'league' && m.stage !== 'final' && m.n !== 1 && m.n !== 2) {
      fail(`${label} has a tie leg ${m.n}`);
    }
    if (m.agg) {
      num(m.agg.a, `${label} aggregate`, { min: 0, max: 30 });
      num(m.agg.b, `${label} aggregate`, { min: 0, max: 30 });
    }
  }
  for (const f of run.ahead) {
    if (f.a !== run.you) fail(`${label} has a fixture that is not its own`);
    str(f.b, `${label} upcoming opponent`);
    if (f.b === run.you) fail(`${label} is drawn against itself`);
  }

  const sum = uclSummary(run);
  if (sum.w + sum.d + sum.l !== sum.played) fail(`${label} record does not add up`);
  if (sum.played !== run.played.length) fail(`${label} played count disagrees with its matches`);
  for (const s of uclScorers(run)) {
    str(s.n, `${label} scorer`);
    num(s.g, `${label} scorer goals`, { min: 0, max: 25 });
  }
  if (run.over) {
    const boot = uclGoldenBoot(run);
    str(boot.n, `${label} top scorer`);
    num(boot.goals, `${label} top scorer goals`, { min: 0, max: 30 });
    const v = uclVerdict(run);
    if (v !== 'over' && v !== 'met' && v !== 'under') fail(`${label} verdict is ${v}`);
    if (run.order.length !== 36) fail(`${label} finished with an order of ${run.order.length}`);
  }
}

for (let i = 0; i < clubs.length; i++) {
  const custom =
    i % 9 === 0
      ? (() => {
          const st = draftChampionsXi(4000 + i);
          return st
            ? { name: 'Your Champions XI', rating: uclXiRating(st), squad: uclDraftSquad(st) }
            : null;
        })()
      : null;

  let run = uclStart(custom ? uclWeakest() : clubs[i].name, 5000 + i, custom);
  walkUcl(run, `${clubs[i].name} start`);

  /* Half of them watch the league phase, half of them skip it, because
     both are things somebody will do. */
  if (i % 2 === 0) {
    run = uclSkipLeague(run).run;
    walkUcl(run, `${clubs[i].name} skipped`);
  }

  let guard = 0;
  while (!run.over && guard++ < 24) {
    const step = uclPlayNext(run);
    if (!step) break;
    run = step.run;
    uclMatches++;

    const m = step.match;
    const tape = buildTournament({
      seed: run.seed,
      n: run.played.length - 1,
      comp: UCL_STAGE_NAME[m.stage],
      me: { name: uclNameOf(run, m.a), rating: uclRatingOf(run, m.a), squad: uclSquadOf(run, m.a) },
      opp: { name: uclNameOf(run, m.b), rating: uclRatingOf(run, m.b), squad: uclSquadOf(run, m.b) },
      gf: m.ga,
      ga: m.gb,
      gf90: typeof m.ga90 === 'number' ? m.ga90 : m.ga,
      ga90: typeof m.gb90 === 'number' ? m.gb90 : m.gb,
      et: Boolean(m.et),
      pens: m.pens,
      scorers: step.scorers,
    });
    num(tape.full, 'broadcast length', { min: 90, max: 120 });
    for (const e of tape.events) str(e.text, 'a line of commentary');

    walkUcl(run, `${clubs[i].name} after ${m.stage}`);
  }
  if (!run.over) fail(`${clubs[i].name} has a campaign that never ended`);
}

console.log(`  ${clubs.length} campaigns, ${uclMatches} matches, every field a screen reads`);
console.log('');

if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('Nothing a tournament screen reads is ever missing, negative or nonsense.\n');
