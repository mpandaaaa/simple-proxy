/**
 * Where adverts are allowed to be.
 *
 * Adverts are the one thing in this app that can quietly spread. A break
 * advert added to a screen that is not a break, a reward offered in a
 * mode that is scored against other people, a banner slipped onto the
 * home screen: each of those is one line and none of them look wrong on
 * their own.
 *
 * So the rule is written down here rather than remembered. Only the two
 * placements that were agreed exist, and only the one file talks to the
 * SDK.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

const files = [...walk('src'), ...walk('app')];
let bad = 0;
const fail = (m) => {
  console.log('  ' + m);
  bad++;
};

const ADS = join('src', 'game', 'ads.ts');

/* ---------- one door to the SDK ---------- */

for (const f of files) {
  if (f.endsWith(ADS)) continue;
  const src = readFileSync(f, 'utf8');
  if (/from ['"]react-native-google-mobile-ads['"]/.test(src)) {
    fail(`${f} talks to the advert SDK directly. Everything goes through src/game/ads.ts.`);
  }
  if (/expo-tracking-transparency/.test(src)) {
    fail(`${f} asks about tracking. Only src/game/ads.ts may, and only once.`);
  }
}

/* ---------- no banners, ever ---------- */

const adsSrc = readFileSync(ADS, 'utf8');
for (const banned of ['BannerAd', 'BannerAdSize', 'AppOpenAd', 'adaptiveBanner']) {
  if (adsSrc.includes(banned)) {
    fail(`src/game/ads.ts uses ${banned}. There are no banners and no app open adverts.`);
  }
}
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (/<BannerAd/.test(src)) fail(`${f} draws a banner. There are none.`);
}

/* ---------- the two placements, and no others ---------- */

const ALLOWED_BREAK = [
  join('app', 'draft', 'results.tsx'),
  join('src', 'game', 'worldcup.ts'),
  join('src', 'game', 'ucl.ts'),
  join('src', 'game', 'cup.ts'),
];
const ALLOWED_REWARD = [join('src', 'game', 'rewards.ts'), join('app', 'shop.tsx')];

for (const f of files) {
  if (f.endsWith(ADS)) continue;
  const src = readFileSync(f, 'utf8');
  if (/\bshowBreak\(/.test(src) && !ALLOWED_BREAK.some((a) => f.endsWith(a))) {
    fail(`${f} shows a full screen advert. Only the end of a season or a tournament may.`);
  }
  if (/\bwatchForReward\(|\bwatchForPack\(|\bwatchForCoins\(/.test(src) && !ALLOWED_REWARD.some((a) => f.endsWith(a))) {
    fail(`${f} offers a rewarded advert. Only the shop does.`);
  }
}

/* ---------- nothing competitive can be bought with one ---------- */

const COMPETITIVE = [
  join('app', 'daily.tsx'),
  join('app', 'weekly.tsx'),
  join('app', 'duel.tsx'),
  join('app', 'h2h.tsx'),
  join('app', 'h2hreview.tsx'),
  join('src', 'engine', 'daily.ts'),
  join('src', 'engine', 'weekly.ts'),
  join('src', 'engine', 'duel.ts'),
];
for (const f of files) {
  if (!COMPETITIVE.some((c) => f.endsWith(c))) continue;
  const src = readFileSync(f, 'utf8');
  if (/game\/ads|game\/rewards|showBreak|watchFor/.test(src)) {
    fail(`${f} is scored against other people and must never touch an advert.`);
  }
}

/* The season advert must be refused for those modes at its own call site. */
const results = readFileSync(join('app', 'draft', 'results.tsx'), 'utf8');
if (!/if \(!run\.daily && !run\.weekly && run\.duel == null/.test(results)) {
  fail('the season advert no longer refuses a Daily, a Weekly or a duel');
}

/* ---------- and the page that describes them is honest ---------- */

const privacy = readFileSync(join('app', 'privacy.tsx'), 'utf8');
if (/No advertising, no advertising\s*\n?\s*identifiers/.test(privacy)) {
  fail('the privacy page still says there is no advertising');
}
for (const must of ['The adverts', 'Who shows them', 'The tracking question']) {
  if (!privacy.includes(must)) fail(`the privacy page has no "${must}" section`);
}
if (!privacy.includes('AdMob')) fail('the privacy page does not name who shows the adverts');

const settings = readFileSync(join('app', 'settings.tsx'), 'utf8');
if (/No ads, no subscriptions/.test(settings)) {
  fail('the settings page still says there are no ads');
}

console.log('');
console.log('  one file talks to the SDK, no banners, two placements');
console.log('  nothing scored against other people can be bought with an advert');
console.log('  and the privacy page says what they see');
console.log('');

if (bad) {
  console.log(`${bad} problems\n`);
  process.exit(1);
}
console.log('The adverts are where they were agreed to be, and nowhere else.\n');
