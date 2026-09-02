import { simulateSeason } from '../.headless/engine/index.js';
import { buildMatch } from '../.headless/game/commentary.js';
import { mulberry32 } from '../.headless/engine/rng.js';
import { newDraft, spin, place, canPlay, slotsForPlayer, chemBonus } from '../.headless/engine/draft.js';

const seed = 12345;
const rnd = mulberry32(seed);
let st = newDraft({ formation: '4-3-3', mode: 'squad', diff: 'normal', rtype: 'prime', eraFrom: 1992, eraTo: 2026, showRatings: true, blitz: false });
let guard = 0;
while (st.filled < st.total && guard++ < 500) {
  const r = spin(st, rnd);
  if (!r) break;
  const c = r.board.find((p) => canPlay(st, p));
  if (!c) continue;
  const slots = slotsForPlayer(st, c);
  if (!slots.length) continue;
  st = place(st, c, slots[0]);
}
const res = simulateSeason(st.squad, '4-3-3', chemBonus(st.squad), rnd);

let bad = 0;
let goalless = 0;
let evTotal = 0;
for (const m of res.matches) {
  const a = buildMatch(m, seed);
  const b = buildMatch(m, seed);
  if (JSON.stringify(a.events) !== JSON.stringify(b.events)) { console.log('NOT DETERMINISTIC md', m.n); bad++; }
  const ft = a.events[a.events.length - 1];
  if (ft.kind !== 'ft') { console.log('last event is not FT on md', m.n, ft.kind); bad++; }
  if (ft.me !== m.gf || ft.opp !== m.ga) { console.log('score mismatch md', m.n, ft.me, ft.opp, 'vs', m.gf, m.ga); bad++; }
  for (let i = 1; i < a.events.length; i++) if (a.events[i].min < a.events[i-1].min) { console.log('out of order md', m.n); bad++; break; }
  const ht = a.events.filter(e => e.kind === 'ht').length;
  if (ht !== 1) { console.log('half time count', ht, 'md', m.n); bad++; }
  if (m.gf + m.ga === 0) goalless++;
  evTotal += a.events.length;
  if (a.stats.onTarget[0] > a.stats.shots[0] || a.stats.onTarget[1] > a.stats.shots[1]) { console.log('on target > shots md', m.n); bad++; }
}
console.log('matches', res.matches.length, 'goalless', goalless, 'avg events', (evTotal / res.matches.length).toFixed(1));
const sample = buildMatch(res.matches[0], seed);
console.log('--- matchday 1 vs', res.matches[0].opp, res.matches[0].gf + '-' + res.matches[0].ga, '---');
for (const e of sample.events) console.log(String(e.min).padStart(3), e.kind.padEnd(8), e.text);
console.log('stats', JSON.stringify(sample.stats));
console.log(bad ? 'FAILURES: ' + bad : 'commentary checks pass');
const scored = res.matches.find((m) => m.gf >= 2 && m.ga >= 1);
if (scored) {
  const s2 = buildMatch(scored, seed);
  console.log('--- matchday', scored.n, 'vs', scored.opp, scored.gf + '-' + scored.ga, '---');
  for (const e of s2.events) console.log(String(e.min).padStart(3), e.kind.padEnd(8), (e.me + '-' + e.opp).padEnd(5), e.text);
}
