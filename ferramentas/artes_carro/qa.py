# QA de uma arte gerada: medidas de enquadramento contra a família, sobreposição a 50% com o piloto e prancha de zoom.
# uso: qa.py <chave>[__t2] ...   -> qa/<chave>-qa.jpg (pequeno) + linha JSON com as medidas e os avisos
import sys, json, numpy as np
from PIL import Image, ImageOps, ImageDraw
sys.path.insert(0, '/Users/izzat/Projects/izzatcar-wt/_r16carros/scripts')
from medir import medir
R = '/Users/izzat/Projects/izzatcar-wt/_r16carros/'
PILOTO = '/Users/izzat/.cache/izzatcar-carros-cor/cor/volvo-xc60.png'
# faixas da família (93 artes medidas: mínimo e máximo, com 1 ponto de folga)
FAIXA = dict(x0=(0.115, 0.217), x1=(0.907, 0.962), y1=(0.80, 0.87), linha=(0.66, 0.75))
PAREDE = (229, 214, 208)
for nome in sys.argv[1:]:
    f = f'{R}gerados/carro-{nome}.png'
    im = Image.open(f).convert('RGB')
    m = medir(f); avisos = []
    if im.size != (1536, 1024): avisos.append(f'tamanho {im.size}')
    for k, (a, b) in FAIXA.items():
        if not a <= m[k] <= b: avisos.append(f'{k}={m[k]} fora de {a}–{b}')
    d = [m['parede'][i] - PAREDE[i] for i in range(3)]
    if max(abs(x) for x in d) > 7: avisos.append(f'parede {m["parede"]} (família {PAREDE})')
    # prancha: sobreposição 50% com o piloto | arte inteira | 4 zooms
    pil = Image.open(PILOTO).convert('RGB').resize((768, 512)); eu = im.resize((768, 512))
    mix = Image.blend(pil, eu, 0.5)
    dr = ImageDraw.Draw(mix)
    for y in (0.665, 0.825): dr.line([(0, y * 512), (768, y * 512)], fill=(255, 0, 0), width=1)
    W, H = im.size
    x0, x1, y0, y1 = [int(m[k] * s) for k, s in (('x0', W), ('x1', W), ('y0', H), ('y1', H))]
    lw, lh = x1 - x0, y1 - y0
    zs = [(x0 - 20, y0 + int(lh * .30), x0 + int(lw * .52), y1 + 10),            # frente: faróis, grade, para-choque
          (x0 + int(lw * .40), y0 + int(lh * .45), x0 + int(lw * .80), y1 + 20),  # roda dianteira
          (x0 + int(lw * .70), y0 + int(lh * .25), x1 + 20, y1 + 20),            # traseira + roda traseira
          (x0 + int(lw * .15), y0 - 20, x1, y0 + int(lh * .55))]                 # teto, vidros, retrovisores
    b = Image.new('RGB', (1536, 512 + 2 * 420), 'white')
    b.paste(mix, (0, 0)); b.paste(eu, (768, 0))
    for i, box in enumerate(zs):
        box = (max(0, box[0]), max(0, box[1]), min(W, box[2]), min(H, box[3]))
        c = ImageOps.contain(im.crop(box), (768, 420), Image.LANCZOS)
        b.paste(c, ((i % 2) * 768, 512 + (i // 2) * 420))
    b = b.resize((1230, round(b.size[1] * 1230 / 1536)), Image.LANCZOS)
    b.save(f'{R}qa/{nome}-qa.jpg', quality=82)
    m['avisos'] = avisos
    print(json.dumps({k: v for k, v in m.items() if k not in ('canto_e', 'canto_d', 'n_laranja')}, ensure_ascii=False), flush=True)
