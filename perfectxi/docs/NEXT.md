# What to build next

Written after the tournaments went in, with the app at the point where
every mode on the home screen is real and nothing is a placeholder.

Everything here is grounded in what already exists. Effort is rough, in
sittings rather than hours, and "needs a build" means it adds a native
module so it costs one of the EAS builds rather than a dev server reload.

---

## Resubmitting after the September rejection

Apple refused build 8 on 9 September under guidelines 2.5.4 and 2.1. On
7 November 2026 the answer to 2.1 changed: tracking and the AdMob SDK were
removed rather than the prompt being fixed, so no recording is needed. See
`docs/perfect-xi/REVIEW-2026-09.md` and `docs/REVIEW-REPLY.md`.

**In this order:**

1. In App Store Connect, App Privacy: answer No to tracking and take off the
   six advert rows. Change Advertising to No in the age rating.
2. Publish the new `web/app-privacy.html` at the address the listing points at.
3. Change the database line in the description to 706 club seasons, 2,978 players.
4. `npx eas-cli@latest build --platform ios --profile production --non-interactive --auto-submit`
5. Reply in the Resolution Center on submission
   `d956b10e-fd21-44e5-869d-b6bada87072c` with the text from
   `docs/REVIEW-REPLY.md`, then pick the new build and submit for review.

**Known fault, not fixed because it is not what review raised.** Dynasty
announces a points deduction for losses past the limit and says it comes off
next season, but nothing reads `psrHit`, so the points never come off.
`npm run screens` reports this for Arsenal and Everton since the database
swap, because those careers now reach a deduction, and that stops
`npm run verify` at that step.

### Held over, not part of this resubmission

**The name filter.** Settings lets anyone type eighteen characters, and
that name is what a leaderboard row and a duel opponent see. Nothing
checks it, which is the open question against guideline 1.2, and it is
why the two Supabase steps in `docs/LEADERBOARD.md` are deliberately
still undone. Filter the name and both unblock together.

---

## Before 1.0 ships

These are the ones that are not optional.

### 1. Online leaderboards
**Effort: three or four sittings. No build.**

The plan has always been that a leaderboard entry is verified by replaying
the seed, the config and the eleven picks on the server. The engine
already runs headless and unchanged inside a Supabase edge function, which
is exactly what makes that possible, and the duel layer proves the
plumbing works. What is missing is the table, the function and the screen.

Daily and Weekly are the two that want it most: a Daily with no table to
appear on is a puzzle with nobody watching.

### 2. Game Center on top
**Effort: one sitting plus a build.**

Once the leaderboard exists, Game Center is a thin layer over it, and it
is what an iPhone player expects. It cannot be the only leaderboard,
because Game Center scores are client submitted and spoofable, which is
the whole reason for the replay check.

### 3. A first run
**Effort: one sitting. No build.**

Somebody opening the app for the first time lands on a home screen with
six modes and no idea which one is the game. Three cards explaining the
draft, the spin and the season, then straight into a first draft with the
rerolls already spent so it cannot go wrong. It is the cheapest thing on
this list and probably the highest return.

### 4. Backing up a career
**Effort: two sittings plus a build.**

Deleting the app throws away everything, including a twenty five season
Dynasty. That is fine for a puzzle and cruel for a career. iCloud key
value storage holds a megabyte, a Dynasty is a few kilobytes, and one
switch in Settings would cover it.

---

## The biggest structural win

### 5. Dynasty and Europe should be the same game
**Effort: three sittings. No build.**

Dynasty already knows about the Continental Cup as an abstraction. The
Champions League is now a real competition with a real format, a real
field and a real broadcast. Finishing top four in a Dynasty season should
put you in it, and playing it should be the Champions League mode with
your Dynasty squad rather than a club from the 2026 field.

That single connection turns two good modes into one long game, and it is
mostly wiring: the campaign takes a squad and a rating, and Dynasty has
both.

The same argument applies to the Europa League and the Conference League,
which are the same engine with a different field and a shorter league
phase.

---

## New modes, cheapest first

### 6. Custom knockout
**Effort: one sitting.**

Pick sixteen clubs from any era in the database and play a straight
knockout with the tournament broadcast. Everything needed already exists:
the bracket code, the two legged tie, the commentary. It is a new screen
over parts that are already written and checked.

### 7. All-time World Cup
**Effort: one or two sittings.**

1998 Brazil against 2010 Spain. The World Cup engine takes a squad and a
rating, and the league database holds thirty five seasons of clubs. The
work is assembling historic national squads, which is data rather than
code.

### 8. Tournament players in the album
**Effort: two sittings.**

The album holds 11,077 league cards and none of the 1,241 World Cup or
688 Champions League players. Mbappe, Haaland and Bellingham are in the
game and not collectible, which is the first thing anybody would ask
about.

### 9. A puzzle mode
**Effort: two sittings.**

"Build an XI rated 85 or better for under two hundred million." One
board, one constraint, a new one every day. The valuation curve and the
draft board already exist; it is a different win condition over the same
machinery.

### 10. A head to head league
**Effort: three sittings, and it needs the online layer.**

A duel is one season. A league is ten of them against the same person
over a fortnight, with a table. It is the thing that would make somebody
come back rather than play once.

---

## Improvements to what is there

### 11. Rewatch any match
The broadcast is built from a seed and a banked result, so any match in
any history can be replayed exactly as it happened. The Hall of Fame and
the Dynasty history could both offer it. **Half a sitting.**

### 12. Share the tournaments
`ShareCard` renders a 1080 by 1350 card off screen for a draft season.
Winning a World Cup or a European Cup deserves one too, and so does a
completed shelf in the cabinet. **One sitting.**

### 13. A stats hub
Every mode counts things and none of them are in one place. Total matches,
goals, trophies, best season, most used formation, favourite club. The
career record already holds most of it. **One sitting.**

### 14. A daily reminder
One notification a day, off by default, at a time you choose. It is the
single biggest thing for coming back, and it needs a build and honest
permission copy. **One sitting plus a build.**

### 15. iPad
`supportsTablet` is false. Nothing in the layout assumes a phone except
the widths, and the app would look good on an iPad. **Two sittings, and a
lot of checking.**

### 16. A second commentary voice
The tournament broadcast has one bank of phrases. A second, drier one,
chosen in Settings, would make a hundred matches feel less repetitive.
**Half a sitting.**

---

## Technical, none of it visible

### 17. Screen snapshots
Every check in this project measures the engine. Nothing measures what a
screen actually renders. React Test Renderer snapshots of the twenty
screens would catch a layout regression before a phone does.

### 18. A device smoke test
Maestro can drive the real app through a draft, a season, a World Cup and
a Champions League on every build. It is the only thing that would catch
a crash on launch, which is the one bug no headless check can see.

### 19. An opt-in crash report
The privacy page currently says there is no crash reporting, and that is
worth keeping true by default. Opt-in, off unless somebody turns it on,
would still catch the crashes that matter.
