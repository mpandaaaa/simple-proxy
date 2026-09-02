import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { ModeScreen, Press, Rise, Shine, Trophy, ClubDisc } from '../src/ui/components';
import { color, gradient, line, positionColor, radius, space } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { GRAIN_URI } from '../src/ui/grain';
import { haptic } from '../src/ui/feel';
import { lastName, ordinal, type Position } from '../src/engine';
import { historyStore, ranked, type SeasonRecord } from '../src/save';

/**
 * The Hall of Fame.
 *
 * Every season that has been finished, ranked the way a league table is
 * ranked: points, then goal difference, then goals. The best one gets the
 * top of the page and the trophy; the rest are a list you can open to see
 * the XI that did it.
 *
 * Winning a title used to be a screen you looked at once and then lost.
 * This is where it goes instead.
 */
export default function HallOfFame() {
  const runs = useMemo(() => historyStore.read().runs, []);
  const best = useMemo(() => ranked(runs), [runs]);
  const [open, setOpen] = useState<number | null>(null);

  if (!runs.length) {
    return (
      <ModeScreen overline="Your record" title="Hall of Fame">
        <View style={styles.empty}>
          <Text style={styles.emptyMark} allowFontScaling={false}>
            🏟
          </Text>
          <Text style={styles.emptyTitle}>Nothing in here yet</Text>
          <Text style={styles.emptyBody}>
            Finish a season and it lands here, ranked against every other
            season you have played. The best one takes the top of the page.
          </Text>
        </View>
      </ModeScreen>
    );
  }

  const top = best[0];
  const totals = runs.reduce(
    (acc, r) => ({
      titles: acc.titles + (r.position === 1 ? 1 : 0),
      pts: acc.pts + r.pts,
      w: acc.w + r.w,
      cups: acc.cups + (r.nationalCup ? 1 : 0) + (r.continentalCup ? 1 : 0),
    }),
    { titles: 0, pts: 0, w: 0, cups: 0 },
  );

  return (
    <ModeScreen overline="Your record" title="Hall of Fame">
      {/* ---- the best season you have had ---- */}
      <View style={styles.crown}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <View style={styles.bloom} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="hallBloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={tintFor(top.position)} stopOpacity={0.3} />
                <Stop offset="1" stopColor={tintFor(top.position)} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="4" rx="68" ry="46" fill="url(#hallBloom)" />
          </Svg>
        </View>
        <View style={styles.grain} pointerEvents="none">
          <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
        </View>

        <Text style={styles.crownKey}>Best season</Text>
        {top.position === 1 ? (
          <Trophy size={78} tint={color.gold} />
        ) : (
          <Text style={styles.crownPos} allowFontScaling={false}>
            {ordinal(top.position)}
          </Text>
        )}
        <Text style={[styles.crownPts, { color: tintFor(top.position) }]} allowFontScaling={false}>
          {top.pts}
        </Text>
        <Text style={styles.crownLabel}>points</Text>
        <Text style={styles.crownMeta}>
          {label(top.position)} {'·'} {top.formation} {'·'} avg {top.avg}
        </Text>
      </View>

      {/* ---- the career, in four numbers ---- */}
      <View style={styles.totals}>
        <Total value={runs.length} label={runs.length === 1 ? 'Season' : 'Seasons'} />
        <Total value={totals.titles} label="Titles" tint={color.gold} />
        <Total value={totals.cups} label="Cups" tint={color.blue} />
        <Total value={totals.w} label="Wins" tint={color.win} />
      </View>

      {/* ---- every season, best first ---- */}
      <Text style={[text.label, styles.sect]}>Every season</Text>
      <View style={styles.list}>
        {best.map((r, i) => (
          <Rise key={`${r.at}-${i}`} delay={Math.min(i, 5)}>
            <SeasonCard
              record={r}
              rank={i + 1}
              open={open === i}
              onPress={() => {
                haptic('light');
                setOpen(open === i ? null : i);
              }}
            />
          </Rise>
        ))}
      </View>
    </ModeScreen>
  );
}

function tintFor(pos: number): string {
  if (pos === 1) return color.gold;
  if (pos <= 4) return color.blue;
  if (pos <= 7) return color.accent;
  if (pos <= 14) return color.text2;
  if (pos <= 17) return color.warning;
  return color.danger;
}

function label(pos: number): string {
  if (pos === 1) return 'Champions';
  if (pos === 2) return 'Runners up';
  if (pos <= 4) return `${ordinal(pos)}, Champions League`;
  if (pos <= 6) return `${ordinal(pos)}, Europa League`;
  if (pos === 7) return '7th, Conference League';
  if (pos <= 17) return `${ordinal(pos)} place`;
  return `${ordinal(pos)}, relegated`;
}

