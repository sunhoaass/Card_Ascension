import sys, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
I = Image.open(src).convert('RGB'); im = np.asarray(I).astype(np.float32); H,W,_=im.shape
import json
boxes = json.loads(sys.argv[3]) if len(sys.argv)>3 else [(0,28,250,74),(8,462,530,532),(18,532,590,668)]
mask = np.zeros((H,W),np.uint8)
for x0,y0,x1,y1 in boxes: mask[y0:y1,x0:x1]=255
M = Image.fromarray(mask)
known = 1-np.asarray(M).astype(np.float32)/255
# multi-scale normalized blur fill (push-pull)
fill = np.zeros_like(im)
for r in [60,30,15,8,4]:
    num = np.asarray(Image.fromarray(np.clip(im*known[...,None],0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)
    den = np.asarray(Image.fromarray((known*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)/255
    est = num/np.maximum(den,1e-3)[...,None]
    ok = den>0.05
    fill = np.where(ok[...,None], est, fill)
# feathered blend
soft = np.asarray(M.filter(ImageFilter.GaussianBlur(6))).astype(np.float32)/255
soft = np.maximum(soft, np.asarray(M).astype(np.float32)/255*0.0)
rng=np.random.default_rng(2); fill += rng.normal(0,3,fill.shape)
res = im*(1-soft[...,None]) + fill*soft[...,None]
Image.fromarray(np.clip(res,0,255).astype(np.uint8)).save(out)
