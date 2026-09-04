"""
A laurel wreath, drawn from scratch.

Drawn rather than borrowed on purpose. The wreath that prompted this is
Best Mobile App Awards' own logo, and using somebody's mark is a separate
problem from claiming their award.

It is decoration here, not an accolade. What sits inside it is a fact
about the game, never a prize, a rating or a review, because a wreath
around a claim nobody made is the one way this device goes wrong.

Angles below are PIL's, not the ones from school: measured from three
o'clock and increasing clockwise, so ninety is the bottom of the circle
and two hundred and seventy is the top. Getting that backwards is what
put the gap on the right hand side the first time.
"""

from PIL import Image, ImageDraw
import math

SS = 4                 # everything is drawn at four times size and reduced


def _leaf(w, h, rotation):
    """One leaf: an upright ellipse, turned to lie along the branch."""
    pad = int(max(w, h))
    im = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    ImageDraw.Draw(im).ellipse([pad, pad, pad + w, pad + h], fill=255)
    return im.rotate(rotation, resample=Image.BICUBIC, expand=True)


def wreath(size, leaves=13, radius_frac=0.38, gap_deg=54, thickness=1.0):
    """
    The wreath, as a mask.

    gap_deg is the opening left at the top, which is what stops it reading
    as a closed ring. Leaves taper toward both tips because a laurel that
    is the same all the way round reads as a cog.
    """
    big = size * SS
    m = Image.new("L", (big, big), 0)
    cx = cy = big / 2
    r = big * radius_frac

    start = 270 + gap_deg / 2          # just clockwise of the top
    sweep = 360 - gap_deg

    # the stem the leaves grow off
    d = ImageDraw.Draw(m)
    d.arc([cx - r, cy - r, cx + r, cy + r],
          start=start, end=start + sweep,
          fill=255, width=max(2, int(big * 0.008 * thickness)))

    for i in range(leaves * 2 + 1):
        t = i / (leaves * 2)
        p = start + t * sweep
        rad = math.radians(p)
        x = cx + math.cos(rad) * r
        y = cy + math.sin(rad) * r

        # full through the middle of each branch, small at the tips and
        # where the two branches meet at the bottom
        along = abs(t - 0.5) * 2                     # 0 at the bottom, 1 at a tip
        taper = 0.42 + 0.58 * math.sin(math.pi * (1 - along) ** 0.55)
        lw = int(big * 0.048 * taper * thickness)
        lh = int(big * 0.105 * taper * thickness)
        if lw < 2 or lh < 2:
            continue

        # leaves lean outward and toward the tip of their own branch
        side = -1 if t < 0.5 else 1
        theta = p + side * 46
        leaf = _leaf(lw, lh, 90 - theta)
        m.paste(leaf, (int(x - leaf.width / 2), int(y - leaf.height / 2)), leaf)

    return m.resize((size, size), Image.LANCZOS)
