"""
The TikTok slideshow.

Seven 1080 by 1920 slides that send people to perfectxi.app. Built the
same way the App Store frames are: nothing here draws any part of the
game. Every card is a real capture off a real phone, cropped, and if a
screen is not good enough to show then the screen gets fixed rather than
the picture.

    python tools/social/tiktok.py

The shape is a hook, five steps and a way in, because that is the format
that gets read to the end rather than swiped past: each slide owes the
viewer one idea and one picture, and the last one owes them somewhere to
go.

Why it looks like this:

  The headline is two lines, white then emerald. One colour reads as a
  paragraph, two reads as a sentence with a point in it, and the second
  line is always the half that carries the claim.

  The card is the screenshot and nothing else. An inset diagram with a
  caption inside it is a slide about the app. A screen with its own
  corners rounded is the app.

  Every crop is a fraction of the capture's height rather than a pixel
  box, so recapturing on a taller phone does not silently reframe every
  slide.

  The line under the card is the part people screenshot. It is either
  the idea or the mistake, never a feature.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(ROOT, "tools", "screenshots", "raw")
OUT = os.path.join(HERE, "out")

FONT = os.path.join(ROOT, "node_modules/@expo-google-fonts")
ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")
INTER = f"{FONT}/inter/400Regular/Inter_400Regular.ttf"
INTER_M = f"{FONT}/inter/500Medium/Inter_500Medium.ttf"
INTER_B = f"{FONT}/inter/700Bold/Inter_700Bold.ttf"

W, H = 1080, 1920

# Straight out of src/ui/tokens.ts, so a slide and the app are the same
# green rather than two that nearly match.
BG = (10, 15, 12)
SURFACE = (16, 23, 19)
TEXT1 = (230, 237, 233)
TEXT2 = (169, 183, 175)
TEXT3 = (110, 126, 116)
EMERALD = (31, 197, 126)
GOLD = (214, 178, 94)
RED = (233, 106, 106)

SIDE = 84
CARD_W = W - SIDE * 2


def anton(pt):
    return ImageFont.truetype(ANTON, pt)


def inter(pt, weight="r"):
    return ImageFont.truetype(
        {"r": INTER, "m": INTER_M, "b": INTER_B}[weight], pt
    )


def track_width(d, text, font, extra):
    """Width of letterspaced text. Measured, because it is centred."""
    return sum(d.textlength(c, font=font) for c in text) + extra * max(0, len(text) - 1)


def track(d, x, y, text, font, fill, extra):
    """Letterspaced text, drawn from x. PIL has no tracking of its own."""
    for c in text:
        d.text((x, y), c, font=font, fill=fill)
        x += d.textlength(c, font=font) + extra


def wrap(d, text, font, maxw):
    lines, line = [], ""
    for word in text.split():
        t = f"{line} {word}".strip()
        if d.textlength(t, font=font) <= maxw:
            line = t
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def ground():
    """
    Near black, with the emerald sitting behind the headline.

    A flat panel at this size reads as a slide somebody exported. The
    glow is what makes it look lit from behind, and it is put where the
    words are rather than in the middle, so it lifts the type instead of
    the empty half.
    """
    im = Image.new("RGB", (W, H), BG)

    glow = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(glow)
    cx, cy, r = W // 2, 470, 640
    for i in range(28):
        k = i / 27
        rr = int(r * (1 - k * 0.94))
        g.ellipse([cx - rr, cy - int(rr * 0.72), cx + rr, cy + int(rr * 0.72)],
                  fill=int(9 + 42 * k))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    im = Image.composite(Image.new("RGB", (W, H), (18, 92, 62)), im, glow)

    # a second, smaller pool under the card, so the panel has something to
    # sit on rather than floating in flat black
    pool = Image.new("L", (W, H), 0)
    p = ImageDraw.Draw(pool)
    for i in range(20):
        k = i / 19
        rr = int(560 * (1 - k * 0.9))
        p.ellipse([W // 2 - rr, 1180 - int(rr * 0.42), W // 2 + rr, 1180 + int(rr * 0.42)],
                  fill=int(4 + 20 * k))
    pool = pool.filter(ImageFilter.GaussianBlur(110))
    return Image.composite(Image.new("RGB", (W, H), (14, 60, 42)), im, pool)


def rounded(size, radius):
    w, h = size
    m = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * 4 - 1, h * 4 - 1],
                                        radius=radius * 4, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def shot(name, top, bottom, width):
    """
    A slice of a real capture, by fraction of its height.

    Fractions rather than pixels so that recapturing on a different phone
    reframes nothing. Cropped to the width it is given, never stretched.
    """
    im = Image.open(os.path.join(RAW, f"{name}.png")).convert("RGB")
    w, h = im.size
    im = im.crop((0, int(h * top), w, int(h * bottom)))
    return im.resize((width, int(im.size[1] * width / im.size[0])), Image.LANCZOS)


def header(im, d):
    """The mark, small, at the top of every slide."""
    icon = Image.open(os.path.join(ROOT, "assets", "icon.png")).convert("RGB")
    icon = icon.resize((62, 62), Image.LANCZOS)
    f = anton(44)
    name, extra = "PERFECT XI", 5
    tw = track_width(d, name, f, extra)
    total = 62 + 22 + tw
    x = int((W - total) // 2)  # paste wants an int box, textlength gives a float
    im.paste(icon, (x, 74), rounded((62, 62), 16))
    track(d, x + 84, 74 + 4, name, f, TEXT1, extra)


def badge(d, y, label):
    """The step marker: an outlined pill, the way the reference does it."""
    f = inter(25, "b")
    extra = 6
    tw = track_width(d, label, f, extra)
    pw, ph = int(tw + 84), 74
    x = (W - pw) // 2
    d.rounded_rectangle([x, y, x + pw, y + ph], radius=ph // 2,
                        outline=EMERALD, width=2)
    track(d, x + 42, y + (ph - 32) // 2, label, f, EMERALD, extra)
    return y + ph


def slide(spec):
    im = ground()
    d = ImageDraw.Draw(im)
    header(im, d)

    y = badge(d, 196, spec["badge"]) + 54

    # Headline. Sized down until both lines fit the column, so a long
    # line shrinks the pair rather than running off the edge.
    for pt in range(96, 40, -2):
        f = anton(pt)
        if max(d.textlength(spec["l1"], font=f),
               d.textlength(spec["l2"], font=f)) <= CARD_W:
            break
    for text, fill in ((spec["l1"], TEXT1), (spec["l2"], EMERALD)):
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)
        y += int(pt * 1.02)

    # Anton has long descenders and the emerald line is the one people
    # read, so the gap under it is bigger than it looks like it needs.
    y += 46
    fs = inter(31)
    for ln in wrap(d, spec["sub"], fs, 850):
        d.text(((W - d.textlength(ln, font=fs)) / 2, y), ln, font=fs, fill=TEXT2)
        y += 46

    if spec.get("shot"):
        y += 44
        name, a, b = spec["shot"]
        pic = shot(name, a, b, CARD_W)

        # Whatever room is left, minus the footnote and the domain.
        #
        # A crop too tall for the room is reduced, not trimmed. Trimming
        # ends the card halfway through a table row or a player, which
        # reads as a rendering fault rather than a crop. Reducing keeps
        # the whole thing and only costs a little size, and a screenshot
        # made smaller stays sharp where one made bigger does not.
        room = 1600 - y - (96 if spec.get("foot") else 0)
        if pic.size[1] > room:
            w = int(pic.size[0] * room / pic.size[1])
            pic = pic.resize((w, room), Image.LANCZOS)

        cx = int((W - pic.size[0]) // 2)
        mask = rounded(pic.size, 30)
        sha = Image.new("L", (W, H), 0)
        sha.paste(mask, (cx, y + 16))
        sha = sha.filter(ImageFilter.GaussianBlur(30)).point(lambda v: int(v * 0.6))
        im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sha)
        im.paste(pic, (cx, y), mask)
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([cx, y, cx + pic.size[0] - 1, y + pic.size[1] - 1],
                            radius=30, outline=(38, 56, 46), width=2)
        y += pic.size[1]

    if spec.get("foot"):
        y += 46
        key, rest, col = spec["foot"]
        fk, fr = inter(25, "b"), inter(27)
        extra = 3
        kw = track_width(d, key, fk, extra) + 18
        lines = wrap(d, rest, fr, CARD_W - kw)
        x = (W - (kw + d.textlength(lines[0], font=fr))) / 2
        track(d, x, y + 2, key, fk, col, extra)
        d.text((x + kw, y), lines[0], font=fr, fill=TEXT2)
        for ln in lines[1:]:
            y += 40
            d.text(((W - d.textlength(ln, font=fr)) / 2, y), ln, font=fr, fill=TEXT2)

    f = inter(27, "b")
    extra = 9
    site = "PERFECTXI.APP"
    track(d, (W - track_width(d, site, f, extra)) / 2, 1772, site, f, EMERALD, extra)
    return im


SLIDES = [
    {
        "file": "01-hook",
        "badge": "FIVE STEPS",
        "l1": "Everyone thinks they",
        "l2": "can pick a better XI.",
        "sub": "Thirty five seasons of the Premier League and eleven shirts to "
               "fill. This is the five step version of finding out.",
        "shot": ("03-xi", 0.478, 0.826),
        "foot": ("THE CATCH", "you never choose. you get dealt five.", GOLD),
    },
    {
        "file": "02-step-one",
        "badge": "STEP ONE",
        "l1": "Spin, and take",
        "l2": "one of five.",
        "sub": "Every spin lands on one real club season and deals you five of "
               "its players. Take one, then spin again.",
        "shot": ("02-reel", 0.545, 0.925),
        "foot": ("COMMON MISTAKE", "holding out for a name instead of filling the shirt.", RED),
    },
    {
        "file": "03-step-two",
        "badge": "STEP TWO",
        "l1": "Chemistry beats",
        "l2": "the rating.",
        "sub": "Players from the same club and the same era play better "
               "together. An 85 who fits can be worth more than a 95 who does not.",
        "shot": ("01-card", 0.24, 0.68),
        "foot": ("COMMON MISTAKE", "eleven superstars who have never met.", RED),
    },
    {
        "file": "04-step-three",
        "badge": "STEP THREE",
        "l1": "Then you actually",
        "l2": "play the season.",
        "sub": "Thirty eight games on a real match engine, watched minute by "
               "minute with commentary, or skipped straight to the result.",
        "shot": ("06-match", 0.065, 0.477),
        "foot": ("THE IDEA", "simulated on real numbers, not a coin flip.", GOLD),
    },
    {
        "file": "05-step-four",
        "badge": "STEP FOUR",
        "l1": "The table does not",
        "l2": "care who you picked.",
        "sub": "Twenty clubs, thirty eight games, one final table. Champions, "
               "or seventh and a grade you will not enjoy.",
        "shot": ("05-table", 0.13, 0.532),
        "foot": ("THE CHALLENGE", "can you go 38 and 0?", GOLD),
    },
    {
        "file": "06-step-five",
        "badge": "STEP FIVE",
        "l1": "And that is one",
        "l2": "mode of eight.",
        "sub": "The Champions League, the World Cup, a cup from any era, a "
               "Dynasty career across decades, and a Daily everybody plays.",
        "shot": ("07-ucl", 0.055, 0.387),
        "foot": ("ALSO", "no account, no subscription, nothing to buy.", GOLD),
    },
    {
        "file": "07-play",
        "badge": "PLAY IT NOW",
        "l1": "Free, in your",
        "l2": "browser, right now.",
        "sub": "712 club seasons. 3,003 real players. 51 clubs. 1992 to 2026.",
        "shot": ("04-unbeaten", 0.115, 0.487),
        "foot": ("NO ACCOUNT", "no sign up, no email. open it and play.", EMERALD),
    },
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for s in SLIDES:
        im = slide(s)
        im.save(os.path.join(OUT, f"{s['file']}.png"))
        print(f"  {s['file']:16} {s['l1']} {s['l2']}")

    # a strip of all seven, for looking at the run rather than one slide
    n = len(SLIDES)
    th = 620
    tw = int(W * th / H)
    sheet = Image.new("RGB", (n * (tw + 16) + 16, th + 32), (18, 20, 19))
    for i, s in enumerate(SLIDES):
        f = Image.open(os.path.join(OUT, f"{s['file']}.png")).resize((tw, th), Image.LANCZOS)
        sheet.paste(f, (16 + i * (tw + 16), 16))
    sheet.save(os.path.join(OUT, "_run.png"))
    print(f"\n{n} slides in {OUT}, and the run at out/_run.png")


if __name__ == "__main__":
    main()
