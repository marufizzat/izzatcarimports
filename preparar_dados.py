"""
IZZAT CAR — prepara os dados do site novo (pasta site/, Astro).

Le products.json (o mesmo que atualizar_catalogo.py grava) e escreve:
  site/src/data/pecas.json     -> uma entrada por peca, usada pra gerar /peca/*.html
  site/src/data/resumo.json    -> marcas, modelos, familias, carros, vitrines da home
  site/public/dados/busca.json -> indice compacto que o navegador baixa pra busca

Nada aqui e publicado como esta: products.json (com a localizacao da peca no
galpao, SELLER_SKU) NAO vai pro ar; so o que esta listado acima.

Reaproveita de proposito as funcoes dos geradores antigos:
  - slugify (gerar_paginas_individuais) -> as URLs /peca/ continuam IDENTICAS
  - palavras_modelo, anos, familia (gerar_indice) -> mesma leitura de carro,
    com as correcoes abaixo (marca por palavra inteira, "Xc 60", "Origina").

Rodar depois de atualizar_catalogo.py:
    PYTHONIOENCODING=utf-8 python preparar_dados.py
"""

import json
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import gerar_indice as gi  # noqa: E402
from gerar_paginas_individuais import (  # noqa: E402
    FICHA, descricao_html, limpar_attr, slugify)

SAIDA_DADOS = ROOT / "site" / "src" / "data"
SAIDA_PUBLICA = ROOT / "site" / "public" / "dados"

# --------------------------------------------------------------------------
# Marca: por PALAVRA INTEIRA e pela PRIMEIRA que aparece no titulo.
# O detector antigo procurava pedaco de texto: "Sigma" (motor Ford) virava GM.
# --------------------------------------------------------------------------
MARCAS = {
    "Volkswagen": ["volkswagen", "vw"],
    "Chevrolet": ["chevrolet", "gm", "chevy"],
    "Fiat": ["fiat"],
    "Ford": ["ford"],
    "Toyota": ["toyota"],
    "Honda": ["honda"],
    "Hyundai": ["hyundai"],
    "Renault": ["renault"],
    "Citroën": ["citroen", "citroën", "citoen", "citroem"],
    "Peugeot": ["peugeot"],
    "Nissan": ["nissan"],
    "Kia": ["kia"],
    "Jeep": ["jeep"],
    "BMW": ["bmw"],
    "Mercedes-Benz": ["mercedes-benz", "mercedes benz", "mercedes", "mb"],
    "Audi": ["audi"],
    "Volvo": ["volvo"],
    "Jaguar": ["jaguar"],
    "Land Rover": ["land rover", "range rover"],
    "Mitsubishi": ["mitsubishi"],
    "Subaru": ["subaru"],
    "Suzuki": ["suzuki"],
    "Chery": ["chery", "caoa chery"],
    "Lifan": ["lifan"],
    "Dodge": ["dodge"],
    "Mini": ["mini cooper", "mini"],
    "JAC": ["jac"],
    "Iveco": ["iveco"],
    "Geely": ["geely"],
    "RAM": ["ram"],
    "Chrysler": ["chrysler"],
    "Porsche": ["porsche"],
}

# "Mini" e "Ram" e "MB" sao palavras comuns demais: so contam como marca quando
# nao ha outra marca no titulo.
MARCAS_FRACAS = {"mini", "ram", "mb"}

_ALIAS = sorted(((a, m) for m, als in MARCAS.items() for a in als),
                key=lambda x: -len(x[0]))
_ALIAS_RE = re.compile(r"(?<![a-z0-9])(" + "|".join(re.escape(a) for a, _ in _ALIAS)
                       + r")(?![a-z0-9])")
_ALIAS_MAP = dict(_ALIAS)


def marca_do_titulo(titulo):
    """Marca canonica = a primeira que aparece no titulo (palavra inteira)."""
    t = gi.strip_accents(titulo).lower()
    fortes, fracas = [], []
    for m in _ALIAS_RE.finditer(t):
        alvo = fortes if m.group(1) not in MARCAS_FRACAS else fracas
        alvo.append((m.start(), _ALIAS_MAP[m.group(1)]))
    if fortes:
        return min(fortes)[1]
    if fracas:
        return min(fracas)[1]
    return ""


# Pedaco de "Original" cortado pelo limite de 60 letras do ML ("... Origina").
ORIGINAL_CORTADO = re.compile(r"\b(or|ori|orig|origi|origin|origina|original)\b", re.I)
# Codigo de modelo separado por espaco: "Xc 60", "S 60", "V 40", "Gla 200".
CODIGO_SEPARADO = re.compile(r"\b([A-Za-z]{1,3})[ -](\d{2,3})\b")


