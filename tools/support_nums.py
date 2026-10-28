#!/usr/bin/env python3
"""Support cards: find the level-scaling numbers ({0}% {1}% … in effect.desc) on the card picture,
erase them, and save where they were in data/support.json (effect.pos) so the web can draw the value
for the chosen rarity in the same spot (PROGRESS §3.5.5 · routine C step "numbers").

needs: tesseract (apt-get install -y tesseract-ocr) + opencv (pip install opencv-contrib-python-headless)
usage: python3 tools/support_nums.py [ids…] [--redo] [--sheet out.png] [--dry]
  no ids = every support without effect.pos · --redo = also ones that have it (only on original pictures that still have numbers!)
  --sheet = contact sheet (before | after + boxes) to check by eye · --dry = don't write anything
"""
import difflib, json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "support.json")
W, H = 600, 840
TOP, BOT = int(H * 0.58), int(H * 0.935)   # the description block (name above, SUPPORT below)
S = 4                                      # OCR upscale


def white_mask(a, lo=150):
    mx, mn = a.max(2), a.min(2)
    return (mn > lo) & (mx - mn < 60)


def ocr_words(img):
    """tesseract word boxes in the description block · [{t, x, y, w, h, line}] in 600×840 px"""
    c = img.crop((0, TOP, W, BOT)).resize((W * S, (BOT - TOP) * S), Image.LANCZOS)
    m = white_mask(np.asarray(c).astype(int))
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "in.png")
        Image.fromarray(np.where(m, 0, 255).astype(np.uint8)).save(p)
        out = subprocess.run(["tesseract", p, "-", "--psm", "6", "tsv"], capture_output=True, text=True, check=True).stdout
    words = []
    for ln in out.splitlines()[1:]:
        f = ln.split("\t")
        if len(f) == 12 and f[11].strip():
            l, t, w, h = (int(v) / S for v in f[6:10])
            words.append({"t": f[11].strip(), "x": l, "y": t + TOP, "w": w, "h": h, "line": (int(f[2]), int(f[3]), int(f[4]))})
    return words


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def align(desc, words):
    """desc tokens with {n} → the OCR word that sits there (difflib on the other words around it)"""
    dt = desc.split()
    a = ["#%s" % m.group(1) if (m := re.search(r"\{(\d)\}", t)) else norm(t) for t in dt]
    b = [norm(w["t"]) for w in words]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    hit = {}
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op != "replace" and op != "delete":
            continue
        for i in range(i1, i2):
            if not a[i].startswith("#"):
                continue
            n = int(a[i][1:])
            if op == "replace" and i2 - i1 == j2 - j1:
                hit[n] = (dt[i], words[j1 + i - i1])
            elif op == "replace":     # unequal block: the word in it that looks most like a number
                cand = sorted(range(j1, j2), key=lambda j: -sum(ch.isdigit() or ch in "%.," for ch in words[j]["t"]))
                hit[n] = (dt[i], words[cand[0]])
    return hit


def groups(cols):
    """runs of True in a 1-D array → [(start, end)]"""
    out, s = [], None
    for i, v in enumerate(list(cols) + [False]):
        if v and s is None:
            s = i
        elif not v and s is not None:
            out.append((s, i)); s = None
    return out


def refine(a, tok, w):
    """tighten the OCR box to the number + % only (drop "(" before, "." "," ")" after) · measure gaps"""
    m = white_mask(a)
    x0, x1 = int(w["x"]) - 2, int(w["x"] + w["w"]) + 3
    y0, y1 = int(w["y"]) - 2, int(w["y"] + w["h"]) + 3
    sub = m[y0:y1, x0:x1]
    g = groups(sub.sum(0) > 0)
    pre = len(tok) - len(tok.lstrip("("))
    post = len(tok) - len(tok.rstrip(".,):;"))
    g = g[pre:len(g) - post] if len(g) > pre + post else g
    gx0, gx1 = x0 + g[0][0], x0 + g[-1][1]
    rows = np.where(m[y0:y1, gx0:gx1].sum(1) > 0)[0]
    gy0, gy1 = y0 + rows[0], y0 + rows[-1] + 1
    # cap height = the first digit's ink height
    d0 = m[y0:y1, gx0:x0 + g[0][1]]
    r0 = np.where(d0.sum(1) > 0)[0]
    cap = r0[-1] - r0[0] + 1
    band = m[gy0:gy1]
    def gap(step, start):
        x, n = start, 0
        while 0 <= x < W and not band[:, x].any() and n < 80:
            x += step; n += 1
        return n
    return {"x": gx0, "y": gy0, "w": gx1 - gx0, "h": gy1 - gy0, "cap": int(cap),
            "gl": gap(-1, gx0 - 1), "gr": gap(1, gx1)}


