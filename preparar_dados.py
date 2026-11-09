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
    "nivus", "virtus", "tiguan", "amarok", "kicks",
}

EXTRA_STOP = re.compile(r"\b(v6|v8|v10|v12)\b", re.I)

# Modelo nunca e outra marca: "Vw Audi Golf" -> Golf, "Audi A3 Vw Golf" -> A3.
_CHAVES_MARCA = {gi.chave_modelo(a) for m, als in MARCAS.items() for a in [m, *als]}
# Versao, carroceria ou geracao escrita depois do nome do carro: fica fora do modelo
# ("Tracker 1.0 Lt", "Cruze Sedan", "Golf Mk4", "Q3 8u", "A3 Sportback", "Civic Si", "Tiggo 5x").
VERSAO_FORA = re.compile(r"^(sedan|hatch|sportback|lt|ltz|ls|lx|lxs|ex|exl|exs|si|mk\d|\d[a-z])$", re.I)


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
    if ma and ma.start() > fim:
        trecho = titulo[fim:ma.start()]
    else:
        # ano escrito de outro jeito ("Wr-v 2026", "2019/24", "2011-2018"): o carro acaba nele
        _, _, pos = _ler_anos(titulo, marca, fim)
        if pos is not None and pos > fim:
            trecho = titulo[fim:pos]
        else:                 # sem ano: 26 letras, sem palavra cortada ("Preto" -> "Pr")
            trecho = titulo[fim:fim + 26]
            if fim + 26 < len(titulo) and titulo[fim + 26].isalnum():
                trecho = trecho.rsplit(" ", 1)[0]
    trecho = gi.MODEL_STOP.sub(" ", trecho)
    trecho = EXTRA_STOP.sub(" ", trecho)
    nums = gi.MODELO_NUM.get(marca, set())
    trecho = re.sub(r"\b(19|20)\d{2}\b",
                    lambda m: m.group(0) if m.group(0) in nums else " ", trecho)
    trecho = re.sub(r"[^0-9A-Za-zÀ-ÿ\- ]+", " ", trecho)
    saida = []
    for w in trecho.split():
        w = w.strip("-")
        if saida and len(w) == 1 and w.isalnum() and gi.chave_modelo(saida[-1]) == "serie":
            saida[-1] = "Série " + w          # "Bmw Serie 5 E60" -> Série 5
            continue
        if len(w) < 2 and not (saida and saida[-1].lower() == "classe" and w.isalpha()):
            continue
        if w.isdigit() and w not in nums:
            continue
        if gi.CODIGO_LIXO.match(w) and w not in nums:
            continue
        if gi.chave_modelo(w) in _CHAVES_MARCA:
            continue
        if saida and VERSAO_FORA.match(w):
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
    "serie1": "Série 1", "serie3": "Série 3", "serie5": "Série 5", "serie7": "Série 7",
    "cla": "CLA", "gla": "GLA", "passatcc": "Passat CC",
}

# Modelo lido certo mas escrito de outro jeito (marca, chave lida) -> nome do carro.
# Lista curta e auditavel; so troca o que tem pagina/filtro errado hoje.
MODELO_APELIDO = {
    ("BMW", "x3e"): "X3", ("BMW", "x3e330e"): "X3",                 # "Bmw X3e 330e" (hibrido) e o X3
    ("BMW", "s5"): "Série 5",                                        # "Bmw S5 530i E60" (S5 e Audi)
    ("BMW", "e39"): "Série 5", ("BMW", "e60"): "Série 5", ("BMW", "e61"): "Série 5",
    ("BMW", "e46"): "Série 3", ("BMW", "e90"): "Série 3", ("BMW", "f30"): "Série 3",
    ("Mercedes-Benz", "w203"): "Classe C", ("Mercedes-Benz", "w204"): "Classe C",
    ("Chevrolet", "onixplus"): "Onix",                               # Onix Plus = Onix sedã
    ("Citroën", "aircross"): "C3 Aircross",
    ("Volkswagen", "tcroos"): "T-Cross",
}


def modelo_canonico(marca, nome):
    """Ultima palavra sobre o modelo: nunca outra marca ("Vw Audi ..." nao e o carro
    "Audi") e apelidos/chassi viram o nome do carro (E60 -> Série 5)."""
    if not nome:
        return nome
    k = gi.chave_modelo(nome)
    if k in _CHAVES_MARCA:
        return ""
    m = re.fullmatch(r"Classe ([A-Za-z]{1,3}\d{2,3}[A-Za-z]?)", nome, re.I)
    if marca == "Mercedes-Benz" and m:
        return m.group(1).upper()                # "Classe C 180" -> C180 (o carro e o C180)
    return MODELO_APELIDO.get((marca, k), nome)


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
          "abs/esp", "maf", "map", "ac", "a/c", "obd", "drl", "suv",
          "tbi", "bsm", "pdc", "uch", "tcm", "vcm", "epb", "ibs", "sos", "vvt", "dme", "eps",
          "apim", "iaw", "esc"}
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
# Mais palavras de autopeca que o titulo do ML escreve sem acento (lista auditavel).
ACENTOS.update({
    "dobradica": "dobradiça", "dobradicas": "dobradiças", "seguranca": "segurança",
    "hibrida": "híbrida", "hibrido": "híbrido", "hibridos": "híbridos", "balanca": "balança",
    "calco": "calço", "calcos": "calços", "cabecote": "cabeçote", "hidrovacuo": "hidrovácuo",
    "oxigenio": "oxigênio", "desembacador": "desembaçador", "valvulas": "válvulas", "saida": "saída",
    "eletrocromico": "eletrocrômico", "relogio": "relógio", "velocimetro": "velocímetro",
    "macanetas": "maçanetas", "alca": "alça", "alcas": "alças", "aerofolio": "aerofólio",
    "triangulo": "triângulo", "acustico": "acústico", "termostatica": "termostática",
    "termostatico": "termostático", "presenca": "presença", "memoria": "memória",
    "pneumatico": "pneumático", "panoramico": "panorâmico", "quadruplo": "quádruplo",
    "emergencia": "emergência", "intermediario": "intermediário", "aneis": "anéis", "ruido": "ruído",
    "cabeca": "cabeça", "oculos": "óculos", "serie": "série", "gas": "gás", "re": "ré", "pe": "pé",
    "eletricos": "elétricos", "eletricas": "elétricas", "maquinas": "máquinas", "lampadas": "lâmpadas",
    "farois": "faróis", "audio": "áudio", "video": "vídeo", "camara": "câmara", "liquido": "líquido",
    "termica": "térmica", "magnetico": "magnético", "ceramica": "cerâmica", "regua": "régua",
    "trasera": "traseira", "parabrisas": "para-brisa", "parabarro": "para-barro",
    "parachoques": "para-choques", "paralamas": "para-lamas", "semi-eixo": "semieixo",
    "pára-choque": "para-choque", "pára-brisa": "para-brisa", "pára-lama": "para-lama",
    "pára-sol": "para-sol", "pára": "para", "portamalas": "porta-malas", "portaluvas": "porta-luvas",
    "aco": "aço", "plasticos": "plásticos", "eletronicos": "eletrônicos",
    "hidraulicos": "hidráulicos", "mecanico": "mecânico", "metalicos": "metálicos", "estatico": "estático",
    "conexoes": "conexões", "vedacao": "vedação", "tracao": "tração", "aceleracao": "aceleração",
})
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


