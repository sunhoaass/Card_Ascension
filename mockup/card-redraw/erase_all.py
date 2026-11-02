import sys, numpy as np, cv2
src, out, maskout = sys.argv[1:4]
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
m[105:175, 470:600] = 255                        # 1 IN X badge
m |= box(0, 465, 260, 525, lilac | bright, 7)    # ability name
m |= box(0, 530, 600, 705, bright, 6)            # ability text
m[728:825, 12:118] = 255                         # swords (whole box)
m[0:18, 560:600] = 255                           # frame corner bit
m |= box(230, 735, 370, 815, red, 7)             # ATK
m |= box(440, 750, 600, 815, bright, 6)          # xN
cv2.imwrite(maskout, m)
res = cv2.xphoto.inpaint if False else None
outimg = np.zeros_like(a)
cv2.xphoto.inpaint(a, 255 - m, outimg, cv2.xphoto.INPAINT_FSR_FAST)
cv2.imwrite(out, outimg)
