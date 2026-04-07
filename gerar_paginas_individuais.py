"""
IZZAT CAR - Gerador de Páginas Individuais por Peça
Cada peça ganha uma URL própria = SEO máximo
Ex: izzatcarimports.com.br/peca/farol-corolla-2018-MLB123456.html
"""

import json
import re
import os
from pathlib import Path

SITE_DIR = Path(r"C:\Users\Administrator\Desktop\IzzatCar\site")
PECA_DIR = SITE_DIR / "peca"
PRODUCTS_FILE = SITE_DIR / "products.json"

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[àáâãä]', 'a', text)
    text = re.sub(r'[èéêë]', 'e', text)
    text = re.sub(r'[ìíîï]', 'i', text)
    text = re.sub(r'[òóôõö]', 'o', text)
    text = re.sub(r'[ùúûü]', 'u', text)
    text = re.sub(r'[ç]', 'c', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = re.sub(r'-+', '-', text).strip('-')
    return text[:80]

def generate_page(product):
    title = product["title"]
    price = f"{product['price']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    price_raw = f"{product['price']:.2f}"
    img = product["img"]
    url_ml = product["url"]
    item_id = product["id"]
    brand = product.get("brand", "")
    slug = slugify(title) + "-" + item_id
    wa_msg = f"Olá! Vi no site a peça:\n\n*{title}*\nPreço: R$ {price}\n\nQuero comprar direto!"
    wa_url = f"https://wa.me/5553991170950?text={wa_msg.replace(' ', '%20').replace('!', '%21').replace(chr(10), '%0A').replace('*', '%2A')}"

    html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} | Izzat Car Imports</title>
