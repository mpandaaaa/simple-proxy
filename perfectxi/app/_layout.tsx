import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Imported per weight, not from the package root. Importing the root pulls
// every weight the family ships into the bundle: Inter alone is 18 faces and
// about 6MB we would never draw.
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular';
import { color } from '../src/ui/tokens';
import { AchievementToast } from '../src/ui/components';
import { useReduceMotion } from '../src/ui/feel';
import { syncReminder } from '../src/game/remind';
import { autoBackup } from '../src/game/backup';

SplashScreen.preventAutoHideAsync();

/**
 * Navigation is one native stack rooted at Home. No tabs, no drawer, no
 * persistent chrome of any kind.
 *
 * Because this is the native stack rather than the JS one, the push and pop
 * are the real UIKit slide and the interactive edge swipe back is the real
 * gesture, with the physics iOS users already have in their thumbs.
 */
export default function RootLayout() {
  const [ready, error] = useFonts({
    Anton_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    // Show the app once the faces are in. If a font fails outright we still
    // show the app rather than hanging on the splash forever.
    if (ready || error) SplashScreen.hideAsync();
  }, [ready, error]);

  // What is scheduled has to match what the settings say. A reminder can
  // be lost to a restore, a system cleanup, or notifications being turned
  // off in the phone and back on again, so it is put right on every start
  // rather than trusted to have survived.
  useEffect(() => {
    void syncReminder();
  }, []);

  /*
   * A copy of the save, kept without anybody asking for one.
   *
   * Written when the app goes into the background, which is every time it
   * is closed or swapped away from, and once on launch so there is always
   * something to fall back to. It skips itself if the last one is under a
   * minute old, so flicking in and out of the app does not fill the disk.
   */
  useEffect(() => {
    void autoBackup();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void autoBackup();
    });
    return () => sub.remove();
  }, []);

  if (!ready && !error) return null;

  return (
    // Gesture handler wants to own the root view. It is not used yet, but
    // it has to be the outermost view from the moment it is installed or
    // the first gesture added later silently does nothing.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
            // Reduce Motion turns the slide into a cross fade. The gesture
            // stays: taking someone's back swipe away is not an
            // accessibility win, it just makes the app harder to leave.
            animation: reduceMotion ? 'fade' : 'slide_from_right',
            gestureEnabled: true,
            fullScreenGestureEnabled: true,
          }}
        />
        {/* above every screen, so an achievement finds you wherever you are */}
        <AchievementToast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
