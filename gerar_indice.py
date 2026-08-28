"""
IZZAT CAR - Gerador do indice de busca do catalogo.

Le products.json e escreve catalogo_index.js, que e o que a pagina do catalogo
carrega pra deixar o cliente achar a peca por CARRO, por TIPO DE PECA ou por
CODIGO OEM (a busca antiga so olhava o titulo).

Rodar depois de atualizar_catalogo.py:
    PYTHONIOENCODING=utf-8 python gerar_indice.py

Depende de categorias_ml.json (nomes das categorias do ML). Se faltar categoria
nova, busca sozinho na API publica do ML e regrava o cache.
"""

import json
import re
import time
import unicodedata
import urllib.request
import concurrent.futures as cf
from collections import Counter, defaultdict
from pathlib import Path

from gerar_paginas_individuais import slugify

SITE_DIR = Path(__file__).resolve().parent

# Marcas que o ML/nossos titulos escrevem de mais de um jeito. Sem isso o
# cliente clica em "Chevrolet" e some 3/4 das pecas dele (ficaram em "GM").
BRAND_CANON = {
    "gm": "Chevrolet",
    "chevrolet": "Chevrolet",
    "vw": "Volkswagen",
    "volkswagen": "Volkswagen",
    "mercedes": "Mercedes-Benz",
    "mercedes-benz": "Mercedes-Benz",
    "citroen": "Citroën",
    "citroën": "Citroën",
}

# As 50 familias cruas do ML tem sinonimo ("Interior" e "Pecas de Interior" sao
# a mesma coisa) e um monte de familia com 1-2 pecas. Aqui viram um conjunto
# curto que o cliente entende.
FAMILY_CANON = {
    "Interior": "Peças de Interior",
    "Acessórios de Interior": "Peças de Interior",
    "Peças de Cabine": "Peças de Interior",
    "Cabine": "Peças de Interior",
    "Exterior": "Peças de Exterior",
    "Acessórios de Exterior": "Peças de Exterior",
    "Tuning Exterior": "Peças de Exterior",
    "Chaves": "Fechaduras e Chaves",
    "Faróis e Lanternas": "Iluminação",
    "Motores e Peças": "Motor",
    "Elevação": "Janelas e Vedações",
    "Sensores": "Sistema Elétrico",
    "Controles": "Sistema Elétrico",
    "Elétricos, Híbridos e PHEV": "Sistema Elétrico",
    "Eletroventiladores": "Arrefecimento",
    "Sistemas de Refrigeração": "Arrefecimento",
    "Alarmes e Acessórios": "Segurança",
    "Sirenes": "Segurança",
    "Triângulos de Segurança": "Segurança",
    "Kit de Segurança para Carros": "Segurança",
    "Ferragens de Segurança": "Segurança",
    "Reprodutores": "Som e Multimídia",
    "Alto-Falantes": "Som e Multimídia",
    "Grades para Caixas de Som": "Som e Multimídia",
    "Módulos Amplificadores": "Som e Multimídia",
    "Antenas": "Som e Multimídia",
    "Telas": "Som e Multimídia",
    "Interfaces": "Som e Multimídia",
    "Chassis": "Suspensão e Direção",
    "Condução Assistida Avançada": "Sistema Elétrico",
    "Rodas de Carros e Caminhonetes": "Suspensão e Direção",
    "Acessórios": "Outros",
}

