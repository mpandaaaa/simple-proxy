> **Out of date on adverts.** Written while the app had AdMob. Tracking and adverts were removed on 7 November 2026, so `docs/APP-STORE.md` is right wherever the two disagree.

# The prompt to paste into a Claude chat

Everything below the line is self contained. Copy all of it into a new
conversation at claude.ai and it will have everything it needs, because
it cannot see this repository.

---

I need help putting my iPhone game on the App Store. I am not technical, I have never submitted an app before, and I get lost when people assume I know what things mean.

How I would like you to work with me:

- One step at a time. Tell me the single next thing to do, then stop and wait for me to say I have done it. Do not give me a list of ten steps.
- Tell me exactly what to click, and what the screen should look like when I get there. If I have to type something, give me the exact words to paste.
- If something on my screen does not match what you described, I will send you a screenshot. Read it and tell me what to do rather than guessing.
- Plain English. No jargon unless you explain it in the same sentence.
- Please do not use em dashes anywhere in your replies.
- If I ask you to do something that would break the game or the listing, say so plainly instead of going along with it.

## About the app

- Name: **Perfect XI**
- What it is: a football management game. You draft an XI from real Premier League players across thirty five seasons, then play out a season, tournaments, or a long career.
- Bundle ID: `app.perfectxi.game`
- Version: 1.0.0
- Platform: iPhone and iPad, iOS
- Price: free
- Money: adverts only. There is nothing to buy, no subscription, no in app purchases at all.
- It works offline apart from one optional head to head duel feature.
- Built with Expo and React Native. Builds are made with EAS.
- My Apple Developer account and my Expo account are already set up.

## Where I am up to

The game is finished and tested. I have it installed on my phone already. Nothing has been submitted yet.

There are two jobs left and I would like your help with both, in this order.

---

# The privacy policy, already done

Apple will not accept the app without a privacy policy at a web address anybody can open. Mine is live and checked:

```
https://perfectxi.app/app-privacy
```

Use that exact address. Do **not** use `https://perfectxi.app/privacy`, which also exists but is my website's own policy about cookies and AdSense in the browser. It does not describe the iPhone app.

---

# Job two: App Store Connect

Take me through creating the listing at appstoreconnect.apple.com and submitting. Below is every answer I already know, so please use these rather than asking me to make them up. If App Store Connect asks something that is not on this list, tell me what it is asking in plain English and suggest an answer.

## Creating the app record

- Platform: iOS
- Listing name: `Perfect XI: Football Draft`. The name under the icon on the phone stays `Perfect XI` and comes from the build, not from App Store Connect.
- Primary language: English (UK)
- Bundle ID: choose `app.perfectxi.game` from the dropdown
- SKU: `perfectxi`
- User access: Full Access

## Privacy policy URL

`https://perfectxi.app/app-privacy` once job one is finished. Not `/privacy`, which is the website's own separate policy.

## Category

- Primary: Games, then Sports
- Secondary: Games, then Simulation

## Subtitle, 30 characters

```
Build the Perfect Football XI
```

## Promotional text

```
Draft an XI from thirty five seasons of the Premier League, play it out match by match, and see how far it goes. Free, offline, no subscriptions.
```

## Description

```
Thirty five seasons of the Premier League, and eleven shirts to fill.

Every spin deals you five real footballers from anywhere between 1992 and 2026. Henry from 2003. Shearer from 1995. Haaland from last year. You take one, and you keep going until the eleven is finished. Players from the same club and the same era play better together, so the XI you end up with is the one you argued yourself into.

Then you play the season. Thirty eight games against the real league on a match engine built from real numbers, with a table, a grade and a trophy cabinet that remembers all of it.

WHAT ELSE IS IN IT

The World Cup. Forty eight nations, the real 2026 format, one match at a time, played out minute by minute with commentary.

The Champions League. The real thirty six team league phase, the play-off, two legged ties and a final. Skip the league phase or watch every matchday.

The Cup. Sixteen club seasons from any era in one bracket. The Invincibles against Guardiola's City, one night each.

Dynasty. A career at one club across seasons, with ageing, transfers, contracts, an academy, a stadium, the books and a board losing patience. Three careers kept apart.

The Daily. One draft a day, the same players for everybody, one attempt.

The album. Eleven thousand cards, packs, sets, and a hundred and eleven achievements.

THE DATABASE

712 club seasons, 3,003 players, 51 clubs, 1992 to 2026.

Free. No subscriptions, nothing to buy, and it works with no connection. Paid for by adverts: one you choose to watch, and one at a break in play. Never during a match.

Unofficial and unaffiliated. Not connected to the Premier League, FIFA, UEFA, or any club, competition or player.
```

