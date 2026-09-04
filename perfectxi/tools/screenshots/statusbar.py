"""
The status bar, dealt with.

Two ways, and the default is the honest one.

The first attempt drew a replacement bar: 9:41, full signal, full
battery, the way every capture pipeline forces it. It read as fake
immediately, and it always will. iOS glyphs are drawn by Apple and a
hand made battery next to a real one is obvious even to somebody who
could not say why.

So the default now is to crop it off. A frame with no status bar cannot
have a status bar that looks wrong, and it gives the app screen the
whole frame. Plenty of App Store listings do exactly this.

The drawn version is kept below for anyone who wants it, and there is a
third way that beats both: set the phone Date and Time by hand to 9:41,
charge it to full, and capture. Then the bar is real because it is real.

A clean status bar, drawn over the one the phone happened to have.

Every marketing screenshot Apple has ever published says 9:41 with a full
battery, and every capture pipeline forces it, because a half empty
battery and a real clock date the image and pull the eye to the corner.
The simulator does this with a status bar override. There is no simulator
on Windows, so it is done here instead.

This paints over the system status bar only. It never touches a pixel of
the app, which is the line that matters: the app must be shown as it is.
What time the phone said is not the app.
"""

from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
INTER_BOLD = os.path.join(ROOT, "node_modules/@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf")

BAR_H = 185          # measured off a real 1320 by 2868 capture
TIME_CX = 210        # the middle of the left ear
GLYPH_CY = 112
RIGHT_END = 1200


def clean(shot, time_text="9:41"):
    im = shot.copy()
    w, _ = im.size
    d = ImageDraw.Draw(im)

    bg = im.getpixel((8, 8))
    ink = (255, 255, 255)
    d.rectangle([0, 0, w, BAR_H], fill=bg)

    # ---- the time ----
    f = ImageFont.truetype(INTER_BOLD, 58)
    b = d.textbbox((0, 0), time_text, font=f)
    d.text((TIME_CX - (b[2] - b[0]) / 2 - b[0], GLYPH_CY - (b[3] - b[1]) / 2 - b[1]),
           time_text, font=f, fill=ink)

    # ---- battery, at the right hand end ----
    bw, bh = 76, 38
    bx1, by1 = RIGHT_END - bw, GLYPH_CY - bh // 2
    d.rounded_rectangle([bx1, by1, RIGHT_END, by1 + bh], radius=11, outline=ink, width=4)
    d.rounded_rectangle([RIGHT_END + 5, GLYPH_CY - 9, RIGHT_END + 11, GLYPH_CY + 9],
                        radius=3, fill=ink)
    d.rounded_rectangle([bx1 + 7, by1 + 7, RIGHT_END - 7, by1 + bh - 7], radius=6, fill=ink)

    # ---- wifi, three arcs and a dot ----
    wx = bx1 - 30
    cy = GLYPH_CY + 15
    for i, r in enumerate((14, 27, 40)):
        d.arc([wx - r, cy - r, wx + r, cy + r], start=225, end=315,
              fill=ink, width=6 if i else 7)
    d.ellipse([wx - 5, cy - 5, wx + 5, cy + 5], fill=ink)

    # ---- cellular, four bars ----
    x = wx - 48 - 6
    barw, gap = 11, 8
    for i in range(4):
        h = 14 + i * 9
        bx = x - (3 - i) * (barw + gap)
        d.rounded_rectangle([bx, GLYPH_CY + 17 - h, bx + barw, GLYPH_CY + 17],
                            radius=3, fill=ink)
    return im


def crop(shot):
    """
    Take the status bar off.

    The band is the same height on every 1320 by 2868 capture, and the
    app never draws in it, so this removes the system bar and nothing
    belonging to the app.
    """
    w, h = shot.size
    return shot.crop((0, BAR_H, w, h))
