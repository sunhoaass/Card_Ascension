import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
U, OUT = sys.argv[1], sys.argv[2]
RC=float(sys.argv[3]) if len(sys.argv)>3 else 9
rough={'spirited':('ac504a2c',65,58),'nimble':('ac504a2c',65,232),'sharp':('ac504a2c',65,425),'tough':('ac504a2c',65,597),
'iron-body':('ca20d323',70,60),'prodigy':('0a1dbbb3',75,85),'keen-eye':('0a1dbbb3',75,330),'bloodlust':('0a1dbbb3',75,505),
'sage-mode':('3ce06f5b',70,65),'awakened':('3ce06f5b',70,360),'undying':('3ce06f5b',70,575),'ascendant':('596feedf',70,62),'limitless':('596feedf',70,365)}
S=4  # supersample for smooth alpha
for k,(f,x,y) in rough.items():
  full=np.asarray(Image.open(f"{U}/{f}-image.jpg").convert('RGB')).astype(float)
  x0,y0=x-60,max(0,y-62)
  a=full[y0:y+62, x0:x+66]; H,W,_=a.shape
  dark=a.max(2)<36
  ys,xs=np.nonzero(dark)
  best=None
  for cx in np.arange(48,80,0.5):
    for cy in np.arange((y-y0)-16,(y-y0)+12,0.5):
      d=np.abs(xs-cx)+np.abs(ys-cy)
      for R in np.arange(49,54.5,0.5):
        sc=np.count_nonzero((d>R-4)&(d<=R))-1.0*np.count_nonzero((d>R)&(d<R+4))
        if best is None or sc>best[0]: best=(sc,cx,cy,R)
  sc,cx,cy,R=best
  # rounded diamond mask, supersampled
  Y,X=np.mgrid[0:H*S,0:W*S]/S+0.5/S
  core=(np.abs(X-cx)+np.abs(Y-cy))<=R-RC*np.sqrt(2)-1.2
  dist=nd.distance_transform_edt(~core)/S
  m=(dist<=RC).astype(float)
  al=m.reshape(H,S,W,S).mean((1,3))
  img=np.dstack([a,al*255]).astype(np.uint8)
  bb=(int(cx-R)-1,int(cy-R)-1,int(cx+R)+2,int(cy+R)+2)
  Image.fromarray(img,'RGBA').crop(bb).save(f"{OUT}/{k}.png")
  print(k, cx,cy,R)
