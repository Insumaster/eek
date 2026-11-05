# Draws the EEK pixel logo: each letter is a 7x7 square of green shades with the letter in gold shades.
# Writes favicon.svg (a single E), the Made by EEK stickers in assets/brand/ and puts the EEK word
# into the header of every page.
# Run from the repo root: python3 tools/logo.py   (then re-render the PNG icons from favicon.svg)
import glob, re

LETTERS = {
    "E": ["11111", "10000", "11110", "10000", "11111"],
    "K": ["10001", "10010", "11100", "10010", "10001"],
}
GREENS = ["#1e5c3a", "#22653f", "#1a5334", "#266e44"]
GOLDS = ["#f2c14e", "#f6cc62", "#e9b343", "#fad575"]


def tile(letter, ox, seed, oy=0, unit=1):
    rects = []
    for y in range(7):
        for x in range(7):
            row = LETTERS[letter][y - 1] if 1 <= y <= 5 else ""
            on = 1 <= x <= 5 and row and row[x - 1] == "1"
            shade = ((x + seed) * 3 + y * 5 + (x + seed) * y) % 7 % 4
            rects.append(f'<rect x="{ox + x * unit}" y="{oy + y * unit}" width="{unit}" height="{unit}" fill="{(GOLDS if on else GREENS)[shade]}"/>')
    return "".join(rects)


def word(text, height=26):
    width = len(text) * 8 - 1  # 7 per letter, 1 between
    body = "".join(tile(ch, i * 8, i * 2) for i, ch in enumerate(text))
    return (f'<svg class="mark" viewBox="0 0 {width} 7" width="{height * width // 7}" height="{height}" '
            f'shape-rendering="crispEdges" role="img" aria-label="{text}">{body}</svg>')


# "MADE BY" in a 5x5 pixel font, for the sticker.
FONT = {
    "M": ["10001", "11011", "10101", "10001", "10001"], "A": ["01110", "10001", "11111", "10001", "10001"],
    "D": ["11110", "10001", "10001", "10001", "11110"], "E": ["11111", "10000", "11110", "10000", "11111"],
    "B": ["11110", "10001", "11110", "10001", "11110"], "Y": ["10001", "01010", "00100", "00100", "00100"],
}
INK = "#e8ece8"
PANEL, EDGE = "#0a110d", "#6dc678"


def text(t, ox, oy, unit=1):
    rects, x = [], ox
    for ch in t:
        if ch == " ":
            x += 3 * unit
            continue
        for y, row in enumerate(FONT[ch]):
            for i, v in enumerate(row):
                if v == "1":
                    rects.append(f'<rect x="{x + i * unit}" y="{oy + y * unit}" width="{unit}" height="{unit}" fill="{INK}"/>')
        x += 6 * unit
    return "".join(rects), x - unit - ox


def panel(w, h):
    # Dark sticker with a 1-pixel green edge and cut-off corners, like a pixel badge.
    return (f'<path fill="{EDGE}" d="M1 0h{w - 2}v1h1v{h - 2}h-1v1H1v-1H0V1h1z"/>'
            f'<path fill="{PANEL}" d="M2 1h{w - 4}v1h1v{h - 4}h-1v1H2v-1H1V2h1z"/>')


def sticker(stacked=False):
    if stacked:
        words, tw = text("MADE BY", 0, 0)
        ew = 3 * 16 - 2  # EEK at 2x
        w = max(tw, ew) + 8
        h = 4 + 5 + 3 + 14 + 4
        words, _ = text("MADE BY", (w - tw) // 2, 4)
        eek = "".join(tile(ch, (w - ew) // 2 + i * 16, i * 2, 12, 2) for i, ch in enumerate("EEK"))
    else:
        _, tw = text("MADE BY", 0, 0)
        w, h = 4 + tw + 4 + 23 + 4, 11
        words, _ = text("MADE BY", 4, 3)
        eek = "".join(tile(ch, 4 + tw + 4 + i * 8, i * 2, 2) for i, ch in enumerate("EEK"))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w * 8}" height="{h * 8}" '
            f'shape-rendering="crispEdges" role="img" aria-label="Made by EEK">{panel(w, h)}{words}{eek}</svg>\n')


if __name__ == "__main__":
    with open("favicon.svg", "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7" shape-rendering="crispEdges">\n{tile("E", 0, 0)}\n</svg>\n')
    import os
    os.makedirs("assets/brand", exist_ok=True)
    for name, stacked in (("made-by-eek", False), ("made-by-eek-stacked", True)):
        with open(f"assets/brand/{name}.svg", "w") as f:
            f.write(sticker(stacked))
    logo = word("EEK")
    for page in glob.glob("*.html") + glob.glob("*/*.html"):
        s = open(page).read()
        # The home and partner pages: the pixel word replaces the text EEK. Game pages: pixel word + PIXEL GAMES.
        s = re.sub(r'<svg class="mark".*?</svg>(EEK |PIXEL GAMES <small>by EEK</small>|PIXEL GAMES)?',
                   lambda m: logo + ("PIXEL GAMES" if m.group(1) and "PIXEL" in m.group(1) else ""), s, count=1)
        open(page, "w").write(s)
