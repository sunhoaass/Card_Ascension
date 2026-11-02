import sys, numpy as np, cv2, time
src, out, maskout = sys.argv[1:4]; fast = len(sys.argv) > 4
a = cv2.imread(src); H, W = a.shape[:2]
b, g, r = [a[..., i].astype(int) for i in range(3)]
mn = a.min(2).astype(int); mx = a.max(2).astype(int)
dark = mx < 50                                  # the letters' black outline + drop shadow
K = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*n+1, 2*n+1))
def box(x0, y0, x1, y1, cond, grow):
    sub = np.zeros((H, W), np.uint8); sub[y0:y1, x0:x1][cond[y0:y1, x0:x1]] = 255
    near = cv2.dilate(sub, K(grow + 4)) > 0       # dark pixels this close to a letter = its shadow
    sh = np.zeros((H, W), np.uint8); sh[near & dark] = 255
    return cv2.dilate(sub, K(grow)) | cv2.dilate(sh, K(3))
white = (mn > 165) & (mx - mn < 45)
lilac = (r > 140) & (b > 160) & (mx - mn > 40) & (g < 175)
green = (g > 140) & (g - r > 35) & (g - b > 20)
m = np.zeros((H, W), np.uint8)
m |= box(0, 25, 300, 82, white, 6)          # card name
m |= box(0, 468, 360, 528, lilac | white, 7) # ability name
m |= box(15, 528, 590, 700, white, 5)       # ability text
m |= box(160, 735, 440, 825, green, 7)      # SUPPORT
cv2.imwrite(maskout, m)
t = time.time(); o = np.zeros_like(a)
cv2.xphoto.inpaint(a, 255 - m, o, cv2.xphoto.INPAINT_FSR_FAST if fast else cv2.xphoto.INPAINT_FSR_BEST)
cv2.imwrite(out, o); print('secs', round(time.time() - t))
