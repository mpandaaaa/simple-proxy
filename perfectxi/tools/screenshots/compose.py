"""
The App Store screenshot frames.

Captures come off a real phone or tablet into raw/. This puts the caption
and the background around them and writes finished frames to out/.
Nothing here draws any part of the app: it only ever places a capture
that already exists. That is the rule Apple enforces, and the reason a
screenshot may not be tidied up in a design tool. If a screen is not good
enough to capture, the screen gets fixed and captured again.

raw/ and out/ never touch. Recapturing on a new build cannot destroy a
finished frame, and rebuilding the finished set never needs the device.

Captions live in captions.<lang>.json, one file per language, so another
language is data rather than a second layout. An iPad capture is named
01-home-ipad.png and shares the caption with the phone frame.

    python tools/screenshots/compose.py
    python tools/screenshots/compose.py --lang fr
    python tools/screenshots/compose.py --only 01-home

Why it looks the way it does, since all of it was arrived at by being
wrong first:

  The ground is saturated. The first version was near black with a white
  caption, which was tasteful and invisible, because a dark frame beside
  the store's own dark chrome has nothing to separate it.

  The caption is uppercase Anton, sized automatically until it runs out
  of width or out of the two lines it is allowed. A caption that cannot
  be read in a search result is not a caption.

  The screen runs off the bottom edge. A frame containing a whole device
  is a slide about the app. One that is cut off is a window into it.

  The status bar is cropped, not redrawn. A drawn one was tried and read
  as fake on sight, because a hand made battery next to a real iOS one
  always will. For the classic 9:41, set the device clock by hand, charge
  it to full, capture, and set STRIP_STATUS_BAR to False.

  The diagonal sash and the wreath are carried over from the app icon, so
  the store page and the thing that lands on the home screen look like
  each other.

  What is inside the wreath is a fact about the game, never a prize, a
  rating or a review. A wreath around a true statement is decoration. A
  wreath around a claim nobody made is a lie with leaves on it.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plaque import plaque

# ---------------------------------------------------------------------
# The canvases Apple asks for.
#
# Two, because the app ships on iPad as well as iPhone, and Apple rejects
# an iPhone frame scaled into an iPad slot. They are different shapes,
# not different sizes: the phone is tall and narrow, the tablet is nearly
# square, so one set of layout numbers cannot serve both and each carries
# its own.
#
# A capture is matched to a canvas by its own dimensions. Anything that
# is neither is refused rather than resized, because a resized screenshot
# is soft and Apple rejects dimensions that are off by a single pixel.
# ---------------------------------------------------------------------
CANVASES = {
    "iphone": {
        "size": (1320, 2868),     # iPhone 16 and 17 Pro Max, the 6.9 inch class
        "status_bar": 185,
        "seal_top": 74,
        "seal_size": 410,
        "cap_top": 530,
        "cap_budget": 372,
        "cap_margin": 65,
        "shot_w": 1080,
        "shot_top": 940,
        "cap_gap": 96,
        "corner": 64,
        "sash": 0.16,
    },
    "ipad": {
        "size": (2064, 2752),     # the 13 inch iPad class
        "status_bar": 48,
        "seal_top": 96,
        "seal_size": 430,
        "cap_top": 600,
        "cap_budget": 330,
        "cap_margin": 150,
        "shot_w": 1480,
        "shot_top": 1010,
        "cap_gap": 110,
        "corner": 52,
        "sash": 0.20,
    },
}

BY_SIZE = {c["size"]: (name, c) for name, c in CANVASES.items()}

STRIP_STATUS_BAR = True
CAP_LINES = 2
LEADING = 0.88

INK    = (6, 11, 8)
BRIGHT = (64, 238, 162)
MID    = (26, 190, 124)
DEEP   = (8, 84, 55)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")
INTER = os.path.join(ROOT, "node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf")
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "out")


def wash(w, h):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    stops = [(0.0, BRIGHT), (0.55, MID), (1.0, DEEP)]
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                d.line([(0, y), (w, y)],
                       fill=tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3)))
                break
    return im


def sash(w, h, width_frac, angle=38):
    span = max(w, h) * 3
    m = Image.new("L", (span, span), 0)
    bw = int(h * width_frac)
    m.paste(Image.new("L", (span, bw), 255), (0, (span - bw) // 2))
    m = m.rotate(angle, resample=Image.BICUBIC)
    left, top = (span - w) // 2, (span - h) // 2
    return m.crop((left, top, left + w, top + h))


def wrap(text, font, max_w, draw):
    words, lines, line = text.split(), [], ""
    for word in words:
        t = f"{line} {word}".strip()
        if draw.textlength(t, font=font) <= max_w:
            line = t
        else:
            if not line:
                return None
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def fit(text, max_w, max_lines, budget_h):
    """
    The largest Anton that still fits.

    Pushed up until it runs out of width, runs out of lines, or runs out
    of the height it has been given. Sized rather than fixed because the
    captions are different lengths, and a fixed size would leave the short
    ones needlessly small.
    """
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    best = None
    for size in range(80, 440, 2):
        f = ImageFont.truetype(ANTON, size)
        ls = wrap(text, f, max_w, probe)
        if ls is None or len(ls) > max_lines:
            break
        lh = int(size * LEADING)
        if lh * len(ls) > budget_h:
            break
        best = (f, ls, lh)
    if best is None:
        f = ImageFont.truetype(ANTON, 80)
        best = (f, wrap(text, f, max_w, probe) or [text], 72)
    return best


def rounded_mask(size, radius):
    m = Image.new("L", (size[0] * 2, size[1] * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * 2, size[1] * 2],
                                        radius=radius * 2, fill=255)
    return m.resize(size, Image.LANCZOS)


def compose(path, caption_text, seal=None):
    shot = Image.open(path).convert("RGB")
    if shot.size not in BY_SIZE:
        allowed = "\n  ".join(f"{n:7} {c['size'][0]} by {c['size'][1]}"
                              for n, c in CANVASES.items())
        raise SystemExit(
            f"\n{os.path.basename(path)} is {shot.size[0]} by {shot.size[1]}, "
            f"which is neither canvas.\n\nApple accepts:\n  {allowed}\n\n"
            f"Do not resize it. Capture it again on a device of the right size.\n"
        )

    device, C = BY_SIZE[shot.size]
    W, H = C["size"]

    if STRIP_STATUS_BAR:
        shot = shot.crop((0, C["status_bar"], W, H))

    im = wash(W, H)
    im = Image.composite(Image.new("RGB", (W, H), (120, 252, 190)), im,
                         sash(W, H, C["sash"]).point(lambda v: int(v * 0.26)))

    if seal:
        p = plaque(C["seal_size"], seal["big"], seal["small"], INK,
                   eyebrow=seal.get("eyebrow"), thickness=1.18)
        im.paste(p, ((W - C["seal_size"]) // 2, C["seal_top"]), p)

    d = ImageDraw.Draw(im)
    f, lines, lh = fit(caption_text.upper(), W - C["cap_margin"] * 2,
                       CAP_LINES, C["cap_budget"])
    y = C["cap_top"]
    for ln in lines:
        d.text(((W - d.textlength(ln, font=f)) / 2, y), ln, font=f, fill=INK)
        y += lh

    # Where the screen starts.
    #
    # Below the caption rather than at a fixed line. A one line caption and
    # a two line caption end in different places, and a fixed start meant
    # the second line of a long one sat a few points off the top of the
    # phone. Measured, they cannot collide however long the words are.
    shot_top = max(C["shot_top"], y + C["cap_gap"])

    shot_w = C["shot_w"]
    sh = int(shot_w * shot.size[1] / shot.size[0])
    small = shot.resize((shot_w, sh), Image.LANCZOS)
    mask = rounded_mask((shot_w, sh), C["corner"])
    x = (W - shot_w) // 2

    # a shadow, so the screen sits on the ground rather than in it
    sha = Image.new("L", (W, H), 0)
    sha.paste(mask, (x, shot_top + 34))
    sha = sha.filter(ImageFilter.GaussianBlur(52)).point(lambda v: int(v * 0.55))
    im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sha)
    im.paste(small, (x, shot_top), mask)
    return device, im


def contact(frames, path):
    """Every frame side by side, and again at the size it is first seen."""
    big_h, thumb_h, pad = 900, 250, 32
    cells = [(n, im, int(im.size[0] * big_h / im.size[1])) for n, im in frames]
    width = pad + sum(c[2] + pad for c in cells)
    sheet = Image.new("RGB", (width, pad + big_h + 34 + thumb_h + pad), (20, 22, 21))
    d = ImageDraw.Draw(sheet)
    label = ImageFont.truetype(INTER, 18)
    x = pad
    for name, im, big_w in cells:
        sheet.paste(im.resize((big_w, big_h), Image.LANCZOS), (x, pad))
        d.text((x, pad + big_h + 6), name, font=label, fill=(230, 237, 233))
        tw = int(im.size[0] * thumb_h / im.size[1])
        sheet.paste(im.resize((tw, thumb_h), Image.LANCZOS), (x, pad + big_h + 32))
        x += big_w + pad
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="en")
    ap.add_argument("--only", default=None, help="one frame, by its raw file stem")
    args = ap.parse_args()

    with open(os.path.join(HERE, f"captions.{args.lang}.json"), encoding="utf8") as fh:
        captions = json.load(fh)

    os.makedirs(OUT, exist_ok=True)
    by_device = {}
    for name in sorted(os.listdir(RAW)):
        if not name.lower().endswith(".png"):
            continue
        stem = os.path.splitext(name)[0]
        if args.only and stem != args.only:
            continue
        # 01-home-ipad.png shares its caption with 01-home.png
        key = stem[:-5] if stem.endswith("-ipad") else stem
        if key not in captions:
            print(f"  {stem}: no caption for {key} in captions.{args.lang}.json, skipped")
            continue
        entry = captions[key]
        device, im = compose(os.path.join(RAW, name), entry["line"], entry.get("seal"))
        im.convert("RGB").save(os.path.join(OUT, f"{stem}.png"))
        by_device.setdefault(device, []).append((stem, im))
        print(f"  {device:7} {stem:18} {entry['line']}")

    if not by_device:
        print(f"\nNothing in {RAW}. Put the captures there, named to match "
              f"captions.{args.lang}.json.")
        return

    for device, frames in by_device.items():
        contact(frames, os.path.join(OUT, f"contact-sheet-{device}.png"))
        n = len(frames)
        print(f"\n{device}: {n} frame{'' if n == 1 else 's'}, "
              f"contact sheet at out/contact-sheet-{device}.png")


if __name__ == "__main__":
    main()
