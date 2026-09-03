/**
 * The app's configuration.
 *
 * This is a JavaScript config rather than the app.json it replaces for
 * one reason. The development server asks the expo-updates command line
 * tool to resolve a runtime version on every manifest request, and on
 * Windows that spawn fails outright when the machine is short of memory,
 * with
 *
 *   cli.js runtimeversion:resolve --platform ios
 *   exited with non-zero code: 3221225794
 *
 * which is STATUS_DLL_INIT_FAILED: Windows could not start the process at
 * all. The app then will not load and nothing about the app is wrong.
 *
 * A development build talks to the server directly and never fetches an
 * update, so it needs none of it. EAS builds do, and they set EAS_BUILD,
 * so a real build keeps the runtime version and the update URL exactly as
 * they were.
 *
 * Everything else here is what app.json held, moved rather than changed.
 * There is no app.json any more because having both is what expo-doctor
 * warns about, and it has to stay at 21 of 21.
 */

const OTA = {
  runtimeVersion: '1.0.0',
  updates: {
    url: 'https://u.expo.dev/ad10b44d-55a2-4708-a3d5-715849cf6baa',
    fallbackToCacheTimeout: 10000,
  },
};

module.exports = () => ({
  name: 'Perfect XI',
  slug: 'perfectxi',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'perfectxi',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0A0F0C',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.perfectxi.game',
    buildNumber: '1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'app.perfectxi.game',
    adaptiveIcon: {
      backgroundColor: '#0A0F0C',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0A0F0C',
        image: './assets/splash-icon.png',
        imageWidth: 180,
      },
    ],
    'expo-audio',
    'expo-sharing',
    'expo-asset',
    'expo-secure-store',
    'expo-web-browser',
    'expo-mail-composer',
    'expo-build-properties',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'ad10b44d-55a2-4708-a3d5-715849cf6baa',
    },
  },
  // Only a real build ships updates. The dev server never resolves one.
  ...(process.env.EAS_BUILD ? OTA : {}),
});
