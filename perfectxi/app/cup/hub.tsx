import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ClubDisc, Confetti, ModeScreen, Press, Rise, Shine } from '../../src/ui/components';
import { enter, go, home, swap } from '../../src/game/nav';
import { alpha, color, hue, line, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import {
  CUP_ROUNDS,
  CUP_ROUND_NAME,
  cupReached,
  cupSide,
  type CupMatch,
  type CupRound,
} from '../../src/engine';
import { clearCup, useCup } from '../../src/game/cup';

/**
 * The bracket.
 *
 * Four rounds and fifteen ties, and every one of them is settled the
 * moment yours is, because the screen shows the whole draw and the next
 * opponent has to be a real one. Your own tie is the one with a button
 * on it.
 */
export default function CupHub() {
  const run = useCup();

  if (!run) {
    return (
      <ModeScreen overline="Any era, any club" title="The Cup" onBack={() => home()}>
        <Text style={styles.none}>No cup on the go.</Text>
        <Press
          onPress={() => {
            haptic('light');
            swap('/cup');
          }}
          feel="medium"
          scaleTo={0.98}
          style={styles.go}
        >
          <Text style={styles.goText}>Fill a bracket</Text>
        </Press>
      </ModeScreen>
    );
  }

  const me = cupSide(run.you);
  const next = run.ahead;
  const opp = next ? cupSide(next.b) : null;
  const reached = cupReached(run);
  const tint = run.won ? color.gold : run.over ? hue.crimson : color.gold;

  return (
    <ModeScreen
      overline={CUP_ROUND_NAME[run.round]}
      title={me ? me.club : 'The Cup'}
      onBack={() => home()}
    >
      {run.won ? <Confetti fire /> : null}

      {/* ================= who you are ================= */}
      <View style={styles.crest}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="cuphub" cx="50%" cy="20%" r="85%">
                <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
                <Stop offset="1" stopColor={tint} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#cuphub)" />
          </Svg>
        </View>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

        <ClubDisc club={me?.club} size={56} />
        <Text style={styles.club} numberOfLines={1}>
          {me?.club}
        </Text>
        <Text style={styles.season}>
          {me?.season} {'·'} rated {me?.rating}
        </Text>
        <Text style={[styles.now, { color: tint }]}>
          {run.over
            ? run.won
              ? 'Winners.'
              : `Out in the ${CUP_ROUND_NAME[run.outAt ?? 'r16']}.`
            : CUP_ROUND_NAME[run.round]}
        </Text>
      </View>

      {/* ================= how far ================= */}
      <View style={styles.rail}>
        {CUP_ROUNDS.map((r, i) => {
          const done = run.over ? i <= reached && !(run.over && !run.won && i > reached) : i < reached;
          const lit = run.won ? true : run.over ? i <= reached : i < reached;
          const here = !run.over && r === run.round;
          void done;
          return (
            <View key={r} style={styles.railStep}>
              <View
                style={[
                  styles.railDot,
                  lit ? { backgroundColor: color.gold, borderColor: color.gold } : null,
                  here ? { borderColor: color.gold } : null,
                ]}
              >
                <Text
                  style={[
                    styles.railText,
                    lit ? { color: '#12100A' } : null,
                    here ? { color: color.gold } : null,
                  ]}
                  allowFontScaling={false}
                >
                  {r === 'r16' ? '16' : r === 'qf' ? 'QF' : r === 'sf' ? 'SF' : 'F'}
                </Text>
              </View>
              {i < CUP_ROUNDS.length - 1 ? (
                <View style={[styles.railLine, i < reached ? { backgroundColor: color.gold } : null]} />
              ) : null}
            </View>
          );
        })}
        <Text style={[styles.trophy, run.won ? { color: color.gold } : null]} allowFontScaling={false}>
          🏆
        </Text>
      </View>

      {/* ================= your tie ================= */}
      {next && opp && !run.over ? (
        <Rise delay={0}>
          <Press
            onPress={() => {
              haptic('medium');
              go('/cup/match');
            }}
            feel="none"
            scaleTo={0.98}
            style={styles.nextCard}
          >
            <Text style={styles.nextKey}>{CUP_ROUND_NAME[next.round].toUpperCase()}</Text>
            <View style={styles.nextWho}>
              <ClubDisc club={opp.club} size={40} />
              <View style={styles.nextBody}>
                <Text style={styles.nextName} numberOfLines={1}>
                  {opp.club}
                </Text>
                <Text style={styles.nextMeta} numberOfLines={1}>
                  {opp.season} {'·'} rated {opp.rating}
                </Text>
              </View>
            </View>
            <View style={styles.play}>
              <Text style={styles.playText}>Play it</Text>
            </View>
          </Press>
        </Rise>
      ) : null}

      {run.over ? (
        <Press
          onPress={() => {
            haptic('medium');
            clearCup();
            enter('/cup');
          }}
          feel="medium"
          scaleTo={0.98}
          style={styles.go}
        >
          <Text style={styles.goText}>Another cup</Text>
        </Press>
      ) : null}

      {/* ================= the draw ================= */}
      {CUP_ROUNDS.map((r) => {
        const ties = run.results.filter((m) => m.round === r);
        if (!ties.length) return null;
        return (
          <View key={r}>
            <Text style={[text.label, styles.sect]}>{CUP_ROUND_NAME[r]}</Text>
            <View style={styles.card}>
              {ties.map((m, i) => (
                <Tie key={`${r}-${i}`} match={m} you={run.you} />
              ))}
            </View>
          </View>
        );
      })}

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

/** One tie in the draw, with the winner in bold. */
function Tie({ match, you }: { match: CupMatch; you: string }) {
  const a = cupSide(match.a);
  const b = cupSide(match.b);
  const aWon = match.pens ? match.pens.a > match.pens.b : match.ga > match.gb;
  const mine = match.a === you || match.b === you;

  return (
    <View style={[styles.tie, mine ? styles.tieMine : null]}>
      <Text
        style={[styles.tieName, aWon ? styles.tieWon : null]}
        numberOfLines={1}
      >
        {a?.club} {a?.season.slice(0, 2)}
      </Text>
      <Text style={styles.tieScore} allowFontScaling={false}>
        {match.ga}-{match.gb}
        {match.pens ? ` (${match.pens.a}-${match.pens.b}p)` : match.et ? ' aet' : ''}
      </Text>
      <Text
        style={[styles.tieName, styles.tieRight, !aWon ? styles.tieWon : null]}
        numberOfLines={1}
      >
        {b?.club} {b?.season.slice(0, 2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  crest: {
    alignItems: 'center',
    paddingVertical: space.s4,
    paddingHorizontal: space.s3,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#12100A',
    overflow: 'hidden',
    gap: 2,
  },
  club: {
    fontFamily: font.displayBlack,
    fontSize: 25,
    lineHeight: 32,
    color: color.text1,
    marginTop: space.s2,
  },
  season: { ...text.key, fontSize: 8, color: color.text3 },
  now: { ...text.button, fontSize: 14, marginTop: space.s2 },

  rail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: space.s3,
    paddingHorizontal: 2,
  },
  railStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  railDot: {
    minWidth: 34,
    height: 26,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  railText: { ...text.key, fontSize: 8, color: color.text3 },
  railLine: { flex: 1, height: 1.5, backgroundColor: 'rgba(255,255,255,0.12)' },
  trophy: { fontSize: 17, marginLeft: 4, opacity: 0.9 },

  nextCard: {
    marginTop: space.s3,
    padding: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: alpha(color.gold, 0.1),
    gap: 2,
  },
  nextKey: { ...text.key, fontSize: 8, color: color.gold },
  nextWho: { flexDirection: 'row', alignItems: 'center', gap: space.s3, marginTop: space.s2 },
  nextBody: { flex: 1, minWidth: 0, gap: 1 },
  nextName: { fontFamily: font.displayBlack, fontSize: 22, lineHeight: 29, color: color.text1 },
  nextMeta: { ...text.small, fontSize: 12, lineHeight: 17, color: color.text2 },
  play: {
    marginTop: space.s3,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.gold,
  },
  playText: { ...text.button, fontSize: 15, color: '#12100A' },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  card: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    minHeight: 34,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  tieMine: { backgroundColor: alpha(color.gold, 0.11) },
  tieName: {
    flex: 1,
    minWidth: 0,
    ...text.small,
    fontSize: 11.5,
    lineHeight: 16,
    color: color.text3,
  },
  tieRight: { textAlign: 'right' },
  tieWon: { fontFamily: font.displayBold, color: color.text1 },
  tieScore: {
    fontFamily: font.displayBold,
    fontSize: 11.5,
    color: color.text2,
    fontVariant: ['tabular-nums'],
    minWidth: 72,
    textAlign: 'center',
  },

  none: { ...text.small, fontSize: 13, color: color.text3, marginBottom: space.s4 },
  go: {
    marginTop: space.s4,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: alpha(color.gold, 0.14),
  },
  goText: { ...text.button, fontSize: 15, color: color.gold },
});
