# Lote 2: candidatos de foto real por modelo (Wikimedia Commons), 5 por modelo, folhas de 5 modelos.
import json, io, sys, os, urllib.request, urllib.parse, time
from PIL import Image, ImageDraw
OUT = '/Users/izzat/Projects/izzatcar-wt/_r16carros/refs2/'
UA = {'User-Agent': 'ref-fetch/1.0'}
Q2 = {
 'volvo-s90': ['Volvo S90 2017', 'Volvo S90 T6'], 'citroen-xsara': ['Citroën Xsara', 'Citroen Xsara 2003'], 'volvo-v40': ['Volvo V40 2013', 'Volvo V40 T4 2015', 'Volvo V40 D2'],
 'volkswagen-passat-cc': ['Volkswagen CC front', 'VW Passat CC', 'Volkswagen CC 2010'], 'chevrolet-classic': ['Chevrolet Classic LS 2012', 'Chevrolet Classic sedan Brasil', 'Chevrolet Corsa Classic 2011', 'Chevrolet Classic Argentina'],
 'fiat-doblo': ['Fiat Doblò Adventure Brasil', 'Fiat Doblo 2014 Brasil', 'Fiat Doblò I facelift front', 'Fiat Doblò 2006 front'], 'chevrolet-montana': ['Chevrolet Montana 2008', 'Chevrolet Montana Sport', 'Opel Corsa Utility 2005', 'Chevrolet Montana 2004'],
 'nissan-livina': ['Nissan Livina L10 front', 'Nissan Grand Livina 2008 front', 'Nissan Livina 2010'], 'nissan-sentra': ['Nissan Sentra 2013 front', 'Nissan Sylphy B17 front', 'Nissan Sentra B17 2014'],
}
Q = {
 'bmw-x1': ['BMW X1 E84 front'], 'bmw-x4': ['BMW X4 G02 front'], 'chevrolet-monza': ['Chevrolet Monza Brasil 1993', 'Chevrolet Monza SL/E 1992', 'Chevrolet Monza GLS'],
 'citroen-xsara-picasso': ['Citroën Xsara Picasso front'], 'toyota-camry': ['Toyota Camry XV20 front', '1998 Toyota Camry front'],
 'citroen-c3-picasso': ['Citroën C3 Picasso front'], 'fiat-stilo': ['Fiat Stilo 5-door front', 'Fiat Stilo front'], 'volkswagen-amarok': ['Volkswagen Amarok 2011 front', 'VW Amarok front'],
 'volkswagen-nivus': ['Volkswagen Nivus front', 'Volkswagen Nivus'], 'volkswagen-passat-cc': ['Volkswagen Passat CC front'], 'fiat-punto': ['Fiat Punto Brasil 2010', 'Fiat Grande Punto front'],
 'ford-escort': ['Ford Escort 1997 front hatch', 'Ford Escort Mk7 front', 'Ford Escort Zetec Brasil'], 'hyundai-ix35': ['Hyundai ix35 front'], 'mercedes-benz-cla': ['Mercedes-Benz CLA C117 front'],
 'peugeot-407': ['Peugeot 407 front'], 'renault-kwid': ['Renault Kwid Brasil', 'Renault Kwid front'], 'ssangyong-actyon': ['SsangYong Actyon front', 'SsangYong Actyon'],
 'volvo-s90': ['Volvo S90 II front'], 'volvo-xc40': ['Volvo XC40 front'], 'audi-a1': ['Audi A1 8X Sportback front', 'Audi A1 8X front'], 'chery-tiggo': ['Chery Tiggo 5x', 'Chery Tiggo 5x front'],
 'chevrolet-montana': ['Chevrolet Montana 2005', 'Chevrolet Montana Conquest', 'Chevrolet Tornado pickup'], 'fiat-freemont': ['Fiat Freemont front'], 'nissan-frontier': ['Nissan Navara D40 front', 'Nissan Frontier D40 front'],
 'renault-symbol': ['Renault Symbol 2009 front', 'Renault Symbol II'], 'toyota-hilux': ['Toyota Hilux 2016 front double cab', 'Toyota Hilux AN120 front'], 'volkswagen-spacefox': ['Volkswagen SpaceFox', 'Volkswagen Suran 2011'],
 'chevrolet-blazer': ['Chevrolet Blazer Brasil 1998', 'Chevrolet S10 Blazer 1997', 'Chevrolet Blazer DLX'], 'chevrolet-camaro': ['Chevrolet Camaro 2010 front', 'Chevrolet Camaro SS 2012 front'],
 'chevrolet-classic': ['Chevrolet Classic 2011', 'Chevrolet Classic 2013 sedan', 'Chevrolet Corsa Classic'], 'citroen-c4-picasso': ['Citroën C4 Picasso I front', 'Citroën Grand C4 Picasso front 2008'],
 'citroen-xsara': ['Citroën Xsara front 2001', 'Citroën Xsara Phase II'], 'fiat-doblo': ['Fiat Doblò Brasil', 'Fiat Doblò Adventure', 'Fiat Doblò 2012 Brasil'], 'fiat-fiorino': ['Fiat Fiorino Brasil', 'Fiat Fiorino furgão 2010', 'Fiat Fiorino Fire'],
 'hyundai-veloster': ['Hyundai Veloster front'], 'jaguar-f-pace': ['Jaguar F-Pace front'], 'nissan-versa': ['Nissan Versa 2020 front', 'Nissan Versa N18'], 'audi-a6': ['Audi A6 C7 front'],
 'chevrolet-kadett': ['Chevrolet Kadett Brasil', 'Chevrolet Kadett GL 1995', 'Chevrolet Kadett GSi'], 'jaguar-xe': ['Jaguar XE front'], 'mercedes-benz-a200': ['Mercedes-Benz W176 front'],
 'mercedes-benz-classe-a': ['Mercedes-Benz W168 front'], 'mitsubishi-l200': ['Mitsubishi L200 Sport Brasil', 'Mitsubishi L200 Outdoor', 'Mitsubishi L200 2005 front'], 'toyota-corona': ['Toyota Corona T190 front', 'Toyota Corona 1994'],
 'volkswagen-crossfox': ['Volkswagen CrossFox 2011', 'Volkswagen CrossFox'], 'volkswagen-logus': ['Volkswagen Logus'], 'volvo-v40': ['Volvo V40 II front'], 'audi-q7': ['Audi Q7 4L facelift front', 'Audi Q7 4L front'],
 'chevrolet-agile': ['Chevrolet Agile front', 'Chevrolet Agile'], 'fiat-linea': ['Fiat Linea front'], 'fiat-pulse': ['Fiat Pulse front', 'Fiat Pulse'], 'hyundai-elantra': ['Hyundai Elantra MD front'],
 'jaguar-xf': ['Jaguar XF X260 front'], 'jeep-commander': ['Jeep Commander 2022 Brasil', 'Jeep Commander (2021)'], 'kia-mohave': ['Kia Mohave front', 'Kia Borrego front'], 'kia-sportage': ['Kia Sportage KM front', 'Kia Sportage 2008 front'],
 'land-rover-evoque': ['Range Rover Evoque L551 front'], 'nissan-livina': ['Nissan Livina front', 'Nissan Livina Brasil'], 'nissan-sentra': ['Nissan Sentra B17 front'], 'toyota-rav4': ['Toyota RAV4 XA20 front'],
 # refazer do lote 1
 'peugeot-308': ['Peugeot 308 Argentina 2013', 'Peugeot 308 Allure 2014 Brasil', 'Peugeot 308 I phase 2 front'], 'citroen-c3-aircross': ['Citroën Aircross 2017 Brasil', 'Citroën Aircross Shine 2016', 'Citroën C3 Aircross 2011 Brasil'],
 'volkswagen-bora': ['Volkswagen Bora 2001 front', 'Volkswagen Bora 1J sedan'],
}
RUIM = ('interior', 'rear', 'heck', 'engine', 'motor', 'dashboard', 'cockpit', 'logo', 'trasera', 'traseira', 'innenraum', 'back', 'tail', 'trunk', 'kofferraum', 'seat', 'wheel', 'concept', 'rally', 'police', 'polic', 'taxi')
def api(q):
    u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action': 'query', 'generator': 'search', 'gsrsearch': q + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 14, 'prop': 'imageinfo', 'iiprop': 'url|size', 'iiurlwidth': 960, 'format': 'json'})
    for t in range(4):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=25)); break
        except Exception as e:
            time.sleep(15 * (t + 1)); d = {}
    ps = sorted(d.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
    return [(p['title'], p['imageinfo'][0]) for p in ps if p.get('imageinfo')]
def baixa(u):
    for t in range(4):
        try:
            return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read())).convert('RGB')
        except Exception as e:
            time.sleep(8 * (t + 1))
    return None
so = sys.argv[1:]
if so and so[0] == '--2':
    Q = Q2; so = so[1:]
    for k in Q2:
        if os.path.exists(f'{OUT}{k}.json'): os.rename(f'{OUT}{k}.json', f'{OUT}{k}.v1.json')
ks = [k for k in Q if not so or k in so]
import os
for k in ks:
    if os.path.exists(f'{OUT}{k}.json'): continue
    vistos, esc = set(), []
    for q in Q[k]:
        time.sleep(4)
        for t, ii in api(q):
            tl = t.lower()
            if t in vistos or ii['width'] < 900 or ii['width'] < ii['height'] * 1.15 or not tl.endswith(('.jpg', '.jpeg')) or any(x in tl for x in RUIM): continue
            vistos.add(t); esc.append((t, ii['thumburl']))
        if len(esc) >= 5: break
    meta = []
    for i, (t, u) in enumerate(esc[:5]):
        im = baixa(u)
        if im: im.save(f'{OUT}{k}_{i}.jpg', quality=86); meta.append({'i': i, 'titulo': t})
        time.sleep(2)
    json.dump(meta, open(f'{OUT}{k}.json', 'w'), ensure_ascii=False)
    print(k, len(meta), flush=True)
