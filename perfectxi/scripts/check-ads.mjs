/**
 * No adverts and no tracking.
 *
 * App Review refused build 8 under guideline 2.1 because the app carried
 * App Tracking Transparency. The fix was to take tracking out, which meant
 * taking out the advert SDK that needed it. One line in package.json or
 * one plugin would bring the framework straight back, so this looks for it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const BANNED =
  /react-native-google-mobile-ads|expo-tracking-transparency|AppTrackingTransparency|NSUserTrackingUsageDescription|requestTrackingPermissions|GADApplicationIdentifier|appsflyer|react-native-adjust|react-native-branch|react-native-fbsdk/i;

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

for (const f of ['package.json', ...walk('src'), ...walk('app')]) {
  const hit = BANNED.exec(readFileSync(f, 'utf8'));
  if (hit) fail(`${f} mentions ${hit[0]}. Perfect XI does not track anybody.`);
}

for (const pkg of ['react-native-google-mobile-ads', 'expo-tracking-transparency']) {
  if (existsSync(join('node_modules', pkg))) {
    fail(`${pkg} is still installed, so it would still be linked into a build.`);
  }
}

const cfg = readFileSync('app.config.js', 'utf8');
const hit = BANNED.exec(cfg);
if (hit) fail(`app.config.js mentions ${hit[0]}. Perfect XI does not track anybody.`);
if (!/NSPrivacyTracking:\s*false/.test(cfg)) fail('the privacy manifest no longer says NSPrivacyTracking: false');
if (/NSPrivacyCollectedDataTypeTracking:\s*true/.test(cfg)) fail('the privacy manifest declares data used for tracking');
if (/^\s*UIBackgroundModes\s*:/m.test(cfg)) fail('app.config.js declares UIBackgroundModes');

if (bad) {
  console.log(`\n${bad} problems\n`);
  process.exit(1);
}
console.log('\nNo adverts, no tracking, and nothing that would link the framework.\n');
