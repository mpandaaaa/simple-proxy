# Getting on the App Store

Everything needed to submit, split into what is already done, what only
you can do, and the exact answers to the questions App Store Connect
asks. Written so it can be worked through top to bottom.

---

## Before you submit, one thing to decide

The leaderboard needs two steps on the Supabase dashboard, in
`docs/LEADERBOARD.md`. If they are not done, the app hides the way in to
the board rather than offering a button that always says no connection,
so a reviewer never meets a dead end and nothing is broken.

So you can submit either way. What you cannot do is submit with the board
half set up: the table there but the function not, or the other way
round. Do both, or neither.

## Already done in the app

- Bundle identifier `app.perfectxi.game`, version 1.0.0, build numbers
  handled remotely by EAS so they cannot collide
- Export compliance declared: `ITSAppUsesNonExemptEncryption` false, so
  submission never stops to ask
- App icon is 1024 by 1024 with no alpha channel, which is the one icon
  rule Apple rejects on automatically
- Launch screen present, and the app declares it owns the full screen
- No tracking: no App Tracking Transparency, no prompt and no advert SDK
- Privacy manifest declaring every required reason interface the app
  touches and what the game's online layer collects.
  Three of the libraries ship no manifest of their own, so the app
  declares for them rather than going up silent
- Loot box odds printed on every pack, per card, with what it guarantees
- In-app privacy page that matches what the app actually does
- Portrait on a phone, any orientation on an iPad, with the layouts to
  match rather than a stretched phone
- Every modal turns with the device, every share sheet points at the
  button that opened it, and text is capped at 1.6 so the largest
  accessibility setting does not break a layout
- Nothing dev only can ship: the two testing buttons are behind `__DEV__`,
  which is false in every build that leaves this machine
- No feature offers a door that opens onto nothing. The live duel falls
  back to the Machine when nobody joins, and the leaderboard hides itself
  when there is no board

## What only you can do

### 1. The App Store Connect record
Create the app at appstoreconnect.apple.com with bundle
`app.perfectxi.game`, primary language English (UK), and the listing
name:

```
Perfect XI: Football Draft
```

26 of the 30 characters allowed. The name under the icon on the phone is
a different thing and stays `Perfect XI`: that comes from the build, not
from App Store Connect.

The suffix is there for search. Nothing owned by anybody else may go in
it, which rules out Football Manager, Ultimate Team, Premier League,
FIFA, UEFA and Champions League. That matters more here than for most
apps, because the game already uses real club and player names, and the
name is the most visible thing in the listing.

### 2. A privacy policy on the open web
**Done.** Live at `https://perfectxi.app/app-privacy`, and checked against
the page in the app: same fifteen sections in the same order, all six
data types, every load bearing promise, and nothing injected into it.

The website's own policy at `/privacy` is a different page about browser
cookies and AdSense. It is untouched and it is not the one to give Apple.

**perfectxi.app/privacy already exists and is not the right page.** It is
the website's own policy, about AdSense and cookies in the browser, and
it does not mention the iPhone app once. Leave it alone. Pointing Apple
at it would describe the wrong product.

The app's page is already built. `web/app-privacy.html` is one file with
nothing outside it: no images, no scripts, no build step, and the app's
own colours and fonts. It goes up as a second page, at
`perfectxi.app/app-privacy`, and that is the address App Store Connect
gets. The two pages link to each other.

The contact address on it is perfectxigame@gmail.com, which is also the
address to give App Store Connect as support. Nothing else in the file
needs changing.

`npm run privacy` checks that this page, the page inside the app and the
privacy manifest in the binary all still say the same thing, and it runs
as part of `npm run verify`. They drifted apart once, which is why it
exists.

### 3. Screenshots
Two sizes, and Apple scales each one down for the smaller devices in its
class. Both are built by `python tools/screenshots/compose.py`, which puts
the caption and the ground around a capture and never draws any part of
the app itself. It writes a folder per device, `out/iphone` and
`out/ipad`, holding nothing but frames of that size, so a whole folder
can go into one slot in App Store Connect. The contact sheets sit
outside those folders on purpose.

**iPhone, 1320 by 2868**, the six point nine inch class. Ten frames, in
this order, because the draft and the unbeaten run are what the game is:

1. `01-card` a card being revealed
2. `02-reel` the wheel mid spin
3. `03-xi` the finished eleven
4. `04-unbeaten` the 38 and 0 chase
5. `05-table` the final table
6. `06-match` a match running minute by minute
7. `07-ucl` a Champions League night
8. `08-dynasty` the career hub
9. `09-history` the cabinet
10. `10-album` the album

