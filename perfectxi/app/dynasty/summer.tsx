import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  Ticker,
  Confetti,
  Trophy,
} from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  asSquad,
  chemBonus,
  mulberry32,
  processSeasonEnd,
  simulateSeason,
  starters,
  type DynastyPlayer,
  type SummerReport,
} from '../../src/engine';
import { getCareer, setCareer } from '../../src/game/career';
import { clearSeasonResult, takeSeasonResult } from '../../src/game/careerSeason';

/**
 * The summer.
 *
 * A year happens to the whole club at once and this is the only place you
 * see it. The books close, the board decides what it thinks of you, the
 * squad ages, contracts run out and an intake comes through.
 *
 * Ordered by what you cannot undo. The board first, because it can end the
 * career. Then the money, then the players.
 */
export default function Summer() {
  const done = useRef(false);
  const [state, setState] = useState<{ report: SummerReport; year: number; club: string } | null>(
    null,
  );

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const career = getCareer();
    if (!career) {
      router.replace('/dynasty');
      return;
    }

    /* The season is a pure function of the career and the year, so if the
       handoff is gone, which it is after the app has been closed, it can
       be played again and comes out identical. Without this a career that
       was shut down between the last match and the summer could never be
       advanced. */
    const result =
      takeSeasonResult() ??
      (() => {
        const xi = starters(career);
        if (xi.length < 11) return null;
        const rnd = mulberry32((career.seed ^ Math.imul(career.year, 0x9e3779b1)) >>> 0);
        const squad = asSquad(xi);
        return simulateSeason(squad, career.tactic.form, chemBonus(squad), rnd);
      })();

    if (!result) {
      router.replace('/dynasty');
      return;
    }

    const out = processSeasonEnd(career, result);
    setCareer(out.dynasty);
    clearSeasonResult();
    setState({ report: out.report, year: career.year, club: career.club });

    haptic(out.report.sacked ? 'error' : out.report.met ? 'success' : 'warning');
    sfx(out.report.sacked ? 'lose' : out.report.met ? 'win' : 'ft');
  }, []);

  const report = state?.report ?? null;
  const swing = useMemo(
    () => (report ? report.after - report.before : 0),
    [report],
  );

  if (!report || !state) return null;
  const champion = report.met && report.ledger.deduction === 0 && swing >= 0;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ModeScreen
        overline={`After season ${state.year}`}
        title="The summer"
        onBack={() => router.replace('/dynasty')}
      >
        {/* ---- the board ---- */}
        <View
          style={[
            styles.verdict,
            {
              borderColor: report.sacked
                ? line.danger
                : report.met
                  ? line.accent
                  : 'rgba(245,165,36,0.4)',
            },
          ]}
        >
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <View style={styles.bloom} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="sumBloom" cx="50%" cy="50%" r="50%">
                  <Stop
                    offset="0"
                    stopColor={report.sacked ? color.danger : report.met ? color.accent : color.warning}
                    stopOpacity={0.28}
                  />
                  <Stop
                    offset="1"
                    stopColor={report.sacked ? color.danger : report.met ? color.accent : color.warning}
                    stopOpacity={0}
                  />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50" cy="4" rx="66" ry="44" fill="url(#sumBloom)" />
            </Svg>
          </View>
          <View style={styles.grain} pointerEvents="none">
            <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
          </View>

          {report.met && !report.sacked ? <Trophy size={64} tint={color.accent} /> : null}
          <Text style={styles.verdictKey}>The board</Text>
          <Text
            style={[
              styles.verdictTitle,
              {
                color: report.sacked
                  ? color.danger
                  : report.met
                    ? color.accent
                    : color.warning,
              },
            ]}
          >
            {report.sacked
              ? 'You are sacked'
              : report.met
                ? 'Objective met'
                : 'Objective missed'}
          </Text>
          <Text style={styles.verdictSwing}>
            Confidence {report.mgrSwing >= 0 ? 'up' : 'down'} {Math.abs(report.mgrSwing)}
            {report.deduction ? `, and ${report.deduction} points come off` : ''}
          </Text>
        </View>

        {report.sacked ? (
          <View style={styles.sacked}>
            <Text style={styles.sackedText}>
              The board have run out of patience. The career is over, and the
              save goes with it.
            </Text>
            <Press
              onPress={() => {
                haptic('medium');
                setCareer(null);
                router.dismissAll();
                router.push('/dynasty/start');
              }}
              feel="none"
              style={styles.sackedCta}
              scaleTo={0.98}
            >
              <Text style={styles.sackedCtaText}>Find another job</Text>
            </Press>
          </View>
        ) : null}

        {/* ---- the money ---- */}
        <View style={styles.books}>
          <Shine radius={radius.lg} group="panel" />
          <Text style={styles.booksKey}>The books</Text>
          <View style={styles.booksGrid}>
            <Money label="Revenue" value={report.ledger.rev} />
            <Money label="Wages" value={-report.ledger.wages} />
            <Money label="Transfers" value={-report.ledger.amort} />
            <Money label="Running" value={-report.ledger.running} />
          </View>
          <View style={styles.profitRow}>
            <Text style={styles.profitKey}>Profit</Text>
            <Text
              style={[
                styles.profitValue,
                { color: report.ledger.profit >= 0 ? color.win : color.loss },
              ]}
              allowFontScaling={false}
            >
              {report.ledger.profit >= 0 ? '+' : ''}£{report.ledger.profit}m
            </Text>
          </View>
          <View style={styles.psrTrack}>
            <View
              style={[
                styles.psrFill,
                {
                  width: `${Math.max(2, Math.min(100, ((105 + report.ledger.rolling) / 210) * 100))}%`,
                  backgroundColor: report.ledger.breach
                    ? color.danger
                    : report.ledger.rolling < -60
                      ? color.warning
                      : color.accent,
                },
              ]}
            />
          </View>
          <Text style={styles.psrNote}>
            Three year rolling {report.ledger.rolling >= 0 ? '+' : ''}£
            {Math.round(report.ledger.rolling)}m. The league allows losses to £105m.
          </Text>
          <Text style={styles.budgetNote}>
            You have £{report.budget}m for the summer.
          </Text>
        </View>

        {/* ---- the squad ---- */}
        <View style={styles.swing}>
          <Text style={styles.swingKey}>Squad rating</Text>
          <View style={styles.swingRow}>
            <Text style={styles.was} allowFontScaling={false}>
              {report.before}
            </Text>
            <Text style={styles.arrow} allowFontScaling={false}>
              {'→'}
            </Text>
            <Ticker
              value={report.after}
              from={report.before}
              duration={900}
              style={[
                styles.now,
                { color: swing > 0 ? color.win : swing < 0 ? color.loss : color.text1 },
              ]}
            />
          </View>
        </View>

        {report.retired.length ? (
          <Rise delay={0}>
            <Group title={`${report.retired.length} retired`} tone={color.danger}>
              {report.retired.map((p) => (
                <Line
                  key={p.n}
                  name={p.n}
                  note={`${p.pos} · ${p.age} · rated ${p.rtg}`}
                  pos={p.pos}
                />
              ))}
            </Group>
          </Rise>
        ) : null}

        {report.lost.length ? (
          <Group title="Left on a free" tone={color.danger}>
            {report.lost.map((n) => (
              <Line key={n} name={n} note="contract ran out and was not renewed" />
            ))}
          </Group>
        ) : null}

        {report.renewed.length ? (
          <Group title="Signed new terms" tone={color.accent}>
            {report.renewed.map((n) => (
              <Line key={n} name={n} note="contract extended" />
            ))}
          </Group>
        ) : null}

        {report.held.length ? (
          <Group title="Played too well to decline" tone={color.gold}>
            {report.held.map((p) => (
              <Line key={p.n} name={p.n} note={p.why ?? ''} pos={p.pos} rtg={p.rtg} />
            ))}
          </Group>
        ) : null}

        {report.improved.length ? (
          <Group title="Better than last year" tone={color.win}>
            {report.improved.map((p) => (
              <Change key={p.n} player={p} />
            ))}
          </Group>
        ) : null}

        {report.declined.length ? (
          <Group title="Slipping" tone={color.loss}>
            {report.declined.map((p) => (
              <Change key={p.n} player={p} />
            ))}
          </Group>
        ) : null}

        {report.injured.length ? (
          <Group title="Time on the treatment table" tone={color.warning}>
            {report.injured.map((i) => (
              <Line key={i.name} name={i.name} note={`${i.days} days · ${i.injury}`} />
            ))}
          </Group>
        ) : null}

        {report.intake.length ? (
          <Group title={`${report.intake.length} through the academy`} tone={color.accent}>
            {report.intake.map((p) => (
              <Line
                key={p.n}
                name={p.n}
                note={`${p.pos} · ${p.age} · rated ${p.rtg}`}
                pos={p.pos}
              />
            ))}
          </Group>
        ) : null}

        {!report.sacked ? (
          <Press
            onPress={() => {
              haptic('medium');
              router.replace('/dynasty');
            }}
            feel="none"
            style={styles.cta}
            scaleTo={0.98}
          >
            <Text style={styles.ctaText}>Back to the club</Text>
          </Press>
        ) : null}
      </ModeScreen>

      <Confetti fire={champion && report.met && state.year > 0 && report.ledger.profit >= 0} />
    </>
  );
}

