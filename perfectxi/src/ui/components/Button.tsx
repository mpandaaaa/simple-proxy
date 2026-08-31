import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { color, radius, hit, space } from '../tokens';
import { text } from '../type';

type Variant = 'primary' | 'secondary' | 'ghost';

/**
 * Every press gives haptic feedback. On the web build this was a
 * navigator.vibrate stub that did nothing on iOS. Here it is the real
 * Taptic Engine, and it is the first thing that makes the app feel native.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        Haptics.impactAsync(
          variant === 'primary'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        VARIANTS[variant].box,
        variant === 'primary' && styles.primarySize,
        pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      <Text style={[text.button, VARIANTS[variant].text]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { box: ViewStyle; text: { color: string } }> = {
  primary: {
    box: { backgroundColor: color.accent, borderColor: color.accentHi },
    text: { color: '#06120C' },
  },
  secondary: {
    box: { backgroundColor: color.surface3, borderColor: color.borderStrong },
    text: { color: color.text1 },
  },
  ghost: {
    box: { backgroundColor: 'transparent', borderColor: color.border },
    text: { color: color.text2 },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: hit.button,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s4,
  },
  primarySize: { minHeight: hit.primary, borderRadius: radius.md },
});
