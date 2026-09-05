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

/**
 * Which build this is.
 *
 * Read from a variable eas.json sets on the development profile, not from
 * EAS_BUILD_PROFILE. That one only exists on the build server, and the
 * command line reads this file on the machine first, to work out which
 * credentials the build needs. Defaulting to development there sent it
 * looking for a provisioning profile for an identifier that did not exist
 * yet, and the build failed before it started.
 *
 * Nothing set means the real app. That is the safe default: the worst
 * case is a development build that shares an identifier, rather than a
 * release build that quietly does not.
 */
const IS_DEV_BUILD = process.env.APP_VARIANT === 'development';

/**
 * The bundle identifier, and why the development one is different.
 *
 * iOS decides whether an install is a new app or an update to an existing
 * one purely on this string. With one identifier for everything, putting
 * a preview build on the phone silently replaced the development build,
 * which is the only one that can talk to a development server. One tap
 * and the whole working setup is gone.
 *
 * So the development build gets its own identifier and its own name, and
 * lives on the phone beside the real one. Preview and production keep the
 * real identifier deliberately: it is the one registered with AdMob, and
 * an advert unit will not serve to an app whose identifier does not match
 * the one it was created for.
 */
const BUNDLE = IS_DEV_BUILD ? 'app.perfectxi.game.dev' : 'app.perfectxi.game';
const APP_NAME = IS_DEV_BUILD ? 'Perfect XI dev' : 'Perfect XI';

/**
 * The advert account.
 *
 * The application id is the real one and has to be here, because it goes
 * into the app's own Info.plist and the SDK will not start without it.
 *
 * The unit ids are what decide whether a real advert is served, and they
 * are deliberately still empty. An empty unit falls back to Google's own
 * test unit, which serves a genuine test advert that can be watched and
 * clicked on a phone and earns nothing. That is what a build in
 * development should do: pointing a development build at live units is
 * how an AdMob account gets suspended for invalid traffic, and it is the
 * developer who pays for that, not Google.
 *
 * Filling the two ids in below and building once is all that is left.
 */
const ADMOB = {
  /* Perfect XI, iOS. */
  iosAppId: 'ca-app-pub-4069943095077854~1082884431',
  /* Google's test application, until there is an Android app to point at. */
  androidAppId: 'ca-app-pub-3940256099942544~3347511713',
  units: {
    /* Perfect XI, iOS. Anything left empty serves a test advert instead
       of a real one, which is what Android does until there is one. */
    iosInterstitial: 'ca-app-pub-4069943095077854/9348387268',
    iosRewarded: 'ca-app-pub-4069943095077854/2204394414',
    androidInterstitial: '',
    androidRewarded: '',
  },
};

