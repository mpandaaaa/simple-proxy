"""
The composition layer for the App Store screenshots.

Raw captures come off a real phone and go in raw/. This puts a caption
and a background around them and writes the finished frames to out/.
Nothing here draws any part of the app: it only ever places a capture
that already exists, which is the rule Apple enforces and the reason a
screenshot may not be improved in a design tool.

The two folders are kept apart on purpose. Recapturing on a new build
overwrites raw/ and never touches a finished frame, and rebuilding the
finished set never needs the phone.

Captions live in captions.<lang>.json, one file per language, so another
language is data rather than a second layout.

    python tools/screenshots/compose.py            # English
    python tools/screenshots/compose.py --lang fr
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json, os, sys, argparse

W, H = 1320, 2868                 # the 6.9 inch canvas Apple asks for

BG      = (10, 15, 12)
TEXT    = (240, 246, 243)
EMERALD = (31, 197, 126)
GOLD    = (214, 178, 94)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")

RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "out")

# ---- the layout, in pixels on the 1320 by 2868 canvas ----
MARGIN_X   = 96
CAP_TOP    = 176          # where the caption block starts
CAP_MAX_W  = W - MARGIN_X * 2
CAP_LINES  = 2            # a caption is three to five words. two lines is plenty.
SHOT_W     = 940          # the app screen, centred
SHOT_TOP   = 700
CORNER     = 58


def wrap(text, font, max_w, draw):
    """Greedy wrap. Returns the lines, or None if any single word overflows."""
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = f"{line} {w}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            line = trial
        else:
            if not line:
                return None
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def fit_caption(text, max_w, max_lines, budget_h):
    """
    The largest Anton that fits the caption in the space it has.

    A caption that is not legible in a search result is not a caption, so
    this pushes the size up until it either runs out of width, runs out of
    lines, or runs out of the height it has been given.
    """
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    best = None
    for size in range(60, 260, 2):
        f = ImageFont.truetype(ANTON, size)
        lines = wrap(text, f, max_w, probe)
        if lines is None or len(lines) > max_lines:
            break
        lh = int(size * 1.02)
        if lh * len(lines) > budget_h:
            break
        best = (f, lines, lh)
    if best is None:
        f = ImageFont.truetype(ANTON, 60)
        best = (f, wrap(text, f, max_w, probe) or [text], 62)
    return best


def rounded_mask(size, radius):
    m = Image.new("L", (size[0] * 2, size[1] * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * 2, size[1] * 2],
                                        radius=radius * 2, fill=255)
    return m.resize(size, Image.LANCZOS)


def background(accent):
    """Near black, with a bloom behind where the screen will sit."""
    im = Image.new("RGB", (W, H), BG)
    g = Image.new("L", (W, H), 0)
    r = int(W * 0.78)
    cy = SHOT_TOP + int(SHOT_W * 0.9)
    ImageDraw.Draw(g).ellipse([W // 2 - r, cy - r, W // 2 + r, cy + r], fill=255)
    g = g.filter(ImageFilter.GaussianBlur(W * 0.30)).point(lambda v: int(v * 0.30))
    return Image.composite(Image.new("RGB", (W, H), accent), im, g)


def compose(capture_path, caption, accent=EMERALD):
    shot = Image.open(capture_path).convert("RGB")
    if shot.size != (W, H):
        raise SystemExit(
            f"{os.path.basename(capture_path)} is {shot.size[0]} by {shot.size[1]}. "
            f"It has to be {W} by {H}, which is what an iPhone 16 or 17 Pro Max "
            f"screenshot already is. Do not resize it, take it again on the right phone."
        )

    im = background(accent)
    d = ImageDraw.Draw(im)

    # ---- the caption ----
    f, lines, lh = fit_caption(caption, CAP_MAX_W, CAP_LINES, SHOT_TOP - CAP_TOP - 150)
    y = CAP_TOP
    for ln in lines:
        w = d.textlength(ln, font=f)
        d.text(((W - w) / 2, y), ln, font=f, fill=TEXT)
        y += lh

    # a short rule under the caption, in the accent
    rw, rh = 132, 10
    d.rounded_rectangle([(W - rw) // 2, y + 46, (W + rw) // 2, y + 46 + rh],
                        radius=rh // 2, fill=accent)

    # ---- the capture ----
    sh = int(SHOT_W * H / W)
    small = shot.resize((SHOT_W, sh), Image.LANCZOS)
    mask = rounded_mask((SHOT_W, sh), CORNER)

    # a shadow so the screen sits on the background rather than in it
    sha = Image.new("L", (W, H), 0)
    sha.paste(mask, ((W - SHOT_W) // 2, SHOT_TOP + 26))
    sha = sha.filter(ImageFilter.GaussianBlur(38)).point(lambda v: int(v * 0.55))
    im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sha)

    im.paste(small, ((W - SHOT_W) // 2, SHOT_TOP), mask)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="en")
    ap.add_argument("--only", default=None, help="one frame, by its raw file stem")
    args = ap.parse_args()

    with open(os.path.join(HERE, f"captions.{args.lang}.json"), encoding="utf8") as fh:
        captions = json.load(fh)

    os.makedirs(OUT, exist_ok=True)
    done = 0
    for name in sorted(os.listdir(RAW)):
        if not name.lower().endswith(".png"):
            continue
        stem = os.path.splitext(name)[0]
        if args.only and stem != args.only:
            continue
        if stem not in captions:
            print(f"  no caption for {stem}, skipped")
            continue
        im = compose(os.path.join(RAW, name), captions[stem]["line"])
        # RGB, no alpha, exact pixels. Apple rejects anything else.
        out = os.path.join(OUT, f"{stem}.png")
        im.convert("RGB").save(out)
        print(f"  {stem:14} {im.size[0]} x {im.size[1]}  {captions[stem]['line']}")
        done += 1
    print(f"\n{done} frame{'' if done == 1 else 's'} written to {OUT}")


if __name__ == "__main__":
    main()