# --------------------------------------------------------------------------
# Nome por extenso. O titulo do ML abrevia ("tras esq", "dian dir") e perde acento.
# Tudo aqui e LISTA auditavel: abreviacao -> palavra cheia. Genero e numero vem do
# substantivo mais perto ANTES: "Lanterna tras esq" -> traseira esquerda,
# "Motor vidro tras esq" -> traseiro esquerdo, "Kit canaleta portas tras" -> traseiras.
# --------------------------------------------------------------------------
# Abreviacao de adjetivo que concorda (lema no masculino singular).
ABREV_ADJETIVO = {
    "tras": "traseiro", "trase": "traseiro", "traseir": "traseiro",
    "diant": "dianteiro", "dian": "dianteiro", "dianteir": "dianteiro", "dt": "dianteiro",
    "esq": "esquerdo", "esque": "esquerdo", "esquer": "esquerdo", "esquerd": "esquerdo", "esquero": "esquerdo",
    "dir": "direito", "dire": "direito", "direit": "direito", "diante": "dianteiro",
    "int": "interno", "ext": "externo", "eletr": "elétrico", "elet": "elétrico",
    "estabiliz": "estabilizador", "estabilizad": "estabilizador", "compl": "completo", "comp": "completo",
    "hidra": "hidráulico",
}
# Abreviacao de adjetivo que so muda no plural.
ABREV_INVARIAVEL = {"sup": "superior", "inf": "inferior", "lat": "lateral"}
# Abreviacao de substantivo/locucao: troca direta.
ABREV_FIXA = {
    "acab": "acabamento", "retrov": "retrovisor", "susp": "suspensão", "instrum": "instrumentos",
    "aquec": "aquecimento", "desembac": "desembaçador", "parachoq": "para-choque",
    "comb": "combustível", "vent": "ventilador", "ld": "lado direito", "le": "lado esquerdo",
    "t.e": "tras esq", "t.d": "tras dir", "d.e": "diant esq", "d.d": "diant dir",
    "arcondicionado": "ar condicionado", "adm": "admissão", "passag": "passageiro", "triang": "triângulo",
    "limit": "limitador", "vidri": "vidro", "parabris": "para-brisa", "mangueir": "mangueira",
    "radiadr": "radiador", "retroviso": "retrovisor", "virabrequi": "virabrequim", "porta-mala": "porta-malas",
}
# Palavra composta que o titulo escreve separada.
COMPOSTOS = {
    ("porta", "malas"): "porta-malas", ("porta", "mala"): "porta-malas",
    ("porta", "luvas"): "porta-luvas", ("porta", "luva"): "porta-luvas",
    ("porta", "copos"): "porta-copos", ("porta", "copo"): "porta-copos",
    ("porta", "objetos"): "porta-objetos", ("porta", "objeto"): "porta-objetos",
    ("porta", "treco"): "porta-trecos", ("porta", "trecos"): "porta-trecos",
    ("quebra", "sol"): "quebra-sol", ("alto", "falante"): "alto-falante",
    ("alto", "falantes"): "alto-falantes", ("pisca", "alerta"): "pisca-alerta",
    ("para", "brisa"): "para-brisa", ("para", "choque"): "para-choque", ("para", "lama"): "para-lama",
    ("para", "barro"): "para-barro", ("para", "sol"): "para-sol", ("semi", "eixo"): "semieixo",
    ("pos", "catalisador"): "pós-catalisador", ("pre", "catalisador"): "pré-catalisador",
    ("guarda", "po"): "guarda-pó",
}
# Genero dos substantivos de autopeca mais comuns (sem acento). Plural sai pela regra.
_NOMES_F = """porta tampa lanterna macaneta moldura bandeja fechadura coluna alavanca mangueira caixa
chave bomba luz valvula trava borracha guarnicao grade antena bobina buzina camera barra mola bucha roda
calota tela soleira capa cobertura alca dobradica maquina haste presilha polia correia sonda tomada saida
entrada junta bieleta bateria lampada pinca carcaca flauta galhada gaveta gavetinha portinhola
churrasqueira palheta base placa peca chapa longarina travessa ponteira ventoinha resistencia suspensao
direcao transmissao coifa manga engrenagem cinta bolsa cortina colmeia lente aba abertura porca arruela
cruzeta homocinetica saia aleta canaleta botoneira pestana fivela alma mesa balanca biela tubulacao regua
unidade embreagem catraca corrente cremalheira estrutura armacao faixa escova esteira ponta lingueta tranca
tecla carenagem capota camisa bronzina pastilha sapata lona abracadeira conexao manivela grelha seta
vareta fita etiqueta garra turbina sirene sirena lamina luminaria evaporadora""".split()
_NOMES_M = """motor vidro botao suporte acabamento painel retrovisor farol forro carpete coxim braco eixo
semieixo amortecedor sensor modulo comando difusor interruptor puxador trilho banco encosto apoio console
cinzeiro chicote cabo tubo duto cano reservatorio radiador defletor protetor espelho friso emblema pedal
disco tambor cubo rolamento filtro coletor bico injetor sistema conjunto kit jogo par assoalho teto capo
limpador esguicho macaco triangulo estepe volante airbag cinto fecho trinco batente limitador atuador
compressor condensador evaporador ventilador eletroventilador alternador arranque cambio trambulador
seletor diferencial virabrequim cabecote carter bloco pistao anel mancal tensor rolete regulador rele
fusivel conector plug plugue soquete refletor aplique spoiler aerofolio pneu aro calco isolamento
revestimento tapete bagagito bagageiro display radio som amplificador subwoofer tweeter receptor controle
guia montante quadro chassi pino parafuso gancho abafador silencioso escapamento catalisador intercooler
turbo tanque bocal gargalo respiro canister corpo acelerador hidrovacuo servo cilindro miolo comutador
contato imobilizador alarme reostato relogio velocimetro computador lado conforto terminal polo farolete
estribo degrau rack absorvedor olho para-choque para-lama para-brisa para-barro para-sol porta-malas
porta-luvas porta-copos porta-objetos porta-trecos quebra-sol alto-falante pisca-alerta""".split()
# Adjetivo que concorda (lema masculino singular): a forma no titulo diz o genero.
_ADJ_LEMAS = """traseiro dianteiro esquerdo direito interno externo eletrico eletronico cromado automatico
hidraulico mecanico completo acustico termico inteiro fixo dentado duplo plastico metalico condicionado
aquecido eletrocromico panoramico curvo reto longo curto solto""".split()
# Nao decidem o genero: complemento ("cinto de seguranca", "pinca de freio", "tampa de valvulas
# do motor", "moldura do porta-malas"), adjetivo invariavel e preposicao.
_NAO_DECIDE = set("""seguranca freio mao ar agua oleo combustivel motor capo teto porta-malas porta-luvas
para-brisa superior superiores inferior inferiores
lateral laterais central centrais frontal frontais original originais manual digital auxiliar simples
universal de do da dos das com sem e""".split())
_POSICAO = {"traseiro", "dianteiro", "esquerdo", "direito", "interno", "externo"}
_POS_INVARIAVEL = {"superior", "inferior", "lateral", "superiores", "inferiores", "laterais"}
_LADO = {"esquerdo", "direito"}
# Sobra de carro/versao/motor no FIM do nome ("Motor vidro eletrico voyage saveiro g5 g6"): sai.
SOBRA_FIM = set("""sportline comfortline highline trendline sedan hatch cabrio coupe new grand classic lounge aircross
zetec sigma fire etorq rocam duratec ecoboost vivace sporting adventure tendance pointer kyron actyon
ssangyong livina tiida quantum elba etios saveiro voyage parati jetta bora tcroos sapao plus lt ltz lx
exl si classe serie evoque velar camaro versa symbol scenic megane picasso cactus pallas xsara arizo
fpace epace wrv hrv crv bi biturbo sportback cactu cact cactos cc fiorino mille doblo bravo marea brava
tempra weekend attractive essence trekking kombi crossfox spacefox spacecross fusca logus apollo
versailles celta prisma agile meriva vectra astra omega kadett ipanema monza chevette opala trailblazer
equinox cobalt sonic malibu fiesta focus fusion ecosport ranger escort verona courier kangoo twingo
laguna stepway kardian sandero logan duster captur kwid oroch fluence partner hoggar berlingo corolla
yaris hilux sw4 rav4 camry creta tucson azera sonata elantra veloster kicks march sentra frontier murano
renegade compass cherokee wrangler tiggo arrizo celer picanto sorento sportage cerato soul""".split())
# Carros soltos que ja saiam do fim do nome antes (peca sem modelo no cartao so perde estes).
_SOLTOS_ANTIGOS = frozenset(MODELOS_SOLTOS) - {"nivus", "virtus", "tiguan", "amarok", "kicks"}
SOBRA_RE = re.compile(r"^(/\d{2,4}|\d{2,4}/|mk\d|[a-z]{1,3}\d{1,3}[a-z]?|\d{3}[eidh]|\d[.,]\dt?|\dcc|\d[a-z])$",
                      re.I)
