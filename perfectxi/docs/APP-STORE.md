# Getting on the App Store

Everything needed to submit, split into what is already done, what only
you can do, and the exact answers to the questions App Store Connect
asks. Written so it can be worked through top to bottom.

---

## Already done in the app

- Bundle identifier `app.perfectxi.game`, version 1.0.0, build numbers
  handled remotely by EAS so they cannot collide
- Export compliance declared: `ITSAppUsesNonExemptEncryption` false, so
  submission never stops to ask
- App icon is 1024 by 1024 with no alpha channel, which is the one icon
  rule Apple rejects on automatically
- Launch screen present, and the app declares it owns the full screen
- Tracking permission string written, and the prompt appears after the
  app is up rather than over the splash
- Privacy manifest declaring every required reason interface the app
  touches, what data the adverts collect, and the domains they talk to.
  Three of the libraries ship no manifest of their own, so the app
  declares for them rather than going up silent
- Loot box odds printed on every pack, per card, with what it guarantees
- In-app privacy page that matches what the app actually does

## What only you can do

### 1. The App Store Connect record
Create the app at appstoreconnect.apple.com with bundle
`app.perfectxi.game`, name **Perfect XI**, primary language English (UK).

### 2. A privacy policy on the open web
**This is a hard blocker.** Apple requires a URL anybody can open without
installing the app. The page inside the app does not count.

The page is already built. `web/privacy.html` is one file with nothing
outside it: no images, no scripts, no build step, and the app's own
colours and fonts so it does not look like a legal document bolted on
the side. Upload it to perfectxi.app as `/privacy` and give App Store
Connect that address.

Two things before it goes up. There is a comment at the bottom of the
file asking for a contact address, because Apple wants somewhere a
player can reach you and no address has been put in. And if you would
rather host it somewhere else, anywhere a browser can open without
signing in will do.

`npm run privacy` checks that this page, the page inside the app and the
privacy manifest in the binary all still say the same thing, and it runs
as part of `npm run verify`. They drifted apart once, which is why it
exists.

### 3. Screenshots
Six point seven inch, which is an iPhone 15 or 16 Pro Max. Apple takes
that one size and scales it down for the rest. Five or six is plenty:

1. The home screen, showing the modes
2. A draft board mid spin
3. The season table with a grade
4. A Champions League night with the commentary running
5. The trophy cabinet with shelves open
6. A pack being opened

### 4. Age rating
Answer the questionnaire honestly. The answers that matter:

- **Contests**: none
- **Gambling**: **no**. Packs are opened with coins earned by playing.
  There is no way to buy coins and no way to cash anything out. If you
  ever add a way to buy coins, this answer changes and the rating goes up
- **Unrestricted web access**: no
- **Violence, sexual content, drugs, language**: none

That should come out at 4+.

### 5. App privacy, the nutrition label
None of this is the game. Every line is the Google advert SDK, and every
line is taken from the table Google publishes for exactly this purpose at
developers.google.com/admob/ios/privacy/data-disclosure. Answer it in
this order and it takes about five minutes.

| Apple category | Data type | Purpose | Linked to you | Tracking |
| --- | --- | --- | --- | --- |
| Identifiers | Device ID | Third-Party Advertising, Analytics | Yes | **Yes** |
| Usage Data | Advertising Data | Third-Party Advertising, Analytics | Yes | **Yes** |
| Usage Data | Product Interaction | Third-Party Advertising, Analytics | Yes | No |
| Diagnostics | Performance Data | Analytics, App Functionality | Yes | No |
| Diagnostics | Crash Data | App Functionality, Analytics | No | No |
| Location | Coarse Location | Third-Party Advertising | No | No |

Two of those look alarming and are worth understanding before you tick
them, because you will be asked about them:

**Coarse Location.** The game never asks for your position and there is
no location prompt. Google works out roughly which country an advert
request came from by looking at the internet address it arrived from,
the same way any website can. Apple counts that as coarse location, so
it gets declared.

**Linked to you.** There is no account, so nothing is linked to a person
by anything the game does. Google's own table says linked, because they
join it up on their side. Declaring it their way is the honest answer.

Declare nothing beyond the table. The game itself sends no name, no
email, no position, and nothing about what you play.

### 6. Ads and the tracking prompt
Apple checks the prompt appears and behaves. It does, on first launch,
and answering no changes nothing about the game. Say so in the review
notes so nobody has to guess.

### 7. Review notes
Paste this into App Review Notes:

> Perfect XI is a football management game played entirely offline. There
> is no account and no sign in.
>
> Adverts: two kinds. A rewarded advert the player chooses to watch in the
> shop, and one full screen advert after a season or tournament finishes,
> capped at one every four minutes. None during play.
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

---

## The listing

### Subtitle, 30 characters
`Build the perfect football XI`

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
> 712 club seasons, 3,003 players, 51 clubs, 1992 to 2026.
>
> Free. No subscriptions, nothing to buy, and it works with no connection.
> Paid for by adverts: one you choose to watch, and one at a break in
> play. Never during a match.
>
> Unofficial and unaffiliated. Not connected to the Premier League, FIFA,
> UEFA, or any club, competition or player.

### Keywords, 100 characters
`football,soccer,draft,manager,premier,league,cards,squad,ultimate,team,xi,fantasy,dynasty,career`

### Category
Primary **Games → Sports**, secondary **Games → Simulation**.

### Support URL
perfectxi.app, or an email address on a page. Apple needs somewhere a
player can reach you.

---

## The one thing worth thinking about before you press submit

The game is built on real player names, club names and thirty five
seasons of real results, and it now earns money. Free fan projects and
commercial products using the same marks are treated very differently by
the Premier League, FIFA and UEFA.

Nothing here is legal advice and plenty of apps live in this space. But
the risk is real and it is worth knowing that it went up the moment the
adverts went in, rather than finding out from a letter.
