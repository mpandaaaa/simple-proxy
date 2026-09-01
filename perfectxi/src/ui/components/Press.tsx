import { ReactNode, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import { haptic, useReduceMotion } from '../feel';

/**
 * Everything tappable that is bigger than a button goes through here.
 *
 * The scale runs on the native thread through useNativeDriver, so it never
 * touches React state and never drops a frame while a list is scrolling.
 * A spring, not a timing curve: the press should feel sprung under the
 * thumb rather than animated at it.
 *
 * With Reduce Motion on there is no scale at all, only a dip in opacity.
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
  const scale = useRef(new Animated.Value(1)).current;
  const dim = useRef(new Animated.Value(1)).current;

  const springTo = (to: number) => {
    if (reduce) return;
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 5,
    }).start();
  };

  const fadeTo = (to: number) => {
    Animated.timing(dim, {
      toValue: to,
      duration: 90,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPressIn={() => {
        springTo(scaleTo);
        fadeTo(0.9);
      }}
      onPressOut={() => {
        springTo(1);
        fadeTo(1);
      }}
      onPress={(e) => {
        if (feel !== 'none') haptic(feel);
        onPress?.(e);
      }}
    >
      <Animated.View
        style={[style, { opacity: dim, transform: [{ scale }] }]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
