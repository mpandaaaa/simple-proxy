import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ModeScreen, MatchLive, Shine } from '../../src/ui/components';
import { swap, upTo } from '../../src/game/nav';
import { color, space, radius } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { ucl as sky, uclNight } from '../../src/ui/ucl';
import { haptic } from '../../src/ui/feel';
import {
  UCL_MATCHDAYS,
  UCL_STAGE_NAME,
  uclClub,
  uclNameOf,
  uclRatingOf,
  uclSquadOf,
  type MatchResult,
  type UclPlayed,
} from '../../src/engine';
import { buildTournament } from '../../src/game/tournamentMatch';
import { playNextUcl, useUcl } from '../../src/game/ucl';

/**
 * One European night.
 *
 * The same broadcast as everywhere else, in the competition's own colours,
 * because a Champions League tie should not look like a Saturday in the
 * Premier League. The result is decided the instant you arrive and banked
 * before a pixel of it is drawn, so a phone that dies on the hour comes
 * back to the same score.
 */
export default function UclMatch() {
  const run = useUcl();
  const [step, setStep] = useState<UclPlayed | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const got = playNextUcl();
    if (!got) {
      swap('/ucl/hub');
      return;
    }
    setStep(got);
    haptic('medium');
  }, []);

  /* Held rather than rebuilt: a new object every render would restart the
     broadcast every render. */
  const me = useMemo(
    () =>
      step
        ? {
            n: uclNameOf(step.run, step.match.a),
            r: uclRatingOf(step.run, step.match.a),
          }
        : null,
    [step],
  );
  const them = useMemo(
    () =>
      step
        ? { n: step.match.b, r: uclRatingOf(step.run, step.match.b) }
        : null,
    [step],
  );

  const tape = useMemo(() => {
    if (!step || !me || !them) return null;
    const m = step.match;
    return buildTournament({
      seed: step.run.seed,
      n: Math.max(0, step.run.played.length - 1),
      comp: UCL_STAGE_NAME[m.stage],
      me: { name: me.n, rating: me.r, squad: uclSquadOf(step.run, m.a) },
      opp: { name: them.n, rating: them.r, squad: uclSquadOf(step.run, m.b) },
      gf: m.ga,
      ga: m.gb,
      gf90: typeof m.ga90 === 'number' ? m.ga90 : m.ga,
      ga90: typeof m.gb90 === 'number' ? m.gb90 : m.gb,
      et: Boolean(m.et),
      pens: m.pens,
      scorers: step.scorers,
    });
  }, [step, me, them]);

  const shaped: MatchResult | null = useMemo(() => {
    if (!step || !them) return null;
    const x = step.match;
    const won = x.pens ? x.pens.a > x.pens.b : x.ga > x.gb;
    const lost = x.pens ? x.pens.a < x.pens.b : x.ga < x.gb;
    return {
      n: step.run.played.length,
      opp: them.n,
      home: x.home,
      gf: x.ga,
      ga: x.gb,
      oc: won ? 'win' : lost ? 'loss' : 'draw',
      scorers: [],
      xgF: 0,
      xgA: 0,
    };
  }, [step, them]);

  const sides = useMemo(
    () => (me && them ? { me: { name: me.n }, opp: { name: them.n } } : null),
    [me, them],
  );

  if (!run || !step || !me || !them || !tape || !shaped || !sides) {
    return (
      <ModeScreen overline="Champions League" title="Kick off" scroll={false} onBack={() => upTo('/ucl/hub')}>
        <View />
      </ModeScreen>
    );
  }

  const m = step.match;
  const after = step.run;

  /* What the line above the scoreline says, which in a two legged tie has
     to carry the leg or you cannot tell one night from the other. */
  const comp =
    m.stage === 'league'
      ? `Champions League · Matchday ${m.n + 1} of ${UCL_MATCHDAYS} · ${m.home ? 'Home' : 'Away'}`
      : m.stage === 'final'
        ? 'Champions League · The Final · Neutral'
        : `Champions League · ${UCL_STAGE_NAME[m.stage]} · Leg ${m.n} · ${m.home ? 'Home' : 'Away'}`;

  return (
    <ModeScreen
      overline={UCL_STAGE_NAME[m.stage]}
      title="Kick off"
      scroll={false}
      onBack={() => upTo('/ucl/hub')}
    >
      {/* What sits behind the broadcast, and what you come back to if it is
          closed before it has finished. */}
      <View style={styles.card}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="uclm" cx="50%" cy="26%" r="80%">
                <Stop offset="0" stopColor={sky.blue} stopOpacity={0.18} />
                <Stop offset="1" stopColor={sky.blue} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#uclm)" />
          </Svg>
        </View>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

        <View style={styles.sides}>
          <View style={styles.side}>
            <Text style={styles.name} numberOfLines={2}>
              {me.n}
            </Text>
            <Text style={styles.rate}>Rated {Math.round(me.r)}</Text>
          </View>
          <Text style={styles.versus}>v</Text>
          <View style={styles.side}>
            <Text style={styles.name} numberOfLines={2}>
              {them.n}
            </Text>
            <Text style={styles.rate}>
              Rated {Math.round(them.r)} {'·'} {uclClub(them.n)?.country ?? ''}
            </Text>
          </View>
        </View>
      </View>

      <MatchLive
        match={shaped}
        tape={tape}
        seed={step.run.seed}
        live
        visible
        night={uclNight}
        comp={comp}
        sides={sides}
        doneLabel={after.over ? 'The campaign report' : 'Back to the campaign'}
        onDone={() => {
          haptic('light');
          upTo('/ucl/hub');
        }}
      />
    </ModeScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: space.s5,
    paddingHorizontal: space.s3,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.ink,
    overflow: 'hidden',
  },
  sides: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', gap: 3 },
  name: {
    fontFamily: font.displayBold,
    fontSize: 17,
    lineHeight: 23,
    color: color.text1,
    textAlign: 'center',
  },
  rate: { ...text.key, fontSize: 7.5, color: color.text3, textAlign: 'center' },
  versus: {
    fontFamily: font.displayBold,
    fontSize: 20,
    color: sky.blue,
    paddingHorizontal: space.s2,
  },
});
