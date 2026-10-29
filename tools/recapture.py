#!/usr/bin/env python3
"""Recapture (PROGRESS §7 "โหมดแคปใหม่"): turn the owner's sharp screenshots of the game's full-screen card view
into the 600×840 picture the web uses (images/support/<id>.webp + thumb/), with the game's overlays removed.

layout "full" = phone screenshot 2400×1080 of the card opened full-screen (calibrated 2026-10-29 on Hellsing Commander
7 rarities + Eternal Wish Dragon Secret):
  · inner picture (inside the rarity frame) x 744–1428 · y 121–959 · the game stretches the card ×1.14 wide in this
    view, so it is resized back to 600×840 (same geometry as the old Index pictures · SIFT check: x ×1.141 y ×0.998)
  · rarity pill (SHINY … GODLY) top-right: y 222–305, right end at the frame, left end found by its ring + black stroke
  · Android "show taps" blue circle (x ≥ 1395) → masked by colour
  · gold sparkle stars of the game's effect → --star x0,y0,x1,y1 (screenshot px · yellow pixels inside the box)
    · a star's grey glow on the dark text shadow → --patch x0,y0,x1,y1 (whole box painted the shadow's colour ·
      keep it off the letters)
Masked pixels are filled from the other screenshots of the same card (other rarities: same art, pill of a different
width, stars elsewhere) and what no screenshot shows is inpainted (cv2.xphoto FSR_FAST). The name is coloured by
rarity in the game → give the white-name shot first (Secret / Ascended / Godlike) · it is the base.
A glyph of the game's text under a star: --mirror x0,y0,x1,y1 (its box in the base shot · W M A V … only) copies the
mirror of its right half onto its left half. Overlay spots above the description block that no
shot shows can come from the old picture (same geometry · --old <copy of the old .webp>) instead of a smeared inpaint.
The {n}% numbers are NOT removed here: update effect.desc, then run tools/support_nums.py <id> --redo.

needs: pip install opencv-contrib-python-headless
usage: python3 tools/recapture.py <id> <base.jpg> [other.jpg …] [--star x0,y0,x1,y1 …] [--patch …] [--mirror x0,y0,x1,y1]
                                   [--old old.webp] [--sheet out.png] [--dry]
  --star / --patch boxes are for the base shot; add @N to give them to another shot (N = 1 for the first other shot)
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 600, 840
SHOT = (2400, 1080)
INNER = (744, 121, 1428, 959)            # x0 y0 x1 y1 (exclusive) of the picture inside the frame
PILL_Y, PILL_R, PILL_X1 = 263.5, 41.5, 1430


def pill_left(L):
    """left end of the rarity pill: the radius where the ring is bright just inside a dark stroke, along the left cap"""
    th = np.linspace(np.pi / 2 + 0.25, 1.5 * np.pi - 0.25, 40)
    def cap(e, rr):
        xs, ys = e + PILL_R + rr * np.cos(th), PILL_Y - rr * np.sin(th)
        return L[ys.round().astype(int), xs.round().astype(int)].mean()
    best = max(((max(cap(e, PILL_R - d) for d in range(5, 16)) - min(cap(e, PILL_R - d) for d in range(4)), e)
                for e in range(1080, 1280)))
    if best[0] < 50:
        raise SystemExit("rarity pill not found (score %.0f) · is this the full-card view at 2400×1080?" % best[0])
    return best[1]


def shot_mask(a, stars, patches=()):
    """True = game overlay (pill / tap circle / star) in screenshot px"""
    hh, ww = a.shape[:2]
    L = a.mean(2)
    yy, xx = np.mgrid[0:hh, 0:ww]
    e = pill_left(L) - 6
    r = PILL_R + 6
    cx = e + r
    m = ((xx >= cx) & (xx <= PILL_X1) & (abs(yy - PILL_Y) <= r)) | ((xx - cx) ** 2 + (yy - PILL_Y) ** 2 <= r * r)
    r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
    tap = (xx >= 1395) & (b_ > 120) & (b_ - r_ > 70) & (b_ - g_ > 30)
    for x0, y0, x1, y1 in stars:
        box = np.zeros_like(m)
        box[y0:y1, x0:x1] = True
        m |= box & (r_ > 140) & (g_ > 90) & (r_ - b_ > 60)
    for x0, y0, x1, y1 in patches:        # painted with the box's darkest colour (the text shadow), not inpainted
        box = a[y0:y1, x0:x1].reshape(-1, 3)
        a[y0:y1, x0:x1] = box[box.sum(1).argsort()[len(box) // 10]]
        m[y0:y1, x0:x1] = False
    return grow(m, 4) | grow(tap, 5), e


def grow(m, n):
    import cv2
    return cv2.dilate(m.astype(np.uint8), np.ones((2 * n + 1, 2 * n + 1), np.uint8)) > 0


def to_card(a):
    x0, y0, x1, y1 = INNER
    return np.asarray(Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.int32)


def to_card_mask(m):
    x0, y0, x1, y1 = INNER
    return np.asarray(Image.fromarray((m[y0:y1, x0:x1] * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)) > 0


def main():
    import cv2
    args = sys.argv[1:]
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    dry = "--dry" in args
    stars, mirrors, old, rest, k = {}, [], None, [], 0
    while k < len(args):
        if args[k] == "--mirror":
            mirrors.append(tuple(int(v) for v in args[k + 1].split(","))); k += 2
        elif args[k] == "--old":
            old = args[k + 1]; k += 2
        elif args[k] in ("--star", "--patch"):
            box, _, n = args[k + 1].partition("@")
            stars.setdefault((args[k], int(n or 0)), []).append(tuple(int(v) for v in box.split(",")))
            k += 2
        elif args[k] == "--sheet":
            k += 2
        elif args[k] == "--dry":
            k += 1
        else:
            rest.append(args[k]); k += 1
    sid, shots = rest[0], rest[1:]
    if not shots:
        raise SystemExit(__doc__)
    kind = "support" if os.path.exists(os.path.join(ROOT, "images", "support", sid + ".webp")) else "cards"
    if kind == "cards":
        raise SystemExit("cards: HP / ATK spots of the full-card view are not calibrated yet (only Support) · step 0")
    cards, masks = [], []
    for n, p in enumerate(shots):
        im = Image.open(p).convert("RGB")
        if im.size != SHOT:
            raise SystemExit("%s is %d×%d · layout 'full' is calibrated for %d×%d only" % ((p,) + im.size + SHOT))
        a = np.asarray(im).astype(np.int32).copy()
        m, e = shot_mask(a, stars.get(("--star", n), []), stars.get(("--patch", n), []))
        for x0, y0, x1, y1 in (mirrors if n == 0 else []):
            a, m = a.copy(), m.copy()
            for x in range(x0, (x0 + x1) // 2):
                xm = x0 + x1 - 1 - x
                a[y0:y1, x] = a[y0:y1, xm]        # the whole left half (the star's white core is not in the mask)
                m[y0:y1, x] = False
        print("%s: pill from x %d" % (os.path.basename(p), e))
        cards.append(to_card(a)); masks.append(to_card_mask(m))
    out, hole = cards[0].copy(), masks[0].copy()
    for c, m in zip(cards[1:], masks[1:]):
        take = hole & ~m
        out[take] = c[take]
        hole &= m
    print("filled from other shots: %d px" % (masks[0].sum() - hole.sum()))
    if old:
        top = np.zeros_like(hole); top[:int(H * 0.58)] = True    # above the description (its text may differ)
        o = np.asarray(Image.open(old).convert("RGB").resize((W, H), Image.LANCZOS)).astype(np.int32)
        take = hole & top
        out[take] = o[take]
        print("from the old picture: %d px" % take.sum())
        hole &= ~top
    print("inpainted: %d px" % hole.sum())
    src = out.astype(np.uint8)
    dst = np.zeros_like(src)
    cv2.xphoto.inpaint(src, (255 - hole.astype(np.uint8) * 255), dst, cv2.xphoto.INPAINT_FSR_FAST)
    res = Image.fromarray(dst)
    if sheet:
        before = Image.fromarray(cards[0].astype(np.uint8))
        ov = np.asarray(before).copy()
        ov[masks[0]] = (ov[masks[0]] * 0.4 + np.array([0, 255, 0]) * 0.6).astype(np.uint8)
        ov[hole] = (ov[hole] * 0.4 + np.array([255, 0, 255]) * 0.6).astype(np.uint8)
        s = Image.new("RGB", (W * 3, H))
        s.paste(before, (0, 0)); s.paste(Image.fromarray(ov), (W, 0)); s.paste(res, (W * 2, 0))
        ImageDraw.Draw(s).text((W + 8, 8), "green = filled from other shots · pink = inpainted", fill=(255, 255, 0))
        s.save(sheet)
    if not dry:
        res.save(os.path.join(ROOT, "images", kind, sid + ".webp"), "WEBP", quality=88)
        res.resize((300, 420), Image.LANCZOS).save(os.path.join(ROOT, "images", kind, "thumb", sid + ".webp"), "WEBP", quality=82)
        print("saved images/%s/%s.webp + thumb/" % (kind, sid))


if __name__ == "__main__":
    main()