def limpar_titulo(titulo, modelos_conhecidos):
    """Prepara o titulo SO pra leitura do carro (nunca pro texto exibido)."""
    t = ORIGINAL_CORTADO.sub(" ", titulo)

    def juntar(m):
        junto = m.group(1) + m.group(2)
        return junto if gi.chave_modelo(junto) in modelos_conhecidos else m.group(0)

    return CODIGO_SEPARADO.sub(juntar, t)


MODELOS_SOLTOS = {
    "saveiro", "parati", "bora", "cronos", "voyage", "prisma", "montana", "evoque",
    "jetta", "polo", "fox", "spacefox", "crossfox", "siena", "strada", "doblo",
    "idea", "punto", "linea", "uno", "mobi", "kwid", "logan", "sandero", "duster",
    "oroch", "captur", "tiggo", "creta", "tucson", "sportage", "golf", "passat",
    "fiesta", "ecosport", "ka", "focus", "fusion", "zafira", "astra", "vectra",
    "celta", "corsa", "onix", "cobalt", "spin", "tracker", "cruze", "s10", "a3",
    "a4", "a5", "q3", "q5", "x1", "x3", "x5", "x6", "xc40", "xc60", "xc90", "s60",
    "v60", "discovery", "freelander", "renegade", "compass", "commander",
}

EXTRA_STOP = re.compile(r"\b(v6|v8|v10|v12)\b", re.I)


def palavras(titulo, marca, inicio=None):
    """Igual a gi.palavras_modelo, mas comeca logo depois do nome da marca
    COMO ESTA ESCRITO no titulo ("Citoen", "Mercedes-Benz", "Range Rover")."""
    t = gi.strip_accents(titulo).lower()
    fim = -1
    alias = ""
    for m in _ALIAS_RE.finditer(t):
        if _ALIAS_MAP[m.group(1)] == marca:
            fim, alias = m.end(), m.group(1)
            break
    if fim < 0:
        if inicio is None:
            return []
        fim = inicio          # titulo sem marca: comeca no nome do carro
    ma = gi.ANOS_RE.search(titulo)
    trecho = titulo[fim:ma.start()] if ma and ma.start() > fim else titulo[fim:fim + 26]
    trecho = gi.MODEL_STOP.sub(" ", trecho)
    trecho = EXTRA_STOP.sub(" ", trecho)
    nums = gi.MODELO_NUM.get(marca, set())
    trecho = re.sub(r"\b(19|20)\d{2}\b",
                    lambda m: m.group(0) if m.group(0) in nums else " ", trecho)
    trecho = re.sub(r"[^0-9A-Za-zÀ-ÿ\- ]+", " ", trecho)
    saida = []
    for w in trecho.split():
        w = w.strip("-")
        if len(w) < 2 and not (saida and saida[-1].lower() == "classe" and w.isalpha()):
            continue
        if w.isdigit() and w not in nums:
            continue
        if gi.CODIGO_LIXO.match(w) and w not in nums:
            continue
        saida.append(w)
    if alias == "range rover":
        return ["Range Rover " + saida[0]] if saida else ["Range Rover"]
    return saida


# Grafia oficial dos nomes que o titulo escreve de varios jeitos.
GRAFIA = {
    "tcross": "T-Cross", "epace": "E-Pace", "fpace": "F-Pace", "ipace": "I-Pace",
    "wrv": "WR-V", "hrv": "HR-V", "crv": "CR-V", "cx5": "CX-5", "rav4": "RAV4",
    "hb20": "HB20", "hb20s": "HB20S", "ix35": "ix35", "c4cactus": "C4 Cactus",
    "c3aircross": "C3 Aircross", "c4lounge": "C4 Lounge", "c4picasso": "C4 Picasso",
    "c4pallas": "C4 Pallas", "newfiesta": "New Fiesta", "grandsiena": "Grand Siena",
    "s10": "S10", "newcivic": "New Civic",
}


def exibir(nome):
    k = gi.chave_modelo(nome)
    if k in GRAFIA:
        return GRAFIA[k]
    saida = []
    for w in nome.split():
        if "-" in w:
            w = "-".join(p.upper() if len(p) <= 2 else p.capitalize() for p in w.split("-"))
        elif re.fullmatch(r"[A-Za-z]{1,3}\d+[A-Za-z]?", w):
            w = w.upper()
        else:
            w = w.capitalize()
        saida.append(w)
    return " ".join(saida)[:22]


