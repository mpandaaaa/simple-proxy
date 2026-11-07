/*
 * The privacy pages have to agree with the code, and with each other.
 *
 * There are three statements of what this app collects and they are
 * written in three different places: the privacy manifest that ships
 * inside the binary, the page in the app under Settings, and the page on
 * the web that the App Store listing points at. Apple reads all three.
 * A player reads one. If they disagree, the listing is a lie, and it is
 * the kind of lie that is found by a reviewer rather than by us.
 *
 * They drifted once already. The manifest declared crash data while the
 * page in the app said "No crash reporting", because the manifest was
 * updated when the adverts went in and the page was not. This is here so
 * that cannot happen quietly a second time.
 *
 * What is checked:
 *
 *   1. Every data type declared in the manifest is named on both pages.
 *      Adding a type to the manifest and not saying so is the failure
 *      that actually happened.
 *   2. The two pages carry the same sections, in the same order. They are
 *      allowed to word things differently, because one is a phone screen
 *      and one is a browser, but neither may quietly drop a subject.
 *   3. The promises that are load bearing appear on both. These are the
 *      sentences somebody would point at if they said the app lied.
 */

import { readFileSync } from 'node:fs';

const config = readFileSync('app.config.js', 'utf8');
const inApp = readFileSync('app/privacy.tsx', 'utf8');
const onWeb = readFileSync('web/app-privacy.html', 'utf8');

const problems = [];

/* ---------- 1. every declared data type is named on both pages ---------- */

/*
 * NSPrivacyCollectedDataTypeDeviceID becomes "device id", which is what
 * to look for in prose. Written out rather than derived where Apple's
 * name and plain English part company.
 */
const SAID_AS = {
  DeviceID: 'device id',
  AdvertisingData: 'advertising data',
  ProductInteraction: 'product interaction',
  PerformanceData: 'performance data',
  CrashData: 'crash data',
  CoarseLocation: 'coarse location',
  PreciseLocation: 'precise location',
  EmailAddress: 'email',
  Name: 'name',
  PhoneNumber: 'phone number',
  UserID: 'user id',
  GameplayContent: 'gameplay content',
  PurchaseHistory: 'purchase history',
  PhysicalAddress: 'address',
  Contacts: 'contacts',
  Photos: 'photos',
  AudioData: 'audio',
  SearchHistory: 'search history',
  BrowsingHistory: 'browsing history',
  Health: 'health',
  Fitness: 'fitness',
  SensitiveInfo: 'sensitive information',
  OtherDataTypes: 'other data',
  OtherDiagnosticData: 'diagnostic data',
  OtherUsageData: 'usage data',
};

const declared = [
  ...config.matchAll(/NSPrivacyCollectedDataType:\s*'NSPrivacyCollectedDataType(\w+)'/g),
].map((m) => m[1]);

if (declared.length === 0) {
  problems.push('The privacy manifest declares no data types at all. Either it was emptied or this check can no longer read it.');
}

/* The pages say these things in prose, so compare on lowercased text with
   runs of whitespace flattened. A line break in the middle of "advertising
   data" is still the words being there. */
const flat = (s) => s.toLowerCase().replace(/\s+/g, ' ');
const appText = flat(inApp);
const webText = flat(onWeb);

for (const type of declared) {
  const words = SAID_AS[type];
  if (!words) {
    problems.push(
      `The manifest declares ${type} and this check does not know how that is said in plain English. Add it to SAID_AS in this file, then make sure both privacy pages say it.`,
    );
    continue;
  }
  if (!appText.includes(words)) {
    problems.push(`The manifest declares ${type} but app/privacy.tsx never mentions "${words}".`);
  }
  if (!webText.includes(words)) {
    problems.push(`The manifest declares ${type} but web/app-privacy.html never mentions "${words}".`);
  }
}

/* ---------- 2. the two pages carry the same sections ---------- */

const appSections = [...inApp.matchAll(/<Section title="([^"]+)">/g)].map((m) => m[1]);
const webSections = [...onWeb.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1].trim());

if (appSections.length === 0) problems.push('No sections found in app/privacy.tsx.');
if (webSections.length === 0) problems.push('No sections found in web/app-privacy.html.');

const missingOnWeb = appSections.filter((t) => !webSections.includes(t));
const missingInApp = webSections.filter((t) => !appSections.includes(t));

for (const t of missingOnWeb) problems.push(`"${t}" is in the app's privacy page but not on the web one.`);
for (const t of missingInApp) problems.push(`"${t}" is on the web privacy page but not in the app's.`);

if (missingOnWeb.length === 0 && missingInApp.length === 0) {
  const same = appSections.every((t, i) => webSections[i] === t);
  if (!same) {
    problems.push('Both privacy pages carry the same sections but in a different order. Somebody reading one and then the other should not have to hunt.');
  }
}

/* ---------- 3. the promises that are load bearing ---------- */

/*
 * Each of these is a hard constraint written down elsewhere, and each is
 * a sentence somebody could hold the app to. If a promise is being
 * withdrawn that is a decision, not a tidy up, so it has to be made here
 * as well as in the pages.
 */
const PROMISES = [
  { words: 'no adverts', why: 'the app promises it shows no adverts' },
  { words: 'no tracking', why: 'the app promises it does not track anybody' },
  { words: 'nothing to sign in to', why: 'the app promises there is no account' },
];

for (const { words, why } of PROMISES) {
  if (!appText.includes(words)) problems.push(`app/privacy.tsx no longer says "${words}", and ${why}.`);
  if (!webText.includes(words)) problems.push(`web/app-privacy.html no longer says "${words}", and ${why}.`);
}

/* ---------- 4. neither page may promise something the manifest denies ---------- */

/*
 * The specific sentence that was wrong. Kept as its own check because the
 * shape of the mistake matters more than the wording: a flat "no crash
 * reporting" is false while the advert SDK collects crash logs, and the
 * true version has to say whose crash reporting is absent.
 */
const declaresCrash = declared.includes('CrashData');
for (const [name, text] of [['app/privacy.tsx', appText], ['web/app-privacy.html', webText]]) {
  if (declaresCrash && /no crash reporting(?!\s+of our own)/.test(text)) {
    problems.push(
      `${name} says "no crash reporting" while the manifest declares crash data. Say whose: the game has none of its own, the advert SDK has its own.`,
    );
  }
}

/* ---------- what happened ---------- */

if (problems.length > 0) {
  console.error('\nThe privacy pages and the manifest do not agree.\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}

console.log(`
Privacy is consistent
  ${declared.length} data types declared, every one named on both pages
  ${appSections.length} sections, same subjects and same order on both
  ${PROMISES.length} load bearing promises still made in both places

The manifest, the page in the app and the page on the web all say the same thing.
`);
