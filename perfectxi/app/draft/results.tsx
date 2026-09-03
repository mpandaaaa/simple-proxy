import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Share, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {
  ModeScreen,
  Press,
  Ticker,
  Rise,
  Pitch,
  ClubDisc,
  MatchLive,
  Confirm,
  Shine,
  SeasonCurve,
  CupCard,
  Confetti,
  Trophy,
  ShareCard,
  CARD_W,
  CARD_H,
} from '../../src/ui/components';
import { color, space, radius, line, gradient, positionColor } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  awards,
  calcOdds,
  chemBonus,
  expectation,
  finishFor,
  highlights,
  livePosition,
  bankDaily,
  bankWeekly,
  bankDuel,
  sendDuel,
  weeklyFor,
  decodeDuel,
  duelOutcome,
  encodeDuel,
  ordinal,
  mulberry32,
  simulateSeason,
  simulateCups,
  squadAvg,
  verdict,
  type FinishTone,
  type Grade,
  type MatchResult,
  type Position,
  type Outcome,
  type Slot,
  type TableRow,
} from '../../src/engine';
import { startDynasty } from '../../src/engine';
import { clearRun, setDuelScores, useRun } from '../../src/game/run';
import { pullProgress, pushResult } from '../../src/net/lobby';
import { getCareer, setCareer } from '../../src/game/career';
import {
  careerStore,
  progressStore,
  dailyStore,
  weeklyStore,
  duelStore,
  remember,
  type SeasonRecord,
} from '../../src/save';
import { achievementFor, earn, foldSeason } from '../../src/game/achievements';
import { pushUnlocks } from '../../src/game/unlocks';

/**
 * The season review.
 *
 * The site puts eight sections on this page and every one of them earns its
 * place: where you came and what it means, the papers, the numbers, the
 * awards, what every player did, all thirty eight results, and the table
 * you finished in. A results screen that shows a score and a table is a
 * receipt.
 *
 * Two things here the site does not have. Every result can be tapped and
 * watched back in full, because the match engine is the same one that
 * played it. And the season is set against what the odds card promised you
 * on Squad Complete, in places and in points, which is the only way to know
 * whether the XI you drafted was any good or merely lucky.
 */

const TONE: Record<
  FinishTone,
  { tint: string; edge: string; wash: string }
> = {
  gold: {
    tint: color.gold,
    edge: 'rgba(214,178,94,0.45)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(214,178,94,0.30) 0%, rgba(58,44,12,0.55) 44%, #0C0F0A 86%)',
  },
  silver: {
    tint: '#C9D6CE',
    edge: 'rgba(201,214,206,0.36)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(201,214,206,0.22) 0%, rgba(40,50,46,0.5) 44%, #0A0F0C 86%)',
  },
  ucl: {
    tint: color.accent,
    edge: 'rgba(31,197,126,0.42)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(31,197,126,0.26) 0%, rgba(10,60,38,0.5) 44%, #08110D 86%)',
  },
  europa: {
    tint: color.blue,
    edge: 'rgba(76,160,255,0.40)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(76,160,255,0.24) 0%, rgba(12,38,68,0.5) 44%, #080D14 86%)',
  },
  mid: {
    tint: color.text2,
    edge: 'rgba(255,255,255,0.16)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(24,32,28,0.6) 44%, #0A0F0C 86%)',
  },
  low: {
    tint: color.warning,
    edge: 'rgba(245,165,36,0.36)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(245,165,36,0.22) 0%, rgba(58,40,10,0.5) 44%, #0C0D08 86%)',
  },
  rel: {
    tint: color.danger,
    edge: 'rgba(229,72,77,0.42)',
    wash: 'radial-gradient(135% 105% at 50% 0%, rgba(229,72,77,0.26) 0%, rgba(62,14,16,0.5) 44%, #100809 86%)',
  },
};

const GRADE_TINT: Record<Grade, string> = {
  S: color.gold,
  A: color.accent,
  B: color.accent,
  C: color.blue,
  D: color.text2,
  E: color.warning,
  F: color.danger,
};

const OUTCOME = {
  win: color.win,
  draw: color.draw,
  loss: color.loss,
} as const;

const POS_ORDER: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

/** Just the suffix, so the number itself can count up on its own. */
function suffix(n: number): string {
  return ordinal(n).replace(String(n), '');
}

