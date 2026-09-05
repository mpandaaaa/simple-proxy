/*
 * The leaderboard, attacked.
 *
 * A leaderboard that trusts the number a phone sends it is a text box.
 * The defence is that the server replays the run instead of reading it,
 * and this is the proof that the defence works.
 *
 * It plays real Daily puzzles end to end, submits them honestly, and
 * then submits every forgery worth trying: a better score, an easier
 * table, a player who was never offered, a player who does not exist, a
 * rating raised by hand, more rerolls than the rules allow, picks in a
 * different order, a slot a player cannot fill, and a run from a
 * different build.
 *
 * Every honest run has to be accepted, because rejecting one of those is
 * worse than letting a cheat through: it accuses somebody who did
 * nothing wrong, and they have no way to argue.
 *
 * Every forgery has to be refused, and refused for the right reason, so
 * that a real fault can never hide behind a rejection that happens to
 * come out the same way.
 */

import {
  ENGINE_VERSION,
  dailyFor,
  newDraft,
  place,
  spin,
  mulberry32,
  chemBonus,
  simulateSeason,
  verifySubmission,
} from '../.headless/engine/index.js';

let failures = 0;
const fail = (m) => {
  console.error('  FAIL ' + m);
  failures++;
};

/**
 * Play a puzzle the way somebody would: take the best player on every
 * board who fits a slot that is still empty.
 *
 * Greedy rather than clever on purpose. It has to be a run the engine
 * would really produce, not an optimal one.
 */
function play(n, { rerollAt = -1 } = {}) {
  const puzzle = dailyFor(n);
  const rnd = mulberry32(puzzle.seed);
  let state = newDraft(puzzle.config);
  const picks = [];

  for (let i = 0; i < state.total; i++) {
    let rerolls = 0;
    if (i === rerollAt && state.rerollsMax > 0) {
      spin(state, rnd);
      rerolls = 1;
    }

    const offered = spin(state, rnd);
    if (!offered) return null;

    /* the best legal pairing of a player on this board with an empty slot */
    let best = null;
    for (const cand of offered.board) {
      for (let s = 0; s < state.squad.length; s++) {
        if (state.squad[s].player) continue;
        const after = place(state, cand, s);
        if (after === state) continue;
        if (!best || cand.rtg > best.cand.rtg) best = { cand, slot: s, after };
      }
    }
    if (!best) return null;

    state = best.after;
    picks.push({ name: best.cand.n, slot: best.slot, rerolls });
  }

  const result = simulateSeason(
    state.squad,
    puzzle.config.formation,
    chemBonus(state.squad),
    rnd,
  );
  const you = result.table.find((r) => r.isYou);

  return {
    puzzle,
    state,
    submission: {
      board: 'daily-' + n,
      engine: ENGINE_VERSION,
      player: 'test-device',
      handle: 'Tester',
      picks,
      claim: { pts: you.pts, gf: you.gf, ga: you.ga },
    },
  };
}

const check = (run, sub) =>
  verifySubmission(sub, run.puzzle.seed, run.puzzle.config);

const clone = (x) => JSON.parse(JSON.stringify(x));

/* ---------------- honest runs are accepted ---------------- */

const DAYS = [1, 7, 42, 100, 365, 999, 1263, 2000, 5000];
const runs = [];

for (const n of DAYS) {
  const run = play(n);
  if (!run) {
    fail('day ' + n + ' could not be played at all');
    continue;
  }
  runs.push(run);
  const v = check(run, run.submission);
  if (!v.ok) {
    fail('an honest run of day ' + n + ' was refused: ' + v.why);
  } else if (v.pts !== run.submission.claim.pts) {
    fail('day ' + n + ' verified to a different score than it was played to');
  }
}

/* a run that spent a reroll, since rerolls move every later board */
for (const n of [42, 1263]) {
  const run = play(n, { rerollAt: 3 });
  if (!run) continue;
  const spent = run.submission.picks.reduce((a, p) => a + p.rerolls, 0);
  if (spent === 0) continue;
  runs.push(run);
  if (!check(run, run.submission).ok) {
    fail('an honest run of day ' + n + ' that spent a reroll was refused');
  }
}

if (!runs.length) {
  fail('no runs could be played, so nothing below proves anything');
  console.error('\n1 problems.\n');
  process.exit(1);
}

/* ---------------- and every forgery is refused ---------------- */

const base = runs[0];

