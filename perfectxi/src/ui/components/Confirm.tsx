import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Text, View, StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { color, radius, space, line } from '../tokens';
import { font, text } from '../type';
import { GRAIN_URI } from '../grain';
import { haptic, useReduceMotion } from '../feel';
import { Press } from './Press';

/**
 * Asking before something is destroyed.
 *
 * A system alert would do the job, but it is the one grey box in an app
 * that has been built to look like nothing else, and it would announce
 * itself as a place where the design stopped. This is the same material as
 * every other surface here.
 *
 * It stays mounted until its exit has played, for the same reason the sheet
 * and the signing card do: unmounting on the press is what makes a thing
 * vanish rather than leave.
 */
export function Confirm({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reduce = useReduceMotion();
  const p = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  const drop = useCallback(() => setMounted(false), []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      haptic('warning');
      p.value = 0;
      p.value = reduce
        ? withTiming(1, { duration: 110 })
        : withSpring(1, { stiffness: 260, damping: 20, mass: 1 });
      return;
    }
    p.value = withTiming(0, { duration: reduce ? 90 : 170 }, (f) => {
      'worklet';
      if (f) runOnJS(drop)();
    });
  }, [visible, p, reduce, drop]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.92 + p.value * 0.08 }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  if (!mounted) return null;

  return (
    <Modal
      /*
       * Without this a modal is portrait only, whatever the device is
       * doing. React Native defaults supportedOrientations to portrait
       * alone, so on an iPad held sideways the card came up rotated in a
       * squeezed window in the middle of the screen while everything
       * behind it stayed landscape.
       *
       * Both landscapes, because a tablet is turned either way.
       */
      supportedOrientations={['portrait', 'landscape']}
      visible transparent animationType="none" onRequestClose={onCancel}
    >
      <Animated.View style={[styles.dim, dimStyle]} pointerEvents="none" />
      <View style={styles.root}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.orb} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="confirmOrb" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={color.danger} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={color.danger} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx="24" cy="4" rx="60" ry="46" fill="url(#confirmOrb)" />
            </Svg>
          </View>
          <View style={styles.grain} pointerEvents="none">
            <Image source={{ uri: GRAIN_URI }} resizeMode="repeat" style={styles.grainImage} />
          </View>
          <View style={styles.edge} pointerEvents="none" />

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.buttons}>
            <Press
              onPress={() => {
                haptic('light');
                onCancel();
              }}
              feel="none"
              scaleTo={0.96}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Press>
            <Press
              onPress={() => {
                haptic('medium');
                onConfirm();
              }}
              feel="none"
              scaleTo={0.96}
              style={styles.confirm}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Press>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3,6,4,0.8)',
  },
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.s5 },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(229,72,77,0.32)',
    backgroundColor: '#0D1611',
    experimental_backgroundImage:
      'linear-gradient(180deg, #17231C 0%, #0C120E 60%, #080C09 100%)',
    boxShadow: '0px 24px 56px rgba(0,0,0,0.6)',
    padding: space.s5,
    gap: space.s3,
    overflow: 'hidden',
  },
  orb: { position: 'absolute', top: -20, left: -20, right: -20, height: 160 },
  grain: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 },
  grainImage: { width: '100%', height: '100%' },
  edge: {
    position: 'absolute',
    top: 0,
    left: '22%',
    right: '22%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  title: {
    fontFamily: font.displayBlack,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: 0.2,
    color: color.text1,
  },
  body: {
    ...text.body,
    color: color.text2,
  },

  buttons: { flexDirection: 'row', gap: space.s3, marginTop: space.s2 },
  cancel: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelText: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: color.text2,
  },
  confirm: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.danger,
    backgroundColor: 'rgba(229,72,77,0.16)',
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(229,72,77,0.30) 0%, rgba(229,72,77,0.10) 100%)',
    boxShadow: 'inset 0px 1px 0px rgba(255,255,255,0.12)',
  },
  confirmText: {
    fontFamily: font.displayBold,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: '#FF9AA0',
  },
});
