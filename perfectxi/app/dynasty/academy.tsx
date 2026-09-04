import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { back } from '../../src/game/nav';
import {
  ModeScreen,
  Press,
  Rise,
  Shine,
  PlayerSheet,
  SlotSheet,
} from '../../src/ui/components';
import { color, gradient, line, positionColor, radius, space, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  emptySlots,
  loanClubFor,
  mulberry32,
  promote,
  releaseYouth,
  scoutRange,
  type DynastyPlayer,
} from '../../src/engine';
import { useCareer, updateCareer } from '../../src/game/career';

/** What one look at a player costs. */
const SCOUT_FEE = 1;

/**
 * The academy.
 *
 * You are never told what a young player will become. Scouting narrows a
 * range and never closes it fully until he is nearly there, which is the
 * honest version of what a club actually knows.
 *
 * Four in a hundred of them are generational. Fifty five never make it.
 * The fog is the game.
 */
type Sort = 'rating' | 'ceiling' | 'age' | 'position';

const SORTS: { id: Sort; label: string }[] = [
  { id: 'rating', label: 'Rating' },
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'age', label: 'Age' },
  { id: 'position', label: 'Position' },
];

const POS_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

export default function Academy() {
  const career = useCareer();
  const [open, setOpen] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>('rating');
  /* Promoting happens here. It used to hand you over to the transfer
     screen, which threw away the screen you were looking at to do a job
     this screen already has everything for. */
  const [promoting, setPromoting] = useState<number | null>(null);

  const holes = useMemo(() => (career ? emptySlots(career) : []), [career]);

  /* Sorted for looking at, but every index stays the one the career knows,
     because promoting and releasing both work off it. */
  const order = useMemo(() => {
    if (!career) return [] as number[];
    const chief = career.staff.scout;
    const idx = career.youth.map((_, i) => i);
    const p = (i: number) => career.youth[i];
    return idx.sort((a, b) => {
      if (sort === 'age') return p(a).age - p(b).age || p(b).rtg - p(a).rtg;
      if (sort === 'position') {
        return (
          (POS_ORDER[p(a).pos] ?? 9) - (POS_ORDER[p(b).pos] ?? 9) || p(b).rtg - p(a).rtg
        );
      }
      if (sort === 'ceiling') {
        return scoutRange(p(b), chief).high - scoutRange(p(a), chief).high || p(b).rtg - p(a).rtg;
      }
      return p(b).rtg - p(a).rtg;
    });
  }, [career, sort]);

  const scout = useCallback((index: number) => {
    updateCareer((d) => {
      if (d.budget < SCOUT_FEE) return d;
      const youth = [...d.youth];
      const p = youth[index];
      if (!p) return d;
      youth[index] = { ...p, scout: p.scout + 1 };
      return { ...d, youth, budget: d.budget - SCOUT_FEE };
    });
    haptic('medium');
    sfx('tick');
  }, []);

  const putIn = useCallback((youthIndex: number, slot: number) => {
    updateCareer((d) => promote(d, youthIndex, slot) ?? d);
    haptic('success');
    sfx('pick');
    setPromoting(null);
    setOpen(null);
  }, []);

  const sendOut = useCallback((index: number) => {
    updateCareer((d) => {
      const y = d.youth[index];
      if (!y || y.loan) return d;
      const rnd = mulberry32((d.seed ^ Math.imul(d.year * 31 + index, 0x9e3779b1)) >>> 0);
      const youth = [...d.youth];
      youth[index] = { ...y, loan: loanClubFor(y.rtg, rnd).n };
      return { ...d, youth };
    });
    haptic('medium');
    sfx('tick');
  }, []);

  const bringBack = useCallback((index: number) => {
    updateCareer((d) => {
      const y = d.youth[index];
      if (!y) return d;
      const youth = [...d.youth];
      youth[index] = { ...y, loan: null };
      return { ...d, youth };
    });
    haptic('light');
  }, []);

  const toggleAuto = useCallback(() => {
    updateCareer((d) => ({ ...d, autoLoan: !d.autoLoan }));
    haptic('select');
  }, []);

  const release = useCallback((index: number) => {
    updateCareer((d) => releaseYouth(d, index));
    haptic('warning');
    setOpen(null);
  }, []);

  if (!career) return null;

  return (
    <>
      <ModeScreen
        overline={`Academy level ${career.infra.academy}`}
        title="The academy"
        onBack={() => back()}
      >
        <View style={styles.lead}>
          <Shine radius={radius.lg} group="panel" />
          <Text style={styles.leadTitle}>
            {career.youth.length
              ? `${career.youth.length} coming through`
              : 'Nobody in the building'}
          </Text>
          <Text style={styles.leadBody}>
            An intake arrives every summer. Most of them will never play a
            game. A few will be better than anyone you could afford to buy,
            and you will not know which is which until it is too late to
            matter, so scout the ones you like.
          </Text>
          <Text style={styles.leadNote}>
            They are released at 24 if they have not made it. Promoting one
            into an empty place costs nothing and he counts as homegrown.
          </Text>
        </View>

        <Press onPress={toggleAuto} feel="none" scaleTo={0.99} style={styles.auto}>
          <View style={styles.autoBody}>
            <Text style={styles.autoTitle}>Send them out automatically</Text>
            <Text style={styles.autoNote}>
              Every summer, anybody over sixteen who is not ready for the first
              team goes out on loan for the season. Games are what makes them.
            </Text>
          </View>
          <View style={[styles.switch, career.autoLoan ? styles.switchOn : null]}>
            <View style={[styles.knob, career.autoLoan ? styles.knobOn : null]} />
          </View>
        </Press>

        {career.youth.length > 1 ? (
          <View style={styles.sorts}>
            {SORTS.map((o) => (
              <Press
                key={o.id}
                onPress={() => {
                  haptic('select');
                  setSort(o.id);
                }}
                feel="none"
                scaleTo={0.95}
                style={[
                  styles.sort,
                  sort === o.id
                    ? {
                        borderColor: alpha(hue.lime, 0.45),
                        backgroundColor: alpha(hue.lime, 0.13),
                      }
                    : null,
                ]}
              >
                <Text
                  style={[styles.sortText, sort === o.id ? { color: hue.lime } : null]}
                >
                  {o.label}
                </Text>
              </Press>
            ))}
          </View>
        ) : null}

        <View style={[styles.list, career.youth.length > 1 ? null : styles.listTop]}>
          {order.map((i, n) => {
            const p = career.youth[i];
            return (
            <Rise key={`${p.n}-${i}`} delay={Math.min(n, 5)}>
              <Prospect
                player={p}
                chief={career.staff.scout}
                onPress={() => {
                  haptic('light');
                  setOpen(i);
                }}
                onScout={career.budget >= SCOUT_FEE ? () => scout(i) : undefined}
                onPromote={
                  holes.length && !p.loan
                    ? () => {
                        haptic('medium');
                        setPromoting(i);
                      }
                    : undefined
                }
                onLoan={p.loan ? () => bringBack(i) : () => sendOut(i)}
              />
            </Rise>
            );
          })}
        </View>

        {career.youth.length ? (
          <Text style={styles.foot}>
            {holes.length
              ? `${holes.length} place${holes.length === 1 ? '' : 's'} open in the squad. Promoting one costs nothing.`
              : 'Every place in the squad is filled. Sell somebody to make room for one of these.'}
          </Text>
        ) : null}

        <View style={{ height: space.s6 }} />
      </ModeScreen>

      <PlayerSheet
        player={open !== null ? (career.youth[open] ?? null) : null}
        open={open !== null}
        onClose={() => setOpen(null)}
        youth
        onScout={
          open !== null && career.budget >= SCOUT_FEE
            ? () => {
                scout(open);
              }
            : undefined
        }
        scoutCost={SCOUT_FEE}
        onRelease={open !== null ? () => release(open) : undefined}
        onPromote={
          open !== null && holes.length
            ? () => {
                setPromoting(open);
                setOpen(null);
              }
            : undefined
        }
      />

      <SlotSheet
        open={promoting !== null}
        title={promoting !== null ? (career.youth[promoting]?.n ?? '') : ''}
        subtitle="He goes straight into the squad, counts as homegrown and costs nothing."
        holes={holes}
        playerPos={promoting !== null ? (career.youth[promoting]?.pos ?? 'MID') : 'MID'}
        onClose={() => setPromoting(null)}
        onPick={(slot) => promoting !== null && putIn(promoting, slot)}
      />
    </>
  );
}

