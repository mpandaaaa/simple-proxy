import { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  ClubDisc,
  Confirm,
  Ticker,
  PlayerSheet,
} from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space, hue, alpha, type Hue } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { GRAIN_URI } from '../../src/ui/grain';
import { haptic } from '../../src/ui/feel';
import {
  bench,
  clubWageBill,
  effectiveRating,
  everyone,
  misfits,
  ordinal,
  playerValue,
  sell,
  squadRating,
  squadValue,
  slotAccepts,
  starters,
  type Dynasty,
  type DynastyPlayer,
  type Position,
} from '../../src/engine';
import { useCareer, setCareer, updateCareer } from '../../src/game/career';

/**
 * The Dynasty hub.
 *
 * Everything a manager checks before he does anything: what the board
 * thinks, what he has to spend, who is fit, who is running a contract
 * down, and how last season went. Then the doors to the rest of it.
 *
 * Ordered by what actually gets looked at. The club and the board first,
 * because that is the job. The one big action next. The squad under that,
 * because that is the work. The offices last.
 */

type Href =
  | '/dynasty/market'
  | '/dynasty/tactics'
  | '/dynasty/squad'
  | '/dynasty/academy'
  | '/dynasty/staff'
  | '/dynasty/club'
  | '/dynasty/finances'
  | '/dynasty/history';

/**
 * Every door, always.
 *
 * Simple and Immersive change how much you touch inside a screen, never
 * whether the screen is there at all. Hiding the staff and the stadium
 * behind a mode chosen on the first screen of a career meant half the
 * mode was invisible and looked missing.
 */
const DOORS: {
  href: Href;
  mark: string;
  title: string;
  tint: Hue;
  note: (d: Dynasty) => string;
}[] = [
  {
    href: '/dynasty/market',
    mark: '🔁',
    title: 'Transfers',
    tint: 'sky',
    note: (d) => `£${d.budget}m to spend`,
  },
  {
    href: '/dynasty/tactics',
    tint: 'indigo',
    mark: '🧭',
    title: 'Tactics',
    note: (d) => `${d.tactic.form} · ${d.tactic.style === 'direct' ? 'counter' : d.tactic.style}`,
  },
  {
    href: '/dynasty/squad',
    tint: 'violet',
    mark: '📋',
    title: 'Contracts',
    note: (d) => {
      const n = everyone(d).filter((p) => p.contract.yrs <= 1).length;
      return n ? `${n} running down` : 'all settled';
    },
  },
  {
    href: '/dynasty/academy',
    tint: 'lime',
    mark: '🌱',
    title: 'Academy',
    note: (d) => `${d.youth.length} coming through`,
  },
  {
    href: '/dynasty/staff',
    tint: 'mint',
    mark: '👔',
    title: 'Staff',
    note: (d) =>
      `${d.staff.coach + d.staff.medical + d.staff.youth + d.staff.setpiece + d.staff.scout} of 25 stars`,
  },
  {
    href: '/dynasty/club',
    tint: 'amber',
    mark: '🏟',
    title: 'The club',
    note: (d) => `${d.infra.capacity.toLocaleString('en-GB')} seats`,
  },
  {
    href: '/dynasty/finances',
    tint: 'gold',
    mark: '💷',
    title: 'Finances',
    note: (d) => (d.ledger ? `£${d.ledger.profit}m last year` : 'no accounts yet'),
  },
  {
    href: '/dynasty/history',
    tint: 'rose',
    mark: '📖',
    title: 'History',
    note: (d) => `${d.seasons.length} season${d.seasons.length === 1 ? '' : 's'}`,
  },
];

