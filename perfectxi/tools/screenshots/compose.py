"""
The App Store screenshot frames.

Captures come off a real phone into raw/. This puts the caption and the
background around them and writes finished frames to out/. Nothing here
draws any part of the app: it only ever places a capture that already
exists. That is the rule Apple enforces, and the reason a screenshot may
not be tidied up in a design tool. If a screen is not good enough to
capture, the screen gets fixed and captured again.

raw/ and out/ never touch. Recapturing on a new build cannot destroy a
finished frame, and rebuilding the finished set never needs the phone.

Captions live in captions.<lang>.json, one file per language, so another
language is data rather than a second layout.

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

  The screen runs off the bottom edge. A frame containing a whole phone
  is a slide about the app. One that is cut off is a window into it.

  The status bar is cropped, not redrawn. A drawn one was tried and read
  as fake on sight, because a hand made battery next to a real iOS one
  always will. For the classic 9:41, set the phone's clock by hand,
  charge it to full, capture, and set STRIP_STATUS_BAR to False.

  The diagonal sash is carried over from the app icon, so the store page
  and the thing that lands on the home screen look like each other.

  Each frame carries a small label above its caption. It is there to do
  the job an awards laurel would do, which is to add a second, quieter
  claim without crowding the headline, except that every one of these is
  true. An app may not show an award it has not won: it misrepresents
  the app to somebody deciding whether to install it, it is somebody
  else's mark, and Apple rejects it. A factual label costs nothing and
  cannot come back on you.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import argparse, json, os

W, H = 1320, 2868            # the 6.9 inch canvas, and nothing else is accepted
STATUS_BAR_H = 185           # measured off a real capture at this size
STRIP_STATUS_BAR = True

INK    = (6, 11, 8)
BRIGHT = (64, 238, 162)
MID    = (26, 190, 124)
DEEP   = (8, 84, 55)

BADGE_TOP  = 138
CAP_TOP    = 268
CAP_BUDGET = 640
CAP_LINES  = 2
LEADING    = 0.88
SHOT_W     = 1080
SHOT_TOP   = 840
CORNER     = 64

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")
INTER = os.path.join(ROOT, "node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf")
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "out")


def wash():
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    stops = [(0.0, BRIGHT), (0.55, MID), (1.0, DEEP)]
    for y in range(H):
        t = y / (H - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                d.line([(0, y), (W, y)],
                       fill=tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3)))
                break
    return im


def sash(width_frac=0.16, angle=38):
    m = Image.new("L", (W * 3, W * 3), 0)
    bw = int(H * width_frac)
    m.paste(Image.new("L", (W * 3, bw), 255), (0, (W * 3 - bw) // 2))
    m = m.rotate(angle, resample=Image.BICUBIC)
    left, top = (W * 3 - W) // 2, (W * 3 - H) // 2
    return m.crop((left, top, left + W, top + H))


def wrap(text, font, max_w, draw):
    words, lines, line = text.split(), [], ""
    for w in words:
        t = f"{line} {w}".strip()
        if draw.textlength(t, font=font) <= max_w:
            line = t
        else:
            if not line:
                return None
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def fit(text, max_w, max_lines, budget_h):
    """
    The largest Anton that still fits.

    Pushed up until it runs out of width, runs out of lines, or runs out
    of the height it has been given. Sized rather than fixed because the
    captions are different lengths and a fixed size would leave the short
    ones small for no reason.
    """
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    best = None
    for size in range(80, 340, 2):
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


def badge(im, text):
    """
    The small label above the caption.

    A pill in the ink colour with the type knocked out of it, which sits
    on the bright ground without competing with the headline. Letter
    spaced, because a short line in caps needs air to read as a label
    rather than as a word that got shrunk.
    """
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(INTER, 40)
    up = text.upper()
    track = 6
    w = sum(d.textlength(c, font=f) for c in up) + track * (len(up) - 1)
    pad_x, pad_y = 44, 24
    h = 40 + pad_y * 2
    x0 = (W - (w + pad_x * 2)) / 2
    d.rounded_rectangle([x0, BADGE_TOP, x0 + w + pad_x * 2, BADGE_TOP + h],
                        radius=h // 2, fill=INK)
    x = x0 + pad_x
    y = BADGE_TOP + (h - 46) / 2
    for c in up:
        d.text((x, y), c, font=f, fill=(150, 250, 200))
        x += d.textlength(c, font=f) + track
    return im


def compose(path, caption_text, badge_text=None):
    shot = Image.open(path).convert("RGB")
    if shot.size != (W, H):
        raise SystemExit(
            f"\n{os.path.basename(path)} is {shot.size[0]} by {shot.size[1]}.\n"
            f"It has to be {W} by {H}, which is what an iPhone 16 or 17 Pro Max\n"
            f"screenshot already is. Do not resize it. Take it again on the right phone.\n"
        )
    if STRIP_STATUS_BAR:
        shot = shot.crop((0, STATUS_BAR_H, W, H))

    im = wash()
    im = Image.composite(Image.new("RGB", (W, H), (120, 252, 190)), im,
                         sash().point(lambda v: int(v * 0.26)))

    if badge_text:
        im = badge(im, badge_text)

    d = ImageDraw.Draw(im)
    f, lines, lh = fit(caption_text.upper(), W - 130, CAP_LINES, CAP_BUDGET)
    y = CAP_TOP
    for ln in lines:
        d.text(((W - d.textlength(ln, font=f)) / 2, y), ln, font=f, fill=INK)
        y += lh

    sh = int(SHOT_W * shot.size[1] / shot.size[0])
    small = shot.resize((SHOT_W, sh), Image.LANCZOS)
    mask = rounded_mask((SHOT_W, sh), CORNER)
    x = (W - SHOT_W) // 2

    # a shadow, so the screen sits on the ground rather than in it
    sha = Image.new("L", (W, H), 0)
    sha.paste(mask, (x, SHOT_TOP + 34))
    sha = sha.filter(ImageFilter.GaussianBlur(52)).point(lambda v: int(v * 0.55))
    im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sha)
    im.paste(small, (x, SHOT_TOP), mask)
    return im


def contact(frames, path):
    """Every frame side by side, and again at the size it is first seen."""
    big_h, thumb_h, pad = 900, 250, 32
    big_w, thumb_w = int(W * big_h / H), int(W * thumb_h / H)
    sheet = Image.new(
        "RGB",
        (pad + len(frames) * (big_w + pad), pad + big_h + 34 + thumb_h + pad),
        (20, 22, 21))
    d = ImageDraw.Draw(sheet)
    label = ImageFont.truetype(INTER, 18)
    for i, (name, im) in enumerate(frames):
        x = pad + i * (big_w + pad)
        sheet.paste(im.resize((big_w, big_h), Image.LANCZOS), (x, pad))
        d.text((x, pad + big_h + 6), name, font=label, fill=(230, 237, 233))
        sheet.paste(im.resize((thumb_w, thumb_h), Image.LANCZOS), (x, pad + big_h + 32))
    sheet.save(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default="en")
    ap.add_argument("--only", default=None, help="one frame, by its raw file stem")
    args = ap.parse_args()

    with open(os.path.join(HERE, f"captions.{args.lang}.json"), encoding="utf8") as fh:
        captions = json.load(fh)

    os.makedirs(OUT, exist_ok=True)
    frames = []
    for name in sorted(os.listdir(RAW)):
        if not name.lower().endswith(".png"):
            continue
        stem = os.path.splitext(name)[0]
        if args.only and stem != args.only:
            continue
        if stem not in captions:
            print(f"  {stem}: no caption in captions.{args.lang}.json, skipped")
            continue
        entry = captions[stem]
        im = compose(os.path.join(RAW, name), entry["line"], entry.get("badge"))
        im.convert("RGB").save(os.path.join(OUT, f"{stem}.png"))
        frames.append((stem, im))
        print(f"  {stem:14} {entry.get('badge', ''):24} {entry['line']}")

    if frames:
        contact(frames, os.path.join(OUT, "contact-sheet.png"))
        n = len(frames)
        print(f"\n{n} frame{'' if n == 1 else 's'} and a contact sheet in {OUT}")
    else:
        print(f"\nNothing in {RAW}. Put the captures there, named to match "
              f"captions.{args.lang}.json.")


if __name__ == "__main__":
    main()