MOTOR_MEIO = re.compile(r"^(\d[.,]\dt|\dcc)$", re.I)       # 1.0t, 1.3t, 3cc: motor, nunca nome
# Geracao/chassi escrito no titulo, por marca (so onde o padrao nao confunde com peca).
GERACAO_MARCA = {
    "BMW": re.compile(r"[efg]\d{2}"), "Volkswagen": re.compile(r"g\d|mk\d|b\d"),
    "Audi": re.compile(r"b\d|8[a-z]|mk\d"), "Mercedes-Benz": re.compile(r"w\d{3}"),
    "Ford": re.compile(r"mk\d"), "Honda": re.compile(r"g\d{1,2}"),
}


def _sem(w):
    return gi.strip_accents(w).lower()


def _lema_pos(k):
    """traseira/traseiros/traseiras -> traseiro (so pra comparar)."""
    return re.sub(r"(a|os|as)$", "o", k)


def _plural(w):
    if w.endswith("ao"):
        return w[:-2] + "oes"
    if w.endswith(("r", "z")):
        return w + "es"
    if w.endswith("l"):
        return w[:-1] + "is"
    if w.endswith("m"):
        return w[:-1] + "ns"
    return w if w.endswith("s") else w + "s"


_GENERO = {}
for _g, _lista in (("f", _NOMES_F), ("m", _NOMES_M)):
    for _w in _lista:
        _GENERO[_w] = ("nome", _g, "s")
        _GENERO.setdefault(_plural(_w), ("nome", _g, "p"))
