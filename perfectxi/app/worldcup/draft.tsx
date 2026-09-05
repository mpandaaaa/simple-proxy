import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { back, enter } from '../../src/game/nav';
import { color, space, radius, line, hue, alpha } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  FORMATIONS,
  POSITION_LABEL,
  WC_ROUNDS,
  lastName,
  wcBoard,
  wcDraftDone,
  wcCustomSquad,
  wcNationOf,
  wcSlotsFor,
  wcSpread,
  wcXi,
  wcTeam,
  wcWeakest,
  wcXiRating,
  type WcDraftSlot,
  type WcPick,
} from '../../src/engine';
import { beginWcDraft, clearWcDraft, pickWcPlayer, useWcDraft } from '../../src/game/worldcupDraft';
import { getWorldCup, startWorldCup } from '../../src/game/worldcup';

/**
 * Drafting a World XI.
 *
 * The other door into the tournament. Eleven rounds, five players a round
 * pulled from every squad at the World Cup, and whoever you take is gone
 * from the pool. What you end up with is not a scorecard: it goes and
 * plays the seven matches, under a flag you pick at the end.
 *
 * Every board is worked out from the seed and the round rather than
 * stored, so closing the app on the seventh pick and coming back deals the
 * same five.
 */

const SHAPES = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '4-2-4'];

