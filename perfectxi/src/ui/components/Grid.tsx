import { Children, ReactNode, isValidElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { space } from '../tokens';
import { useLayout, cellWidth } from '../layout';

/**
 * Things side by side when there is room, stacked when there is not.
 *
 * The app was built as a column, which is right on a phone and wrong on
 * a tablet: a phone sized column of cards floating in the middle of a
 * thirteen inch screen is what an app looks like when it was never meant
 * for the device it is on.
 *
 * Everything about how many columns comes from the width actually
 * available, not from asking whether this is an iPad. That is what makes
 * it right in split screen, and right the instant the iPad is turned,
 * both of which a device check gets wrong.
 *
 * Widths are worked out in points rather than percentages because a
 * percentage and a gap fight each other: four cells at twenty five
 * percent plus three gaps is wider than the row, and the fourth wraps
 * onto a line of its own.
 *
 * A child that should span the whole row, a hero card or a heading, goes
 * outside the grid rather than inside it. This lays out siblings, it
 * does not try to guess which of them is special.
 */
export function Grid({
  children,
  min = 320,
  max = 3,
  gap = space.s3,
}: {
  children: ReactNode;
  /**
   * The narrowest a cell may be before a column is dropped.
   *
   * Set it to the width below which the thing inside stops being
   * readable, not to the width you would like. A mode card with a
   * kicker, a title and a subtitle needs about 320. A player card needs
   * far less.
   */
  min?: number;
  /** Never more than this many columns, however wide the window gets. */
  max?: number;
  gap?: number;
}) {
  const L = useLayout();
  const items = Children.toArray(children).filter(isValidElement);

  const room = Math.min(L.width, L.wideCap) - space.s4 * 2;
  const n = Math.min(L.cols(min, max), items.length);

  /* One column is the phone, and the phone is the common case. Returning
     the children untouched keeps it to exactly the views it had before
     any of this existed. */
  if (n <= 1) return <>{children}</>;

  const w = cellWidth(room, n, gap);

  return (
    <View style={[styles.row, { gap }]}>
      {items.map((child, i) => (
        <View key={i} style={{ width: w }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
});