for _w in _ADJ_LEMAS:
    for _forma, _g, _n in ((_w, "m", "s"), (_w[:-1] + "a", "f", "s"), (_w + "s", "m", "p"), (_w[:-1] + "as", "f", "p")):
        _GENERO[_forma] = ("adj", _g, _n)
for _forma, _g, _n in (("estabilizador", "m", "s"), ("estabilizadora", "f", "s"),
                       ("estabilizadores", "m", "p"), ("estabilizadoras", "f", "p")):
    _GENERO[_forma] = ("adj", _g, _n)


def _genero(w):
    """('nome'|'adj', 'm'|'f', 's'|'p') de uma palavra, ou None se nao sabe."""
    k = _sem(w)
    if k in _GENERO:
        return _GENERO[k]
    if re.search(r"(cao|sao|agem|eira|ura|eta|ola|ilha|dora)$", k):
        return ("nome", "f", "s")
    if re.search(r"(coes|soes|agens|eiras|uras|etas|olas|ilhas|doras)$", k):
        return ("nome", "f", "p")
    if re.search(r"(mento|ador|or)$", k):
        return ("nome", "m", "s")
    return None


def _flexionar(lema, g, n):
    if lema == "estabilizador":
        base = "estabilizadora" if g == "f" else lema
    elif lema.endswith("o"):
        base = lema[:-1] + "a" if g == "f" else lema
    else:                                   # superior, inferior, lateral
        base = lema
    if n == "p":
        base = base + "es" if base.endswith("r") else base[:-1] + "is" if base.endswith("l") else base + "s"
    return base


def _sobra(w, carro=True):
    """Palavra que e carro/versao/motor e nao peca (so usada no FIM do nome).
    carro=False (peca sem modelo no cartao): so tira o que nunca e o carro ("/24", "1.0t")
    e a lista antiga de carros soltos; o resto e a unica pista do carro."""
    if "/" in w and not re.fullmatch(r"/?\d{2,4}/?", w):
        partes = [x for x in w.split("/") if x]
        return bool(partes) and all(_sobra(x, carro) for x in partes)
    k = gi.chave_modelo(w)
    if not k or k in SIGLAS:
        return False
    if not carro:
        return bool(re.fullmatch(r"/\d{2,4}|\d{2,4}/|\d[.,]\dt|\dcc", w, re.I)) or k in _SOLTOS_ANTIGOS
    return bool(SOBRA_RE.match(w)) or k in SOBRA_FIM or k in MODELOS_SOLTOS or k in _CONHECIDOS_GLOBAL


def expandir_nome(palavras_cruas, tirar_carro=True):
    """['Motor','Vidro','Eletrico','Tras','Esq'] -> ['motor','vidro','elétrico','traseiro','esquerdo'].
    Minusculas; quem poe maiuscula/sigla e o nome_limpo. tirar_carro=False quando a peca
    nao tem modelo no cartao (ai o carro escrito no nome e a unica pista)."""
    # 1) abreviacao -> marcador (adjetivo a flexionar) ou palavra cheia
    itens = []                                   # [texto, lema_a_flexionar|None]
    cruas = []
    for w in palavras_cruas:                     # "diant/esq" = duas abreviacoes
        partes = _sem(w).split("/")
        cruas += partes if len(partes) == 2 and all(x in ABREV_ADJETIVO for x in partes) else [w]
    for i, w in enumerate(cruas):
        lw = w.lower()
        k = _sem(lw).rstrip(".") if lw not in ABREV_FIXA else lw
        if MOTOR_FORA.match(k) or MOTOR_MEIO.match(k):
            continue
        if k in ("cond", "condicion", "condicionad") and itens and _sem(itens[-1][0]) == "ar":
            itens.append(["condicionado", None])
        elif k in ("sup", "acab") and not itens:
            itens.append(["suporte" if k == "sup" else "acabamento", None])   # 1a palavra: e a peca
        elif k in ABREV_FIXA:
            for x in ABREV_FIXA[k].split():
                x2 = _sem(x)
                if x2 in ABREV_ADJETIVO:
                    itens.append([x2, ABREV_ADJETIVO[x2]])
                else:
                    itens.append([x, None])
        elif k in ABREV_ADJETIVO:
            itens.append([k, ABREV_ADJETIVO[k]])
        elif k in ABREV_INVARIAVEL:
            itens.append([k, ABREV_INVARIAVEL[k]])
        else:
            itens.append([lw, None])
    # 2) compostos ("porta malas" -> porta-malas) e acentos
    junto = []
    for it in itens:
        if junto and junto[-1][1] is None and it[1] is None \
                and (_sem(junto[-1][0]), _sem(it[0])) in COMPOSTOS:
            junto[-1][0] = COMPOSTOS[(_sem(junto[-1][0]), _sem(it[0]))]
            continue
        junto.append(it)
    for it in junto:
        if it[1] is None:
            w = re.sub(r"çoes$", "ções", re.sub(r"çao$", "ção", it[0]))      # "proteçao" (tem ç, falta til)
            it[0] = ACENTOS.get(w) or acentuar(w)
    # 3) concordancia. A sequencia de posicao ("tras esq", "superior traseira esq") concorda
    #    junto: com o adjetivo cheio que ja esta nela; senao com o substantivo mais perto antes.
    def posicional(it):
        return it[1] is not None or _lema_pos(_sem(it[0])) in _POSICAO or _sem(it[0]) in _POS_INVARIAVEL

    for i, it in enumerate(junto):
        if it[1] is None:
            continue
        r0 = i
        while r0 > 0 and posicional(junto[r0 - 1]):
            r0 -= 1
        r1 = i
        while r1 + 1 < len(junto) and posicional(junto[r1 + 1]):
            r1 += 1
        seq = range(r0, r1 + 1)
        # um lado so (esquerdo/direito): singular ("Forro portas tras dir" -> traseiro direito)
        um_lado = any(junto[j][1] in _LADO or _lema_pos(_sem(junto[j][0])) in _LADO for j in seq)
        achou = None
        for j in sorted(seq, key=lambda j: (j > i, abs(j - i))):
            info = _GENERO.get(_sem(junto[j][0])) if junto[j][1] is None else None
            if info and info[0] == "adj":
                achou = info[1:]
                break
        if achou is None:
            for j in list(range(r0 - 1, -1, -1)) + list(range(r1 + 1, len(junto))):
                w = _sem(junto[j][0])
                if junto[j][1] is not None or w in _NAO_DECIDE:
                    continue
                info = _genero(w)
                if not info:
                    continue
                if um_lado and info[0] == "nome" and info[2] == "p":
                    continue                 # "Botao vidros diant esq": o esquerdo e o botao
                achou = info[1:]
                break
        g, n = achou or ("m", "s")
        it.append(_flexionar(it[1], g, "s" if um_lado else n))
    palavras = [it[2] if it[1] is not None else it[0] for it in junto]
    # 4) repeticao: igual a de antes ("cromada cromada"), "quebra-sol quebra" e a mesma
    #    posicao duas vezes na mesma sequencia ("externa traseira direita traseira").
    limpo = []
    for w in palavras:
        k = _sem(w)
        if limpo and (_sem(limpo[-1]) == k or (k == "quebra" and _sem(limpo[-1]) == "quebra-sol")):
            continue
        lema = _lema_pos(k)
        if lema in _POSICAO:
            j, repetido = len(limpo) - 1, False
            while j >= 0 and (_lema_pos(_sem(limpo[j])) in _POSICAO or _sem(limpo[j]) in _POS_INVARIAVEL):
                if _lema_pos(_sem(limpo[j])) == lema:
                    repetido = True
                    break
                j -= 1
            if repetido:
                continue
        limpo.append(w)
    # 5) sobra de carro no fim
    while len(limpo) > 1 and _sobra(limpo[-1], tirar_carro) \
            and (len(" ".join(limpo[:-1])) >= 4 or " ".join(limpo[:-1]) in SIGLAS):
        limpo.pop()
    return limpo


