import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ModeScreen, Press, Rise, Shine, Confetti } from '../../src/ui/components';
import { back, enter } from '../../src/game/nav';
import { color, space, radius, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { ucl as sky } from '../../src/ui/ucl';
import { haptic } from '../../src/ui/feel';
import {
  UCL_STAGE_NAME,
  uclExpected,
  uclGoldenBoot,
  uclNameOf,
  uclRatingOf,
  uclScorers,
  uclSummary,
  uclVerdict,
} from '../../src/engine';
import { clearUcl, useUcl } from '../../src/game/ucl';

/**
 * How the campaign went.
 *
 * The badge is the point. Winning it with Bayern and winning it with
 * Slovan Bratislava are not the same achievement, so the verdict is
 * measured against what a club of that strength should have managed
 * rather than against the trophy.
 */
export default function UclReport() {
  const run = useUcl();

  if (!run) {
    return (
      <ModeScreen overline="Champions League" title="Report" onBack={() => back()}>
        <Text style={styles.none}>No campaign to report on.</Text>
      </ModeScreen>
    );
  }

  const me = uclNameOf(run, run.you);
  const sum = uclSummary(run);
  const verdict = uclVerdict(run);
  const scorers = uclScorers(run).slice(0, 6);
  const boot = uclGoldenBoot(run);
  const want = uclExpected(uclRatingOf(run, run.you));
  const tint = verdict === 'over' ? sky.blue : verdict === 'under' ? sky.out : sky.silver;

  return (
    <ModeScreen overline="Champions League" title="The campaign" scroll onBack={() => back()}>
      {run.won ? <Confetti fire /> : null}

      <View style={styles.hero}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="uclrep" cx="50%" cy="24%" r="85%">
                <Stop offset="0" stopColor={run.won ? sky.gold : tint} stopOpacity={0.24} />
                <Stop offset="1" stopColor={run.won ? sky.gold : tint} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#uclrep)" />
          </Svg>
        </View>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />

        <Text style={styles.trophy} allowFontScaling={false}>
          {run.won ? '🏆' : '★'}
        </Text>
        <Text style={styles.club} numberOfLines={1}>
          {me}
        </Text>
        <Text style={styles.outcome}>
          {run.won ? 'Champions of Europe' : `Out at the ${UCL_STAGE_NAME[run.outAt ?? 'league']}`}
        </Text>
        <View style={[styles.badge, { borderColor: alpha(tint, 0.6) }]}>
          <Text style={[styles.badgeText, { color: tint }]} allowFontScaling={false}>
            {verdict === 'over'
              ? 'OVERPERFORMED'
              : verdict === 'under'
                ? 'UNDERPERFORMED'
                : 'AS EXPECTED'}
          </Text>
        </View>
        <Text style={styles.expected}>
          A club rated {Math.round(uclRatingOf(run, run.you))} is expected to reach the{' '}
          {UCL_STAGE_NAME[want]}
        </Text>
      </View>

      <Text style={[text.label, styles.sect]}>The numbers</Text>
      <View style={styles.grid}>
        <Stat label="Played" value={String(sum.played)} />
        <Stat label="Won" value={String(sum.w)} />
        <Stat label="Drawn" value={String(sum.d)} />
        <Stat label="Lost" value={String(sum.l)} />
        <Stat label="Scored" value={String(sum.gf)} />
        <Stat label="Conceded" value={String(sum.ga)} />
        <Stat label="Clean sheets" value={String(sum.cleanSheets)} />
        <Stat
          label="League phase"
          value={run.order.length ? `${run.order.indexOf(run.you) + 1}${suffix(run.order.indexOf(run.you) + 1)}` : '-'}
        />
      </View>

      {scorers.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Your scorers</Text>
          <View style={styles.card}>
            {scorers.map((s, i) => (
              <Rise key={`${s.n}-${i}`} delay={Math.min(i, 6)}>
                <View style={styles.scorer}>
                  <Text style={styles.scorerName} numberOfLines={1}>
                    {s.n}
                  </Text>
                  <Text style={styles.scorerNum} allowFontScaling={false}>
                    {s.g} {s.g === 1 ? 'goal' : 'goals'}
                    {s.a ? ` · ${s.a} ${s.a === 1 ? 'assist' : 'assists'}` : ''}
                  </Text>
                </View>
              </Rise>
            ))}
          </View>
        </>
      ) : null}

      {boot.n ? (
        <>
          <Text style={[text.label, styles.sect]}>Top scorer in Europe</Text>
          <View style={styles.card}>
            <View style={styles.scorer}>
              <Text style={styles.scorerName} numberOfLines={1}>
                {boot.n}
              </Text>
              <Text style={styles.scorerNum} allowFontScaling={false}>
                {boot.goals} goals {'·'} {boot.club}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {/* A campaign a career owns goes back to the career. Its result is
          already written there, and starting another one from here would
          throw away the season it belongs to. */}
      <Press
        onPress={() => {
          haptic('medium');
          if (run.owner) {
            enter('/dynasty');
            return;
          }
          clearUcl();
          enter('/ucl');
        }}
        feel="medium"
        scaleTo={0.98}
        style={styles.go}
      >
        <Text style={styles.goText}>
          {run.owner ? `Back to ${run.owner.club}` : 'Another campaign'}
        </Text>
      </Press>
      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function suffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.ink,
    overflow: 'hidden',
    gap: 3,
  },
  trophy: { fontSize: 40, lineHeight: 50 },
  club: { fontFamily: font.displayBlack, fontSize: 26, lineHeight: 33, color: color.text1 },
  outcome: { ...text.button, fontSize: 15, color: sky.silver },
  badge: {
    marginTop: space.s3,
    paddingHorizontal: space.s4,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  badgeText: { ...text.key, fontSize: 9.5 },
  expected: {
    ...text.small,
    fontSize: 12,
    lineHeight: 17,
    color: color.text3,
    textAlign: 'center',
    marginTop: space.s2,
  },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%', rowGap: space.s2 },
  stat: {
    width: '23.5%',
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
    gap: 2,
  },
  statValue: {
    fontFamily: font.displayBlack,
    fontSize: 21,
    lineHeight: 27,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  statLabel: { ...text.key, fontSize: 6.5, color: color.text3, textAlign: 'center' },

  card: {
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: sky.edge,
    backgroundColor: sky.panel,
  },
  scorer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.s3,
    minHeight: 40,
  },
  scorerName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 20,
    color: color.text1,
  },
  scorerNum: { ...text.small, fontSize: 12, color: sky.blue },

  none: { ...text.small, fontSize: 13, color: color.text3 },
  go: {
    marginTop: space.s5,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
  },
  goText: { ...text.button, fontSize: 15, color: sky.blue },
});
