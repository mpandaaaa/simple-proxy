import { Platform } from 'react-native';
import Constants from 'expo-constants';
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

/**
 * The adverts.
 *
 * Two kinds and no more. A rewarded advert somebody chose to watch in
 * exchange for something, and a full screen one at a genuine break in
 * play. There are no banners, nothing appears during a match, and nothing
 * appears in the Daily, the Weekly or a duel, because those are scored
 * against other people and an advert that buys you an advantage is not an
 * advert, it is cheating.
 *
 * Everything here is wrapped. An advert that will not load, a phone with
 * no connection, a person who said no to tracking: none of those may take
 * down the screen that asked. Every call reports what happened and the
 * game carries on without it.
 */

type AdMobConfig = {
  units: {
    iosInterstitial: string;
    iosRewarded: string;
    androidInterstitial: string;
    androidRewarded: string;
  };
};

function config(): AdMobConfig | null {
  const extra = Constants.expoConfig?.extra as { admob?: AdMobConfig } | undefined;
  return extra?.admob ?? null;
}

/**
 * Which unit to ask for.
 *
 * A unit that has not been filled in falls back to Google's own test
 * unit, one at a time rather than all or nothing. Half a configured
 * account is the dangerous state: pointing anything at a live unit before
 * it is meant to be live is how an AdMob account is suspended for invalid
 * traffic, and there is no appeal worth having.
 *
 * There is also no debug build in the world that should serve a real
 * advert, so development never does whatever is configured.
 */
function unitFor(kind: 'interstitial' | 'rewarded'): string {
  const test = kind === 'rewarded' ? TestIds.REWARDED : TestIds.INTERSTITIAL;
  if (__DEV__) return test;

  const cfg = config();
  if (!cfg) return test;

  const live =
    Platform.OS === 'ios'
      ? kind === 'rewarded'
        ? cfg.units.iosRewarded
        : cfg.units.iosInterstitial
      : kind === 'rewarded'
        ? cfg.units.androidRewarded
        : cfg.units.androidInterstitial;

  return live && live.trim() ? live.trim() : test;
}

/* ---------- starting up ---------- */

let started = false;
let personalised = false;

/**
 * Ask about tracking, then start the SDK.
 *
 * The order matters and it is the one Apple requires: nothing may read
 * the advertising identifier before the question has been answered, so
 * the SDK is not started until it has been. Saying no is not a failure
 * state. It means the adverts are not personalised, and everything else
 * about the game is identical.
 *
 * Asked once ever, by the system. Asking again does nothing, which is why
 * this can be called on every launch without checking first.
 */
export async function startAds(): Promise<void> {
  if (started) return;
  started = true;
  try {
    let { status } = await getTrackingPermissionsAsync();
    if (status === 'undetermined') {
      ({ status } = await requestTrackingPermissionsAsync());
    }
    personalised = status === 'granted';

    await mobileAds().setRequestConfiguration({
      /* The game is about football and nothing in it is for adults only.
         Rating everything G keeps the adverts in the same place. */
      maxAdContentRating: MaxAdContentRating.G,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();

    /* One of each, warmed up, so the first one somebody asks for is
       already there rather than a spinner. */
    void loadInterstitial();
    void loadRewarded();
  } catch {
    /* No adverts is a worse game, not a broken one. */
  }
}

function requestOptions() {
  return { requestNonPersonalizedAdsOnly: !personalised };
}

/* ---------- the full screen one ---------- */

let interstitial: InterstitialAd | null = null;
let interstitialReady = false;

function loadInterstitial(): void {
  try {
    interstitialReady = false;
    interstitial = InterstitialAd.createForAdRequest(unitFor('interstitial'), requestOptions());
    const off = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitialReady = true;
      off();
    });
    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      interstitialReady = false;
    });
    interstitial.load();
  } catch {
    interstitialReady = false;
  }
}

/**
 * How often a full screen advert may appear.
 *
 * Four minutes, and only at a break in play. A season takes longer than
 * that to draft and play, so in practice it is one at the end of a season
 * and one at the end of a tournament, which is where a person is already
 * putting the phone down.
 */
const GAP_MS = 4 * 60 * 1000;
let lastShown = 0;

/** Where a full screen advert is allowed to appear at all. */
export type Break = 'season' | 'tournament' | 'cup';

/**
 * Show one, if it is time and there is one to show.
 *
 * Never blocks. If nothing is loaded or it is too soon, this returns
 * false immediately and whatever called it carries on as though adverts
 * did not exist.
 */
export async function showBreak(_where: Break): Promise<boolean> {
  try {
    if (!started || !interstitial || !interstitialReady) return false;
    if (Date.now() - lastShown < GAP_MS) return false;

    lastShown = Date.now();
    interstitialReady = false;
    const ad = interstitial;

    await new Promise<void>((done) => {
      const closed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        closed();
        done();
      });
      const failed = ad.addAdEventListener(AdEventType.ERROR, () => {
        failed();
        done();
      });
      ad.show();
    });

    loadInterstitial();
    return true;
  } catch {
    return false;
  }
}

/* ---------- the one somebody chose to watch ---------- */

let rewarded: RewardedAd | null = null;
let rewardedReady = false;

function loadRewarded(): void {
  try {
    rewardedReady = false;
    rewarded = RewardedAd.createForAdRequest(unitFor('rewarded'), requestOptions());
    const off = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      rewardedReady = true;
      off();
    });
    rewarded.addAdEventListener(AdEventType.ERROR, () => {
      rewardedReady = false;
    });
    rewarded.load();
  } catch {
    rewardedReady = false;
  }
}

/** Whether there is one ready, so a button can say so honestly. */
export function rewardReady(): boolean {
  return started && rewardedReady;
}

/**
 * Watch one, and be paid for it.
 *
 * Resolves true only if the advert was actually watched to the point
 * Google says it was earned. Closing it early, an advert that fails to
 * play, or no advert at all all resolve false, and nothing is given.
 * Paying out on anything less would mean the reward could be had by
 * tapping and dismissing.
 */
export async function watchForReward(): Promise<boolean> {
  try {
    if (!started || !rewarded || !rewardedReady) return false;

    const ad = rewarded;
    rewardedReady = false;

    const earned = await new Promise<boolean>((done) => {
      let paid = false;
      const gotReward = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        paid = true;
      });
      const closed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        gotReward();
        closed();
        done(paid);
      });
      const failed = ad.addAdEventListener(AdEventType.ERROR, () => {
        gotReward();
        failed();
        done(false);
      });
      ad.show();
    });

    loadRewarded();
    return earned;
  } catch {
    return false;
  }
}