export default function WorldCupDraft() {
  const draft = useWcDraft();
  const [shape, setShape] = useState('4-3-3');
  const [asking, setAsking] = useState(false);

  /*
   * The XI has to take somebody's place, because there are forty eight
   * nations and no forty ninth. It takes the weakest, which is not a
   * choice anybody should be asked to make: choosing the seat rather than
   * the side is how you hand yourself the easiest group in the draw.
   */
  const startIt = useCallback(() => {
    if (!draft) return;
    setAsking(false);
    haptic('success');
    sfx('whistle');
    startWorldCup(wcWeakest(), {
      name: 'Your World XI',
      flag: '\u{1F30D}',
      rating: wcXiRating(draft),
      squad: wcCustomSquad(draft),
    });
    clearWcDraft();
    enter('/worldcup/hub');
  }, [draft]);

  const begin = useCallback(() => {
    haptic('medium');
    const on = getWorldCup();
    if (on && !on.over) setAsking(true);
    else startIt();
  }, [startIt]);

  const board = useMemo(() => (draft && !wcDraftDone(draft) ? wcBoard(draft) : []), [draft]);

  const take = useCallback(
    (p: WcPick) => {
      if (!draft) return;
      const slots = wcSlotsFor(draft, p);
      if (!slots.length) return;
      haptic('success');
      sfx('pick');
      pickWcPlayer(p, slots[0]);
    },
    [draft],
  );

  /* ================= nothing started ================= */
  if (!draft) {
    return (
      <ModeScreen
        overline="World Cup 2026"
        title="Draft a World XI"
        onBack={() => back()}
      >
        <View style={styles.hero}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="wcd" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#0E3B2A" stopOpacity={0.9} />
                  <Stop offset="1" stopColor="#2A1E0A" stopOpacity={0.9} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#wcd)" />
            </Svg>
          </View>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <Text style={styles.heroKey}>{'\u{1F30D}'} EVERY SQUAD AT THE TOURNAMENT</Text>
          <Text style={styles.heroBig} allowFontScaling={false}>
            WORLD XI
          </Text>
          <Text style={styles.heroLead}>
            Eleven rounds, five players a round, drawn from all forty eight
            squads. Whoever you take is gone from the pool. Then your XI goes
            and plays the World Cup itself.
          </Text>
        </View>

        <Text style={[text.label, styles.sect]}>Pick a shape</Text>
        <View style={styles.shapes}>
          {SHAPES.map((s) => (
            <Press
              key={s}
              onPress={() => {
                haptic('light');
                setShape(s);
              }}
              feel="none"
              scaleTo={0.97}
              style={[styles.shape, shape === s ? styles.shapeOn : null]}
            >
              <Text style={[styles.shapeText, shape === s ? styles.shapeTextOn : null]}>{s}</Text>
            </Press>
          ))}
        </View>
        <Text style={styles.shapeNote}>{FORMATIONS[shape]?.desc}</Text>

        <Press
          onPress={() => {
            haptic('medium');
            sfx('whistle');
            beginWcDraft(shape);
          }}
          feel="medium"
          scaleTo={0.98}
          style={styles.go}
        >
          <Text style={styles.goText}>Start the draft</Text>
        </Press>
      </ModeScreen>
    );
  }

  const xi = wcXi(draft);
  const done = wcDraftDone(draft);
  const rating = wcXiRating(draft);
  const nations = wcSpread(draft);

  /* ================= finished ================= */
  if (done) {
    return (
      <ModeScreen overline="World Cup 2026" title="Your World XI" onBack={() => back()}>
        <View style={styles.doneCard}>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <View style={styles.doneTop}>
            <View style={styles.doneRate}>
              <Text style={styles.doneRateNum} allowFontScaling={false}>
                {rating}
              </Text>
              <Text style={styles.doneRateKey}>RATED</Text>
            </View>
            <View style={styles.doneBody}>
              <Text style={styles.doneName}>Your World XI</Text>
              <Text style={styles.doneNote}>
                {draft.formation} {'·'} {nations} nations
              </Text>
            </View>
          </View>
        </View>

        <Text style={[text.label, styles.sect]}>The eleven</Text>
        {draft.slots.map((s, i) => (
          <Rise key={`${s.pos}-${i}`} delay={Math.min(i, 8)}>
            <Filled slot={s.pos} player={s.player} />
          </Rise>
        ))}

        <Text style={styles.entering}>
          They take the place of {wcTeam(wcWeakest())?.n ?? 'the weakest nation'},
          the weakest side in the draw, and play the whole tournament out of
          Group {wcTeam(wcWeakest())?.g ?? ''}.
        </Text>

        <Press onPress={begin} feel="medium" scaleTo={0.98} style={styles.go}>
          <Text style={styles.goText}>Enter the World Cup</Text>
        </Press>

        <Press
          onPress={() => {
            haptic('light');
            clearWcDraft();
          }}
          feel="light"
          scaleTo={0.98}
          style={styles.again}
        >
          <Text style={styles.againText}>Draft a different XI</Text>
        </Press>
        <View style={{ height: space.s6 }} />

        <Confirm
          visible={asking}
          title="Start again?"
          body="You have a World Cup on the go. Entering with this XI throws it away."
          confirmLabel="Start again"
          cancelLabel="Keep it"
          onCancel={() => setAsking(false)}
          onConfirm={startIt}
        />
      </ModeScreen>
    );
  }

  /* ================= mid draft ================= */
  const empty = draft.slots.filter((s) => !s.player);
  const nextPos = empty[0]?.pos;

  return (
    <ModeScreen overline={`Round ${draft.round + 1} of ${WC_ROUNDS}`} title="Take one" scroll={false} onBack={() => back()}>
      {/* the shape, filling up */}
      <View style={styles.shapeRow}>
        {draft.slots.map((s, i) => (
          <View
            key={`${s.pos}-${i}`}
            style={[
              styles.pipDot,
              s.player ? styles.pipOn : null,
              !s.player && i === draft.slots.indexOf(empty[0]) ? styles.pipNext : null,
            ]}
          />
        ))}
      </View>
      <Text style={styles.progress}>
        {xi.length} of {WC_ROUNDS} shirts filled
        {rating > 0 ? ` · rated ${rating} so far` : ''}
        {nextPos ? ` · ${POSITION_LABEL[nextPos].toLowerCase()} next` : ''}
      </Text>

      <ScrollView
        keyboardShouldPersistTaps="handled" style={styles.page} showsVerticalScrollIndicator={false}>
        {board.map((p, i) => (
          <Rise key={`${p.code}-${p.n}`} delay={Math.min(i, 5)}>
            <Card player={p} slots={wcSlotsFor(draft, p)} shape={draft.slots} onPress={() => take(p)} />
          </Rise>
        ))}

        {xi.length ? (
          <>
            <Text style={[text.label, styles.sect]}>Taken so far</Text>
            {draft.slots
              .filter((s) => s.player)
              .map((s, i) => (
                <Filled key={`${s.pos}-${i}-taken`} slot={s.pos} player={s.player} />
              ))}
          </>
        ) : null}

        <View style={{ height: space.s6 }} />
      </ScrollView>
    </ModeScreen>
  );
}

/** One of the five, and where he would go. */
function Card({
  player,
  slots,
  shape,
  onPress,
}: {
  player: WcPick;
  slots: number[];
  shape: WcDraftSlot[];
  onPress: () => void;
}) {
  const nation = wcNationOf(player.code);
  const can = slots.length > 0;
  const tint = tintFor(player.rtg);
  const where = can ? POSITION_LABEL[shape[slots[0]].pos] : 'No shirt left for him';

  return (
    <Press
      onPress={can ? onPress : () => haptic('warning')}
      feel="none"
      scaleTo={0.98}
      style={[styles.card, can ? { borderColor: alpha(tint, 0.4) } : styles.cardDead]}
    >
      <View style={[styles.rate, { borderColor: alpha(tint, 0.55) }]}>
        <Text style={[styles.rateNum, { color: tint }]} allowFontScaling={false}>
          {player.rtg}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {player.n}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {nation?.f} {nation?.n} {'·'} {player.pos.join(' ')}
        </Text>
        <Text style={[styles.cardWhere, can ? { color: tint } : null]} numberOfLines={1}>
          {where}
        </Text>
      </View>
      <Text style={[styles.chev, can ? { color: tint } : null]}>{can ? '＋' : '–'}</Text>
    </Press>
  );
}

