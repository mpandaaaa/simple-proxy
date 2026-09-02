import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { router, Stack } from 'expo-router';
import {
  ModeScreen,
  Button,
  Press,
  Pitch,
  PlayerCard,
  EraCard,
  OverallStrip,
  ClubDisc,
  Sheet,
  Confirm,
  Shine,
} from '../../src/ui/components';
import type { Anchor } from '../../src/ui/components/PlayerCard';
import type { SlotRect } from '../../src/ui/components/Pitch';
import { color, space, radius, positionColor, gradient, line } from '../../src/ui/tokens';
import { font, text } from '../../src/ui/type';
import { haptic, useReduceMotion } from '../../src/ui/feel';
import {
  POSITION_LABEL,
  canPlay,
  clubSeasons,
  lastName,
  slotsForPlayer,
  squadAvg,
  ratingsHidden,
  visibleBoard,
  type Pick,
  type Position,
  type SpinResult,
} from '../../src/engine';
import {
  autoFill,
  clearRun,
  doSpin,
  pickPlayer,
  settleSpin,
  spendReroll,
  useRun,
} from '../../src/game/run';

/** A player, or the rule that separates the ones you can use from the rest. */
type Row =
  | { kind: 'player'; player: Pick; playable: boolean }
  | { kind: 'divider' };

const ORDER: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

