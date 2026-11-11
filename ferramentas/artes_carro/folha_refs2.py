# folhas dos candidatos de foto real (5 modelos por folha, 5 fotos por modelo)
import sys, json, os
from PIL import Image, ImageDraw
OUT = '/Users/izzat/Projects/izzatcar-wt/_r16carros/refs2/'
ks = sys.argv[2:]
b = Image.new('RGB', (1500, 215 * len(ks)), 'white'); d = ImageDraw.Draw(b)
for j, k in enumerate(ks):
    meta = json.load(open(OUT + k + '.json')) if os.path.exists(OUT + k + '.json') else []
    for x in meta:
        im = Image.open(f'{OUT}{k}_{x["i"]}.jpg'); im.thumbnail((296, 198)); b.paste(im, (x['i'] * 300, j * 215))
        d.text((x['i'] * 300 + 3, j * 215 + 200), f'{x["i"]} {x["titulo"][5:46]}', fill='black')
    d.text((1300, j * 215 + 2), k, fill='red')
b.save(OUT + f'_f{sys.argv[1]}.jpg', quality=76)
