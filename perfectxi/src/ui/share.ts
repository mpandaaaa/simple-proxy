import { findNodeHandle, Platform, Share, type ShareContent } from 'react-native';
import type { RefObject } from 'react';
import type { View } from 'react-native';

/**
 * Sharing, from the thing that was tapped.
 *
 * On a phone the share sheet slides up from the bottom and where it came
 * from does not arise. On an iPad it is a popover, and a popover has to
 * point at something. Given nothing to point at, iOS puts it in a corner
 * with its little arrow aimed at empty space, which reads as a bug in
 * the app rather than a default in the system.
 *
 * So the button that opened it hands over its own position. The phone
 * ignores the anchor entirely, so there is one path rather than two.
 *
 * Nothing here throws. A share sheet that will not open is not worth
 * taking a screen down for, and the button is still there to press again.
 */
export async function shareFrom(
  anchorRef: RefObject<View | null>,
  content: ShareContent,
): Promise<boolean> {
  try {
    /* findNodeHandle returns null when the view has gone, which is what
       happens if a screen is left while the sheet is opening. Passing
       null is the same as passing nothing, so it degrades rather than
       breaks. */
    const anchor =
      Platform.OS === 'ios' && anchorRef.current
        ? (findNodeHandle(anchorRef.current) ?? undefined)
        : undefined;

    const res = await Share.share(content, anchor === undefined ? {} : { anchor });
    return res.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}

/** Where a view is on screen, in the shape expo-sharing wants. */
export type AnchorRect = { x: number; y: number; width: number; height: number };

/**
 * The same anchor, measured, for anything that wants a rectangle.
 *
 * expo-sharing asks for the rectangle rather than the node, so the view
 * has to be measured. Measuring is asynchronous and can fail if the view
 * has gone, in which case nothing is returned and the sheet falls back
 * to the system default rather than the call failing.
 */
export function anchorRect(
  anchorRef: RefObject<View | null>,
): Promise<AnchorRect | undefined> {
  return new Promise((resolve) => {
    const view = anchorRef.current;
    if (Platform.OS !== 'ios' || !view) return resolve(undefined);

    /* If the view never answers, carry on without it rather than leave
       the button spinning. A share sheet in the wrong corner is a much
       smaller problem than one that never opens. */
    const bail = setTimeout(() => resolve(undefined), 250);

    try {
      view.measureInWindow((x, y, width, height) => {
        clearTimeout(bail);
        if ([x, y, width, height].some((n) => !Number.isFinite(n))) {
          return resolve(undefined);
        }
        resolve({ x, y, width, height });
      });
    } catch {
      clearTimeout(bail);
      resolve(undefined);
    }
  });
}
