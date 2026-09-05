import { ReactNode, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { space } from '../tokens';
import { useLayout } from '../layout';

/**
 * Two panes side by side when there is room, one above the other when
 * there is not.
 *
 * This is the difference between a tablet app and a phone app made
 * wider. A draft board on an iPad should show the pitch and the reel at
 * once, because they are the two things being looked at together; a
 * match should show the pitch beside the commentary rather than pushing
 * the commentary off the bottom. Stacking them and letting each grow
 * wider fills the screen without ever using it.
 *
 * It measures the room it has been given rather than asking the window,
 * for the same reason `Grid` does: a component that assumes it owns the
 * full width is right on one screen and wrong everywhere else, and the
 * failure is a pane pushed off the edge.
 *
 * Splitting only in landscape is deliberate. An iPad held upright is
 * tall and narrowish, and two panes side by side there gives two columns
 * too narrow for either, which is worse than one good one.
 *
 * The phone path returns the two children stacked with nothing wrapped
 * around them, so a phone renders exactly what it did before this
 * existed.
 */
export function Split({
  main,
  side,
  /**
   * How much of the width the main pane takes, nought to one.
   *
   * Default leans to the main pane because the thing on the left is
   * usually the subject, a pitch or a table, and the thing on the right
   * is usually about it.
   */
  ratio = 0.58,
  gap = space.s4,
  /** Below this the panes are stacked however wide the window is. */
  min = 900,
}: {
  main: ReactNode;
  side: ReactNode;
  ratio?: number;
  gap?: number;
  min?: number;
}) {
  const L = useLayout();
  const [room, setRoom] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.floor(e.nativeEvent.layout.width);
    if (w !== room) setRoom(w);
  };

  const split = L.wide && !L.portrait && room >= min;

  if (!split) {
    return (
      <View onLayout={onLayout}>
        {main}
        {side}
      </View>
    );
  }

  /* Points, not percentages: two panes at fifty percent plus a gap is
     wider than the row, and the second one drops underneath. */
  const mainW = Math.floor((room - gap) * ratio);
  const sideW = room - gap - mainW;

  return (
    <View onLayout={onLayout} style={[styles.row, { gap }]}>
      <View style={{ width: mainW }}>{main}</View>
      <View style={{ width: sideW }}>{side}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
});
