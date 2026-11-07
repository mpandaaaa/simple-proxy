import { useEffect } from 'react';
import { AppState, Text, TextInput } from 'react-native';
import { DarkTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
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

SplashScreen.preventAutoHideAsync();

/*
 * How far text is allowed to grow.
 *
 * iOS lets somebody scale text up to about three times, and this app has
 * fourteen hundred pieces of text of which only a fifth opt out. At full
 * accessibility size a fourteen point label becomes forty three, and a
 * row of three tiles, a league table or a card face has no way to hold
 * that. It stops being large text and becomes a broken screen.
 *
 * A cap of 1.6 is the compromise most apps make. Text still grows by
 * more than half, which is the point of the setting, and no layout is
 * asked to hold three times what it was drawn for.
 *
 * This changes nothing for anybody at the normal size, because the
 * multiplier is one and the cap never applies. It only ever affects
 * somebody who has turned text up, and for them the choice is between
 * bigger text and a screen that works.
 *
 * Applied through defaultProps because React Native offers no other way
 * to say it once. If a future version stops honouring that, this becomes
 * a no-op rather than an error, and the app is exactly where it is now.
 */
const MAX_TEXT_SCALE = 1.6;
for (const C of [Text, TextInput] as unknown as { defaultProps?: Record<string, unknown> }[]) {
  C.defaultProps = C.defaultProps ?? {};
  if (C.defaultProps.maxFontSizeMultiplier === undefined) {
    C.defaultProps.maxFontSizeMultiplier = MAX_TEXT_SCALE;
  }
}

/*
 * The colour behind every screen.
 *
 * This is what the white border turned out to be, after four wrong
 * guesses. Navigation keeps its own theme, separate from anything the
 * app paints, and without one it uses the light default whose background
 * is rgb(242, 242, 242). That colour sits underneath the screens, so it
 * is invisible until something moves and uncovers an edge of it. It was
 * measured off a screenshot early on and not recognised for what it was.
 *
 * Painting the root view, the gesture root and the safe area provider
 * could never have fixed it: the navigation container is its own layer
 * inside all three. Nor could navigationBarColor, which is Android only.
 *
 * Dark, with the background replaced by the app's own ground so the
 * colour under the screens is the same colour as the screens.
 */
const NAV_THEME = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.bg, card: color.bg },
};

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
      /*
       * 'background' only. Not 'inactive'.
       *
       * On iOS 'inactive' is a moment, not a state: it fires for the app
       * switcher, control centre, any system alert, a notification
       * pulled down, and briefly during launch. Backing up on it meant a
       * full save serialised every time somebody glanced away, and
       * flicking in and out of the app queued several at once and froze
       * it. 'background' is the app actually leaving, which is the only
       * time a snapshot is worth taking.
       */
      if (state === 'background') void autoBackup();
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
        <ThemeProvider value={NAV_THEME}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.bg },
            /* The strip the screens sit on. Uncovered by a gesture that
               drags a screen without popping it, and light grey unless it
               is told otherwise. */
            navigationBarColor: color.bg,
            // Reduce Motion turns the slide into a cross fade. The gesture
            // stays: taking someone's back swipe away is not an
            // accessibility win, it just makes the app harder to leave.
            animation: reduceMotion ? 'fade' : 'slide_from_right',
            gestureEnabled: true,
            /*
             * The edge swipe, not the full screen one, which is why
             * fullScreenGestureEnabled is deliberately absent. A full
             * screen gesture is drawn by react-native-screens rather than
             * by UIKit, and it can be started from the middle of a screen
             * where a scroll or a card tap was meant instead.
             */
          }}
        >
          {/*
           * Home has nothing behind it.
           *
           * The back gesture was still enabled on it, and a back gesture
           * with nothing to pop rubber bands the screen a few points to
           * the right instead of doing nothing. That uncovers the strip
           * of container the screens sit on, which is a light grey none
           * of the app's own colours reach, and it read as a white border
           * down the side of the app.
           *
           * Measured rather than guessed: of eight screenshots, the only
           * two showing it were both Home, the light was only ever on the
           * left, and the width of it differed between them, which is a
           * drag in progress rather than a border.
           */}
          <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        </Stack>
        </ThemeProvider>
        {/* above every screen, so an achievement finds you wherever you are */}
        <AchievementToast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