def nome_limpo(titulo, marca, modelo):
    """'Lanterna Esquerda Tampa Traseira Volvo Xc 60 18/24 A045591'
    -> 'Lanterna esquerda tampa traseira'. Carro, ano e codigo aparecem a parte."""
    t = CODIGO_SEPARADO.sub(lambda m: m.group(1) + m.group(2), titulo)   # "Xc 60" -> "Xc60"
    t = gi.ANOS_RE.sub(" ", t)
    t = re.sub(r"\b(19|20)\d{2}\s*(a|até|ate|/|-)\s*(19|20)\d{2}\b", " ", t, flags=re.I)
    t = re.sub(r"\b(19|20)\d{2}\s*/\s*\d{2}\b", " ", t)                 # "2019/24"
    t = re.sub(r"(?<![\w-])\d{2}-\d{2}(?![\w-])", " ", t)                # "11-18"
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
        if "/" in w and all(PALAVRAS_FORA.match(x) for x in w.split("/") if x):   # "Preto/cromado"
            continue
        if modelo and marca in GERACAO_MARCA and GERACAO_MARCA[marca].fullmatch(w.lower()):
            continue                                       # geracao/chassi: "G06", "E90", "G5", "B8"
        if k in _CONHECIDOS_GLOBAL and re.search(r"\d", w):   # outro modelo: s90, q5
            continue
        if len(k) == 1:
            continue
        if re.search(r"\d", w) and len(k) >= 5:          # codigo OEM / part number
            continue
        if re.fullmatch(r"\d+([.,]\d+)?", w):            # 1.6, 2.0 soltos
            continue
        saida.append(w)
    # por extenso, com acento e concordancia; sem o "carro" que sobrar no fim
    # ("Sirene Alarme Jetta Golf Passat", "Motor Vidro Eletrico Voyage Saveiro G5 G6")
    frase = []
    for i, w in enumerate(expandir_nome(saida, tirar_carro=bool(modelo))):
        if w in SIGLAS:
            frase.append(w.upper())
        elif i == 0:
            frase.append(w[:1].upper() + w[1:])
        else:
            frase.append(w)
    nome = " ".join(frase).strip(" -/")
    return nome if len(nome) >= 4 or nome.lower() in SIGLAS else titulo


# --------------------------------------------------------------------------
# Anos. O jeito classico "18/24" continua igual (gi.anos). Os outros jeitos que o
# titulo usa ("2019/24", "2011-2018", "2020 A 2024", "2015 16 17 18", "2019") so
# entram quando nao ha "18/24"; depois a faixa e limitada ao periodo do carro.
# --------------------------------------------------------------------------
ANO_MAX = time.localtime().tm_year + 1       # o ano-modelo do ano que vem ja esta a venda
_CONECTOR_ANO = {"a", "à", "ate", "até", "ao", "e", "-", "–", "/"}

