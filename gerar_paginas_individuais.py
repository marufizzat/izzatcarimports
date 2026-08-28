"""
IZZAT CAR — gerador das paginas de peca (uma URL por anuncio).

Le products.json (dado cru do Mercado Livre) e catalogo_index.js (carro, familia
e tipo ja resolvidos por gerar_indice.py) e escreve uma pagina por peca em
peca/{slug}-{MLB}.html, mais o sitemap.xml.

RODAR SEMPRE DEPOIS DE gerar_indice.py — e dele que vem "serve no seu carro".

Duas coisas que este arquivo faz e que sao faceis de esquecer:
  1. APAGA as paginas que sobraram de anuncio que saiu do ar. O gerador antigo
     so escrevia: em 28/ago havia 1.185 paginas vivas de anuncio vendido, com
     preco e botao caindo em 403.
  2. NAO carrega Pixel proprio. Ele declara window.IZZAT_PRODUCT e deixa o
     assets/izzat.js cuidar de tudo — assim regerar as paginas nao apaga o
     rastreamento, que era o que acontecia antes.
"""

import html
import json
import re
from pathlib import Path

SITE_DIR = Path(r"C:\Users\Administrator\Desktop\IzzatCar\site")
PECA_DIR = SITE_DIR / "peca"
PRODUCTS_FILE = SITE_DIR / "products.json"
INDEX_FILE = SITE_DIR / "catalogo_index.js"

SITE = "https://www.izzatcarimports.com.br"
WHATS = "5553991170950"


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[àáâãä]", "a", text)
    text = re.sub(r"[èéêë]", "e", text)
    text = re.sub(r"[ìíîï]", "i", text)
    text = re.sub(r"[òóôõö]", "o", text)
    text = re.sub(r"[ùúûü]", "u", text)
    text = re.sub(r"[ç]", "c", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:80]


def e(v):
    """Escapa pra HTML. Titulo vem do ML e ja veio com aspas e sinal de maior."""
    return html.escape(str(v or ""), quote=True)


def preco_br(v):
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def carregar_indice():
    """catalogo_index.js e um .js, mas o miolo e JSON puro."""
    if not INDEX_FILE.exists():
        raise SystemExit("Falta catalogo_index.js — rode gerar_indice.py antes.")
    txt = INDEX_FILE.read_text(encoding="utf-8").strip().rstrip(";")
    dados = json.loads(txt[txt.index("{"):])
    return {it["id"]: it for it in dados["items"]}


# --------------------------------------------------------------------------
# Descricao: o texto do ML vem com reguas de "=" e titulo em caixa alta.
# Virar HTML de verdade e a diferenca entre parecer anuncio e parecer loja.
# --------------------------------------------------------------------------
REGUA = re.compile(r"^[=\-_ ]{6,}$")


def eh_titulo(linha):
    if len(linha) > 70 or len(linha) < 3:
        return False
    letras = [c for c in linha if c.isalpha()]
    return bool(letras) and all(c.isupper() for c in letras)


def descricao_html(texto):
    blocos, paragrafo = [], []

    def fechar():
        if paragrafo:
            blocos.append("<p>" + e(" ".join(paragrafo)) + "</p>")
            paragrafo.clear()

    for linha in (texto or "").splitlines():
        linha = linha.strip()
        if not linha or REGUA.match(linha):
            fechar()
        elif eh_titulo(linha):
            fechar()
            blocos.append("<h3>" + e(linha.title()) + "</h3>")
        else:
            paragrafo.append(linha)
    fechar()
    return "\n".join(blocos)


# --------------------------------------------------------------------------
FICHA = [
    ("MODEL", "Modelo do veículo"),
    ("POSITION", "Posição"),
    ("COLOR", "Cor"),
    ("MATERIAL", "Material"),
    ("ORIGIN", "Origem"),
    ("MANUFACTURER", "Fabricante"),
]


def limpar_attr(chave, v):
    """O que esta no anuncio foi escrito pro robo de busca do ML, nao pro cliente."""
    if chave == "ORIGIN" and v.lower().startswith("original"):
        return "Original"          # 98% vem como "Original-31686384"
    if chave == "MODEL" and "/" in v:
        partes = [x.strip() for x in v.split("/") if x.strip()][:6]
        return " · ".join(partes)  # a lista do C4 tem 11 versoes e nao cabe
    return v


