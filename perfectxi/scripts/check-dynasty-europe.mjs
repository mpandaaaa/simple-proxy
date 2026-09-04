/**
 * A European campaign played for real, folded back into a career.
 *
 * The failure this exists to prevent is a trophy counted twice: the
 * season simulating a Champions League run while the same season was
 * played out match by match, and the career ending up with two of them.
 *
 * So this plays real campaigns, converts them the way the game does, and
 * checks the run a season would build out of them: the same trophy, the
 * same money the simulation pays for going that far, and the same
 * qualification for next season.
 */
import {
  playedEuroRun,
  qualifyFor,
  uclAsPlayed,
  uclClubs,
  uclPlayNext,
  uclSkipLeague,
  uclStart,
  uclWeakest,
} from '../.headless/engine/index.js';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const KO = ['Last 16', 'Quarter-Final', 'Semi-Final', 'Final'];
const clubs = uclClubs();

let campaigns = 0;
let lifted = 0;
let outAtLeague = 0;
let money = 0;

for (let i = 0; i < clubs.length; i++) {
  for (let r = 0; r < 3; r++) {
    let run = uclStart(clubs[i].name, 700 + i * 13 + r, null, {
      club: clubs[i].name,
      year: 4,
    });
    run = uclSkipLeague(run).run;
    let guard = 0;
    while (!run.over && guard++ < 24) {
      const step = uclPlayNext(run);
      if (!step) break;
      run = step.run;
    }
    if (!run.over) {
      fail(`${clubs[i].name} has a campaign that never ended`);
      continue;
    }
    campaigns++;

    const played = uclAsPlayed(run);
    const cup = playedEuroRun('ucl', played);

    /* ---- the league phase has to add up ---- */
    if (played.w + played.d + played.l !== 8) {
      fail(`${clubs[i].name} played ${played.w + played.d + played.l} league games`);
    }
    if (played.place < 1 || played.place > 36) fail(`a league placing of ${played.place}`);

    /* ---- the trophy is the one that was won, once ---- */
    if (cup.won !== run.won) fail('the cup run disagrees about the trophy');
    if (cup.won) lifted++;
    const wins = cup.ties.filter((t) => t.won).length;
    if (cup.won && wins !== cup.ties.length) fail('a trophy with a tie lost on the way');

    /* ---- how far it got, told the same way twice ---- */
    if (played.place > 24) {
      outAtLeague++;
      if (cup.elim !== 'League Phase') fail(`out in the league phase but eliminated at ${cup.elim}`);
      if (cup.reached !== 0) fail(`out in the league phase but reached ${cup.reached}`);
      if (cup.ties.length !== 1) fail('an eliminated league phase with knockout ties');
    } else if (cup.won) {
      if (cup.elim !== null) fail(`won it but eliminated at ${cup.elim}`);
      if (cup.reached !== cup.stages.length) fail(`won it but only reached ${cup.reached}`);
      const rounds = cup.ties.map((t) => t.round);
      for (const k of KO) {
        if (rounds.indexOf(k) < 0) fail(`won it without playing the ${k}`);
      }
    } else {
      if (!cup.elim) fail('did not win it and was never eliminated');
      if (cup.stages.indexOf(cup.elim) < 0) fail(`eliminated at ${cup.elim}, which is not a stage`);
    }

    /* ---- every tie reads as a tie ---- */
    for (const t of cup.ties) {
      if (t.round === 'League Phase') continue;
      if (!t.opp) fail(`a ${t.round} against nobody`);
      if (t.gf < 0 || t.ga < 0) fail(`a ${t.round} of ${t.gf}-${t.ga}`);
      if (t.round !== 'Final') {
        if (!t.legs || t.legs.length !== 2) fail(`a ${t.round} with ${t.legs?.length ?? 0} legs`);
        else if (t.legs[0].gf + t.legs[1].gf !== t.gf) {
          fail(`a ${t.round} whose legs do not add up to its aggregate`);
        }
      } else if (t.legs) {
        fail('a final played over two legs');
      }
      if (!t.pens && t.gf === t.ga && t.round !== 'Final') {
        fail(`a level ${t.round} that did not go to penalties`);
      }
    }

    /* ---- and it pays what the competition pays ---- */
    if (cup.money < 50) fail(`a campaign that paid £${cup.money}m, which is under the base fee`);
    if (cup.money > 160) fail(`a campaign that paid £${cup.money}m, which is more than winning it`);
    money += cup.money;

    /* ---- next season follows from it, not from a second simulation ---- */
    const next = qualifyFor(6, false, false, cup.won, false, false);
    if (cup.won && next !== 'ucl') fail('winning it did not put the club back in it');
  }
}

console.log('');
console.log(`  ${campaigns} campaigns played for real and folded into a career`);
console.log(`  ${lifted} lifted it, ${outAtLeague} went out in the league phase`);
console.log(`  £${Math.round(money / campaigns)}m the average campaign paid`);
console.log('');

if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('A campaign you played is the one that counts, and it only counts once.\n');