export default function Results() {
  const run = useRun();
  const banked = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const [watching, setWatching] = useState<number | null>(null);

  const [unlocked, setUnlocked] = useState<string[]>([]);
  /* The code this run turned into, when it was played to set somebody a
     challenge. Held in state because it is made once, in the same pass
     that banks the season, and then drawn. */
  const [challenge, setChallenge] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  /* Who you are still waiting on, when the other chair holds a person who
     has not finished their season yet. */
  const [waitingOn, setWaitingOn] = useState<string | null>(null);
  const waiting = useRef<(() => void) | null>(null);
  useEffect(() => () => waiting.current?.(), []);

  // The season goes on the record here rather than while it was playing, so
  // a season abandoned halfway never counts.
  useEffect(() => {
    const r = run?.result;
    if (!r || banked.current) return;
    banked.current = true;

    const squad = run.state.squad;
    const config = run.state.config;
    const rating = squadAvg(squad);
    const won = simulateCups(rating, r.position, run.seed);
    const exp = expectation(rating, r.position);

    // The career counts the season first, then judges it, so "five seasons
    // played" is earned by the fifth season rather than the sixth.
    const before = careerStore.read();
    const after = foldSeason(before, r, won, config);
    const fresh = earn({
      career: after,
      result: r,
      cups: won,
      config,
      avg: rating,
      above: exp.diff,
      wasRelegated: before.lastRelegated,
    });
    careerStore.write({ ...after, earned: [...after.earned, ...fresh] });
    setUnlocked(fresh);
    // Shown as a banner over the page as well as listed on it, so the
    // first one is impossible to miss and the rest are still recorded.
    pushUnlocks(fresh);

    const scorers = Object.entries(r.playerStats)
      .map(([name, st]) => ({ name, goals: st.g }))
      .sort((a, b) => b.goals - a.goals);

    const won_: string[] = [];
    if (r.position === 1) won_.push('League champions');
    if (won.national.won) won_.push('National Cup');
    if (won.continental.won) won_.push('Continental Cup');
    if (won.treble) won_.push('The Treble');
    else if (won.double) won_.push('The Double');

    const record: SeasonRecord = {
      at: Date.now(),
      seed: run.seed,
      engineVersion: run.engineVersion,
      formation: config.formation,
      mode: config.mode,
      diff: config.diff,
      avg: Math.round(rating),
      position: r.position,
      pts: r.pts,
      w: r.wins,
      d: r.draws,
      l: r.losses,
      gf: r.gf,
      ga: r.ga,
      grade: r.grade,
      cleanSheets: r.cleanSheets,
      honours: won_,
      nationalCup: won.national.won,
      continentalCup: won.continental.won,
      topScorer: scorers[0] && scorers[0].goals > 0 ? scorers[0] : null,
      xi: squad
        .filter((sl) => sl.player)
        .map((sl) => ({
          n: sl.player!.n,
          pos: sl.pos,
          rtg: sl.player!.rtg,
          club: sl.player!.club,
          season: sl.player!.season,
        })),
    };
    remember(record);

    /* The weekly keeps your best of the week rather than your last. */
    if (run.weekly) {
      weeklyStore.update((rec) =>
        bankWeekly(rec, {
          n: run.weekly as number,
          twistId: weeklyFor(run.weekly as number).twist.id,
          pts: r.pts,
          position: r.position,
          rating: Math.round(rating),
          attempts: 1,
          at: Date.now(),
        }),
      );
    }

    /* A challenge set becomes a code: the seed, the rules and the score
       to beat, packed into fourteen characters. Nothing is uploaded, so
       the code is the whole duel and it works with no signal, in any
       messaging app, with anybody, forever. */
    if (run.sending) {
      const made = encodeDuel({
        seed: run.seed,
        pts: r.pts,
        rating: Math.round(rating),
        config,
      });
      setChallenge(made);
      duelStore.update((rec) => sendDuel(rec, made));
    }

    /* A live duel is decided here, because their XI has to play a season
       too and only this screen knows yours has finished. Their season is
       drawn from the run seed rather than from the clock, so the result
       is the same one however many times it is worked out. */
    if (run.live) {
      const them = run.live.opponent;
      const match = run.live.match;
      const bank = (theirPts: number, who: string, bot: boolean) => {
        setDuelScores(r.pts, theirPts);
        duelStore.update((rec) =>
          bankDuel(rec, {
            code: `live:${who}`,
            who,
            live: true,
            bot,
            mine: r.pts,
            theirs: theirPts,
            outcome: duelOutcome(r.pts, theirPts),
            sent: false,
            at: Date.now(),
          }),
        );
      };

      if (match) {
        /* A person. Your score goes up first so they are never the one
           left waiting, then theirs is waited for. */
        pushResult(match, r.pts, Math.round(rating));
        setWaitingOn(match.name);
        let stopped = false;
        const until = Date.now() + 45000;
        const ask = async () => {
          while (!stopped && Date.now() < until) {
            const got = await pullProgress(match);
            if (got?.pts != null) {
              if (!stopped) {
                setWaitingOn(null);
                bank(got.pts, match.name, false);
              }
              return;
            }
            await new Promise((res) => setTimeout(res, 2000));
          }
          if (!stopped) setWaitingOn(null);
        };
        void ask();
        waiting.current = () => {
          stopped = true;
        };
      } else {
        /* The Machine. Its XI plays a season from the run seed, so the
           result is the same one however many times it is worked out. */
        const theirs = simulateSeason(
          them.squad,
          config.formation,
          chemBonus(them.squad),
          mulberry32((run.seed ^ 0x5bf03635) >>> 0),
        );
        bank(theirs.pts, them.name, true);
      }
    }

    /* A duel answered is a duel decided, one way or the other. */
    if (run.duel) {
      const sent = decodeDuel(run.duel);
      if (sent) {
        duelStore.update((rec) =>
          bankDuel(rec, {
            code: run.duel as string,
            mine: r.pts,
            theirs: sent.pts,
            outcome: duelOutcome(r.pts, sent.pts),
            sent: false,
            at: Date.now(),
          }),
        );
      }
    }

    /* A Daily is banked as well as remembered, because it is the one run
       that can only be played once and the streak depends on it. */
    if (run.daily) {
      const form = r.matches
        .map((m) => (m.oc === 'win' ? 'w' : m.oc === 'draw' ? 'd' : 'l'))
        .join('');
      dailyStore.update((rec) =>
        bankDaily(rec, {
          n: run.daily as number,
          pts: r.pts,
          position: r.position,
          grade: r.grade,
          rating: Math.round(rating),
          gf: r.gf,
          ga: r.ga,
          form,
          at: Date.now(),
        }),
      );
    }

    progressStore.update((p) => ({
      ...p,
      seasons: p.seasons + 1,
      titles: p.titles + (r.position === 1 ? 1 : 0),
      best: Math.max(p.best, r.pts),
      coins:
        p.coins +
        30 +
        Math.round(r.pts / 2) +
        (r.position === 1 ? 120 : r.position <= 4 ? 45 : 0),
      xp:
        p.xp +
        140 +
        r.pts * 3 +
        (r.position === 1 ? 400 : r.position <= 4 ? 180 : r.position <= 10 ? 60 : 0),
    }));
  }, [run]);

  const result = run?.result ?? null;
  const isDaily = run?.daily != null;
  const isWeekly = run?.weekly != null;
  const isDuel = run?.duel != null || run?.sending === true || run?.live != null;

  /* Where "another go" goes. Back to the thing you were playing, never to
     a plain draft, because a plain draft is not what you opened. */
  const againTo = isDaily ? '/daily' : isWeekly ? '/weekly' : isDuel ? '/duel' : '/draft';
  const againText = isDaily
    ? 'Back to today'
    : isWeekly
      ? 'Have another go this week'
      : isDuel
        ? 'Back to duels'
        : 'Draft another XI';

  /* The duel you answered, decided. Worked out here rather than in the
     banking pass, because the banking pass runs once and this has to be
     on the page every time it draws. */
  const duelWas = useMemo(() => {
    if (!result) return null;
    /* Live first: their season has been played and both scores are on the
       run, so nothing has to be decoded. */
    if (run?.live && run.live.theirPts != null) {
      return {
        who: run.live.opponent.name,
        bot: run.live.opponent.bot,
        rating: run.live.opponent.rating,
        mine: result.pts,
        theirs: run.live.theirPts,
        outcome: duelOutcome(result.pts, run.live.theirPts),
      };
    }
    if (!run?.duel) return null;
    const sent = decodeDuel(run.duel);
    if (!sent) return null;
    return {
      who: null,
      bot: false,
      rating: sent.rating,
      mine: result.pts,
      theirs: sent.pts,
      outcome: duelOutcome(result.pts, sent.pts),
    };
  }, [run?.duel, run?.live, result]);

  const shareChallenge = useCallback(async () => {
    if (!challenge) return;
    haptic('medium');
    await Share.share({
      message:
        `I have set you a Perfect XI duel.

${challenge}

` +
        `Same spins, same rules. Beat my points.`,
    });
  }, [challenge]);

  const copyChallenge = useCallback(async () => {
    if (!challenge) return;
    haptic('light');
    await Clipboard.setStringAsync(challenge);
    setCodeCopied(true);
  }, [challenge]);

  const trophies = useMemo(
    () => (run && result ? awards(result.playerStats, run.state.squad) : null),
    [run, result],
  );

  const rewatch = useCallback((index: number) => {
    haptic('light');
    setWatching(index);
  }, []);

  const card = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [carrying, setCarrying] = useState(false);
  // Read when the dialog opens rather than on every render, so writing the
  // new career cannot change the wording underneath the player's thumb.
  const replacing = useRef(false);

  /**
   * The picture comes off a real view rendered off screen at a fixed size,
   * captured at three times scale, which is 1080 by 1350.
   *
   * Capturing the results page itself would be easier and wrong: it would
   * carry the header, the scroll position and the notch into the picture.
   */
  const share = useCallback(async () => {
    if (sharing || !card.current) return;
    setSharing(true);
    haptic('medium');
    try {
      const uri = await captureRef(card.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: CARD_W * 3,
        height: CARD_H * 3,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Your XI',
          UTI: 'public.png',
        });
      }
    } catch {
      // A share sheet that will not open is not worth an alert on top of
      // the results. The button is still there to be pressed again.
    } finally {
      setSharing(false);
    }
  }, [sharing]);

  if (!run || !result) return null;

  const { squad, config } = run.state;
  const avg = squadAvg(squad);
  const odds = calcOdds(avg, chemBonus(squad));
  const fin = finishFor(result);
  const tone = TONE[fin.tone];
  const exp = expectation(avg, result.position);
  const paper = verdict(result);
  const stats = highlights(result);

  const cups = simulateCups(avg, result.position, run.seed);

  // The table position after every game, which is the shape of the season.
  const curve: number[] = [];
  const outcomes: Outcome[] = [];
  {
    let pts = 0;
    result.matches.forEach((m, i) => {
      pts += m.oc === 'win' ? 3 : m.oc === 'draw' ? 1 : 0;
      curve.push(livePosition(pts, i + 1, result.table));
      outcomes.push(m.oc);
    });
  }

  // Everything the season actually won, named, so a treble is not left to
  // be worked out from two cards further down the page.
  const honours: string[] = [];
  if (result.position === 1) honours.push('League champions');
  if (cups.national.won) honours.push('National Cup');
  if (cups.continental.won) honours.push('Continental Cup');
  if (cups.treble) honours.push('The Treble');
  else if (cups.double) honours.push('The Double');

  const placesBetter = odds.projFinish - result.position;
  const pointsBetter = result.pts - odds.expPts;

  const ordered = squad
    .filter((s): s is Slot & { player: NonNullable<Slot['player']> } => !!s.player)
    .slice()
    .sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos));

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />

      <ModeScreen
        overline="Season complete"
        title={config.formation}
        onBack={() => setLeaving(true)}
        right={
          <View
            style={[
              styles.grade,
              {
                borderColor: GRADE_TINT[result.grade],
                backgroundColor: GRADE_TINT[result.grade] + '1F',
              },
            ]}
          >
            <Text style={[styles.gradeText, { color: GRADE_TINT[result.grade] }]}>
              {result.grade}
            </Text>
          </View>
        }
      >
        {/* ================= where you finished ================= */}
        <Finish
          position={result.position}
          title={fin.title}
          sub={fin.sub}
          mark={fin.mark}
          honours={honours}
          tone={tone}
          expVerdict={exp.verdict}
          expLine={`Avg ${Math.round(avg)} · Expected ${exp.label} · Finished ${ordinal(
            result.position,
          )}`}
        />

        {/* ================= still waiting on them ================= */}
        {waitingOn && !duelWas ? (
          <View style={[styles.duelCard, { borderColor: 'rgba(245,165,36,0.4)' }]}>
            <Text style={[styles.duelKey, { color: color.warning }]}>
              Waiting for {waitingOn}
            </Text>
            <Text style={styles.duelNote}>
              You are done. They are still playing their season. The result
              lands here the moment they finish.
            </Text>
          </View>
        ) : null}

        {/* ================= the duel you answered ================= */}
        {duelWas ? (
          <Rise delay={0}>
            <View
              style={[
                styles.duelCard,
                {
                  borderColor:
                    duelWas.outcome === 'won'
                      ? 'rgba(31,197,126,0.46)'
                      : duelWas.outcome === 'drew'
                        ? 'rgba(245,165,36,0.42)'
                        : 'rgba(229,72,77,0.42)',
                },
              ]}
            >
              <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
              <Text
                style={[
                  styles.duelKey,
                  {
                    color:
                      duelWas.outcome === 'won'
                        ? color.accent
                        : duelWas.outcome === 'drew'
                          ? color.warning
                          : color.danger,
                  },
                ]}
              >
                {duelWas.outcome === 'won'
                  ? 'You won the duel'
                  : duelWas.outcome === 'drew'
                    ? 'The duel is a draw'
                    : 'You lost the duel'}
              </Text>
              <Text style={styles.duelScore} allowFontScaling={false}>
                {duelWas.mine} {'–'} {duelWas.theirs}
              </Text>
              <Text style={styles.duelNote}>
                {duelWas.who
                  ? `${duelWas.who}${duelWas.bot ? ', the Machine' : ''} drafted an XI rated ${duelWas.rating}. Yours was ${Math.round(avg)}. The same spins, at the same time.`
                  : `Their XI was rated ${duelWas.rating} and yours ${Math.round(avg)}. Same spins, same shape, same era.`}
              </Text>
            </View>
          </Rise>
        ) : null}

        {/* ================= the code, when you set a challenge =================
            First, above everything, because it is the only thing on this
            page that has to leave the phone. A code the player has to go
            looking for is a code that never gets sent. */}
        {challenge ? (
          <Rise delay={0}>
            <View style={styles.duelCard}>
              <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
              <Text style={styles.duelKey}>Your challenge is ready</Text>
              <Text style={styles.duelCode} allowFontScaling={false} selectable>
                {challenge}
              </Text>
              <Text style={styles.duelNote}>
                Send this and they draft your exact spins, in your shape and
                your era, chasing your {result.pts} points.
              </Text>
              <View style={styles.duelRow}>
                <Press onPress={shareChallenge} feel="none" scaleTo={0.97} style={styles.duelSend}>
                  <Text style={styles.duelSendText}>Send it</Text>
                </Press>
                <Press onPress={copyChallenge} feel="none" scaleTo={0.97} style={styles.duelCopy}>
                  <Text style={styles.duelCopyText}>{codeCopied ? 'Copied' : 'Copy'}</Text>
                </Press>
              </View>
            </View>
          </Rise>
        ) : null}

        {/* ================= the six numbers ================= */}
        <View style={styles.tiles}>
          <Tile value={result.wins} label="Won" tint={color.win} />
          <Tile value={result.draws} label="Drawn" tint={color.draw} />
          <Tile value={result.losses} label="Lost" tint={color.loss} />
          <Tile value={result.gf} label="Goals for" />
          <Tile value={result.ga} label="Goals against" />
          <Tile value={result.pts} label="Points" tint={tone.tint} />
        </View>

        {/* ================= the morning papers ================= */}
        <Rise delay={0}>
          <View style={[styles.paper, { borderColor: tone.edge }]}>
            <View style={styles.grain} pointerEvents="none">
              <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
            </View>
            <Shine radius={radius.lg} group="panel" bevel={false} clip={false} />
            <Text style={[styles.paperKey, { color: tone.tint }]}>The morning papers</Text>
            <View style={[styles.rule, { backgroundColor: tone.edge }]} />
            <Text style={styles.paperHead}>{paper.headline}</Text>
            <Text style={styles.paperQuote}>{paper.quote}</Text>
            <Text style={styles.paperSource}>{paper.source}</Text>
          </View>
        </Rise>

        {/* ================= against the odds ================= */}
        <Rise delay={1}>
          <View style={styles.odds}>
            <Shine radius={radius.lg} group="feature" />
            <Text style={styles.sectKey}>Against the odds</Text>
            <Text style={styles.oddsLead}>
              What an {Math.round(avg)} rated XI was promised, against what it did.
            </Text>

            <View style={styles.oddsGrid}>
              <OddsCol
                label="Finish"
                promised={ordinal(odds.projFinish)}
                actual={ordinal(result.position)}
                delta={placesBetter}
                unit={Math.abs(placesBetter) === 1 ? 'place' : 'places'}
              />
              <View style={styles.oddsDivide} />
              <OddsCol
                label="Points"
                promised={String(odds.expPts)}
                actual={String(result.pts)}
                delta={pointsBetter}
                unit={Math.abs(pointsBetter) === 1 ? 'point' : 'points'}
              />
            </View>
          </View>
        </Rise>

        {/* ================= season highlights ================= */}
        <Text style={[text.label, styles.sect]}>Season highlights</Text>
        <View style={styles.hlGrid}>
          {stats.map((h) => (
            <View key={h.label} style={styles.hl}>
              <Text
                style={styles.hlValue}
                numberOfLines={1}
                adjustsFontSizeToFit
                allowFontScaling={false}
              >
                {h.value}
              </Text>
              <Text style={styles.hlLabel}>{h.label}</Text>
            </View>
          ))}
        </View>

        {/* ================= season awards ================= */}
        {trophies ? (
          <Rise delay={0}>
            <View style={styles.awards}>
              <View style={styles.grain} pointerEvents="none">
                <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
              </View>
              <Shine radius={radius.lg} group="feature" bevel={false} clip={false} />
              <Text style={styles.awardsKey}>Season awards</Text>

              <Award
                mark="🏆"
                label="Player of the season"
                name={trophies.pots?.name}
                stat={
                  trophies.pots
                    ? `${trophies.pots.value} goals, ${trophies.pots.extra ?? 0} assists`
                    : undefined
                }
                squad={ordered}
                top
              />
              <Award
                mark="⚽"
                label="Golden Boot"
                name={trophies.boot?.name}
                stat={trophies.boot ? `${trophies.boot.value} goals` : undefined}
                squad={ordered}
              />
              <Award
                mark="🎯"
                label="Playmaker"
                name={trophies.playmaker?.name}
                stat={
                  trophies.playmaker ? `${trophies.playmaker.value} assists` : undefined
                }
                squad={ordered}
              />
              <Award
                mark="🧤"
                label="Golden Glove"
                name={trophies.glove?.name}
                stat={trophies.glove ? `${trophies.glove.value} clean sheets` : undefined}
                squad={ordered}
              />
            </View>
          </Rise>
        ) : null}

        {/* ================= what every player did ================= */}
        <Text style={[text.label, styles.sect]}>Player statistics</Text>
        <View style={styles.players}>
          {ordered.map((s) => {
            const st = result.playerStats[s.player.n] ?? { g: 0, a: 0, cs: 0 };
            const keeps = s.pos === 'GK' || s.pos === 'DEF';
            return (
              <View key={s.player.n} style={styles.pl}>
                <View
                  style={[styles.plPos, { backgroundColor: positionColor[s.pos] + '26', borderColor: positionColor[s.pos] + '66' }]}
                >
                  <Text style={[styles.plPosText, { color: positionColor[s.pos] }]}>
                    {s.pos}
                  </Text>
                </View>
                <View style={styles.plRtg}>
                  <Text style={styles.plRtgText} allowFontScaling={false}>
                    {s.player.rtg}
                  </Text>
                </View>
                <View style={styles.plName}>
                  <Text style={styles.plNameText} numberOfLines={1}>
                    {s.player.n}
                  </Text>
                  <Text style={styles.plClub} numberOfLines={1}>
                    {s.player.club} {'·'} {s.player.season}
                  </Text>
                </View>
                <PlStat value={st.g} label="Goals" />
                <PlStat value={st.a} label="Assists" />
                {keeps ? <PlStat value={st.cs} label="CS" /> : null}
              </View>
            );
          })}
        </View>

        {unlocked.length ? (
          <Rise delay={0}>
            <View style={styles.unlocked}>
              <Text style={styles.unlockedKey}>
                {unlocked.length === 1
                  ? 'Achievement unlocked'
                  : `${unlocked.length} achievements unlocked`}
              </Text>
              {unlocked.map((key) => {
                const a = achievementFor(key);
                if (!a) return null;
                return (
                  <View key={key} style={styles.unlock}>
                    <Text style={styles.unlockMark} allowFontScaling={false}>
                      {a.mark}
                    </Text>
                    <View style={styles.unlockBody}>
                      <Text style={styles.unlockName}>{a.name}</Text>
                      <Text style={styles.unlockDesc}>{a.desc}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Rise>
        ) : null}

        {/* ================= the cups ================= */}
        <Text style={[text.label, styles.sect]}>Cup competitions</Text>
        <View style={styles.cups}>
          <CupCard run={cups.national} mark="🏆" tint={color.gold} />
          <CupCard run={cups.continental} mark="🌍" tint={color.blue} />
        </View>

        {/* ================= the season, as a shape ================= */}
        <Text style={[text.label, styles.sect]}>The season</Text>
        <Text style={styles.sectHint}>
          Where the XI stood in the table after every game.
        </Text>
        <SeasonCurve positions={curve} outcomes={outcomes} tint={tone.tint} />

        <Fixtures matches={result.matches} onWatch={rewatch} />

        {/* ================= the table ================= */}
        <Text style={[text.label, styles.sect]}>Final standings</Text>
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.colPos]}>#</Text>
            <Text style={[styles.th, styles.colClub]}>Club</Text>
            <Text style={[styles.th, styles.colNum]}>W</Text>
            <Text style={[styles.th, styles.colNum]}>D</Text>
            <Text style={[styles.th, styles.colNum]}>L</Text>
            <Text style={[styles.th, styles.colGd]}>GD</Text>
            <Text style={[styles.th, styles.colPts]}>Pts</Text>
          </View>
          {result.table.map((r, i) => (
            <Row key={r.name} row={r} pos={i + 1} tint={tone.tint} />
          ))}
          <View style={styles.legend}>
            <Key tint={color.gold} label="Champions" />
            <Key tint={color.blue} label="Champions League" />
            <Key tint={color.accent} label="Europe" />
            <Key tint={color.danger} label="Relegation" />
          </View>
        </View>

        {/* ================= the XI that did it ================= */}
        <Text style={[text.label, styles.sect]}>The XI</Text>
        <Pitch squad={squad} formation={config.formation} />

        <View style={styles.cta}>
          <Press
            onPress={() => {
              haptic('medium');
              replacing.current = getCareer() !== null;
              setCarrying(true);
            }}
            feel="none"
            style={[styles.dynasty, { borderColor: line.purple }]}
            scaleTo={0.98}
          >
            <Text style={styles.dynastyText}>Take this XI into a Dynasty</Text>
            <Text style={styles.dynastySub}>
              Carry the eleven forward. They age from here.
            </Text>
          </Press>
          <Press
            onPress={share}
            feel="none"
            style={[styles.share, { borderColor: tone.edge }]}
            scaleTo={0.98}
          >
            <Text style={[styles.shareText, { color: tone.tint }]}>
              {sharing ? 'Making the picture' : 'Share this XI'}
            </Text>
          </Press>
          {/* A Daily is one attempt, so it does not offer another go at
              the same puzzle. It goes back to the card that says when the
              next one opens, and the week and the duels go back to theirs. */}
          <Press
            onPress={() => {
              haptic('medium');
              router.dismissAll();
              router.push(againTo);
              clearRun();
            }}
            feel="none"
            style={[styles.again, { borderColor: tone.edge }]}
            scaleTo={0.98}
          >
            <Text style={[styles.againText, { color: tone.tint }]}>{againText}</Text>
          </Press>
          <Press
            onPress={() => {
              haptic('light');
              router.dismissAll();
              clearRun();
            }}
            feel="none"
            style={styles.home}
            scaleTo={0.98}
          >
            <Text style={styles.homeText}>Back to home</Text>
          </Press>
        </View>
      </ModeScreen>

      {/* off screen, at print size, waiting to be captured */}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard
          ref={card}
          squad={squad}
          formation={config.formation}
          position={result.position}
          points={result.pts}
          grade={result.grade}
          title={fin.title}
          tint={tone.tint}
          honours={honours}
        />
      </View>

      <Confetti fire={result.position === 1} />

      <MatchLive
        match={watching !== null ? result.matches[watching] : null}
        seed={run.seed}
        live={false}
        visible={watching !== null}
        onDone={() => setWatching(null)}
      />

      <Confirm
        visible={carrying}
        title={replacing.current ? 'Replace your career?' : 'Start a Dynasty?'}
        body={
          replacing.current
            ? 'You already have a career running. Starting a new one with this XI ends that one, and there is no way back to it.'
            : 'These eleven become a club. They age every season, they decline, and one day they retire. Signings are not built yet, so this is the squad you keep.'
        }
        confirmLabel={replacing.current ? 'Replace it' : 'Start it'}
        onCancel={() => setCarrying(false)}
        onConfirm={() => {
          setCarrying(false);
          setCareer(startDynasty(squad, config.formation, 'Your XI', run.seed));
          // The run is deliberately left alone. Clearing it is what every
          // draft screen underneath reacts to, and this path does not need
          // it cleared: starting another draft overwrites it anyway. The
          // eleven have already been copied into the career by now.
          router.dismissAll();
          router.push('/dynasty');
        }}
      />

      <Confirm
        visible={leaving}
        title="Leave the season?"
        body="The season is already on your record. Leaving just closes it."
        confirmLabel="Leave"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          router.dismissAll();
          clearRun();
        }}
      />
    </>
  );
}