def ficha_html(p):
    linhas = []
    if p.get("oem"):
        linhas.append(("Código original (OEM)", p["oem"]))
    attrs = p.get("attrs") or {}
    for chave, rotulo in FICHA:
        v = (attrs.get(chave) or "").strip()
        if v and v.lower() not in ("nao", "não", "n/a"):
            linhas.append((rotulo, limpar_attr(chave, v)))
    linhas.append(("Condição", "Nova (original, removida de veículo com baixa legal)"))
    return "\n".join(
        f"<tr><th>{e(r)}</th><td>{e(v)}</td></tr>" for r, v in linhas)


def cartao_html(p, idx):
    """Card de peca parecida — mesmo desenho do catalogo."""
    info = idx.get(p["id"], {})
    slug = slugify(p["title"]) + "-" + p["id"]
    carro = " ".join(x for x in (info.get("b"), info.get("m")) if x)
    return f'''<a class="card" href="{e(slug)}.html">
  <div class="card-media"><img src="{e(p['img'])}" alt="{e(p['title'])}" loading="lazy" decoding="async"></div>
  <div class="card-body">
    <h3 class="card-title">{e(p['title'])}</h3>
    {f'<span class="card-fit">{e(carro)}</span>' if carro else ''}
    <span class="card-price">R$ {preco_br(p['price'])}</span>
  </div>
</a>'''


def generate_page(product, idx=None, parecidas=None):
    """Devolve (slug, html). idx/parecidas vazios geram a pagina sem os extras."""
    idx = idx or {}
    parecidas = parecidas or []

    titulo = product["title"]
    item_id = product["id"]
    slug = slugify(titulo) + "-" + item_id
    preco = preco_br(product["price"])
    url_pagina = f"{SITE}/peca/{slug}.html"

    info = idx.get(item_id, {})
    familia = info.get("c") or ""
    anos = info.get("y")
    carro = " ".join(x for x in (info.get("b"), info.get("m")) if x)
    serve = carro + (f" · {anos[0]} a {anos[1]}" if anos else "")

    pics = product.get("pics") or [product["img"]]
    pics = list(dict.fromkeys(pics))[:12]

    wa = ("Olá! Vi no site esta peça:\n\n"
          f"{titulo}\nR$ {preco}\n{url_pagina}\n\nAinda tem disponível?")
    wa_url = "https://wa.me/" + WHATS + "?text=" + _quote(wa)

    ld = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": titulo,
        "image": pics,
        "sku": item_id,
        "mpn": product.get("oem") or item_id,
        "description": (f"{titulo}. Peça original com procedência legal, "
                        "garantia de 90 dias e nota fiscal. "
                        "CDV credenciado Detran-RS nº 01060."),
        "brand": {"@type": "Brand", "name": product.get("brand") or "Original"},
        "offers": {
            "@type": "Offer",
            "price": f"{product['price']:.2f}",
            "priceCurrency": "BRL",
            "availability": "https://schema.org/InStock",
            "itemCondition": "https://schema.org/NewCondition",
            "url": url_pagina,
            "seller": {"@type": "Organization", "name": "Izzat Car Imports"},
        },
    }

    # O Pixel le isto. Declarado ANTES do assets/izzat.js, que dispara o
    # ViewContent com o preco — e o que faz a campanha do Meta otimizar.
    prod_js = json.dumps({
        "id": item_id, "name": titulo, "price": product["price"],
        "category": familia,
    }, ensure_ascii=False)

    galeria = "\n".join(
        f'<button class="thumb{" on" if i == 0 else ""}" type="button" '
        f'data-src="{e(u)}" aria-label="Foto {i + 1}">'
        f'<img src="{e(u)}" alt="" loading="lazy" decoding="async"></button>'
        for i, u in enumerate(pics))

    desc = descricao_html(product.get("desc"))
    cards = "\n".join(cartao_html(x, idx) for x in parecidas)

    return slug, f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)} | Izzat Car Imports</title>