# Palavras que aparecem depois da marca no titulo mas NAO fazem parte do nome do
# carro (motorizacao, versao, posicao). Cortar isso e o que junta "Xc60 2.0 T8"
# e "Xc60" no mesmo modelo.
MODEL_STOP = re.compile(
    r"\b(\d{1,2}[.,]\d\w*|\d{1,2}v|16v|8v|turbo|tsi|tdi|gdi|crdi|flex(power)?|"
    r"hibrido|híbrido|ecoboost|"
    r"biturbo|hybrid|híbrido|mhev|phev|t\d|p\d{3}|d\d|tce|thp|vti|hdi|dci|"
    r"tfsi|tfsl|fsi|recharge|sportline|comfortline|highline|trendline|premier|"
    r"limited|preto|preta|branco|branca|prata|cinza|azul|vermelho|vermelha|"
    r"verde|bege|marrom|dourado|"
    r"aut|automatico|automático|manual|cvt|4x4|awd|diant|dianteiro|dianteira|"
    r"tras|traseiro|traseira|esq|esquerdo|esquerda|dir|direito|direita|"
    r"original|orig|sup|inf|le|ld)\b",
    re.I,
)


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def slug(s):
    s = strip_accents(str(s)).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def load_categorias(products):
    """Nomes das categorias do ML, com cache em disco."""
    p = SITE_DIR / "categorias_ml.json"
    cache = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    ids = sorted({x.get("category_id") for x in products if x.get("category_id")})
    faltam = [c for c in ids if c not in cache]

    if faltam:
        print(f"  buscando {len(faltam)} categorias novas no ML...")

        def pega(cid):
            for _ in range(3):
                try:
                    req = urllib.request.Request(
                        f"https://api.mercadolibre.com/categories/{cid}",
                        headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=20) as r:
                        x = json.load(r)
                    return cid, {"nome": x["name"],
                                 "path": [n["name"] for n in x.get("path_from_root", [])]}
                except Exception:
                    pass
            return cid, None

        with cf.ThreadPoolExecutor(max_workers=12) as ex:
            for cid, val in ex.map(pega, faltam):
                if val:
                    cache[cid] = val
        p.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")

    return cache


def familia(cat):
    """Familia da peca = nivel 3 do caminho da categoria, ja normalizada."""
    if not cat:
        return "Outros"
    path = cat.get("path") or []
    bruta = path[2] if len(path) > 2 else (path[-1] if path else "Outros")
    return FAMILY_CANON.get(bruta, bruta)


ANOS_RE = re.compile(r"\b(\d{2})/(\d{2})\b")

# Carro com nome de numero. Sem esta lista o "2008" da Peugeot e apagado como se
# fosse ano e 106 dos 128 anuncios Peugeot ficam sem modelo nenhum.
MODELO_NUM = {
    "Peugeot": {"106", "205", "206", "207", "208", "2008", "306", "307", "308",
                "3008", "405", "406", "407", "408", "508", "5008"},
}

# Codigo OEM disfarcado de nome de carro ("Fusion Ds7t-14f239-bp"). Modelo de
# verdade tem no maximo 6 caracteres quando mistura letra e numero (GLA200, XC60).
CODIGO_LIXO = re.compile(r"^(?=.*\d)(?=.*[A-Za-z])[0-9A-Za-z-]{7,}$"
                         r"|^\d{2}[0-9A-Za-z-]{4,}$")


def anos(titulo):
    """'18/24' -> (2018, 2024). Titulo sem anos devolve (None, None)."""
    m = ANOS_RE.search(titulo)
    if not m:
        return None, None

    def full(v):
        v = int(v)
        return 1900 + v if v > 40 else 2000 + v

    a, b = full(m.group(1)), full(m.group(2))
    if b < a:
        a, b = b, a
    return a, b


def palavras_modelo(titulo, marca_canon):
    """Palavras que sobram entre a marca e os anos — cru, sem decidir nada."""
    t_sem = strip_accents(titulo).lower()
    pos_marca = -1
    fim_marca = 0
    for alias in {marca_canon, *[k for k, v in BRAND_CANON.items() if v == marca_canon]}:
        a = strip_accents(alias).lower()
        i = t_sem.find(a)
        if i >= 0 and (pos_marca < 0 or i < pos_marca):
            pos_marca, fim_marca = i, i + len(a)
    if pos_marca < 0:
        return []

    m = ANOS_RE.search(titulo)
    trecho = titulo[fim_marca:m.start()] if m else titulo[fim_marca:fim_marca + 26]
    trecho = MODEL_STOP.sub(" ", trecho)
    nums = MODELO_NUM.get(marca_canon, set())
    # Ano solto no titulo ("Honda Wr-v 2026") nao e nome de carro — mas o 2008 da
    # Peugeot e carro, e nao ano.
    trecho = re.sub(r"\b(19|20)\d{2}\b",
                    lambda m: m.group(0) if m.group(0) in nums else " ", trecho)
    trecho = re.sub(r"[^0-9A-Za-zÀ-ÿ\- ]+", " ", trecho)

    saida = []
    for w in trecho.split():
        if len(w) < 2:
            continue
        # Numero solto que sobrou de motorizacao cortada ("Kardian 1" de "1.0").
        if w.isdigit() and w not in nums:
            continue
        if CODIGO_LIXO.match(w) and w not in nums:
            continue
        saida.append(w)
    return saida


