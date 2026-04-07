"""
IZZAT CAR - Gerador de Páginas Completas por Peça
Cada peça com: TODAS as fotos, descrição, frete, botões ML e WhatsApp
"""

import requests
import json
import re
import time
import os
from pathlib import Path
from dotenv import load_dotenv

SITE_DIR = Path(r"C:\Users\Administrator\Desktop\IzzatCar\site")
PECA_DIR = SITE_DIR / "peca"
PRODUCTS_FILE = SITE_DIR / "products.json"

env_path = Path(r"C:\Users\Administrator\Desktop\IzzatCar\MercadoLivre\.env")
load_dotenv(env_path)
TOKEN = os.getenv("ML_ACCESS_TOKEN")
headers = {"Authorization": f"Bearer {TOKEN}"}

def slugify(text):
    text = text.lower().strip()
    for a, b in [('àáâãä','a'),('èéêë','e'),('ìíîï','i'),('òóôõö','o'),('ùúûü','u'),('ç','c')]:
        for c in a:
            text = text.replace(c, b)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return re.sub(r'-+', '-', text).strip('-')[:80]

def get_item_full(item_id):
    """Busca detalhes completos + descrição de um item."""
    # Detalhes
    resp = requests.get(f"https://api.mercadolibre.com/items/{item_id}", headers=headers)
    if resp.status_code != 200:
        return None, None
    item = resp.json()

    # Descrição
    desc_resp = requests.get(f"https://api.mercadolibre.com/items/{item_id}/description", headers=headers)
    desc = ""
    if desc_resp.status_code == 200:
        desc = desc_resp.json().get("plain_text", "")

    return item, desc

def generate_page(item, desc):
    title = item.get("title", "")
    price_raw = item.get("price", 0)
    price = f"{price_raw:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    item_id = item.get("id", "")
    url_ml = item.get("permalink", "")
    brand = ""

    # Todas as fotos
    pictures = item.get("pictures", [])
    imgs = [p.get("secure_url", "").replace("-I.jpg", "-O.webp").replace("-I.webp", "-O.webp") for p in pictures if p.get("secure_url")]
    if not imgs and item.get("thumbnail"):
        imgs = [item["thumbnail"].replace("http:", "https:")]

    main_img = imgs[0] if imgs else ""

    # Atributos
    attrs_html = ""
    for attr in item.get("attributes", []):
        name = attr.get("name", "")
        val = attr.get("value_name", "")
        if val and name and name not in ["Condição do item"]:
            attrs_html += f'<tr><td>{name}</td><td>{val}</td></tr>\n'

    # Descrição formatada
    desc_html = ""
    if desc:
        desc_clean = desc.replace("\n", "<br>").replace("========", "<hr>")
        desc_html = f'<div class="prod-desc">{desc_clean}</div>'

    # Galeria de fotos
    gallery_html = ""
    thumbs_html = ""
    for i, img in enumerate(imgs):
        active = "active" if i == 0 else ""
        gallery_html += f'<img src="{img}" class="gallery-img {active}" data-idx="{i}" alt="{title}">\n'
        thumbs_html += f'<img src="{img}" class="thumb {active}" onclick="showImg({i})" alt="foto {i+1}">\n'

    slug = slugify(title) + "-" + item_id
    wa_msg = f"Olá! Vi no site a peça:\\n\\n*{title}*\\nPreço: R$ {price}\\n\\nQuero comprar direto!"
    wa_url = f"https://wa.me/5553991170950?text={wa_msg}".replace(" ", "%20").replace("!", "%21").replace("\n", "%0A").replace("*", "%2A")

    html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} | Izzat Car Imports</title>
<meta name="description" content="{title} - Peça original R$ {price}. Garantia 90 dias, envio todo Brasil. CDV credenciado Detran-RS nº 01060.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://www.izzatcarimports.com.br/peca/{slug}.html">
<meta property="og:title" content="{title}">
<meta property="og:description" content="R$ {price} - Original, garantia 90 dias">
<meta property="og:image" content="{main_img}">
<meta property="og:type" content="product">
<script type="application/ld+json">
{{"@context":"https://schema.org","@type":"Product","name":"{title}","image":{json.dumps(imgs[:5])},"description":"Peça original com procedência legal. CDV Detran-RS 01060. Garantia 90 dias.","offers":{{"@type":"Offer","price":"{price_raw:.2f}","priceCurrency":"BRL","availability":"https://schema.org/InStock","seller":{{"@type":"Organization","name":"Izzat Car Imports"}}}}}}
</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
:root{{--p:#FF6B00;--pd:#CC5500;--d:#06060D;--d2:#0B0B18;--d3:#111125;--d4:#181832;--w:#FFF;--g:#9090B0;--gl:#D0D0E8;--gr:#25D366;--ac:#00D4FF}}
body{{font-family:'Inter',sans-serif;background:var(--d);color:var(--w)}}
.c{{max-width:1100px;margin:0 auto;padding:0 24px}}
.nav{{position:fixed;top:0;left:0;width:100%;z-index:100;background:rgba(6,6,13,.92);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,107,0,.08);padding:14px 0}}
.nav .c{{display:flex;justify-content:space-between;align-items:center}}
.logo{{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--w);text-decoration:none}}
.logo span{{color:var(--p)}}
.back{{color:var(--g);text-decoration:none;font-size:14px;display:flex;align-items:center;gap:6px}}
.back:hover{{color:var(--p)}}