const FORGERIES = [
  {
    what: 'claiming more points than the season gave',
    why: 'score',
    make: (s) => { s.claim.pts += 1; return s; },
  },
  {
    what: 'claiming a hatful more goals',
    why: 'score',
    make: (s) => { s.claim.gf += 40; return s; },
  },
  {
    what: 'claiming a tighter defence',
    why: 'score',
    make: (s) => { s.claim.ga = 0; return s; },
  },
  {
    what: 'a player who was never on that board',
    why: 'not offered',
    make: (s) => { s.picks[5].name = 'Thierry Henry'; return s; },
  },
  {
    what: 'a player who does not exist at all',
    why: 'not offered',
    make: (s) => { s.picks[2].name = 'Nobody At All'; return s; },
  },
  {
    what: 'the picks made in a different order',
    why: null,
    make: (s) => { const t = s.picks[1]; s.picks[1] = s.picks[9]; s.picks[9] = t; return s; },
  },
  {
    what: 'more rerolls than the rules allow',
    why: 'rerolls',
    make: (s) => { s.picks[0].rerolls = 99; return s; },
  },
  {
    what: 'a twelfth pick',
    why: 'shape',
    make: (s) => { s.picks.push({ ...s.picks[0] }); return s; },
  },
  {
    what: 'one pick short',
    why: 'shape',
    make: (s) => { s.picks.pop(); return s; },
  },
  {
    what: 'no picks at all',
    why: 'shape',
    make: (s) => { s.picks = []; return s; },
  },
  {
    what: 'two players into the same slot',
    why: null,
    make: (s) => { s.picks[4].slot = s.picks[3].slot; return s; },
  },
  {
    what: 'a slot that does not exist',
    why: 'illegal slot',
    make: (s) => { s.picks[6].slot = 99; return s; },
  },
  {
    what: 'a run from a different build',
    why: 'engine',
    make: (s) => { s.engine = ENGINE_VERSION + 1; return s; },
  },
  {
    what: 'a run claiming to be from an older build',
    why: 'engine',
    make: (s) => { s.engine = 0; return s; },
  },
  {
    what: 'picks that are not a list',
    why: 'shape',
    make: (s) => { s.picks = 'eleven'; return s; },
  },
];

let refused = 0;
for (const f of FORGERIES) {
  const sub = f.make(clone(base.submission));
  let v;
  try {
    v = check(base, sub);
  } catch (e) {
    fail(f.what + ' made the verifier throw rather than refuse: ' + e.message);
    continue;
  }
  if (v.ok) {
    fail(f.what + ' was ACCEPTED. The board can be forged this way.');
    continue;
  }
  if (f.why && v.why !== f.why) {
    fail(f.what + ' was refused as "' + v.why + '" rather than "' + f.why +
      '". The right thing happened for the wrong reason, which hides real faults.');
    continue;
  }
  refused++;
}

/* ---------------- a forged rating buys nothing ---------------- */
/*
 * The submission carries no ratings at all, on purpose: the server finds
 * each player on the board it deals itself. This proves the shape has
 * not quietly grown a field that could be trusted.
 */
{
  const sub = clone(base.submission);
  for (const p of sub.picks) p.rtg = 99;
  const v = check(base, sub);
  if (!v.ok) {
    fail('adding a rating to every pick changed the verdict, so a rating from a phone is being read somewhere');
  }
}

/* ---------------- the same run twice gives the same answer ---------------- */
{
  const a = check(base, base.submission);
  const b = check(base, base.submission);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail('verifying the same run twice gave two different answers');
  }
}

/* ---------------- and a run cannot be moved to another day ---------------- */
{
  if (runs.length > 1) {
    const other = runs[1];
    const v = verifySubmission(base.submission, other.puzzle.seed, other.puzzle.config);
    if (v.ok) {
      fail("yesterday's run was accepted for today. A good run could be replayed every day.");
    }
  }
}


/* ---------------- the server's copy of the engine is current ---------------- */
/*
 * The whole defence rests on the server checking a run with the same
 * code that played it. If the bundle under supabase/functions/_engine is
 * older than src/engine, the server is checking against a different
 * engine, and the first thing that happens is honest runs being refused
 * for a score they really got.
 *
 * Compared by modification time rather than content, because the bundle
 * is compiled and will never match the source character for character.
 */
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const OUT = path.join('supabase', 'functions', '_engine');

  if (!fs.existsSync(OUT)) {
    fail('the server has no copy of the engine. Run npm run edge.');
  } else {
    const newest = (dir) => {
      let t = 0;
      for (const n of fs.readdirSync(dir)) {
        const p = path.join(dir, n);
        const st = fs.statSync(p);
        t = Math.max(t, st.isDirectory() ? newest(p) : st.mtimeMs);
      }
      return t;
    };
    const src = Math.max(newest('src/engine'), newest('src/data'));
    const built = newest(OUT);
    if (built < src) {
      const behind = Math.round((src - built) / 1000);
      fail(
        'the server copy of the engine is ' + behind + ' seconds behind src. ' +
        'Run npm run edge, or it will refuse runs that were honestly played.',
      );
    }
  }
}

if (failures) {
  console.error('\n' + failures + ' problems.\n');
  process.exit(1);
}

console.log(`
The leaderboard cannot be forged
  ${runs.length} real runs played and submitted, every one accepted
  ${refused} forgeries refused, each for its own reason
  a rating sent from a phone changes nothing, because none is read
  a run from one day is refused on another
  and the same run always gets the same answer
`);