/**
 * The moment the run resolves into.
 *
 * The position counts up under a bloom in the colour of what it means, so
 * third and thirteenth do not arrive on the same card looking the same.
 */
function Finish({
  position,
  title,
  sub,
  mark,
  tone,
  expVerdict,
  expLine,
  honours,
}: {
  position: number;
  title: string;
  sub: string;
  mark: string;
  /** the cups won alongside the league, named */
  honours: string[];
  tone: { tint: string; edge: string; wash: string };
  expVerdict: 'over' | 'met' | 'under';
  expLine: string;
}) {
  const reduce = useReduceMotion();
  const inn = useSharedValue(reduce ? 1 : 0);
  const champion = position === 1;

  useEffect(() => {
    if (reduce) return;
    inn.value = withDelay(90, withSpring(1, { stiffness: 170, damping: 20, mass: 1 }));
    if (!champion) {
      haptic('success');
      sfx(position <= 4 ? 'win' : position >= 18 ? 'lose' : 'ft');
      return;
    }
    sfx('trophy');
    // A title arrives as three beats rather than one buzz.
    haptic('heavy');
    const a = setTimeout(() => haptic('heavy'), 190);
    const b = setTimeout(() => haptic('success'), 460);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [inn, reduce, champion, position]);

  const numStyle = useAnimatedStyle(() => ({
    opacity: inn.value,
    transform: [{ scale: 0.78 + inn.value * 0.22 }],
  }));
  const restStyle = useAnimatedStyle(() => ({
    opacity: inn.value,
    transform: [{ translateY: (1 - inn.value) * 12 }],
  }));

  const pill =
    expVerdict === 'over'
      ? { tint: color.accent, text: 'Overperformed', mark: '▲' }
      : expVerdict === 'under'
        ? { tint: color.danger, text: 'Underperformed', mark: '▼' }
        : { tint: color.text2, text: 'As expected', mark: '=' };

  return (
    <View
      style={[
        styles.finish,
        { borderColor: tone.edge, experimental_backgroundImage: tone.wash },
      ]}
    >
      <View style={styles.finishBloom} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="finishBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tone.tint} stopOpacity={0.34} />
              <Stop offset="1" stopColor={tone.tint} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="6" rx="66" ry="50" fill="url(#finishBloom)" />
        </Svg>
      </View>
      <View style={styles.grain} pointerEvents="none">
        <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
      </View>
      <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
      <View style={styles.finishEdge} pointerEvents="none" />

      {champion ? (
        <View style={styles.crown}>
          <View style={styles.rays} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 200 200">
              {Array.from({ length: 16 }, (_, i) => {
                const a = (i / 16) * Math.PI * 2;
                const x = 100 + Math.cos(a) * 150;
                const y = 100 + Math.sin(a) * 150;
                return (
                  <Path
                    key={i}
                    d={`M 100 100 L ${x} ${y}`}
                    stroke={tone.tint}
                    strokeOpacity={i % 2 ? 0.10 : 0.18}
                    strokeWidth={i % 2 ? 7 : 13}
                  />
                );
              })}
            </Svg>
          </View>
          <Trophy size={104} tint={tone.tint} />
        </View>
      ) : (
        <Text style={styles.finishMark} allowFontScaling={false}>
          {mark}
        </Text>
      )}

      <Animated.View style={[styles.finishNum, numStyle]}>
        <Ticker
          value={position}
          from={20}
          duration={1000}
          blank="0"
          style={[styles.finishPos, { color: tone.tint }]}
        />
        <Text style={[styles.finishOrd, { color: tone.tint }]} allowFontScaling={false}>
          {suffix(position)}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.finishRest, restStyle]}>
        <Text style={styles.finishTitle}>{title}</Text>
        <Text style={styles.finishSub}>{sub}</Text>

        <View
          style={[
            styles.pv,
            { borderColor: pill.tint + '66', backgroundColor: pill.tint + '1A' },
          ]}
        >
          <Text style={[styles.pvText, { color: pill.tint }]}>
            {pill.mark} {pill.text}
          </Text>
        </View>
        <Text style={styles.pvSub}>{expLine}</Text>

        {honours.length ? (
          <View style={styles.honours}>
            {honours.map((h) => (
              <View key={h} style={styles.honour}>
                <Text style={styles.honourText}>{h}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function Tile({ value, label, tint }: { value: number; label: string; tint?: string }) {
  return (
    <View style={styles.tile}>
      <Ticker
        value={value}
        from={0}
        blank="0"
        duration={780}
        style={[styles.tileValue, tint ? { color: tint } : null]}
      />
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function OddsCol({
  label,
  promised,
  actual,
  delta,
  unit,
}: {
  label: string;
  promised: string;
  actual: string;
  delta: number;
  unit: string;
}) {
  const tint = delta > 0 ? color.accent : delta < 0 ? color.danger : color.text2;
  return (
    <View style={styles.oddsCol}>
      <Text style={styles.oddsKey}>{label}</Text>
      <View style={styles.oddsPair}>
        <View style={styles.oddsHalf}>
          <Text style={styles.oddsPromised} allowFontScaling={false}>
            {promised}
          </Text>
          <Text style={styles.oddsCap}>Promised</Text>
        </View>
        <Text style={styles.oddsArrow} allowFontScaling={false}>
          {'→'}
        </Text>
        <View style={styles.oddsHalf}>
          <Text style={[styles.oddsActual, { color: tint }]} allowFontScaling={false}>
            {actual}
          </Text>
          <Text style={styles.oddsCap}>Actual</Text>
        </View>
      </View>
      <Text style={[styles.oddsDelta, { color: tint }]}>
        {delta === 0
          ? `Exactly as promised`
          : `${Math.abs(delta)} ${unit} ${delta > 0 ? 'better' : 'worse'}`}
      </Text>
    </View>
  );
}

function Award({
  mark,
  label,
  name,
  stat,
  squad,
  top,
}: {
  mark: string;
  label: string;
  name?: string;
  stat?: string;
  squad: (Slot & { player: NonNullable<Slot['player']> })[];
  top?: boolean;
}) {
  const slot = name ? squad.find((s) => s.player.n === name) : undefined;
  return (
    <View style={[styles.aw, top ? styles.awTop : null]}>
      <Text style={styles.awMark} allowFontScaling={false}>
        {mark}
      </Text>
      <View style={styles.awBody}>
        <Text style={styles.awLabel}>{label}</Text>
        <Text style={styles.awName} numberOfLines={1}>
          {name ?? 'Not awarded'}
        </Text>
        {stat ? <Text style={styles.awStat}>{stat}</Text> : null}
      </View>
      {slot ? <ClubDisc club={slot.player.club} size={32} /> : null}
    </View>
  );
}

function PlStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.plStat}>
      <Text style={styles.plStatValue} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.plStatLabel}>{label}</Text>
    </View>
  );
}

/** One of the thirty eight, tappable, colour coded by what happened. */
/**
 * All thirty eight, folded away.
 *
 * A grid of thirty eight chips is a spreadsheet and it looked like one.
 * The season above says the shape; this says the detail, and it stays shut
 * until it is asked for, with the run of form and the record on its lid.
 */
function Fixtures({
  matches,
  onWatch,
}: {
  matches: MatchResult[];
  onWatch: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  let w = 0;
  let d = 0;
  let l = 0;
  for (const m of matches) {
    if (m.oc === 'win') w++;
    else if (m.oc === 'draw') d++;
    else l++;
  }
  const form = matches.slice(-5);

  return (
    <View style={styles.fixWrap}>
      <Press
        onPress={() => {
          haptic('light');
          setOpen((o) => !o);
        }}
        feel="none"
        scaleTo={0.99}
        style={styles.fixHead}
      >
        <Text style={styles.fixTitle}>Season fixtures</Text>
        <View style={styles.fixForm}>
          {form.map((m) => (
            <View
              key={m.n}
              style={[styles.fixDot, { backgroundColor: OUTCOME[m.oc] }]}
            />
          ))}
        </View>
        <Text style={styles.fixRecord} allowFontScaling={false}>
          <Text style={{ color: color.win }}>{w}W </Text>
          <Text style={{ color: color.draw }}>{d}D </Text>
          <Text style={{ color: color.loss }}>{l}L</Text>
        </Text>
        <Text style={styles.fixChev} allowFontScaling={false}>
          {open ? '▲' : '▼'}
        </Text>
      </Press>

      {open ? (
        <View style={styles.fixList}>
          {matches.map((m) => (
            <Press
              key={m.n}
              onPress={() => onWatch(m.n - 1)}
              feel="none"
              scaleTo={0.99}
              style={styles.fixRow}
            >
              <Text style={styles.fixMd} allowFontScaling={false}>
                {m.n}
              </Text>
              <View
                style={[
                  styles.fixVenue,
                  m.home
                    ? { borderColor: 'rgba(255,255,255,0.14)' }
                    : { borderColor: 'rgba(255,255,255,0.07)' },
                ]}
              >
                <Text style={styles.fixVenueText}>{m.home ? 'H' : 'A'}</Text>
              </View>
              <ClubDisc club={m.opp} size={26} />
              <Text style={styles.fixOpp} numberOfLines={1}>
                {m.opp}
              </Text>
              <Text
                style={[styles.fixScore, { color: OUTCOME[m.oc] }]}
                allowFontScaling={false}
              >
                {m.gf}
                {'–'}
                {m.ga}
              </Text>
              <View
                style={[
                  styles.fixPip,
                  {
                    borderColor: OUTCOME[m.oc] + '66',
                    backgroundColor: OUTCOME[m.oc] + '1F',
                  },
                ]}
              >
                <Text
                  style={[styles.fixPipText, { color: OUTCOME[m.oc] }]}
                  allowFontScaling={false}
                >
                  {m.oc === 'win' ? 'W' : m.oc === 'draw' ? 'D' : 'L'}
                </Text>
              </View>
            </Press>
          ))}
          <Text style={styles.fixHint}>Tap any match to watch it back.</Text>
        </View>
      ) : null}
    </View>
  );
}

function Row({ row, pos, tint }: { row: TableRow; pos: number; tint: string }) {
  const zone =
    pos === 1
      ? color.gold
      : pos <= 4
        ? color.blue
        : pos <= 7
          ? color.accent
          : pos >= 18
            ? color.danger
            : 'transparent';
  return (
    <View style={[styles.tr, row.isYou ? { backgroundColor: tint + '14' } : null]}>
      <View style={[styles.zone, { backgroundColor: zone }]} />
      <Text style={[styles.td, styles.colPos, { color: zone === 'transparent' ? color.text3 : zone }]} allowFontScaling={false}>
        {pos}
      </Text>
      <Text
        style={[styles.td, styles.colClub, row.isYou ? { color: tint, fontFamily: font.bodyBold } : null]}
        numberOfLines={1}
      >
        {row.isYou ? '★ ' : ''}
        {row.name}
      </Text>
      <Text style={[styles.td, styles.colNum]} allowFontScaling={false}>
        {row.w}
      </Text>
      <Text style={[styles.td, styles.colNum]} allowFontScaling={false}>
        {row.d}
      </Text>
      <Text style={[styles.td, styles.colNum]} allowFontScaling={false}>
        {row.l}
      </Text>
      <Text
        style={[
          styles.td,
          styles.colGd,
          { color: row.gf - row.ga >= 0 ? color.win : color.loss },
        ]}
        allowFontScaling={false}
      >
        {row.gf - row.ga >= 0 ? '+' : ''}
        {row.gf - row.ga}
      </Text>
      <Text
        style={[styles.tdPts, styles.colPts, row.isYou ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {row.pts}
      </Text>
    </View>
  );
}

function Key({ tint, label }: { tint: string; label: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keyDot, { backgroundColor: tint }]} />
      <Text style={styles.keyText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  duelCard: {
    marginBottom: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(76,160,255,0.42)',
    backgroundColor: '#0B131F',
    experimental_backgroundImage:
      'linear-gradient(180deg, #14233A 0%, #0C1524 62%, #070B12 100%)',
    overflow: 'hidden',
    gap: space.s2,
  },
  duelKey: { ...text.key, fontSize: 9.5, color: color.blue },
  duelCode: {
    fontFamily: font.displayBlack,
    fontSize: 28,
    lineHeight: 35,
    color: color.text1,
    letterSpacing: 2,
  },
  duelNote: { ...text.small, fontSize: 12.5, lineHeight: 18 },
  duelScore: {
    fontFamily: font.hero,
    fontSize: 44,
    lineHeight: 54,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  duelRow: { flexDirection: 'row', gap: space.s2, marginTop: space.s2 },
  duelSend: {
    flex: 2,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.blue,
    boxShadow: '0px 8px 22px rgba(76,160,255,0.28), inset 0px 1px 0px rgba(255,255,255,0.24)',
  },
  duelSendText: { ...text.button, fontSize: 15, color: '#05101E' },
  duelCopy: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  duelCopyText: { ...text.key, fontSize: 9.5, color: color.text2 },
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  grade: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: 0.5,
  },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  sectKey: { ...text.key, fontSize: 10, color: color.text3, marginBottom: space.s2 },
  sectHint: { ...text.small, marginTop: -space.s2, marginBottom: space.s3 },

  /* ---- the finish ---- */
  finish: {
    alignItems: 'center',
    paddingTop: space.s5,
    paddingHorizontal: space.s4,
    paddingBottom: space.s5,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: '#0A0F0C',
    boxShadow: '0px 16px 38px rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  finishBloom: { position: 'absolute', top: -40, left: -40, right: -40, height: 220 },
  finishEdge: {
    position: 'absolute',
    top: 0,
    left: '22%',
    right: '22%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  finishMark: { fontSize: 34, lineHeight: 42 },
  crown: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.s2,
  },
  rays: { position: 'absolute', top: -46, left: -46, right: -46, bottom: -46 },
  honours: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3, justifyContent: 'center' },
  honour: {
    paddingHorizontal: space.s3,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.5)',
    backgroundColor: 'rgba(214,178,94,0.14)',
  },
  honourText: { ...text.key, fontSize: 9.5, color: color.gold },
  finishNum: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 2 },
  finishPos: {
    fontFamily: font.hero,
    fontSize: 86,
    lineHeight: 112,
    fontVariant: ['tabular-nums'],
  },
  finishOrd: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 44,
    letterSpacing: 0.5,
    marginLeft: 3,
  },
  finishRest: { alignItems: 'center', marginTop: -space.s2 },
  finishTitle: {
    fontFamily: font.displayBlack,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.3,
    color: color.text1,
    textAlign: 'center',
  },
  finishSub: {
    ...text.body,
    color: color.text2,
    textAlign: 'center',
    marginTop: 4,
  },
  pv: {
    marginTop: space.s4,
    paddingHorizontal: space.s4,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pvText: { ...text.key, fontSize: 11 },
  pvSub: {
    ...text.small,
    fontSize: 12,
    color: color.text3,
    marginTop: space.s2,
    textAlign: 'center',
  },

  /* ---- six tiles ---- */
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
    marginTop: space.s4,
  },
  tile: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    width: '31.7%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  tileValue: {
    fontFamily: font.hero,
    fontSize: 32,
    lineHeight: 42,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 2 },

  /* ---- the papers ---- */
  paper: {
    marginTop: space.s6,
    padding: space.s5,
    borderRadius: radius.lg,
    borderWidth: 1,
    backgroundColor: '#0E1712',
    experimental_backgroundImage: 'linear-gradient(180deg, #16211B 0%, #0C120E 100%)',
    boxShadow: '0px 10px 26px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  },
  paperKey: { ...text.key, fontSize: 10 },
  rule: { height: 1, marginTop: space.s3, marginBottom: space.s3 },
  paperHead: {
    fontFamily: font.displayBlack,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: 0.2,
    color: color.text1,
  },
  paperQuote: {
    fontFamily: font.body,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 24,
    color: color.text2,
    marginTop: space.s3,
  },
  paperSource: {
    ...text.key,
    fontSize: 9.5,
    color: color.text3,
    marginTop: space.s3,
    textAlign: 'right',
  },

  /* ---- against the odds ---- */
  odds: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  oddsLead: { ...text.small, marginBottom: space.s4 },
  oddsGrid: { flexDirection: 'row', alignItems: 'stretch' },
  oddsDivide: { width: 1, backgroundColor: line.card, marginHorizontal: space.s3 },
  oddsCol: { flex: 1, alignItems: 'center' },
  oddsKey: { ...text.key, fontSize: 9, color: color.text3, marginBottom: space.s2 },
  oddsPair: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  oddsHalf: { alignItems: 'center', minWidth: 46 },
  oddsPromised: {
    fontFamily: font.displayBold,
    fontSize: 22,
    lineHeight: 27,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  oddsActual: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  oddsCap: { ...text.key, fontSize: 8, color: color.text3, marginTop: 1 },
  oddsArrow: { fontSize: 15, lineHeight: 20, color: color.text3 },
  oddsDelta: { ...text.key, fontSize: 9.5, marginTop: space.s3, textAlign: 'center' },

  /* ---- highlights ---- */
  hlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  hl: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    width: '48.6%',
    flexGrow: 1,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  hlValue: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0.2,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  hlLabel: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: 3 },

  /* ---- awards ---- */
  awards: {
    marginTop: space.s6,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 60%, #0D0C07 100%)',
    boxShadow: '0px 10px 26px rgba(0,0,0,0.42)',
    overflow: 'hidden',
    gap: space.s2,
  },
  awardsKey: { ...text.key, fontSize: 10, color: color.gold, marginBottom: space.s1 },
  aw: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.20)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  awTop: {
    borderColor: 'rgba(214,178,94,0.48)',
    backgroundColor: 'rgba(214,178,94,0.09)',
  },
  awMark: { fontSize: 22, lineHeight: 28, width: 28, textAlign: 'center' },
  awBody: { flex: 1, minWidth: 0 },
  awLabel: { ...text.key, fontSize: 8.5, color: color.text3 },
  awName: {
    fontFamily: font.displayBold,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
    marginTop: 1,
  },
  awStat: { ...text.small, fontSize: 12, color: color.gold },

  /* ---- player statistics ---- */
  players: { gap: space.s2 },
  pl: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  plPos: {
    width: 38,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plPosText: { ...text.key, fontSize: 9 },
  plRtg: {
    width: 32,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,197,126,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(31,197,126,0.32)',
  },
  plRtgText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    color: color.accentHi,
    fontVariant: ['tabular-nums'],
  },
  plName: { flex: 1, minWidth: 0 },
  plNameText: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  plClub: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },
  plStat: { alignItems: 'center', minWidth: 34 },
  plStatValue: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  plStatLabel: { ...text.key, fontSize: 7.5, color: color.text3 },

  /* ---- achievements just earned ---- */
  unlocked: {
    marginTop: space.s5,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 60%, #0D0C07 100%)',
    gap: space.s2,
  },
  unlockedKey: { ...text.key, fontSize: 10, color: color.gold, marginBottom: 2 },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  unlockMark: { fontSize: 22, lineHeight: 28, width: 28, textAlign: 'center' },
  unlockBody: { flex: 1, minWidth: 0 },
  unlockName: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    color: color.text1,
  },
  unlockDesc: { ...text.small, fontSize: 12 },

  /* ---- the cups ---- */
  cups: { gap: space.s3 },

  /* ---- the fixture list ---- */
  fixWrap: {
    marginTop: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    overflow: 'hidden',
  },
  fixHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: space.s3,
    paddingHorizontal: space.s4,
  },
  fixTitle: {
    flex: 1,
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    color: color.text1,
  },
  fixForm: { flexDirection: 'row', gap: 4 },
  fixDot: { width: 7, height: 7, borderRadius: 3.5 },
  fixRecord: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  fixChev: { fontSize: 9, color: color.text3, width: 12, textAlign: 'right' },
  fixList: { paddingBottom: space.s2 },
  fixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingVertical: 9,
    paddingHorizontal: space.s4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  fixMd: {
    width: 20,
    textAlign: 'right',
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  fixVenue: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixVenueText: {
    fontFamily: font.displaySemi,
    fontSize: 10,
    lineHeight: 13,
    color: color.text3,
  },
  fixOpp: {
    flex: 1,
    fontFamily: font.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  fixScore: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  fixPip: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixPipText: { fontFamily: font.displayBold, fontSize: 11, lineHeight: 14 },
  fixHint: {
    ...text.small,
    fontSize: 11,
    textAlign: 'center',
    paddingTop: space.s3,
  },

  /* ---- the table ---- */
  table: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
    overflow: 'hidden',
  },
  thead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.s2,
    paddingRight: space.s3,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  th: { ...text.key, fontSize: 8.5, color: color.text3 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingRight: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  zone: { width: 3, alignSelf: 'stretch', marginRight: space.s2 },
  td: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  tdPts: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  colPos: { width: 22, textAlign: 'center' },
  colClub: { flex: 1, paddingLeft: space.s2 },
  colNum: { width: 24, textAlign: 'center' },
  colGd: { width: 38, textAlign: 'right' },
  colPts: { width: 34, textAlign: 'right' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s3,
    padding: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  key: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  keyDot: { width: 8, height: 8, borderRadius: 2 },
  keyText: { ...text.key, fontSize: 8, color: color.text3 },

  /* ---- actions ---- */
  offscreen: { position: 'absolute', left: -CARD_W * 4, top: 0, opacity: 0 },
  cta: { marginTop: space.s6, gap: space.s3, paddingBottom: space.s5 },
  dynasty: {
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(185,140,242,0.10)',
    gap: 2,
  },
  dynastyText: { ...text.button, color: color.purple },
  dynastySub: { ...text.small, fontSize: 11 },
  share: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  shareText: { ...text.button },
  again: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    experimental_backgroundImage: gradient.cardLift,
  },
  againText: { ...text.button },
  home: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
  },
  homeText: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: color.text2,
  },
});