<meta name="description" content="{title} - Peça original com procedência legal. R$ {price}. Garantia 90 dias, envio todo Brasil. CDV credenciado Detran-RS. Compre pelo site ou Mercado Livre.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://www.izzatcarimports.com.br/peca/{slug}.html">
<meta property="og:title" content="{title} | Izzat Car Imports">
<meta property="og:description" content="R$ {price} - Peça original, garantia 90 dias, envio todo Brasil">
<meta property="og:image" content="{img}">
<meta property="og:type" content="product">
<script type="application/ld+json">
{{
    "@context":"https://schema.org",
    "@type":"Product",
    "name":"{title}",
    "image":"{img}",
    "description":"Peça automotiva original com procedência legal. CDV credenciado Detran-RS nº 01060. Garantia 90 dias com lacre Izzat Car.",
    "brand":{{"@type":"Brand","name":"{brand if brand else 'Original'}"}},
    "offers":{{
        "@type":"Offer",
        "price":"{price_raw}",
        "priceCurrency":"BRL",
        "availability":"https://schema.org/InStock",
        "seller":{{"@type":"Organization","name":"Izzat Car Imports"}},
        "url":"https://www.izzatcarimports.com.br/peca/{slug}.html"
    }},
    "itemCondition":"https://schema.org/NewCondition"
}}
</script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
:root{{--p:#FF6B00;--pd:#CC5500;--d:#06060D;--d2:#0B0B18;--d3:#111125;--w:#FFF;--g:#9090B0;--gl:#D0D0E8;--gr:#25D366}}
body{{font-family:'Inter',sans-serif;background:var(--d);color:var(--w)}}
.c{{max-width:1000px;margin:0 auto;padding:0 24px}}
.nav{{position:fixed;top:0;left:0;width:100%;z-index:100;background:rgba(6,6,13,.9);backdrop-filter:blur(24px);border-bottom:1px solid rgba(255,107,0,.08);padding:14px 0}}
.nav .c{{display:flex;justify-content:space-between;align-items:center}}
.logo{{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--w);text-decoration:none}}
.logo span{{color:var(--p)}}
.back{{color:var(--g);text-decoration:none;font-size:14px}}
.back:hover{{color:var(--p)}}
.product{{padding:100px 0 60px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}}
.prod-img{{width:100%;border-radius:16px;background:var(--d3);aspect-ratio:1;object-fit:cover}}
.prod-title{{font-family:'Space Grotesk',sans-serif;font-size:clamp(24px,3vw,36px);font-weight:700;letter-spacing:-1px;margin-bottom:16px;line-height:1.2}}
.prod-price{{font-family:'Space Grotesk',sans-serif;font-size:40px;font-weight:700;color:var(--p);margin-bottom:8px}}
.prod-price small{{font-size:14px;color:var(--g);font-weight:400;display:block;margin-top:4px}}
.badges{{display:flex;gap:8px;margin:20px 0;flex-wrap:wrap}}
.badge{{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700}}
.b-orig{{background:rgba(255,107,0,.1);color:var(--p);border:1px solid rgba(255,107,0,.2)}}
.b-gar{{background:rgba(37,211,102,.1);color:var(--gr);border:1px solid rgba(37,211,102,.2)}}
.b-nf{{background:rgba(0,212,255,.1);color:#00D4FF;border:1px solid rgba(0,212,255,.2)}}
.btns{{display:flex;flex-direction:column;gap:12px;margin-top:24px}}
.btn{{padding:18px 0;border-radius:14px;font-size:16px;font-weight:700;text-align:center;text-decoration:none;color:var(--w);transition:all .3s;display:block}}
.btn-wa{{background:var(--gr);box-shadow:0 4px 20px rgba(37,211,102,.3)}}
.btn-wa:hover{{background:#1EBE5A;transform:translateY(-2px)}}
.btn-ml{{background:var(--p);box-shadow:0 4px 20px rgba(255,107,0,.3)}}
.btn-ml:hover{{background:var(--pd);transform:translateY(-2px)}}
.features{{margin-top:32px;display:flex;flex-direction:column;gap:12px}}
.feat{{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--gl)}}
.feat i{{color:var(--gr);font-style:normal}}
.foot{{padding:32px 0;border-top:1px solid rgba(255,255,255,.04);text-align:center}}
.foot p{{font-size:13px;color:var(--g)}}
.foot a{{color:var(--p);text-decoration:none}}
@media(max-width:768px){{.product{{grid-template-columns:1fr;gap:24px;padding-top:80px}}.prod-price{{font-size:32px}}}}
</style>
</head>
<body>
<nav class="nav"><div class="c"><a href="../index.html" class="logo">IZZAT <span>CAR</span></a><a href="../catalogo.html" class="back">&larr; Voltar ao catálogo</a></div></nav>
<main class="c">
<div class="product">
<img src="{img}" alt="{title}" class="prod-img">
<div>
<h1 class="prod-title">{title}</h1>
<div class="prod-price">R$ {price}<small>à vista no Pix ou em até 12x no cartão</small></div>
<div class="badges">
<span class="badge b-orig">Original de Fábrica</span>
<span class="badge b-gar">Garantia 90 Dias</span>
<span class="badge b-nf">Nota Fiscal</span>
</div>
<div class="btns">
<a href="{wa_url}" target="_blank" class="btn btn-wa">Comprar Direto pelo WhatsApp (sem taxa)</a>
<a href="{url_ml}" target="_blank" class="btn btn-ml">Comprar pelo Mercado Livre</a>
</div>
<div class="features">
<div class="feat"><i>&#10003;</i> Peça original com procedência legal</div>
<div class="feat"><i>&#10003;</i> CDV credenciado Detran-RS nº 01060</div>
<div class="feat"><i>&#10003;</i> Garantia 90 dias com lacre Izzat Car</div>
<div class="feat"><i>&#10003;</i> Nota fiscal em todas as peças</div>
<div class="feat"><i>&#10003;</i> Envio para todo Brasil com rastreamento</div>
<div class="feat"><i>&#10003;</i> Atendimento 24 horas pelo WhatsApp</div>
</div>
</div>
</div>
</main>
<footer class="foot"><div class="c"><p>&copy; 2022-2026 <a href="../index.html">Izzat Car Imports</a> — CDV Detran-RS 01060 — (53) 99117-0950</p></div></footer>
</body>
</html>'''

    return slug, html

def main():
    print("=" * 50)
    print("  IZZAT CAR — Páginas Individuais por Peça")
    print("=" * 50)

    with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    products = data["products"]
    print(f"\n{len(products)} produtos")

    PECA_DIR.mkdir(exist_ok=True)

    sitemap_entries = []
    count = 0

    for p in products:
        slug, html = generate_page(p)
        filepath = PECA_DIR / f"{slug}.html"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        sitemap_entries.append(f"https://www.izzatcarimports.com.br/peca/{slug}.html")
        count += 1
        if count % 100 == 0:
            print(f"  {count}/{len(products)}...")

    print(f"\n{count} páginas geradas em {PECA_DIR}")

    # Atualizar sitemap com páginas individuais
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += '  <url><loc>https://www.izzatcarimports.com.br/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n'
    sitemap += '  <url><loc>https://www.izzatcarimports.com.br/catalogo.html</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n'
    sitemap += '  <url><loc>https://www.izzatcarimports.com.br/pecas.html</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n'
    sitemap += '  <url><loc>https://www.izzatcarimports.com.br/veiculos.html</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n'
    for url in sitemap_entries:
        sitemap += f'  <url><loc>{url}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n'
    sitemap += '</urlset>'

    with open(SITE_DIR / "sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap)

    print(f"Sitemap atualizado com {len(sitemap_entries)} URLs de peças")
    print(f"\nPRONTO! Cada peça tem sua própria página no Google.")

if __name__ == "__main__":
    main()
