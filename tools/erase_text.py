#!/usr/bin/env python3
"""Erase the card name, ability name and ability text from a card / support picture (PROGRESS ▶️ "แผนข้อความบนการ์ดใหม่").
The web draws them from the data instead (js/app.js cleanArt · owner 2026-10-30). Hearts, swords and the green SUPPORT
word stay in the picture.

    python3 tools/erase_text.py <id> [<id> …] [--dry] [--sheet out.png]

- picture: images/cards/<id>.webp or images/support/<id>.webp (600×840) → overwritten + thumb/<id>.webp (300×420)
- name: fixed box top-left (NAME_BOX) · the game writes it there on every card
- text block: from the first row of the purple ability name to the last row of white text above the swords / SUPPORT
  (found per picture · padded PAD px) · full card width
- fill: push-pull (masked pyramid average) from the pixels around the box, feathered FEATHER px, light grain on top
  · the web lays a dark scrim over both spots, so a soft fill is enough
- --dry: write nothing · --sheet: before / after contact sheet
Needs only Pillow + numpy.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 600, 840
NAME_BOX = (0, 16, 285, 84)          # x0, y0, x1, y1
SEARCH = (462, 738)                  # rows where the ability name + text can be (cards) · supports stop above SUPPORT
SUP_BOTTOM = 728
PAD = 10
FEATHER = 9


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
    mask = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = NAME_BOX; mask[y0:y1, x0:x1] = 255
    t0, t1 = find_block(a.astype(np.uint8), support); mask[t0:t1, :] = 255
    known = (mask == 0).astype(float)
    fill = push_pull(a, known)
    fill += np.random.default_rng(7).normal(0, 2.5, fill.shape)
    soft = np.asarray(Image.fromarray(mask).filter(ImageFilter.GaussianBlur(FEATHER / 2))).astype(float) / 255
    soft = np.maximum(soft, (np.asarray(Image.fromarray(mask).filter(ImageFilter.MinFilter(2 * FEATHER + 1))) > 0))
    out = a * (1 - soft[..., None]) + fill * soft[..., None]
    return im, Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), (t0, t1)


def main():
    args = sys.argv[1:]
    dry = "--dry" in args
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    ids = [x for x in args if not x.startswith("--") and x != sheet]
    sup_ids = {s["id"] for s in json.load(open(os.path.join(ROOT, "data/support.json")))}
    pairs = []
    for i in ids:
        support = i in sup_ids
        path = os.path.join(ROOT, "images", "support" if support else "cards", i + ".webp")
        before, after, block = clean(path, support)
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
