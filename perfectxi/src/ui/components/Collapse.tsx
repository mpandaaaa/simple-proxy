import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Text,
  UIManager,
  View,
  StyleSheet,
} from 'react-native';
import { color, radius, space, line, gradient, shadow, hue, alpha } from '../tokens';
import { font, text } from '../type';
import { IconChevron } from '../icons';
import { haptic, useReduceMotion } from '../feel';
import { Press } from './Press';

type Tone = 'accent' | 'blue' | 'purple' | 'gold';

const TONES: Record<Tone, string> = {
  accent: hue.emerald,
  blue: hue.sky,
  purple: hue.violet,
  gold: hue.gold,
};

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * A disclosure group: a tappable header with a count, and content that
 * folds away underneath it.
 *
 * This is the pattern iOS itself uses for secondary content, and it is the
 * right one here because the alternatives are worse. A separate screen puts
 * a push and a back between you and four one tap modes. A bottom sheet
 * hides that the modes exist at all. A tab bar is exactly what we removed.
 * A disclosure keeps everything one tap away, keeps the home screen short,
 * and lets someone open the group they use and leave the rest shut.
 *
 * The chevron rotates on the native thread; the fold itself is a
 * LayoutAnimation, which is the only way to animate to an unknown height
 * without measuring the content first. Under Reduce Motion it just cuts.
 */
export function Collapse({
  label,
  count,
  hint,
  tone = 'accent',
  children,
  defaultOpen = false,
}: {
  label: string;
  count?: number;
  /**
   * One line saying what is inside, drawn under the label.
   *
   * A closed group used to be a word and a number, which is a button
   * with no reason to press it. A group that says "Daily 246, Nineties
   * Week, two duels won" is worth opening, and worth not opening.
   */
  hint?: string;
  /** which colour the group belongs to, so three of them are three things */
  tone?: Tone;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReduceMotion();
  const spin = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(spin, {
      toValue: open ? 1 : 0,
      duration: reduce ? 0 : 190,
      useNativeDriver: true,
    }).start();
  }, [open, spin, reduce]);

  const toggle = () => {
    if (!reduce) {
      LayoutAnimation.configureNext({
        duration: 240,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
    }
    haptic('select');
    setOpen((v) => !v);
  };

  const tint = TONES[tone];

  return (
    <View style={styles.wrap}>
      <Press
        onPress={toggle}
        feel="none"
        scaleTo={0.985}
        style={[
          styles.head,
          { borderColor: open ? alpha(tint, 0.5) : alpha(tint, 0.2) },
          open ? { backgroundColor: alpha(tint, 0.07) } : null,
        ]}
        accessibilityLabel={`${label}, ${open ? 'open' : 'closed'}`}
      >
        {/* a rail in the group's own colour, so three headers are three
            sections rather than three identical buttons */}
        <View style={[styles.rail, { backgroundColor: tint, opacity: open ? 1 : 0.55 }]} />
        <Animated.View
          style={{
            transform: [
              {
                rotate: spin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '90deg'],
                }),
              },
            ],
          }}
        >
          <IconChevron color={open ? tint : color.text3} size={16} />
        </Animated.View>

        <View style={styles.headBody}>
          <Text style={[styles.label, open && styles.labelOpen]}>{label}</Text>
          {hint ? (
            <Text style={styles.hint} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>

        {count !== undefined ? (
          <View
            style={[
              styles.count,
              { backgroundColor: open ? alpha(tint, 0.18) : 'rgba(255,255,255,0.05)' },
            ]}
          >
            <Text style={[styles.countText, open ? { color: tint } : null]}>{count}</Text>
          </View>
        ) : null}
      </Press>

      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    minHeight: 62,
    paddingVertical: space.s3,
    paddingLeft: space.s4,
    paddingRight: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  headBody: { flex: 1, minWidth: 0, gap: 2 },
  label: {
    ...text.label,
    fontSize: 12.5,
    color: color.text2,
  },
  labelOpen: { color: color.text1 },
  hint: { ...text.small, fontSize: 11.5, lineHeight: 16, color: color.text3 },
  count: {
    minWidth: 24,
    paddingHorizontal: space.s2,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  countText: {
    fontFamily: font.displaySemi,
    fontSize: 12,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  body: { marginTop: space.s2 },
});
