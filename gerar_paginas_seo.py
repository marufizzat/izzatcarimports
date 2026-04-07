"""
IZZAT CAR - Gerador de Páginas SEO
Gera páginas estáticas com todos os produtos para o Google indexar.
Quando alguém buscar um OEM no Google, aparece nosso site.
"""

import json
import os
from pathlib import Path

SITE_DIR = Path(r"C:\Users\Administrator\Desktop\IzzatCar\site")
PRODUCTS_FILE = SITE_DIR / "products.json"

def load_products():
    with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["products"], data.get("updated_at", "")

def generate_product_schema(product):
    """Schema.org Product markup pra Google Rich Results."""
    price = f"{product['price']:.2f}"
    return {
        "@type": "Product",
        "name": product["title"],
        "image": product["img"],
        "url": product["url"],
        "brand": {"@type": "Brand", "name": product.get("brand", "Original")},
        "offers": {
            "@type": "Offer",
            "price": price,
            "priceCurrency": "BRL",
            "availability": "https://schema.org/InStock",
            "seller": {"@type": "Organization", "name": "Izzat Car Imports"},
            "url": product["url"]
        },
        "itemCondition": "https://schema.org/NewCondition",
        "description": f"Peça original com procedência legal. Garantia 90 dias com lacre Izzat Car. Envio para todo Brasil."
    }

