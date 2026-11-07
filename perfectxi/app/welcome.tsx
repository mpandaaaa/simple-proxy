import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press, Shine } from '../src/ui/components';
import { enter, swap } from '../src/game/nav';
import { alpha, color, hue, radius, space } from '../src/ui/tokens';
import { font, text } from '../src/ui/type';
import { haptic, useReduceMotion } from '../src/ui/feel';
import { sfx } from '../src/ui/sound';
import { flagsStore } from '../src/save';

/**
 * The first thing anybody sees.
 *
 * Somebody opening this app for the first time gets a home screen with
 * six modes on it and no idea which one is the game. Three cards fix
 * that: what a draft is, what you are building, and what happens when it
 * is finished. Then straight into one.
 *
 * Three, and no more. A tutorial long enough to be skipped is a tutorial
 * nobody reads, so this is short enough to read and there is a way past
 * it on every card.
 *
 * Shown once, ever. The flag is written the moment it is opened rather
 * than when it is finished, because somebody who closes the app halfway
 * through has still seen it and should not meet it again.
 */

const CARDS = [
  {
    key: 'spin',
    kicker: 'ONE',
    title: 'Spin the years',
    body:
      'Every spin deals five real footballers out of thirty five seasons of the Premier League. Henry from 2003. Shearer from 1995. Haaland from last year. You take one.',
    art: 'spin' as const,
  },
  {
    key: 'build',
    kicker: 'TWO',
    title: 'Build an eleven',
    body:
      'Eleven shirts to fill, in a shape you choose. Players from the same club and the same era play better together, so the XI you end up with is the one you argued yourself into.',
    art: 'xi' as const,
  },
  {
    key: 'season',
    kicker: 'THREE',
    title: 'Play the season',
    body:
      'Thirty eight games against the real league, on a match engine built from the real numbers. A table, a grade, and a trophy cabinet that remembers all of it.',
    art: 'season' as const,
  },
];