def erase(a, boxes):
    import cv2
    mask = np.zeros((H, W), np.uint8)
    for b in boxes:
        p = max(4, min(6, b["gl"] // 2, b["gr"] // 2))
        mask[b["y"] - 5:b["y"] + b["h"] + 6, b["x"] - p:b["x"] + b["w"] + p] = 255
    src = a.astype(np.uint8)
    dst = np.zeros_like(src)
    cv2.xphoto.inpaint(src, (255 - mask), dst, cv2.xphoto.INPAINT_FSR_FAST)
    return dst


def pct(v):
    return round(v / W * 100, 2)   # cqw = % of the card width (height = 140)


def main():
    args = sys.argv[1:]
    ids = [x for x in args if not x.startswith("--") and not x.endswith(".png")]
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    dry, redo = "--dry" in args, "--redo" in args
    data = json.load(open(DATA, encoding="utf-8"))
    has = lambda s: "pos" in (s.get("effect") or {})
    # ids = only those · none = every support · a support that has effect.pos was done already (its picture has no numbers left)
    todo = [s for s in data if (s["id"] in ids if ids else True) and (redo or not has(s))]
    skipped = [s["id"] for s in data if (s["id"] in ids if ids else False) and has(s) and not redo]
    if skipped:
        print("already done (effect.pos), skipped:", ", ".join(skipped))
    tiles, bad = [], []
    for s in todo:
        e = s.get("effect") or {}
        desc, vals = e.get("desc") or "", e.get("vals") or []
        path = os.path.join(ROOT, "images", "support", s["id"] + ".webp")
        need = sorted({int(n) for n in re.findall(r"\{(\d)\}", desc)})
        if not need or not os.path.exists(path):
            e["pos"] = []
            continue
        img = Image.open(path).convert("RGB")
        a = np.asarray(img).astype(np.int32)
        hit = align(desc, ocr_words(img))
        miss = [n for n in need if n not in hit]
        boxes = []
        for n in need:
            if n in hit:
                tok, w = hit[n]
                try:
                    b = refine(a, tok, w)
                except Exception:
                    miss.append(n); continue
                b["i"], b["ocr"] = n, w["t"]
                if not re.search(r"\d", w["t"]) or b["w"] < 6 or b["cap"] < 8:
                    miss.append(n)
                boxes.append(b)
        if miss:
            bad.append((s["id"], miss, [b["ocr"] for b in boxes]))
            print("CHECK", s["id"], "not found:", miss, [b.get("ocr") for b in boxes])
            continue
        clean = erase(a, boxes)
        if sheet:
            before = img.copy(); after = Image.fromarray(clean)
            dr = ImageDraw.Draw(after)
            for b in boxes:
                dr.rectangle([b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]], outline=(255, 0, 255), width=2)
            t = Image.new("RGB", (W, BOT - TOP + 40))
            pair = Image.new("RGB", (W * 2, BOT - TOP))
            pair.paste(before.crop((0, TOP, W, BOT)), (0, 0)); pair.paste(after.crop((0, TOP, W, BOT)), (W, 0))
            tiles.append((s["id"], pair))
        e["pos"] = [{"i": b["i"], "x": pct(b["x"]), "y": pct(b["y"]), "w": pct(b["w"]), "h": pct(b["h"]),
                     "cap": pct(b["cap"]), "gl": pct(b["gl"]), "gr": pct(b["gr"])} for b in boxes]
        print("ok", s["id"], [(b["ocr"], b["x"], b["y"], b["w"], b["h"], b["cap"]) for b in boxes])
        if not dry:
            out = Image.fromarray(clean)
            out.save(path, "WEBP", quality=86)
            th = os.path.join(ROOT, "images", "support", "thumb", s["id"] + ".webp")
            if os.path.isdir(os.path.dirname(th)):
                out.resize((300, 420), Image.LANCZOS).save(th, "WEBP", quality=82)
    if sheet and tiles:
        rows = Image.new("RGB", (W * 2, len(tiles) * (BOT - TOP + 22)), (20, 20, 20))
        dr = ImageDraw.Draw(rows)
        for k, (sid, pair) in enumerate(tiles):
            y = k * (BOT - TOP + 22)
            dr.text((6, y + 4), sid, fill=(255, 255, 0))
            rows.paste(pair, (0, y + 20))
        rows.save(sheet)
    if not dry:
        with open(DATA, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print("done", len(todo) - len(bad), "· check by hand:", len(bad))


if __name__ == "__main__":
    main()
