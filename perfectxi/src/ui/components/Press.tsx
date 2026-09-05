import { ReactNode, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic, useReduceMotion } from '../feel';

/**
 * Layout belongs to the outer view, appearance to the inner one.
 *
 * A press wraps its content in two views: a Pressable that takes the touch
 * and an animated view that does the scaling. Putting the caller's whole
 * style on the inner view leaves the Pressable sized to its content, so a
 * `flex: 1` press does not fill its row and a `width: '100%'` one does not
 * stretch. That is why the position tiles came out a third of the width
 * each instead of half.
 *
 * These are the properties that decide how big a thing is and where it
 * sits, so they go on the Pressable. Everything else, the padding, the
 * fill, the border, the shadow, stays on the view that scales.
 */
const LAYOUT_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'zIndex',
] as const;

/**
 * Everything tappable that is bigger than a button goes through here.
 *
 * The scale is a worklet on the UI thread, so it never touches React state
 * and never drops a frame while a list is scrolling. A spring, not a timing
 * curve: a press should feel sprung under the thumb rather than animated
 * at it. With Reduce Motion there is no scale, only a dip in opacity.
 */
export function Press({
  children,
  onPress,
  feel = 'light',
  scaleTo = 0.97,
  style,
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  feel?: Parameters<typeof haptic>[0] | 'none';
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const reduce = useReduceMotion();
  const held = useSharedValue(0);

  const [outer, inner] = useMemo(() => {
    const flat = StyleSheet.flatten(style) ?? {};
    const out: Record<string, unknown> = {};
    const rest: Record<string, unknown> = { ...flat };
    for (const k of LAYOUT_KEYS) {
      if (k in rest) {
        out[k] = rest[k];
        delete rest[k];
      }
    }
    return [out as ViewStyle, rest as ViewStyle];
  }, [style]);

  const animated = useAnimatedStyle(() => ({
    opacity: 1 - held.value * 0.1,
    transform: [{ scale: reduce ? 1 : 1 - held.value * (1 - scaleTo) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      style={outer}
      onPressIn={() => {
        held.value = reduce
          ? withTiming(1, { duration: 90 })
          : withSpring(1, { stiffness: 420, damping: 30, mass: 1 });
      }}
      onPressOut={() => {
        held.value = reduce
          ? withTiming(0, { duration: 90 })
          : withSpring(0, { stiffness: 320, damping: 26, mass: 1 });
      }}
      onPress={(e) => {
        if (feel !== 'none') haptic(feel);
        onPress?.(e);
      }}
    >
      <Animated.View style={[styles.fill, inner, animated]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * The inner view has to fill whatever the Pressable was given, or a
   * press that was told to stretch would stretch its touch target and
   * not its face.
   *
   * The other side of that: a style handed to Press needs something that
   * bounds its height. Padding is usually enough, because the content
   * then sets the height. What is not enough is a style whose only
   * height comes from alignItems, with nothing to align inside: the
   * outer Pressable has no size to give, this grows into whatever space
   * the parent has, and the button runs to the bottom of the page.
   *
   * It happened twice in one afternoon, on two buttons written the same
   * afternoon, and looked completely reasonable on the page both times.
   * If a button is meant to be a certain height, say so with minHeight
   * and justifyContent, the way every other one here does.
   */
  fill: { flexGrow: 1 },
});
