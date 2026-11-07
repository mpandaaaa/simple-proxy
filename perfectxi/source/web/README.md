# Web build snapshot

A copy of the live web game at https://perfectxi.app, fetched 7 November 2026.
This is the source of truth the native app is ported from.

It is kept in the repo so the port never depends on a file that only existed
in someone's downloads folder. `scripts/extract-db.mjs` reads `index.html`
from here to build `src/data/`.

To refresh it from the live site, re-download `index.html` and the scripts
it loads with `<script src="/...">`, then re-run the extractor and the golden
tests. If the tests move, the web game's balance changed and that needs a
decision, not a silent update.

Nothing in this folder ships in the app bundle.
