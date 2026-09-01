import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '../feel';

/**
 * Content that arrives rather than appears.
 *
 * Each block on a screen fades up a beat after the one above it. It is a
 * small thing and it is most of the difference between a screen that feels
 * built and a screen that feels printed. Both properties run on the native
 * thread, so a stagger costs nothing while the list underneath is scrolling.
 *
 * Under Reduce Motion everything is simply already there.
 */
export function Rise({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: ReactNode;
  /** index in the stagger, not milliseconds */
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(reduce ? 1 : 0)).current;

  useEffect(() => {
    if (reduce) {
      t.setValue(1);
      return;
    }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 320,
      delay: delay * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay, reduce]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            {
              translateY: t.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