<meta name="description" content="{e(titulo)} por R$ {preco}. Peça original com nota fiscal, garantia de 90 dias e envio para todo o Brasil. CDV Detran-RS 01060.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{url_pagina}">
<meta property="og:type" content="product">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="R$ {preco} · peça original, garantia de 90 dias e nota fiscal.">
<meta property="og:image" content="{e(pics[0])}">
<meta property="og:url" content="{url_pagina}">
<meta property="product:price:amount" content="{product['price']:.2f}">
<meta property="product:price:currency" content="BRL">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://http2.mlstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/izzat.css">
<script>window.IZZAT_PRODUCT = {prod_js};</script>
<script src="../assets/izzat.js"></script>

<style>
  .trilha {{ font-size: 13px; color: var(--text-dim); padding-top: var(--s5); }}
  .trilha a {{ color: var(--text-muted); }}
  .trilha a:hover {{ color: var(--primary); }}
  .trilha span {{ margin: 0 6px; opacity: .5; }}

  .peca {{ display: grid; grid-template-columns: 1.05fr .95fr; gap: var(--s7); align-items: start; padding-block: var(--s5) var(--s7); }}

  .foto {{ background: #fff; border-radius: var(--r-lg); aspect-ratio: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; }}
  .foto img {{ width: 100%; height: 100%; object-fit: contain; padding: var(--s5); }}
  .thumbs {{ display: flex; gap: var(--s2); margin-top: var(--s3); overflow-x: auto; padding-bottom: var(--s2); }}
  .thumb {{ flex: none; width: 66px; height: 66px; border-radius: var(--r-sm); border: 2px solid var(--line); background: #fff; overflow: hidden; }}
  .thumb img {{ width: 100%; height: 100%; object-fit: contain; padding: 4px; }}
  .thumb.on {{ border-color: var(--primary); }}

  .info h1 {{ font-size: clamp(22px, 2.4vw, 30px); line-height: 1.25; margin-bottom: var(--s3); }}
  .serve {{ display: flex; align-items: center; gap: var(--s2); background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--s3) var(--s4); margin-bottom: var(--s4); }}
  .serve b {{ display: block; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-dim); }}
  .serve span {{ font-size: 16px; color: var(--text); }}

  .preco {{ font-family: var(--font-h); font-size: 40px; font-weight: 700; line-height: 1; }}
  .preco-sub {{ font-size: 14px; color: var(--text-muted); margin-top: var(--s2); }}
  .tags {{ display: flex; flex-wrap: wrap; gap: var(--s2); margin: var(--s4) 0; }}

  .acoes {{ display: flex; flex-direction: column; gap: var(--s3); margin: var(--s5) 0; }}
  .acoes .btn {{ min-height: 54px; font-size: 16px; }}

  .oem {{ display: flex; align-items: center; justify-content: space-between; gap: var(--s3); background: var(--surface-2); border: 1px dashed var(--line-strong); border-radius: var(--r-md); padding: var(--s3) var(--s4); }}
  .oem b {{ display: block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-dim); }}
  .oem code {{ font-family: var(--font-h); font-size: 18px; color: var(--primary-light); letter-spacing: .04em; }}

  .garantias {{ list-style: none; margin-top: var(--s5); display: grid; gap: var(--s3); }}
  .garantias li {{ display: flex; gap: var(--s3); font-size: 14px; color: var(--text-muted); }}
  .garantias svg {{ width: 18px; height: 18px; flex: none; color: var(--green); margin-top: 2px; }}

  .abaixo {{ padding-bottom: var(--s8); display: grid; gap: var(--s7); }}
  .bloco-h2 {{ font-size: 22px; margin-bottom: var(--s4); }}
  table.ficha {{ width: 100%; border-collapse: collapse; font-size: 15px; max-width: 720px; }}
  table.ficha th, table.ficha td {{ text-align: left; padding: var(--s3) 0; border-bottom: 1px solid var(--line); vertical-align: top; }}
  table.ficha th {{ color: var(--text-dim); font-weight: 500; width: 220px; }}
  table.ficha td {{ color: var(--text); }}

  .desc {{ max-width: 760px; color: var(--text-muted); font-size: 15px; line-height: 1.75; }}
  .desc h3 {{ font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: var(--text); margin: var(--s5) 0 var(--s2); }}
  .desc h3:first-child {{ margin-top: 0; }}
  .desc p {{ margin-bottom: var(--s3); }}
  .desc-caixa[open] summary {{ margin-bottom: var(--s4); }}
  .desc-caixa summary {{ cursor: pointer; color: var(--primary); font-weight: 600; list-style: none; }}
  .desc-caixa summary::-webkit-details-marker {{ display: none; }}

  @media (max-width: 900px) {{
    .peca {{ grid-template-columns: 1fr; gap: var(--s5); }}
    .preco {{ font-size: 34px; }}
  }}
</style>
</head>
<body>

<nav class="nav">
  <div class="wrap">
    <a href="../index.html" class="logo">IZZAT <span>CAR</span></a>
    <button class="nav-toggle" aria-label="Abrir menu" aria-expanded="false">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>
    <ul class="nav-links">
      <li><a href="../index.html">Início</a></li>
      <li><a href="../catalogo.html">Catálogo</a></li>
      <li><a href="../veiculos.html">Veículos</a></li>
      <li><a href="https://wa.me/{WHATS}" class="btn btn-whats btn-sm" target="_blank" rel="noopener">WhatsApp</a></li>
    </ul>
  </div>
</nav>

<div class="wrap trilha">
  <a href="../index.html">Início</a><span>/</span><a href="../catalogo.html">Catálogo</a>{f'<span>/</span><a href="../catalogo.html?tipo={_quote(familia)}">{e(familia)}</a>' if familia else ''}
</div>

<main class="wrap peca">

  <div>
    <div class="foto"><img id="fotoGrande" src="{e(pics[0])}" alt="{e(titulo)}" fetchpriority="high"></div>
    {f'<div class="thumbs">{galeria}</div>' if len(pics) > 1 else ''}
  </div>

  <div class="info">
    <h1>{e(titulo)}</h1>

    {f'<div class="serve"><div><b>Serve em</b><span>{e(serve)}</span></div></div>' if serve else ''}

    <div class="preco">R$ {preco}</div>
    <div class="preco-sub">à vista no Pix · ou em até 12x no cartão pelo Mercado Livre</div>

    <div class="tags">
      <span class="tag tag-oem">Peça original</span>
      <span class="tag">Garantia 90 dias</span>
      <span class="tag">Nota fiscal</span>
      {'<span class="tag tag-free">Frete grátis</span>' if product.get("free_shipping") else ''}
    </div>

    <div class="acoes">
      <a class="btn btn-whats btn-lg" href="{e(wa_url)}" target="_blank" rel="noopener">Comprar pelo WhatsApp</a>
      <a class="btn btn-primary btn-lg" href="{e(product['url'])}" target="_blank" rel="noopener">Comprar pelo Mercado Livre</a>
    </div>

    <div class="oem">
      <div><b>Código da peça</b><code id="oemTxt">{e(product.get('oem') or item_id)}</code></div>
      <button class="btn btn-ghost btn-sm" id="copiarOem" type="button">Copiar</button>
    </div>

    <ul class="garantias">
      <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>Original de fábrica, retirada de veículo com baixa legal no Detran-RS.</span></li>
      <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>90 dias de garantia, com lacre de identificação Izzat Car.</span></li>
      <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>Nota fiscal em toda venda. CDV credenciado nº 01060.</span></li>
      <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>Envio para todo o Brasil, com código de rastreio.</span></li>
    </ul>
  </div>
</main>

<div class="wrap abaixo">
  <section>
    <h2 class="bloco-h2">Ficha da peça</h2>
    <table class="ficha">{ficha_html(product)}</table>
  </section>

  {f'''<section>
    <h2 class="bloco-h2">Descrição</h2>
    <details class="desc-caixa">
      <summary>Ler a descrição completa</summary>
      <div class="desc">{desc}</div>
    </details>
  </section>''' if desc else ''}

  {f'''<section>
    <h2 class="bloco-h2">Outras peças {("de " + e(carro)) if carro else "parecidas"}</h2>
    <div class="grid-products">{cards}</div>
  </section>''' if cards else ''}
</div>

<footer class="foot">
  <div class="wrap foot-bottom">
    <span>&copy; 2022-2026 Izzat Car Imports — CDV Detran-RS nº 01060</span>
    <span><a href="https://wa.me/{WHATS}" target="_blank" rel="noopener">(53) 99117-0950</a> · Aceguá/RS</span>
  </div>
</footer>

<a class="whats-float" href="{e(wa_url)}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 015.83 2.42 8.18 8.18 0 012.41 5.82c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.17 1.71 2.62 4.15 3.67.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29z"/></svg>
</a>

<script>
(function () {{
  var grande = document.getElementById('fotoGrande');
  document.querySelectorAll('.thumb').forEach(function (t) {{
    t.addEventListener('click', function () {{
      grande.src = t.dataset.src;
      document.querySelectorAll('.thumb.on').forEach(function (o) {{ o.classList.remove('on'); }});
      t.classList.add('on');
    }});
  }});

  var btn = document.getElementById('copiarOem');
  btn.addEventListener('click', function () {{
    var txt = document.getElementById('oemTxt').textContent;
    navigator.clipboard.writeText(txt).then(function () {{
      btn.textContent = 'Copiado';
      setTimeout(function () {{ btn.textContent = 'Copiar'; }}, 1600);
    }});
  }});
}})();
</script>
</body>
</html>'''


def _quote(s):
    from urllib.parse import quote
    return quote(str(s), safe="")


# --------------------------------------------------------------------------
def escolher_parecidas(p, por_carro, por_marca, quantas=4):
    """Mesmo carro primeiro; se o carro tem pouca peca, completa com a marca."""
    vistos = {p["id"]}
    saida = []
    info_key = por_carro.get(p["id"])
    for grupo in (info_key, por_marca.get(p["id"])):
        for outro in (grupo or []):
            if outro["id"] in vistos:
                continue
            vistos.add(outro["id"])
            saida.append(outro)
            if len(saida) == quantas:
                return saida
    return saida


def main():
    print("=" * 52)
    print("  IZZAT CAR — paginas de peca")
    print("=" * 52)

    idx = carregar_indice()
    produtos = json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))["products"]
    print(f"produtos: {len(produtos)} | no indice: {len(idx)}")

    # Agrupamentos usados pelo bloco "outras pecas deste carro".
    carros, marcas = {}, {}
    for p in produtos:
        i = idx.get(p["id"], {})
        if i.get("b") and i.get("m"):
            carros.setdefault((i["b"], i["m"]), []).append(p)
        if i.get("b"):
            marcas.setdefault(i["b"], []).append(p)

    por_carro, por_marca = {}, {}
    for p in produtos:
        i = idx.get(p["id"], {})
        por_carro[p["id"]] = carros.get((i.get("b"), i.get("m")), [])[:12]
        por_marca[p["id"]] = marcas.get(i.get("b"), [])[:12]

    PECA_DIR.mkdir(exist_ok=True)

    esperados, urls = set(), []
    for n, p in enumerate(produtos, 1):
        parecidas = escolher_parecidas(p, por_carro, por_marca)
        slug, pagina = generate_page(p, idx, parecidas)
        nome = f"{slug}.html"
        (PECA_DIR / nome).write_text(pagina, encoding="utf-8")
        esperados.add(nome)
        urls.append(f"{SITE}/peca/{slug}.html")
        if n % 500 == 0:
            print(f"  {n}/{len(produtos)}...")
    print(f"{len(esperados)} paginas escritas")

    # Anuncio que saiu do ar nao pode continuar com pagina viva no ar.
    sobrando = [f for f in PECA_DIR.glob("*.html") if f.name not in esperados]
    for f in sobrando:
        f.unlink()
    print(f"{len(sobrando)} paginas antigas apagadas")

    fixas = [("/", "weekly", "1.0"), ("/catalogo.html", "daily", "0.9"),
             ("/veiculos.html", "weekly", "0.7")]
    linhas = [f"  <url><loc>{SITE}{u}</loc><changefreq>{c}</changefreq>"
              f"<priority>{pr}</priority></url>" for u, c, pr in fixas]
    linhas += [f"  <url><loc>{u}</loc><changefreq>weekly</changefreq>"
               f"<priority>0.8</priority></url>" for u in urls]
    (SITE_DIR / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(linhas) + "\n</urlset>\n", encoding="utf-8")
    print(f"sitemap.xml: {len(linhas)} URLs")


if __name__ == "__main__":
    main()
