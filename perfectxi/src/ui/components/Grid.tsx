import { Children, ReactNode, isValidElement, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
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
 * It measures the space it has actually been given rather than working
 * it out from the window.
 *
 * That distinction is the whole component. The first version asked the
 * window how wide it was and assumed it had all of it, which is true on
 * Home and false anywhere else: dropped inside a page that caps its
 * content to a readable column, it would have sized four cells for a
 * thirteen inch iPad, put them in a 560 point column, and pushed the
 * last one off the edge. Measuring cannot be wrong in that way, and it
 * is also what keeps it right in split screen and while a divider is
 * being dragged.
 *
 * The cost is one render before the first measurement arrives, which is
 * spent showing the children stacked. That is the phone layout, so on a
 * phone nothing ever changes and there is no flash.
 *
 * Widths are in points, never percentages. Four cells at twenty five
 * percent plus three gaps is wider than the row and the fourth wraps.
 *
 * Anything that should span the full row, a hero card or a heading, goes
 * outside the grid. This lays out siblings, it does not try to guess
 * which of them is special.
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
   * Set it to the width below which the thing inside stops working, not
   * to the width you would like. A mode card carrying a kicker, a title
   * and a full sentence of subtitle needs about 300. A player tile needs
   * far less.
   */
  min?: number;
  /** Never more than this many columns, however wide the window gets. */
  max?: number;
  gap?: number;
}) {
  const L = useLayout();
  const [room, setRoom] = useState(0);
  const items = Children.toArray(children).filter(isValidElement);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== room) setRoom(w);
  };

  /* How many fit in the room actually measured, allowing for the gaps
     between them. Before the first measurement, and on a narrow window,
     this is one. */
  const fits = room > 0 && L.wide
    ? Math.max(1, Math.min(max, Math.floor((room + gap) / (min + gap))))
    : 1;

  const n = Math.min(fits, items.length);

  /* One column is the phone, and the phone is the common case. The
     children are returned untouched rather than each wrapped in a full
     width view, so a phone renders exactly the views it did before any
     of this existed. */
  if (n <= 1) {
    return <View onLayout={onLayout}>{children}</View>;
  }

  const w = cellWidth(room, n, gap);

  return (
    <View onLayout={onLayout} style={[styles.row, { gap }]}>
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