SIGLAS = {"abs", "bcm", "bsi", "led", "cd", "dvd", "gps", "usb", "ecu", "tcu", "egr",
          "pcv", "tpms", "srs", "esp", "4x4", "cvt", "tsi", "tdi", "lcd", "mp3", "dsg",
          "abs/esp", "maf", "map", "ac", "a/c", "obd", "drl", "suv"}
PALAVRAS_FORA = re.compile(
    r"^(or|ori|orig|origi|origin|origina|original|originais|genuin[oa]|"
    r"preto|preta|cinza|prata|prateado|branco|branca|vermelho|vermelha|azul|bege|"
    r"cromado|grafite|marrom|dourado|verde-musgo)$", re.I)


ACENTOS = {
    "modulo": "módulo", "eletrico": "elétrico", "eletrica": "elétrica", "admissao": "admissão",
    "ventilacao": "ventilação", "injecao": "injeção", "macaneta": "maçaneta", "ignicao": "ignição",
    "direcao": "direção", "suspensao": "suspensão", "cambio": "câmbio", "pressao": "pressão",
    "combustivel": "combustível", "agua": "água", "botao": "botão", "botoes": "botões",
    "multimidia": "multimídia", "oleo": "óleo", "valvula": "válvula", "rele": "relé",
    "transmissao": "transmissão", "carcaca": "carcaça", "camera": "câmera", "radio": "rádio",
    "nivel": "nível", "vacuo": "vácuo", "homocinetica": "homocinética", "guarnicao": "guarnição",
    "maquina": "máquina", "iluminacao": "iluminação", "lampada": "lâmpada", "pinca": "pinça",
    "eletronico": "eletrônico", "eletronica": "eletrônica", "hidraulico": "hidráulico",
    "hidraulica": "hidráulica", "automatico": "automático", "automatica": "automática",
    "atuador": "atuador", "porta-luvas": "porta-luvas", "paralama": "para-lama",
    "parachoque": "para-choque", "para-brisa": "para-brisa", "parabrisa": "para-brisa",
    "cilindro": "cilindro", "acustica": "acústica", "termico": "térmico", "conexao": "conexão",
    "posicao": "posição", "rotacao": "rotação", "sucção": "sucção", "succao": "sucção",
    "distribuicao": "distribuição",
    "braco": "braço", "reservatorio": "reservatório", "resistencia": "resistência",
    "tensao": "tensão", "ventilador": "ventilador", "eletroventilador": "eletroventilador",
    "pistao": "pistão", "embreagem": "embreagem", "silencioso": "silencioso",
    "lanterna": "lanterna", "farol": "farol", "neblina": "neblina", "ignicao": "ignição",
    "comando": "comando", "painel": "painel", "proteção": "proteção", "protecao": "proteção",
    "regulagem": "regulagem", "fusivel": "fusível", "fusiveis": "fusíveis", "bau": "baú",
    "tunel": "túnel", "capo": "capô", "maquina": "máquina", "aquecimento": "aquecimento", "chicote": "chicote",
}
MOTOR_FORA = re.compile(r"^(\d{1,2}v|tfsi|fsi|tsi|tdi|thp|t\d?|turbo|flex|hibrido|híbrido|"
                        r"hybrid|sport|v6|v8|aut)$", re.I)
_CONHECIDOS_GLOBAL = set()


# Acentos que o texto do ML perde. So regras sem ambiguidade:
# -cao/-coes, -sao, -ivel/-iveis, -ao (palavra com 3+ letras) e uma lista curta.
_REGRAS = [
    (re.compile(r"(?<=[a-z])coes\b"), "ções"), (re.compile(r"(?<=[a-z])cao\b"), "ção"),
    (re.compile(r"(?<=[a-z]{2})sao\b"), "são"), (re.compile(r"(?<=[a-z])iveis\b"), "íveis"),
    (re.compile(r"(?<=[a-z])ivel\b"), "ível"), (re.compile(r"(?<=[a-z]{2})ao\b"), "ão"),
]
_PALAVRAS = {"nao": "não", "peca": "peça", "pecas": "peças", "codigo": "código", "codigos": "códigos",
             "veiculo": "veículo", "veiculos": "veículos", "eletrica": "elétrica", "eletrico": "elétrico",
             "tecnica": "técnica", "tecnicas": "técnicas", "tecnico": "técnico", "apos": "após",
             "duvidas": "dúvidas", "horario": "horário", "util": "útil", "uteis": "úteis",
             "especificacoes": "especificações", "compativeis": "compatíveis", "compativel": "compatível",
             "plastico": "plástico", "metalico": "metálico", "metalica": "metálica", "possivel": "possível",
             "modulo": "módulo", "modulos": "módulos", "valvula": "válvula", "agua": "água", "oleo": "óleo",
             "eletronico": "eletrônico", "eletronica": "eletrônica", "hidraulico": "hidráulico",
             "automatico": "automático", "automatica": "automática", "numero": "número", "rapido": "rápido",
             "rapida": "rápida", "voce": "você", "tambem": "também", "ate": "até", "ja": "já", "so": "só",
             "mao": "mão", "maos": "mãos", "plastica": "plástica", "mecanico": "mecânico", "mecanica": "mecânica", "contem": "contém", "retratil": "retrátil", "diametro": "diâmetro", "orgaos": "órgãos", "unico": "único", "unica": "única", "basico": "básico", "logica": "lógica"}


