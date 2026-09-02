import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import { useReduceMotion } from '../feel';

/**
 * The card shine.
 *
 * Every card on the site carries this and it is most of why the site looks
 * more expensive than a flat mockup of the site: a permanent bevel, and a
 * very soft band of light drifting across the surface, forever.
 *
 * Transcribed from the web build's universal card rule (index.html, the
 * `cardShine` block) without changing a value. The angle, the five stops,
 * the two inset shadows, the three durations and the negative delays are
 * all the shipped ones.
 *
 * The rule is that you should not be able to watch it. If a band is
 * clearly crossing the card it is too bright or too fast.
 */

/**
 * The three groups the site runs, at their own speeds and phases.
 *
 * The negative delays are the point. Every card in a group moves together,
 * but the groups are offset from each other, so a screen holding a hero
 * and a row of cards never pulses in unison.
 */
export type ShineGroup = 'panel' | 'card' | 'feature';

const SPEED: Record<ShineGroup, { ms: number; phase: number }> = {
  /* the site's default: 7s, no delay */
  panel: { ms: 7000, phase: 0 },
  /* player cards, era card, run rows, stat bars: 8.5s, delay -3.5s */
  card: { ms: 8500, phase: 3.5 / 8.5 },
  /* nation and cup cards: 6s, delay -4.5s */
  feature: { ms: 6000, phase: 4.5 / 6 },
};

/**
 * One clock per group for the whole app, rather than one per card.
 *
 * A screen can hold forty of these at once. Three native animations for
 * the entire app costs nothing; forty timings, each with its own callback
 * into the JavaScript thread, would not.
 */
const CLOCK: Record<ShineGroup, ReturnType<typeof makeMutable<number>>> = {
  panel: makeMutable(0),
  card: makeMutable(0),
  feature: makeMutable(0),
};

const running: Record<ShineGroup, boolean> = {
  panel: false,
  card: false,
  feature: false,
};

function startClock(group: ShineGroup) {
  if (running[group]) return;
  running[group] = true;
  CLOCK[group].value = withRepeat(
    withTiming(1, { duration: SPEED[group].ms, easing: Easing.linear }),
    -1,
    false,
  );
}

/**
 * How hard a card is allowed to shine.
 *
 * The site uses one value for everything. Here it climbs with the rating,
 * so a 94 catches the light and a 76 barely does, and above ninety the
 * band warms towards gold instead of staying white. This is the one place
 * the shine is allowed to be noticed.
 */
function intensity(rating?: number): { peak: number; mid: number; rgb: string; wide: boolean } {
  const white = '255,255,255';
  const gold = '214,178,94';
  if (rating === undefined) return { peak: 0.05, mid: 0.03, rgb: white, wide: false };
  if (rating >= 90) return { peak: 0.12, mid: 0.07, rgb: gold, wide: true };
  if (rating >= 85) return { peak: 0.08, mid: 0.05, rgb: white, wide: true };
  if (rating >= 80) return { peak: 0.05, mid: 0.03, rgb: white, wide: false };
  return { peak: 0.03, mid: 0.018, rgb: white, wide: false };
}

function band(peak: number, mid: number, rgb: string, wide: boolean): string {
  const [a, b, c, d] = wide ? [15, 35, 65, 85] : [20, 40, 60, 80];
  return (
    `linear-gradient(115deg, transparent ${a}%, rgba(${rgb},${mid}) ${b}%, ` +
    `rgba(${rgb},${peak}) 50%, rgba(${rgb},${mid}) ${c}%, transparent ${d}%)`
  );
}

/**
 * Drop this in as the first child of a card. It fills the card, sits
 * behind everything rendered after it, and takes no touches.
 */
export function Shine({
  radius = 14,
  group = 'panel',
  rating,
  reveal,
  bevel = true,
  phase = 0,
}: {
  /** the card's own corner radius, so the sweep is clipped to its shape */
  radius?: number;
  group?: ShineGroup;
  /** a player's rating, when the card belongs to one */
  rating?: number;
  /** fire one fast, brighter pass on mount, for a card being revealed */
  reveal?: boolean;
  /** the permanent bevel. Turn it off on a card that draws its own edge. */
  bevel?: boolean;
  /** extra offset within the group, 0 to 1, for staggering a list */
  phase?: number;
}) {
  const reduce = useReduceMotion();
  const width = useSharedValue(0);
  const flash = useSharedValue(0);

  const look = useMemo(() => intensity(rating), [rating]);
  const image = useMemo(
    () => band(look.peak, look.mid, look.rgb, look.wide),
    [look],
  );
  // The reveal pass is the same band, brighter, so it reads as the same
  // light moving faster rather than as a different effect.
  const flashImage = useMemo(
    () => band(Math.min(0.3, look.peak * 2.6), look.peak * 1.5, look.rgb, look.wide),
    [look],
  );

  useEffect(() => {
    if (reduce) return;
    startClock(group);
  }, [group, reduce]);

  useEffect(() => {
    if (!reveal || reduce) return;
    flash.value = 0;
    flash.value = withDelay(
      60,
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
    );
  }, [reveal, reduce, flash]);

  const clock = CLOCK[group];
  const offset = SPEED[group].phase + phase;

  // The web moves a 200% wide background from 150% to -50%, which puts the
  // bright middle of the band at -0.5 of the card's width at the start and
  // 1.5 of it at the end. This is that same travel.
  const sweep = useAnimatedStyle(() => {
    const p = (clock.value + offset) % 1;
    return { transform: [{ translateX: width.value * (p * 2 - 1.5) }] };
  });

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value > 0 && flash.value < 1 ? 1 : 0,
    transform: [{ translateX: width.value * (flash.value * 2 - 1.5) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    // Straight into a shared value: the sweep is the only thing that needs
    // the width, and it needs it on the UI thread, so this costs no render.
    width.value = e.nativeEvent.layout.width;
  };

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[
        styles.root,
        { borderRadius: radius },
        bevel ? styles.bevel : null,
      ]}
    >
      {reduce ? null : (
        <>
          <Animated.View
            style={[styles.band, { experimental_backgroundImage: image }, sweep]}
          />
          {reveal ? (
            <Animated.View
              style={[
                styles.band,
                { experimental_backgroundImage: flashImage },
                flashStyle,
              ]}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  /* a lit top edge, and the faintest possible outline around the whole card */
  bevel: {
    boxShadow:
      'inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.035)',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '200%',
  },
});