export default function DraftBoard() {
  const run = useRun();
  const reduceMotion = useReduceMotion();
  const [pending, setPending] = useState<SpinResult | null>(null);
  const [chooser, setChooser] = useState<{ player: Pick; slots: number[] } | null>(null);
  const [reveal, setReveal] = useState<{
    player: Pick;
    pos: Position;
    slot: number;
    from: Anchor | null;
  } | null>(null);
  /** the slot a signing has just been flown into, so it can light up */
  const [struck, setStruck] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);

  /**
   * Where every pitch slot sits on screen, so the signing card can fly into
   * the one it filled. Kept in a ref: these change on layout, not on state,
   * and nothing should re-render because a slot moved a pixel.
   */
  const slotRects = useRef(new Map<number, SlotRect>());
  const onSlotRect = useCallback((i: number, r: SlotRect) => {
    slotRects.current.set(i, r);
  }, []);
  /** the row that was tapped, measured at the moment of the tap */
  const tapped = useRef<Anchor | null>(null);
  /** the slot the last signing went into, remembered past the reveal */
  const lastSlot = useRef<number | null>(null);
  /**
   * A signing chosen from the position sheet, held until the sheet has
   * finished leaving. Signing straight from the tile would try to present
   * the card while the sheet is still dismissing, and iOS drops it.
   */
  const queued = useRef<{ player: Pick; slot: number } | null>(null);
  /**
   * Bumped on every signing so the pitch re-measures. The page scrolls, so
   * where a slot was when it first laid out is not where it is now.
   */
  const [measureTick, setMeasureTick] = useState(0);

  // Scenery for the reel: every club-season in the era being drafted, so
  // the cards flying past are real sides rather than invented ones.
  const cfg = run?.state.config;
  const pool = useMemo(
    () => (cfg ? clubSeasons(cfg.eraFrom, cfg.eraTo) : []),
    [cfg?.eraFrom, cfg?.eraTo],
  );

  useEffect(() => {
    if (!run) router.replace('/draft');
  }, [run]);

  /**
   * The eleventh signing ends the draft.
   *
   * Waits for the card to clear so the last reveal is not cut off by the
   * push, and replaces rather than pushes: going back from squad complete
   * should return you home, not to a board with nothing left to pick.
   */
  useEffect(() => {
    if (!run || reveal || pending) return;
    if (run.state.filled < run.state.total) return;
    const t = setTimeout(() => router.replace('/draft/complete'), 260);
    return () => clearTimeout(t);
  }, [run, reveal, pending]);

  // The club is decided before the reel draws a frame. The spin shows the
  // result, it never chooses it, so a seeded run still replays exactly.
  const onSpin = useCallback(() => {
    const result = doSpin();
    if (!result) return;
    setPending(result);
  }, []);

  /**
   * Auto spin after a pick, so the draft is one continuous loop rather than
   * eleven presses of the same button. The site waits 420ms from the pick;
   * here the wait starts when the signing card clears, because spinning
   * behind it would hide the spin.
   *
   * The first board is still a deliberate press. Nothing should start
   * moving before the player has asked it to.
   */
  useEffect(() => {
    if (!run || run.board || pending || reveal) return;
    if (run.state.filled === 0 || run.state.filled >= run.state.total) return;
    const t = setTimeout(onSpin, 420);
    return () => clearTimeout(t);
  }, [run, pending, reveal, onSpin]);

  const onSettled = useCallback(() => {
    setPending((p) => {
      if (p) settleSpin(p);
      return null;
    });
  }, []);

  const sign = useCallback(
    (player: Pick, slotIndex: number) => {
      if (!run) return;
      const pos = run.state.squad[slotIndex].pos;
      pickPlayer(player, slotIndex);
      lastSlot.current = slotIndex;
      setMeasureTick((n) => n + 1);
      setReveal({ player, pos, slot: slotIndex, from: tapped.current });
    },
    [run],
  );

  const onPick = useCallback(
    (player: Pick, rect?: Anchor) => {
      if (!run) return;
      // Remember the row so the card can grow out of exactly where it was.
      tapped.current = rect ?? null;
      const slots = slotsForPlayer(run.state, player);
      if (!slots.length) {
        haptic('warning');
        return;
      }
      // One slot per distinct position. Three open ATT slots are one
      // choice, not three, and the site only asks across position groups.
      const byPos = new Map<Position, number>();
      for (const i of slots) {
        const pos = run.state.squad[i].pos;
        if (!byPos.has(pos)) byPos.set(pos, i);
      }
      if (byPos.size === 1) {
        sign(player, slots[0]);
        return;
      }
      haptic('light');
      setChooser({ player, slots: [...byPos.values()] });
    },
    [run, sign],
  );

  const state = run?.state;
  const board = run?.board ?? null;
  const shown = useMemo(
    () => (board && state ? visibleBoard(board, state.config.blitz) : []),
    [board, state],
  );

  /**
   * Playable first, then the rest under a rule.
   *
   * The web build leaves unusable players in rating order, so a 92 rated
   * striker you have no room for sits above every player you can actually
   * sign. They stay on the list, because seeing what you turned down is
   * part of it, but they never sit above what you can use.
   */
  const rows = useMemo<Row[]>(() => {
    if (!state || !shown.length) return [];
    const yes: Row[] = [];
    const no: Row[] = [];
    for (const p of shown) {
      (canPlay(state, p) ? yes : no).push({ kind: 'player', player: p, playable: canPlay(state, p) });
    }
    return no.length ? [...yes, { kind: 'divider' }, ...no] : yes;
  }, [state, shown]);

  if (!run || !state) return null;

  const { club, season } = run;
  const left = state.total - state.filled;
  const avg = squadAvg(state.squad);
  const rerollsLeft = state.rerollsMax - state.rerolls;
  const hideRatings = ratingsHidden(state.config);
  const boardAvg = shown.length
    ? Math.round(shown.reduce((n, p) => n + p.rtg, 0) / shown.length)
    : 0;

  const lines = {
    GK: squadAvg(state.squad, 'GK'),
    DEF: squadAvg(state.squad, 'DEF'),
    MID: squadAvg(state.squad, 'MID'),
    ATT: squadAvg(state.squad, 'ATT'),
  } as Record<Position, number>;

  // What is still missing, so the list can be read against the shape.
  const need = ORDER.map((p) => ({
    pos: p,
    n: state.squad.filter((s) => !s.player && s.pos === p).length,
  })).filter((x) => x.n > 0);

  const header = (
    <View style={styles.header}>
      <OverallStrip overall={avg} lines={lines} />

      <View style={styles.block}>
        <Pitch
          squad={state.squad}
          formation={state.config.formation}
          highlight={chooser?.slots}
          onSlotRect={onSlotRect}
          flash={struck}
          measureTick={measureTick}
        />
      </View>

      {/* Hidden until the first spin, exactly as the site hides it. */}
      {board || pending ? (
        <View style={styles.block}>
          <EraCard
            pick={Math.min(state.filled + 1, state.total)}
            total={state.total}
            club={board ? club : null}
            season={board ? season : null}
            strength={boardAvg}
            target={pending ? { club: pending.club, season: pending.season } : null}
            pool={pool}
            allTime={state.config.mode === 'alltime'}
            onSettled={onSettled}
          />
        </View>
      ) : null}

      {state.rerollsMax > 0 ? (
        <View style={styles.rerollRow}>
          <Press
            onPress={() => {
              if (spendReroll()) haptic('warning');
            }}
            feel="none"
            scaleTo={0.94}
            disabled={rerollsLeft === 0 || !board}
            style={[
              styles.rerollBtn,
              (rerollsLeft === 0 || !board) && styles.rerollSpent,
            ]}
          >
            <Text style={styles.rerollText}>Reroll</Text>
          </Press>
          <View style={styles.dots}>
            {Array.from({ length: state.rerollsMax }).map((_, i) => (
              <View key={i} style={[styles.dot, i < state.rerolls && styles.dotUsed]} />
            ))}
          </View>
          <Text style={styles.rerollsLeft}>
            {rerollsLeft} reroll{rerollsLeft === 1 ? '' : 's'} left
          </Text>
        </View>
      ) : null}

      {!board ? (
        <Button
          label={pending ? 'Spinning' : 'Start spinning'}
          onPress={onSpin}
          style={styles.spinBtn}
        />
      ) : null}

      {/* Testing only. __DEV__ is false in any build that ships, so this
          cannot reach the App Store even if everyone forgets it is here. */}
      {__DEV__ && !pending ? (
        <Press
          onPress={() => {
            haptic('medium');
            autoFill();
          }}
          feel="none"
          scaleTo={0.96}
          style={styles.autoFill}
        >
          <Text style={styles.autoFillText}>Auto fill the XI · testing</Text>
        </Press>
      ) : null}

      {board ? (
        <>

          {need.length ? (
            <View style={styles.needRow}>
              <Text style={styles.needLabel}>You need</Text>
              {need.map((x) => (
                <View
                  key={x.pos}
                  style={[
                    styles.needChip,
                    {
                      borderColor: positionColor[x.pos] + '66',
                      backgroundColor: positionColor[x.pos] + '1c',
                    },
                  ]}
                >
                  <Text style={[styles.needText, { color: positionColor[x.pos] }]}>
                    {x.n} {x.pos}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.listHead}>
            <Text style={styles.listTitle}>Pick a player</Text>
            <Text style={styles.listCount}>{shown.length} in squad</Text>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
    <ModeScreen
      overline={`${left} left to fill`}
      title={`${state.filled} of ${state.total} picked`}
      scroll={false}
      // Backing out of a draft in progress throws away every pick, so it
      // asks first, exactly as leaving squad complete does.
      onBack={() => setLeaving(true)}
      right={
        avg > 0 ? (
          <View style={styles.avgChip}>
            <Text style={styles.avgValue}>{Math.round(avg)}</Text>
          </View>
        ) : undefined
      }
    >
      {/* The page scrolls, and the squad list scrolls inside it. A single
          scroll meant a hundred and twenty players dragged the pitch and the
          era card off the top before you reached the bottom of a board, so
          the list is bounded and flicks on its own. */}
      <ScrollView
          style={styles.page}
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {header}

          {board ? (
            <View style={styles.listBox}>
              <FlashList
                data={rows}
                keyExtractor={(row, i) =>
                  row.kind === 'divider' ? 'divider' : row.player.n + row.player.club + i
                }
                renderItem={({ item }) =>
                  item.kind === 'divider' ? (
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>
                        Cannot fill your open positions
                      </Text>
                      <View style={styles.dividerLine} />
                    </View>
                  ) : (
                    <PlayerRow
                      player={item.player}
                      playable={item.playable}
                      hideRatings={hideRatings}
                      onPress={onPick}
                    />
                  )
                }
                showsVerticalScrollIndicator
                ListFooterComponent={<View style={styles.listFooter} />}
              />
          </View>
        ) : null}
      </ScrollView>

      {/* Where does he play. The player is on a card, each position is a
          lit tile in its own colour, and the whole thing can be thrown
          back down rather than only tapped away. */}
      <Sheet
        visible={!!chooser}
        onClose={() => setChooser(null)}
        onClosed={() => {
          const q = queued.current;
          queued.current = null;
          if (q) sign(q.player, q.slot);
        }}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetOrbs} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="sheetOrb" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={color.accent} stopOpacity={0.16} />
                  <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="22" cy="6" rx="58" ry="42" fill="url(#sheetOrb)" />
            </Svg>
          </View>
          <View style={styles.sheetEdge} pointerEvents="none" />
          <View style={styles.sheetGrab} />

          {chooser ? (
            <View style={styles.sheetPlayer}>
              <ClubDisc club={chooser.player.club} size={46} square />
              <View style={styles.sheetPlayerBody}>
                <Text style={styles.sheetName} numberOfLines={1}>
                  {chooser.player.n}
                </Text>
                <Text style={styles.sheetMeta} numberOfLines={1}>
                  {chooser.player.nat} · {chooser.player.club} {chooser.player.season}
                </Text>
              </View>
              <View
                style={[
                  styles.sheetRating,
                  { backgroundColor: ratingFill(chooser.player.rtg) },
                ]}
              >
                <Text style={styles.sheetRatingText} allowFontScaling={false}>
                  {chooser.player.rtg}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.sheetTitle}>Where does he play?</Text>

          <View style={styles.sheetTiles}>
            {chooser?.slots.map((si) => {
              const pos = state.squad[si].pos;
              const tint = positionColor[pos];
              return (
                <Press
                  key={si}
                  onPress={() => {
                    if (!chooser) return;
                    haptic('light');
                    queued.current = { player: chooser.player, slot: si };
                    setChooser(null);
                  }}
                  feel="none"
                  scaleTo={0.955}
                  style={[
                    styles.sheetTile,
                    {
                      borderColor: tint,
                      backgroundColor: tint + '1a',
                      experimental_backgroundImage: `linear-gradient(180deg, ${tint}33 0%, ${tint}0d 100%)`,
                      boxShadow: `0px 0px 26px ${tint}4d, inset 0px 1px 0px rgba(255,255,255,0.12)`,
                    },
                  ]}
                >
                  <Text style={[styles.sheetTilePos, { color: tint }]} allowFontScaling={false}>
                    {pos}
                  </Text>
                  <Text style={styles.sheetTileLabel}>{POSITION_LABEL[pos]}</Text>
                </Press>
              );
            })}
          </View>

          <Button
            label="Cancel"
            variant="ghost"
            style={styles.sheetCancel}
            onPress={() => setChooser(null)}
          />
        </View>
      </Sheet>

      <Confirm
        visible={leaving}
        title="Leave this draft?"
        body="Your picks will be lost and the draft reset. This cannot be undone."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onCancel={() => setLeaving(false)}
        onConfirm={() => {
          setLeaving(false);
          clearRun();
          router.dismissAll();
        }}
      />

      <PlayerCard
        player={reveal?.player ?? null}
        slotPos={reveal?.pos ?? null}
        from={reveal?.from ?? null}
        to={reveal ? (slotRects.current.get(reveal.slot) ?? null) : null}
        onDone={() => setReveal(null)}
        onLanded={() => {
          setStruck(lastSlot.current);
          setTimeout(() => setStruck(null), 500);
        }}
      />
    </ModeScreen>
    </>
  );
}

function PlayerRow({
  player,
  playable,
  hideRatings,
  onPress,
}: {
  player: Pick;
  playable: boolean;
  hideRatings: boolean;
  onPress: (p: Pick, rect?: Anchor) => void;
}) {
  const pos = player.pos[0] as Position;
  const tint = positionColor[pos] ?? color.text3;
  const fill = ratingFill(player.rtg);
  const box = useRef<View>(null);

  // Measure at the moment of the tap, not on layout: the list scrolls, and
  // where the row was when it rendered is not where it is when you hit it.
  const press = useCallback(() => {
    if (!box.current) return onPress(player);
    box.current.measureInWindow((x, y, w, h) =>
      onPress(player, w > 0 ? { x, y, w, h } : undefined),
    );
  }, [player, onPress]);

  return (
    <Press
      onPress={press}
      feel="none"
      scaleTo={0.98}
      disabled={!playable}
      style={[
        styles.player,
        !playable && styles.playerOff,
        playable && player.rtg >= 88 && { borderColor: fill + '88' },
      ]}
      accessibilityLabel={`${player.n}, rated ${player.rtg}, ${POSITION_LABEL[pos] ?? pos}`}
    >
      <View ref={box} style={styles.rowMeasure} pointerEvents="none" />
      <View style={[styles.posBadge, { backgroundColor: tint + '20', borderColor: tint + '77' }]}>
        <Text style={[styles.posText, { color: tint }]}>{pos}</Text>
      </View>

      <View style={styles.playerBody}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.n}
        </Text>
        <Text style={styles.playerMeta} numberOfLines={1}>
          {player.nat} - {player.club} {player.season}
        </Text>
      </View>

      <View
        style={[
          styles.ratingPill,
          hideRatings ? styles.ratingHidden : { backgroundColor: fill },
        ]}
      >
        <Text
          style={[styles.ratingText, hideRatings && { color: color.text3 }]}
          allowFontScaling={false}
        >
          {hideRatings ? '?' : player.rtg}
        </Text>
      </View>
    </Press>
  );
}

/**
 * The rating ramp, read off the site: emerald at the top, through
 * yellow-green in the mid eighties, to tan at eighty-two and below. Colour
 * carries the number, so the list is skimmable without reading a digit.
 */
function ratingFill(rtg: number): string {
  if (rtg >= 90) return '#35D07F';
  if (rtg >= 87) return '#57D46E';
  if (rtg >= 85) return '#7FD35F';
  if (rtg >= 83) return '#9BD75F';
  if (rtg >= 80) return '#D9BE77';
  return '#C0A579';
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: { paddingBottom: space.s6 },
  header: { gap: space.s3, paddingBottom: space.s2 },
  block: {},
  /**
   * Five rows and a bit, so it is obviously a list you scroll rather than
   * a list that happens to be cut off.
   */
  listBox: { height: 344 },
  listFooter: { height: space.s4 },

  avgChip: {
    minWidth: 42,
    paddingHorizontal: space.s2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: color.accentWeak,
    borderWidth: 1,
    borderColor: line.accent,
    alignItems: 'center',
  },
  avgValue: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 19,
    color: color.accent,
    fontVariant: ['tabular-nums'],
  },

  spinBtn: { marginTop: space.s2 },
  autoFill: {
    alignSelf: 'center',
    marginTop: space.s3,
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  autoFillText: { ...text.key, fontSize: 9.5, color: color.text3 },

  rerollRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3 },
  rerollBtn: {
    paddingHorizontal: space.s5,
    paddingVertical: space.s3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
  },
  rerollSpent: { opacity: 0.4 },
  rerollText: { fontFamily: font.bodySemi, fontSize: 15, color: color.text1 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: color.gold },
  dotUsed: { backgroundColor: 'rgba(255,255,255,0.16)' },
  rerollsLeft: { fontFamily: font.body, fontSize: 13.5, color: color.text2 },

  needRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.s2 },
  needLabel: { ...text.key, fontSize: 9.5, color: color.text3 },
  needChip: {
    paddingHorizontal: space.s2 + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  needText: {
    fontFamily: font.displayBold,
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },

  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.s2,
  },
  listTitle: { ...text.label, color: color.accent, fontSize: 13 },
  listCount: { fontFamily: font.body, fontSize: 13, color: color.text3 },

  player: {
    minHeight: 58,
    marginBottom: space.s2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.05)',
  },
  playerOff: { opacity: 0.32 },
  // Invisible, and exactly the row's box. Measuring the Press itself would
  // catch it mid press, when it is scaled down under the thumb.
  rowMeasure: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  posBadge: {
    width: 50,
    height: 30,
    borderRadius: radius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posText: {
    fontFamily: font.displayBold,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  playerBody: { flex: 1, minWidth: 0 },
  playerName: {
    fontFamily: font.bodyBold,
    fontSize: 16,
    lineHeight: 21,
    color: color.text1,
  },
  playerMeta: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 16,
    color: color.text3,
  },
  ratingPill: {
    minWidth: 46,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingHidden: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: line.card,
  },
  ratingText: {
    fontFamily: font.displayBlack,
    fontSize: 19,
    lineHeight: 23,
    color: '#08160D',
    fontVariant: ['tabular-nums'],
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    marginVertical: space.s3,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: line.card },
  dividerText: { ...text.key, fontSize: 9, color: color.text3 },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,6,4,0.76)',
  },
  sheet: {
    backgroundColor: '#0B120E',
    experimental_backgroundImage:
      'linear-gradient(180deg, #16231B 0%, #0B120E 52%, #070B08 100%)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    boxShadow: '0px -20px 50px rgba(0,0,0,0.6)',
    paddingHorizontal: space.s5,
    paddingTop: space.s3,
    paddingBottom: space.s8,
    gap: space.s4,
    overflow: 'hidden',
  },
  sheetOrbs: { position: 'absolute', top: -30, left: -30, right: -30, height: 220 },
  sheetEdge: {
    position: 'absolute',
    top: 0,
    left: '18%',
    right: '18%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  sheetGrab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sheetPlayer: {
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
  sheetRating: {
    minWidth: 50,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRatingText: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 27,
    color: '#08160D',
    fontVariant: ['tabular-nums'],
  },
  sheetPlayerBody: { flex: 1, minWidth: 0 },
  sheetName: {
    fontFamily: font.bodyBold,
    fontSize: 17,
    lineHeight: 22,
    color: color.text1,
  },
  sheetMeta: { fontFamily: font.body, fontSize: 12.5, color: color.text3 },
  sheetTitle: {
    fontFamily: font.displayBlack,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: 0.2,
    color: color.text1,
  },
  sheetTiles: { flexDirection: 'row', gap: space.s3 },
  sheetTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: space.s5,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  sheetTilePos: {
    fontFamily: font.displayBlack,
    fontSize: 34,
    lineHeight: 41,
    letterSpacing: 1.4,
  },
  sheetTileLabel: {
    fontFamily: font.bodyMed,
    fontSize: 12.5,
    color: color.text2,
  },
  sheetCancel: { marginTop: space.s1 },
});
