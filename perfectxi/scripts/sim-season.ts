/**
 * Phase 2 proof: draft a realistic XI from the real database, play a full
 * season through the ported engine, and print it.
 *
 *   npm run sim            a random run
 *   npm run sim -- 2026    a specific seed, reproducible
 */
import { mulberry32 } from '../src/engine/rng';
import { simulateSeason } from '../src/engine/season';
import { calcOdds, squadAvg, squadChemistry } from '../src/engine/strength';
import { ENGINE_VERSION, ENGINE_SOURCE_BUILD } from '../src/engine/version';
import { draftXI } from '../tests/helpers/squads';

const seed = Number(process.argv[2] ?? Math.floor(Math.random() * 2 ** 31));
const formation = '4-3-3';
const rnd = mulberry32(seed);
const squad = draftXI(rnd, formation);
const odds = calcOdds(squadAvg(squad), squad);
const r = simulateSeason({ squad, formation, rnd });

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);

console.log(`\nPERFECT XI  engine v${ENGINE_VERSION} (web ${ENGINE_SOURCE_BUILD})  seed ${seed}\n`);
console.log(`YOUR XI  ${formation}  average ${squadAvg(squad).toFixed(1)}  chemistry ${squadChemistry(squad)}`);
for (const s of squad) {
  const p = s.player!;
  console.log(`  ${pad(s.pos, 4)}${pad(p.n, 26)}${lpad(p.rtg, 3)}   ${p.club} ${p.season}`);
}
console.log(`\nPre-season: projected ${odds.projFinish}th, ${odds.expPts} pts, title ${odds.winPct}%, top four ${odds.top4}%\n`);

console.log(`${lpad('', 3)} ${pad('Club', 16)}${lpad('P', 3)}${lpad('W', 4)}${lpad('D', 4)}${lpad('L', 4)}${lpad('GF', 5)}${lpad('GA', 5)}${lpad('GD', 5)}${lpad('Pts', 5)}`);
r.table.forEach((t, i) => {
  const gd = t.gf - t.ga;
  const line = `${lpad(i + 1, 3)} ${pad(t.name, 16)}${lpad(38, 3)}${lpad(t.w, 4)}${lpad(t.d, 4)}${lpad(t.l, 4)}${lpad(t.gf, 5)}${lpad(t.ga, 5)}${lpad((gd > 0 ? '+' : '') + gd, 5)}${lpad(t.pts, 5)}`;
  console.log(t.isYou ? `${line}   <` : line);
});

const scorers = Object.entries(r.playerStats).sort((a, b) => b[1].g - a[1].g || b[1].a - a[1].a).slice(0, 5);
console.log(`\nYou finished ${r.finish}${['st', 'nd', 'rd'][r.finish - 1] ?? 'th'} with ${r.pts} points.`);
console.log(`Goals per game in your matches: ${((r.gf + r.ga) / 38).toFixed(2)}.  Clean sheets: ${r.cleanSheets}.  Longest winning run: ${r.longestStreak}.`);
if (r.biggestWin) console.log(`Biggest win: ${r.biggestWin.gf}-${r.biggestWin.ga}.`);
console.log(`xG ${r.xgF.toFixed(1)} for, ${r.xgA.toFixed(1)} against.`);
console.log(`\nTop scorers:`);
for (const [n, s] of scorers) console.log(`  ${pad(n, 26)}${lpad(s.g, 3)} goals ${lpad(s.a, 3)} assists`);
console.log('');
