/**
 * Phase 2 proof: draft an eleven and play a season, with no phone involved.
 *
 * If this prints a believable table then the engine and the database are
 * correct on their own, before a single pixel is drawn. That is the whole
 * point of keeping src/engine and src/data free of React: they can be run
 * here, and later inside a server function to re-check a submitted run.
 *
 *   npm run sim            one season, printed in full
 *   npm run sim -- 7       one season from seed 7
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = require(resolve(root, '.headless/engine/index.js'));

const {
  ENGINE_VERSION,
  mulberry32,
  defaultConfig,
  newDraft,
  spin,
  place,
  slotsForPlayer,
  canPlay,
  squadAvg,
  squadChem,
  chemBonus,
  simulateSeason,
} = engine;

const seed = Number(process.argv[2] ?? 1);
const rnd = mulberry32(seed);

/** Draft greedily: spin, take the best player who fits, repeat. */
function draftXI() {
  let state = newDraft({ ...defaultConfig });
  let spins = 0;

  while (state.filled < state.total) {
    const result = spin(state, rnd);
    spins++;
    if (!result) throw new Error('no clubs in the selected era');

    const pick = result.board.find((p) => canPlay(state, p));
    if (!pick) continue; // nobody on this board fits what is left

    const slots = slotsForPlayer(state, pick);
    state = place(state, pick, slots[0]);
    const slot = state.squad[slots[0]];
    console.log(
      `  ${String(state.filled).padStart(2)}. ${slot.pos.padEnd(3)} ` +
        `${pick.n.padEnd(24)} ${String(pick.rtg).padStart(2)}  ` +
        `${pick.club} ${pick.season}`,
    );
  }
  return { state, spins };
}

console.log(`Perfect XI engine v${ENGINE_VERSION}, seed ${seed}\n`);
console.log('DRAFT');
const { state, spins } = draftXI();

const avg = squadAvg(state.squad);
const chem = squadChem(state.squad);
console.log(
  `\n  ${spins} spins · average ${avg.toFixed(1)} · chemistry ${chem}%` +
    ` (worth +${chemBonus(state.squad).toFixed(2)})\n`,
);

const season = simulateSeason(
  state.squad,
  state.config.formation,
  chemBonus(state.squad),
  rnd,
);

console.log('TABLE');
console.log('    ' + 'Team'.padEnd(16) + ' Pld   W   D   L   GF   GA   GD  Pts');
season.table.forEach((r, i) => {
  const gd = r.gf - r.ga;
  console.log(
    (r.isYou ? ' >' : '  ') +
      String(i + 1).padStart(2) +
      ' ' +
      r.name.padEnd(16) +
      String(r.w + r.d + r.l).padStart(4) +
      String(r.w).padStart(4) +
      String(r.d).padStart(4) +
      String(r.l).padStart(4) +
      String(r.gf).padStart(5) +
      String(r.ga).padStart(5) +
      (gd > 0 ? '+' : '') + String(gd).padStart(gd > 0 ? 4 : 5) +
      String(r.pts).padStart(5),
  );
});

const scorers = Object.entries(season.playerStats)
  .sort((a, b) => b[1].g - a[1].g)
  .slice(0, 5);

console.log(`\nSEASON`);
console.log(`  finished    ${season.position} of 20, grade ${season.grade}`);
console.log(`  record      ${season.wins}W ${season.draws}D ${season.losses}L, ${season.pts} pts`);
console.log(`  goals       ${season.gf} for, ${season.ga} against`);
console.log(`  expected    ${season.xgF} for, ${season.xgA} against`);
console.log(`  clean sheets ${season.cleanSheets}, best run ${season.longestStreak} wins`);
console.log(`  biggest win ${season.biggestWin ?? 'none'}`);
console.log('\nTOP SCORERS');
for (const [name, s] of scorers) {
  console.log(`  ${name.padEnd(24)} ${String(s.g).padStart(2)} goals, ${s.a} assists`);
}

// A season that does not add up is a bug in the engine, not a bad run.
const played = season.wins + season.draws + season.losses;
if (played !== 38) throw new Error(`played ${played} games, expected 38`);
if (season.pts !== season.wins * 3 + season.draws) {
  throw new Error('points do not match the results');
}
const scored = season.matches.reduce((n, m) => n + m.gf, 0);
if (scored !== season.gf) throw new Error('goals do not match the match list');
console.log('\nchecks passed: 38 games, points and goals reconcile.');