function Group({
  title,
  tone,
  children,
}: {
  title: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupKey, { color: tone }]}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Line({
  name,
  note,
  pos,
  rtg,
}: {
  name: string;
  note: string;
  pos?: string;
  rtg?: number;
}) {
  const tint = pos ? (positionColor[pos as 'GK'] ?? color.text3) : color.text3;
  return (
    <View style={styles.line}>
      {pos ? (
        <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
          <Text style={[styles.badgeText, { color: tint }]}>{pos}</Text>
        </View>
      ) : null}
      <View style={styles.lineBody}>
        <Text style={styles.lineName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.lineNote} numberOfLines={2}>
          {note}
        </Text>
      </View>
      {rtg != null ? (
        <Text style={styles.lineRtg} allowFontScaling={false}>
          {rtg}
        </Text>
      ) : null}
    </View>
  );
}

function Change({ player: p }: { player: DynastyPlayer }) {
  const tint = positionColor[p.pos];
  const up = p.delta > 0;
  return (
    <View style={styles.line}>
      <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
        <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
      </View>
      <View style={styles.lineBody}>
        <Text style={styles.lineName} numberOfLines={1}>
          {p.n}
        </Text>
        <Text style={styles.lineNote} numberOfLines={1}>
          now {p.age} {'·'} {p.why}
        </Text>
      </View>
      <Text style={styles.lineRtg} allowFontScaling={false}>
        {p.rtg}
      </Text>
      <View
        style={[
          styles.delta,
          {
            borderColor: (up ? color.win : color.loss) + '59',
            backgroundColor: (up ? color.win : color.loss) + '1F',
          },
        ]}
      >
        <Text
          style={[styles.deltaText, { color: up ? color.win : color.loss }]}
          allowFontScaling={false}
        >
          {up ? '+' : ''}
          {p.delta}
        </Text>
      </View>
    </View>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.money}>
      <Text
        style={[styles.moneyValue, { color: value >= 0 ? color.text1 : color.text2 }]}
        allowFontScaling={false}
      >
        {value >= 0 ? '' : '−'}£{Math.abs(value)}m
      </Text>
      <Text style={styles.moneyLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  bloom: { position: 'absolute', top: -30, left: -30, right: -30, height: 180 },

  verdict: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    backgroundColor: '#0C1510',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16281F 0%, #0D1712 62%, #080D0A 100%)',
    overflow: 'hidden',
  },
  verdictKey: { ...text.key, fontSize: 9, color: color.text3, marginTop: space.s2 },
  verdictTitle: {
    fontFamily: font.displayBlack,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.3,
  },
  verdictSwing: { ...text.small, fontSize: 12, marginTop: 2, textAlign: 'center' },

  sacked: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.danger,
    backgroundColor: 'rgba(229,72,77,0.10)',
    gap: space.s3,
  },
  sackedText: { ...text.body, color: color.text2 },
  sackedCta: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.danger,
  },
  sackedCtaText: { ...text.button, fontSize: 15, color: color.danger },

  books: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s3,
  },
  booksKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  booksGrid: { flexDirection: 'row' },
  money: { flex: 1, alignItems: 'center', gap: 1 },
  moneyValue: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  moneyLabel: { ...text.key, fontSize: 7.5, color: color.text3 },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: space.s2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  profitKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  profitValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    fontVariant: ['tabular-nums'],
  },
  psrTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  psrFill: { height: 6, borderRadius: 3 },
  psrNote: { ...text.small, fontSize: 11, marginTop: -space.s2 },
  budgetNote: { ...text.key, fontSize: 10, color: color.accent },

  swing: { alignItems: 'center', marginTop: space.s5 },
  swingKey: { ...text.key, fontSize: 9, color: color.text3 },
  swingRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  was: {
    fontFamily: font.hero,
    fontSize: 34,
    lineHeight: 45,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  arrow: { fontSize: 18, lineHeight: 45, color: color.text3 },
  now: { fontFamily: font.hero, fontSize: 50, lineHeight: 65, fontVariant: ['tabular-nums'] },

  group: { marginTop: space.s5 },
  groupKey: { ...text.key, fontSize: 10, marginBottom: space.s3 },
  groupBody: { gap: space.s2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
  lineBody: { flex: 1, minWidth: 0 },
  lineName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  lineNote: { fontFamily: font.body, fontSize: 11, lineHeight: 15, color: color.text3 },
  lineRtg: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  delta: {
    minWidth: 32,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  deltaText: {
    fontFamily: font.displayBold,
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },

  cta: {
    marginTop: space.s6,
    marginBottom: space.s6,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.12)',
  },
  ctaText: { ...text.button, color: color.accent },
});
