#!/usr/bin/env python3
"""Erase EVERYTHING written on a card / support picture (PROGRESS ▶️ "เขียนใหม่ทั้งใบ" · owner 2026-11-02).
The web writes it all back as real text (js/app.js redraw · cards.json / support.json "redraw": true):
card name, HP + heart, 1 IN X pill, ability name, ability text, swords, ATK, ×N, ★ · support: name, ability name,
ability text, the green SUPPORT word, ×N.

    python3 tools/erase_all.py <id>=<picture> [<id>=<picture> …] [--crop index|deck] [--rar] [--fast] [--dry] [--out <folder>] [--sheet out.jpg]

- <picture>: a game screenshot (2400×1080, with --crop) or a picture already cut to the card's inner face (600×840)
  · --crop index: the Index page, x 527–973 y 228–848 · --crop deck: the Deck page's big card, x 899–1501 y 121–959
    (sharper · supports) · any rarity works (everything is erased) but nothing may cover the card (pop-ups, stars)
- the id says card or support (data/cards.json / data/support.json) → images/cards|support/rd/<id>.webp (600×840, webp 88)
  + rd/thumb/<id>.webp (300×420) · then in the data: "redraw": true + "image": "images/cards/rd/<id>.webp" (this tool does
  not touch the JSON) · the old picture stays where it was: a page still running the old site version keeps showing it
  (owner 2026-11-02: an old cached page showed the erased picture with nothing written on it)
- mask: letters = bright pixels next to their own dark outline (so a white robe / gold armour under the text stays),
  coloured numbers by colour (HP green, ATK red, SUPPORT green), the ability name by its lilac colour (as wide as it goes),
  the 1 IN X pill as the white pill it is, heart / swords by shape colours · every part grown a few px for its shadow
- fill: OpenCV FSR_BEST (~2–3 min a card · several ids run in parallel) · --fast = FSR_FAST (seconds, rougher)
- --rar: the picture is above Normal → also erase the rarity pill under the 1 IN X pill (same for every id of the run)
- --out <folder>: write <folder>/<id>.webp + <folder>/thumb/ instead of images/ (look first, copy after)
- --sheet: original | mask | result for every id (look at it before committing) · --dry: write no pictures
Needs: pip install opencv-contrib-python-headless pillow numpy
"""
import json, os, sys, time
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 600, 840
CROPS = {"index": (527, 228, 973, 848), "deck": (899, 121, 1501, 959)}


def K(n):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * n + 1, 2 * n + 1))


def mask_of(a, support, rar=False):
    """a = BGR uint8 600×840 → uint8 mask (255 = erase)."""
    b, g, r = [a[..., i].astype(int) for i in range(3)]
    mn, mx = a.min(2).astype(int), a.max(2).astype(int)
    dark = (mx < 60).astype(np.uint8) * 255
    near_dark = cv2.dilate(dark, K(4)) > 0                 # letters carry a dark outline / shadow
    bright = mn > 150
    letter = bright & near_dark
    green = (g > 110) & (g - r > 35) & (g - b > 20)
    red = (r > 150) & (r - g > 70) & (r - b > 50)
    lilac = (r > 140) & (b > 160) & (mx - mn > 40) & (g < 175)
    m = np.zeros((H, W), np.uint8)

    def box(x0, y0, x1, y1, cond, grow, shadow=True):
        sub = np.zeros((H, W), np.uint8)
        sub[y0:y1, x0:x1][cond[y0:y1, x0:x1]] = 255
        out = cv2.dilate(sub, K(grow))
        if shadow:                                          # the dark outline / drop shadow right around the letters
            near = cv2.dilate(sub, K(grow + 4)) > 0
            sh = np.zeros((H, W), np.uint8); sh[near & (dark > 0)] = 255
            out |= cv2.dilate(sh, K(2))
        return out

    m |= box(0, 0, 330, 84, letter, 6)                      # card name (top-left)
    # ability name: lilac letters, as far right as they go (long names reach past the middle)
    band = lilac[455:535]
    cols = np.where(band.sum(0) > 2)[0]
    x1 = int(min(W, cols.max() + 16)) if cols.size else 300
    m |= box(0, 455, x1, 535, lilac | letter, 7)
    if support:
        m |= box(10, 528, 590, 728, letter, 5)              # ability text (+ Mutation line)
        m |= box(150, 728, 450, 830, green, 7)              # SUPPORT
        m |= box(440, 745, 600, 820, letter, 6)             # ×N
    else:
        m |= box(180, 0, 560, 96, green, 7)                 # HP (a long number starts left of the middle)
        m |= box(495, 6, 600, 96, red | bright, 7, False)   # heart
        m |= box(10, 528, 590, 712, letter, 5)              # ability text
        swd = (mn > 110) | red | ((r > 150) & (g > 90) & (b < 110))   # blade, red grip, gold guard
        m |= box(10, 726, 122, 828, swd, 5, False)          # swords
        m |= box(140, 728, 460, 822, red, 7)                # ATK (a 9-digit number starts far left)
        m |= box(430, 745, 600, 822, letter | bright, 6)    # ×N
    # 1 IN X pill: the white pill right of the art (longer odds = wider pill)
    pill = (mn > 200)[108:174, 360:600].sum(0)
    pc = np.where(pill > 10)[0]
    px0 = 360 + int(pc.min()) - 8 if pc.size else 470
    cv2.rectangle(m, (px0, 106), (596, 176), 255, -1)
    if rar: cv2.rectangle(m, (px0 - 10, 174), (596, 232), 255, -1)   # rarity pill under it (a mutated card's picture)
    m[0:18, 560:600] = 255                                  # frame corner bit
    return m


