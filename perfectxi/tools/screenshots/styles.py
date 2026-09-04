"""
Three louder treatments for the screenshot frames.

The first attempt put a white caption on near black. It was tasteful and
it was invisible: a dark frame next to the store's own dark chrome has
nothing to separate it, which is the exact failure the research warned
about when it said an all dark set reads heavy and blends together.

All three of these do the same three things differently: put a saturated
ground behind the app screen so the screen itself becomes the bright
object, push the caption until it survives being a thumbnail, and let the
screen bleed off the bottom edge so the frame feels like a window into
something rather than a slide about it.

The diagonal sash is carried over from the app icon on purpose. Somebody
who sees the store page and then the icon on their home screen should be
able to tell they are the same thing.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import os

W, H = 1320, 2868
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ANTON = os.path.join(ROOT, "node_modules/@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf")

INK     = (7, 12, 9)
WHITE   = (245, 250, 247)
EMERALD = (31, 197, 126)
BRIGHT  = (58, 232, 156)
DEEP    = (9, 92, 60)
PITCH   = (12, 66, 44)
GOLD    = (214, 178, 94)


def vgrad(c1, c2, h=H, w=W, power=1.0):
    g = Image.new("L", (w, h))
    px = g.load()
    for y in range(h):
        v = int(255 * (y / h) ** power)
        for x in range(w):
            px[x, y] = v
    return Image.composite(Image.new("RGB", (w, h), c2), Image.new("RGB", (w, h), c1), g)


def sash(width_frac=0.30, angle=38):
    m = Image.new("L", (W * 3, W * 3), 0)
    bw = int(H * width_frac)
    strip = Image.new("L", (W * 3, bw), 255)
    m.paste(strip, (0, (W * 3 - bw) // 2))
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


def fit(text, max_w, max_lines, budget_h):
    probe = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    best = None
    for size in range(70, 300, 2):
        f = ImageFont.truetype(ANTON, size)
        ls = wrap(text, f, max_w, probe)
        if ls is None or len(ls) > max_lines:
            break
        lh = int(size * 1.0)
        if lh * len(ls) > budget_h:
            break
        best = (f, ls, lh)
    if best is None:
        f = ImageFont.truetype(ANTON, 70)
        best = (f, wrap(text, f, max_w, probe) or [text], 72)
    return best


def rounded_mask(size, radius):
    m = Image.new("L", (size[0] * 2, size[1] * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * 2, size[1] * 2], radius=radius * 2, fill=255)
    return m.resize(size, Image.LANCZOS)


def place(im, shot, shot_w, top, corner=60, shadow=0.62):
    sh = int(shot_w * H / W)
    small = shot.resize((shot_w, sh), Image.LANCZOS)
    mask = rounded_mask((shot_w, sh), corner)
    x = (W - shot_w) // 2
    sha = Image.new("L", (W, H), 0)
    sha.paste(mask, (x, top + 30))
    sha = sha.filter(ImageFilter.GaussianBlur(46)).point(lambda v: int(v * shadow))
    im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, sha)
    im.paste(small, (x, top), mask)
    return im


def caption(im, text, colour, accent, top, max_w, budget, rule=True):
    d = ImageDraw.Draw(im)
    f, lines, lh = fit(text, max_w, 2, budget)
    y = top
    for ln in lines:
        w = d.textlength(ln, font=f)
        d.text(((W - w) / 2, y), ln, font=f, fill=colour)
        y += lh
    if rule:
        rw, rh = 150, 12
        d.rounded_rectangle([(W - rw) // 2, y + 40, (W + rw) // 2, y + 40 + rh],
                            radius=rh // 2, fill=accent)
    return im


# ---------- S1: emerald ground, screen bleeding off the bottom ----------
def s1(shot, text):
    im = vgrad(BRIGHT, DEEP, power=0.85)
    im = Image.composite(Image.new("RGB", (W, H), (76, 244, 172)), im,
                         sash(0.22).point(lambda v: int(v * 0.30)))
    im = caption(im, text, INK, GOLD, 150, W - 150, 620)
    return place(im, shot, 1010, 780, shadow=0.55)


# ---------- S2: pitch dark, one hard spotlight ----------
def s2(shot, text):
    im = Image.new("RGB", (W, H), PITCH)
    g = Image.new("L", (W, H), 0)
    r = int(W * 0.95)
    ImageDraw.Draw(g).ellipse([W // 2 - r, 520 - r // 2, W // 2 + r, 520 + r], fill=255)
    g = g.filter(ImageFilter.GaussianBlur(W * 0.28)).point(lambda v: int(v * 0.85))
    im = Image.composite(Image.new("RGB", (W, H), EMERALD), im, g)
    im = caption(im, text, WHITE, GOLD, 150, W - 150, 620)
    return place(im, shot, 1010, 780, shadow=0.70)


# ---------- S3: a hard split, caption on a solid block ----------
def s3(shot, text):
    im = Image.new("RGB", (W, H), INK)
    block = 800
    im.paste(vgrad(BRIGHT, EMERALD, h=block, power=1.0), (0, 0))
    d = ImageDraw.Draw(im)
    im = Image.composite(Image.new("RGB", (W, H), (86, 246, 178)),
                         im, sash(0.16).point(lambda v: int(v * 0.35)))
    # keep the sash inside the block
    keep = Image.new("L", (W, H), 0)
    ImageDraw.Draw(keep).rectangle([0, 0, W, block], fill=255)
    base = Image.new("RGB", (W, H), INK)
    base.paste(vgrad(BRIGHT, EMERALD, h=block, power=1.0), (0, 0))
    im = Image.composite(im, base, keep)
    im = caption(im, text, INK, INK, 130, W - 150, 560, rule=False)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([(W - 150) // 2, block - 96, (W + 150) // 2, block - 84], radius=6, fill=INK)
    return place(im, shot, 1050, 900, shadow=0.75)


STYLES = {"S1": s1, "S2": s2, "S3": s3}


def sheet(shot, text, path):
    ims = [(k, f(shot.copy(), text)) for k, f in STYLES.items()]
    big_h = 1150
    big_w = int(W * big_h / H)
    thumb_h = 300
    thumb_w = int(W * thumb_h / H)
    pad = 40
    sheet_w = pad + len(ims) * (big_w + pad)
    sheet_h = pad + big_h + 30 + thumb_h + pad + 30
    out = Image.new("RGB", (sheet_w, sheet_h), (20, 22, 21))
    d = ImageDraw.Draw(out)
    label = ImageFont.truetype(
        os.path.join(ROOT, "node_modules/@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"), 22)
    for i, (k, im) in enumerate(ims):
        x = pad + i * (big_w + pad)
        out.paste(im.resize((big_w, big_h), Image.LANCZOS), (x, pad))
        d.text((x, pad + big_h + 6), k, font=label, fill=(230, 237, 233))
        out.paste(im.resize((thumb_w, thumb_h), Image.LANCZOS), (x, pad + big_h + 38))
    out.save(path)
    for k, im in ims:
        im.convert("RGB").save(os.path.join(HERE, "out", f"style-{k}.png"))


if __name__ == "__main__":
    shot = Image.open(os.path.join(HERE, "raw", "01-home.png")).convert("RGB")
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    sheet(shot, "Draft football's greatest XI", os.path.join(HERE, "out", "styles.png"))
    print("three styles written")
