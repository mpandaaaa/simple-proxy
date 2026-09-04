import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ClubDisc, ModeScreen, MatchLive, Shine } from '../../src/ui/components';
import { swap, upTo } from '../../src/game/nav';
import { color, line, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import {
  CUP_ROUND_NAME,
  cupSide,
  cupSquad,
  type CupPlayed,
  type MatchResult,
} from '../../src/engine';
import { buildTournament } from '../../src/game/tournamentMatch';
import { playNextTie, useCup } from '../../src/game/cup';
import { settingsStore } from '../../src/save';

/**
 * One night, between two sides that never met.
 *
 * The same broadcast as the two tournaments, in the league's own colours,
 * because a cup tie between two Premier League sides is a Premier League
 * night whatever season either of them came from.
 */
export default function CupMatch() {
  const run = useCup();
  const [step, setStep] = useState<CupPlayed | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const got = playNextTie();
    if (!got) {
      swap('/cup/hub');
      return;
    }
    setStep(got);
    haptic('medium');
  }, []);

  const me = useMemo(() => (step ? cupSide(step.match.a) : null), [step]);
  const them = useMemo(() => (step ? cupSide(step.match.b) : null), [step]);

  const tape = useMemo(() => {
    if (!step || !me || !them) return null;
    const m = step.match;
    const squad = (key: string) =>
      cupSquad(key).map((p) => ({ n: p.n, pos: p.pos, rtg: p.rtg }));
    return buildTournament({
      seed: step.run.seed,
      n: Math.max(0, step.run.played.length - 1),
      comp: CUP_ROUND_NAME[m.round],
      me: { name: `${me.club} ${me.season}`, rating: me.rating, squad: squad(m.a) },
      opp: { name: `${them.club} ${them.season}`, rating: them.rating, squad: squad(m.b) },
      gf: m.ga,
      ga: m.gb,
      gf90: m.ga90,
      ga90: m.gb90,
      et: m.et,
      pens: m.pens,
      scorers: [],
      voice: settingsStore.read().voice,
    });
  }, [step, me, them]);

  const shaped: MatchResult | null = useMemo(() => {
    if (!step || !them) return null;
    const x = step.match;
    const won = x.pens ? x.pens.a > x.pens.b : x.ga > x.gb;
    const lost = x.pens ? x.pens.a < x.pens.b : x.ga < x.gb;
    return {
      n: step.run.played.length,
      opp: them.club,
      home: false,
      gf: x.ga,
      ga: x.gb,
      oc: won ? 'win' : lost ? 'loss' : 'draw',
      scorers: [],
      xgF: 0,
      xgA: 0,
    };
  }, [step, them]);

  const sides = useMemo(
    () => (me && them ? { me: { name: me.club }, opp: { name: them.club } } : null),
    [me, them],
  );

  if (!run || !step || !me || !them || !tape || !shaped || !sides) {
    return (
      <ModeScreen overline="The Cup" title="Kick off" scroll={false} onBack={() => upTo('/cup/hub')}>
        <View />
      </ModeScreen>
    );
  }

  const m = step.match;
  const after = step.run;

  return (
    <ModeScreen
      overline={CUP_ROUND_NAME[m.round]}
      title="Kick off"
      scroll={false}
      onBack={() => upTo('/cup/hub')}
    >
      <View style={styles.card}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <View style={styles.sides}>
          <View style={styles.side}>
            <ClubDisc club={me.club} size={44} />
            <Text style={styles.name} numberOfLines={2}>
              {me.club}
            </Text>
            <Text style={styles.rate}>
              {me.season} {'·'} {me.rating}
            </Text>
          </View>
          <Text style={styles.versus}>v</Text>
          <View style={styles.side}>
            <ClubDisc club={them.club} size={44} />
            <Text style={styles.name} numberOfLines={2}>
              {them.club}
            </Text>
            <Text style={styles.rate}>
              {them.season} {'·'} {them.rating}
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
        comp={`The Cup · ${CUP_ROUND_NAME[m.round]} · Neutral`}
        sides={sides}
        doneLabel={after.over ? 'How it finished' : 'Back to the bracket'}
        onDone={() => {
          haptic('light');
          upTo('/cup/hub');
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
    borderColor: line.gold,
    backgroundColor: '#12100A',
    overflow: 'hidden',
  },
  sides: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', gap: 5 },
  name: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 22,
    color: color.text1,
    textAlign: 'center',
  },
  rate: { ...text.key, fontSize: 7.5, color: color.text3, textAlign: 'center' },
  versus: {
    fontFamily: font.displayBold,
    fontSize: 20,
    color: color.gold,
    paddingHorizontal: space.s2,
  },
});