**iPad, 2064 by 2752**, the thirteen inch class. Eight frames, sharing
the phone's captions where the screen is the same.

An eleven inch iPad captures 1640 by 2360, which Apple will not accept as
an upload. It does not need to: the iPad frame draws the screen 1480 wide
inside a 2064 wide canvas, so the capture is reduced to fit rather than
enlarged, and the finished file is a real 2064 by 2752 image. A thirteen
inch capture would still be better, because it is a wider layout with
more on screen, so recapture there if one is ever to hand.

### 4. Age rating
Apple replaced this questionnaire in 2025 and made the social media
questions compulsory for new apps from September 2026, so the old four
line answer no longer covers it. The bands are now 4+, 9+, 13+, 16+ and
18+. It lives in App Information, not on the version page.

Answer it honestly, section by section.

**In-app controls.** None. There is no account, no age gate and no
parental controls, because there is nothing to gate.

**Capabilities**

| Question | Answer | Why |
| --- | --- | --- |
| Web browser or unrestricted web access | No | There is no WebView anywhere, by rule |
| Advertising | No | The advert SDK was removed on 7 November 2026 |
| In-app purchases | No | Nothing is for sale |
| Messaging or chat | No | Players never send each other anything |
| User-generated content | **Yes** | A display name, and nothing else |
| Social media, a feed of user content | No | A leaderboard is a table of names and scores. Nothing is posted, amplified or replied to |

**Chance-based activities.** Read Apple's own wording on each row before
answering. Two of these are not what they look like.

| Question | Answer | Why |
| --- | --- | --- |
| Simulated Gambling | None | Their definition is betting or wagering. The draft wheel has no stake |
| Contests | **Infrequent** | Their definition is events where users compete for rankings, which the Daily, the Weekly and Duels are. But the draft, Dynasty, both tournaments and the cup have nobody else in them, so it is not frequent |
| Gambling | No | Nothing is wagered and nothing converts to money |
| Loot Boxes | **No** | Their definition ends "for purchase". Nothing in the app can be purchased: there are no in-app purchases and coins are earned by playing |

The loot box answer flips to yes the day anyone can buy coins with money.
The odds are printed on every pack regardless, which is right whatever
the answer is.

**Mature themes, medical, sexuality, violence.** None of any of them.

**The result: 4+.** That is what the questionnaire calculated from these
answers on 6 September 2026, which is the best band available.

On the last step, leave **Age Categories and Override** on Not
Applicable. Made for Kids looks like it fits a football game and it does
not: the app does not qualify for the Kids Category, so do not choose it. Leave the age suitability URL blank, and leave
the Republic of Korea classification number blank, which is only needed
for age restricted games.

One thing is still worth understanding.

**User-generated content is a display name and nothing else.** Settings
lets a player type up to eighteen characters, and that name is what a
leaderboard row and a duel opponent see. There is no filter on it, which
is the open question against guideline 1.2.

Until there is one, leave the two Supabase steps in `docs/LEADERBOARD.md`
undone. Without those tables no name reaches anybody: `boardLive()` says
no so the way in to the board is hidden, and a live duel cannot join the
queue so it falls back to the Machine. The game is unaffected, because it
was built to work with the connection dead.

### 5. App privacy, the nutrition label
Two rows, both the game's own online layer. Answer **No** to "do you or your
third-party partners use data for tracking purposes". This needs the Account
Holder or Admin role.

**The game.** A duel and a finished Daily go to the Supabase database in
Europe. The app privacy page already describes this, so the label has to
match it.

| Apple category | Data type | Purpose | Linked to you | Tracking |
| --- | --- | --- | --- | --- |
| Identifiers | User ID | App Functionality | Yes | No |
| User Content | Gameplay Content | App Functionality | Yes | No |

User ID is the random id made on the phone. Gameplay Content is the rest
of what goes up: the handle, the seed, the picks and the score. Both are
linked, because they are stored against that id, and neither is tracking,
because nothing is joined to anything from any other company.

**Linked to you.** Apple's test is whether data is
associated with an account, a device id or anything similar, not whether
it names a person. The picks and the score are stored against the random
id, so they are linked by that test, even though the id identifies
nobody.

Declare nothing beyond these two.

### 6. No adverts and no tracking prompt
There is no prompt to look for, because App Tracking Transparency is gone.

### 7. Review notes
Paste this into App Review Notes:

