import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ModeScreen, Shine } from '../../src/ui/components';
import { color, gradient, line, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import {
  amortTotal,
  clubWageBill,
  matchdayRevenue,
  revenue,
  staffWages,
  ticketYield,
} from '../../src/engine';
import { useCareer } from '../../src/game/career';

/**
 * The accounts.
 *
 * Where the money comes from, where it goes, and how close the club is to
 * the line the league draws. PSR is the only rule in football that takes
 * points off a team for something that happened in an office, and it is
 * shown here as a bar with the line on it rather than as a number nobody
 * can hold in their head.
 */
export default function Finances() {
  const career = useCareer();
  if (!career) return null;

  const last = career.seasons[career.seasons.length - 1];
  const finish = last ? last.fin : career.objective.target;
  const rev = revenue(finish, career);
  const wages = clubWageBill(career);
  const staff = staffWages(career);
  const amort = amortTotal(career);
  const running = Math.round(rev * 0.18);
  const projected = rev - wages - staff - amort - running;

  const rolling = career.psr.reduce((a, b) => a + b, 0);
  const headroom = 105 + rolling;
  const breachAt = Math.max(0, Math.min(100, (headroom / 210) * 100));

  // Where the money comes from, on last season's finish.
  const equal = 96.9;
  const merit = Math.max(2.6, 53.1 - (finish - 1) * 2.66);
  const facility = 9 + Math.max(0, 21 - finish) * 0.8;
  const commercial = career.titles * 8 + (finish <= 4 ? 85 : finish <= 7 ? 55 : finish <= 12 ? 38 : 28);
  const euro = finish === 1 ? 95 : finish <= 4 ? 70 : finish <= 5 ? 55 : finish <= 7 ? 18 : 0;
  const gate = matchdayRevenue(career);

  const sources = [
    { label: 'Equal share', v: equal, tint: hue.mint },
    { label: 'Merit money', v: merit, tint: hue.emerald },
    { label: 'Facility fees', v: facility, tint: hue.sky },
    { label: 'Commercial', v: commercial, tint: hue.gold },
    { label: 'Europe', v: euro, tint: hue.violet },
    { label: 'The gate', v: gate, tint: hue.rose },
  ].filter((s) => s.v > 0);

  const costs = [
    { label: 'Player wages', v: wages },
    { label: 'Backroom', v: staff },
    { label: 'Transfer fees written off', v: amort },
    { label: 'Running the club', v: running },
  ].filter((c) => c.v > 0);

  return (
    <ModeScreen overline={career.club} title="Finances" onBack={() => router.back()}>
      {/* ---- the line ---- */}
      <View style={styles.psr}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <Text style={styles.psrKey}>Profit and sustainability</Text>
        <Text
          style={[
            styles.psrValue,
            {
              color:
                headroom <= 0 ? hue.crimson : headroom < 45 ? hue.amber : hue.gold,
            },
          ]}
          allowFontScaling={false}
        >
          £{Math.round(Math.max(0, headroom))}m
        </Text>
        <Text style={styles.psrSub}>of headroom left</Text>
        <View style={styles.psrTrack}>
          <View
            style={[
              styles.psrFill,
              {
                width: `${Math.max(2, breachAt)}%`,
                backgroundColor:
                  headroom <= 0 ? hue.crimson : headroom < 45 ? hue.amber : hue.gold,
              },
            ]}
          />
        </View>
        <Text style={styles.psrNote}>
          Three years of losses beyond £105m and the league takes points off.
          {career.psr.length
            ? ` Your last ${career.psr.length}: ${career.psr.map((p) => `${p >= 0 ? '+' : ''}${Math.round(p)}`).join(', ')}.`
            : ' No seasons on the books yet.'}
        </Text>
      </View>

      {/* ---- this season, projected ---- */}
      <View style={styles.projected}>
        <Shine radius={radius.lg} group="panel" />
        <View style={styles.projRow}>
          <Text style={styles.projKey}>Projected this season</Text>
          <Text
            style={[
              styles.projValue,
              { color: projected >= 0 ? color.win : color.loss },
            ]}
            allowFontScaling={false}
          >
            {projected >= 0 ? '+' : '−'}£{Math.abs(projected)}m
          </Text>
        </View>
        <Text style={styles.projNote}>
          On a {finish === 1 ? 'first' : `${finish}th`} place finish, before
          anything you make or spend in the market.
        </Text>
      </View>

      {/* ---- in ---- */}
      <Text style={[text.label, styles.sect]}>Money in {'·'} £{rev}m</Text>
      <View style={styles.bars}>
        {sources.map((s) => (
          <Bar key={s.label} label={s.label} value={s.v} max={rev} tint={s.tint} />
        ))}
      </View>

      {/* ---- out ---- */}
      <Text style={[text.label, styles.sect]}>
        Money out {'·'} £{wages + staff + amort + running}m
      </Text>
      <View style={styles.bars}>
        {costs.map((c) => (
          <Bar key={c.label} label={c.label} value={c.v} max={rev} tint={color.danger} />
        ))}
      </View>

      <Text style={styles.foot}>
        Every seat is worth about £{Math.round(ticketYield(career))} on a
        matchday, and that goes up the higher you finish. Finishing well pays
        twice.
      </Text>

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function Bar({
  label,
  value,
  max,
  tint,
}: {
  label: string;
  value: number;
  max: number;
  tint: string;
}) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.barValue} allowFontScaling={false}>
          £{Math.round(value)}m
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.max(2, Math.min(100, (value / max) * 100))}%`, backgroundColor: tint },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  psr: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0C1510',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16281F 0%, #0D1712 62%, #080D0A 100%)',
    overflow: 'hidden',
  },
  psrKey: { ...text.key, fontSize: 9, color: color.text3 },
  psrValue: {
    fontFamily: font.hero,
    fontSize: 52,
    lineHeight: 68,
    fontVariant: ['tabular-nums'],
  },
  psrSub: { ...text.key, fontSize: 8.5, color: color.text3, marginTop: -space.s2 },
  psrTrack: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: space.s4,
  },
  psrFill: { height: 8, borderRadius: 4 },
  psrNote: { ...text.small, fontSize: 11.5, lineHeight: 16, marginTop: space.s3, textAlign: 'center' },

  projected: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: 4,
  },
  projRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  projKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  projValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    fontVariant: ['tabular-nums'],
  },
  projNote: { ...text.small, fontSize: 11.5, lineHeight: 16 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  bars: { gap: space.s3 },
  barRow: { gap: 5 },
  barHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  barLabel: { flex: 1, ...text.small, fontSize: 12, color: color.text2 },
  barValue: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3 },

  foot: { ...text.small, fontSize: 11.5, lineHeight: 17, marginTop: space.s5 },
});