## Keywords

```
football,soccer,draft,manager,cards,squad,xi,fantasy,dynasty,career,tactics,legends,retro,eleven
```

## Support URL

`https://perfectxi.app`

## Contact email

`perfectxigame@gmail.com`. Use this for App Review Information as well.

## Screenshots

I need to take these on my iPhone. Apple wants the 6.7 inch size, which is an iPhone 15 or 16 Pro Max, and it scales that down for the other sizes. Please tell me when in the process to take them. The six I plan to take are:

1. The home screen showing the modes
2. A draft board part way through
3. A finished season table with the grade
4. A Champions League match with the commentary running
5. The trophy cabinet
6. A pack being opened

## Age rating questionnaire

- Contests: none
- Gambling: **no**. Packs are opened with coins earned by playing. There is no way to buy coins with money and no way to cash anything out.
- Unrestricted web access: no
- Violence, sexual content, drugs, language: none

This should come out at 4+. If your answers push it higher, stop and tell me which question did it before I submit.

## App privacy, the nutrition label

None of this is my game collecting anything. It is all the Google advert software, and this list is taken from the table Google publishes. Declare exactly these and nothing else:

| Apple category | Data type | Purpose | Linked to me | Used for tracking |
| --- | --- | --- | --- | --- |
| Identifiers | Device ID | Third-Party Advertising, Analytics | Yes | Yes |
| Usage Data | Advertising Data | Third-Party Advertising, Analytics | Yes | Yes |
| Usage Data | Product Interaction | Third-Party Advertising, Analytics | Yes | No |
| Diagnostics | Performance Data | Analytics, App Functionality | Yes | No |
| Diagnostics | Crash Data | App Functionality, Analytics | No | No |
| Location | Coarse Location | Third-Party Advertising | No | No |

Two of those look odd and I want to understand them if Apple queries it:

- **Coarse Location** is there because Google works out roughly which country an advert request came from by looking at the internet address it arrived from. My game never asks for anyone's position and there is no location prompt.
- **Linked to me** is Yes on some rows because Google says they join it up on their side. There are no accounts in my game, so nothing is linked to a person by anything the game itself does.

## App Review Notes

```
Perfect XI is a football management game played entirely offline. There is no account and no sign in.

Adverts: two kinds. A rewarded advert the player chooses to watch in the shop, and one full screen advert after a season or tournament finishes, capped at one every four minutes. None during play.

Packs are opened with coins earned by playing. There is no way to buy coins with money. Odds are printed on every pack.

The one online feature is a head to head duel, which sends a random seed and a score to a database and nothing else. It is optional and the rest of the game works with no connection.

The App Tracking Transparency prompt appears on first launch. Answering no changes nothing about the game: the same number of adverts, the same rewards, the same content.

Player and club names are matters of public record, used to describe real football history in a work of statistical fiction. The app states on the home screen, in Settings and on its privacy page that it is unofficial and unaffiliated.
```

## Export compliance

The app is already set up to answer this automatically and should not ask. If it does ask, the answer is that it does not use non exempt encryption.

## Building and uploading

The build is made from my computer with a command. When we get to that point, tell me to run this in PowerShell:

```
cd C:\Users\44791\simple-proxy\perfectxi
npx eas-cli build --platform ios --profile production
```

Then, once it finishes:

```
npx eas-cli submit --platform ios --latest
```

Please tell me what to expect at each of those, and what to do if either one asks me a question.

---

Start with job one, the privacy page on Netlify. Give me the first step only.