# Periodo de venda no Brasil (primeiro e ultimo ano-modelo; None = ainda a venda).
# APROXIMADO e generoso de proposito: so serve pra cortar faixa impossivel do titulo
# ("Peugeot 208 04/22" -> 2013 a 2022, "Kardian 22/27" -> 2024 a 2027).
_PRODUCAO = {
    "Volvo": {"XC60": (2008, None), "S60": (2000, None), "S90": (2016, None), "XC90": (2002, None),
              "XC40": (2018, None), "V40": (1995, 2019), "V60": (2010, None), "C30": (2006, 2013)},
    "Chevrolet": {"Tracker": (2001, None), "Cruze": (2011, 2024), "Captiva": (2008, 2018), "Onix": (2012, None),
                  "S10": (1995, None), "Astra": (1994, 2011), "Celta": (2000, 2015), "Corsa": (1994, 2016),
                  "Spin": (2012, None), "Vectra": (1993, 2011), "Zafira": (2001, 2012), "Monza": (1982, 1996),
                  "Cobalt": (2011, 2020), "Prisma": (2006, 2019), "Blazer": (1995, 2011), "Montana": (2003, None),
                  "Agile": (2009, 2014), "Kadett": (1989, 1998), "Camaro": (2010, 2024), "Classic": (2002, 2016),
                  "Meriva": (2002, 2012), "Omega": (1992, 2012), "Ipanema": (1989, 1998)},
    "Volkswagen": {"Gol": (1980, 2023), "Golf": (1994, None), "T-Cross": (2019, None), "Passat": (1974, 2020),
                   "Polo": (1996, None), "Fox": (2003, 2021), "Up": (2014, 2021), "Jetta": (2006, None),
                   "Santana": (1984, 2006), "Voyage": (1981, 2023), "Amarok": (2010, None), "Tiguan": (2008, None),
                   "Virtus": (2018, None), "Logus": (1993, 1997), "Passat CC": (2008, 2017), "Saveiro": (1982, None),
                   "Parati": (1982, 2012), "Bora": (2000, 2011), "Nivus": (2020, None), "Quantum": (1985, 2002),
                   "Spacefox": (2006, 2018), "Crossfox": (2005, 2020), "Kombi": (1957, 2014), "Pointer": (1993, 1997)},
    "Renault": {"Kardian": (2024, None), "Sandero": (2007, None), "Duster": (2011, None), "Clio": (1996, 2016),
                "Logan": (2007, None), "Megane": (1998, 2013), "Scenic": (1998, 2011), "Captur": (2016, None),
                "Fluence": (2010, 2018), "Kwid": (2017, None), "Oroch": (2015, None), "Symbol": (2008, 2013)},
    "Audi": {"A4": (1995, None), "A3": (1996, None), "Q3": (2011, None), "A1": (2010, 2019), "A5": (2007, None),
             "Q5": (2008, None), "Q7": (2006, None)},
    "BMW": {"X3": (2003, None), "X6": (2008, None), "X5": (1999, None), "X1": (2009, None), "X4": (2014, None)},
    "Citroën": {"C3": (2003, None), "C4 Cactus": (2018, None), "C4": (2004, None), "C4 Pallas": (2007, 2013),
                "C5": (2001, 2017), "Xsara Picasso": (2000, 2012), "C3 Picasso": (2011, 2016),
                "C3 Aircross": (2010, None), "C4 Picasso": (2006, 2019), "Xsara": (1998, 2006)},
    "Ford": {"Focus": (2000, 2019), "Ranger": (1994, None), "Ka": (1997, 2021), "New Fiesta": (2010, 2019),
             "Fiesta": (1995, 2019), "Ecosport": (2003, 2021), "Fusion": (2006, 2020), "Escort": (1983, 2003),
             "Courier": (1997, 2013)},
    "Fiat": {"Toro": (2016, None), "Palio": (1996, 2018), "Uno": (1984, 2021), "Argo": (2017, None),
             "Strada": (1998, None), "Grand Siena": (2012, 2021), "Idea": (2005, 2016), "Palio Weekend": (1997, 2020),
             "Siena": (1997, 2016), "Stilo": (2002, 2011), "Freemont": (2011, 2016), "Mobi": (2016, None),
             "Punto": (2007, 2017), "Cronos": (2018, None), "Doblo": (2001, 2021), "Linea": (2008, 2016),
             "Pulse": (2021, None), "Bravo": (2010, 2016), "Marea": (1998, 2007)},
    "Honda": {"WR-V": (2017, None), "Civic": (1992, None), "Fit": (2003, 2021), "New Civic": (2006, 2016),
              "HR-V": (2015, None), "City": (2009, None), "CR-V": (1997, None)},
    "Hyundai": {"Genesis": (2008, 2016), "HB20": (2012, None), "Azera": (2006, 2018), "ix35": (2009, 2022),
                "Veloster": (2011, 2017), "Tucson": (2004, None), "Creta": (2016, None)},
    "Peugeot": {"3008": (2009, None), "2008": (2015, None), "208": (2013, None), "206": (1999, 2010),
                "207": (2008, 2015), "307": (2002, 2012), "308": (2008, 2020), "407": (2004, 2012),
                "408": (2011, 2019)},
    "Jaguar": {"E-Pace": (2017, None), "F-Pace": (2016, None), "XE": (2015, None), "XF": (2008, None)},
    "Jeep": {"Compass": (2007, None), "Renegade": (2015, None), "Commander": (2006, None)},
    "Mercedes-Benz": {"C320": (2000, 2008), "C180": (1993, None), "C200": (1993, None), "GLA200": (2013, None),
                      "Classe C": (1993, None), "Classe A": (1997, None), "CLA": (2013, None), "GLA": (2013, None)},
    "Nissan": {"Kicks": (2016, None), "Murano": (2002, 2016), "Frontier": (2002, None), "Versa": (2011, None),
               "March": (2011, 2020), "Livina": (2009, 2014), "Tiida": (2007, 2013)},
    "Chery": {"Arrizo": (2016, None), "Tiggo": (2009, None)},
    "Toyota": {"Yaris": (2018, None), "Corolla": (1992, None), "Camry": (1992, None), "Hilux": (1992, None),
               "Corona": (1990, 1998), "Etios": (2012, 2021)},
    "Dodge": {"Journey": (2008, 2020)},
    "Land Rover": {"Discovery": (1990, None)},
    "Kia": {"Picanto": (2004, None), "Sorento": (2002, None), "Sportage": (1995, None), "Mohave": (2008, 2018)},
    "Mitsubishi": {"Pajero Full": (1991, 2021)},
    "JAC": {"J3": (2011, 2016)},
}
PRODUCAO_BR = {(marca, gi.chave_modelo(mod)): faixa
               for marca, mods in _PRODUCAO.items() for mod, faixa in mods.items()}


def _ano2(v):
    v = int(v)
    return 1900 + v if v > 40 else 2000 + v      # mesma regra do gi.anos


