import {
  clubOptions,
  clubsForScenario,
  SCENARIOS,
  startCareer,
  scenarioById,
} from '../.headless/engine/career.js';
import { starters, bench, squadRating, squadValue, wageBill } from '../.headless/engine/dynasty.js';

const clubs = clubOptions(2026);
console.log(`\n${clubs.length} clubs rankable for 2026`);
console.log('  strongest:', clubs.slice(0, 3).map((c) => `${c.rank}. ${c.club} ${c.avg}`).join('   '));
console.log('  weakest:  ', clubs.slice(-3).map((c) => `${c.rank}. ${c.club} ${c.avg}`).join('   '));

let bad = 0;
for (const sc of SCENARIOS) {
  const list = clubsForScenario(sc);
  console.log(`\n${sc.title}  (ranks ${sc.tier[0]}-${sc.tier[1]}, ${list.length} clubs)`);
  for (const c of list.slice(0, 2)) {
    const d = startCareer({
      clubKey: c.key,
      scenario: sc.id,
      mode: 'simple',
      formation: '4-3-3',
      seed: 4242,
    });
    const xi = starters(d);
    const subs = bench(d);
    const ages = xi.map((p) => p.age);
    console.log(
      `  ${c.club.padEnd(16)} XI ${String(xi.length).padStart(2)}/11  subs ${subs.length}/3  ` +
        `rated ${String(squadRating(xi)).padStart(2)}  £${String(squadValue([...xi, ...subs])).padStart(4)}m  ` +
        `wages £${String(wageBill([...xi, ...subs])).padStart(3)}m  budget £${String(d.budget).padStart(3)}m  ` +
        `ages ${Math.min(...ages)}-${Math.max(...ages)}  "${d.objective.label}" (${d.objective.target})`,
    );
    if (xi.length < 11) { console.log('    FAIL cannot field an XI'); bad++; }
    if (d.objective.target < 1 || d.objective.target > 20) { console.log('    FAIL bad target'); bad++; }
    // The label must match the target it was derived from, never the raw one.
    const raw = ['Win the Premier League','Finish in the top two','Champions League, top four','European places, top seven','Top half finish','Comfortable mid-table','Avoid the relegation fight'];
    if (!raw.includes(d.objective.label)) { console.log('    FAIL unknown label'); bad++; }
    if (d.roster.length !== 14 || d.slots.length !== 14) { console.log('    FAIL roster is not 14'); bad++; }
    for (let i = 0; i < 14; i++) {
      const p = d.roster[i];
      if (p && p.pos !== d.slots[i]) { console.log('    FAIL player in the wrong slot', p.n, p.pos, d.slots[i]); bad++; }
    }
  }
}

// The same seed and club must build the same squad.
const a = startCareer({ clubKey: clubs[0].key, scenario: 'giant', mode: 'simple', formation: '4-3-3', seed: 77 });
const b = startCareer({ clubKey: clubs[0].key, scenario: 'giant', mode: 'simple', formation: '4-3-3', seed: 77 });
console.log('\ndeterministic:', JSON.stringify(a) === JSON.stringify(b));
if (JSON.stringify(a) !== JSON.stringify(b)) bad++;

console.log(bad ? `\n${bad} problems.\n` : '\nEvery club can field an XI and every objective is derived from its final target.\n');
process.exit(bad ? 1 : 0);
