import { useWindowDimensions } from 'react-native';
import { READABLE, space } from './tokens';

/**
 * How much room this screen actually has.
 *
 * One place that answers it, because the alternative is thirty screens
 * each guessing with their own magic numbers, and thirty screens that
 * disagree the first time somebody rotates an iPad.
 *
 * The rule the whole app follows:
 *
 *   Text stays in a column. A line of body text the full width of a
 *   thirteen inch iPad is genuinely harder to read than the same text in
 *   a column, so READABLE still caps anything that is read as prose.
 *
 *   Everything else uses the room. A grid of mode tiles, a wall of
 *   cards, a league table, a draft board: those are scanned rather than
 *   read, and a phone sized column of them floating in the middle of a
 *   big screen is what makes an app look like it was never meant for the
 *   device it is on.
 *
 * Measured from the window rather than from the device, so it is right
 * in split screen and right the instant the iPad is turned, neither of
 * which a check against "is this an iPad" would get right.
 */

/** Below this the window is a phone, above it there is room to spread out. */
const WIDE_AT = 700;

/** The widest a page of grids is allowed to get, so it stays composed. */
const WIDE_CAP = 1180;

export type Layout = {
  /** True when there is enough width to lay things out side by side. */
  wide: boolean;
  /** True when the window is taller than it is wide. */
  portrait: boolean;
  /** The whole window, in points. */
  width: number;
  height: number;
  /** The cap for prose: always a readable column. */
  readCap: number;
  /** The cap for grids and tables: the room available, within reason. */
  wideCap: number;
  /**
   * How many columns of at least `min` points fit, between one and `max`.
   *
   * Takes the gap between columns into account, so a row of four does not
   * silently become a row of four that overflows.
   */
  cols: (min: number, max?: number) => number;
};

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_AT;
  const wideCap = Math.min(width, WIDE_CAP);

  return {
    wide,
    portrait: height >= width,
    width,
    height,
    readCap: READABLE,
    wideCap,
    cols(min: number, max = 6) {
      const room = Math.min(width, wideCap) - space.s4 * 2;
      const n = Math.floor((room + space.s3) / (min + space.s3));
      return Math.max(1, Math.min(max, n));
    },
  };
}

/**
 * The width of one cell, in points, for a grid of `n` columns.
 *
 * In points rather than a percentage because a percentage and a gap
 * fight each other: four cells at twenty five percent plus three gaps is
 * wider than the row, and the fourth wraps onto a line of its own. Doing
 * the arithmetic here is the only way a row of four is a row of four.
 *
 * Floored, because a fraction of a point rounds up on some screens and
 * that is enough to wrap the last cell.
 */
export function cellWidth(room: number, n: number, gapPx: number = space.s3): number {
  if (n <= 1) return room;
  return Math.floor((room - gapPx * (n - 1)) / n);
}
