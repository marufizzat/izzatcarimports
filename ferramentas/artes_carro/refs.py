# Fotos reais de referência de cada modelo: as montagens "peça + carro" dos anúncios (classe 'c' em fotos-ml-caixas.json).
# Só referência para a geração da arte (nunca vão para o site).
import json, io, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw
sys.path.insert(0, '/Users/izzat/Projects/izzatcar-wt/_r16carros/scripts')
from alvos import ALVOS
SITE = '/Users/izzat/Projects/izzatcar-wt/r15hero/site/'
OUT = '/Users/izzat/Projects/izzatcar-wt/_r16carros/refs/'
P = json.load(open(SITE + 'src/data/pecas.json'))
C = json.load(open(SITE + 'src/data/fotos-ml-caixas.json'))
UA = {'User-Agent': 'Mozilla/5.0'}
def baixa(k, tam='O'):
    try:
        r = urllib.request.urlopen(urllib.request.Request(f'https://http2.mlstatic.com/D_{k}-{tam}.jpg', headers=UA), timeout=25)
        return Image.open(io.BytesIO(r.read())).convert('RGB')
    except Exception as e:
        return None
so = set(sys.argv[1:])
for k, b, m, (g0, g1) in ALVOS:
    if so and k not in so: continue
    cands = []
    for p in P:
        if p.get('b') != b: continue
        mods = p.get('ms') or [p.get('m')]
        if m not in mods: continue
        y = p['ys'][mods.index(m)] if p.get('ys') else p.get('y')
        dentro = bool(y) and y[0] >= g0 - 1 and y[1] <= g1 + 1
        so_ele = len(mods) == 1
        for f in p.get('fotos', []):
            e = C.get(f)
            if e and len(e) > 6 and e[6] == 'c':
                cands.append((not dentro, not so_ele, f, y, p['t'][:60]))
    cands.sort(key=lambda x: (x[0], x[1]))
    vistos, esc = set(), []
    for c in cands:
        h = C[c[2]][7]
        if h in vistos: continue
        vistos.add(h); esc.append(c)
        if len(esc) >= 6: break
    with ThreadPoolExecutor(6) as ex: ims = list(ex.map(lambda c: baixa(c[2]), esc))
    folha = Image.new('RGB', (1800, 330), 'white'); d = ImageDraw.Draw(folha)
    for i, (c, im) in enumerate(zip(esc, ims)):
        if not im: continue
        im.save(f'{OUT}{k}_{i}.jpg', quality=85)
        t = im.copy(); t.thumbnail((300, 300)); folha.paste(t, (i * 300, 0))
        d.text((i * 300 + 4, 304), f'{i} {c[3]} {"G" if not c[0] else "-"}', fill='black')
    d.text((4, 318), f'{k}  ({len(cands)} montagens)', fill='red')
    folha.save(f'{OUT}_folha_{k}.jpg', quality=80)
    json.dump([{'i': i, 'foto': c[2], 'anos': c[3], 'na_geracao': not c[0], 'titulo': c[4]} for i, c in enumerate(esc)], open(f'{OUT}{k}.json', 'w'), ensure_ascii=False)
    print(k, len(cands), [(c[3], not c[0]) for c in esc], flush=True)
