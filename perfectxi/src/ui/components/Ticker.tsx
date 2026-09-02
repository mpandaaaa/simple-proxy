import { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReduceMotion } from '../feel';

/**
 * A number that travels from where it was to where it is.
 *
 * Every stat in the app that changes while you watch goes through here. A
 * number that snaps from 86 to 89 tells you the value; a number that runs
 * up to it tells you something happened.
 *
 * Driven from JavaScript, because there is no way to animate the glyphs
 * inside a Text node from the native side. It runs for well under a second
 * at a time and stops the moment it is unmounted, and it is always the only
 * thing running when it runs.
 *
 * A dash rather than a zero for "nothing yet". Zero is a rating; a
 * goalkeeper you have not drafted does not have one.
 */
export function Ticker({
  value,
  style,
  duration = 620,
  blank = '–',
  from: start,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
  /** what to show when the value is zero */
  blank?: string;
  /** where the count starts on mount, so a number can arrive by running */
  from?: number;
}) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(start ?? value);
  const frame = useRef<number | null>(null);
  const from = useRef(start ?? value);

  useEffect(() => {
    const start = from.current;
    if (reduce || start === value) {
      from.current = value;
      setShown(value);
      return;
    }

    const t0 = Date.now();
    const run = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) {
        frame.current = requestAnimationFrame(run);
      } else {
        from.current = value;
      }
    };
    frame.current = requestAnimationFrame(run);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      from.current = value;
    };
  }, [value, duration, reduce]);

  return (
    <Text style={style} allowFontScaling={false}>
      {shown ? shown : blank}
    </Text>
  );
}