> Perfect XI is a football management game played entirely offline. There
> is no account and no sign in.
>
> There are no adverts and no tracking.
>
> Packs are opened with coins earned by playing. There is no way to buy
> coins with money. Odds are printed on every pack.
>
> The one online feature is a head to head duel, which sends a random
> seed and a score to a database and nothing else. It is optional and the
> rest of the game works with no connection.
>
> Player and club names are matters of public record, used to describe
> real football history in a work of statistical fiction. The app states
> on the home screen, in Settings and on its privacy page that it is
> unofficial and unaffiliated.

### 8. The first rejection, and what answered it
Build 8 was refused on 9 September 2026, reviewed on an iPad Air 11 inch
running iPadOS 26.6.1. Two issues, both configuration rather than
gameplay, and both invisible on a phone.

**Guideline 2.5.4, background audio.** The build declared the `audio`
background mode and played nothing in the background. Nothing asked for
that: the `expo-audio` config plugin adds it unless told not to. It is
told not to now, with `enableBackgroundPlayback: false`, and the key is
gone from the plist. No recording is needed to answer this one, because
the capability is simply no longer claimed.

**Guideline 2.1, App Tracking Transparency.** The build carried the framework
and the reviewer could not find the prompt. An attempt to fix the timing of
the prompt was never submitted. Instead, on 7 November 2026, tracking was
removed: `expo-tracking-transparency`, `react-native-google-mobile-ads`, the
usage description, both advert placements and the rewards in the shop.
`npm run ads` fails if any of it comes back. No recording is needed.

---

---

## The listing

### Subtitle, 30 characters
`Build the Perfect Football XI`

### Promotional text, 170 characters
`Draft an XI from thirty five seasons of the Premier League, play it out
match by match, and see how far it goes. Free, offline, no subscriptions.`

### Description

> Thirty five seasons of the Premier League, and eleven shirts to fill.
>
> Every spin deals you five real footballers from anywhere between 1992
> and 2026. Henry from 2003. Shearer from 1995. Haaland from last year.
> You take one, and you keep going until the eleven is finished. Players
> from the same club and the same era play better together, so the XI you
> end up with is the one you argued yourself into.
>
> Then you play the season. Thirty eight games against the real league on
> a match engine built from real numbers, with a table, a grade and a
> trophy cabinet that remembers all of it.
>
> WHAT ELSE IS IN IT
>
> The World Cup. Forty eight nations, the real 2026 format, one match at
> a time, played out minute by minute with commentary.
>
> The Champions League. The real thirty six team league phase, the
> play-off, two legged ties and a final. Skip the league phase or watch
> every matchday.
>
> The Cup. Sixteen club seasons from any era in one bracket. The
> Invincibles against Guardiola's City, one night each.
>
> Dynasty. A career at one club across seasons, with ageing, transfers,
> contracts, an academy, a stadium, the books and a board losing patience.
> Three careers kept apart.
>
> The Daily. One draft a day, the same players for everybody, one attempt.
>
> The album. Eleven thousand cards, packs, sets, and a hundred and eleven
> achievements.
>
> THE DATABASE
>
> 706 club seasons, 2,978 players, 51 clubs, 1992 to 2026.
>
> Free. No subscriptions, nothing to buy, and it works with no connection.
>
> Unofficial and unaffiliated. Not connected to the Premier League, FIFA,
> UEFA, or any club, competition or player.

### Keywords, 100 characters
Four words came out of this list and it is worth knowing why, because the
temptation to put them back will be strong.

`premier` and `league` sat next to each other, and `ultimate` and `team`
sat next to each other. Apple matches across the field, so those pairs
encode "Premier League" and EA's "Ultimate Team". Guideline 2.3.7 forbids
trademarked terms in the name, the subtitle and the keywords, and it is
an automated check rather than a human judgement. For an app that is
already built on real club and player names, the keyword field is the
last place to also borrow somebody's mark.

`manager` stays. It is a generic word for what the game is, every
management game on the store uses it, and it is not a mark on its own.
`football,soccer,draft,manager,cards,squad,xi,fantasy,dynasty,career,tactics,legends,retro,eleven`

### Category
Primary **Games → Sports**, secondary **Games → Simulation**.

### Support URL
`https://perfectxi.app`. Apple needs somewhere a player can reach you,
and the privacy page carries perfectxigame@gmail.com, so that address is
reachable from the site.

App Store Connect asks separately for a contact email under App Review
Information. Use perfectxigame@gmail.com there too.

---

## The one thing worth thinking about before you press submit

The game is built on real player names, club names and thirty five
seasons of real results. Free fan projects and commercial products using the
same marks are treated very differently by the Premier League, FIFA and UEFA.

Nothing here is legal advice and plenty of apps live in this space. The risk
would go up again if adverts ever came back.