def _par_anos(x, y):
    a = _ano2(x) if len(x) == 2 else int(x)
    b = _ano2(y) if len(y) == 2 else int(y)
    if b < a:
        a, b = b, a
    if 1950 <= a and b <= ANO_MAX and b - a <= 40:
        return a, b
    return None


def _ler_anos(titulo, marca="", desde=0):
    """Anos que NAO estao no jeito "18/24": "2019/24", "2017/2021", "2011-2018", "11-18",
    "2020 A 2024", "2000 Até 2000 A 2006", "2015 16 17 18", "2019 2024", "07 A 11",
    "20092013", "2019". -> (a0, a1, posicao no titulo) ou (None, None, None)."""
    nums = gi.MODELO_NUM.get(marca, set())        # Peugeot 2008/3008 e carro, nao ano
    toks = [(m.start(), m.group(0).strip(".,;:()[]")) for m in re.finditer(r"\S+", titulo or "")
            if m.start() >= desde]
    for i, (pos, t) in enumerate(toks):
        tl = t.lower()
        m = re.fullmatch(r"(\d{2}|\d{4})[/\-–](\d{2}|\d{4})", tl)
        if m and (len(m.group(1)) == 4 or "-" in tl or "–" in tl):
            par = _par_anos(m.group(1), m.group(2))
            if par:
                return par + (pos,)
            continue
        m = re.fullmatch(r"((?:19|20)\d{2})((?:19|20)\d{2})", tl)          # "20092013"
        if m:
            par = _par_anos(m.group(1), m.group(2))
            if par and par[1] - par[0] <= 30:
                return par + (pos,)
            continue
        if re.fullmatch(r"(?:19|20)\d{2}", tl) and tl not in nums and 1950 <= int(tl) <= ANO_MAX:
            anos, ultimo, conector = [int(tl)], int(tl), False
            for _, u in toks[i + 1:]:
                u = u.lower()
                if u in _CONECTOR_ANO:
                    conector = True
                    continue
                if re.fullmatch(r"(?:19|20)\d{2}", u) and u not in nums and 1950 <= int(u) <= ANO_MAX:
                    v = int(u)
                elif re.fullmatch(r"\d{2}", u) and (conector or _ano2(u) == ultimo + 1):
                    v = _ano2(u)                   # "2015 16 17 18" (seguidos) ou "2019 a 24"
                else:
                    break
                if v > ANO_MAX:
                    break
                anos.append(v)
                ultimo, conector = v, False
            a, b = min(anos), max(anos)
            if b - a <= 40:
                return a, b, pos
            continue
        if re.fullmatch(r"\d{2}", tl) and i + 2 < len(toks) and toks[i + 1][1].lower() in {"a", "ate", "até", "à"} \
                and re.fullmatch(r"\d{2}", toks[i + 2][1]):                  # "07 A 11"
            par = _par_anos(tl, toks[i + 2][1])
            if par and par[1] - par[0] <= 30:
                return par + (pos,)
    return None, None, None


def _anos_pn(pn):
    """part_number do ML vem com a lista de anos: '31476671 2019-2020-2021' -> (2019, 2021)."""
    anos = []
    for t in (pn or "").split():
        if re.fullmatch(r"(?:(?:19|20)\d{2}-)*(?:19|20)\d{2}", t):
            anos += [int(x) for x in t.split("-")]
    anos = [a for a in anos if 1950 <= a <= ANO_MAX]
    if anos and max(anos) - min(anos) <= 40:
        return min(anos), max(anos)
    return None, None


def anos_do_titulo(titulo, marca="", modelo="", pn=""):
    """Faixa de anos da peca: o titulo ("18/24" e os outros jeitos); sem ano no titulo,
    a lista de anos do part_number do ML. Depois limita ao periodo do carro no Brasil."""
    a0, a1 = gi.anos(titulo)
    if a0 and (a1 - a0) > 40:  # "98/24" mal lido: descarta
        return None, None
    if not a0 and marca:       # sem marca o cartao nao mostra carro: ano solto nao ajuda
        a0, a1, _ = _ler_anos(titulo, marca)
        p0, p1 = _anos_pn(pn)
        if a0 and a0 == a1 and p0 and p0 <= a0 <= p1:
            a0, a1 = p0, p1    # "Wr-v 2026" + part_number 2024-2025-2026: a faixa do vendedor
    if not a0 and marca:
        a0, a1 = _anos_pn(pn)
    if not a0:
        return None, None
    return limitar_anos(a0, a1, marca, modelo)


def limitar_anos(a0, a1, marca="", modelo=""):
    """Corta a faixa no periodo do carro (PRODUCAO_BR) e no ano-modelo maximo de hoje.
    Faixa toda fora do periodo = leitura errada: fica sem ano (nunca ano impossivel)."""
    ini, fim = PRODUCAO_BR.get((marca, gi.chave_modelo(modelo or "")), (None, None))
    lo = max(a0, ini or 1950, 1950)          # "45/48" do jeito classico seria 1945
    hi = min(a1, fim or ANO_MAX, ANO_MAX)
    if lo > hi:
        return None, None
    return lo, hi


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


# --------------------------------------------------------------------------
# Codigo gravado na peca (OEM). O campo do ML as vezes traz lixo: o titulo inteiro
# ("Par Mola Valvula ..."), pedaco do codigo ("920 8K0920900"), anos, marca, "Nao
# informado". Codigo de verdade: 5 a 16 letras/numeros, com letra E numero, ou so
# numeros com 6+ digitos; nunca ano, medida, nome de carro ou dois codigos colados.
# Ordem: atributos do ML (oem, depois part_number); o que tambem esta no titulo vai
# primeiro. Sem codigo valido nos atributos, o do titulo. Sem nenhum: fica vazio
# (o site esconde a caixa "Código gravado na peça").
# --------------------------------------------------------------------------
# anos: "2018-2019-2020", "20072011", "2019a2024", "2019/24" e "2004/10" sem a barra
_COD_ANOS = re.compile(r"^(?:(?:19|20)\d{2})+$|^(?:19|20)\d{2}a(?:19|20)\d{2}$|^(?:19|20)\d{2}[0-3]\d$")
# medida: furacao "5x114,3", "1000w", pneu "T145/90D16"
_COD_MEDIDA = re.compile(r"^\dx\d{3,4}$|^\d{1,4}(?:mm|cm|cv|hp|w|cc|kg|pol)$"
                         r"|^t?(?:1[3-9]|2\d|3[0-3])5[2-9][05][rd](?:1[3-9]|2[0-2])$")