def acentuar(texto):
    def palavra(m):
        w = m.group(0)
        lw = w.lower()
        novo = _PALAVRAS.get(lw)
        if novo is None:
            novo = lw
            for rx, sub in _REGRAS:
                novo = rx.sub(sub, novo)
            if novo == lw:
                return w
        if w.isupper() and len(w) > 1:
            return novo.upper()
        if w[:1].isupper():
            return novo[:1].upper() + novo[1:]
        return novo
    return re.sub(r"[A-Za-z]+", palavra, texto or "")


# Descricao: so as secoes SOBRE A PECA (lista de permissao). O resto do texto do
# anuncio (empresa, garantia, envio, FAQ, palavras-chave...) tem promessas que o
# site ainda nao confirmou e repete o que o site ja mostra padronizado.
SECOES_OK = ("identificacao", "especificac", "condicao", "aplicacao", "veiculos compativeis",
             "compatibilidade", "posicao", "funcao")
# Linha com promessa ainda nao confirmada sai mesmo dentro das secoes permitidas.
PROMESSA = re.compile(
    r"lacre|retirada|presencial|hor[aá]rio|horas [uú]teis|\b24 ?h|d[eé]cada|an[uú]ncios|"
    r"estoque com|localiza[cç][aã]o|endere[cç]o|frete|despach|telefone|whats|\(53\)|"
    r"compatibilidade verificada|garantia|nota fiscal|envio|enviamos|correios|pix|parcel|"
    r"cart[aã]o|desconto|promo", re.I)


def _chave_titulo(linha):
    t = gi.strip_accents(linha.lower())
    t = re.sub(r"[=*#_]+", " ", t)
    t = re.sub(r"^\s*\d+\s*[).:-]\s*", "", t.strip())
    return re.sub(r"\s+", " ", t).strip(" :-")


def descricao(texto):
    """Descricao do ML em HTML limpo: so secoes sobre a peca, titulos com acento,
    sem promessas nao confirmadas."""
    from html import escape
    blocos, par = [], []
    manter = True          # texto antes do 1o titulo: so se nao tiver promessa

    def fechar():
        if par and manter:
            linhas = [l for l in par if not PROMESSA.search(l)]
            if linhas:
                t = acentuar(" ".join(linhas))
                t = re.sub(r"\b((?:19|20)\d{2}) at[ée] \1\b", r"\1", t)
                blocos.append("<p>" + escape(t) + "</p>")
        par.clear()

    for linha in (texto or "").splitlines():
        linha = linha.strip()
        if not linha or re.fullmatch(r"[=\-_* ]{4,}", linha):
            fechar()
            continue
        letras = [c for c in linha if c.isalpha()]
        titulo = 3 <= len(linha) <= 80 and letras and all(c.isupper() for c in letras)
        if titulo:
            fechar()
            chave = _chave_titulo(linha)
            manter = chave.startswith(SECOES_OK) and not PROMESSA.search(chave)
            if manter:
                t = acentuar(chave)
                t = t[:1].upper() + t[1:]
                t = re.sub(r"\s*\(leia com aten[cç][aã]o\)", "", t, flags=re.I)
                blocos.append("<h3>" + escape(t) + "</h3>")
        else:
            par.append(linha)
    fechar()
    # titulo sem paragrafo embaixo some
    limpo = []
    for i, bl in enumerate(blocos):
        if bl.startswith("<h3>") and (i + 1 == len(blocos) or blocos[i + 1].startswith("<h3>")):
            continue
        limpo.append(bl)
    return "\n".join(limpo)


