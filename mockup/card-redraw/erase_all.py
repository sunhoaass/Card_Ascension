import sys, numpy as np, cv2
src, out, maskout = sys.argv[1:4]
import time; t0 = time.time()
a = cv2.imread(src)                       # BGR 600x840
b, g, r = [a[..., i].astype(int) for i in range(3)]
mn = a.min(2).astype(int); mx = a.max(2).astype(int)
H, W = a.shape[:2]
m = np.zeros((H, W), np.uint8)
def box(x0, y0, x1, y1, cond, grow):
    sub = np.zeros((H, W), np.uint8)
    c = cond[y0:y1, x0:x1]
    sub[y0:y1, x0:x1][c] = 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*grow+1, 2*grow+1))
    return cv2.dilate(sub, k)
bright = mn > 150
green = (g > 110) & (g - r > 40) & (g - b > 40)
red = (r > 150) & (r - g > 70) & (r - b > 50)
lilac = (r > 140) & (b > 160) & (mx - mn > 40) & (g < 170)
m |= box(0, 0, 300, 80, bright, 6)               # card name
m |= box(355, 0, 515, 95, green, 7)              # HP
m |= box(500, 10, 600, 95, red | bright, 7)      # heart
badge = np.zeros((H, W), np.uint8); cv2.rectangle(badge, (478, 112), (592, 170), 255, -1)
m |= badge                                       # 1 IN X badge
m |= box(0, 465, 260, 525, lilac | bright, 7)    # ability name
m |= box(0, 530, 600, 705, bright, 6)            # ability text
swd = (mn > 110) | red | ((r > 150) & (g > 90) & (b < 110))   # blade, red grip, gold guard
m |= box(12, 728, 118, 825, swd, 5)              # swords (shape, not a box)
m[0:18, 560:600] = 255                           # frame corner bit
m |= box(230, 735, 370, 815, red, 7)             # ATK
m |= box(440, 750, 600, 815, bright, 6)          # xN
cv2.imwrite(maskout, m)
res = cv2.xphoto.inpaint if False else None
outimg = np.zeros_like(a)
cv2.xphoto.inpaint(a, 255 - m, outimg, cv2.xphoto.INPAINT_FSR_BEST)
cv2.imwrite(out, outimg)
print('secs', round(time.time() - t0, 1))
