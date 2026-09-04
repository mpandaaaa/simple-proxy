"""
The wreath, with something written inside it.

Same shape as an awards seal because that shape reads as "this is worth
noticing", which is the whole reason it is being used. What it must never
do is borrow the meaning as well as the shape, so:

  no stars, because a row of stars on an app screenshot reads as a rating
  no ribbons, medals or the word best
  nothing about winning, nominations, or anybody's opinion

What goes inside is a fact about the game and nothing else. A wreath
around a true statement is decoration. A wreath around a claim nobody
made is a lie with leaves on it.
"""

from PIL import Image, ImageDraw, ImageFont
import os
from laurel import wreath

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")
INTER = os.path.join(ROOT, "node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf")


def _tracked(d, text, font, cx, y, fill, track):
    w = sum(d.textlength(c, font=font) for c in text) + track * (len(text) - 1)
    x = cx - w / 2
    for c in text:
        d.text((x, y), c, font=font, fill=fill)
        x += d.textlength(c, font=font) + track
    return w


def _room(dy_px, r_px):
    """
    How wide the inside of the wreath is at a given height, in pixels.

    A circle is only full width across its middle, so sizing every line
    against the widest point puts the outer lines through the leaves.
    Everything here is pixels: the first version mixed fractions and
    pixels and collapsed every line to the smallest size it would try.
    """
    d = abs(dy_px)
    if d >= r_px:
        return 0.0
    return 2 * (r_px ** 2 - d ** 2) ** 0.5 * 0.94


def _fit_tracked(d, text, path, size, dy, r_inner, track_frac, hi, max_h):
    """
    The largest size at which this line clears the leaves and stays in
    its own row.

    Both limits are needed. Width alone lets a short line like 712 grow
    until it swallows the rows above and below it, which is what happened
    when only the width was checked.
    """
    room = _room(dy * size, r_inner * size)
    best = None
    for px in range(8, hi, 2):
        f = ImageFont.truetype(path, px)
        w = sum(d.textlength(c, font=f) for c in text) + track_frac * px * (len(text) - 1)
        b = d.textbbox((0, 0), text, font=f)
        if w > room or (b[3] - b[1]) > max_h:
            break
        best = (f, w)
    if best is None:
        f = ImageFont.truetype(path, 8)
        best = (f, sum(d.textlength(c, font=f) for c in text))
    return best


def plaque(size, big_text, small_text, colour, ground=None, eyebrow=None,
           thickness=1.0):
    """
    One badge: the wreath, a headline inside it, a label under that.

    Transparent unless a ground is given, so it can be dropped onto a
    frame that already has a background.
    """
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if ground:
        im = Image.new("RGBA", (size, size), ground + (255,))

    ink = Image.new("RGBA", (size, size), colour + (255,))
    im = Image.composite(ink, im, wreath(size, thickness=thickness))

    d = ImageDraw.Draw(im)
    cx = cy = size / 2

    # the clear circle inside the leaves, as a fraction of the whole
    R = 0.325

    big_up = big_text.upper()
    small_up = small_text.upper()
    eye_up = eyebrow.upper() if eyebrow else None

    # rows, as offsets from the middle in fractions of the size
    dy_big, dy_small, dy_eye = 0.0, 0.135, -0.150

    f_big, w_big = _fit_tracked(d, big_up, ANTON, size, dy_big, R, 0.0,
                                int(size * 0.42), size * 0.185)
    f_small, w_small = _fit_tracked(d, small_up, INTER, size, dy_small, R, 0.011,
                                    int(size * 0.075), size * 0.052)
    if eye_up:
        f_eye, w_eye = _fit_tracked(d, eye_up, INTER, size, dy_eye, R, 0.012,
                                    int(size * 0.062), size * 0.044)

    b = d.textbbox((0, 0), big_up, font=f_big)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]),
           big_up, font=f_big, fill=colour)

    sb = d.textbbox((0, 0), small_up, font=f_small)
    _tracked(d, small_up, f_small, cx,
             cy + dy_small * size - (sb[3] - sb[1]) / 2 - sb[1], colour, f_small.size * 0.011)

    if eye_up:
        eb = d.textbbox((0, 0), eye_up, font=f_eye)
        _tracked(d, eye_up, f_eye, cx,
                 cy + dy_eye * size - (eb[3] - eb[1]) / 2 - eb[1], colour, f_eye.size * 0.012)

    # three dots at the foot, low enough to stay clear of the label
    r = size * 0.0105
    for k in (-1, 0, 1):
        x = cx + k * size * 0.052
        y = cy + size * 0.235
        d.ellipse([x - r, y - r, x + r, y + r], fill=colour)

    return im


if __name__ == "__main__":
    OUT = r"C:\Users\44791\AppData\Local\Temp\claude\C--Users-44791-simple-proxy-perfectxi\2eae9d45-a7d5-450e-9822-2fda89ca3f77\scratchpad"
    ex = [
        ("712", "Club seasons", "The database"),
        ("35", "Years of football", "1992 to 2026"),
        ("Dynasty", "Career mode", "Decades deep"),
    ]
    S = 620
    sheet = Image.new("RGB", (S * 3 + 80, S + 40), (26, 190, 124))
    for i, (b, s, e) in enumerate(ex):
        p = plaque(S, b, s, (6, 11, 8), eyebrow=e)
        sheet.paste(p, (20 + i * (S + 20), 20), p)
    sheet.save(os.path.join(OUT, "plaque-check.png"))
    print("plaques drawn")