function Total({ value, label, tint }: { value: number; label: string; tint?: string }) {
  return (
    <View style={styles.total}>
      <Text
        style={[styles.totalValue, tint ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

/**
 * One season, closed. Open it and the XI that did it comes out.
 *
 * Fifty of these could be on the page, so the XI is only built for the one
 * that is open.
 */
function SeasonCard({
  record,
  rank,
  open,
  onPress,
}: {
  record: SeasonRecord;
  rank: number;
  open: boolean;
  onPress: () => void;
}) {
  const tint = tintFor(record.position);

  return (
    <Press onPress={onPress} feel="none" scaleTo={0.99} style={styles.card}>
      <View style={[styles.rankBar, { backgroundColor: tint }]} />

      <View style={styles.cardHead}>
        <Text style={styles.rank} allowFontScaling={false}>
          {rank}
        </Text>
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: tint }]} numberOfLines={1}>
            {label(record.position)}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {record.formation} {'·'} avg {record.avg} {'·'} {record.w}W {record.d}D{' '}
            {record.l}L {'·'} {when(record.at)}
          </Text>
          {record.honours.length ? (
            <View style={styles.honours}>
              {record.honours.map((h) => (
                <View key={h} style={styles.honour}>
                  <Text style={styles.honourText}>{h}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.cardPts, { color: tint }]} allowFontScaling={false}>
            {record.pts}
          </Text>
          <Text style={styles.cardPtsLabel}>pts</Text>
        </View>
      </View>

      {open ? (
        <View style={styles.xi}>
          {record.topScorer ? (
            <Text style={styles.scorer}>
              {lastName(record.topScorer.name)} scored {record.topScorer.goals}
            </Text>
          ) : null}
          {record.xi.map((p) => (
            <View key={p.n} style={styles.player}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: (positionColor[p.pos as Position] ?? color.text3) + '26',
                    borderColor: (positionColor[p.pos as Position] ?? color.text3) + '66',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: positionColor[p.pos as Position] ?? color.text3 },
                  ]}
                >
                  {p.pos}
                </Text>
              </View>
              <ClubDisc club={p.club} size={20} />
              <Text style={styles.playerName} numberOfLines={1}>
                {p.n}
              </Text>
              <Text style={styles.playerClub} numberOfLines={1}>
                {p.club} {p.season}
              </Text>
              <Text style={styles.playerRtg} allowFontScaling={false}>
                {p.rtg}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Press>
  );
}

/** "today", "3 days ago", or the date once it stops being recent. */
function when(at: number): string {
  const days = Math.floor((Date.now() - at) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(at).toLocaleDateString('en-GB');
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  empty: { alignItems: 'center', paddingTop: space.s8, gap: space.s3 },
  emptyMark: { fontSize: 44, lineHeight: 54 },
  emptyTitle: {
    fontFamily: font.displayBold,
    fontSize: 24,
    lineHeight: 29,
    color: color.text1,
  },
  emptyBody: { ...text.body, textAlign: 'center', maxWidth: 300 },

  crown: {
    alignItems: 'center',
    paddingTop: space.s5,
    paddingHorizontal: space.s4,
    paddingBottom: space.s5,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#101410',
    experimental_backgroundImage:
      'linear-gradient(180deg, #1D2419 0%, #10160F 62%, #0A0F0A 100%)',
    boxShadow: '0px 14px 34px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  bloom: { position: 'absolute', top: -34, left: -34, right: -34, height: 190 },
  crownKey: { ...text.key, fontSize: 10, color: color.gold, marginBottom: space.s3 },
  crownPos: {
    fontFamily: font.displayBlack,
    fontSize: 46,
    lineHeight: 56,
    color: color.text1,
  },
  crownPts: {
    fontFamily: font.hero,
    fontSize: 62,
    lineHeight: 81,
    fontVariant: ['tabular-nums'],
    marginTop: space.s2,
  },
  crownLabel: { ...text.key, fontSize: 9, color: color.text3, marginTop: -space.s2 },
  crownMeta: { ...text.small, color: color.text2, marginTop: space.s3 },

  totals: {
    flexDirection: 'row',
    marginTop: space.s4,
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
  },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  totalValue: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  totalLabel: { ...text.key, fontSize: 8.5, color: color.text3 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  list: { gap: space.s3, paddingBottom: space.s6 },

  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    overflow: 'hidden',
    paddingLeft: space.s3 + 3,
    paddingRight: space.s3,
    paddingVertical: space.s3,
  },
  rankBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rank: {
    width: 22,
    textAlign: 'center',
    fontFamily: font.displayBold,
    fontSize: 15,
    lineHeight: 19,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { fontFamily: font.displayBold, fontSize: 18, lineHeight: 22 },
  cardMeta: { fontFamily: font.body, fontSize: 11, lineHeight: 15, color: color.text3 },
  honours: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  honour: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.45)',
    backgroundColor: 'rgba(214,178,94,0.12)',
  },
  honourText: { ...text.key, fontSize: 7.5, color: color.gold },
  cardRight: { alignItems: 'flex-end' },
  cardPts: {
    fontFamily: font.displayBlack,
    fontSize: 26,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
  cardPtsLabel: { ...text.key, fontSize: 8, color: color.text3, marginTop: -3 },

  xi: {
    marginTop: space.s3,
    paddingTop: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  scorer: { ...text.key, fontSize: 9, color: color.accent, marginBottom: 2 },
  player: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  badge: {
    width: 30,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 7.5 },
  playerName: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    lineHeight: 17,
    color: color.text1,
    maxWidth: 132,
  },
  playerClub: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 10,
    lineHeight: 14,
    color: color.text3,
  },
  playerRtg: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    color: color.accentHi,
    fontVariant: ['tabular-nums'],
  },
});