/**
 * One prospect, with the fog drawn as a band rather than a number.
 *
 * The bar shows where he is now and how far the doubt about his ceiling
 * still stretches. Each look narrows it by nearly half.
 */
function Prospect({
  player: p,
  chief,
  onPress,
  onScout,
  onPromote,
  onLoan,
}: {
  player: DynastyPlayer;
  chief: number;
  onPress: () => void;
  onScout?: () => void;
  onPromote?: () => void;
  /** send him out for the season, or bring him back before it starts */
  onLoan?: () => void;
}) {
  const tint = positionColor[p.pos];
  const range = scoutRange(p, chief);
  const low = (Math.max(40, range.low) - 40) / 59;
  const high = (Math.max(40, range.high) - 40) / 59;
  const now = (Math.max(40, p.rtg) - 40) / 59;

  return (
    <View style={styles.card}>
      <Shine radius={radius.md} group="card" rating={p.rtg} bevel={false} clip={false} />
      <Press onPress={onPress} feel="none" scaleTo={0.995} style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: tint + '26', borderColor: tint + '66' }]}>
          <Text style={[styles.badgeText, { color: tint }]}>{p.pos}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {p.n}
          </Text>
          <Text style={[styles.cardMeta, p.loan ? { color: hue.mint } : null]}>
            {p.age} {'·'}{' '}
            {p.loan
              ? `on loan at ${p.loan}`
              : p.scout === 0
                ? 'never scouted'
                : `scouted ${p.scout}×`}
          </Text>
        </View>
        <Text style={styles.cardRtg} allowFontScaling={false}>
          {p.rtg}
        </Text>
      </Press>

      {/* what a season out on loan did for him */}
      {p.loans?.length ? (
        <View style={styles.spells}>
          {p.loans
            .slice(-3)
            .reverse()
            .map((l) => (
              <View key={`${l.s}-${l.club}`} style={styles.spell}>
                <Text style={styles.spellSeason} allowFontScaling={false}>
                  s{l.s}
                </Text>
                <Text style={styles.spellClub} numberOfLines={1}>
                  {l.club}
                </Text>
                <Text style={styles.spellApps} allowFontScaling={false}>
                  {l.apps} games
                </Text>
                <Text
                  style={[
                    styles.spellGain,
                    { color: l.gained > 0 ? hue.emerald : color.text3 },
                  ]}
                  allowFontScaling={false}
                >
                  {l.gained > 0 ? '+' : ''}
                  {l.gained} to {l.to}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      {/* now, and the band he might end up in */}
      <View style={styles.fogWrap}>
        <View style={styles.fogTrack}>
          <View
            style={[
              styles.fogBand,
              { left: `${low * 100}%`, width: `${Math.max(2, (high - low) * 100)}%` },
            ]}
          />
          <View style={[styles.fogNow, { left: `${now * 100}%` }]} />
        </View>
        <Text style={styles.fogText}>
          {range.exact
            ? `Certain: he tops out at ${range.high}`
            : `Ceiling somewhere between ${range.low} and ${range.high}`}
        </Text>
      </View>

      <View style={styles.acts}>
        {onScout && !range.exact ? (
          <Press onPress={onScout} feel="none" scaleTo={0.98} style={styles.scout}>
            <Text style={styles.scoutText}>Scout him · £{SCOUT_FEE}m</Text>
          </Press>
        ) : null}
        {onPromote ? (
          <Press onPress={onPromote} feel="medium" scaleTo={0.98} style={styles.promote}>
            <Text style={styles.promoteText}>Promote him</Text>
          </Press>
        ) : null}
        {onLoan ? (
          <Press onPress={onLoan} feel="light" scaleTo={0.98} style={styles.loan}>
            <Text style={styles.loanText}>{p.loan ? 'Keep him here' : 'Send him out'}</Text>
          </Press>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: {
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
    gap: space.s2,
  },
  leadTitle: { fontFamily: font.displayBold, fontSize: 21, lineHeight: 26, color: color.text1 },
  leadBody: { ...text.small, fontSize: 12.5, lineHeight: 18 },
  leadNote: { ...text.small, fontSize: 11, lineHeight: 16, color: color.text3 },

  list: { gap: space.s3 },
  listTop: { marginTop: space.s5 },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.s3, padding: space.s3 },
  badge: {
    width: 36,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...text.key, fontSize: 8.5 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontFamily: font.bodySemi, fontSize: 14, lineHeight: 19, color: color.text1 },
  cardMeta: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },
  cardRtg: {
    fontFamily: font.displayBlack,
    fontSize: 20,
    lineHeight: 25,
    color: color.text1,
    fontVariant: ['tabular-nums'],
  },

  fogWrap: { paddingHorizontal: space.s3, paddingBottom: space.s3, gap: 5 },
  fogTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fogBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: alpha(hue.lime, 0.30),
    borderRadius: 4,
  },
  fogNow: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 2,
    backgroundColor: color.text1,
  },
  fogText: { fontFamily: font.body, fontSize: 10.5, lineHeight: 14, color: color.text3 },

  scout: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(hue.lime, 0.10),
  },
  scoutText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.3,
    color: hue.lime,
  },

  auto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginTop: space.s4,
    padding: space.s4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(hue.mint, 0.26),
    backgroundColor: '#0A1614',
    experimental_backgroundImage:
      'linear-gradient(180deg, #10241F 0%, #0A1614 70%, #060D0B 100%)',
  },
  autoBody: { flex: 1, minWidth: 0 },
  autoTitle: { fontFamily: font.displayBold, fontSize: 15, lineHeight: 20, color: color.text1 },
  autoNote: { ...text.small, fontSize: 11, lineHeight: 15, marginTop: 2 },
  switch: {
    width: 46,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchOn: { borderColor: hue.mint, backgroundColor: alpha(hue.mint, 0.3) },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: color.text3,
  },
  knobOn: { backgroundColor: hue.mint, alignSelf: 'flex-end' },

  loan: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.07)',
    backgroundColor: alpha(hue.sky, 0.1),
  },
  loanText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.3,
    color: hue.sky,
  },

  sorts: { flexDirection: 'row', gap: 5, marginTop: space.s5, marginBottom: space.s3 },
  sort: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sortText: {
    ...text.key,
    fontSize: 8.5,
    color: color.text3,
  },

  spells: {
    paddingHorizontal: space.s3,
    paddingBottom: space.s2,
    gap: 3,
  },
  spell: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  spellSeason: {
    fontFamily: font.body,
    fontSize: 10,
    lineHeight: 14,
    color: color.text3,
    width: 22,
    fontVariant: ['tabular-nums'],
  },
  spellClub: {
    fontFamily: font.bodySemi,
    fontSize: 11.5,
    lineHeight: 15,
    color: color.text2,
    flex: 1,
    minWidth: 0,
  },
  spellApps: {
    fontFamily: font.body,
    fontSize: 10.5,
    lineHeight: 14,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  spellGain: {
    fontFamily: font.displayBold,
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
    width: 60,
    textAlign: 'right',
  },

  acts: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  promote: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.07)',
    backgroundColor: alpha(hue.mint, 0.12),
  },
  promoteText: {
    fontFamily: font.displayBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0.3,
    color: hue.mint,
  },
  foot: {
    ...text.small,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: space.s5,
    paddingHorizontal: space.s4,
  },
});
