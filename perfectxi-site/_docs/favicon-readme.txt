PERFECT XI — favicon / icon set
================================
Upload ALL of these to your site ROOT (same level as index.html):

  favicon.ico              multi-size .ico (16/32/48) — legacy + universal
  favicon.svg              scalable favicon (modern browsers, crisp at any size)
  favicon-16.png           16x16
  favicon-32.png           32x32
  favicon-48.png           48x48
  apple-touch-icon.png     180x180 (iOS home screen; no transparency)
  icon-192.png             192x192 (PWA / Android)
  icon-512.png             512x512 (PWA / Android)
  icon-512-maskable.png    512x512 maskable (safe-zone padded for Android masks)
  mask-icon.svg            Safari pinned-tab (monochrome; tinted #3dba6f)
  manifest.json            web app manifest (replaces your old one)
  og-image.png             1200x630 social share image

Then paste HEAD-SNIPPET.html into your <head>, replacing your old favicon/
apple-touch/manifest/theme-color lines.

Notes
-----
- manifest.json keeps the same filename you already link to, so it drops in.
- After deploy, hard-refresh (browsers cache favicons aggressively) — or test
  in a private window. Tab icon, iOS "Add to Home Screen", and Android install
  banner will all use the new mark.
- icon-1024.png is the master if you ever need a bigger source.
