"""
The website icon pack.

Everything perfectxi.app needs to have an icon in a browser tab, on a
phone home screen, and in a link preview when somebody shares it.

    python tools/webicons/build.py

Built from `assets/icon.png`, the same file that ships inside the app, so
the tab and the home screen icon are the same mark rather than two that
nearly match.

Two things here are not simply that file resized, and both are on
purpose:

  The 16, 32 and 48 pixel sizes are drawn rather than scaled. The app
  icon has a diagonal sash with a gold edge on it, and a gold line one
  pixel wide next to a green one is mud. At tab size the mark has to be
  the two letters and the ground, and nothing else, or it reads as a
  smudge. This is what every icon set that survives contact with a
  browser tab does.

  The maskable icon is the app icon untouched, which is worth stating
  because it looks like an omission. Android crops a maskable icon to
  whatever shape the launcher wants, and only the middle eighty percent
  is guaranteed to survive. The XI already sits inside that circle, so
  padding it further would shrink the mark for no reason.

There is no SVG favicon. The mark is two letters in Anton, and an SVG
that names the font renders in whatever the browser has instead, which is
not the same mark. Real path data would fix it and is not worth hand
writing for something the PNGs already cover.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "screenshots"))
from compose import wash, sash  # noqa: E402


def tile_mask(size, radius):
    """
    A rounded square, with its own corners.

    Not the one in compose.py. That draws the rectangle out to the full
    width rather than the last pixel of it, which squares off the bottom
    right corner. It is invisible on a screen sized paste and obvious on
    a three hundred pixel tile. compose.py is left alone on purpose: its
    frames are already at Apple, and a corner is not worth changing them
    under.
    """
    w, h = size
    m = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, w * 4 - 1, h * 4 - 1], radius=radius * 4, fill=255
    )
    return m.resize((w, h), Image.LANCZOS)

ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")
INTER = os.path.join(ROOT, "node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf")
SRC = os.path.join(ROOT, "assets", "icon.png")
OUT = os.path.join(HERE, "out")

# Sampled from the icon itself rather than guessed, so a drawn size and a
# scaled one sit on the same green.
GROUND_A = (25, 174, 111)
GROUND_B = (16, 141, 91)
INK = (7, 12, 9)

SITE = "https://perfectxi.app"


def ground(size):
    """The icon's own diagonal green, at any size."""
    w = h = size
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / max(1, (w + h - 2))
            px[x, y] = tuple(
                int(GROUND_A[i] + (GROUND_B[i] - GROUND_A[i]) * t) for i in range(3)
            )
    return im


