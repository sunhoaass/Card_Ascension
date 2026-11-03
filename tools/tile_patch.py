#!/usr/bin/env python3
"""Put a redrawn card's real face back from the game's small Deck-list tile (owner 2026-11-03).
Where the HP number covered a face, tools/erase_all.py can only guess (a blur) · the site shows that blur when HP gets short
(≥ 1B → "2.1B") · the Deck-list tile (Deck → search the card) shows the art with nothing over the face.

    python3 tools/tile_patch.py <rd picture> <screenshot> <tile x0,y0,x1,y1> <oval x0,y0,x1,y1> <out.webp> [preview.png]

- <tile …>: the tile's box in the screenshot (2400×1080 · e.g. 1350,454,1536,638 for the first tile)
- <oval …>: the box of the oval to replace in the 600×840 picture (the head) · the tile's own labels (×N, gem, odds) are never copied
- the tile is matched to the picture by SIFT (prints matches / inliers / scale · inliers should be most of the matches),
  enlarged ~2.6×, lightly sharpened, colour-matched on a ring round the oval, blended with a soft edge
- save as a NEW file name (<id>-2.webp + thumb/) and point cards.json "image" at it, so phones don't keep the cached old one
"""
import sys, numpy as np, cv2
from PIL import Image
rdp, shotp, tb, pb, outp = sys.argv[1:6]; prev = sys.argv[6] if len(sys.argv) > 6 else None
tx0, ty0, tx1, ty1 = map(int, tb.split(",")); px0, py0, px1, py1 = map(int, pb.split(","))
shot = cv2.imread(shotp); rd = cv2.imread(rdp)
I = 8; t = shot[ty0 + I:ty1 - I, tx0 + I:tx1 - I]; F = 3
t3 = cv2.resize(t, None, fx=F, fy=F, interpolation=cv2.INTER_CUBIC)
# the tile's own labels (x20, gem, odds) = bright-with-dark-outline or saturated gold → never copied
hsv = cv2.cvtColor(t, cv2.COLOR_BGR2HSV); g = cv2.cvtColor(t, cv2.COLOR_BGR2GRAY)
dark = (g < 40).astype(np.uint8); lab = ((g > 215) & (cv2.dilate(dark, np.ones((5, 5), np.uint8)) > 0)) | ((hsv[..., 1] > 120) & (hsv[..., 0] > 15) & (hsv[..., 0] < 35))
lab = cv2.dilate(lab.astype(np.uint8) * 255, np.ones((9, 9), np.uint8)); lab3 = cv2.resize(lab, None, fx=F, fy=F, interpolation=cv2.INTER_NEAREST)
sift = cv2.SIFT_create()
k1, d1 = sift.detectAndCompute(cv2.cvtColor(t3, cv2.COLOR_BGR2GRAY), None); k2, d2 = sift.detectAndCompute(cv2.cvtColor(rd, cv2.COLOR_BGR2GRAY), None)
good = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < 0.75 * b.distance]
A, inl = cv2.estimateAffinePartial2D(np.float32([k1[x.queryIdx].pt for x in good]), np.float32([k2[x.trainIdx].pt for x in good]), ransacReprojThreshold=4)
print("matches", len(good), "inliers", int(inl.sum()), "scale", round(float(np.hypot(A[0, 0], A[1, 0])) * F, 3))
W, H = rd.shape[1], rd.shape[0]
w = cv2.warpAffine(t3, A, (W, H), flags=cv2.INTER_LANCZOS4)
ok = cv2.warpAffine(255 - lab3, A, (W, H), flags=cv2.INTER_NEAREST); ok = cv2.erode(ok, np.ones((5, 5), np.uint8))   # inside the tile and not a label
# light unsharp so the soft tile sits better next to the sharp picture
w = cv2.addWeighted(w, 1.5, cv2.GaussianBlur(w, (0, 0), 1.6), -0.5, 0)
box = np.zeros((H, W), np.uint8); cv2.ellipse(box, ((px0 + px1) // 2, (py0 + py1) // 2), ((px1 - px0) // 2, (py1 - py0) // 2), 0, 0, 360, 255, -1); box &= cv2.erode(ok, np.ones((15, 15), np.uint8))
# colour match on a ring around the patch
ring = (cv2.dilate(box, np.ones((25, 25), np.uint8)) > 0) & (box == 0) & (ok > 0)
wf, rf = w.astype(np.float32), rd.astype(np.float32)
for c in range(3):
    a, b = wf[..., c][ring], rf[..., c][ring]
    wf[..., c] = (wf[..., c] - a.mean()) / (a.std() + 1e-3) * b.std() + b.mean()
alpha = cv2.GaussianBlur(cv2.erode((box > 0).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(np.float32), (0, 0), 7)[..., None]
outp_img = np.clip(rf * (1 - alpha) + np.clip(wf, 0, 255) * alpha, 0, 255).astype(np.uint8)
res = Image.fromarray(cv2.cvtColor(outp_img, cv2.COLOR_BGR2RGB))
res.save(outp, "WEBP", quality=88, method=6)
if prev:
    y0, y1, x0, x1 = max(0, py0 - 60), min(H, py1 + 60), max(0, px0 - 60), min(W, px1 + 60)
    cv2.imwrite(prev, cv2.resize(np.hstack([rd[y0:y1, x0:x1], outp_img[y0:y1, x0:x1]]), None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
