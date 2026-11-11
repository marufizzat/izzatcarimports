# QA compacto (lote 2): medidas contra a família + prancha pequena (arte inteira, zoom da frente, roda, traseira, teto).
# uso: qa2.py <chave>[__t2] ...   -> qa/<chave>-qa.jpg + linha JSON
import sys, json
from PIL import Image, ImageOps
sys.path.insert(0, '/Users/izzat/Projects/izzatcar-wt/_r16carros/scripts')
from medir import medir
R = '/Users/izzat/Projects/izzatcar-wt/_r16carros/'
FAIXA = dict(x0=(0.115, 0.217), x1=(0.907, 0.962), y1=(0.80, 0.87))
for nome in sys.argv[1:]:
    f = f'{R}gerados/carro-{nome}.png'
    im = Image.open(f).convert('RGB'); m = medir(f); av = []
    if im.size != (1536, 1024): av.append(f'tamanho {im.size}')
    for k, (a, b) in FAIXA.items():
        if not a <= m[k] <= b: av.append(f'{k}={m[k]}')
    if m['x1'] - m['x0'] > 0.805: av.append(f'largo {round(m["x1"] - m["x0"], 3)}')
    W, H = im.size
    x0, x1, y0, y1 = [int(m[k] * s) for k, s in (('x0', W), ('x1', W), ('y0', H), ('y1', H))]
    lw, lh = x1 - x0, y1 - y0
    cx = lambda b: (max(0, b[0]), max(0, b[1]), min(W, b[2]), min(H, b[3]))
    b = Image.new('RGB', (1280, 427 + 290), 'white')
    b.paste(im.resize((640, 427), Image.LANCZOS), (0, 0))
    b.paste(ImageOps.contain(im.crop(cx((x0 - 20, y0 + int(lh * .28), x0 + int(lw * .55), y1 + 10))), (640, 427), Image.LANCZOS), (640, 0))
    for i, box in enumerate([(x0 + int(lw * .40), y0 + int(lh * .45), x0 + int(lw * .78), y1 + 20), (x0 + int(lw * .68), y0 + int(lh * .2), x1 + 20, y1 + 20), (x0 + int(lw * .2), y0 - 20, x1, y0 + int(lh * .5))]):
        b.paste(ImageOps.contain(im.crop(cx(box)), (426, 290), Image.LANCZOS), (i * 427, 427))
    b.save(f'{R}qa/{nome}-qa.jpg', quality=80)
    print(json.dumps({'k': nome, 'x0': m['x0'], 'x1': m['x1'], 'y1': m['y1'], 'larg': round(m['x1'] - m['x0'], 3), 'parede': m['parede'], 'avisos': av}, ensure_ascii=False), flush=True)