/** A shirt already filled. */
function Filled({ slot, player }: { slot: string; player: WcPick | null }) {
  const nation = player ? wcNationOf(player.code) : null;
  return (
    <View style={styles.filled}>
      <Text style={styles.filledSlot} allowFontScaling={false}>
        {slot}
      </Text>
      <Text style={styles.filledName} numberOfLines={1}>
        {player ? lastName(player.n) : 'Empty'}
      </Text>
      <Text style={styles.filledFlag} allowFontScaling={false}>
        {nation?.f}
      </Text>
      <Text style={styles.filledRate} allowFontScaling={false}>
        {player?.rtg ?? ''}
      </Text>
    </View>
  );
}

function tintFor(rating: number): string {
  return rating >= 88 ? hue.gold : rating >= 82 ? hue.emerald : rating >= 76 ? hue.sky : color.text3;
}

const styles = StyleSheet.create({
  page: { flex: 1, marginTop: space.s3 },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.28),
    backgroundColor: '#0C1210',
    overflow: 'hidden',
  },
  heroKey: { ...text.key, fontSize: 8.5, color: hue.gold, marginBottom: space.s2 },
  heroBig: {
    fontFamily: font.displayBlack,
    fontSize: 40,
    lineHeight: 50,
    color: color.text1,
    letterSpacing: 1,
  },
  heroLead: {
    ...text.small,
    fontSize: 13,
    lineHeight: 19,
    color: color.text2,
    textAlign: 'center',
    marginTop: space.s3,
  },

  sect: { marginTop: space.s5, marginBottom: space.s2 },
  shapes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  shape: {
    minHeight: 46,
    paddingHorizontal: space.s4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  shapeOn: { borderColor: alpha(hue.gold, 0.5), backgroundColor: alpha(hue.gold, 0.12) },
  shapeText: { fontFamily: font.displayBold, fontSize: 14, color: color.text3 },
  shapeTextOn: { color: hue.gold },
  shapeNote: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text3, marginTop: space.s3 },

  shapeRow: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginBottom: space.s2 },
  pipDot: {
    width: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pipOn: { backgroundColor: hue.emerald },
  pipNext: { backgroundColor: alpha(hue.gold, 0.75) },
  progress: { ...text.key, fontSize: 8.5, color: color.text3, textAlign: 'center' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 76,
    marginBottom: space.s2,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  cardDead: { opacity: 0.45 },
  rate: {
    minWidth: 50,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  rateNum: { fontFamily: font.displayBlack, fontSize: 20, fontVariant: ['tabular-nums'] },
  cardBody: { flex: 1, minWidth: 0, gap: 1 },
  cardName: { fontFamily: font.displayBold, fontSize: 16, lineHeight: 21, color: color.text1 },
  cardMeta: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  cardWhere: { ...text.key, fontSize: 7.5, color: color.text3 },
  chev: { fontFamily: font.displayBold, fontSize: 20, color: color.text3 },

  filled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 44,
    marginBottom: 5,
    paddingHorizontal: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filledSlot: { ...text.key, fontSize: 8, color: color.text3, minWidth: 30 },
  filledName: {
    flex: 1,
    minWidth: 0,
    fontFamily: font.displayBold,
    fontSize: 14,
    lineHeight: 19,
    color: color.text1,
  },
  filledFlag: { fontSize: 15, lineHeight: 20 },
  filledRate: {
    fontFamily: font.displayBold,
    fontSize: 14,
    color: color.text2,
    fontVariant: ['tabular-nums'],
    minWidth: 22,
    textAlign: 'right',
  },

  doneCard: {
    padding: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.4),
    backgroundColor: alpha(hue.gold, 0.09),
    overflow: 'hidden',
  },
  doneTop: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  doneRate: { alignItems: 'center', minWidth: 66 },
  doneRateNum: {
    fontFamily: font.hero,
    fontSize: 44,
    lineHeight: 54,
    color: hue.gold,
    fontVariant: ['tabular-nums'],
  },
  doneRateKey: { ...text.key, fontSize: 7.5, color: color.text3 },
  doneBody: { flex: 1, minWidth: 0, gap: 2 },
  doneName: { fontFamily: font.displayBold, fontSize: 21, lineHeight: 27, color: color.text1 },
  doneNote: { ...text.small, fontSize: 12.5, lineHeight: 18, color: color.text2 },

  go: {
    marginTop: space.s5,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.gold, 0.5),
    backgroundColor: alpha(hue.gold, 0.14),
  },
  goText: { ...text.button, fontSize: 15, color: hue.gold },
  entering: {
    ...text.small,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text3,
    marginTop: space.s5,
  },
  again: {
    marginTop: space.s2,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  againText: { ...text.key, fontSize: 9.5, color: color.text3 },
});
