#!/usr/bin/env python3
"""Erase the ability name and ability text from a card / support picture, letters only (PROGRESS ▶️ "แผนข้อความบนการ์ดใหม่").
The web writes them from the data instead (js/app.js cleanArt). The card name top-left, hearts, swords and the green
SUPPORT word stay in the picture (owner 2026-10-31: the name stays the game's · erase only the letters, keep the art).

    python3 tools/erase_text.py <id> [<id> …] [--dry] [--sheet out.png] [--src <folder>]

- picture: images/cards/<id>.webp or images/support/<id>.webp (600×840) → overwritten + thumb/<id>.webp (300×420)
  · --src <folder>: read <folder>/<id>.webp instead (an untouched copy) and still write to images/
- text block rows: from the first row of the purple ability name to the last row of white text above the swords / SUPPORT
- mask = the letters only: white text + the lilac ability name inside the block, grown GROW px so their dark outline and
  shadow go too · the art between the lines and around the words is kept
- fill: push-pull (masked pyramid average) from the pixels right around each letter, light blur + grain inside the mask
- --dry: write nothing · --sheet: before / after contact sheet
Needs only Pillow + numpy.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 600, 840
SEARCH = (462, 738)                  # rows where the ability name + text can be (cards) · supports stop above SUPPORT
SUP_BOTTOM = 728
PAD = 10
GROW = 6                             # px the letter mask grows (dark outline + shadow)
LETTER_MIN = 150                     # a letter pixel: every channel above this (white text, its anti-aliased edge)


def find_block(a, support):
    """(y0, y1) of the ability name + text."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mn = a.min(2)
    white = mn > 195
    purple = (r > 140) & (b > 165) & (g < 150) & (r - g > 40)
    y_lo, y_hi = SEARCH[0], (SUP_BOTTOM if support else SEARCH[1])
    pr = purple[:, 20:580].sum(1)
    top = next((y for y in range(y_lo, y_hi) if pr[y] > 12), None)
    if top is None: raise SystemExit("no purple ability name found")
    wr = white[:, 20:580].sum(1)
    rows = [y for y in range(top, y_hi) if wr[y] > 5 or pr[y] > 12]
    bottom, last = top, top
    for y in rows:                   # stop at the first gap taller than 2 text lines
        if y - last > 46: break
        bottom = last = y
    return max(0, top - PAD), min(H, bottom + PAD)


def push_pull(img, known):
    """fill unknown pixels from known ones · img float HxWx3 · known float HxW (0/1)."""
    if min(img.shape[:2]) <= 2 or known.all(): return img
    h, w = known.shape
    h2, w2 = (h + 1) // 2, (w + 1) // 2
    pi = np.zeros((h2 * 2, w2 * 2, 3)); pk = np.zeros((h2 * 2, w2 * 2))
    pi[:h, :w] = img * known[..., None]; pk[:h, :w] = known
    si = pi.reshape(h2, 2, w2, 2, 3).sum((1, 3)); sk = pk.reshape(h2, 2, w2, 2).sum((1, 3))
    small = si / np.maximum(sk, 1e-6)[..., None]
    small = push_pull(small, (sk > 0).astype(float))
    up = small.repeat(2, 0).repeat(2, 1)[:h, :w]
    up = np.asarray(Image.fromarray(np.clip(up, 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(1))).astype(float)
    return np.where(known[..., None] > 0, img, up)


def clean(path, support):
    im = Image.open(path).convert("RGB")
    assert im.size == (W, H), im.size
    a = np.asarray(im).astype(float)
    t0, t1 = find_block(a.astype(np.uint8), support)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    letters = (a.min(2) > LETTER_MIN) | ((r > 130) & (b > 150) & (g < 160) & (r - g > 35))
    rows = np.zeros((H, W), bool); rows[t0:t1, :] = True
    mask = Image.fromarray(((letters & rows) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * GROW + 1))
    m = np.asarray(mask) > 0
    known = (~m).astype(float)
    fill = push_pull(a, known)
    fill = np.asarray(Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(float)
    fill += np.random.default_rng(7).normal(0, 2.0, fill.shape)
    soft = np.asarray(mask.filter(ImageFilter.GaussianBlur(1.5))).astype(float) / 255
    soft = np.maximum(soft, m)
    out = a * (1 - soft[..., None]) + fill * soft[..., None]
    return im, Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), (t0, t1)


def main():
    args = sys.argv[1:]
    dry = "--dry" in args
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    src = args[args.index("--src") + 1] if "--src" in args else None
    ids = [x for x in args if not x.startswith("--") and x not in (sheet, src)]
    sup_ids = {s["id"] for s in json.load(open(os.path.join(ROOT, "data/support.json")))}
    pairs = []
    for i in ids:
        support = i in sup_ids
        path = os.path.join(ROOT, "images", "support" if support else "cards", i + ".webp")
        before, after, block = clean(os.path.join(src, i + ".webp") if src else path, support)
        print(f"{i}: text rows {block[0]}–{block[1]}")
        pairs.append((before, after))
        if not dry:
            after.save(path, "WEBP", quality=88, method=6)
            after.resize((300, 420), Image.LANCZOS).save(os.path.join(os.path.dirname(path), "thumb", i + ".webp"), "WEBP", quality=85, method=6)
    if sheet:
        tw, th = 180, 252
        s = Image.new("RGB", (tw * 2 * min(5, len(pairs)), th * ((len(pairs) + 4) // 5)), "black")
        for k, (b, a) in enumerate(pairs):
            x, y = (k % 5) * tw * 2, (k // 5) * th
            s.paste(b.resize((tw, th)), (x, y)); s.paste(a.resize((tw, th)), (x + tw, y))
        s.save(sheet)


if __name__ == "__main__":
    main()