export default function DynastyHub() {
  const career = useCareer();
  const [ending, setEnding] = useState(false);
  const [reallyEnding, setReallyEnding] = useState(false);
  const [open, setOpen] = useState<{ p: DynastyPlayer; slot: number } | null>(null);

  const played = useMemo(
    () => (career ? career.seasons.some((s) => s.s === career.year) : false),
    [career],
  );

  const doSell = useCallback((slot: number) => {
    updateCareer((d) => sell(d, slot) ?? d);
    setOpen(null);
  }, []);

  const toBench = useCallback((slot: number) => {
    updateCareer((d) => {
      const roster = [...d.roster];
      const p = roster[slot];
      if (!p) return d;
      /* Into the first free bench place, or swapped with whoever is there
         and can actually stand where this player was. A keeper coming off
         the bench into centre back is exactly what the rule is for. */
      const free = [11, 12, 13].find((i) => !roster[i]);
      const swap = [11, 12, 13].find(
        (i) => roster[i] && slotAccepts(d, slot, roster[i]!.pos),
      );
      const target = free ?? swap;
      if (target === undefined) return d;
      roster[slot] = roster[target];
      roster[target] = p;
      return { ...d, roster };
    });
    setOpen(null);
  }, []);

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
  const all = everyone(career);
  const rating = squadRating(xi);
  const effective = Math.round(effectiveRating(career) * 10) / 10;
  const last = career.seasons[career.seasons.length - 1];
  const short = xi.length < 11;
  const outOfPosition = misfits(career);
  const tiles = DOORS;

  return (
    <>
      <ModeScreen
        overline={`Season ${career.year}`}
        title={career.club}
        onBack={() => router.back()}
      >
        {/* ---- the club ---- */}
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

          <ClubDisc club={career.club} size={54} />
          <Ticker value={rating} from={0} duration={620} style={styles.heroRating} />
          <Text style={styles.heroKey}>
            Squad rating{effective !== rating ? ` · ${effective} as picked` : ''}
          </Text>

          <View style={styles.heroStats}>
            <HeroStat label="Budget" value={`£${career.budget}m`} tint={color.accent} />
            <HeroStat label="Value" value={`£${squadValue(all)}m`} />
            <HeroStat label="Wages" value={`£${clubWageBill(career)}m`} />
            <HeroStat label="Titles" value={String(career.titles)} tint={color.gold} />
          </View>
        </View>

        {/* ---- the board ---- */}
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
                { width: `${Math.max(2, career.mgr)}%`, backgroundColor: mgrTint(career.mgr) },
              ]}
            />
            <View style={styles.boardMark} />
          </View>
          <Text style={styles.boardNote}>
            {career.mgr <= 30
              ? 'They are close to making a change.'
              : career.mgr >= 70
                ? 'They are happy with the direction.'
                : 'They are watching.'}
            {career.psrHit ? ` ${career.psrHit} points come off for the books.` : ''}
          </Text>
        </View>

        {/* ---- the desk ---- */}
        {career.inbox.length ? (
          <Rise delay={0}>
            <View style={styles.inbox}>
              <Text style={styles.inboxKey}>The desk</Text>
              {career.inbox.slice(0, 3).map((m, i) => (
                <View key={`${m.s}-${i}`} style={styles.mail}>
                  <View style={[styles.mailBar, { backgroundColor: mailTint(m.k) }]} />
                  <View style={styles.mailBody}>
                    <Text style={[styles.mailTitle, { color: mailTint(m.k) }]}>{m.t}</Text>
                    <Text style={styles.mailText}>{m.b}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Rise>
        ) : null}

        {/* ---- last season ---- */}
        {last ? (
          <View style={styles.last}>
            <Shine radius={radius.lg} group="panel" />
            <Text style={styles.lastKey}>Season {last.s}</Text>
            <Text
              style={[styles.lastPos, { color: finishTint(last.fin) }]}
              allowFontScaling={false}
            >
              {ordinal(last.fin)}
            </Text>
            <Text style={styles.lastMeta}>
              {last.pts} points {'·'} {last.w}W {last.d}D {last.l}L {'·'} {last.gf}
              {'-'}
              {last.ga}
            </Text>
          </View>
        ) : null}

        {/* ---- the one big action ---- */}
        {short ? (
          <View style={styles.warn}>
            <Text style={styles.warnText}>
              You have {xi.length} of eleven. Sign or promote before you can play.
            </Text>
            <Press
              onPress={() => {
                haptic('medium');
                router.push('/dynasty/market');
              }}
              feel="none"
              style={styles.warnCta}
              scaleTo={0.98}
            >
              <Text style={styles.warnCtaText}>Go to the market</Text>
            </Press>
          </View>
        ) : played ? (
          <Press
            onPress={() => {
              haptic('medium');
              router.push('/dynasty/summer');
            }}
            feel="none"
            style={styles.advance}
            scaleTo={0.98}
          >
            <Text style={styles.advanceText}>The summer</Text>
            <Text style={styles.advanceSub}>
              Close the books and move to season {career.year + 1}
            </Text>
          </Press>
        ) : (
          <Press
            onPress={() => {
              haptic('medium');
              router.push('/dynasty/season');
            }}
            feel="none"
            style={styles.play}
            scaleTo={0.98}
          >
            <Text style={styles.playText}>Play season {career.year}</Text>
          </Press>
        )}

        {/* ---- the doors ---- */}
        <View style={styles.tiles}>
          {tiles.map((t) => (
            <Press
              key={t.href}
              onPress={() => {
                haptic('light');
                router.push(t.href);
              }}
              feel="none"
              style={[
                styles.tile,
                {
                  borderColor: alpha(hue[t.tint], 0.28),
                  experimental_backgroundImage: `linear-gradient(180deg, ${alpha(
                    hue[t.tint],
                    0.16,
                  )} 0%, rgba(10,15,12,0) 78%)`,
                },
              ]}
              scaleTo={0.97}
            >
              <View
                style={[
                  styles.tileDisc,
                  {
                    borderColor: alpha(hue[t.tint], 0.36),
                    backgroundColor: alpha(hue[t.tint], 0.14),
                  },
                ]}
              >
                <Text style={styles.tileMark} allowFontScaling={false}>
                  {t.mark}
                </Text>
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <Text style={[styles.tileNote, { color: alpha(hue[t.tint], 0.85) }]} numberOfLines={1}>
                {t.note(career)}
              </Text>
            </Press>
          ))}
        </View>

        {/* ---- the eleven ---- */}
        <Text style={[text.label, styles.sect]}>
          The starting eleven {'·'} {career.tactic.form}
        </Text>
        {outOfPosition.length ? (
          <Text style={styles.misfit}>
            {outOfPosition.length} out of position, which costs you.{' '}
            {outOfPosition
              .slice(0, 2)
              .map((m) => `${m.name} at ${m.to.toLowerCase()}`)
              .join(', ')}
            .
          </Text>
        ) : null}
        <View style={styles.list}>
          {career.roster.slice(0, 11).map((p, i) =>
            p ? (
              <PlayerRow
                key={p.n}
                player={p}
                slot={career.slots[i]}
                onPress={() => {
                  haptic('light');
                  setOpen({ p, slot: i });
                }}
              />
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
              <PlayerRow
                key={p.n}
                player={p}
                slot={p.pos}
                onPress={() => {
                  haptic('light');
                  setOpen({ p, slot: 11 + i });
                }}
              />
            ) : (
              <EmptySlot key={`sub${i}`} pos={career.slots[11 + i]} />
            ),
          )}
        </View>

        {/* ---- the way out ---- */}
        <Text style={[text.label, styles.sect]}>Danger zone</Text>
        <Press onPress={() => setEnding(true)} feel="none" style={styles.end} scaleTo={0.98}>
          <Text style={styles.endText}>End this career</Text>
        </Press>
      </ModeScreen>

      <PlayerSheet
        player={open?.p ?? null}
        open={open !== null}
        onClose={() => setOpen(null)}
        onSell={open ? () => doSell(open.slot) : undefined}
        onBench={open && open.slot < 11 ? () => toBench(open.slot) : undefined}
        benchLabel="Move to the bench"
      />

      {/* Two steps, because there is no way back from this one. */}
      <Confirm
        visible={ending}
        title="End the career?"
        body="Every season, every player and every trophy in this career will be gone."
        confirmLabel="Continue"
        onCancel={() => setEnding(false)}
        onConfirm={() => {
          setEnding(false);
          setTimeout(() => setReallyEnding(true), 280);
        }}
      />
      <Confirm
        visible={reallyEnding}
        title="Really end it?"
        body={`${career.year - 1} season${career.year === 2 ? '' : 's'} and ${career.titles} title${career.titles === 1 ? '' : 's'}. There is no way back to any of it.`}
        confirmLabel="End the career"
        onCancel={() => setReallyEnding(false)}
        onConfirm={() => {
          setReallyEnding(false);
          setCareer(null);
        }}
      />
    </>
  );
}

function mgrTint(mgr: number): string {
  if (mgr <= 20) return color.danger;
  if (mgr <= 40) return color.warning;
  if (mgr >= 70) return color.accent;
  return color.text1;
}

function mailTint(k: string): string {
  return k === 'good'
    ? color.accent
    : k === 'bad'
      ? color.danger
      : k === 'board'
        ? color.gold
        : color.text2;
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

function EmptySlot({ pos }: { pos: Position }) {
  const tint = positionColor[pos] ?? color.text3;
  return (
    <View style={styles.emptySlot}>
      <View style={[styles.badge, { backgroundColor: tint + '12', borderColor: tint + '3D' }]}>
        <Text style={[styles.badgeText, { color: tint, opacity: 0.6 }]}>{pos}</Text>
      </View>
      <Text style={styles.emptyText}>Nobody in this place</Text>
    </View>
  );
}

/**
 * One squad row.
 *
 * Two lines. The position chip, the name, then his age, what he is worth
 * and whatever is wrong with him. On the right, how he played last season
 * and what the summer did to his rating.
 */
export function PlayerRow({
  player: p,
  slot,
  onPress,
}: {
  player: DynastyPlayer;
  slot: Position;
  onPress: () => void;
}) {
  const tint = positionColor[p.pos];
  const wrong = p.pos !== slot;

  const status =
    p.daysOut >= 60
      ? `${p.daysOut} days out`
      : p.contract.yrs === 0
        ? 'out of contract'
        : p.contract.yrs === 1
          ? 'final year'
          : wrong
            ? `playing at ${slot.toLowerCase()}`
            : p.youth
              ? 'academy'
              : `${p.contract.yrs} yr deal`;

  const flag = p.contract.yrs <= 1 || p.daysOut >= 60 || wrong;

  return (
    <Press onPress={onPress} feel="none" scaleTo={0.99} style={styles.row}>
      <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
        <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {p.n}
        </Text>
        <Text
          style={[styles.rowMeta, flag ? { color: color.warning } : null]}
          numberOfLines={1}
        >
          {p.age} {'·'} £{playerValue(p)}m {'·'} {status}
        </Text>
      </View>

      <View style={styles.rowStats}>
        {p.avgR != null ? (
          <Text style={styles.rowForm} allowFontScaling={false}>
            {p.avgR.toFixed(2)}
          </Text>
        ) : null}
        {p.goals || p.assists ? (
          <Text style={styles.rowGa} allowFontScaling={false}>
            {p.goals}g {p.assists}a
          </Text>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.rowRtg} allowFontScaling={false}>
          {p.rtg}
        </Text>
        {p.delta !== 0 ? (
          <Text
            style={[styles.rowDelta, { color: p.delta > 0 ? color.win : color.loss }]}
            allowFontScaling={false}
          >
            {p.delta > 0 ? '+' : ''}
            {p.delta}
          </Text>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },

  empty: { alignItems: 'center', paddingTop: space.s7, gap: space.s3 },
  emptyMark: { fontSize: 44, lineHeight: 54 },
  emptyTitle: { fontFamily: font.displayBold, fontSize: 26, lineHeight: 32, color: color.text1 },
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
  boardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  boardKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  boardMgr: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    fontVariant: ['tabular-nums'],
  },
  boardObj: { fontFamily: font.displayBold, fontSize: 20, lineHeight: 25, color: color.text1 },
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

  inbox: {
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#0E1712',
    gap: space.s3,
  },
  inboxKey: { ...text.key, fontSize: 9.5, color: color.text3 },
  mail: { flexDirection: 'row', gap: space.s3 },
  mailBar: { width: 2.5, borderRadius: 2 },
  mailBody: { flex: 1, minWidth: 0 },
  mailTitle: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 19 },
  mailText: { ...text.small, fontSize: 12, lineHeight: 17 },

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
  lastPos: { fontFamily: font.displayBlack, fontSize: 34, lineHeight: 42, letterSpacing: 0.3 },
  lastMeta: { ...text.small, fontVariant: ['tabular-nums'] },

  play: {
    marginTop: space.s4,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.accent,
    experimental_backgroundImage: 'linear-gradient(140deg, #22D287 0%, #12A866 100%)',
    boxShadow: '0px 8px 22px rgba(31,197,126,0.32), inset 0px 1px 0px rgba(255,255,255,0.22)',
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
    gap: space.s3,
  },
  warnText: { ...text.body, color: color.text2 },
  warnCta: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.danger,
  },
  warnCtaText: { ...text.button, fontSize: 15, color: color.danger },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s5 },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
    gap: 2,
  },
  tileDisc: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  tileMark: { fontSize: 17, lineHeight: 22 },
  tileTitle: { fontFamily: font.displayBold, fontSize: 14, lineHeight: 18, color: color.text1 },
  tileNote: { fontFamily: font.body, fontSize: 9.5, lineHeight: 13, color: color.text3 },

  sect: { marginTop: space.s6, marginBottom: space.s3 },
  misfit: {
    ...text.small,
    fontSize: 11.5,
    color: color.warning,
    marginTop: -space.s2,
    marginBottom: space.s3,
  },
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
  rowName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  rowMeta: {
    fontFamily: font.body,
    fontSize: 10.5,
    lineHeight: 14,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  rowStats: { alignItems: 'flex-end', minWidth: 42 },
  rowForm: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    color: color.text2,
    fontVariant: ['tabular-nums'],
  },
  rowGa: { fontFamily: font.body, fontSize: 9.5, lineHeight: 13, color: color.text3 },
  rowRight: { alignItems: 'flex-end', minWidth: 32 },
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

  end: {
    minHeight: 48,
    marginBottom: space.s6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.danger,
    backgroundColor: 'rgba(229,72,77,0.06)',
  },
  endText: {
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.4,
    color: color.danger,
  },
});
