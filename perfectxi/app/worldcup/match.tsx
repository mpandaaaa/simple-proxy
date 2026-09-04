import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ModeScreen, MatchLive, Shine } from '../../src/ui/components';
import { back, swap } from '../../src/game/nav';
import { color, space, radius, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import {
  STAGE_NAME,
  flagIn,
  nameIn,
  ratingIn,
  squadIn,
  wcTeam,
  type MatchResult,
  type WcPlayed,
} from '../../src/engine';
import { buildTournament } from '../../src/game/tournamentMatch';
import { playNextMatch, useWorldCup } from '../../src/game/worldcup';

/**
 * One match.
 *
 * The whole reason the World Cup is its own mode. A league season is
 * thirty eight results arriving; this is one match, and it gets a screen
 * to itself, played out minute by minute in the same broadcast the league
 * uses, because a World Cup night should not look like a different game.
 *
 * The result is decided the instant you arrive, before a pixel of it is
 * drawn, because a phone that dies on the hour has to come back to the
 * same score. Everything the broadcast shows is the story of a result that
 * already exists, which is the only honest way to animate one.
 */
export default function WorldCupMatch() {
  const run = useWorldCup();
  const [step, setStep] = useState<WcPlayed | null>(null);
  const fired = useRef(false);

  /* Played once, on arrival, and banked before anything is shown. */
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const got = playNextMatch();
    if (!got) {
      swap('/worldcup/hub');
      return;
    }
    setStep(got);
    haptic('medium');
  }, []);

  /* Your side is whoever you took charge of, which for a drafted run is
     your own eleven wearing somebody else's flag. */
  const me = step
    ? {
        n: nameIn(step.run, step.match.a),
        f: flagIn(step.run, step.match.a),
        r: ratingIn(step.run, step.match.a),
      }
    : null;
  const them = step ? wcTeam(step.match.b) : null;

  /* The ninety minutes, with whatever a knockout added on top. */
  const tape = useMemo(() => {
    if (!step || !me || !them) return null;
    const m = step.match;
    return buildTournament({
      seed: step.run.seed,
      n: Math.max(0, step.run.played.length - 1),
      comp: STAGE_NAME[m.stage],
      me: { name: me.n, rating: me.r, squad: squadIn(step.run, m.a) },
      opp: { name: them.n, rating: them.r, squad: squadIn(step.run, m.b) },
      gf: m.ga,
      ga: m.gb,
      gf90: typeof m.ga90 === 'number' ? m.ga90 : m.ga,
      ga90: typeof m.gb90 === 'number' ? m.gb90 : m.gb,
      et: Boolean(m.et),
      pens: m.pens,
      scorers: step.scorers,
    });
  }, [step, me, them]);

  if (!run || !step || !me || !them || !tape) {
    return (
      <ModeScreen overline="World Cup 2026" title="Kick off" scroll={false} onBack={() => back()}>
        <View />
      </ModeScreen>
    );
  }

  const m = step.match;
  const won = m.pens ? m.pens.a > m.pens.b : m.ga > m.gb;
  const lost = m.pens ? m.pens.a < m.pens.b : m.ga < m.gb;

  /* The broadcast wants a league fixture. This is the same match wearing
     that shape: the score, and who it went to. */
  const shaped: MatchResult = {
    n: step.run.played.length,
    opp: them.n,
    home: true,
    gf: m.ga,
    ga: m.gb,
    oc: won ? 'win' : lost ? 'loss' : 'draw',
    scorers: [],
    xgF: 0,
    xgA: 0,
  };

  const after = step.run;

  return (
    <ModeScreen
      overline={STAGE_NAME[m.stage]}
      title="Kick off"
      scroll={false}
      onBack={() => back()}
    >
      {/* What sits behind the broadcast, and what you come back to if it
          is closed before it has finished. */}
      <View style={styles.card}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="wcm" cx="50%" cy="26%" r="80%">
                <Stop offset="0" stopColor={hue.gold} stopOpacity={0.16} />
                <Stop offset="1" stopColor={hue.gold} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#wcm)" />
          </Svg>
        </View>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

        <View style={styles.sides}>
          <View style={styles.side}>
            <Text style={styles.flag} allowFontScaling={false}>
              {me.f}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {me.n}
            </Text>
            <Text style={styles.rate}>Rated {me.r}</Text>
          </View>
          <Text style={styles.versus}>v</Text>
          <View style={styles.side}>
            <Text style={styles.flag} allowFontScaling={false}>
              {them.f}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {them.n}
            </Text>
            <Text style={styles.rate}>Rated {them.r}</Text>
          </View>
        </View>
      </View>

      <MatchLive
        match={shaped}
        tape={tape}
        seed={step.run.seed}
        live
        visible
        comp={`World Cup 2026 · ${STAGE_NAME[m.stage]}${m.group ? ` · Group ${m.group}` : ''}`}
        sides={{ me: { name: me.n, flag: me.f }, opp: { name: them.n, flag: them.f } }}
        doneLabel={after.over ? 'The tournament report' : 'Back to the tournament'}
        onDone={() => {
          haptic('light');
          swap('/worldcup/hub');
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
    borderColor: alpha(hue.gold, 0.4),
    backgroundColor: '#0B100C',
    overflow: 'hidden',
  },
  sides: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, alignItems: 'center', gap: 1 },
  flag: { fontSize: 40, lineHeight: 50 },
  name: {
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: color.text1,
    textAlign: 'center',
  },
  rate: { ...text.key, fontSize: 7.5, color: color.text3 },
  versus: { fontFamily: font.displayBold, fontSize: 20, color: color.text3, paddingHorizontal: space.s2 },
});
