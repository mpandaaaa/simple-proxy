import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  ClubDisc,
  Confirm,
  Ticker,
} from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  advanceSeason,
  budgetFor,
  asSquad,
  bench,
  chemBonus,
  everyone,
  starters,
  mulberry32,
  ordinal,
  playerValue,
  simulateSeason,
  squadRating,
  squadValue,
  wageBill,
  type Dynasty,
  type DynastyPlayer,
  type Position,
} from '../../src/engine';
import { dynastyStore } from '../../src/save';
import { setReport } from '../../src/game/dynastyReport';

/**
 * The Dynasty hub.
 *
 * One XI, carried forward year on year. You play the season with the squad
 * you have, then the summer happens to it: everyone ages on their own
 * position's curve, the ones past it fall away, and some of them stop
 * playing altogether.
 *
 * This is the first slice. Transfers, the academy, wages against revenue
 * and a board with an opinion all come next. What is here already is the
 * part that makes it a career rather than a run: the squad changes under
 * you and you cannot stop it.
 */
export default function DynastyHub() {
  const [career, setCareer] = useState<Dynasty | null>(() => dynastyStore.read());
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);

  // Re-read whenever the hub comes back to the front, so it can never sit
  // showing an empty state next to a career that exists.
  useFocusEffect(
    useCallback(() => {
      setCareer(dynastyStore.read());
    }, []),
  );

  const played = useMemo(
    () => (career ? career.seasons.some((s) => s.year === career.year) : false),
    [career],
  );

  const playSeason = useCallback(() => {
    if (!career || busy || played) return;
    setBusy(true);
    haptic('medium');

    // The dynasty's own generator, mixed from the career seed and the
    // year, so a season here never disturbs the ageing draw.
    const rnd = mulberry32((career.seed ^ Math.imul(career.year, 0x9e3779b1)) >>> 0);
    const squad = asSquad(starters(career));
    const result = simulateSeason(squad, career.formation, chemBonus(squad), rnd);

    // The board's verdict. Meeting a title objective is worth more than
    // meeting a survival one, and missing narrowly costs less than missing
    // badly. A points deduction, when that lands, will cost ten more.
    const met = result.position <= career.objective.target;
    const swing = met
      ? career.objective.target === 1
        ? 15
        : 12
      : Math.abs(result.position - career.objective.target) <= 3
        ? -6
        : -14;

    const next: Dynasty = {
      ...career,
      mgr: Math.max(0, Math.min(99, career.mgr + Math.round(swing * career.leash))),
      // Only 45% of what you did not spend carries over; the board takes
      // the rest. The full rule also subtracts PSR headroom, which needs
      // the accounts, so until finances land this is the generous half of
      // it and a budget will tighten when they arrive.
      budget: Math.min(
        320,
        Math.round(career.budget * 0.45 + budgetFor(result.position)),
      ),
      titles: career.titles + (result.position === 1 ? 1 : 0),
      seasons: [
        ...career.seasons,
        {
          year: career.year,
          position: result.position,
          pts: result.pts,
          w: result.wins,
          d: result.draws,
          l: result.losses,
          gf: result.gf,
          ga: result.ga,
        },
      ],
    };
    dynastyStore.write(next);
    setCareer(next);
    setBusy(false);
    sfx(result.position === 1 ? 'trophy' : result.position <= 4 ? 'win' : 'ft');
    haptic(result.position === 1 ? 'success' : 'medium');
  }, [career, busy, played]);

  const advance = useCallback(() => {
    if (!career || busy || !played) return;
    setBusy(true);
    haptic('medium');
    const { dynasty, report } = advanceSeason(career);
    dynastyStore.write(dynasty);
    setCareer(dynasty);
    setBusy(false);
    setReport(report);
    router.push('/dynasty/summer');
  }, [career, busy, played]);

  if (!career) {
    return (
      <ModeScreen overline="A career, not a run" title="Dynasty">
        <View style={styles.empty}>
          <Text style={styles.emptyMark} allowFontScaling={false}>
            🏛
          </Text>
          <Text style={styles.emptyTitle}>No career yet</Text>
          <Text style={styles.emptyBody}>
            Take a real club and the squad it actually has, and manage it
            season by season. They age. A 22 year old grows into what he
            could have been, a 31 year old starts losing his legs, and one
            day your best player tells you he is finished.
          </Text>
          <Text style={styles.emptyBody}>
            The board set you an objective and judge you on it. Miss it
            often enough and you are gone.
          </Text>
          <Press
            onPress={() => {
              haptic('medium');
              router.push('/dynasty/start');
            }}
            feel="none"
            style={styles.cta}
            scaleTo={0.98}
          >
            <Text style={styles.ctaText}>Take a job</Text>
          </Press>
        </View>
      </ModeScreen>
    );
  }

  const xi = starters(career);
  const subs = bench(career);
  const all = everyone(career);
  const rating = squadRating(xi);
  const worth = squadValue(all);
  const bill = wageBill(all);
  const last = career.seasons[career.seasons.length - 1];
  const short = xi.length < 11;

  return (
    <>
      <ModeScreen
        overline={`Season ${career.year}`}
        title={career.club}
        onBack={() => router.back()}
      >
        {/* ---- the club as it stands ---- */}
        <View style={styles.hero}>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <View style={styles.bloom} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="dyBloom" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={color.accent} stopOpacity={0.26} />
                  <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50" cy="4" rx="66" ry="44" fill="url(#dyBloom)" />
            </Svg>
          </View>
          <View style={styles.grain} pointerEvents="none">
            <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.fill} />
          </View>

          <ClubDisc club={null} code="XI" size={52} />
          <Ticker value={rating} from={0} duration={620} style={styles.heroRating} />
          <Text style={styles.heroKey}>Squad rating</Text>

          <View style={styles.heroStats}>
            <HeroStat label="Budget" value={`£${career.budget}m`} tint={color.accent} />
            <HeroStat label="Value" value={`£${worth}m`} />
            <HeroStat label="Wages" value={`£${bill}m`} />
            <HeroStat label="Titles" value={String(career.titles)} tint={color.gold} />
          </View>
        </View>

        {/* ---- what the board wants, and what it thinks ---- */}
        <View style={styles.board}>
          <Shine radius={radius.lg} group="panel" />
          <View style={styles.boardHead}>
            <Text style={styles.boardKey}>The board want</Text>
            <Text
              style={[styles.boardMgr, { color: mgrTint(career.mgr) }]}
              allowFontScaling={false}
            >
              {career.mgr}
            </Text>
          </View>
          <Text style={styles.boardObj}>{career.objective.label}</Text>
          <View style={styles.boardTrack}>
            <View
              style={[
                styles.boardFill,
                {
                  width: `${Math.max(2, career.mgr)}%`,
                  backgroundColor: mgrTint(career.mgr),
                },
              ]}
            />
            {/* the line you are sacked below */}
            <View style={styles.boardMark} />
          </View>
          <Text style={styles.boardNote}>
            {career.mgr <= 30
              ? 'They are close to making a change.'
              : career.mgr >= 70
                ? 'They are happy with the direction.'
                : 'They are watching.'}
          </Text>
        </View>

        {/* ---- last season, and what happens next ---- */}
        {last ? (
          <Rise delay={0}>
            <View style={styles.last}>
              <Shine radius={radius.lg} group="panel" />
              <Text style={styles.lastKey}>Season {last.year}</Text>
              <Text
                style={[styles.lastPos, { color: finishTint(last.position) }]}
                allowFontScaling={false}
              >
                {ordinal(last.position)}
              </Text>
              <Text style={styles.lastMeta}>
                {last.pts} points {'·'} {last.w}W {last.d}D {last.l}L {'·'} {last.gf}
                {'-'}
                {last.ga}
              </Text>
            </View>
          </Rise>
        ) : null}

        {short ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              You have {xi.length} of eleven. Signings are not built yet, so
              until they are this career has run its course.
            </Text>
          </View>
        ) : played ? (
          <Press onPress={advance} feel="none" style={styles.advance} scaleTo={0.98}>
            <Text style={styles.advanceText}>The summer</Text>
            <Text style={styles.advanceSub}>
              Age the squad and move to season {career.year + 1}
            </Text>
          </Press>
        ) : (
          <Press onPress={playSeason} feel="none" style={styles.play} scaleTo={0.98}>
            <Text style={styles.playText}>Play season {career.year}</Text>
          </Press>
        )}

        {/* ---- the eleven, in the shape they play in ---- */}
        <Text style={[text.label, styles.sect]}>
          The starting eleven {'·'} {career.formation}
        </Text>
        <View style={styles.list}>
          {career.roster.slice(0, 11).map((p, i) =>
            p ? (
              <PlayerRow key={p.n} player={p} />
            ) : (
              <EmptySlot key={`slot${i}`} pos={career.slots[i]} />
            ),
          )}
        </View>

        <Text style={[text.label, styles.sect]}>Substitutes</Text>
        <Text style={styles.subsNote}>
          Depth is insurance. The bench only counts when someone is injured.
        </Text>
        <View style={styles.list}>
          {career.roster.slice(11).map((p, i) =>
            p ? (
              <PlayerRow key={p.n} player={p} />
            ) : (
              <EmptySlot key={`sub${i}`} pos={career.slots[11 + i]} />
            ),
          )}
        </View>

        {career.retired.length ? (
          <>
            <Text style={[text.label, styles.sect]}>Retired</Text>
            <View style={styles.list}>
              {career.retired.map((p) => (
                <View key={p.n} style={styles.gone}>
                  <Text style={styles.goneName} numberOfLines={1}>
                    {p.n}
                  </Text>
                  <Text style={styles.goneMeta}>
                    {p.pos} {'·'} retired at {p.age} {'·'} last rated {p.rtg}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Press
          onPress={() => setEnding(true)}
          feel="none"
          style={styles.end}
          scaleTo={0.98}
        >
          <Text style={styles.endText}>End this career</Text>
        </Press>
      </ModeScreen>

      <Confirm
        visible={ending}
        title="End the career?"
        body="Every season this XI has played, and the eleven themselves, will be gone. There is no way back to them."
        confirmLabel="End it"
        onCancel={() => setEnding(false)}
        onConfirm={() => {
          setEnding(false);
          dynastyStore.write(null);
          setCareer(null);
        }}
      />
    </>
  );
}

/** Board confidence, coloured by how close you are to the door. */
function mgrTint(mgr: number): string {
  if (mgr <= 20) return color.danger;
  if (mgr <= 40) return color.warning;
  if (mgr >= 70) return color.accent;
  return color.text1;
}

/** A place in the shape with nobody in it. */
function EmptySlot({ pos }: { pos: Position }) {
  const tint = positionColor[pos] ?? color.text3;
  return (
    <View style={styles.emptySlot}>
      <View
        style={[styles.badge, { backgroundColor: tint + '12', borderColor: tint + '3D' }]}
      >
        <Text style={[styles.badgeText, { color: tint, opacity: 0.6 }]}>{pos}</Text>
      </View>
      <Text style={styles.emptyText}>Nobody in this place</Text>
    </View>
  );
}

function finishTint(pos: number): string {
  if (pos === 1) return color.gold;
  if (pos <= 4) return color.blue;
  if (pos <= 7) return color.accent;
  if (pos >= 18) return color.danger;
  return color.text2;
}

function HeroStat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.heroStat}>
      <Text
        style={[styles.heroStatValue, tint ? { color: tint } : null]}
        allowFontScaling={false}
      >
        {value}
      </Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

/**
 * One player, with everything a manager actually looks at.
 *
 * The age is the important number, not the rating. A 90 rated 33 year old
 * and a 90 rated 24 year old are the same player today and completely
 * different assets, and the bar under the age is how close he is to the
 * end of his career.
 */
function PlayerRow({ player: p }: { player: DynastyPlayer }) {
  const tint = positionColor[p.pos];
  const worth = playerValue(p);
  // Thirty eight is where almost nobody is still playing, so that is the
  // end of the bar rather than an arbitrary round number.
  const life = Math.max(0, Math.min(1, (38 - p.age) / 20));

  return (
    <View style={styles.row}>
      <View
        style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}
      >
        <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {p.n}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {p.age} years {'·'} £{worth}m {'·'} £{p.contract.wage}k a week {'·'}{' '}
          {p.contract.yrs === 0 ? 'out of contract' : `${p.contract.yrs} yr`}
        </Text>
        <View style={styles.lifeTrack}>
          <View
            style={[
              styles.lifeFill,
              {
                width: `${Math.max(3, life * 100)}%`,
                backgroundColor:
                  life > 0.55 ? color.accent : life > 0.3 ? color.warning : color.danger,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.rowRtg} allowFontScaling={false}>
          {p.rtg}
        </Text>
        {p.delta !== 0 ? (
          <Text
            style={[
              styles.rowDelta,
              { color: p.delta > 0 ? color.win : color.loss },
            ]}
            allowFontScaling={false}
          >
            {p.delta > 0 ? '+' : ''}
            {p.delta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  empty: { alignItems: 'center', paddingTop: space.s7, gap: space.s3 },
  emptyMark: { fontSize: 44, lineHeight: 54 },
  emptyTitle: {
    fontFamily: font.displayBold,
    fontSize: 26,
    lineHeight: 32,
    color: color.text1,
  },
  emptyBody: { ...text.body, textAlign: 'center', maxWidth: 320 },
  cta: {
    marginTop: space.s4,
    minHeight: 56,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: 'rgba(31,197,126,0.12)',
  },
  ctaText: { ...text.button, color: color.accent },

  hero: {
    alignItems: 'center',
    paddingTop: space.s5,
    paddingHorizontal: space.s4,
    paddingBottom: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: line.accent,
    backgroundColor: '#0C1510',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16281F 0%, #0D1712 62%, #080D0A 100%)',
    boxShadow: '0px 14px 34px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  bloom: { position: 'absolute', top: -30, left: -30, right: -30, height: 180 },
  heroRating: {
    fontFamily: font.hero,
    fontSize: 58,
    lineHeight: 76,
    color: color.text1,
    fontVariant: ['tabular-nums'],
    marginTop: space.s2,
  },
  heroKey: { ...text.key, fontSize: 9, color: color.text3, marginTop: -space.s2 },
  heroStats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: space.s4 },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroStatValue: {
    fontFamily: font.displayBold,
    fontSize: 18,
    lineHeight: 22,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  heroStatLabel: { ...text.key, fontSize: 8, color: color.text3 },

  last: {
    marginTop: space.s4,
    alignItems: 'center',
    paddingVertical: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
  },
  lastKey: { ...text.key, fontSize: 9, color: color.text3 },
  lastPos: {
    fontFamily: font.displayBlack,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 0.3,
  },
  lastMeta: { ...text.small, fontVariant: ['tabular-nums'] },

  play: {
    marginTop: space.s4,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.accent,
    experimental_backgroundImage: 'linear-gradient(140deg, #22D287 0%, #12A866 100%)',
    boxShadow:
      '0px 8px 22px rgba(31,197,126,0.32), inset 0px 1px 0px rgba(255,255,255,0.22)',
  },
  playText: { ...text.button, color: '#05170E' },
  advance: {
    marginTop: space.s4,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.gold,
    backgroundColor: 'rgba(214,178,94,0.12)',
    gap: 2,
  },
  advanceText: { ...text.button, color: color.gold },
  advanceSub: { ...text.small, fontSize: 11 },

  warn: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.danger,
    backgroundColor: 'rgba(229,72,77,0.10)',
  },
  warnText: { ...text.body, color: color.text2 },

  board: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  boardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  boardKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  boardMgr: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    fontVariant: ['tabular-nums'],
  },
  boardObj: {
    fontFamily: font.displayBold,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
  },
  boardTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  boardFill: { height: 6, borderRadius: 3 },
  boardMark: {
    position: 'absolute',
    left: '20%',
    top: -2,
    bottom: -2,
    width: 1.5,
    backgroundColor: 'rgba(229,72,77,0.8)',
  },
  boardNote: { ...text.small, fontSize: 11.5 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  subsNote: { ...text.small, fontSize: 11, marginTop: -space.s2, marginBottom: space.s3 },
  list: { gap: space.s2 },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  emptyText: { ...text.small, fontSize: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    padding: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
  },
  badge: {
    width: 38,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 9 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowName: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  rowMeta: {
    fontFamily: font.body,
    fontSize: 10.5,
    lineHeight: 14,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  lifeTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  lifeFill: { height: 3, borderRadius: 2 },
  rowRight: { alignItems: 'flex-end', minWidth: 34 },
  rowRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },
  rowDelta: {
    fontFamily: font.displayBold,
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },

  gone: {
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    opacity: 0.65,
  },
  goneName: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    lineHeight: 17,
    color: color.text2,
  },
  goneMeta: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },

  end: {
    marginTop: space.s6,
    marginBottom: space.s6,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
  },
  endText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.4,
    color: color.text3,
  },
});
