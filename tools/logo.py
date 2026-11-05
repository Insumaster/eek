# Draws the EEK pixel logo: each letter is a 7x7 square of green shades with the letter in gold shades.
# Writes favicon.svg (a single E) and puts the EEK word into the header of every page.
# Run from the repo root: python3 tools/logo.py   (then re-render the PNG icons from favicon.svg)
import glob, re

LETTERS = {
    "E": ["11111", "10000", "11110", "10000", "11111"],
    "K": ["10001", "10010", "11100", "10010", "10001"],
}
GREENS = ["#1e5c3a", "#22653f", "#1a5334", "#266e44"]
GOLDS = ["#f2c14e", "#f6cc62", "#e9b343", "#fad575"]


def tile(letter, ox, seed):
    rects = []
    for y in range(7):
        for x in range(7):
            row = LETTERS[letter][y - 1] if 1 <= y <= 5 else ""
            on = 1 <= x <= 5 and row and row[x - 1] == "1"
            shade = ((x + seed) * 3 + y * 5 + (x + seed) * y) % 7 % 4
            rects.append(f'<rect x="{ox + x}" y="{y}" width="1" height="1" fill="{(GOLDS if on else GREENS)[shade]}"/>')
    return "".join(rects)


def word(text, height=26):
    width = len(text) * 8 - 1  # 7 per letter, 1 between
    body = "".join(tile(ch, i * 8, i * 2) for i, ch in enumerate(text))
    return (f'<svg class="mark" viewBox="0 0 {width} 7" width="{height * width // 7}" height="{height}" '
            f'shape-rendering="crispEdges" role="img" aria-label="{text}">{body}</svg>')


if __name__ == "__main__":
    with open("favicon.svg", "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7" shape-rendering="crispEdges">\n{tile("E", 0, 0)}\n</svg>\n')
    logo = word("EEK")
    for page in glob.glob("*.html") + glob.glob("*/*.html"):
        s = open(page).read()
        # The home and partner pages: the pixel word replaces the text EEK. Game pages: pixel word + PIXEL GAMES.
        s = re.sub(r'<svg class="mark".*?</svg>(EEK |PIXEL GAMES <small>by EEK</small>|PIXEL GAMES)?',
                   lambda m: logo + ("PIXEL GAMES" if m.group(1) and "PIXEL" in m.group(1) else ""), s, count=1)
        open(page, "w").write(s)