def nome_limpo(titulo, marca, modelo):
    """'Lanterna Esquerda Tampa Traseira Volvo Xc 60 18/24 A045591'
    -> 'Lanterna esquerda tampa traseira'. Carro, ano e codigo aparecem a parte."""
    t = CODIGO_SEPARADO.sub(lambda m: m.group(1) + m.group(2), titulo)   # "Xc 60" -> "Xc60"
    t = gi.ANOS_RE.sub(" ", t)
    t = re.sub(r"\b(19|20)\d{2}\s*(a|até|ate|/|-)\s*(19|20)\d{2}\b", " ", t, flags=re.I)
    t = re.sub(r"\b(19|20)\d{2}\b", " ", t)
    for m in list(_ALIAS_RE.finditer(gi.strip_accents(t).lower()))[::-1]:
        t = t[:m.start()] + " " + t[m.end():]
    chaves_modelo = {gi.chave_modelo(w) for w in (modelo or "").split()}
    if modelo:
        chaves_modelo.add(gi.chave_modelo(modelo))
    saida = []
    for w in t.split():
        k = gi.chave_modelo(w)
        if not k:
            continue
        if k in chaves_modelo or PALAVRAS_FORA.match(w) or MOTOR_FORA.match(w):
            continue
        if k in _CONHECIDOS_GLOBAL and re.search(r"\d", w):   # outro modelo: s90, q5
            continue
        if len(k) == 1:
            continue
        if re.search(r"\d", w) and len(k) >= 5:          # codigo OEM / part number
            continue
        if re.fullmatch(r"\d+([.,]\d+)?", w):            # 1.6, 2.0 soltos
            continue
        saida.append(w)
    # para no primeiro "carro" que sobrar ("Sirene Alarme Jetta Golf Passat")
    while saida and gi.chave_modelo(saida[-1]) in MODELOS_SOLTOS:
        saida.pop()
    frase = []
    for i, w in enumerate(saida):
        lw = ACENTOS.get(w.lower()) or acentuar(w.lower())
        if lw in SIGLAS:
            frase.append(w.upper())
        elif i == 0:
            frase.append(lw[:1].upper() + lw[1:])
        else:
            frase.append(lw)
    nome = " ".join(frase).strip(" -/")
    return nome if len(nome) >= 4 else titulo


def anos_do_titulo(titulo):
    a0, a1 = gi.anos(titulo)
    if a0 and (a1 - a0) > 40:  # "98/24" mal lido: descarta
        return None, None
    return a0, a1


def chave_url(s):
    return gi.slug(s)


# --------------------------------------------------------------------------
# Foto do ML: guardamos so a chave ("957636-MLB110353255009_042026"); o site
# monta o tamanho certo (-V 320px no card, -O 500px, -F cheia na ficha).
# --------------------------------------------------------------------------
FOTO_RE = re.compile(r"https://http2\.mlstatic\.com/D_(?:NQ_NP_)?(?:2X_)?([0-9]+-[A-Z]{3}[0-9]+_[0-9]+)-[A-Z]\.(?:jpg|webp|png)")


def chave_foto(url):
    m = FOTO_RE.match(url or "")
    return m.group(1) if m else (url or "")


def ficha(p):
    linhas = []
    if p.get("oem"):
        linhas.append(["Código original (OEM)", p["oem"]])
    attrs = p.get("attrs") or {}
    for chave, rotulo in FICHA:
        v = (attrs.get(chave) or "").strip()
        if v and v.lower() not in ("nao", "não", "n/a"):
            linhas.append([rotulo, limpar_attr(chave, v)])
    return linhas


def codigos_busca(p):
    cods = " ".join(filter(None, [p.get("oem", ""), p.get("part_number", "")]))
    cods = re.sub(r"[,;/|]+", " ", cods)                    # varios codigos numa linha so
    cods = re.sub(r"\b(19|20)\d{2}\b", " ", cods)          # anos grudados no PN
    cods = re.sub(r"[^0-9a-zA-Z ]", "", cods).lower()
    return " ".join(dict.fromkeys(cods.split()))[:120]


# Reputacao do Mercado Livre (reputation.json, gravado por atualizar_catalogo.py).
# Termometro: level_id -> (cor, barras acesas de 1 a 5). Lider: MercadoLider.
NIVEIS_REPUTACAO = {"1_red": ("vermelho", 1), "2_orange": ("laranja", 2), "3_yellow": ("amarelo", 3),
                    "4_light_green": ("verde-claro", 4), "5_green": ("verde", 5)}
LIDERES_REPUTACAO = {"silver": "prata", "gold": "ouro", "platinum": "platina"}