.product{{padding:90px 0 40px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}}

/* GALERIA */
.gallery{{position:sticky;top:80px}}
.gallery-main{{position:relative;width:100%;aspect-ratio:1;background:var(--d3);border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.04)}}
.gallery-img{{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .3s;padding:16px}}
.gallery-img.active{{opacity:1}}
.thumbs{{display:flex;gap:8px;margin-top:12px;overflow-x:auto;padding-bottom:8px}}
.thumb{{width:72px;height:72px;object-fit:cover;border-radius:10px;cursor:pointer;border:2px solid transparent;opacity:.5;transition:all .3s;background:var(--d3);flex-shrink:0}}
.thumb.active,.thumb:hover{{border-color:var(--p);opacity:1}}
.gallery-nav{{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:40px;background:rgba(0,0,0,.5);border:none;border-radius:50%;color:white;font-size:20px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center}}
.gallery-nav:hover{{background:var(--p)}}
.gallery-prev{{left:12px}}
.gallery-next{{right:12px}}
.img-count{{position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,.6);padding:4px 10px;border-radius:6px;font-size:12px;color:white}}

/* INFO */
.prod-title{{font-family:'Space Grotesk',sans-serif;font-size:clamp(22px,3vw,32px);font-weight:700;letter-spacing:-.5px;margin-bottom:8px;line-height:1.2}}
.prod-id{{font-size:12px;color:var(--g);margin-bottom:16px}}
.prod-price{{font-family:'Space Grotesk',sans-serif;font-size:44px;font-weight:700;color:var(--p);margin-bottom:4px}}
.prod-price-sub{{font-size:14px;color:var(--g);margin-bottom:20px}}
.badges{{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}}
.badge{{padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700}}
.b-orig{{background:rgba(255,107,0,.1);color:var(--p);border:1px solid rgba(255,107,0,.2)}}
.b-gar{{background:rgba(37,211,102,.1);color:var(--gr);border:1px solid rgba(37,211,102,.2)}}
.b-nf{{background:rgba(0,212,255,.1);color:var(--ac);border:1px solid rgba(0,212,255,.2)}}
.b-env{{background:rgba(100,100,255,.1);color:#8888FF;border:1px solid rgba(100,100,255,.2)}}

.btns{{display:flex;flex-direction:column;gap:10px;margin:24px 0}}
.btn{{padding:18px 0;border-radius:14px;font-size:16px;font-weight:700;text-align:center;text-decoration:none;color:var(--w);transition:all .3s;display:block;border:none;cursor:pointer;font-family:'Inter',sans-serif}}
.btn-wa{{background:var(--gr);box-shadow:0 4px 20px rgba(37,211,102,.3)}}
.btn-wa:hover{{background:#1EBE5A;transform:translateY(-2px)}}
.btn-ml{{background:var(--p);box-shadow:0 4px 20px rgba(255,107,0,.25)}}
.btn-ml:hover{{background:var(--pd);transform:translateY(-2px)}}

/* FRETE */
.frete-box{{background:var(--d3);border:1px solid rgba(255,255,255,.04);border-radius:14px;padding:20px;margin:24px 0}}
.frete-box h4{{font-size:15px;margin-bottom:12px;display:flex;align-items:center;gap:8px}}
.frete-row{{display:flex;gap:8px}}
.frete-input{{flex:1;padding:14px 16px;background:var(--d4);border:1px solid rgba(255,255,255,.06);border-radius:10px;color:var(--w);font-size:15px;font-family:'Inter',sans-serif;outline:none}}
.frete-input:focus{{border-color:rgba(255,107,0,.4)}}
.frete-btn{{padding:14px 24px;background:var(--p);border:none;border-radius:10px;color:white;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif}}
.frete-result{{margin-top:16px;display:none}}
.frete-cards{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.frete-card{{padding:14px;border-radius:10px}}
.frete-pac{{background:rgba(255,107,0,.06);border:1px solid rgba(255,107,0,.1)}}
.frete-sedex{{background:rgba(0,100,255,.06);border:1px solid rgba(0,100,255,.1)}}
.frete-card .label{{font-size:11px;font-weight:700;margin-bottom:6px}}
.frete-card .val{{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700}}
.frete-card .prazo{{font-size:11px;color:var(--g);margin-top:2px}}

/* DESCRIÇÃO */
.section-title2{{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;margin:40px 0 20px;padding-top:24px;border-top:1px solid rgba(255,255,255,.04)}}
.prod-desc{{font-size:14px;color:var(--gl);line-height:1.8;white-space:pre-wrap;word-wrap:break-word}}
.prod-desc hr{{border:none;border-top:1px solid rgba(255,255,255,.06);margin:16px 0}}

/* ATRIBUTOS */
.attrs-table{{width:100%;border-collapse:collapse;margin-top:16px}}
.attrs-table td{{padding:10px 16px;font-size:13px;border-bottom:1px solid rgba(255,255,255,.03)}}
.attrs-table td:first-child{{color:var(--g);width:40%}}
.attrs-table tr:hover{{background:rgba(255,107,0,.03)}}

.foot{{padding:32px 0;border-top:1px solid rgba(255,255,255,.04);text-align:center;margin-top:60px}}
.foot p{{font-size:13px;color:var(--g)}}
.foot a{{color:var(--p);text-decoration:none}}

.wa-float{{position:fixed;bottom:24px;right:24px;z-index:99;width:56px;height:56px;background:var(--gr);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(37,211,102,.4);text-decoration:none}}
.wa-float svg{{width:28px;height:28px;fill:white}}

@media(max-width:768px){{
.product{{grid-template-columns:1fr;gap:24px;padding-top:75px}}
.gallery{{position:static}}
.prod-price{{font-size:36px}}
.frete-cards{{grid-template-columns:1fr}}
}}
</style>
</head>
<body>
<nav class="nav"><div class="c"><a href="../index.html" class="logo">IZZAT <span>CAR</span></a><a href="../catalogo.html" class="back">&#8592; Voltar ao catálogo</a></div></nav>

<main class="c">
<div class="product">
<!-- GALERIA -->
<div class="gallery">
<div class="gallery-main">
{gallery_html}
<button class="gallery-nav gallery-prev" onclick="navImg(-1)">&#8249;</button>
<button class="gallery-nav gallery-next" onclick="navImg(1)">&#8250;</button>
<span class="img-count" id="imgCount">1/{len(imgs)}</span>
</div>
<div class="thumbs">{thumbs_html}</div>
</div>

<!-- INFO -->
<div>
<h1 class="prod-title">{title}</h1>
<p class="prod-id">Código: {item_id}</p>
<div class="prod-price">R$ {price}</div>
<p class="prod-price-sub">à vista no Pix ou em até 12x no cartão</p>

<div class="badges">
<span class="badge b-orig">Original de Fábrica</span>
<span class="badge b-gar">Garantia 90 Dias</span>
<span class="badge b-nf">Nota Fiscal</span>
<span class="badge b-env">Envio Todo Brasil</span>
</div>

<div class="btns">
<a href="{wa_url}" target="_blank" class="btn btn-wa">&#128172; Comprar Direto (sem taxa)</a>
<a href="{url_ml}" target="_blank" class="btn btn-ml">Comprar pelo Mercado Livre</a>
</div>

<!-- FRETE -->
<div class="frete-box">
<h4>&#128666; Calcular frete</h4>
<div class="frete-row">
<input type="text" class="frete-input" id="cepInput" placeholder="Digite seu CEP" maxlength="9" oninput="formatCEP(this)" onkeypress="if(event.key==='Enter')calcFrete()">
<button class="frete-btn" onclick="calcFrete()">Calcular</button>
</div>
<div class="frete-result" id="freteResult"></div>
</div>

<!-- ATRIBUTOS -->
{'<h3 class="section-title2">Especificações</h3><table class="attrs-table">' + attrs_html + '</table>' if attrs_html else ''}
</div>
</div>

<!-- DESCRIÇÃO -->
{'<h3 class="section-title2">Descrição completa</h3>' + desc_html if desc_html else ''}
</main>

<footer class="foot"><div class="c"><p>&copy; 2022-2026 <a href="../index.html">Izzat Car Imports</a> — CDV Detran-RS 01060 — (53) 99117-0950</p></div></footer>

<a href="{wa_url}" target="_blank" class="wa-float"><svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>

<script>
let currentImg = 0;
const totalImgs = {len(imgs)};

function showImg(idx) {{
    document.querySelectorAll('.gallery-img').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.gallery-img')[idx].classList.add('active');
    document.querySelectorAll('.thumb')[idx].classList.add('active');
    currentImg = idx;
    document.getElementById('imgCount').textContent = (idx+1) + '/' + totalImgs;
}}

function navImg(dir) {{
    let next = currentImg + dir;
    if (next < 0) next = totalImgs - 1;
    if (next >= totalImgs) next = 0;
    showImg(next);
}}

function formatCEP(input) {{
    let v = input.value.replace(/\\D/g, '');
    if (v.length > 5) v = v.substring(0,5) + '-' + v.substring(5,8);
    input.value = v;
}}

const tabelaCorreios = {{
    'RS':[22.40,4,38.90,2],'SC':[26.80,5,44.50,3],'PR':[28.90,5,48.70,3],
    'SP':[32.50,7,55.30,4],'RJ':[34.80,8,58.90,4],'MG':[33.60,7,56.40,4],
    'ES':[35.90,8,61.20,5],'MS':[31.40,7,52.80,4],'GO':[34.20,8,57.60,5],
    'DF':[35.80,8,59.90,5],'MT':[37.90,9,63.40,5],'BA':[38.50,10,65.80,6],
    'SE':[39.80,10,67.20,6],'AL':[40.20,11,68.90,6],'PE':[41.50,11,70.30,7],
    'PB':[42.80,12,72.40,7],'RN':[43.20,12,73.80,7],'CE':[44.50,12,75.90,7],
    'PI':[45.80,13,78.40,8],'MA':[47.20,14,81.90,8],'PA':[49.80,15,86.50,9],
    'TO':[44.90,12,76.80,7],'AM':[55.90,18,98.40,10],'AC':[58.40,20,104.80,12],
    'RO':[52.60,16,92.30,9],'RR':[59.80,22,108.50,13],'AP':[57.20,20,102.90,11]
}};

async function calcFrete() {{
    const cep = document.getElementById('cepInput').value.replace(/\\D/g, '');
    const result = document.getElementById('freteResult');
    if (cep.length !== 8) {{ result.style.display='block'; result.innerHTML='<p style="color:#FF6B6B">CEP inválido</p>'; return; }}
    result.style.display = 'block';
    result.innerHTML = '<p style="color:var(--g)">Consultando...</p>';
    try {{
        const resp = await fetch('https://viacep.com.br/ws/'+cep+'/json/');
        const data = await resp.json();
        if (data.erro) throw 0;
        const uf = data.uf, cidade = data.localidade;
        const v = tabelaCorreios[uf] || [45,12,78,7];
        result.innerHTML = `
            <p style="font-size:13px;margin-bottom:12px"><strong>${{cidade}}/${{uf}}</strong></p>
            <div class="frete-cards">
                <div class="frete-card frete-pac"><div class="label" style="color:var(--p)">PAC</div><div class="val" style="color:var(--p)">R$ ${{v[0].toFixed(2).replace('.',',')}}</div><div class="prazo">${{v[1]}} dias úteis</div></div>
                <div class="frete-card frete-sedex"><div class="label" style="color:#4488FF">SEDEX</div><div class="val" style="color:#4488FF">R$ ${{v[2].toFixed(2).replace('.',',')}}</div><div class="prazo">${{v[3]}} dias úteis</div></div>
            </div>
            <p style="font-size:10px;color:var(--g);margin-top:8px">* Ref. peça até 1kg. Valor exato pelo WhatsApp.</p>`;
    }} catch(e) {{ result.innerHTML='<p style="color:#FF6B6B">CEP não encontrado</p>'; }}
}}
</script>
</body>
</html>'''

    return slug, html

def main():
    print("=" * 50)
    print("  IZZAT CAR — Páginas Completas (fotos+desc+frete)")
    print("=" * 50)

    with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    products = data["products"]
    print(f"\n{len(products)} produtos para processar")

    PECA_DIR.mkdir(exist_ok=True)

    # Mapeamento slug -> ID para o catálogo
    slug_map = {}
    count = 0
    errors = 0

    for p in products:
        item_id = p["id"]
        try:
            item, desc = get_item_full(item_id)
            if not item:
                errors += 1
                continue

            slug, html = generate_page(item, desc)
            filepath = PECA_DIR / f"{slug}.html"
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)

            slug_map[item_id] = slug
            count += 1

            if count % 20 == 0:
                print(f"  {count}/{len(products)}...")

            time.sleep(0.15)  # Rate limit

        except Exception as e:
            errors += 1
            if errors < 5:
                print(f"  Erro {item_id}: {e}")

    # Salvar mapeamento para o catálogo usar
    with open(SITE_DIR / "slug_map.json", "w", encoding="utf-8") as f:
        json.dump(slug_map, f, ensure_ascii=False)

    print(f"\n{count} páginas completas geradas")
    print(f"{errors} erros")
    print(f"Mapeamento salvo em slug_map.json")

if __name__ == "__main__":
    main()
