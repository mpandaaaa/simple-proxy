import { useSyncExternalStore } from 'react';
import { showBreak } from './ads';
import { uclStore } from '../save';
import { awardUcl } from './award';
import {
  everyone,
  starters,
  squadRating,
  uclClub,
  uclAsPlayed,
  uclPlayNext,
  uclSkipLeague,
  uclStart,
  uclWeakest,
  type Dynasty,
  type UclCustom,
  type UclMatch,
  type UclPlayed,
  type UclRun,
} from '../engine';
import { getCareer, updateCareer } from './career';

/**
 * The Champions League campaign in progress, shared by its screens.
 *
 * Same shape as the World Cup: one copy held outside React, written
 * through to storage on every change, and every screen subscribing to it.
 * Five screens read the same campaign, and five screens each reading the
 * save on mount is how one of them ends up showing yesterday's table.
 */

let current: UclRun | null = uclStore.read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function snapshot(): UclRun | null {
  return current;
}

export function useUcl(): UclRun | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function getUcl(): UclRun | null {
  return current;
}

export function setUcl(run: UclRun | null): void {
  current = run;
  uclStore.write(run);
  emit();
}

/**
 * Begin one. Replaces whatever was there, which the screen confirms first.
 *
 * With a drafted XI, the club is the place in the league phase you take
 * and everything that decides a match comes from the eleven instead.
 */
export function startUcl(club: string, custom?: UclCustom | null): UclRun {
  const run = uclStart(club, Math.floor(Math.random() * 0x100000000) >>> 0, custom ?? null);
  setUcl(run);
  return run;
}

/**
 * Take a Dynasty club into Europe for real.
 *
 * The career already knows it is in the Champions League this season,
 * because the season before put it there. This plays that campaign match
 * by match with the actual squad instead of letting the summer simulate
 * it, and the result is handed back when it finishes, so the trophy and
 * the prize money are the ones that were won rather than drawn.
 *
 * It takes the weakest club's place in the field, the same way a drafted
 * XI does, because there are thirty six places and no thirty seventh.
 */
export function startUclFromDynasty(d: Dynasty): UclRun | null {
  const squad = everyone(d);
  const xi = starters(d);
  if (squad.length < 11 || xi.length < 11) return null;

  /*
   * Which place in the field it takes.
   *
   * Its own, when the club is one of the thirty six, or the draw can pair
   * you with yourself: an Arsenal career seated in Sabah's place left the
   * real Arsenal in the competition and the semi-final was Arsenal
   * against Arsenal. A club that is not in the field takes the weakest
   * place, the same way a drafted XI does.
   */
  const seat = uclClub(d.club) ? d.club : uclWeakest();

  const run = uclStart(
    seat,
    Math.floor(Math.random() * 0x100000000) >>> 0,
    {
      name: d.club,
      rating: squadRating(xi),
      squad: squad.map((p) => ({
        n: p.n,
        nat: p.nat,
        pos: [p.pos],
        rtg: p.rtg,
        prime: p.pot,
      })),
    },
    { club: d.club, year: d.year },
  );
  setUcl(run);
  return run;
}

/**
 * Hand a finished campaign back to the career that owns it.
 *
 * Written onto the career the moment it ends rather than when the summer
 * reads it, because the campaign can be thrown away from Settings and the
 * season still has to know what happened in it.
 */
function handBack(run: UclRun): void {
  if (!run.owner) return;
  const d = getCareer();
  if (!d || d.club !== run.owner.club || d.year !== run.owner.year) return;
  updateCareer((cur) => ({ ...cur, euro: { ...uclAsPlayed(run), year: run.owner!.year } }));
}

/**
 * Play the next match.
 *
 * Returns what happened so the match screen can show it, and banks the run
 * before it returns, so a match that has been seen has been saved.
 */
export function playNextUcl(): UclPlayed | null {
  if (!current) return null;
  const step = uclPlayNext(current);
  if (!step) return null;
  setUcl(step.run);
  if (step.run.over) {
    awardUcl(step.run);
    handBack(step.run);
    void showBreak('tournament');
  }
  return step;
}

/** Play out the rest of the league phase in one go. */
export function skipLeaguePhase(): UclMatch[] {
  if (!current) return [];
  const done = uclSkipLeague(current);
  setUcl(done.run);
  /* Skipping can end a campaign outright: twenty fifth and below is the
     end of it, with nothing to drop into. */
  if (done.run.over) {
    awardUcl(done.run);
    handBack(done.run);
  }
  return done.matches;
}

export function clearUcl(): void {
  setUcl(null);
}
