import { View, ViewProps, StyleSheet } from 'react-native';
import { color, radius, space } from '../tokens';
import { Shine, type ShineGroup } from './Shine';

type Level = 1 | 2 | 3;

/**
 * A raised panel. Elevation is carried by the surface colour stepping
 * lighter and by a one pixel top highlight, never by a drop shadow.
 *
 * Every panel carries the card shine, which is what stops a dark rectangle
 * reading as a dead rectangle. It sits behind the content and takes no
 * touches.
 */
export function Surface({
  level = 1,
  style,
  children,
  shine = 'panel',
  ...rest
}: ViewProps & { level?: Level; shine?: ShineGroup | false }) {
  const flat = StyleSheet.flatten([styles.base, style]) ?? {};
  const r = typeof flat.borderRadius === 'number' ? flat.borderRadius : radius.md;

  return (
    <View style={[styles.base, LEVELS[level], style]} {...rest}>
      {shine ? <Shine radius={r} group={shine} /> : null}
      {children}
    </View>
  );
}

const LEVELS: Record<Level, { backgroundColor: string }> = {
  1: { backgroundColor: color.surface1 },
  2: { backgroundColor: color.surface2 },
  3: { backgroundColor: color.surface3 },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderTopColor: color.topHighlight,
    padding: space.s4,
  },
});
