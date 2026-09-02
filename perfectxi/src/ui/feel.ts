import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import { settingsStore } from '../save';

/**
 * The two things that decide how the app feels: whether it is allowed to
 * move, and whether it is allowed to buzz. Both are read in one place so a
 * screen never has to think about it.
 */

/**
 * True when the phone's Reduce Motion switch is on, or when the in app
 * setting is. Transitions become fades and press states stop scaling.
 *
 * The system value is asked for once on mount and then subscribed to, so
 * turning it on in Settings takes effect without a relaunch.
 */
export function useReduceMotion(): boolean {
  const [system, setSystem] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setSystem(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (on) => setSystem(on),
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return system || settingsStore.read().reducedMotion;
}

type Feel = 'select' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Haptics, gated on the setting. Fire and forget: a failed haptic must
 * never interrupt the thing the player actually asked for, so the promise
 * is swallowed rather than left to reject unhandled.
 */
export function haptic(kind: Feel): void {
  if (!settingsStore.read().haptics) return;
  const run = (): Promise<void> => {
    switch (kind) {
      case 'select':
        return Haptics.selectionAsync();
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  void run().catch(() => {});
}