def load(path, crop):
    im = Image.open(path).convert("RGB")
    if crop: im = im.crop(CROPS[crop])
    if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
    return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)


def kind_of(i):
    cards = {c["id"] for c in json.load(open(os.path.join(ROOT, "data", "cards.json")))}
    s = json.load(open(os.path.join(ROOT, "data", "support.json")))
    sup = {x["id"] for x in (s["support"] if isinstance(s, dict) else s)}
    if i in cards: return "card"
    if i in sup: return "support"
    raise SystemExit(f"unknown id: {i}")


def work(job):
    i, path, crop, fast, dry, support, rar, outdir = job
    t = time.time()
    a = load(path, crop)
    m = mask_of(a, support, rar)
    o = np.zeros_like(a)
    cv2.xphoto.inpaint(a, 255 - m, o, cv2.xphoto.INPAINT_FSR_FAST if fast else cv2.xphoto.INPAINT_FSR_BEST)
    res = Image.fromarray(cv2.cvtColor(o, cv2.COLOR_BGR2RGB))
    if not dry:
        folder = outdir or os.path.join(ROOT, "images", "support" if support else "cards", "rd")
        os.makedirs(os.path.join(folder, "thumb"), exist_ok=True)
        res.save(os.path.join(folder, i + ".webp"), "WEBP", quality=88, method=6)
        res.resize((300, 420), Image.LANCZOS).save(os.path.join(folder, "thumb", i + ".webp"), "WEBP", quality=85, method=6)
    return i, a, m, o, round(time.time() - t)


def main(argv):
    flags = {"--fast": False, "--dry": False, "--rar": False}
    crop, sheet, outdir, jobs = None, None, None, []
    it = iter(argv)
    for x in it:
        if x in flags: flags[x] = True
        elif x == "--crop": crop = next(it)
        elif x == "--sheet": sheet = next(it)
        elif x == "--out": outdir = next(it)
        elif "=" in x:
            i, p = x.split("=", 1)
            jobs.append((i, p, kind_of(i) == "support"))
        else: raise SystemExit(__doc__)
    if not jobs: raise SystemExit(__doc__)
    jobs = [(i, p, crop, flags["--fast"], flags["--dry"], s, flags["--rar"], outdir) for i, p, s in jobs]   # flags may come after the ids
    out = []
    with ProcessPoolExecutor(max_workers=min(len(jobs), os.cpu_count() or 2)) as ex:
        for r in ex.map(work, jobs):
            print(r[0], "secs", r[4], flush=True); out.append(r)
    if sheet:
        tw, th = 200, 280
        s = Image.new("RGB", (tw * 3, th * len(out)), (30, 30, 30))
        for k, (i, a, m, o, _) in enumerate(out):
            ov = a.copy(); ov[m > 0] = (ov[m > 0] * 0.35 + np.array([0, 0, 255]) * 0.65).astype(np.uint8)
            for j, x in enumerate((a, ov, o)):
                s.paste(Image.fromarray(cv2.cvtColor(x, cv2.COLOR_BGR2RGB)).resize((tw, th)), (j * tw, k * th))
        s.save(sheet, quality=85)


if __name__ == "__main__":
    main(sys.argv[1:])