def small(size):
    """
    A tab sized mark: the ground and the two letters, nothing else.

    Drawn at four times the size and reduced, because Anton at sixteen
    pixels hinted by the rasteriser loses the crossbar of the X.
    """
    big = size * 4
    im = ground(big)
    d = ImageDraw.Draw(im)

    # Air, and a gap between the two letters.
    #
    # Anton sets XI almost touching, and at sixteen pixels two black
    # shapes a pixel apart are one black shape. So the letters are drawn
    # separately with a gap opened between them, and the pair is sized to
    # leave green around it. Filling the square reads as a smudge; a
    # smaller mark with space around it still reads as letters.
    room, cap = int(big * 0.78), int(big * 0.62)
    gap = max(1, int(big * 0.10))

    def measure(f):
        wx = d.textbbox((0, 0), "X", font=f)
        wi = d.textbbox((0, 0), "I", font=f)
        return (wx[2] - wx[0]) + gap + (wi[2] - wi[0]), max(wx[3] - wx[1], wi[3] - wi[1])

    f = None
    for pt in range(big * 2, 8, -2):
        cand = ImageFont.truetype(ANTON, pt)
        tw, th = measure(cand)
        if tw <= room and th <= cap:
            f = cand
            break
    f = f or ImageFont.truetype(ANTON, max(8, big // 3))

    tw, th = measure(f)
    bx = d.textbbox((0, 0), "X", font=f)
    bi = d.textbbox((0, 0), "I", font=f)
    x = (big - tw) / 2
    y = (big - th) / 2
    d.text((x - bx[0], y - bx[1]), "X", font=f, fill=INK)
    d.text((x + (bx[2] - bx[0]) + gap - bi[0], y - bi[1]), "I", font=f, fill=INK)
    return im.resize((size, size), Image.LANCZOS)


def scaled(size):
    """The real app icon, reduced. No alpha: iOS refuses a transparent one."""
    return Image.open(SRC).convert("RGB").resize((size, size), Image.LANCZOS)


def og():
    """
    The link preview, 1200 by 630.

    The same ground and sash as the App Store frames, so a shared link and
    the store listing look like the same product.
    """
    W, H = 1200, 630
    im = wash(W, H)
    im = Image.composite(
        Image.new("RGB", (W, H), (120, 252, 190)), im,
        sash(W, H, 0.22).point(lambda v: int(v * 0.26)),
    )

    # The icon is the same green as the ground it sits on, so without a
    # shadow it dissolves into it and reads as a stain rather than a tile.
    side, top = 96, (H - 300) // 2
    mask = tile_mask((300, 300), 66)
    sha = Image.new("L", (W, H), 0)
    sha.paste(mask, (side, top + 14))
    sha = sha.filter(ImageFilter.GaussianBlur(22)).point(lambda v: int(v * 0.5))
    im = Image.composite(Image.new("RGB", (W, H), (4, 40, 26)), im, sha)
    im.paste(scaled(300), (side, top), mask)

    d = ImageDraw.Draw(im)
    x = 456
    room = W - x - 96

    title = None
    for pt in range(200, 20, -2):
        cand = ImageFont.truetype(ANTON, pt)
        if d.textlength("PERFECT XI", font=cand) <= room:
            title = cand
            break
    tl, tt, tr, tb = d.textbbox((0, 0), "PERFECT XI", font=title)
    th = tb - tt

    body = ImageFont.truetype(INTER, 27)
    lines = [
        "712 club seasons · 3,003 players · 1992 to 2026",
        "Free. Offline. No subscriptions.",
    ]
    lh = 42
    block = th + 30 + lh * len(lines)
    y = (H - block) // 2

    d.text((x - tl, y - tt), "PERFECT XI", font=title, fill=INK)
    y += th + 30
    for ln in lines:
        d.text((x, y), ln, font=body, fill=INK)
        y += lh
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []

    def put(name, im):
        im.save(os.path.join(OUT, name))
        made.append((name, im.size))

    for s in (16, 32, 48):
        put(f"favicon-{s}x{s}.png", small(s))

    # One .ico holding all three, because that is what a bare /favicon.ico
    # request gets and plenty of things still ask for it by that name.
    small(48).save(
        os.path.join(OUT, "favicon.ico"),
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    made.append(("favicon.ico", "16, 32 and 48 in one file"))

    put("favicon-96x96.png", scaled(96))
    put("apple-touch-icon.png", scaled(180))
    put("icon-192.png", scaled(192))
    put("icon-512.png", scaled(512))
    put("icon-maskable-512.png", scaled(512))
    put("og-image.png", og())

    manifest = {
        "name": "Perfect XI",
        "short_name": "Perfect XI",
        "description": "Draft an XI from thirty five seasons and play it out.",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0F8D5B",
        "theme_color": "#0F8D5B",
        "icons": [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
            {
                "src": "/icon-maskable-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
    }
    with open(os.path.join(OUT, "site.webmanifest"), "w", encoding="utf8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    made.append(("site.webmanifest", "the web app manifest"))

    head = f"""<!-- Paste inside <head>. Every file sits at the root of the site. -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0F8D5B">

<!-- The link preview, for when somebody shares the site -->
<meta property="og:type" content="website">
<meta property="og:title" content="Perfect XI">
<meta property="og:description" content="Draft an XI from thirty five seasons of the Premier League, play it out match by match, and see how far it goes. Free, offline, no subscriptions.">
<meta property="og:url" content="{SITE}">
<meta property="og:image" content="{SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Perfect XI">
<meta name="twitter:description" content="Draft an XI from thirty five seasons of the Premier League, play it out match by match, and see how far it goes. Free, offline, no subscriptions.">
<meta name="twitter:image" content="{SITE}/og-image.png">
"""
    with open(os.path.join(OUT, "head.html"), "w", encoding="utf8") as fh:
        fh.write(head)
    made.append(("head.html", "what to paste into the page"))

    readme = """PERFECT XI, THE WEBSITE ICON PACK

Put every file in this folder at the ROOT of perfectxi.app, so that
perfectxi.app/favicon.ico and perfectxi.app/og-image.png both work. Then
paste the contents of head.html inside the <head> of every page.

WHAT EACH FILE IS FOR

  favicon.ico            the browser tab, and anything old that asks for
                         /favicon.ico by name. Holds 16, 32 and 48
  favicon-16x16.png      the tab, on a normal screen
  favicon-32x32.png      the tab, on a sharp screen
  favicon-48x48.png      Windows shortcuts and some browser lists
  favicon-96x96.png      a browser's new tab page
  apple-touch-icon.png   an iPhone or iPad home screen. iOS rounds the
                         corners itself, so this one is square
  icon-192.png           an Android home screen
  icon-512.png           the Android splash and the install prompt
  icon-maskable-512.png  Android again, for launchers that crop the icon
                         to a circle or a squircle
  og-image.png           the picture that appears when the link is shared
                         on WhatsApp, iMessage, Facebook, LinkedIn or X
  site.webmanifest       lets a phone add the site to its home screen
  head.html              the tags. Paste them, do not retype them

TWO THINGS THAT ARE DELIBERATE

The 16, 32 and 48 pixel icons are not the app icon shrunk. They are drawn
without the diagonal sash, because a gold line one pixel wide next to a
green one is mud at that size. At tab size the mark is the two letters.

The maskable icon is the app icon untouched. Android crops it to the
launcher's shape and only the middle eighty percent survives. The XI is
already inside that circle, so padding it would shrink the mark for no
reason.

AFTER YOU UPLOAD

Browsers cache a favicon hard. If the old one is still showing, open the
site in a private window, or go straight to perfectxi.app/favicon.ico to
confirm the new file is really there.

To check the link preview without posting anywhere, paste the address
into the LinkedIn Post Inspector or opengraph.xyz. Both refetch the page
and show you what a share will look like.
"""
    with open(os.path.join(OUT, "README.txt"), "w", encoding="utf8") as fh:
        fh.write(readme)
    made.append(("README.txt", "what goes where"))

    print(f"\n{len(made)} files in {OUT}\n")
    for name, what in made:
        print(f"  {name:24} {what}")


if __name__ == "__main__":
    main()
