import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Line as SvgLine, Path, Rect } from 'react-native-svg';
import { ModeScreen, Press, Shine, Trophy, ClubDisc } from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { ordinal, type AllTime, type Position } from '../../src/engine';
import { useCareer } from '../../src/game/career';

type Board = 'apps' | 'g' | 'a' | 'rating';

/**
 * The record books.
 *
 * Season by season, the honours, and the players who did the most for you
 * across the whole career. The all time lists are the reason to keep a
 * player who is past it: a striker on ninety eight goals stays until he
 * has a hundred.
 */
export default function History() {
  const career = useCareer();
  const [board, setBoard] = useState<Board>('apps');

  const leaders = useMemo(() => {
    if (!career) return [];
    const rows = Object.values(career.allTime);
    const score = (r: AllTime) =>
      board === 'apps'
        ? r.apps
        : board === 'g'
          ? r.g
          : board === 'a'
            ? r.a
            : r.rN
              ? r.rSum / r.rN
              : 0;
    return rows
      .filter((r) => (board === 'rating' ? r.rN >= 2 : score(r) > 0))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 10);
  }, [career, board]);

  if (!career) return null;
  const seasons = [...career.seasons].reverse();

  return (
    <ModeScreen overline={career.club} title="History" onBack={() => router.back()}>
      {/* ---- the honours ---- */}
      <View style={styles.honours}>
        <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
        <Trophy size={64} tint={career.titles ? color.gold : '#4A4F48'} />
        <Text style={styles.honTitle}>
          {career.titles === 0
            ? 'No silverware yet'
            : career.titles === 1
              ? 'One league title'
              : `${career.titles} league titles`}
        </Text>
        <View style={styles.honStats}>
          <Hon label="Seasons" value={String(career.seasons.length)} />
          <Hon
            label="Best finish"
            value={career.records.bestFin <= 20 ? ordinal(career.records.bestFin) : '–'}
            tint={career.records.bestFin === 1 ? color.gold : undefined}
          />
          <Hon label="Best points" value={String(career.records.bestPts || 0)} />
          <Hon
            label="Unbeaten"
            value={String(career.records.unbeaten)}
            tint={career.records.unbeaten ? color.accent : undefined}
          />
        </View>
      </View>

      {/* ---- the shape of it ---- */}
      {seasons.length > 1 ? (
        <>
          <Text style={[text.label, styles.sect]}>The shape of the career</Text>
          <View style={styles.arcWrap}>
            <Arc seasons={career.seasons} />
            <View style={styles.arcKeys}>
              <Text style={styles.arcKey}>1st</Text>
              <Text style={styles.arcKey}>20th</Text>
            </View>
          </View>
        </>
      ) : null}

      {/* ---- the clubs, if there has been more than one ---- */}
      {career.spells.length ? (
        <>
          <Text style={[text.label, styles.sect]}>Every club</Text>
          <View style={styles.spells}>
            {[...career.spells, {
              club: career.club,
              seasons: career.seasons.length,
              titles: career.titles,
              cups: Object.values(career.honours ?? {}).reduce((a, n) => a + (n as number), 0),
              best: career.records.bestFin,
              from: 0,
              to: 0,
            }].map((sp, i) => (
              <View key={`${sp.club}-${i}`} style={styles.spell}>
                <ClubDisc club={sp.club} size={30} />
                <View style={styles.spellBody}>
                  <Text style={styles.spellClub} numberOfLines={1}>
                    {sp.club}
                  </Text>
                  <Text style={styles.spellNote} numberOfLines={1}>
                    {sp.seasons} season{sp.seasons === 1 ? '' : 's'}
                    {sp.best <= 20 ? ` · best ${ordinal(sp.best)}` : ''}
                  </Text>
                </View>
                <View style={styles.spellRight}>
                  {sp.titles ? (
                    <Text style={[styles.spellCount, { color: hue.gold }]} allowFontScaling={false}>
                      {sp.titles} {sp.titles === 1 ? 'title' : 'titles'}
                    </Text>
                  ) : null}
                  {sp.cups ? (
                    <Text style={[styles.spellCount, { color: hue.violet }]} allowFontScaling={false}>
                      {sp.cups} {sp.cups === 1 ? 'cup' : 'cups'}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* ---- the derby ---- */}
      {career.rival && career.derby.w + career.derby.d + career.derby.l > 0 ? (
        <>
          <Text style={[text.label, styles.sect]}>Against {career.rival}</Text>
          <View style={styles.derby}>
            <ClubDisc club={career.rival} size={38} />
            <View style={styles.derbyRow}>
              <DerbyStat n={career.derby.w} label="Won" tint={hue.emerald} />
              <DerbyStat n={career.derby.d} label="Drawn" tint={hue.amber} />
              <DerbyStat n={career.derby.l} label="Lost" tint={hue.crimson} />
            </View>
          </View>
          <Text style={styles.derbyNote}>
            {career.derby.w > career.derby.l
              ? 'The city is yours.'
              : career.derby.w < career.derby.l
                ? 'They have had the better of it, and everybody knows.'
                : 'Nothing between you.'}
          </Text>
        </>
      ) : null}

      {/* ---- season by season ---- */}
      <Text style={[text.label, styles.sect]}>Season by season</Text>
      {seasons.length ? (
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.th, styles.cS]}>S</Text>
            <Text style={[styles.th, styles.cFin]}>Finish</Text>
            <Text style={[styles.th, styles.cN]}>Pts</Text>
            <Text style={[styles.th, styles.cRec]}>W-D-L</Text>
            <Text style={[styles.th, styles.cMoney]}>Profit</Text>
          </View>
          {seasons.map((s, i) => (
            <View key={`${s.s}-${i}`} style={styles.tr}>
              <View style={[styles.zone, { backgroundColor: finTint(s.fin) }]} />
              <Text style={[styles.td, styles.cS]} allowFontScaling={false}>
                {s.s}
              </Text>
              <View style={styles.cFin}>
                <Text
                  style={[styles.tdFin, { color: finTint(s.fin) }]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {ordinal(s.fin)}
                </Text>
                {s.ded ? (
                  <Text style={styles.tdDed} allowFontScaling={false}>
                    −{s.ded} pts
                  </Text>
                ) : s.met ? (
                  <Text style={styles.tdMet}>target met</Text>
                ) : (
                  <Text style={styles.tdMiss}>missed</Text>
                )}
              </View>
              <Text
                style={[styles.td, styles.cN]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {s.pts}
              </Text>
              <Text
                style={[styles.td, styles.tdTight, styles.cRec]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {s.w}-{s.d}-{s.l}
              </Text>
              <Text
                style={[
                  styles.td,
                  styles.tdTight,
                  styles.cMoney,
                  { color: s.profit >= 0 ? hue.emerald : hue.crimson },
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {s.profit >= 0 ? '+' : '−'}£{Math.abs(Math.round(s.profit))}m
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.none}>You have not finished a season yet.</Text>
      )}

      {/* ---- all time ---- */}
      <Text style={[text.label, styles.sect]}>All time</Text>
      <View style={styles.tabs}>
        {(
          [
            ['apps', 'Appearances'],
            ['g', 'Goals'],
            ['a', 'Assists'],
            ['rating', 'Rating'],
          ] as [Board, string][]
        ).map(([id, label]) => (
          <Press
            key={id}
            onPress={() => {
              haptic('select');
              setBoard(id);
            }}
            feel="none"
            scaleTo={0.96}
            style={[styles.tab, board === id ? styles.tabOn : null]}
          >
            <Text style={[styles.tabText, board === id ? { color: hue.rose } : null]}>
              {label}
            </Text>
          </Press>
        ))}
      </View>

      {leaders.length ? (
        <View style={styles.leaders}>
          {leaders.map((r, i) => {
            const tint = positionColor[r.pos as Position] ?? color.text3;
            const value =
              board === 'apps'
                ? r.apps
                : board === 'g'
                  ? r.g
                  : board === 'a'
                    ? r.a
                    : Math.round((r.rSum / Math.max(1, r.rN)) * 100) / 100;
            return (
              <View key={r.n} style={styles.leader}>
                <Text style={styles.leaderRank} allowFontScaling={false}>
                  {i + 1}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: tint + '26', borderColor: tint + '66' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: tint }]}>{r.pos}</Text>
                </View>
                <View style={styles.leaderBody}>
                  <Text style={styles.leaderName} numberOfLines={1}>
                    {r.n}
                  </Text>
                  <Text style={styles.leaderMeta}>
                    {r.seasons} season{r.seasons === 1 ? '' : 's'} {'·'} best {r.best}
                  </Text>
                </View>
                <Text style={styles.leaderValue} allowFontScaling={false}>
                  {board === 'rating' ? value.toFixed(2) : value}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.none}>Nobody has played a full season for you yet.</Text>
      )}

      <View style={{ height: space.s6 }} />
    </ModeScreen>
  );
}

function finTint(fin: number): string {
  if (fin === 1) return color.gold;
  if (fin <= 4) return color.blue;
  if (fin <= 7) return color.accent;
  if (fin >= 18) return color.danger;
  return 'rgba(255,255,255,0.12)';
}

function Hon({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.hon}>
      <Text style={[styles.honValue, tint ? { color: tint } : null]} allowFontScaling={false}>
        {value}
      </Text>
      <Text style={styles.honLabel}>{label}</Text>
    </View>
  );
}

/**
 * Twenty seasons as one line.
 *
 * Where you finished, year on year, with the title at the top and the drop
 * at the bottom. It is the only place a career has a shape rather than a
 * list, and it is the screen somebody screenshots.
 */
function Arc({ seasons }: { seasons: readonly { s: number; fin: number }[] }) {
  const W = 320;
  const H = 132;
  const pad = 10;
  const n = seasons.length;
  const x = (i: number) => pad + (n === 1 ? (W - pad * 2) / 2 : (i / (n - 1)) * (W - pad * 2));
  const y = (fin: number) => pad + ((fin - 1) / 19) * (H - pad * 2);

  const line = seasons.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.fin).toFixed(1)}`).join(' ');

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* the zones behind it, so a finish means something without a label */}
      <Rect x={0} y={y(1) - 4} width={W} height={y(4) - y(1) + 4} fill={alpha(hue.sky, 0.1)} />
      <Rect x={0} y={y(18)} width={W} height={y(20) - y(18) + 5} fill={alpha(hue.crimson, 0.12)} />
      <SvgLine x1={0} y1={y(1)} x2={W} y2={y(1)} stroke={alpha(hue.gold, 0.5)} strokeWidth={1} />
      <Path d={line} stroke={color.text1} strokeWidth={2} fill="none" strokeLinejoin="round" />
      {seasons.map((s, i) => (
        <Circle
          key={s.s}
          cx={x(i)}
          cy={y(s.fin)}
          r={s.fin === 1 ? 4.5 : 3}
          fill={s.fin === 1 ? hue.gold : s.fin <= 4 ? hue.sky : s.fin >= 18 ? hue.crimson : color.text2}
        />
      ))}
    </Svg>
  );
}

function DerbyStat({ n, label, tint }: { n: number; label: string; tint: string }) {
  return (
    <View style={styles.derbyStat}>
      <Text style={[styles.derbyN, { color: tint }]} allowFontScaling={false}>
        {n}
      </Text>
      <Text style={styles.derbyLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  honours: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: '#141207',
    experimental_backgroundImage:
      'linear-gradient(180deg, #221D0D 0%, #14120A 62%, #0C0B06 100%)',
    overflow: 'hidden',
  },
  honTitle: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    color: color.text1,
    marginTop: space.s3,
    textAlign: 'center',
  },
  honStats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space.s4 },
  hon: { flex: 1, alignItems: 'center', gap: 1 },
  honValue: {
    fontFamily: font.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  honLabel: { ...text.key, fontSize: 7.5, color: color.text3 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  arcWrap: {
    padding: space.s3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0D1610',
    overflow: 'hidden',
  },
  arcKeys: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  arcKey: { ...text.key, fontSize: 8, color: color.text3 },

  spells: { gap: space.s2 },
  spell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
  },
  spellBody: { flex: 1, minWidth: 0 },
  spellClub: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  spellNote: { ...text.small, fontSize: 11, lineHeight: 15, color: color.text3 },
  spellRight: { alignItems: 'flex-end' },
  spellCount: { ...text.key, fontSize: 8.5 },

  derby: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.crimson, 0.24),
    backgroundColor: '#160C0D',
    experimental_backgroundImage:
      'linear-gradient(180deg, #251214 0%, #150C0D 70%, #0A0607 100%)',
  },
  derbyRow: { flex: 1, flexDirection: 'row' },
  derbyStat: { flex: 1, alignItems: 'center', gap: 1 },
  derbyN: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  derbyLabel: { ...text.key, fontSize: 8, color: color.text3 },
  derbyNote: { ...text.small, fontSize: 12, lineHeight: 17, marginTop: space.s2 },
  none: { ...text.small, fontSize: 12.5 },

  table: {
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
    paddingLeft: space.s3 + 3,
    paddingRight: space.s3,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  th: { ...text.key, fontSize: 8, color: color.text3 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingRight: space.s3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  zone: { width: 3, alignSelf: 'stretch', marginRight: space.s3 },
  td: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 17,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  tdFin: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 19 },
  tdTight: { fontSize: 11.5, lineHeight: 15 },
  tdDed: { fontFamily: font.body, fontSize: 9.5, lineHeight: 13, color: color.danger },
  tdMet: { fontFamily: font.body, fontSize: 9.5, lineHeight: 13, color: color.accent },
  tdMiss: { fontFamily: font.body, fontSize: 9.5, lineHeight: 13, color: color.text3 },
  /* Fixed widths, wide enough for the widest value each column can hold.
     "13-11-14" is eight characters and the record column used to be sized
     for six, so it wrapped onto a second line and sat on top of the
     points beside it. */
  cS: { width: 20 },
  cFin: { flex: 1, minWidth: 0, paddingLeft: space.s2, paddingRight: space.s2 },
  cN: { width: 28, textAlign: 'right' },
  cRec: { width: 68, textAlign: 'right' },
  cMoney: { width: 72, textAlign: 'right' },

  tabs: { flexDirection: 'row', gap: 5, marginBottom: space.s3 },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: line.card,
  },
  tabOn: { borderColor: alpha(hue.rose, 0.45), backgroundColor: alpha(hue.rose, 0.12) },
  tabText: {
    fontFamily: font.displaySemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: color.text3,
  },

  leaders: { gap: space.s2 },
  leader: {
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
  leaderRank: {
    width: 18,
    textAlign: 'center',
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    width: 34,
    height: 23,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8 },
  leaderBody: { flex: 1, minWidth: 0 },
  leaderName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  leaderMeta: { fontFamily: font.body, fontSize: 10, lineHeight: 14, color: color.text3 },
  leaderValue: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 24,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
});
