import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
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
import { noteHere } from '../src/game/nav';
import { startAds } from '../src/game/ads';

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
  const path = usePathname();

  /* Where we actually are, so nothing can push the page it is already on.
     This covers the edge swipe too, which changes the route without going
     through anything in nav.ts. */
  useEffect(() => {
    noteHere(path);
  }, [path]);

  useEffect(() => {
    // Show the app once the faces are in. If a font fails outright we still
    // show the app rather than hanging on the splash forever.
    if (ready || error) SplashScreen.hideAsync();
  }, [ready, error]);

  // What is scheduled has to match what the settings say. A reminder can
  // be lost to a restore, a system cleanup, or notifications being turned
  // off in the phone and back on again, so it is put right on every start
  // rather than trusted to have survived.
  /*
   * The colour behind everything.
   *
   * A native stack slides the screen you are leaving off the top of
   * whatever the root view is, and during the swipe back that root view
   * is visible around the edges. Left as it comes it is white, so the
   * whole app was framed in white for the length of every back gesture.
   * It is the app's own ground now.
   */
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(color.bg).catch(() => {});
  }, []);

  useEffect(() => {
    void syncReminder();
  }, []);

  /*
   * The adverts.
   *
   * Started after the app is up rather than before it, because the first
   * thing it does is ask about tracking and a permission sheet over a
   * splash screen is a bad way to meet somebody. Nothing here can fail
   * loudly: no adverts is a worse game, not a broken one.
   */
  useEffect(() => {
    void startAds();
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider style={{ backgroundColor: color.bg }}>
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
            /*
             * The edge swipe, not the full screen one.
             *
             * A full screen back gesture is not the system's own. It is
             * drawn by react-native-screens, which lifts the screen you
             * are leaving onto a card with rounded corners and slides it,
             * and the corners of that card showed a light frame around
             * the whole app for as long as the swipe lasted. The window
             * behind it is already the app's own black, so there was
             * nothing to recolour: the card itself was the problem.
             *
             * The left edge swipe is UIKit's own. It reveals the screen
             * underneath rather than drawing a card, there is nothing
             * behind it to see, and it is the gesture every other app on
             * the phone uses.
             */
            navigationBarColor: color.bg,
          }}
        />
        {/* above every screen, so an achievement finds you wherever you are */}
        <AchievementToast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