def generate_catalog_seo_page(products, updated_at):
    """Gera página HTML estática com TODOS os produtos visíveis pro Google."""

    # Agrupar por marca
    brands = {}
    for p in products:
        brand = p.get("brand", "Outras")
        if not brand:
            brand = "Outras"
        if brand not in brands:
            brands[brand] = []
        brands[brand].append(p)

    # Ordenar marcas
    sorted_brands = sorted(brands.keys())

    # Schema de todos os produtos
    schemas = []
    for p in products[:100]:  # Top 100 pro schema (limite Google)
        schemas.append(generate_product_schema(p))

    schema_json = json.dumps({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Peças Automotivas Originais - Izzat Car Imports",
        "numberOfItems": len(products),
        "itemListElement": [
            {"@type": "ListItem", "position": i+1, "item": s}
            for i, s in enumerate(schemas)
        ]
    }, ensure_ascii=False)

    # Gerar HTML dos produtos
    products_html = ""
    for brand in sorted_brands:
        items = brands[brand]
        products_html += f'<div class="brand-section" id="marca-{brand.lower().replace(" ","-")}">\n'
        products_html += f'<h2 class="brand-title">Peças {brand} Originais ({len(items)} peças)</h2>\n'
        products_html += '<div class="seo-grid">\n'

        for p in items:
            price = f"{p['price']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            wa_msg = f"Olá! Vi no site a peça: {p['title']} - R$ {price}. Está disponível?"
            wa_url = f"https://wa.me/5553991170950?text={wa_msg.replace(' ', '%20').replace('!', '%21')}"

            products_html += f'''<article class="seo-card" itemscope itemtype="https://schema.org/Product">
    <a href="{p['url']}" target="_blank" class="seo-img-link">
        <img src="{p['img']}" alt="{p['title']}" loading="lazy" itemprop="image" class="seo-img">
    </a>
    <div class="seo-info">
        <h3 itemprop="name" class="seo-title">{p['title']}</h3>
        <div class="seo-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
            <span itemprop="price" content="{p['price']:.2f}">R$ {price}</span>
            <meta itemprop="priceCurrency" content="BRL">
            <meta itemprop="availability" content="https://schema.org/InStock">
        </div>
        <div class="seo-buttons">
            <a href="{p['url']}" target="_blank" class="seo-btn-ml">Ver no Mercado Livre</a>
            <a href="{wa_url}" target="_blank" class="seo-btn-wa">Comprar Direto</a>
        </div>
    </div>
</article>\n'''

        products_html += '</div>\n</div>\n'

    # Brand index
    brand_index = ""
    for brand in sorted_brands:
        count = len(brands[brand])
        brand_index += f'<a href="#marca-{brand.lower().replace(" ","-")}" class="brand-link">{brand} ({count})</a>\n'

    html = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Peças Automotivas Originais - Comprar Online | Izzat Car Imports</title>
    <meta name="description" content="Compre peças automotivas originais com procedência legal. {len(products)} peças disponíveis: Volkswagen, Chevrolet, Fiat, Ford, Toyota, Honda, BMW, Mercedes, Audi, Volvo, Jaguar. Garantia 90 dias, envio todo Brasil. Pesquise por código OEM.">
    <meta name="keywords" content="comprar peças originais, peças OEM, código OEM peças, autopeças originais online, peças com procedência legal, {", ".join(f"peças {b} originais" for b in sorted_brands[:15])}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://www.izzatcarimports.com.br/pecas.html">
    <meta property="og:title" content="Peças Automotivas Originais | Izzat Car Imports">
    <meta property="og:description" content="{len(products)} peças originais com garantia 90 dias. Busque por código OEM.">
    <script type="application/ld+json">{schema_json}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        :root {{
            --primary: #FF6B00;
            --primary-dark: #CC5500;
            --dark: #06060D;
            --dark-2: #0B0B18;
            --dark-3: #111125;
            --dark-4: #181832;
            --white: #FFFFFF;
            --gray: #9090B0;
            --gray-light: #D0D0E8;
            --green: #25D366;
        }}
        html {{ scroll-behavior: smooth; }}
        body {{ font-family: 'Inter', sans-serif; background: var(--dark); color: var(--white); }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 0 24px; }}

        /* NAVBAR */
        .navbar {{
            position: fixed; top: 0; left: 0; width: 100%; z-index: 1000;
            background: rgba(6,6,13,0.9); backdrop-filter: blur(24px);
            border-bottom: 1px solid rgba(255,107,0,0.08); padding: 14px 0;
        }}
        .navbar .container {{ display: flex; justify-content: space-between; align-items: center; }}
        .logo {{ font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 700; color: var(--white); text-decoration: none; }}
        .logo span {{ color: var(--primary); }}
        .nav-links {{ display: flex; gap: 28px; list-style: none; align-items: center; }}
        .nav-links a {{ color: var(--gray); text-decoration: none; font-size: 14px; font-weight: 500; }}
        .nav-links a:hover, .nav-links a.active {{ color: var(--white); }}
        .nav-cta {{ background: var(--primary) !important; color: var(--white) !important; padding: 10px 20px !important; border-radius: 8px !important; font-weight: 600 !important; }}

        /* HEADER */
        .page-header {{
            padding: 120px 0 40px;
            text-align: center;
            background: radial-gradient(ellipse at top, rgba(255,107,0,0.05) 0%, transparent 60%);
        }}
        .page-header h1 {{
            font-family: 'Space Grotesk', sans-serif;
            font-size: clamp(28px, 4vw, 48px);
            font-weight: 700; letter-spacing: -1.5px; margin-bottom: 12px;
        }}
        .page-header h1 em {{ color: var(--primary); font-style: normal; }}
        .page-header p {{ font-size: 16px; color: var(--gray); max-width: 700px; margin: 0 auto 24px; line-height: 1.6; }}
        .page-header .count {{ color: var(--primary); font-weight: 700; font-size: 18px; }}

        /* BRAND INDEX */
        .brand-index {{
            display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
            padding: 24px 0; margin-bottom: 24px;
            border-bottom: 1px solid rgba(255,107,0,0.08);
        }}
        .brand-link {{
            padding: 8px 16px; background: var(--dark-3); border: 1px solid rgba(255,255,255,0.05);
            border-radius: 100px; font-size: 13px; font-weight: 600; color: var(--gray-light);
            text-decoration: none; transition: all 0.3s;
        }}
        .brand-link:hover {{ border-color: var(--primary); color: var(--primary); }}

        /* BRAND SECTION */
        .brand-section {{ margin-bottom: 60px; }}
        .brand-title {{
            font-family: 'Space Grotesk', sans-serif;
            font-size: 28px; font-weight: 700; margin-bottom: 24px;
            padding-bottom: 12px;
            border-bottom: 2px solid rgba(255,107,0,0.15);
            color: var(--white);
        }}

        /* PRODUCT GRID */
        .seo-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
        }}
        .seo-card {{
            background: var(--dark-3); border: 1px solid rgba(255,255,255,0.04);
            border-radius: 14px; overflow: hidden; transition: all 0.3s;
            display: flex; flex-direction: column;
        }}
        .seo-card:hover {{ border-color: rgba(255,107,0,0.2); transform: translateY(-4px); }}
        .seo-img-link {{ display: block; }}
        .seo-img {{ width: 100%; aspect-ratio: 1; object-fit: cover; background: var(--dark-4); display: block; }}
        .seo-info {{ padding: 14px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }}
        .seo-title {{ font-size: 13px; font-weight: 500; color: var(--gray-light); line-height: 1.4; margin-bottom: 10px; }}
        .seo-price {{ font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; color: var(--primary); margin-bottom: 12px; }}
        .seo-buttons {{ display: flex; gap: 6px; }}
        .seo-btn-ml, .seo-btn-wa {{
            flex: 1; padding: 10px 0; border: none; border-radius: 8px; color: var(--white);
            font-size: 12px; font-weight: 700; text-align: center; text-decoration: none; transition: all 0.3s;
        }}
        .seo-btn-ml {{ background: var(--primary); }}
        .seo-btn-ml:hover {{ background: var(--primary-dark); }}
        .seo-btn-wa {{ background: var(--green); }}
        .seo-btn-wa:hover {{ background: #1EBE5A; }}

        /* FOOTER */
        .footer {{ padding: 32px 0; border-top: 1px solid rgba(255,255,255,0.04); text-align: center; }}
        .footer p {{ font-size: 13px; color: var(--gray); }}
        .footer a {{ color: var(--primary); text-decoration: none; }}

        /* WHATSAPP */
        .wa-float {{
            position: fixed; bottom: 28px; right: 28px; z-index: 999;
            width: 60px; height: 60px; background: var(--green); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 24px rgba(37,211,102,0.4); text-decoration: none;
        }}
        .wa-float svg {{ width: 30px; height: 30px; fill: white; }}

        @media (max-width: 768px) {{
            .seo-grid {{ grid-template-columns: repeat(2, 1fr); gap: 10px; }}
            .seo-title {{ font-size: 11px; }}
            .seo-price {{ font-size: 18px; }}
            .nav-links {{ display: none; }}
        }}
    </style>
</head>
<body>

    <nav class="navbar">
        <div class="container">
            <a href="index.html" class="logo">IZZAT <span>CAR</span></a>
            <ul class="nav-links">
                <li><a href="index.html">Home</a></li>
                <li><a href="catalogo.html">Catálogo</a></li>
                <li><a href="pecas.html" class="active">Peças SEO</a></li>
                <li><a href="veiculos.html">Veículos</a></li>
                <li><a href="index.html#contato">Contato</a></li>
                <li><a href="https://wa.me/5553991170950" class="nav-cta" target="_blank">WhatsApp</a></li>
            </ul>
        </div>
    </nav>

    <section class="page-header">
        <div class="container">
            <h1>Peças Automotivas <em>Originais</em></h1>
            <p>CDV credenciado Detran-RS nº 01060. Todas as peças com procedência legal, nota fiscal e garantia de 90 dias. Envio para todo o Brasil.</p>
            <p class="count">{len(products)} peças disponíveis — Atualizado em {updated_at[:10] if updated_at else "hoje"}</p>
        </div>
    </section>

    <main>
        <div class="container">
            <div class="brand-index">
                {brand_index}
            </div>
            {products_html}
        </div>
    </main>

    <footer class="footer">
        <div class="container">
            <p>&copy; 2022-2026 <a href="index.html">Izzat Car Imports</a> — CDV Credenciado Detran-RS nº 01060 — Rua 504, 120 - Aceguá/RS — (53) 99117-0950</p>
        </div>
    </footer>

    <a href="https://wa.me/5553991170950" class="wa-float" target="_blank">
        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </a>

</body>
</html>'''

    return html

def update_sitemap(products):
    """Atualiza sitemap com a página de peças."""
    sitemap = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.izzatcarimports.com.br/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://www.izzatcarimports.com.br/catalogo.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://www.izzatcarimports.com.br/pecas.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>https://www.izzatcarimports.com.br/veiculos.html</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>'''

    with open(SITE_DIR / "sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap)

def main():
    print("=" * 50)
    print("  IZZAT CAR — Gerador de Páginas SEO")
    print("=" * 50)

    products, updated_at = load_products()
    print(f"\n{len(products)} produtos carregados")

    # Gerar página SEO
    html = generate_catalog_seo_page(products, updated_at)
    output = SITE_DIR / "pecas.html"
    with open(output, "w", encoding="utf-8") as f:
        f.write(html)

    size_mb = output.stat().st_size / 1024 / 1024
    print(f"Gerado: {output} ({size_mb:.1f} MB)")

    # Atualizar sitemap
    update_sitemap(products)
    print("Sitemap atualizado")

    print(f"\nPRONTO! {len(products)} peças indexáveis pelo Google.")
    print("Cada código OEM nos títulos será encontrado nas buscas.")

if __name__ == "__main__":
    main()
