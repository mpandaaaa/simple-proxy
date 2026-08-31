import { View, ViewProps, StyleSheet } from 'react-native';
import { color, radius, space } from '../tokens';

type Level = 1 | 2 | 3;

/**
 * A raised panel. Elevation is carried by the surface colour stepping
 * lighter and by a one pixel top highlight, never by a drop shadow.
 */
export function Surface({
  level = 1,
  style,
  ...rest
}: ViewProps & { level?: Level }) {
  return <View style={[styles.base, LEVELS[level], style]} {...rest} />;
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
