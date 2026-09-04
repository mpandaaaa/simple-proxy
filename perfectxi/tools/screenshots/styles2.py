"""
Two refined frames. Louder, in caps, and with the screen bleeding.

What changed from the first three:

  the caption is uppercase, which is what Anton is for, and it is set
  tight so two lines read as one block rather than two sentences
  the little gold dash is gone. It was too small to be a device and read
  as a stray mark
  the screen is larger and runs off the bottom edge, so the frame is a
  window into the game rather than a slide about it
  the status bar is cleaned to 9:41 on a full battery before anything
  else happens
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from statusbar import crop

W, H = 1320, 2868
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")
INTER = os.path.join(ROOT, "node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf")

INK    = (6, 11, 8)
BRIGHT = (64, 238, 162)
MID    = (26, 190, 124)
DEEP   = (8, 84, 55)


def vgrad(stops, h=H, w=W):
    """A wash through several colours, given as (position, colour)."""
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                k = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                c = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(3))
                d.line([(0, y), (w, y)], fill=c)
                break
    return im


def sash(width_frac=0.20, angle=38, top_bias=0):
    m = Image.new("L", (W * 3, W * 3), 0)
    bw = int(H * width_frac)
    m.paste(Image.new("L", (W * 3, bw), 255), (0, (W * 3 - bw) // 2 + top_bias))
    m = m.rotate(angle, resample=Image.BICUBIC)
    left = (W * 3 - W) // 2
    top = (W * 3 - H) // 2
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
            lines.append(line); line = w
    if line:
        lines.append(line)
    return lines


def fit(text, max_w, max_lines, budget_h, leading=0.88):
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    best = None
    for size in range(80, 340, 2):
        f = ImageFont.truetype(ANTON, size)
        ls = wrap(text, f, max_w, probe)
        if ls is None or len(ls) > max_lines:
            break
        lh = int(size * leading)
        if lh * len(ls) > budget_h:
            break
        best = (f, ls, lh)
    if best is None:
        f = ImageFont.truetype(ANTON, 80)
        best = (f, wrap(text, f, max_w, probe) or [text], 72)
    return best


def caption(im, text, colour, top, budget):
    d = ImageDraw.Draw(im)
    f, lines, lh = fit(text.upper(), W - 130, 2, budget)
    y = top
    for ln in lines:
        w = d.textlength(ln, font=f)
        d.text(((W - w) / 2, y), ln, font=f, fill=colour)
        y += lh
    return im, y


def rounded_mask(size, radius):
    m = Image.new("L", (size[0] * 2, size[1] * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * 2, size[1] * 2], radius=radius * 2, fill=255)
    return m.resize(size, Image.LANCZOS)


def place_bleeding(im, shot, shot_w, top, corner=64, shadow=0.7):
    """The screen, larger than the space it has, running off the bottom."""
    sh = int(shot_w * shot.size[1] / shot.size[0])
    small = shot.resize((shot_w, sh), Image.LANCZOS)
    mask = rounded_mask((shot_w, sh), corner)
    x = (W - shot_w) // 2
    sha = Image.new("L", (W, H), 0)
    sha.paste(mask, (x, top + 34))
    sha = sha.filter(ImageFilter.GaussianBlur(52)).point(lambda v: int(v * shadow))
    im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sha)
    im.paste(small, (x, top), mask)
    return im


# ---------- R1: bright all the way down ----------
def r1(shot, text):
    im = vgrad([(0.0, BRIGHT), (0.55, MID), (1.0, DEEP)])
    im = Image.composite(Image.new("RGB", (W, H), (120, 252, 190)), im,
                         sash(0.16).point(lambda v: int(v * 0.26)))
    im, _ = caption(im, text, INK, 150, 640)
    return place_bleeding(im, shot, 1080, 840, shadow=0.55)


# ---------- R2: bright at the top, dark where the screen sits ----------
def r2(shot, text):
    im = vgrad([(0.0, BRIGHT), (0.26, MID), (0.42, DEEP), (0.62, (7, 34, 24)), (1.0, (6, 14, 10))])
    im = Image.composite(Image.new("RGB", (W, H), (130, 255, 196)), im,
                         sash(0.13, top_bias=-int(H * 0.30)).point(lambda v: int(v * 0.30)))
    im, _ = caption(im, text, INK, 150, 640)
    return place_bleeding(im, shot, 1080, 840, shadow=0.85)


STYLES = {"R1": r1, "R2": r2}


if __name__ == "__main__":
    raw = Image.open(os.path.join(HERE, "raw", "01-home.png")).convert("RGB")
    shot = crop(raw)
    text = "Draft football's greatest XI"
    ims = [(k, f(shot.copy(), text)) for k, f in STYLES.items()]

    big_h, thumb_h, pad = 1250, 320, 44
    big_w = int(W * big_h / H); thumb_w = int(W * thumb_h / H)
    sheet = Image.new("RGB", (pad + len(ims) * (big_w + pad), pad + big_h + 40 + thumb_h + pad),
                      (20, 22, 21))
    d = ImageDraw.Draw(sheet)
    label = ImageFont.truetype(INTER, 22)
    for i, (k, im) in enumerate(ims):
        x = pad + i * (big_w + pad)
        sheet.paste(im.resize((big_w, big_h), Image.LANCZOS), (x, pad))
        d.text((x, pad + big_h + 8), k, font=label, fill=(230, 237, 233))
        sheet.paste(im.resize((thumb_w, thumb_h), Image.LANCZOS), (x, pad + big_h + 40))
        im.convert("RGB").save(os.path.join(HERE, "out", f"style-{k}.png"))
    sheet.save(os.path.join(HERE, "out", "styles2.png"))
    print("R1 and R2 written")
