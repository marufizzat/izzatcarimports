# Mede o enquadramento de uma arte de carro (1200x800 ou 1536x1024): caixa do carro (rembg), linha de luz laranja e tom da parede.
# uso: medir.py <arquivo>...   (saída JSON por linha, frações da largura/altura)
import sys, json, numpy as np
from PIL import Image
from rembg import remove, new_session
S = new_session('u2net')
def medir(f):
    im = Image.open(f).convert('RGB'); W, H = im.size
    pq = im.resize((600, 400), Image.LANCZOS)
    a = np.asarray(remove(pq, session=S, only_mask=True)).astype(float) / 255
    m = a > 0.5
    ys, xs = np.where(m)
    cx = dict(x0=xs.min() / 600, x1=xs.max() / 600, y0=ys.min() / 400, y1=ys.max() / 400) if len(xs) else {}
    px = np.asarray(pq).astype(int)
    # linha laranja: linha com mais pixels "laranja claro" (R alto, R-B grande) fora do carro
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    lar = (r > 200) & (r - b > 45) & (g - b > 10) & ~m
    cont = lar.sum(axis=1); yl = int(cont.argmax())
    parede = px[20:120, 20:580].reshape(-1, 3); parede = parede[~m[20:120, 20:580].reshape(-1)]
    piso = px[370:395, 40:560].reshape(-1, 3)
    return dict(f=f.split('/')[-1], **{k: round(float(v), 3) for k, v in cx.items()}, linha=round(yl / 400, 3), n_laranja=int(cont.max()),
                parede=[int(x) for x in np.median(parede, axis=0)], piso=[int(x) for x in np.median(piso, axis=0)],
                canto_e=[int(x) for x in np.median(px[10:60, 5:60].reshape(-1, 3), axis=0)], canto_d=[int(x) for x in np.median(px[10:60, 540:595].reshape(-1, 3), axis=0)])
if __name__ == '__main__':
    for f in sys.argv[1:]:
        print(json.dumps(medir(f)), flush=True)