def ler_reputacao(caminho=None):
    """reputation.json -> {nivel, n, lider?, vendas?} ou None. So leva o que o ML informou:
    sem nivel conhecido nao ha termometro; sem lider ou sem vendas, some so essa linha."""
    try:
        d = json.loads((caminho or ROOT / "reputation.json").read_text(encoding="utf-8"))
    except Exception:
        return None
    nivel = NIVEIS_REPUTACAO.get(str(d.get("level_id") or ""))
    if not nivel:
        return None
    rep = {"nivel": nivel[0], "n": nivel[1]}
    lider = LIDERES_REPUTACAO.get(str(d.get("power_seller_status") or "").lower())
    if lider:
        rep["lider"] = lider
    vendas = d.get("completed")
    if isinstance(vendas, int) and not isinstance(vendas, bool) and vendas > 0:
        rep["vendas"] = vendas
    return rep


def main():
    t0 = time.time()
    print("=" * 52)
    print("  IZZAT CAR — dados do site novo")
    print("=" * 52)

    bruto = json.loads((ROOT / "products.json").read_text(encoding="utf-8"))
    prods = bruto["products"]
    cats = gi.load_categorias(prods)
    print(f"produtos: {len(prods)} | categorias: {len(cats)}")

    # 1) Marca de cada titulo; quando o titulo nao diz a marca, aprende pelo
    #    nome do carro ("Passat" so aparece com Volkswagen no resto do estoque).
    marca_de = {p["id"]: marca_do_titulo(p["title"]) for p in prods}

    palavras_por_marca = defaultdict(Counter)
    for p in prods:
        mc = marca_de[p["id"]]
        if mc:
            for w in palavras(p["title"], mc)[:1]:
                palavras_por_marca[gi.chave_modelo(w)][mc] += 1
    inicio_de = {}
    for p in prods:
        if marca_de[p["id"]]:
            continue
        votos = Counter()
        onde = {}
        for mt in re.finditer(r"[A-Za-z0-9-]{2,}", gi.strip_accents(p["title"])):
            for mc, n in palavras_por_marca.get(gi.chave_modelo(mt.group(0)), {}).items():
                if n >= 3:
                    votos[mc] += n
                    onde.setdefault(mc, mt.start())
        if votos:
            mc = votos.most_common(1)[0][0]
            marca_de[p["id"]] = mc
            inicio_de[p["id"]] = onde[mc]

    # 2) Modelos que existem sozinhos (pra decidir "Xc 60" -> "Xc60").
    conhecidos = set()
    for p in prods:
        mc = marca_de[p["id"]]
        if mc:
            ws = palavras(p["title"], mc)
            if ws:
                conhecidos.add(gi.chave_modelo(ws[0]))

    _CONHECIDOS_GLOBAL.update(conhecidos)
    cru = []
    sozinho = defaultdict(Counter)
    for p in prods:
        mc = marca_de[p["id"]]
        tit = limpar_titulo(p["title"], conhecidos)
        ini = inicio_de.get(p["id"])
        if ini is not None:   # a limpeza pode mudar o tamanho: acha de novo
            alvo = gi.strip_accents(p["title"])[ini:].split()[0]
            pos = gi.strip_accents(tit).find(alvo)
            ini = pos if pos >= 0 else None
        ws = palavras(tit, mc, ini) if mc else []
        if mc and not ws:
            for mt in re.finditer(r"[A-Za-z0-9-]{2,}", gi.strip_accents(tit)):
                if palavras_por_marca.get(gi.chave_modelo(mt.group(0)), {}).get(mc, 0) >= 3:
                    ws = palavras(tit[:0] + tit, "__nenhuma__", mt.start())
                    break
        cru.append((mc, ws))
        if ws:
            sozinho[mc][gi.chave_modelo(ws[0])] += 1

    PREFIXO = {"grand", "gran", "new", "novo", "nova", "land", "grande", "classe"}
    CODIGO = re.compile(r"^[A-Za-z]{1,3}-?\d{1,3}[A-Za-z]?$")
    GERACAO = re.compile(r"^[A-Za-z]\d{1,2}$")        # G5, B6, B8, E71
    primeira = Counter()
    for mc, ws in cru:
        if ws:
            primeira[gi.chave_modelo(ws[0])] += 1
    pares = Counter()
    for mc, ws in cru:
        if len(ws) >= 2:
            pares[(mc, gi.chave_modelo(ws[0] + ws[1]))] += 1

    def resolver(mc, ws):
        """Nome composto so quando o PAR se repete no estoque ("C4 Cactus",
        "Grand Siena"); senao fica a primeira palavra ("Focus Sigma" -> Focus)."""
        if not ws:
            return ""
        if len(ws) < 2:
            return ws[0]
        if ws[0].lower() in PREFIXO:
            return " ".join(ws[:2])
        w1 = gi.chave_modelo(ws[1])
        if (CODIGO.match(ws[0]) and CODIGO.match(ws[1])) or GERACAO.match(ws[1]) \
                or primeira[w1] >= 2 or w1 in MODELOS_SOLTOS:
            return ws[0]      # "A4 A5", "XC60 XC90", "Gol G5", "Gol Saveiro"
        if (pares[(mc, gi.chave_modelo(ws[0] + ws[1]))] >= 3
                and sozinho[mc][gi.chave_modelo(ws[1])] < 5):
            return " ".join(ws[:2])
        return ws[0]

    grafias = defaultdict(Counter)
    for mc, ws in cru:
        nome = resolver(mc, ws)
        if nome:
            grafias[(mc, gi.chave_modelo(nome))][exibir(nome)] += 1
    display = {k: v.most_common(1)[0][0] for k, v in grafias.items()}

    # 3) Uma entrada por peca.
    pecas = []
    for p, (mc, ws) in zip(prods, cru):
        nome = resolver(mc, ws)
        mod = display.get((mc, gi.chave_modelo(nome)), "") if nome else ""
        # Modelo com uma peca so e quase sempre leitura errada: fica sem.
        if mod and sum(grafias[(mc, gi.chave_modelo(nome))].values()) < 2:
            mod = ""
        if mod and (gi.chave_modelo(mod) == gi.chave_modelo(mc)
                    or gi.chave_modelo(mod) in {gi.chave_modelo(a) for a in MARCAS.get(mc, [])}):
            mod = ""
        a0, a1 = anos_do_titulo(p["title"])
        cat = cats.get(p.get("category_id"))
        fam = gi.familia(cat)
        tipo = (cat or {}).get("nome", "")
        fotos = list(dict.fromkeys(p.get("pics") or ([p["img"]] if p.get("img") else [])))[:12]
        pecas.append({
            "id": p["id"],
            "slug": slugify(p["title"]) + "-" + p["id"],
            "t": p["title"],
            "n": nome_limpo(p["title"], mc, mod),
            "p": round(float(p["price"]), 2),
            "fotos": [chave_foto(u) for u in fotos],
            "ml": p.get("url", ""),
            "f": bool(p.get("free_shipping")),
            "b": mc,
            "m": mod,
            "y": [a0, a1] if a0 else None,
            "c": fam or "Outros",
            "s": tipo,
            "oem": " ".join(re.split(r"[\s,;/|]+", (p.get("oem") or "").strip())).strip(),
            "o": codigos_busca(p),
            "ficha": ficha(p),
            "desc": descricao(p.get("desc")),
        })

    # 3b) Capa limpa: a 1a foto que mostra so a peca (sem o carro colado) vai pra frente.
    import fotos_limpas
    for x in pecas:   # 2a foto ORIGINAL do anuncio: quase nunca e montagem com carro
        x["_seg"] = x["fotos"][1] if len(x["fotos"]) > 1 else None
    fotos_limpas.ordenar_fotos(pecas)

    # 4) Familias: so as com 3+ pecas; o resto entra em "Outros" (uma vez so).
    fam_cnt = Counter(x["c"] for x in pecas)
    pequenas = {n for n, c in fam_cnt.items() if c < 3 or n == "Outros"}
    for x in pecas:
        if x["c"] in pequenas:
            x["c"] = "Outros"
    fam_cnt = Counter(x["c"] for x in pecas)

    # 5) Marcas e modelos, carros (paginas /carros/), vitrines.
    por_marca = defaultdict(list)
    por_carro = defaultdict(list)
    for x in pecas:
        if x["b"]:
            por_marca[x["b"]].append(x)
            if x["m"]:
                por_carro[(x["b"], x["m"])].append(x)

    MIN_CARRO = 8
    carros = []
    for (mc, mod), lst in sorted(por_carro.items(), key=lambda kv: -len(kv[1])):
        if len(lst) < MIN_CARRO:
            continue
        # mosaico do carro: 2a foto original de pecas variadas (familias diferentes)
        cands, fams_vistas = [], set()
        for x in sorted(lst, key=lambda x: x["id"], reverse=True):
            if x.get("_seg") and x["c"] not in fams_vistas:
                cands.append(x["_seg"]); fams_vistas.add(x["c"])
            if len(cands) >= 10:
                break
        boas = fotos_limpas.limpas(cands)[:4]
        anos_l = [y for x in lst if x["y"] for y in x["y"]]
        fams = Counter(x["c"] for x in lst)
        carros.append({
            "k": chave_url(f"{mc} {mod}"),
            "b": mc, "m": mod, "c": len(lst),
            "anos": [min(anos_l), max(anos_l)] if anos_l else None,
            "fams": [[n, c] for n, c in fams.most_common(6)],
            # so capas limpas (sem o carro colado) no mosaico do carro
            "capas": (boas + [x["fotos"][0] for x in lst if x["fotos"] and x.get("limpa")
                              and x["fotos"][0] not in boas])[:4],
        })

    marcas = []
    for mc, lst in sorted(por_marca.items(), key=lambda kv: -len(kv[1])):
        mods = Counter(x["m"] for x in lst if x["m"])
        marcas.append({
            "n": mc, "k": chave_url(mc), "c": len(lst),
            "m": [{"n": n, "k": chave_url(n), "c": c}
                  for n, c in sorted(mods.items(), key=lambda kv: (-kv[1], kv[0])) if c >= 2],
        })

    familias = [{"n": n, "k": chave_url(n), "c": c} for n, c in fam_cnt.most_common()]

    # "Chegou agora": o numero do anuncio do ML cresce com o tempo, entao os
    # maiores sao os mais novos (nao ha data de criacao no dado).
    def num(x):
        return int(re.sub(r"\D", "", x["id"]) or 0)

    com_foto = [x for x in pecas if x["fotos"]]
    chegou = [x["id"] for x in sorted(com_foto, key=num, reverse=True)[:24]]

    # Relacionadas: mesmo carro, depois mesma marca (ids; o Astro resolve).
    for x in pecas:
        rel = []
        grupos = [por_carro.get((x["b"], x["m"]), []) if x["m"] else [],
                  por_marca.get(x["b"], [])]
        for g in grupos:
            for o in g:
                if o["id"] != x["id"] and o["id"] not in rel and o["fotos"]:
                    rel.append(o["id"])
                if len(rel) >= 8:
                    break
            if len(rel) >= 8:
                break
        x["rel"] = rel

    for x in pecas:
        x.pop("_seg", None)
    precos = sorted(x["p"] for x in pecas)
    resumo = {
        "updated": bruto.get("updated_at") or time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total": len(pecas),
        "marcas": marcas,
        "familias": familias,
        "carros": carros,
        "chegou": chegou,
        "preco": {"min": precos[0], "max": precos[-1]},
    }
    rep = ler_reputacao()
    if rep:
        resumo["reputacao"] = rep
        print(f"reputacao: {rep}")

    # 6) Indice de busca do navegador: colunas paralelas (bem menor que objetos).
    idx_marca = {m["n"]: i for i, m in enumerate(marcas)}
    idx_fam = {f["n"]: i for i, f in enumerate(familias)}
    tipos = sorted({x["s"] for x in pecas if x["s"]})
    idx_tipo = {s: i for i, s in enumerate(tipos)}
    busca = {
        "v": 1,
        "updated": resumo["updated"],
        "marcas": [m["n"] for m in marcas],
        "familias": [f["n"] for f in familias],
        "tipos": tipos,
        "id": [x["id"] for x in pecas],
        "t": [x["t"] for x in pecas],
        "n": [x["n"] for x in pecas],
        "p": [x["p"] for x in pecas],
        "i": [x["fotos"][0] if x["fotos"] else "" for x in pecas],
        "h": [x["slug"] for x in pecas],
        "f": "".join("1" if x["f"] else "0" for x in pecas),
        "b": [idx_marca.get(x["b"], -1) for x in pecas],
        "m": [x["m"] for x in pecas],
        "y": [x["y"] or 0 for x in pecas],
        "c": [idx_fam.get(x["c"], -1) for x in pecas],
        "s": [idx_tipo.get(x["s"], -1) for x in pecas],
        "o": [x["o"] for x in pecas],
    }

    SAIDA_DADOS.mkdir(parents=True, exist_ok=True)
    SAIDA_PUBLICA.mkdir(parents=True, exist_ok=True)
    (SAIDA_DADOS / "pecas.json").write_text(
        json.dumps(pecas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (SAIDA_DADOS / "resumo.json").write_text(
        json.dumps(resumo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (SAIDA_PUBLICA / "busca.json").write_text(
        json.dumps(busca, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    sem_marca = sum(1 for x in pecas if not x["b"])
    sem_modelo = sum(1 for x in pecas if not x["m"])
    kb = (SAIDA_PUBLICA / "busca.json").stat().st_size / 1024
    print(f"pecas: {len(pecas)} | sem marca: {sem_marca} | sem modelo: {sem_modelo}")
    print(f"marcas: {len(marcas)} | familias: {len(familias)} | paginas de carro: {len(carros)}")
    print(f"busca.json: {kb:.0f} KB (sem gzip) | {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
