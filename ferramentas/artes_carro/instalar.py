# Instala as artes aprovadas do lote r16 em site/public/arte/v2/carro-<k>.webp (1200x800, webp q84: a MESMA receita das
# 93 que já estavam: instalar_cores.py). Antes de gravar, acerta o tom da parede com o da família (ganho global por canal,
# no máximo 6%): na abertura a arte dissolve sobre o estúdio em CSS e sobre a arte do carro anterior; parede mais rosada = emenda.
# uso: instalar.py <chave>...   (lê gerados/carro-<chave>.png; nunca toca no PNG)
import sys, json, numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, '/Users/izzat/Projects/izzatcar-wt/_r16carros/scripts')
from medir import medir
R = '/Users/izzat/Projects/izzatcar-wt/_r16carros/'
DST = '/Users/izzat/Projects/izzatcar-wt/r15hero/site/public/arte/v2/'
PAREDE = (229, 214, 208)   # mediana das 93 artes da família (qa/_medidas-existentes.jsonl)
# Reenquadre leve (só quando o carro saiu maior/mais baixo que a família): escala s em torno do ponto (cx, cy) em frações
# do quadro; a sobra das bordas é a continuação da própria borda (parede e piso lisos).
LOTE1 = set('volkswagen-voyage audi-a5 mini-cooper chevrolet-prisma volkswagen-saveiro fiat-siena volkswagen-bora volvo-xc90 audi-q5 volvo-v60 volkswagen-tiguan chevrolet-cobalt peugeot-308 fiat-cronos volkswagen-virtus citroen-c3-aircross fiat-mobi renault-oroch bmw-x5 volkswagen-parati honda-city honda-hr-v'.split())
AJUSTE = {'renault-oroch': (0.96, 0.55, 0.25), 'volkswagen-parati': (0.924, 0.666, 0.70), 'honda-city': (0.96, 0.63, 0.64)}
def reenquadrar(im, s, cx, cy):
    W, H = im.size; sw, sh = round(W * s), round(H * s)
    ox, oy = round(cx * W * (1 - s)), round(cy * H * (1 - s))
    a = np.asarray(im.resize((sw, sh), Image.LANCZOS))
    r = Image.fromarray(np.pad(a, ((oy, H - sh - oy), (ox, W - sw - ox), (0, 0)), mode='edge'))
    if oy > 2:   # a faixa de cima é a 1ª linha repetida (riscos verticais na parede): desfoca só ela, na horizontal
        r.paste(r.crop((0, 0, W, oy)).filter(ImageFilter.BoxBlur(28)), (0, 0))
    return r
def ajuste_auto(m):
    """Lote 2: o carro que saiu mais largo que a família (> 80,5% do quadro) ou com as rodas baixas demais (> 86,5%) encolhe
    até caber (largura 79%, rodas em 84,5%); devolve (s, cx, cy) ou None."""
    larg = m['x1'] - m['x0']; s = 0.79 / larg if larg > 0.805 else (0.97 if m['y1'] > 0.865 else 1)
    if s >= 1: return None
    s = max(s, 0.88)
    cx = min(1, max(0, (0.155 - s * m['x0']) / (1 - s))) if larg > 0.805 else 0.55
    cy = min(1, max(0, (min(m['y1'], 0.845) - s * m['y1']) / (1 - s)))
    return (round(s, 3), round(cx, 3), round(cy, 3))
reg = []
for k in sys.argv[1:]:
    f = f'{R}gerados/carro-{k}.png'
    im = Image.open(f).convert('RGB')
    assert im.size == (1536, 1024), (k, im.size)
    m = medir(f)
    g = [min(1.06, max(0.94, PAREDE[i] / m['parede'][i])) for i in range(3)]
    if max(abs(PAREDE[i] - m['parede'][i]) for i in range(3)) > 2:
        a = np.asarray(im).astype(np.float32) * np.array(g, dtype=np.float32)
        im = Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8))
    else:
        g = [1, 1, 1]
    aj = AJUSTE.get(k) or (ajuste_auto(m) if k not in LOTE1 else None)
    if aj: im = reenquadrar(im, *aj)
    im.resize((1200, 800), Image.LANCZOS).save(f'{DST}carro-{k}.webp', quality=84, method=6)
    depois = medir(f'{DST}carro-{k}.webp')
    reg.append({'k': k, 'parede_antes': m['parede'], 'ganho': [round(x, 3) for x in g], 'parede_depois': depois['parede'], 'reenquadre': aj, 'caixa_depois': [depois[c] for c in ('x0', 'x1', 'y0', 'y1', 'linha')]})
    print(reg[-1], flush=True)
json.dump(reg, open(R + 'qa/_instaladas.json', 'a'), ensure_ascii=False)