# nome de carro: xDrive30e, GLA200, CLA250
_COD_CARRO = re.compile(r"^(?:[xs]?drive\d+[a-z]?|(?:gla|cla|glc|gle|gls|glk|ml|slk|clk|sl|cl|[abces])\d{3}[a-z]?)$")
_COD_ENCHIMENTO = re.compile(r"^(\d{1,3})\1+$")                        # "010101", "123123", "777777"


def _cod_chave(t):
    return re.sub(r"[^0-9a-z]", "", gi.strip_accents(t or "").lower())


def codigo_valido(t):
    """'31476671', '8L0953513L', 'DS7T-14F239-BP' sim; 'Par', '21544', '2007', 'C390',
    '17mm', '2018-2019-2020', 'GLA200' nao."""
    k = _cod_chave(t)
    if not 5 <= len(k) <= 16 or "," in t:
        return False
    if not ((re.search(r"[a-z]", k) and re.search(r"\d", k)) or (k.isdigit() and len(k) >= 6)):
        return False
    if _COD_ANOS.match(k) or _COD_MEDIDA.match(k) or _COD_CARRO.match(k) or _COD_ENCHIMENTO.match(k):
        return False
    if k in "01234567890123456789" or k in _CONHECIDOS_GLOBAL:        # "123456", nome de carro
        return False
    # codigo interno com palavras ("JAG-EPACE-ENC-TRA3", "GC2-DIFUSOR-CENTRAL")
    return sum(1 for x in re.split(r"[-_.]+", _sem(t)) if x.isalpha() and len(x) >= 3) < 2


def _pedacos_codigo(texto):
    out = []
    for t in re.split(r"[\s,;|]+", texto or ""):
        t = t.strip(".:;()[]{}'\"-_/")
        if not t:
            continue
        if "/" in t:                       # "31476671/31476672" = dois; "DN1T/15K600/JG" = um so
            partes = [x for x in t.split("/") if x]
            if all(codigo_valido(x) for x in partes):
                out.extend(partes)
                continue
            t = "-".join(partes)
        out.append(t)
    return out


def codigos_peca(p):
    """Codigos OEM validos da peca, em MAIUSCULA, o principal primeiro."""
    achados = []
    for campo in (p.get("oem"), p.get("part_number")):
        pedacos = _pedacos_codigo(campo)
        chaves = [_cod_chave(x) for x in pedacos]
        for t, k in zip(pedacos, chaves):
            if not codigo_valido(t):
                continue
            if any(k == a + b for a in chaves for b in chaves if a and b and k not in (a, b)):
                continue                   # "735948200639421" = "73594" + "8200639421"
            achados.append(t)
    if not achados:                        # atributo sem codigo: o do fim do titulo
        achados = [t for t in _pedacos_codigo(p.get("title")) if codigo_valido(t)]
    no_titulo = {_cod_chave(w) for w in (p.get("title") or "").split()}
    vistos, lista = set(), []
    for t in achados:
        k = _cod_chave(t)
        if k not in vistos:
            vistos.add(k)
            lista.append(t.upper())
    # pedaco de outro codigo sai ("64343418" dentro de "TGE64343418", "T5A-A0" dentro de
    # "17800-T5A-A010"); codigo-base + revisao/cor fica ("6EA920730" e "6EA920730A")
    chaves = [_cod_chave(t) for t in lista]
    lista = [t for t, k in zip(lista, chaves)
             if not any(k != o and k in o and not (o.startswith(k) and len(o) - len(k) <= 3) for o in chaves)]
    lista.sort(key=lambda t: _cod_chave(t) not in no_titulo)          # estavel
    return lista


def ficha(p):
    linhas = []
    cods = codigos_peca(p)
    if cods:
        linhas.append(["Código original (OEM)", " / ".join(cods)])
    attrs = p.get("attrs") or {}
    for chave, rotulo in FICHA:
        v = (attrs.get(chave) or "").strip()
        if v and v.lower() not in ("nao", "não", "n/a"):
            linhas.append([rotulo, limpar_attr(chave, v)])
    return linhas


def codigos_busca(p):
    """Codigos pra busca, sem hifen ("31663477" acha "316-63477"); o 1o e o do cartao."""
    return " ".join(dict.fromkeys(_cod_chave(c) for c in codigos_peca(p)))[:120]


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
        nome = modelo_canonico(mc, resolver(mc, ws))
        if nome:
            grafias[(mc, gi.chave_modelo(nome))][exibir(nome)] += 1
    display = {k: v.most_common(1)[0][0] for k, v in grafias.items()}

    # 3) Uma entrada por peca.
    pecas = []
    for p, (mc, ws) in zip(prods, cru):
        nome = modelo_canonico(mc, resolver(mc, ws))
        mod = display.get((mc, gi.chave_modelo(nome)), "") if nome else ""
        # Modelo com uma peca so e quase sempre leitura errada: fica sem.
        if mod and sum(grafias[(mc, gi.chave_modelo(nome))].values()) < 2:
            mod = ""
        if mod and (gi.chave_modelo(mod) == gi.chave_modelo(mc)
                    or gi.chave_modelo(mod) in {gi.chave_modelo(a) for a in MARCAS.get(mc, [])}):
            mod = ""
        a0, a1 = anos_do_titulo(p["title"], mc, mod, p.get("part_number"))
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
            "oem": " ".join(codigos_peca(p)),
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
