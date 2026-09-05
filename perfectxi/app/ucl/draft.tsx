import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ModeScreen, Press, Rise, Shine, Confirm } from '../../src/ui/components';
import { back, enter } from '../../src/game/nav';
import { color, space, radius } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { ucl as sky } from '../../src/ui/ucl';
import { haptic } from '../../src/ui/feel';
import { sfx } from '../../src/ui/sound';
import {
  FORMATIONS,
  POSITION_LABEL,
  UCL_DRAFT_ROUNDS,
  lastName,
  uclBoard,
  uclDraftDone,
  uclDraftSpread,
  uclDraftSquad,
  uclDraftXi,
  uclSlotsFor,
  uclWeakest,
  uclXiRating,
  type UclDraftSlot,
  type UclPick,
} from '../../src/engine';
import { beginUclDraft, clearUclDraft, pickUclPlayer, useUclDraft } from '../../src/game/uclDraft';
import { getUcl, startUcl } from '../../src/game/ucl';

/**
 * Drafting a Champions League XI.
 *
 * Eleven rounds, five players a round, pulled from all thirty six squads
 * in the competition. Whoever you take is gone from the pool. The XI then
 * enters the competition itself, taking a real club's place in the league
 * phase, because there are thirty six places and no thirty seventh.
 *
 * Every board is worked out from the seed and the round rather than
 * stored, so closing the app on the seventh pick and coming back deals the
 * same five.
 */

const SHAPES = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '5-3-2', '4-2-4'];

