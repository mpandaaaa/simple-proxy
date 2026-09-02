import { simulateCups } from '../.headless/engine/cups.js';

let natWins = 0, contWins = 0, doubles = 0, trebles = 0, qualified = 0;
const N = 4000;
for (let i = 0; i < N; i++) {
  const c = simulateCups(89, 1, i * 7919 + 3);
  if (c.national.won) natWins++;
  if (c.continental.won) contWins++;
  if (c.double) doubles++;
  if (c.treble) trebles++;
  if (c.continental.qualified) qualified++;
}
console.log('avg 89, champions:');
console.log('  national cup won   ', (natWins / N * 100).toFixed(1) + '%');
console.log('  continental won    ', (contWins / N * 100).toFixed(1) + '%');
console.log('  double             ', (doubles / N * 100).toFixed(1) + '%');
console.log('  treble             ', (trebles / N * 100).toFixed(1) + '%');

let nat2 = 0;
for (let i = 0; i < N; i++) if (simulateCups(76, 12, i * 104729 + 11).national.won) nat2++;
console.log('avg 76, 12th: national cup won', (nat2 / N * 100).toFixed(1) + '%');

const a = simulateCups(89, 2, 12345), b = simulateCups(89, 2, 12345);
console.log('deterministic:', JSON.stringify(a) === JSON.stringify(b));
const s = simulateCups(91, 1, 999);
console.log('--- sample, avg 91 champions ---');
for (const t of s.national.ties) console.log('  NAT', t.round.padEnd(14), (t.opp||'').padEnd(16), t.detail ?? t.gf + '-' + t.ga, t.won ? 'W' : 'L');
console.log('  national:', s.national.won ? 'WINNERS' : 'out in ' + s.national.elim);
for (const t of s.continental.ties) console.log('  CON', t.round.padEnd(14), (t.opp||'').padEnd(16), t.detail ?? t.gf + '-' + t.ga, t.won ? 'W' : 'L');
console.log('  continental:', s.continental.won ? 'WINNERS' : 'out in ' + s.continental.elim);
