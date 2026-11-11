# Referência real por modelo (Wikimedia Commons): só para a geração da arte, nunca vai para o site.
import json, io, sys, urllib.request, urllib.parse, time
from PIL import Image, ImageDraw
OUT = '/Users/izzat/Projects/izzatcar-wt/_r16carros/refs/'
UA = {'User-Agent': 'ref-fetch/1.0'}
Q = {
 'volkswagen-voyage': ['Volkswagen Voyage G5', 'Volkswagen Voyage 2010', 'Volkswagen Voyage 2009'],
 'audi-a5': ['Audi A5 Sportback 8T front', 'Audi A5 8T Sportback'],
 'mini-cooper': ['Mini Cooper R56 front', 'MINI Cooper R56'],
 'chevrolet-prisma': ['Chevrolet Prisma 2014', 'Chevrolet Prisma LTZ', 'Chevrolet Prisma 2017'],
 'volkswagen-saveiro': ['Volkswagen Saveiro G5', 'Volkswagen Saveiro 2010', 'Volkswagen Saveiro 2012'],
 'fiat-siena': ['Fiat Siena EL', 'Fiat Siena 2010', 'Fiat Siena 2008'],
 'volkswagen-bora': ['Volkswagen Bora 1J front', 'Volkswagen Jetta IV front', 'Volkswagen Bora 2002'],
 'volvo-xc90': ['Volvo XC90 II front 2019', 'Volvo XC90 T8 2018'],
 'audi-q5': ['Audi Q5 8R front', 'Audi Q5 2.0 TFSI 8R'],
 'volvo-v60': ['Volvo V60 II front 2019', 'Volvo V60 2019'],
 'volkswagen-tiguan': ['Volkswagen Tiguan I facelift front', 'VW Tiguan 2012 front'],
 'chevrolet-cobalt': ['Chevrolet Cobalt 2017 Brasil', 'Chevrolet Cobalt 2016', 'Chevrolet Cobalt LTZ'],
 'peugeot-308': ['Peugeot 308 2013 Brasil', 'Peugeot 308 I front', 'Peugeot 308 Allure 2012'],
 'fiat-cronos': ['Fiat Cronos', 'Fiat Cronos Precision'],
 'volkswagen-virtus': ['Volkswagen Virtus', 'Volkswagen Virtus 2018'],
 'citroen-c3-aircross': ['Citroën Aircross 2016', 'Citroën C3 Aircross Brasil', 'Citroën Aircross'],
 'fiat-mobi': ['Fiat Mobi', 'Fiat Mobi Like'],
 'renault-oroch': ['Renault Duster Oroch', 'Renault Oroch'],
 'bmw-x5': ['BMW X5 E70 front', 'BMW X5 E70'],
 'volkswagen-parati': ['Volkswagen Parati G3', 'Volkswagen Parati 2003', 'Volkswagen Parati'],
 'honda-city': ['Honda City 2010 front', 'Honda City GM2 front', 'Honda City 2012'],
 'honda-hr-v': ['Honda HR-V 2016 front', 'Honda HR-V RU front', 'Honda HR-V 2018 Brasil'],
}
def api(q):
    u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 12, 'prop': 'imageinfo', 'iiprop': 'url|size', 'iiurlwidth': 960, 'format': 'json'})
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25))
    except Exception as e:
        print('  erro', q, e); return []
    ps = sorted(d.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
    return [(p['title'], p['imageinfo'][0]) for p in ps if p.get('imageinfo')]
def baixa(u):
    for t in range(3):
        try:
            return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read())).convert('RGB')
        except Exception as e:
            time.sleep(2 + 2 * t)
    return None
so = set(sys.argv[1:])
for k, qs in Q.items():
    if so and k not in so: continue
    vistos, esc = set(), []
    for q in qs:
        time.sleep(3)
        for t, ii in api(q):
            if t in vistos or ii['width'] < 900 or ii['width'] < ii['height'] * 1.15 or not t.lower().endswith(('.jpg', '.jpeg')): continue
            if any(x in t.lower() for x in ('interior', 'rear', 'heck', 'engine', 'motor', 'dashboard', 'cockpit', 'logo', 'trasera', 'traseira')): continue
            vistos.add(t); esc.append((t, ii['thumburl']))
        if len(esc) >= 10: break
    esc = esc[:10]
    folha = Image.new('RGB', (1800, 520), 'white'); d = ImageDraw.Draw(folha); meta = []
    for i, (t, u) in enumerate(esc):
        im = baixa(u)
        if not im: continue
        im.save(f'{OUT}w_{k}_{i}.jpg', quality=88)
        th = im.copy(); th.thumbnail((356, 236)); folha.paste(th, ((i % 5) * 360, (i // 5) * 256))
        d.text(((i % 5) * 360 + 4, (i // 5) * 256 + 240), f'{i} {t[5:50]}', fill='black')
        meta.append({'i': i, 'titulo': t})
        time.sleep(1.5)
    d.text((4, 506), k, fill='red')
    folha.save(f'{OUT}_w_folha_{k}.jpg', quality=78)
    json.dump(meta, open(f'{OUT}w_{k}.json', 'w'), ensure_ascii=False)
    print(k, len(meta), flush=True)
