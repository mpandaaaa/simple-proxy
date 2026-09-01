import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { haptic } from '../feel';
import { color, radius, hit, space, gradient, shadow, line } from '../tokens';
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
        haptic(variant === 'primary' ? 'medium' : 'light');
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        VARIANTS[variant].box,
        variant === 'primary' && styles.primarySize,
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
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
    box: {
      backgroundColor: color.accent,
      experimental_backgroundImage: gradient.hero,
      borderColor: color.accentHi,
      boxShadow: shadow.hero,
    },
    text: { color: '#06130C' },
  },
  secondary: {
    box: {
      backgroundColor: '#101A14',
      experimental_backgroundImage: gradient.cardLift,
      borderColor: line.cardHot,
      boxShadow: shadow.card,
    },
    text: { color: color.text1 },
  },
  ghost: {
    box: { backgroundColor: 'transparent', borderColor: line.card },
    text: { color: color.text2 },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: hit.button,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s4,
  },
  primarySize: { minHeight: hit.primary, borderRadius: radius.lg },
});