module.exports = () => ({
  name: APP_NAME,
  slug: 'perfectxi',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'perfectxi',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0A0F0C',
  icon: './assets/icon.png',
  ios: {
    /*
     * Three icons, because iOS asks for three.
     *
     * A home screen is no longer one appearance. There is the standard
     * one, a dark one for a dark home screen, and a tinted one where the
     * system takes a greyscale drawing and colours it to match whatever
     * the phone has been set to. Ship only the first and the other two
     * are generated by flattening it, which on a bright green icon looks
     * exactly like an app that has not been touched since 2023.
     *
     * All three are the same mark: XI in Anton, on a kit sash with gold
     * piping. The dark one takes the greens down so it does not glare,
     * and the tinted one is the same drawing in grey.
     */
    icon: {
      light: './assets/icon.png',
      dark: './assets/icon-ios-dark.png',
      tinted: './assets/icon-ios-tinted.png',
    },
    /* An iPad runs this perfectly well and it is the same portrait layout
       on a bigger screen. Locked to portrait, like the phone. */
    supportsTablet: true,
    /* The window behind the screens. */
    backgroundColor: '#0A0F0C',
    /*
     * The app owns the screen.
     *
     * Turning on iPad support quietly wrote UIRequiresFullScreen false
     * into the app, which tells iOS the app is content to run in a
     * resizable window rather than owning the display. That is what put a
     * light frame around everything, status bar included, and it is why
     * nothing in JavaScript could shift it: React Native cannot draw
     * outside its own window and the frame was outside it.
     *
     * This game is portrait only and phone shaped. It has no use for a
     * resizable window on any device, so it says so.
     */
    requireFullScreen: true,
    bundleIdentifier: BUNDLE,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      /*
       * Portrait on a phone, any way up on an iPad.
       *
       * The app was locked to portrait everywhere, which on an iPad held
       * in landscape means iOS letterboxes it: the game runs in a
       * phone shaped column in the middle of the screen with dark bars
       * either side. That is what an unoptimised tablet app looks like,
       * and it is a fair thing for a reviewer to fail.
       *
       * These two keys are how iOS has always been told the answer
       * differs by device. The tilde suffix is not a typo: it is the
       * iPad specific form of the key above it, and iOS picks whichever
       * matches the device it is running on.
       *
       * A phone stays portrait on purpose. The game is a column of cards
       * and tables and there is nothing a phone gains from being turned
       * on its side.
       */
      UISupportedInterfaceOrientations: [
        'UIInterfaceOrientationPortrait',
      ],
      'UISupportedInterfaceOrientations~ipad': [
        'UIInterfaceOrientationPortrait',
        'UIInterfaceOrientationPortraitUpsideDown',
        'UIInterfaceOrientationLandscapeLeft',
        'UIInterfaceOrientationLandscapeRight',
      ],
    },
    /*
     * The privacy manifest.
     *
     * Apple requires an app to declare every "required reason" interface
     * it touches and why, and to say whether it tracks. Three of the
     * libraries in here ship no manifest of their own, so the app
     * declares on their behalf rather than letting the submission go up
     * silent and come back with a warning.
     *
     * Every reason code below is the one Apple publishes for that use,
     * and every one is true of this app: it reads and writes its own
     * files, keeps its own settings, and shows adverts.
     */
    privacyManifests: {
      NSPrivacyTracking: true,
      /* Where an advert request goes. Listed so that iOS can block them
         by itself when somebody has said no to tracking, which is the
         behaviour that question is supposed to produce. */
      NSPrivacyTrackingDomains: [
        'googleads.g.doubleclick.net',
        'pagead2.googlesyndication.com',
        'googlesyndication.com',
        'google-analytics.com',
        'app-measurement.com',
      ],
      /*
       * What the adverts collect.
       *
       * The game itself collects none of this. Every line below is the
       * Google Mobile Ads SDK, and every line is taken from the table
       * Google publishes at developers.google.com/admob/ios/privacy/
       * data-disclosure rather than from what seemed likely. Google's
       * own words for each are in the comments.
       *
       * Declared as a superset on purpose. Apple does not reject an app
       * for declaring something it does not collect. It does reject one
       * for collecting something it did not declare, and the app cannot
       * see inside somebody else's SDK to know when that list grows.
       */
      NSPrivacyCollectedDataTypes: [
        {
          /* "the device's advertising identifier or other app or
             developer bounded device identifiers", for third party
             advertising and analytics. This is the one the tracking
             question is about. */
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: true,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        {
          /* "power analytics and advertising features". Which advert was
             shown, whether it was watched, whether it was tapped. */
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeAdvertisingData',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: true,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        {
          /* "app launch taps and video views", to "improve advertising
             performance". Taps on the advert, not taps in the game. */
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        {
          /* "understand the effectiveness of existing product features",
             and whether an advert managed to display. */
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAnalytics',
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          /* "non user related crash logs", to "diagnose problems and
             improve the SDK". The game has no crash reporting of its
             own: this is Google's, inside their own SDK. */
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        {
          /* Google uses the IP address of an advert request to "estimate
             the general location of a device". Apple counts a location
             worked out that way as coarse location, so it is declared,
             even though nothing in the game ever asks for a position and
             there is no location permission prompt. */
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCoarseLocation',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
          ],
        },
      ],
      NSPrivacyAccessedAPITypes: [
        {
          /* Every setting in the game, and the save itself. C56D.1 is the
             code for an app reading back only what it wrote. */
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          /* The save, and the backup snapshots beside it, both of which
             are inside the app's own container. */
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          /* Writing a backup has to know whether there is room for it. */
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
        {
          /* Working out how long ago a backup was taken, and whether a
             Daily has rolled over. */
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
      ],
    },
  },
  android: {
    package: BUNDLE,
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
    [
      /*
       * The ads.
       *
       * The application id has to be in the app's own Info.plist or the
       * SDK will not start, so it is here rather than in code. These are
       * Google's published test ids: they serve real test adverts and
       * earn nothing, which is exactly what a build in development should
       * do. Swapping in the live account is these two lines and one
       * build.
       */
      'react-native-google-mobile-ads',
      {
        iosAppId: ADMOB.iosAppId,
        androidAppId: ADMOB.androidAppId,
        userTrackingUsageDescription:
          'Perfect XI asks so the adverts it shows can be relevant to you. Saying no changes nothing about the game and you still see the same number of adverts.',
      },
    ],
    [
      /*
       * Saving a share card to Photos.
       *
       * Adding only, never reading. The game has no reason to look at
       * somebody's photo library and asking for that would be a worse
       * permission prompt for no benefit.
       */
      'expo-media-library',
      {
        savePhotosPermission:
          'Perfect XI asks so it can save a share card to your photos. It only ever adds one, and only when you tap save.',
        photosPermission:
          'Perfect XI does not read your photos. It only adds a share card when you ask it to.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-tracking-transparency',
      {
        userTrackingPermission:
          'Perfect XI asks so the adverts it shows can be relevant to you. Saying no changes nothing about the game and you still see the same number of adverts.',
      },
    ],
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
    admob: ADMOB,
    supabase: {
      url: 'https://fmupfnknfyiiddwgjlvk.supabase.co',
      key: 'sb_publishable_PlbOP9B2umhLCiH8hRO-Ag_vldKYAcb',
    },
  },
  runtimeVersion: RUNTIME,
  // Nothing to fetch, and nothing installed that could fetch it.
  updates: { enabled: false },
});