def chave_modelo(nome):
    """T-Cross, Tcross e T Cross sao o MESMO carro. A chave junta os tres."""
    return re.sub(r"[^a-z0-9]", "", strip_accents(nome).lower())


def exibir_modelo(nome):
    """Xc60 -> XC60, a4 -> A4, grand siena -> Grand Siena."""
    saida = []
    for w in nome.split():
        saida.append(w.upper() if re.fullmatch(r"[A-Za-z]{1,3}[-]?\d+[A-Za-z]?", w)
                     else w.capitalize())
    return " ".join(saida)[:22]


def main():
    print("=" * 52)
    print("  IZZAT CAR — indice de busca do catalogo")
    print("=" * 52)

    prods = json.load(open(SITE_DIR / "products.json", encoding="utf-8"))["products"]
    print(f"produtos: {len(prods)}")

    cats = load_categorias(prods)
    print(f"categorias conhecidas: {len(cats)}")

    # 1a passada: quais palavras funcionam como nome de carro sozinhas.
    # E isso que diferencia "A4 A5" (dois carros, fica A4) de "C4 Cactus"
    # (um carro so, fica inteiro) — sem lista escrita na mao.
    validos = prods
    cru = []
    sozinho = defaultdict(Counter)
    for p in validos:
        marca = BRAND_CANON.get((p.get("brand") or "").strip().lower(),
                                (p.get("brand") or "").strip())
        ws = palavras_modelo(p["title"], marca) if marca else []
        cru.append((marca, ws))
        if ws:
            sozinho[marca][chave_modelo(ws[0])] += 1

    # Palavra que so existe grudada na seguinte: "Grand Siena", "New Fiesta".
    PREFIXO = {"grand", "gran", "new", "novo", "nova", "land", "range", "grande"}
    # Nome de carro em codigo: XC60, A4, C3, S60, T6. Dois desses seguidos sao
    # dois carros ("XC60 XC90"), nunca um nome composto.
    CODIGO = re.compile(r"^[A-Za-z]{1,3}-?\d{1,3}[A-Za-z]?$")

    def resolver(marca, ws):
        if not ws:
            return ""
        if len(ws) < 2 or ws[0].lower() in PREFIXO:
            return " ".join(ws[:2])
        if (sozinho[marca][chave_modelo(ws[1])] >= 5
                or (CODIGO.match(ws[0]) and CODIGO.match(ws[1]))):
            return ws[0]          # "Audi A4 A5" -> A4 | "Volvo XC60 XC90" -> XC60
        return " ".join(ws[:2])   # "Citroen C4 Cactus" -> C4 Cactus

    # Nome bonito de cada chave = a grafia mais usada nos titulos.
    grafias = defaultdict(Counter)
    for (marca, ws) in cru:
        nome = resolver(marca, ws)
        if nome:
            grafias[(marca, chave_modelo(nome))][exibir_modelo(nome)] += 1
    display = {k: v.most_common(1)[0][0] for k, v in grafias.items()}

    itens = []
    por_marca = defaultdict(Counter)
    fam_cnt = Counter()
    sem_modelo = sem_anos = 0

    for p, (marca, ws) in zip(validos, cru):
        if not p.get("img") or not p.get("id"):
            continue

        nome = resolver(marca, ws)
        mod = display.get((marca, chave_modelo(nome)), "") if nome else ""
        a0, a1 = anos(p["title"])
        cat = cats.get(p.get("category_id"))
        fam = familia(cat)
        tipo = (cat or {}).get("nome", "")

        if not mod:
            sem_modelo += 1
        if not a0:
            sem_anos += 1

        # Codigos pra busca: OEM + part number, sem hifen e sem espaco, pra
        # "31663477" achar tanto "316-63477" quanto "31663477".
        codigos = " ".join(filter(None, [p.get("oem", ""), p.get("part_number", "")]))
        codigos = re.sub(r"[^0-9a-zA-Z ]", "", codigos).lower()[:120]

        # Link da pagina da peca NO NOSSO SITE. Usa a mesma funcao do gerador
        # das paginas, senao o card aponta pra um arquivo que nao existe.
        # O card manda pra ca, e nao direto pro ML, pra visita ficar no site
        # (e cair no Pixel).
        it = {"id": p["id"], "t": p["title"], "p": p["price"], "i": p["img"],
              "u": p["url"], "h": slugify(p["title"]) + "-" + p["id"],
              "f": bool(p.get("free_shipping"))}
        if marca:
            it["b"] = marca
        if mod:
            it["m"] = mod
        if a0:
            it["y"] = [a0, a1]
        if fam:
            it["c"] = fam
        if tipo:
            it["s"] = tipo
        if codigos:
            it["o"] = codigos
        itens.append(it)

        fam_cnt[fam] += 1
        if marca and mod:
            por_marca[marca][mod] += 1

    # Facetas: marcas com seus modelos (so modelo com 2+ pecas vira opcao do
    # menu; com 1 peca so polui a lista e o cliente acha pela busca de texto).
    marcas = []
    for marca, mods in sorted(por_marca.items(), key=lambda kv: -sum(kv[1].values())):
        lista = [{"n": m, "c": c} for m, c in sorted(mods.items(), key=lambda kv: (-kv[1], kv[0]))
                 if c >= 2]
        marcas.append({"n": marca, "k": slug(marca),
                       "c": sum(1 for i in itens if i.get("b") == marca),
                       "m": lista})

    familias = [{"n": n, "k": slug(n), "c": c}
                for n, c in fam_cnt.most_common() if c >= 3]
    outras = sum(c for n, c in fam_cnt.items() if c < 3)
    if outras:
        familias.append({"n": "Outros", "k": "outros", "c": outras})

    precos = sorted(i["p"] for i in itens)
    indice = {
        "updated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total": len(itens),
        "brands": marcas,
        "families": familias,
        "price": {"min": precos[0], "max": precos[-1]},
        "items": itens,
    }

    out = SITE_DIR / "catalogo_index.js"
    with open(out, "w", encoding="utf-8") as f:
        # window.X e nao const X: 'const' no topo de um script NAO vira
        # propriedade do window, e o catalogo.js nao enxergava o indice.
        f.write("window.IZZAT_INDEX = ")
        json.dump(indice, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")

    # --- Arquivo leve da home ------------------------------------------------
    # A home e a pagina que o anuncio da Meta abre, quase sempre no celular e no
    # 4G. Fazer ela baixar os 2 MB do indice inteiro so pra montar o seletor de
    # carro seria perder o cliente na tela branca. Aqui vai so o que a home usa.
    destaques = []
    usados = Counter()
    doce = [i for i in itens if 500 <= i["p"] <= 1000 and i.get("m") and i.get("c")]
    doce.sort(key=lambda i: (not i["f"], i["p"]))
    for it in doce:                       # no maximo 2 por familia, senao a
        if usados[it["c"]] >= 2:          # vitrine vira so "Peças de Interior"
            continue
        usados[it["c"]] += 1
        destaques.append({k: it[k] for k in ("id", "t", "p", "i", "h", "f", "b", "m", "c")
                          if k in it})
        if len(destaques) == 12:
            break

    home = {
        "total": len(itens),
        "brands": [{"n": m["n"], "c": m["c"], "m": [x["n"] for x in m["m"]]} for m in marcas],
        "families": familias,
        "featured": destaques,
    }
    outh = SITE_DIR / "home_data.js"
    with open(outh, "w", encoding="utf-8") as f:
        f.write("window.IZZAT_HOME = ")
        json.dump(home, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")

    mb = out.stat().st_size / 1024 / 1024
    print()
    print(f"home_data.js: {outh.stat().st_size/1024:.0f} KB | "
          f"{len(destaques)} destaques")
    print(f"catalogo_index.js: {len(itens)} pecas | {mb:.2f} MB")
    print(f"marcas: {len(marcas)} | familias: {len(familias)}")
    print(f"sem modelo: {sem_modelo} ({sem_modelo*100//len(itens)}%) | "
          f"sem anos: {sem_anos} ({sem_anos*100//len(itens)}%)")
    print()
    print("TOP MARCAS:")
    for m in marcas[:8]:
        top = ", ".join(f"{x['n']}({x['c']})" for x in m["m"][:5])
        print(f"  {m['c']:5}  {m['n']:14} {top}")
    print()
    print("FAMILIAS:")
    for fa in familias:
        print(f"  {fa['c']:5}  {fa['n']}")


if __name__ == "__main__":
    main()