export default function Welcome() {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [at, setAt] = useState(0);
  const scroller = useRef<ScrollView>(null);
  /* Measured on every render, not once. This is a paging carousel: each
     card is one window wide and the scroll position is in window widths,
     so a width read at mount and never updated leaves the pages the
     width the iPad used to be the moment it is turned. */
  const { width } = useWindowDimensions();

  /* Written on arrival, not on the way out. Somebody who closes the app on
     card two has still seen it. */
  const marked = useRef(false);
  if (!marked.current) {
    marked.current = true;
    try {
      flagsStore.update((f) => ({ ...f, intro: true }));
    } catch {
      /* A flag that will not save is not worth a crash. It only ever means
         somebody sees this twice. */
    }
  }

  const goTo = useCallback(
    (n: number) => {
      const to = Math.max(0, Math.min(CARDS.length - 1, n));
      setAt(to);
      scroller.current?.scrollTo({ x: to * width, animated: !reduce });
    },
    [width, reduce],
  );

  const start = useCallback(() => {
    haptic('success');
    sfx('whistle');
    enter('/draft');
  }, []);

  const skip = useCallback(() => {
    haptic('light');
    swap('/');
  }, []);

  const last = at === CARDS.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* the ground the whole thing sits on */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="welcome" cx="50%" cy="18%" r="90%">
              <Stop offset="0" stopColor={hue.emerald} stopOpacity={0.16} />
              <Stop offset="1" stopColor={hue.emerald} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcome)" />
        </Svg>
      </View>

      <View style={styles.head}>
        <Text style={styles.wordmark} allowFontScaling={false}>
          PERFECT <Text style={styles.wordmarkXI}>XI</Text>
        </Text>
        <Press onPress={skip} feel="light" scaleTo={0.94} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </Press>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const n = Math.round(e.nativeEvent.contentOffset.x / width);
          if (n !== at) {
            haptic('select');
            setAt(n);
          }
        }}
        style={styles.pager}
      >
        {CARDS.map((c) => (
          <View key={c.key} style={[styles.page, { width }]}>
            <View style={styles.card}>
              <Shine radius={radius.xl} group="feature" bevel={false} clip={false} />
              <View style={styles.art}>
                <Art kind={c.art} />
              </View>
              <Text style={styles.kicker}>{c.kicker}</Text>
              <Text style={styles.title} allowFontScaling={false}>
                {c.title}
              </Text>
              <Text style={styles.body}>{c.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.foot}>
        <View style={styles.dots}>
          {CARDS.map((c, i) => (
            <Press
              key={c.key}
              onPress={() => {
                haptic('light');
                goTo(i);
              }}
              feel="none"
              scaleTo={0.8}
              style={styles.dotTap}
              accessibilityLabel={`Card ${i + 1} of ${CARDS.length}`}
            >
              <View style={[styles.dot, i === at ? styles.dotOn : null]} />
            </Press>
          ))}
        </View>

        {last ? (
          <Animated.View entering={reduce ? undefined : FadeIn.duration(220)}>
            <Press onPress={start} feel="medium" scaleTo={0.98} style={styles.go}>
              <Text style={styles.goText}>Draft your first XI</Text>
            </Press>
          </Animated.View>
        ) : (
          <Press
            onPress={() => {
              haptic('light');
              goTo(at + 1);
            }}
            feel="medium"
            scaleTo={0.98}
            style={styles.next}
          >
            <Text style={styles.nextText}>Next</Text>
          </Press>
        )}

        <Text style={styles.note}>
          706 squad seasons {'·'} 2,978 players {'·'} 1992 to 2026
        </Text>
      </View>
    </View>
  );
}

/**
 * The three drawings.
 *
 * Drawn rather than photographed, so they are a few hundred bytes each
 * and they scale to any screen. Each one says what its card says without
 * needing the words underneath it.
 */
function Art({ kind }: { kind: 'spin' | 'xi' | 'season' }) {
  if (kind === 'spin') {
    /* Five cards fanned out, one of them lifted. */
    return (
      <Svg width="100%" height="100%" viewBox="0 0 200 120">
        {[-2, -1, 0, 1, 2].map((i) => {
          const lifted = i === 0;
          return (
            <Rect
              key={i}
              x={100 + i * 30 - 17}
              y={lifted ? 22 : 34}
              width={34}
              height={lifted ? 68 : 56}
              rx={6}
              fill={lifted ? alpha(hue.emerald, 0.9) : 'rgba(255,255,255,0.09)'}
              stroke={lifted ? hue.emerald : 'rgba(255,255,255,0.18)'}
              strokeWidth={1.6}
            />
          );
        })}
      </Svg>
    );
  }

  if (kind === 'xi') {
    /* Eleven dots in a 4-3-3, which is the shape everybody pictures. */
    const rows = [
      [100],
      [46, 82, 118, 154],
      [64, 100, 136],
      [58, 100, 142],
    ];
    return (
      <Svg width="100%" height="100%" viewBox="0 0 200 120">
        <Rect
          x={8}
          y={6}
          width={184}
          height={108}
          rx={8}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1.4}
        />
        <Path d="M8 60H192" stroke="rgba(255,255,255,0.12)" strokeWidth={1.2} />
        <Circle cx={100} cy={60} r={16} stroke="rgba(255,255,255,0.12)" strokeWidth={1.2} fill="none" />
        {rows.map((row, r) =>
          row.map((x) => (
            <Circle
              key={`${r}-${x}`}
              cx={x}
              cy={102 - r * 26}
              r={6.5}
              fill={r === 3 ? hue.emerald : alpha(hue.emerald, 0.55)}
            />
          )),
        )}
      </Svg>
    );
  }

  /* A season: a rising line and a trophy at the end of it. */
  return (
    <Svg width="100%" height="100%" viewBox="0 0 200 120">
      <Path
        d="M16 100 L52 82 L88 88 L124 52 L160 34"
        stroke={hue.emerald}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {[16, 52, 88, 124, 160].map((x, i) => (
        <Circle key={x} cx={x} cy={[100, 82, 88, 52, 34][i]} r={4} fill={hue.emerald} />
      ))}
      <Path
        d="M168 22h20v10a10 10 0 0 1-20 0V22Z"
        fill={alpha(hue.gold, 0.9)}
        stroke={hue.gold}
        strokeWidth={1.4}
      />
      <Path d="M178 42v8M172 52h12" stroke={hue.gold} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.s4,
    paddingTop: space.s4,
  },
  wordmark: {
    fontFamily: font.displayBlack,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1.2,
    color: color.text1,
  },
  wordmarkXI: { color: color.accent },
  skip: {
    minHeight: 40,
    paddingHorizontal: space.s3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  skipText: { ...text.key, fontSize: 9, color: color.text3 },

  pager: { flex: 1 },
  page: { justifyContent: 'center', paddingHorizontal: space.s4 },
  card: {
    padding: space.s5,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.28),
    backgroundColor: '#0C1611',
    overflow: 'hidden',
    gap: space.s2,
  },
  art: { height: 130, marginBottom: space.s3 },
  kicker: { ...text.key, fontSize: 9, color: hue.emerald },
  title: {
    fontFamily: font.displayBlack,
    fontSize: 30,
    lineHeight: 38,
    color: color.text1,
  },
  body: { ...text.small, fontSize: 14.5, lineHeight: 22, color: color.text2 },

  foot: { paddingHorizontal: space.s4, paddingBottom: space.s4, gap: space.s3 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 2 },
  dotTap: { padding: space.s2 },
  dot: {
    width: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dotOn: { backgroundColor: hue.emerald },

  go: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.accent,
  },
  goText: { ...text.button, fontSize: 16, color: '#06130C' },
  next: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(hue.emerald, 0.45),
    backgroundColor: alpha(hue.emerald, 0.12),
  },
  nextText: { ...text.button, fontSize: 15, color: hue.emerald },
  note: { ...text.key, fontSize: 7.5, color: color.text3, textAlign: 'center' },
});