export default function UclDraft() {
  const draft = useUclDraft();
  const [shape, setShape] = useState('4-3-3');
  const [asking, setAsking] = useState(false);

  /*
   * The XI has to take somebody's place, because there are thirty six
   * clubs and no thirty seventh. It takes the weakest, which is not a
   * choice anybody should be asked to make: choosing the seat rather than
   * the side is how you hand yourself a pot one seeding.
   */
  const startIt = useCallback(() => {
    if (!draft) return;
    setAsking(false);
    haptic('success');
    sfx('whistle');
    startUcl(uclWeakest(), {
      name: 'Your Champions XI',
      rating: uclXiRating(draft),
      squad: uclDraftSquad(draft),
    });
    clearUclDraft();
    enter('/ucl/hub');
  }, [draft]);

  const begin = useCallback(() => {
    haptic('medium');
    const on = getUcl();
    if (on && !on.over) setAsking(true);
    else startIt();
  }, [startIt]);

  const board = useMemo(() => (draft && !uclDraftDone(draft) ? uclBoard(draft) : []), [draft]);

  const take = useCallback(
    (p: UclPick) => {
      if (!draft) return;
      const slots = uclSlotsFor(draft, p);
      if (!slots.length) return;
      haptic('success');
      sfx('pick');
      pickUclPlayer(p, slots[0]);
    },
    [draft],
  );

  /* ================= nothing started ================= */
  if (!draft) {
    return (
      <ModeScreen
        wide
        overline="Champions League" title="Draft a Champions XI" onBack={() => back()}>
        <View style={styles.hero}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="ucld" x1="0" y1="0" x2="0.4" y2="1">
                  <Stop offset="0" stopColor="#143A8F" stopOpacity={0.95} />
                  <Stop offset="1" stopColor="#040C22" stopOpacity={0.95} />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#ucld)" />
            </Svg>
          </View>
          <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
          <Text style={styles.heroKey}>★ EVERY SQUAD IN THE COMPETITION</Text>
          <Text style={styles.heroBig} allowFontScaling={false}>
            CHAMPIONS XI
          </Text>
          <Text style={styles.heroLead}>
            Eleven rounds, five players a round, drawn from all thirty six
            squads. Whoever you take is gone from the pool. Then your XI takes
            a place in the league phase and plays for the trophy.
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
            beginUclDraft(shape);
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

  const xi = uclDraftXi(draft);
  const done = uclDraftDone(draft);
  const rating = uclXiRating(draft);
  const clubs = uclDraftSpread(draft);

  /* ================= finished ================= */
  if (done) {
    return (
      <ModeScreen overline="Champions League" title="Your Champions XI" onBack={() => back()}>
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
              <Text style={styles.doneName}>Your Champions XI</Text>
              <Text style={styles.doneNote}>
                {draft.formation} {'·'} {clubs} clubs raided
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
          They take the place of {uclWeakest()}, the weakest club in the
          competition, and start the league phase out of pot four.
        </Text>

        <Press onPress={begin} feel="medium" scaleTo={0.98} style={styles.go}>
          <Text style={styles.goText}>Enter the Champions League</Text>
        </Press>

        <Press
          onPress={() => {
            haptic('light');
            clearUclDraft();
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
          body="You have a campaign on the go. Entering with this XI throws it away."
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
    <ModeScreen
      overline={`Round ${draft.round + 1} of ${UCL_DRAFT_ROUNDS}`}
      title="Take one"
      scroll={false}
      onBack={() => back()}
    >
      <View style={styles.pips}>
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
        {xi.length} of {UCL_DRAFT_ROUNDS} shirts filled
        {rating > 0 ? ` · rated ${rating} so far` : ''}
        {nextPos ? ` · ${POSITION_LABEL[nextPos].toLowerCase()} next` : ''}
      </Text>

      <ScrollView
        keyboardShouldPersistTaps="handled" style={styles.page} showsVerticalScrollIndicator={false}>
        {board.map((p, i) => (
          <Rise key={`${p.club}-${p.n}`} delay={Math.min(i, 5)}>
            <Card
              player={p}
              slots={uclSlotsFor(draft, p)}
              shape={draft.slots}
              onPress={() => take(p)}
            />
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
  player: UclPick;
  slots: number[];
  shape: UclDraftSlot[];
  onPress: () => void;
}) {
  const can = slots.length > 0;
  const tint = tintFor(player.rtg);
  const where = can ? POSITION_LABEL[shape[slots[0]].pos] : 'No shirt left for him';

  return (
    <Press
      onPress={can ? onPress : () => haptic('warning')}
      feel="none"
      scaleTo={0.98}
      style={[styles.card, can ? { borderColor: sky.edgeHi } : styles.cardDead]}
    >
      <View style={[styles.rate, { borderColor: tint }]}>
        <Text style={[styles.rateNum, { color: tint }]} allowFontScaling={false}>
          {player.rtg}
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>
          {player.n}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {player.club} {'·'} {player.pos.join(' ')}
        </Text>
        <Text style={[styles.cardWhere, can ? { color: tint } : null]} numberOfLines={1}>
          {where}
        </Text>
      </View>
      <Text style={[styles.chev, can ? { color: tint } : null]}>{can ? '＋' : '–'}</Text>
    </Press>
  );
}

function Filled({ slot, player }: { slot: string; player: UclPick | null }) {
  return (
    <View style={styles.filled}>
      <Text style={styles.filledSlot} allowFontScaling={false}>
        {slot}
      </Text>
      <Text style={styles.filledName} numberOfLines={1}>
        {player ? lastName(player.n) : 'Empty'}
      </Text>
      <Text style={styles.filledClub} numberOfLines={1}>
        {player?.club ?? ''}
      </Text>
      <Text style={styles.filledRate} allowFontScaling={false}>
        {player?.rtg ?? ''}
      </Text>
    </View>
  );
}

function tintFor(rating: number): string {
  return rating >= 88 ? sky.gold : rating >= 82 ? sky.blue : rating >= 76 ? sky.play : color.text3;
}

const styles = StyleSheet.create({
  page: { flex: 1, marginTop: space.s3 },

  hero: {
    alignItems: 'center',
    paddingVertical: space.s5,
    paddingHorizontal: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.ink,
    overflow: 'hidden',
  },
  heroKey: { ...text.key, fontSize: 8.5, color: sky.silver, marginBottom: space.s2 },
  heroBig: {
    fontFamily: font.displayBlack,
    fontSize: 34,
    lineHeight: 42,
    color: sky.blue,
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
    borderColor: sky.edge,
    backgroundColor: sky.panel,
  },
  shapeOn: { borderColor: sky.edgeHi, backgroundColor: sky.panelOn },
  shapeText: { fontFamily: font.displayBold, fontSize: 14, color: color.text3 },
  shapeTextOn: { color: sky.blue },
  shapeNote: {
    ...text.small,
    fontSize: 12.5,
    lineHeight: 18,
    color: color.text3,
    marginTop: space.s3,
  },

  pips: { flexDirection: 'row', gap: 5, justifyContent: 'center', marginBottom: space.s2 },
  pipDot: { width: 14, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
  pipOn: { backgroundColor: sky.blue },
  pipNext: { backgroundColor: sky.silver },
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
    borderColor: sky.edge,
    backgroundColor: sky.panel,
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
    borderColor: sky.edge,
    backgroundColor: sky.panel,
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
  filledClub: { ...text.small, fontSize: 10.5, color: color.text3, maxWidth: 108 },
  filledRate: {
    fontFamily: font.displayBold,
    fontSize: 14,
    color: sky.blue,
    fontVariant: ['tabular-nums'],
    minWidth: 22,
    textAlign: 'right',
  },

  doneCard: {
    padding: space.s4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
    overflow: 'hidden',
  },
  doneTop: { flexDirection: 'row', alignItems: 'center', gap: space.s4 },
  doneRate: { alignItems: 'center', minWidth: 66 },
  doneRateNum: {
    fontFamily: font.hero,
    fontSize: 44,
    lineHeight: 54,
    color: sky.blue,
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
    borderColor: sky.edgeHi,
    backgroundColor: sky.panelOn,
  },
  goText: { ...text.button, fontSize: 15, color: sky.blue },
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
    borderColor: sky.edge,
    backgroundColor: sky.panel,
  },
  againText: { ...text.key, fontSize: 9.5, color: color.text3 },
});
