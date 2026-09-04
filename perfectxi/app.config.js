/**
 * The app's configuration.
 *
 * This is a JavaScript config rather than the app.json it replaces
 * because it has to be able to say different things in development and
 * in a build, and because of one Windows failure that took three goes to
 * kill properly:
 *
 *   cli.js runtimeversion:resolve --platform ios
 *   exited with non-zero code: 3221225794
 *
 * which is STATUS_DLL_INIT_FAILED: Windows could not start the process
 * at all. The phone then says it cannot connect to a server that is
 * plainly running, because the manifest fails while the bundle carries
 * on working.
 *
 * The development server asks the expo-updates command line tool to
 * resolve a runtime version on every single manifest request, and it
 * does that whatever the config says. Dropping the runtime version did
 * not help, because with none set it resolves the default. Pinning a
 * literal one did not help either. The one thing the middleware treats
 * as a reason not to spawn is the package not being there at all, so it
 * is not there: expo-updates is uninstalled and the runtime version is
 * worked out in process from the string below.
 *
 * Nothing is lost today. Over the air updates were configured and never
 * used, and version 1.0 has not shipped. Putting them back is
 * `npx expo install expo-updates`, restoring the `updates` block with
 * the project's own URL, and one build.
 *
 * Everything else here is what app.json held, moved rather than changed.
 * There is no app.json any more because having both is what expo-doctor
 * warns about, and it has to stay at 21 of 21.
 */

/**
 * The runtime version, as a plain string.
 *
 * Spelled out rather than derived, so that nothing has to be run to work
 * it out. It is the value the update channel used, so it is the value to
 * keep if updates ever come back.
 */
const RUNTIME = '1.0.0';

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
    /* An iPad runs this perfectly well and it is the same portrait layout
       on a bigger screen. Locked to portrait, like the phone. */
    supportsTablet: true,
    /* The window behind the screens. Without it the back gesture, which
       slides the top screen off whatever is underneath, framed the whole
       app in white for the length of the swipe. */
    backgroundColor: '#0A0F0C',
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
    'expo-document-picker',
    [
      /*
       * The daily reminder.
       *
       * Off unless somebody turns it on, and it is the only notification
       * this app will ever send. The icon is the monochrome one, which is
       * what iOS wants for a badge.
       */
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        color: '#1FC57E',
      },
    ],
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
    /*
     * The online layer.
     *
     * The publishable key is meant to be in the app. It is the key the
     * browser would carry on a website: every table it can reach is
     * behind row level security, and the only rows it can touch are a
     * queue of random seeds and the score at the end of a duel. Nothing
     * here is a secret and nothing here identifies anybody.
     *
     * The service key and the database password are not in this repo and
     * never will be.
     */
    supabase: {
      url: 'https://fmupfnknfyiiddwgjlvk.supabase.co',
      key: 'sb_publishable_PlbOP9B2umhLCiH8hRO-Ag_vldKYAcb',
    },
  },
  runtimeVersion: RUNTIME,
  // Nothing to fetch, and nothing installed that could fetch it.
  updates: { enabled: false },
});
