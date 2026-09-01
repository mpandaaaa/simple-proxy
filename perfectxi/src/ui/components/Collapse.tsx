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
import { color, radius, space, line, gradient, shadow } from '../tokens';
import { font, text } from '../type';
import { IconChevron } from '../icons';
import { haptic, useReduceMotion } from '../feel';
import { Press } from './Press';

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
  children,
  defaultOpen = false,
}: {
  label: string;
  count?: number;
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

  return (
    <View style={styles.wrap}>
      <Press
        onPress={toggle}
        feel="none"
        scaleTo={0.985}
        style={[styles.head, open && styles.headOpen]}
        accessibilityLabel={`${label}, ${open ? 'open' : 'closed'}`}
      >
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
          <IconChevron color={open ? color.accent : color.text3} size={16} />
        </Animated.View>

        <Text style={[styles.label, open && styles.labelOpen]}>{label}</Text>

        {count !== undefined ? (
          <View style={[styles.count, open && styles.countOpen]}>
            <Text style={[styles.countText, open && styles.countTextOpen]}>
              {count}
            </Text>
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
    paddingVertical: space.s3 + 1,
    paddingHorizontal: space.s4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: '#101A14',
    experimental_backgroundImage: gradient.card,
    boxShadow: shadow.card,
  },
  headOpen: { borderColor: line.cardHot },
  label: {
    flex: 1,
    ...text.label,
    fontSize: 12.5,
    color: color.text2,
  },
  labelOpen: { color: color.text1 },
  count: {
    minWidth: 24,
    paddingHorizontal: space.s2,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  countOpen: { backgroundColor: color.accentWeak },
  countText: {
    fontFamily: font.displaySemi,
    fontSize: 12,
    color: color.text3,
    fontVariant: ['tabular-nums'],
  },
  countTextOpen: { color: color.accent },
  body: { marginTop: space.s2 },
});
