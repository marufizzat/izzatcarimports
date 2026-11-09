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
    ("Hyundai", "hb20x"): "HB20", ("Hyundai", "hb20s"): "HB20",     # versoes do HB20 (aventureiro e seda)
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
          "apim", "iaw", "esc", "cgi"}
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


# Linha de lista: "+ Peca: x", "- Volvo XC60 - 2018, ...", "• x", "1) Conferir ...".
_ITEM = re.compile(r"^(?:[+\-•*–—]|(\d{1,2})[).])\s+(?=\S)")
# Linha "Rotulo: valor" ("Material: aco", "Codigo OEM: 32136006"): 2+ seguidas viram lista.
_ROTULO = re.compile(r"^[A-Za-zÀ-ÿ][^:]{0,38}:\s+\S")
# Item sem valor de verdade: "Largura da peca: 0 cm", "Posicao: Conforme aplicacao", "Codigo OEM: SEM CODIGO",
# "Anos:" (rotulo sem nada).
_ITEM_VAZIO = re.compile(r":\s*(?:0+(?:[.,]0+)?\s*(?:cm|mm|m|g|kg)?|conforme aplica[cç][aã]o|n/?a|-+|"
                         r"sem c[oó]digo|n[aã]o informad[oa]|)\s*\.?$", re.I)
_ANOS_SEGUIDOS = re.compile(r"\b(?:19|20)\d{2}(?:(?:\s*[,\-]\s*|\s+)(?:19|20)\d{2}){2,}\b")
# 1a linha do modelo de anuncio: o titulo de novo ("MACANETA INTERNA ESQ ... - ORIGINAL DE FABRICA - OEM X").
_MANCHETE = re.compile(r"\s[-–]\s+original de f[aá]brica\s+[-–]\s+oem\b", re.I)
# Medidas do modelo de anuncio: o vendedor deixa o padrao (25 x 18 x 15 cm, 1500 g) em pecas de todo
# tamanho. Medida repetida em muitas pecas diferentes nao e da peca: a linha sai (_DIM_PADRAO, no main).
_DIM_LINHA = re.compile(r"^\W*(comprimento|largura|altura) da pe[cç]a:\s*([\d.,]+)\s*cm\b", re.I)
_PESO_LINHA = re.compile(r"^\W*peso aproximado", re.I)
_DIM_PADRAO = set()          # {("25", "18", "15")}: preenchido no main() com dimensoes_padrao()
DIM_PADRAO_MIN = 20          # a mesma medida em 20+ anuncios = padrao do modelo, nao medida da peca


def _dimensoes(texto):
    """('25', '18', '15') das linhas "Comprimento/Largura/Altura da peca: N cm", ou None."""
    achou = {}
    for linha in (texto or "").splitlines():
        m = _DIM_LINHA.match(linha.strip())
        if m:
            achou.setdefault(gi.strip_accents(m.group(1)).lower(), m.group(2))
    if len(achou) < 3:
        return None
    return achou["comprimento"], achou["largura"], achou["altura"]


def dimensoes_padrao(textos):
    """Medidas que se repetem em DIM_PADRAO_MIN+ descricoes: o padrao do modelo de anuncio."""
    cont = Counter(d for d in map(_dimensoes, textos) if d)
    return {d for d, n in cont.items() if n >= DIM_PADRAO_MIN}


# Frase que sai: sem dado ("Codigo OEM sem codigo", "Posicao de instalacao: Conforme aplicacao") ou vazia
# ("X: peca original responsavel pela funcao correspondente no veiculo").
_FRASE_FORA = re.compile(r"\bsem c[oó]digo\b|respons[aá]vel pela fun[cç][aã]o correspondente|"
                         r"^posi[cç][aã]o de instala[cç][aã]o:\s*conforme aplica[cç][aã]o", re.I)
# Trocas no texto que fica. O site nao tem "chat do anuncio": quem tira duvida e o WhatsApp.
_TROCAS = [
    (re.compile(r",?\s*sem g[ií]ria\b", re.I), ""),
    (re.compile(r"\benvie mensagem pelo chat do an[uú]ncio\s*[-–—]\s*identificamos na hora", re.I),
     "chame a gente no WhatsApp"),
    (re.compile(r"\b(?:pelo|no) chat do (?:an[uú]ncio|mercado livre)\b", re.I), "pelo WhatsApp"),
    (re.compile(r"\b(pelo|no) chat\b", re.I), r"\1 WhatsApp"),
    (re.compile(r"\bC[oó]digo OEM \(Original Equipment Manufacturer\)"), "Código OEM"),
    (re.compile(r"(?<=[a-zà-ÿ,] )Ou(?= [a-zà-ÿ])"), "ou"),
]


def _limpar_frases(t):
    """Troca o "chat do anuncio" pelo WhatsApp, tira "sem giria" e as frases sem dado."""
    for rx, novo in _TROCAS:
        t = rx.sub(novo, t)
    frases = re.split(r"(?<=[.!?;])\s+(?=[A-ZÀ-Ý0-9])", t.strip())
    return " ".join(f for f in frases if not _FRASE_FORA.search(f)).strip()


def _anos_em_faixa(t):
    """'2018, 2019, 2020, 2021' -> '2018 a 2021' (so quando os anos sao seguidos)."""
    def faixa(m):
        anos = [int(a) for a in re.findall(r"(?:19|20)\d{2}", m.group(0))]
        if all(b == a + 1 for a, b in zip(anos, anos[1:])):
            return f"{anos[0]} a {anos[-1]}"
        return m.group(0)
    return _ANOS_SEGUIDOS.sub(faixa, t)


def _blocos_texto(linhas):
    """Linhas de uma secao -> blocos [tag, [textos]]: frase vira "p", lista vira "ul"/"ol" (antes as
    linhas da lista grudavam numa frase so: "+ Peça: X + Cor: Preto + ..."). Linha com
    promessa sai, e a continuacao dela (linha seguinte comecando em minuscula) tambem."""
    vivas, cortou = [], False
    for linha in linhas:
        if PROMESSA.search(linha):
            cortou = True
            continue
        if cortou and linha[:1].islower():
            continue
        cortou = False
        vivas.append(linha)
    itens = []                     # [tipo, texto]: 'li', 'ol' (numerado), 'rot' (rotulo: valor), 'p'
    for linha in vivas:
        m = _ITEM.match(linha)
        if m:
            itens.append(["ol" if m.group(1) else "li", caixa_normal(linha[m.end():].strip())])
        elif linha[:1].islower() and itens:
            itens[-1][1] += " " + caixa_normal(linha)        # continuacao da linha de cima
        else:
            itens.append(["rot" if _ROTULO.match(linha) else "p", caixa_normal(linha)])
    for i, it in enumerate(itens):  # "Rotulo: valor" sozinho e frase; 2+ seguidos, lista
        if it[0] == "rot":
            viz = [itens[j][0] for j in (i - 1, i + 1) if 0 <= j < len(itens)]
            it[0] = "li" if any(v in ("rot", "li") for v in viz) else "p"
    def texto(t):
        t = acentuar_texto(t)
        t = re.sub(r"\b((?:19|20)\d{2}) at[ée] \1\b", r"\1", t)
        return _sem_trechos_dobrados(_limpar_frases(_anos_em_faixa(t)))

    grupos = []
    for tipo, t in itens:
        if tipo != "p" and _ITEM_VAZIO.search(t):
            continue
        t = texto(t)
        if not t or (tipo != "p" and _ITEM_VAZIO.search(t)):
            continue
        tag = {"p": "p", "ol": "ol"}.get(tipo, "ul")
        if grupos and grupos[-1][0] == tag:
            grupos[-1][1].append(t)
        else:
            grupos.append([tag, [t]])
    return [[tag, [" ".join(ts)]] if tag == "p" else [tag, ts] for tag, ts in grupos]


_ANO = r"(?:19|20)\d{2}"
_FAIXA = re.compile(rf"\b({_ANO})\s*(?:-|–|/|\ba\b|at[ée])\s*({_ANO})\b")


def _sem_trechos_dobrados(t):
    """O modelo de anuncio repete o carro e os anos: "Gol Voyage G5 Gol Voyage G5 2008-2012 (2008 até 2012)",
    "... 2008-2012 ano modelo 2008 até 2012". Fica uma vez so: "Gol Voyage G5 2008 a 2012"."""
    ant = None
    while ant != t:               # trecho de 1 a 6 palavras repetido colado ("A B C A B C" -> "A B C")
        ant = t
        t = re.sub(r"(?<![\wÀ-ÿ])((?:[\wÀ-ÿ.+/-]+\s+){0,5}[\wÀ-ÿ.+/-]+)\s+\1(?![\wÀ-ÿ])", r"\1", t, flags=re.I)
    t = _FAIXA.sub(lambda m: f"{m.group(1)} a {m.group(2)}" if m.group(1) != m.group(2) else m.group(1), t)
    # a mesma faixa de anos dita de novo logo depois: "(2008 a 2012)", "ano modelo 2008 a 2012"
    t = re.sub(rf"\b({_ANO} a {_ANO})\s*\(\s*\1\s*\)", r"\1", t)
    t = re.sub(rf"\b({_ANO} a {_ANO})([^.;]{{0,12}}?)\s*,?\s*(?:ano(?:s)?(?: modelo)?|modelo)?\s*\1\b", r"\1\2", t)
    return re.sub(r"\s{2,}", " ", t).strip()


_PALAVRA_VAZIA = set("""a o as os e de do da dos das em no na nos nas ao aos um uma com sem se nao ou nem por
para que ele ela sao e foi ser""".split())


def _palavras_conteudo(t):
    """Palavras comuns da frase (sem carro, codigo, ano e nome proprio: esses repetem sem ser repeticao)."""
    return {gi.strip_accents(w) for w in re.findall(r"(?<![\wÀ-ÿ])[a-zà-ÿ][a-zà-ÿ]{2,}", t)} - _PALAVRA_VAZIA


def _chave_item(t):
    """'Cor predominante: Preto' -> ('cor', 'preto'); 'Codigo de fabrica / Part Number: 123' -> ('codigo', '123')."""
    k = gi.strip_accents(t).lower()
    if ":" in k:
        rot, _, val = k.partition(":")
        raiz = (re.findall(r"[a-z]+", rot) or [""])[0]
        return raiz, re.sub(r"[^a-z0-9]+", "", val)
    return "", re.sub(r"[^a-z0-9]+", "", k)


def _sem_repetidos(blocos):
    """O modelo de anuncio repete o mesmo dado em 2 secoes ("Material: Plastico" na identificacao e
    nas especificacoes; o paragrafo da condicao da peca duas vezes). Fica so a 1a vez."""
    vistos_itens, paragrafos, saida = [], [], []
    for tag, ts in blocos:
        if tag == "h3":
            saida.append([tag, ts])
            continue
        if tag == "p":
            ws = _palavras_conteudo(ts[0])
            if len(ws) >= 6 and any(len(ws & o) >= 0.6 * min(len(ws), len(o)) for o in paragrafos if len(o) >= 6):
                continue
            paragrafos.append(ws)
            saida.append([tag, ts])
            continue
        novos = []
        for t in ts:
            raiz, val = _chave_item(t)
            # mesmo rotulo e o mesmo valor (ou um valor que so encurta o de antes: "Em excelente estado")
            if val and any(r == raiz and (v == val or (raiz and v.startswith(val))) for r, v in vistos_itens):
                continue
            vistos_itens.append((raiz, val))
            novos.append(t)
        if novos:
            saida.append([tag, novos])
    return saida


def descricao(texto, nome=""):
    """Descricao do ML em HTML limpo: so secoes sobre a peca, titulos com acento,
    sem promessas nao confirmadas, sem CAIXA ALTA, com as listas em lista, sem o
    dado repetido e sem a medida-padrao do modelo de anuncio.
    nome = o nome limpo da peca: o item "Peça: Maçaneta Interna Esq" vira "Peça: Maçaneta interna esquerda"."""
    from html import escape
    blocos, par = [], []
    manter = True          # texto antes do 1o titulo: so se nao tiver promessa
    linhas = (texto or "").splitlines()
    if _dimensoes(texto) in _DIM_PADRAO:            # medida do modelo, nao da peca
        linhas = [x for x in linhas if not (_DIM_LINHA.match(x.strip()) or _PESO_LINHA.match(x.strip()))]

    def fechar():
        if par and manter:
            blocos.extend(_blocos_texto(par))
        par.clear()

    for linha in linhas:
        linha = linha.strip()
        if not linha or re.fullmatch(r"[=\-_* ]{4,}", linha):
            fechar()
            continue
        if _MANCHETE.search(linha):                 # o titulo do anuncio de novo
            continue
        letras = [c for c in linha if c.isalpha()]
        nucleo = re.sub(r"^[=\-_*#\s]+|[=\-_*#\s]+$", "", linha)      # "===== VEICULOS ... =====" e titulo
        titulo = 3 <= len(nucleo) <= 80 and letras and all(c.isupper() for c in letras)
        if titulo:
            fechar()
            chave = _chave_titulo(linha)
            manter = chave.startswith(SECOES_OK) and not PROMESSA.search(chave)
            if manter:
                t = acentuar(chave)
                t = t[:1].upper() + t[1:]
                t = re.sub(r"\s*\(leia com aten[cç][aã]o\)", "", t, flags=re.I)
                blocos.append(["h3", [t]])
        else:
            par.append(linha)
    fechar()
    blocos = _sem_repetidos(blocos)
    if nome:   # "Peça: Maçaneta Interna Esq" (o titulo abreviado de novo) -> o nome limpo, se for a mesma peca
        primeira = _sem(nome.split()[0]) if nome.split() else ""
        for tag, ts in blocos:
            if tag in ("ul", "ol"):
                for i, t in enumerate(ts):
                    m = re.match(r"Peça:\s*(\S+)", t)
                    if m and _sem(m.group(1)) == primeira:
                        ts[i] = "Peça: " + nome
    # titulo sem paragrafo embaixo some
    html = []
    for i, (tag, ts) in enumerate(blocos):
        if tag == "h3" and (i + 1 == len(blocos) or blocos[i + 1][0] == "h3"):
            continue
        if tag in ("h3", "p"):
            html.append(f"<{tag}>" + escape(ts[0]) + f"</{tag}>")
        else:
            html.append(f"<{tag}>" + "".join("<li>" + escape(t) + "</li>" for t in ts) + f"</{tag}>")
    return "\n".join(html)


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


def nome_limpo(titulo, marca, modelo, outros=()):
    """'Lanterna Esquerda Tampa Traseira Volvo Xc 60 18/24 A045591'
    -> 'Lanterna esquerda tampa traseira'. Carro, ano e codigo aparecem a parte.
    outros = os outros carros em que a peca serve ("ms"): saem do nome como o modelo."""
    t = CODIGO_SEPARADO.sub(lambda m: m.group(1) + m.group(2), titulo)   # "Xc 60" -> "Xc60"
    t = gi.ANOS_RE.sub(" ", t)
    t = re.sub(r"\b(19|20)\d{2}\s*(a|até|ate|/|-)\s*(19|20)\d{2}\b", " ", t, flags=re.I)
    t = re.sub(r"\b(19|20)\d{2}\s*/\s*\d{2}\b", " ", t)                 # "2019/24"
    t = re.sub(r"(?<![\w-])\d{2}-\d{2}(?![\w-])", " ", t)                # "11-18"
    t = re.sub(r"\b(19|20)\d{2}\b", " ", t)
    for m in list(_ALIAS_RE.finditer(gi.strip_accents(t).lower()))[::-1]:
        t = t[:m.start()] + " " + t[m.end():]
    chaves_modelo = set()
    for mod in [modelo, *outros]:
        if mod:
            chaves_modelo |= {gi.chave_modelo(w) for w in mod.split()} | {gi.chave_modelo(mod)}
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
    palavras_nome = _sem_trecho_repetido(_sem_lado_repetido(expandir_nome(saida, tirar_carro=bool(modelo))))
    frase = []
    for i, w in enumerate(palavras_nome):
        nucleo = w.strip("()")
        if w in SIGLAS:
            frase.append(w.upper())
        elif CODIGO_NO_NOME.fullmatch(nucleo):             # codigo de motor/chassi: "m270" -> "M270"
            frase.append(w.replace(nucleo, nucleo.upper()))
        elif i == 0:
            frase.append(w[:1].upper() + w[1:])
        elif not modelo and _carro_no_nome(nucleo):        # sem modelo no cartao, o carro do nome e a pista
            frase.append(w.replace(nucleo, _NOMES_PROPRIOS[gi.chave_modelo(nucleo)]))
        else:
            frase.append(w)
    nome = _brake_light(" ".join(frase).strip(" -/"))
    return nome if len(nome) >= 4 or nome.lower() in SIGLAS else titulo


# Codigo de motor, chassi ou versao escrito no nome ("m270", "w246", "p250", "yd25", "g6da"): em MAIUSCULA.
CODIGO_NO_NOME = re.compile(r"[a-z]{1,3}\d{1,4}[a-z]{0,2}")
# Palavras do lado: "esquerdo/motorista", "(motorista)", "passageiro" repetem o lado que o nome ja diz.
_LADO_DE = {"esquerdo": "e", "esquerda": "e", "motorista": "e", "direito": "d", "direita": "d", "passageiro": "d"}


def _lado(w):
    """'e'/'d' quando a palavra so diz o lado ("esquerda", "direito/passageiro", "(motorista)"), senao None."""
    partes = [x for x in _sem(w).strip("()").split("/") if x]
    lados = {_LADO_DE.get(x) for x in partes}
    return lados.pop() if partes and len(lados) == 1 and None not in lados else None


def _sem_lado_repetido(ws):
    """'Lanterna traseira esquerda esquerdo/motorista' -> 'Lanterna traseira esquerda';
    'Maçaneta interna esquerda cromada lado esquerdo (motorista)' -> 'Maçaneta interna esquerda cromada'.
    O lado so sai quando repete o que o nome ja disse (lado diferente fica: e outra informacao)."""
    saida, ja, onde = [], None, -1        # ja = lado dito; onde = posicao (em saida) de quem disse
    for i, w in enumerate(ws):
        lado = _lado(w)
        if lado and ja == lado:
            explicito = _sem(w).strip("()") in ("esquerdo", "esquerda", "direito", "direita")
            if explicito and _sem(saida[onde]).strip("()") in ("motorista", "passageiro"):
                saida[onde] = w                          # "Quebra-sol motorista esquerdo" -> "Quebra-sol esquerdo"
            elif saida and _sem(saida[-1]) == "lado":
                saida.pop()                              # "lado esquerdo" repetido sai inteiro
            continue
        if _sem(w) == "lado" and ja and i + 1 < len(ws) and _lado(ws[i + 1]) == ja:
            continue
        if lado and not ja:
            ja, onde = lado, len(saida)
        saida.append(w)
    return saida


def _sem_trecho_repetido(ws):
    """'Moldura painel instrumentos moldura painel instrumentos' -> 'Moldura painel instrumentos'."""
    ws = list(ws)
    for n in range(len(ws) // 2, 1, -1):
        i = 0
        while i + 2 * n <= len(ws):
            if [_sem(x) for x in ws[i:i + n]] == [_sem(x) for x in ws[i + n:i + 2 * n]]:
                del ws[i + n:i + 2 * n]
            else:
                i += 1
    return ws


def _carro_no_nome(w):
    """Nome de carro ou marca (a grafia conhecida), nunca palavra de peca ("polo" do polo da bateria
    so vira "Polo" quando e o unico jeito de saber o carro: peca sem modelo no cartao)."""
    k = gi.chave_modelo(w)
    return (len(k) >= 3 and k in _NOMES_PROPRIOS and not _palavra_comum(k)
            and k not in {"new", "grand", "gran", "classe", "serie", "range", "land"})


def _brake_light(nome):
    """'Break light luz freio' -> 'Brake light (luz de freio)'; 'Break light fuz freio' idem;
    'Luz de freio break light' -> 'Luz de freio (brake light)'."""
    nome = re.sub(r"\b([Bb])reak(?=[\s-]light)", r"\1rake", nome)
    nome = re.sub(r"\bfuz(?= (de )?freio\b)", "luz", nome)
    nome = re.sub(r"^(Brake light) luz (?:de )?freio\b", r"\1 (luz de freio)", nome)
    return re.sub(r"^(Luz de freio) brake light\b", r"\1 (brake light)", nome)


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
# Subtipo (campo "s"): a folha da categoria do ML. Algumas folhas so fazem sentido
# junto com a mae ("Interruptores > De Vidros", "Estéreos > Com Tela", "... > Outros")
# e apareciam soltas ("De Vidros", "Elétrico") no site. Aqui viram nome inteiro, no
# mesmo estilo dos outros subtipos (o do ML: "Difusores de Ar", "Faróis Traseiros").
# --------------------------------------------------------------------------
# Folhas que nem com a mae ficam claras, ou nomes iguais para coisas diferentes
# ("Mangueiras" do ar e do arrefecimento). Lista curta e auditavel, por categoria do ML.
SUBTIPO_ID = {
    "MLB191714": "Máquinas e Motores de Vidro Elétrico",   # Sistemas de Elevação > Elétrico
    "MLB191715": "Máquinas de Vidro Manuais",              # Sistemas de Elevação > Manual
    "MLB116479": "Máquinas de Vidro",                      # Sistemas de Elevação > Outros
    "MLB459304": "Unidades de Controle",                   # Unidades de Controle e ECUs > Outros
    "MLB430748": "Comandos de Ar Condicionado",            # Climatização > Comandos
    "MLB116536": "Suportes de Ar Condicionado",            # Climatização > Ar Condicionado > Suporte
    "MLB190956": "Interruptores de Ar Condicionado",       # Climatização > Ar Condicionado > Interruptores
    "MLB430747": "Botões de Climatização",                 # Climatização > Botões
    "MLB60610": "Kits de Ar Condicionado",                 # Climatização > Ar Condicionado > Kit Completo
    "MLB269575": "Interruptores de Eletroventilador",      # Eletroventiladores > Interruptores
    "MLB116505": "Mangueiras de Ar Condicionado",          # Ar Condicionado > Mangueiras e Conexões > Mangueiras
    "MLB458968": "Mangueiras de Arrefecimento",            # Motor > Refrigeração > Mangueiras > Mangueiras
    "MLB63712": "Tampas do Motor",                         # Componentes de Motor > Tampas > Tampas
    "MLB458659": "Suportes da Carroceria",                 # Carroceria > Suportes e Abraçadeiras > Suportes
    "MLB459110": "Suportes da Transmissão",                # Transmissão > Fixadores e Ferragens > Suportes
    "MLB459203": "Molduras das Portas",                    # Aces. > Exterior > Molduras e Acabamentos > Portas
    "MLB456265": "Molduras Externas",                      # Linha Pesada > Acessórios de Exterior > Molduras
    "MLB458699": "Molduras de Retrovisores",               # Retrovisores Laterais > Componentes > Molduras
    "MLB458929": "Linhas do Motor",                        # Motor > Mangueira, Linha e Tubulações > Linhas
    "MLB458551": "Motor Teto Solar",                       # Tetos solares > Motores (= "Motor Teto Solar")
    "MLB116338": "Macacos Hidráulicos",                    # Elevação > Macacos > Hidráulico
    "MLB169600": "Telas Multimídia",                       # Som Automotivo > Telas
    "MLB438558": "Interfaces de Som",                      # Som Automotivo > Interfaces
    "MLB11099": "Kits de Alarme",                          # Alarmes e Acessórios > Kits Completos
    "MLB440306": "Controles de Alarme",                    # Segurança Veicular > Controles
}
_SUBTIPO_PREP = re.compile(r"^(de|do|da|dos|das|com|sem|para)\s", re.I)


def subtipo(cat, cid=""):
    """Nome do tipo de peca: 'Interruptores > De Vidros' -> 'Interruptores de Vidros',
    'Estéreos > Com Tela' -> 'Estéreos com Tela', 'Pedais > Outros' -> 'Pedais'.
    'Outros' logo abaixo da familia continua 'Outros' (as paginas ja o tratam a parte)."""
    if not cat:
        return ""
    if cid in SUBTIPO_ID:
        return SUBTIPO_ID[cid]
    nome = (cat.get("nome") or "").strip()
    path = cat.get("path") or []
    mae = path[-2].strip() if len(path) >= 2 else ""
    if mae and _SUBTIPO_PREP.match(nome):
        base = mae.split(" e ")[0].strip()          # "Fechaduras e Chaves" -> "Fechaduras"
        return base + " " + nome[:1].lower() + nome[1:]
    if mae and nome.lower() in ("outros", "outras") and len(path) >= 5:
        return mae                                   # "Pedais > Outros" -> "Pedais"
    return nome


# --------------------------------------------------------------------------
# Tipo de peca com o NOME DA LOJA. O subtipo() acima ainda e a arvore do ML: nome de
# catalogo ("Interruptores de Piscas-alertas", "Faróis Traseiros" para lanternas,
# "Faróis de três Stop"), erro ("Suportes de Bateris"), grafia antiga ("Pára-Lamas",
# "Solenóides") e o mesmo tipo com 2 nomes ("Catalisador" e "Catalisadores", "Quebra Sol"
# e "Quebra Sóis"). Aqui vira o nome que o cliente procura, e os sinonimos viram UM so.
# Lista auditavel: nome do ML (depois do subtipo) -> nome da loja. "Outros" = grupo do ML
# que mistura de tudo (a pagina nao mostra cartao "Outros"; a peca continua na familia).
# --------------------------------------------------------------------------
TIPO_LOJA = {
    # Peças de Interior
    "Interruptores de Vidros": "Botões do Vidro Elétrico",
    "Interruptores de Luzes": "Chaves de Seta e Luz",
    "Interruptores de Para-brisas": "Chaves do Limpador",
    "Interruptores de Piscas-alertas": "Botões do Pisca-alerta",
    "Interruptores de Espelhos Laterais": "Botões do Retrovisor",
    "Interruptores de Desembaçadores": "Botões do Desembaçador",
    "Interruptores do volante": "Botões do Volante",
    "Interruptores de Travas Centrais": "Outros Botões",
    "Interruptores de Botão": "Outros Botões",
    "Botões de Bloqueio Central": "Botões da Trava Elétrica",
    "Botões Pulsadores": "Botões de Partida",
    "Interruptores de Tetos Solares": "Botões do Teto Solar",
    "Velocímetros e Conta-giros": "Painéis de Instrumentos",
    "Medidores de Painel": "Painéis de Instrumentos",
    "Cobre Painéis": "Acabamentos do Painel",
    "Revestimentos do Painel": "Acabamentos do Painel",
    "Painéis de Painel": "Acabamentos do Painel",
    "Tampas de Painel": "Acabamentos do Painel",
    "Painel e Instrumental": "Acabamentos do Painel",
    "Revestimentos de console": "Acabamentos do Painel",
    "Kits Interiores": "Acabamentos do Painel",
    "Painéis Completos": "Outros",                       # o ML junta ali de moldura a amortecedor
    "Colunas e Copos": "Acabamentos de Coluna",
    "Pilares": "Acabamentos de Coluna",
    "Painéis para Portas": "Forros",
    "Maçanetas Interiores de Porta": "Maçanetas Internas",
    "Puxadores de Porta": "Puxadores das Portas",
    "Espelhos Retrovisores Internos": "Retrovisores Internos",
    "Portaluvas Completos": "Porta-luvas",
    "Tampas de Porta Luva": "Porta-luvas",
    "Dobradiças de Porta-luva": "Porta-luvas",
    "Trincos": "Porta-luvas",
    "Tampas das Caixas de Fusíveis": "Tampas da Caixa de Fusíveis",
    "Alavanca Freio de Mão": "Alavancas do Freio de Mão",
    "Alavancas de Câmbio": "Alavancas e Manoplas de Câmbio",
    "Manopla de Câmbio": "Alavancas e Manoplas de Câmbio",
    "Coifas de Câmbio": "Alavancas e Manoplas de Câmbio",
    "Acabamentos de Alavancas": "Alavancas e Manoplas de Câmbio",
    "Quebra Sóis": "Quebra-sóis", "Quebra Sol": "Quebra-sóis",
    "Isqueiros": "Tomadas USB e Acendedores", "Carregadores de Porta USB": "Tomadas USB e Acendedores",
    "Bancos": "Peças de Banco", "Buchas para Trilhos": "Peças de Banco",
    "Apoio de Cabeças": "Encostos de Cabeça",
    "Miolos de Volante": "Volantes", "Travas de Volantes": "Volantes",
    "Armazenamentos Central": "Consoles", "Suportes de Consolas": "Consoles",
    "Bases de Console Central": "Consoles", "Suportes para Óculos de Sol": "Consoles",
    "Abertura Tanque de Combustível": "Cabos e Alavancas de Abertura",
    "Abertura Porta Malas": "Cabos e Alavancas de Abertura",
    "Abertura Capô": "Cabos e Alavancas de Abertura",
    "Maçanetas de Capô": "Cabos e Alavancas de Abertura",
    "Alavancas e Manoplas": "Alças e Puxadores", "Alças": "Alças e Puxadores",
    "Displays Multifuncionais": "Displays e Telas", "Câmera Veicular": "Câmeras",
    "Tampões": "Tampões do Porta-malas",
    "Descansos de Pé": "Pedais",
    "Capas para Alto-falante": "Grades de Alto-falante",
    "Protetores de Tapetes": "Tapetes e Protetores",
    "Aquecedores": "Outros",
    # Carroceria
    "Maçanetas para Portas": "Maçanetas das Portas",
    "Espelhos Retrovisores Laterais": "Retrovisores Externos",
    "Espelhos Retrovisores e Lentes": "Retrovisores Externos",
    "Capas para Espelhos Laterais": "Capas e Molduras do Retrovisor",
    "Painéis de Soleira": "Soleiras",
    "Dobradiças da Porta": "Dobradiças e Limitadores de Porta",
    "Suportes para Portas": "Dobradiças e Limitadores de Porta",
    "Suportes de Para-choques": "Guias e Suportes do Para-choque",
    "Suportes de Para-lamas": "Suportes da Carroceria",
    "Dobradiças de Capô": "Dobradiças do Capô",
    "Grades de Para-choques": "Grades do Para-choque",
    "Painéis Frontais": "Outros",                        # acabamento interno, painel lateral, tweeter...
    "Dobradiças da Porta Mala": "Dobradiças da Tampa Traseira",
    "Frisos para Portas": "Frisos das Portas",
    "Frisos para Janelas": "Guias e Frisos dos Vidros",
    "Frisos para Faróis": "Frisos dos Faróis",
    "Tampas de Combustível": "Portinholas e Tampas do Tanque",
    "Bóias de Combustível": "Boias de Combustível",
    "Painéis laterais": "Outros", "Painéis Laterais": "Molduras Laterais",
    "Lateral de carroceria": "Molduras Laterais",
    "Almas de Para-choques": "Almas do Para-choque",
    "Suportes de Estepe": "Suportes do Estepe",
    "Malas e Tampas Traseiras": "Acabamentos da Tampa Traseira",
    "Tampas de Malas": "Acabamentos da Tampa Traseira",
    "Tampas de Porta Mala": "Acabamentos da Tampa Traseira",
    "Tampas Traseiras de Caçamba": "Acabamentos da Tampa Traseira",
    "Fechaduras de Portão Traseiro": "Acabamentos da Tampa Traseira",
    "Motor Teto Solar": "Motores do Teto Solar",
    "Alargadores de Para-lamas": "Molduras do Para-lama",
    "Alargadores de Pára-Lamas": "Molduras do Para-lama",
    "Quadros de Faróis Dianteiros": "Suportes do Farol",
    "Pára-Lamas": "Para-lamas",
    "Pára-choques Traseiros": "Para-choques", "Pára-choques Dianteiros": "Para-choques",
    "Alerons Aerodinâmicos": "Aerofólios",
    "Portas e Painéis": "Outros",
    "Fechaduras de Porta-malas": "Fechaduras do Porta-malas",
    "Fechaduras de Capô": "Fechaduras do Capô",
    "Parabarros": "Para-barros", "Revestimentos Internos": "Para-barros",
    "Grampos": "Grampos e Presilhas",
    "Suportes Elevação do Capô": "Amortecedores da Tampa e do Capô",
    "Painéis dos Para-brisas": "Grades do Para-brisa",
    "Inserções para Para-choques": "Molduras do Para-choque",
    # Climatização
    "Motor de Calefação": "Atuadores e Motores do Ar", "Calefação": "Atuadores e Motores do Ar",
    "Suportes de Ar Condicionado": "Suportes do Compressor",
    "Interruptores de Ar Condicionado": "Resistências e Relés do Ar",
    "Resistências de Motor": "Resistências e Relés do Ar",
    "Painel Evaporador": "Evaporadores",
    "Válvula de Expansão": "Válvulas de Expansão",
    "Grades de Ventilação": "Difusores de Ar", "Difusores de Ar Condicionado": "Difusores de Ar",
    "Radiador de Calefação": "Radiadores do Ar Quente",
    "Botões de Climatização": "Comandos de Ar Condicionado",
    "Válvula de Calefação": "Válvulas da Calefação",
    # Arrefecimento
    "Interruptores de Eletroventilador": "Relés da Ventoinha",
    "Eletroventiladores Completos": "Eletroventiladores",
    # Escapamentos
    "Catalisador": "Catalisadores",
    # Fechaduras e Chaves
    "Fechaduras de Portas": "Fechaduras das Portas",
    "Fechaduras para Porta-malas e Portões": "Fechaduras do Porta-malas",
    "Fechaduras de Portão e Porta-malas": "Fechaduras do Porta-malas",
    "Fechadura de Capôs": "Fechaduras do Capô",
    "Cilindro de Ignição": "Cilindros e Comutadores de Ignição",
    "Comutadores de Ignição": "Cilindros e Comutadores de Ignição",
    "Interruptores de Energia": "Chaves do Carro",
    # Filtros
    "Caixa do Filtro de Ar": "Caixas do Filtro de Ar",
    "Filtros de Óleo": "Suportes do Filtro de Óleo",
    # Freios
    "Servo Freio": "Hidrovácuos",
    "Módulos de Controle do ABS": "Módulos ABS",
    "Bomba Depressor": "Bombas de Vácuo",
    "Cilindro de Freio": "Cilindros Mestres",
    "Sensor ABS": "Sensores ABS",
    "Pinças": "Pinças de Freio",
    "Reservatório do Líquido": "Reservatórios de Fluido",
    "Flexíveis": "Mangueiras e Flexíveis do Freio",
    "Mangueiras e Linhas": "Mangueiras e Flexíveis do Freio",
    "Tubos": "Mangueiras e Flexíveis do Freio",
    "Sensores de Freio": "Sensores do Freio", "Sensores e Comutadores": "Sensores do Freio",
    "Relés da Unidade de Controle": "Relés",
    # Ignição
    "Suportes de Alternador": "Suportes do Alternador",
    "Bobina de Ignição": "Bobinas de Ignição",
    "Módulo de Ignição": "Módulos de Ignição e Imobilizador",
    "Motor de Arranque": "Motores de Arranque",
    "Suportes de Bateris": "Caixas e Suportes da Bateria",
    "Caixas de Bateria": "Caixas e Suportes da Bateria",
    "Tampas de Bateria": "Caixas e Suportes da Bateria",
    "Interruptores de Freio de Mão": "Outros Botões",
    "Avanços a Vácuo": "Mangueiras e Linhas do Motor",
    "Interruptores de Vácuo": "Sensores de Vácuo",
    # Iluminação
    "Faróis Traseiros": "Lanternas Traseiras", "Lanternas": "Lanternas Traseiras",
    "Faróis Dianteiros": "Faróis",
    "Refletores Olho de Gato": "Refletores",
    "Faróis de três Stop": "Brake Light",
    "Luzes de Teto": "Luzes Internas",
    "Lanternas de Placas": "Luzes de Placa",
    "Lâmpadas": "Reatores e Lâmpadas",
    # Injeção
    "Corpo de Borboleta": "Corpos de Borboleta", "Kits de Engrenagens Borboleta": "Corpos de Borboleta",
    "Módulo de Injeção": "Módulos de Injeção",
    "Válvulas Canister": "Válvulas e Filtros Canister", "Vapor de Gasolina": "Válvulas e Filtros Canister",
    "Flauta do Bico Injetor": "Flautas de Combustível",
    "Sensor MAP": "Sensores MAP", "Sensor MAF": "Sensores MAF",
    "Sensor de Posição": "Sensores de Posição", "Sensor de Detonação": "Sensores de Detonação",
    "Sensor de Velocidade": "Sensores de Velocidade", "Sensor de Rotação": "Sensores de Rotação",
    "Sensores": "Outros Sensores",
    "Sonda Lambda": "Sondas Lambda",
    "Injetores": "Bicos Injetores",
    "Canos de Injetores": "Canos dos Injetores",
    "Regulador de Pressão": "Reguladores de Pressão",
    "Válvula EGR": "Válvulas EGR",
    # Janelas e Vedações
    "Borracha": "Guias e Canaletas do Vidro",
    "Molduras de Janela": "Molduras das Janelas",
    "Vidros Traseiros": "Máquinas e Motores de Vidro Elétrico",   # as 2 do ML sao motores de vidro
    "Máquinas de Vidro": "Peças da Máquina de Vidro",              # "Sistemas de Elevação > Outros": suporte
    # Motor
    "Coxins de Motor": "Coxins do Motor", "Suportes de Montagem de Motor": "Coxins do Motor",
    "Mangueira Radiador": "Mangueiras de Arrefecimento",          # o mesmo que "Mangueiras de Arrefecimento"
    "Mangueira Intercooler": "Mangueiras do Turbo e Intercooler",
    "Mangueiras de Turbo": "Mangueiras do Turbo e Intercooler",
    "Tampas Protetoras de Motor": "Capas e Protetores do Motor",
    "Protetores Laterais de Motor": "Capas e Protetores do Motor",
    "Protetor de Cárter": "Capas e Protetores do Motor",
    "Outras Bombas": "Bombas de Combustível",
    "Bombas Injetoras": "Bombas de Alta Pressão",
    "Tampas do Motor": "Tampas de Válvulas",
    "Tampa de Óleo": "Tampas de Óleo", "Tampa de Enchimento de Óleo": "Tampas de Óleo",
    "Mangueiras": "Mangueiras e Linhas do Motor", "Linhas do Motor": "Mangueiras e Linhas do Motor",
    "Mangueira, Linha e Tubulações": "Mangueiras e Linhas do Motor",
    "Mangueiras de Combustível": "Mangueiras e Linhas do Motor",
    "Mangueiras do Resfriador": "Mangueiras e Linhas do Motor",
    "Polias para Bombas de Água": "Bombas de Água", "Flanges para Bombas de Água": "Bombas de Água",
    "Carcaças de Bombas de Água": "Bombas de Água", "Peças para Bombas": "Bombas de Água",
    "Tensores Poly V": "Tensores de Correia", "Polias de Tensores": "Tensores de Correia",
    "Tensor do Distribuidor": "Tensores de Corrente",
    "Válvulas Solenóides": "Válvulas Solenoides",
    "Reservatório": "Reservatórios de Água", "Radiadores": "Reservatórios de Água",
    "Tampa do Radiador": "Reservatórios de Água",
    "Cárters Completos": "Cárteres",
    "Motor completo": "Motores",
    "Parafusos do Cilindro": "Parafusos do Cabeçote",
    "Sensor de Temperatura": "Sensores de Temperatura", "Sensor de Temperatura de Ar": "Sensores de Temperatura",
    "Sensor de Óleo": "Sensores de Pressão do Óleo",
    "Coletor de Escapamento": "Coletores de Escapamento",
    "Tampas de Correntes": "Tampas da Distribuição",
    "Corrente de Distribuição": "Peças da Distribuição", "Distribuição": "Peças da Distribuição",
    "Engrenagem Árvore de Comando": "Peças da Distribuição",
    "Montagens do Radiador": "Suportes do Radiador",
    "Carcaças de Termostato": "Válvulas Termostáticas", "Elementos do Termostato": "Válvulas Termostáticas",
    "Virabrequim": "Virabrequins", "Polia de Virabrequim": "Virabrequins",
    "Kits de Pistões": "Pistões", "Bloco Completo": "Blocos do Motor",
    "Árvores Comandos de Válvulas": "Comandos de Válvulas",
    "Radiadores de Água": "Radiadores", "Radiadores Intercooler": "Intercoolers",
    "Carcaças de Ventilador": "Motores de Ventilador",
    "Cabo Acelerador": "Cabos do Acelerador", "Cabo Afogador": "Outros", "Outros Componentes": "Outros",
    # Peças de Exterior
    "Motor Limpador Para-brisas": "Motores do Limpador", "Elos e Transmissões": "Motores do Limpador",
    "Amortecedores a Gás": "Amortecedores da Tampa e do Capô",
    "Borrachas": "Borrachas de Vedação",
    "Braços de Limpa Para-brisas": "Braços do Limpador", "Braços Limpavidros Traseiros": "Braços do Limpador",
    "Molduras e Acabamentos": "Molduras Externas",
    "Reservatório de Para-brisas": "Reservatórios do Lavador",
    "Bombas de Lavagem": "Bombas do Lavador",
    "Limpadores e Lavadores": "Sensores de Chuva",
    "Antenas de Conectividade": "Antenas",
    "Espelhos Padrão": "Retrovisores Externos",
    "Molduras de Retrovisores": "Capas e Molduras do Retrovisor",
    "Forros de Capô": "Isolamentos do Capô",
    "Suportes para Placas": "Suportes da Placa",
    "Ganchos para Reboque": "Ganchos de Reboque",
    "Molduras de Para-choques": "Molduras do Para-choque",
    "Estribos e Soleiras": "Soleiras",
    # Segurança
    "Air Bags": "Airbags, Módulos e Sensores", "Módulo Air Bag": "Airbags, Módulos e Sensores",
    "Alarmes para Automotores": "Alarmes e Sirenes", "Sirenes": "Alarmes e Sirenes",
    "Kits de Alarme": "Alarmes e Sirenes", "Sirenes de Alarme": "Alarmes e Sirenes",
    "Controles de Alarme": "Módulos Eletrônicos",           # o unico do ML e um modulo de controle do farol
    "Kit de Segurança para Carros": "Macacos e Chaves de Roda",
    "Trincos para Portas e Janelas": "Outros",
    # Sistema Elétrico
    "Módulos de Fusíveis": "Caixas de Fusíveis", "Modulos de Fusiveis": "Caixas de Fusíveis",
    "Porta-Fusíveis": "Caixas de Fusíveis",
    "Módulos Controle das Portas": "Módulos de Conforto (BCM)",
    "Instalações Elétricas": "Chicotes Elétricos", "Arneses de Fiação": "Chicotes Elétricos",
    "Chicote da Carroceria": "Chicotes Elétricos", "Extensão de Chicote": "Chicotes Elétricos",
    "Kits de Chicotes de Fiação": "Outros",               # amplificador e radio no ML
    "Unidades de Controle": "Módulos Eletrônicos", "Módulos Central Temporização": "Módulos Eletrônicos",
    "Módulo de Controle do PCM": "Módulos Eletrônicos", "Módulos de Injetores": "Módulos Eletrônicos",
    "Controladores Motor AC": "Módulos Eletrônicos",
    "Módulos Controle Transmissão": "Módulos Eletrônicos", "Módulos Controle da Caixa": "Módulos Eletrônicos",
    "Inversores de Potência": "Conversores e Módulos de Bateria",
    "Conversores de Tensão": "Conversores e Módulos de Bateria",
    "Módulo Potência de Bateria": "Conversores e Módulos de Bateria",
    "Cabos Negativo de Baterias": "Cabos e Terminais de Bateria",
    "Cabo Positivo de Bateria": "Cabos e Terminais de Bateria",
    "Sensores de Nível": "Outros Sensores",
    # Som e Multimídia
    "Estéreos com Tela": "Centrais Multimídia", "Telas Multimídia": "Centrais Multimídia",
    "Estéreos sem Tela": "Rádios",
    "Grades para Caixas de Som": "Grades de Alto-falante",
    "Molduras para Estéreos": "Molduras da Multimídia",
    "Módulos Amplificadores": "Amplificadores",
    "Alto-Falantes": "Alto-falantes",
    "Gavetas de Fixação": "Suportes da Multimídia",
    # Suspensão e Direção
    "Braços Oscilantes": "Braços da Suspensão", "Braços De Suspensão": "Braços da Suspensão",
    "Ligações Laterais": "Braços da Suspensão",
    "Bandejas de Suspensão": "Bandejas da Suspensão",
    "Rodas de Carros e Caminhonetes": "Rodas",
    "Suportes de Bombas": "Bombas de Direção e Suportes", "Bombas Eletrohidráulicas": "Bombas de Direção e Suportes",
    "Bomba Hidráulica": "Bombas de Direção e Suportes",
    "Cruzeta Coluna de Direção": "Colunas de Direção",
    "Semi Eixo": "Semieixos",
    "Feixes de Mola": "Molas", "Suportes de Molas": "Molas",
    "Coxim Amortecedor": "Coxins do Amortecedor",
    "Bieletas": "Bieletas e Barras Estabilizadoras", "Barras Estabilizadoras": "Bieletas e Barras Estabilizadoras",
    "Sensores de Altura": "Suspensão a Ar e Nivelamento", "Peças Nivelamento Automático": "Suspensão a Ar e Nivelamento",
    "Suspensão a Ar": "Suspensão a Ar e Nivelamento",
    "Mangueira Direção Hidráulica": "Mangueiras da Direção",
    "Pinças de Freios": "Outros",
    "Quadros de Suspensão": "Quadros da Suspensão",
    "Terminal Ponteira de Direção": "Terminais de Direção",
    "Caixa de Direção": "Caixas de Direção", "Cubo de Roda": "Cubos de Roda",
    "Interruptores de Direção": "Sensores da Direção",
    # Transmissão
    "Coxim do Câmbio": "Coxins do Câmbio",
    "Seletora do Trambulador": "Trambuladores e Seletores", "Seletoras": "Trambuladores e Seletores",
    "Cabo Seletor de Marcha": "Trambuladores e Seletores",
    "Caixa de Câmbio": "Câmbios e Peças Internas", "Câmbios": "Câmbios e Peças Internas",
    "Engrenagem de Marcha": "Câmbios e Peças Internas",
    "Módulo de Troca de Marchas": "Módulos do Câmbio e da Tração",
    "Módulo Controle Transmissão": "Módulos do Câmbio e da Tração",
    "Semi Eixos": "Semieixos e Suportes", "Rolamentos": "Semieixos e Suportes",
    "Suportes da Transmissão": "Semieixos e Suportes",
    "Caixa de Transferência": "Caixas de Transferência",
    "Chicotes de Fios": "Outros", "Cardan": "Cardans",
}
# Palavra que fica minuscula no meio do nome do tipo ("Botões do Vidro Elétrico").
_TIPO_MINUSC = {"de", "do", "da", "dos", "das", "e", "com", "sem", "para", "em", "no", "na", "nos", "nas", "ou", "a", "o"}


def _titulo_tipo(s):
    """'Painéis laterais' -> 'Painéis Laterais'; 'Braços De Suspensão' -> 'Braços de Suspensão'.
    Sigla fica (ABS, MAP); o resto da palavra nao muda ("Alto-falantes")."""
    out = []
    for i, w in enumerate(s.split()):
        if i and w.lower() in _TIPO_MINUSC:
            out.append(w.lower())
        elif len(w) > 1 and w.isupper():
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


# O mesmo nome do ML com sentido diferente conforme a familia ("Bolsas de Ar": airbag no interior,
# bolsa da suspensao a ar na suspensao).
TIPO_LOJA_FAMILIA = {
    ("Suspensão e Direção", "Bolsas de Ar"): "Suspensão a Ar e Nivelamento",
    ("Peças de Interior", "Bolsas de Ar"): "Airbags, Módulos e Sensores",
    ("Peças de Interior", "Terminais de Cabos"): "Cabos e Terminais de Bateria",
}
# Tipo que o ML espalha em 2 familias: fica numa so (a do mesmo tipo com mais pecas).
TIPO_FAMILIA = {
    "Airbags, Módulos e Sensores": "Segurança", "Cintos de Segurança": "Segurança",
    "Alarmes e Sirenes": "Segurança", "Dobradiças do Capô": "Carroceria", "Sensores do Freio": "Freios",
    "Sensores de Estacionamento": "Sistema Elétrico", "Câmeras de Ré": "Sistema Elétrico",
    "Cabos e Terminais de Bateria": "Sistema Elétrico",
}


def tipo_loja(s, familia=""):
    """Nome do tipo (do subtipo() do ML) -> nome da loja, com os sinonimos juntos."""
    if not s:
        return s
    return TIPO_LOJA_FAMILIA.get((familia, s)) or TIPO_LOJA.get(s) or _titulo_tipo(s)


# Peca na familia (ou no tipo) errada: o vendedor escolheu a categoria do ML errada
# ("Chave roda" em Fechaduras, "Módulo câmbio" em Ignição, "Motor vidro" em Motor, "Botão
# vidro" em Ignição). O NOME da peca manda mais que a categoria. Lista curta e auditavel:
# (regex no nome sem acento, familias de onde tira (None = todas), familia nova, tipo novo).
# Familia nova None = fica na mesma. A 1a regra que casa vale.
REGRAS_NOME = [
    # macaco e chave de roda: o kit do carro, junto do "Kit macaco chave roda triângulo" que o ML ja poe em Segurança
    (r"^(kit macaco|chave (de )?roda|isopor estepe|macaco)\b", None, "Segurança", "Macacos e Chaves de Roda"),
    (r"^(motor|maquina) (de )?vidro\b(?!.*\bmanual)", {"Motor"}, "Janelas e Vedações",
     "Máquinas e Motores de Vidro Elétrico"),
    (r"^modulo (do )?(cambio|tracao)\b", None, "Transmissão", "Módulos do Câmbio e da Tração"),
    (r"\bconversor (de )?torque\b", None, "Transmissão", "Câmbios e Peças Internas"),
    (r"^botao (do )?freio (de )?(mao|estacionamento)\b", {"Ignição"}, "Freios", "Botões do Freio de Mão"),
    (r"^sensor (do )?hidrovacuo\b", {"Ignição", "Injeção"}, "Freios", "Sensores do Freio"),
    (r"\b(hidrovacuo|vacuo (do )?freio)\b", {"Ignição"}, "Freios", "Mangueiras e Flexíveis do Freio"),
    (r"^mangueira\b", {"Ignição"}, "Motor", "Mangueiras e Linhas do Motor"),
    (r"^(botao|botoes|botoneira|comando|interruptor)( interruptor)? (do )?vidro", {"Ignição"},
     "Peças de Interior", "Botões do Vidro Elétrico"),
    (r"^botao (start|partida|ignicao)|\bstart stop\b", {"Ignição", "Peças de Interior"}, "Ignição", "Botões de Partida"),
    (r"^botao\b", {"Ignição"}, "Peças de Interior", "Outros Botões"),
    (r"^modulo (de )?injecao\b", {"Sistema Elétrico"}, "Injeção", "Módulos de Injeção"),
    (r"^modulo (conforto|bcm|bsi)\b", {"Sistema Elétrico", "Ignição", "Injeção"}, "Sistema Elétrico",
     "Módulos de Conforto (BCM)"),
    (r"^painel (de )?instrumentos?\b", {"Peças de Interior"}, None, "Painéis de Instrumentos"),
    (r"^luz\b", {"Peças de Interior"}, None, "Luzes Internas"),
]
_REGRAS_NOME = [(re.compile(rx), origem, fam, tipo) for rx, origem, fam, tipo in REGRAS_NOME]
# Grupo do ML que mistura de tudo ("Painéis Completos" -> "Outros"): o que o nome diz com certeza
# ganha o tipo certo; o resto fica "Outros" (sem cartao proprio na pagina da categoria).
OUTROS_POR_NOME = {
    "Peças de Interior": [(r"^(moldura|acabamento|tampa|capa)\b.*\bpainel\b", "Acabamentos do Painel"),
                          (r"^(moldura|acabamento)\b.*\bcoluna\b", "Acabamentos de Coluna")],
}
_OUTROS_POR_NOME = {f: [(re.compile(rx), t) for rx, t in rs] for f, rs in OUTROS_POR_NOME.items()}
# Os botoes que o ML mistura num grupo so ("Botões de Bloqueio Central" com botao de ESP, de
# alarme, de banco): ai o nome tambem escolhe o tipo, dentro de Peças de Interior.
TIPOS_BOTAO = {"Botões da Trava Elétrica", "Outros Botões", "Botões do Teto Solar", "Botões de Partida"}
BOTAO_POR_NOME = [
    (r"\bvidro", "Botões do Vidro Elétrico"), (r"\bpisca|\balerta\b", "Botões do Pisca-alerta"),
    (r"\b(retrovisor|espelho)", "Botões do Retrovisor"), (r"\bdesembacador", "Botões do Desembaçador"),
    (r"\btrava\b(?!.*\bbanco\b)", "Botões da Trava Elétrica"), (r"\bteto solar\b", "Botões do Teto Solar"),
    (r"\b(start|partida)\b", "Botões de Partida"),
]
_BOTAO_POR_NOME = [(re.compile(rx), tipo) for rx, tipo in BOTAO_POR_NOME]


def classificar(nome, familia, tipo):
    """(familia, tipo) da peca: o da categoria do ML, corrigido pelo NOME quando o vendedor
    escolheu a categoria errada (REGRAS_NOME) ou quando o grupo do ML mistura botoes."""
    k = gi.strip_accents(nome or "").lower()
    for rx, origem, fam_nova, tipo_novo in _REGRAS_NOME:
        if (origem is None or familia in origem) and rx.search(k):
            return fam_nova or familia, tipo_novo
    if tipo in TIPO_FAMILIA:
        return TIPO_FAMILIA[tipo], tipo
    if familia == "Peças de Interior" and tipo in TIPOS_BOTAO:
        for rx, tipo_novo in _BOTAO_POR_NOME:
            if rx.search(k):
                return familia, tipo_novo
        return familia, "Outros Botões" if tipo == "Botões da Trava Elétrica" else tipo
    if tipo == "Outros":
        for rx, tipo_novo in _OUTROS_POR_NOME.get(familia, []):
            if rx.search(k):
                return familia, tipo_novo
    return familia, tipo


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
_COD_ENCHIMENTO = re.compile(r"^(\d{1,3})\1+\d?$")                  # "010101", "123123", "777777", "101010101"


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


# --------------------------------------------------------------------------
# CAIXA ALTA -> frase normal (descricao e ficha). O anuncio do ML vem muito em
# MAIUSCULAS ("PEDAL ACELERADOR HONDA FIT 1.5 - ORIGINAL DE FABRICA - OEM X").
# So muda a caixa (e a repeticao colada "VOLKSWAGEN VOLKSWAGEN"): nada e inventado
# nem tirado. Codigo (tem numero), sigla e nome de marca/carro ficam como devem.
# --------------------------------------------------------------------------
# Siglas que ficam em MAIUSCULAS no texto. Conjunto proprio: o SIGLAS do nome da peca
# e outro (mexer nele muda os nomes das pecas).
SIGLAS_TEXTO = SIGLAS | set("""oem bcm bsi uch tcu tcm pcm ecm cem ecu abs esp ebd srs tpms egr pcv maf map
tbi dpf adas acc bsm pdc epb eps vvt vtec dohc sohc cvt dsg tsi tdi tfsi fsi gdi crdi mpi thp vti hdi dci tce
cgi gti amg awd 4wd fwd rwd suv cd dvd usb gps lcd mp3 led drl hid ptc ntc obd nfe cdv cdc vw gm bmw jac byd
abs/esp mqb spa vcds odis vida mmi hud tps ckp cmp iac atf epdm pvc rs vdo trw ngk skf zf ii iii iv vi vii viii
ix""".split())
# Siglas de versao que so ficam em maiusculas logo depois do carro ("Fiesta SE SEL", "Ka SE"):
# fora dali "SE", "SI", "EX" sao palavras ("se tiver duvida").
SIGLAS_VERSAO = set("""se sel si ex exl exs lx lxs ls lt ltz gl glx gls gt gts st ss rs sr sri xr xl xlt xls rt
hse sxt srt cc tt dx lxi gli""".split())
# Palavras que nao sao nome de carro (o nome do carro nunca e uma destas).
_NAO_NOME = set("""tipo serie classe original de do da com sem para""".split())
# Fornecedores de peca (o "Fabricante" que vale mostrar) e versoes comuns, com a grafia.
_FORNECEDORES_NOMES = """Bosch Valeo Delphi Denso Magneti Marelli Continental Hella Webasto Harman Kardon Sachs
Mahle Visteon Siemens Behr Nakata Cofap Monroe Brose Aisin Hitachi Mitsuba Mobis Omron""".split()
_NOMES_EXTRA = _FORNECEDORES_NOMES + """Detran Sportline Comfortline Highline Trendline Titanium Elegance
Attractive Essence Sporting Tendance Exclusive Allure Griffe Momentum Inscription Premier Vivace Zetec Sigma
Duratec Rocam Ecoboost Etorq Fittipaldi Rallye Trekking Adventure Tigershark""".split()
_NOMES_PROPRIOS = {}          # chave ("xc60", "golf") -> grafia ("XC60", "Golf")
_MODELOS_CHAVE = set()        # chaves dos nomes de carro inteiros ("c4cactus", "grandsiena")


def _aprender_nomes(nomes, modelos=False):
    """Ensina a grafia dos nomes de marca/carro ('C4 Cactus' -> c4: C4, cactus: Cactus)."""
    for nome in nomes:
        if not nome:
            continue
        if modelos:
            _MODELOS_CHAVE.add(gi.chave_modelo(nome))
        for w in re.split(r"[\s/]+", nome):
            k = gi.chave_modelo(w)
            if len(k) >= 2 and not k.isdigit() and k not in _NAO_NOME:
                _NOMES_PROPRIOS.setdefault(k, w)


_aprender_nomes(MARCAS)
_aprender_nomes(["VW", "GM", "BMW", "JAC", "RAM", "MB", "Citroën", "Mercedes", "Benz", "Chevy", "Range Rover"])
_aprender_nomes([exibir(w) for w in MODELOS_SOLTOS], modelos=True)
_aprender_nomes(list(GRAFIA.values()), modelos=True)
_aprender_nomes([m for mods in _PRODUCAO.values() for m in mods], modelos=True)
_aprender_nomes(_NOMES_EXTRA)

# Palavras de frase (preposicao, artigo) e de peca: param a "sequencia do carro".
_FUNCAO = set("""de da do das dos e em no na nos nas ou a o as os ao aos por pelo pela com sem para um uma
que ate até se sob sobre entre apos após mais menos muito cada todo toda todos todas este esta esse essa""".split())
_COMUNS = set("""original originais genuino genuina fabrica peca pecas motor lado kit par conjunto completo
completa novo nova usado usada modelo versao ano anos linha tipo cor preto preta branco branca cinza prata
cromado cromada vermelho azul bege oem codigo referencia unidade jogo aplicacao veiculo veiculos carro""".split())
# Carroceria/combustivel: minusculas, mas a sequencia do carro continua ("Fiesta hatch sedan SE SEL").
_NEUTRAS = set("""hatch sedan flex turbo diesel gasolina etanol alcool hibrido hybrid coupe cabrio wagon
sportback avant perua cabine dupla simples""".split())


def _palavra_comum(k):
    return (k in _FUNCAO or k in _COMUNS or k in _GENERO or k in _PALAVRAS or k in ACENTOS
            or k in ABREV_ADJETIVO or k in ABREV_INVARIAVEL or k in ABREV_FIXA)


def _maiusc(w):
    """Palavra so de letras e toda em maiusculas ("FAROL", "ELÉTRICO", "R-DESIGN")."""
    letras = [c for c in w if c.isalpha()]
    return len(letras) >= 2 and all(c.isupper() for c in letras) and not any(c.isdigit() for c in w)


def _capital(w):
    return "-".join(x[:1].upper() + x[1:].lower() for x in w.split("-"))


def _troca_palavra(w, na_seq):
    """(nova grafia, continua a sequencia do carro?) de uma palavra em CAIXA ALTA."""
    k = gi.chave_modelo(w)
    if k in SIGLAS_TEXTO:
        return w, na_seq
    if k in _NOMES_PROPRIOS:
        g = _NOMES_PROPRIOS[k]
        return (g if gi.chave_modelo(g) == k else _capital(w)), True
    if "-" in w and all(gi.chave_modelo(x) in _NOMES_PROPRIOS or gi.chave_modelo(x) in SIGLAS_TEXTO
                        for x in w.split("-") if x):        # "MERCEDES-BENZ", "DETRAN-RS"
        return "-".join(_troca_palavra(x, True)[0] for x in w.split("-")), True
    if na_seq and k in SIGLAS_VERSAO:
        return w, True
    if k in _NEUTRAS:
        return w.lower(), na_seq
    if _palavra_comum(k):
        return w.lower(), False
    if na_seq:
        return _capital(w), True                          # versao: "Vivace", "Way", "Elegance"
    return w.lower(), False


_TOKEN = re.compile(r"[0-9A-Za-zÀ-ÖØ-öø-ÿ][0-9A-Za-zÀ-ÖØ-öø-ÿ'.\-]*[0-9A-Za-zÀ-ÖØ-öø-ÿ]|[0-9A-Za-zÀ-ÖØ-öø-ÿ]")
_PARA_SEQ = re.compile(r"\s-\s|[(),.;:|!?\[\]]")          # separador que encerra a sequencia do carro


def caixa_normal(texto):
    """'MÓDULO ALCANCE FAROL VOLKSWAGEN VOLKSWAGEN GOLF 1.4 TSI - ORIGINAL DE FABRICA - OEM 5Q0907357'
    -> 'Módulo alcance farol Volkswagen Golf 1.4 TSI - original de fábrica - OEM 5Q0907357'.
    Linha mista (frase normal com trecho em caixa alta) so troca o trecho com nome de marca/carro
    ou que e frase; a palavra solta de enfase ("DIREITO") e o rotulo citado ficam."""
    if not texto:
        return texto
    toks = list(_TOKEN.finditer(texto))
    palavras = [m for m in toks if not any(c.isdigit() for c in m.group(0)) and len(m.group(0)) >= 2]
    altas = [m for m in palavras if _maiusc(m.group(0))]
    if not altas:
        return _sem_repeticao(texto)
    forcado = len(altas) >= 3 and len(altas) >= 0.6 * len(palavras)
    elegivel = set()
    if forcado:
        elegivel = {m.start() for m in altas}
    else:
        # mista: o trecho em caixa alta muda quando tem nome de marca/carro ("RENAULT SANDERO DUSTER")
        # ou e frase (3+ palavras, uma delas de frase/peca: "MÓDULO DE INJEÇÃO"). Palavra solta de
        # enfase ("DIREITO") e rotulo citado ("FRONT VEHICLE DIRECTION", "SEM CÓDIGO") ficam.
        def fechar_grupo(grupo):
            while grupo and len(grupo[-1].group(0)) == 1:   # "E" solto no fim nao e do trecho
                grupo = grupo[:-1]
            ks = [gi.chave_modelo(g.group(0)) for g in grupo]
            rotulo = bool(grupo) and not texto[:grupo[0].start()].strip() \
                and texto[grupo[-1].end():].lstrip().startswith(":")       # "CÓDIGO OEM: X"
            if any(k in _NOMES_PROPRIOS for k in ks) or (any(_palavra_comum(k) for k in ks)
                                                        and (len(grupo) >= 3 or (rotulo and len(grupo) >= 2))):
                elegivel.update(g.start() for g in grupo)
        grupo = []
        for m in toks:
            w = m.group(0)
            junto = grupo and re.fullmatch(r"[\s/]+", texto[grupo[-1].end():m.start()])
            if _maiusc(w) and (not grupo or junto):
                grupo.append(m)
                continue
            if junto and len(w) == 1 and w.isupper() and w.isalpha():   # "TECIDO E PLÁSTICO"
                grupo.append(m)
                continue
            fechar_grupo(grupo)
            grupo = [m] if _maiusc(w) else []
        fechar_grupo(grupo)
    saida, pos, na_seq = [], 0, False
    for m in toks:
        entre = texto[pos:m.start()]
        if _PARA_SEQ.search(entre):
            na_seq = False
        saida.append(entre)
        w = m.group(0)
        k = gi.chave_modelo(w)
        if m.start() in elegivel:
            w, na_seq = _troca_palavra(w, na_seq)
        elif any(c.isdigit() for c in w):
            na_seq = na_seq or k in _NOMES_PROPRIOS          # "XC60", "C4" tambem abrem o carro
        elif len(w) == 1:
            if forcado and not na_seq and w in "AEOÀÉ":       # "208, 2008 E CITROEN" -> "e"
                w = w.lower()
            na_seq = na_seq and w not in "aeoàé"
        else:
            na_seq = (k in _NOMES_PROPRIOS) or (na_seq and not _palavra_comum(k))
        saida.append(w)
        pos = m.end()
    saida.append(texto[pos:])
    novo = "".join(saida)
    # inicio de frase continua com maiuscula ("MODULO ..." -> "Modulo ...")
    novo = re.sub(r"(^|[.!?]\s+)([a-zà-ÿ])", lambda x: x.group(1) + x.group(2).upper(), novo)
    return _sem_repeticao(novo)


def _sem_repeticao(texto):
    """Marca/carro repetido colado: 'Volkswagen Volkswagen Golf', 'Fiat Fiat Uno', 'Volkswagen VW Gol'."""
    def marca_de(w):
        return _ALIAS_MAP.get(gi.strip_accents(w).lower())

    def repete(a, b):
        if a.lower() == b.lower():
            return gi.chave_modelo(a) in _NOMES_PROPRIOS
        return bool(marca_de(a)) and marca_de(a) == marca_de(b)

    saida, pos, ant = [], 0, None
    for m in re.finditer(r"[A-Za-zÀ-ÿ][\wÀ-ÿ-]*", texto):
        sep, w = texto[pos:m.start()], m.group(0)
        depois = texto[m.end():m.end() + 1]
        if ant is not None and sep == " " and depois != "/" and repete(ant, w):
            pos = m.end()                       # some a palavra repetida e o espaco antes dela
            continue
        saida += [sep, w]
        pos, ant = m.end(), w
    saida.append(texto[pos:])
    return "".join(saida)


# Acentos que o texto do anuncio perde, so palavras sem outra leitura (a lista do
# acentuar() vale para o nome da peca; esta e so para a descricao e a ficha).
_PALAVRAS_TEXTO = {
    "anuncio": "anúncio", "anuncios": "anúncios", "procedencia": "procedência", "sao": "são",
    "aluminio": "alumínio", "cambio": "câmbio", "responsavel": "responsável", "macaneta": "maçaneta",
    "macanetas": "maçanetas", "aco": "aço", "cabecote": "cabeçote", "vacuo": "vácuo", "estetica": "estética",
    "valvulas": "válvulas", "capo": "capô", "resistencia": "resistência", "potencia": "potência",
    "saida": "saída", "reforcada": "reforçada", "reforcado": "reforçado", "reforco": "reforço",
    "carcaca": "carcaça", "reservatorio": "reservatório", "eletricos": "elétricos", "eletricas": "elétricas",
    "seguranca": "segurança", "braco": "braço", "bracos": "braços", "multimidia": "multimídia",
    "termico": "térmico", "termica": "térmica", "proximo": "próximo", "proxima": "próxima",
    "abracadeira": "abraçadeira", "abracadeiras": "abraçadeiras", "maquina": "máquina", "atraves": "através",
    "desembacador": "desembaçador", "rele": "relé", "hibrido": "híbrido", "hibrida": "híbrida",
    "dobradica": "dobradiça", "dobradicas": "dobradiças", "carter": "cárter", "dimensoes": "dimensões",
    "radio": "rádio", "hidrovacuo": "hidrovácuo", "hidraulica": "hidráulica", "eletronicos": "eletrônicos",
    "eletronicas": "eletrônicas", "acustico": "acústico", "acustica": "acústica", "eficiencia": "eficiência",
    "especifico": "específico", "sintetico": "sintético", "camera": "câmera", "arranhoes": "arranhões",
    "termostatica": "termostática", "multiplos": "múltiplos", "multiplas": "múltiplas", "calco": "calço",
    "angulo": "ângulo", "audio": "áudio", "presenca": "presença", "fumaca": "fumaça", "velocimetro": "velocímetro",
    "secundaria": "secundária", "primario": "primário", "primaria": "primária", "faisca": "faísca",
    "intemperies": "intempéries", "obstaculos": "obstáculos", "alca": "alça", "estavel": "estável",
    "necessario": "necessário", "necessaria": "necessária", "varios": "vários", "varias": "várias",
    "acessorio": "acessório", "acessorios": "acessórios", "pinca": "pinça", "facil": "fácil",
    "colisoes": "colisões", "balanco": "balanço", "experiencia": "experiência", "pratico": "prático",
    "sera": "será", "generica": "genérica", "generico": "genérico", "catalogo": "catálogo", "giria": "gíria",
    "maxima": "máxima", "maximo": "máximo", "minimo": "mínimo", "minima": "mínima", "auxilio": "auxílio",
    "esfericas": "esféricas", "rotulas": "rótulas", "planetaria": "planetária", "ruido": "ruído",
    "ruidos": "ruídos", "otimo": "ótimo", "otima": "ótima", "proprio": "próprio", "propria": "própria",
    "periodo": "período", "conteudo": "conteúdo", "citroen": "citroën", "serie": "série", "camara": "câmara",
    "duvida": "dúvida", "logistica": "logística", "plasticos": "plásticos", "metalicos": "metálicos",
    "versoes": "versões", "versao": "versão", "forca": "força", "gas": "gás", "pe": "pé",
}
# "-avel/-aveis" e sempre "-ável/-áveis" ("ajustavel", "memorizaveis")
_REGRAS_TEXTO = [(re.compile(r"(?<=[a-z]{2})aveis\b"), "áveis"), (re.compile(r"(?<=[a-z]{2})avel\b"), "ável")]


def acentuar_texto(texto):
    """acentuar() + as palavras da lista acima + "de fabrica" -> "de fábrica".
    Pedaco com numero (codigo: "F1EP7K004FD3JA6", "5u0819703") fica como esta."""
    def palavra(m):
        if not m.group(0).isascii():
            return m.group(0)                   # ja tem acento ("Peça" nao vira "Péça")
        w = acentuar(m.group(0))
        novo = _PALAVRAS_TEXTO.get(w.lower())
        if novo is None:
            lw = w.lower()
            for rx, sub in _REGRAS_TEXTO:
                lw = rx.sub(sub, lw)
            if lw == w.lower():
                return w
            novo = lw
        if w.isupper() and len(w) > 1:
            return novo.upper()
        return novo[:1].upper() + novo[1:] if w[:1].isupper() else novo

    def pedaco(m):
        p = m.group(0)
        return p if re.search(r"\d", p) else re.sub(r"[A-Za-zÀ-ÖØ-öø-ÿ]+", palavra, p)
    t = re.sub(r"\S+", pedaco, texto or "")
    return re.sub(r"\b(d[eoa]s?) (f)abrica\b", lambda m: f"{m.group(1)} {m.group(2)}ábrica", t, flags=re.I)


def frase_valor(v):
    """Valor curto da ficha em frase normal: 'PLASTICO COM COMPONENTES ELETRÔNICOS' ->
    'Plástico com componentes eletrônicos', 'Plastico com Placa Eletronica' -> 'Plástico com placa eletrônica'.
    Siglas (ABS, EPDM) e letras soltas ('E/D') ficam."""
    def palavra(m):
        w = m.group(0)
        if any(c.isdigit() for c in w) or len(w) == 1:
            return w
        k = gi.chave_modelo(w)
        if k in SIGLAS_TEXTO:
            return w.upper()
        return w.lower()
    t = acentuar_texto(_TOKEN.sub(palavra, v.strip()))
    return t[:1].upper() + t[1:]


# --------------------------------------------------------------------------
# Ficha da peca. Os atributos do ML foram escritos pro robo de busca: vem em CAIXA
# ALTA, sem acento, com o carro repetido ("Fabricante: VOLVO S60", "Modelo: XC60")
# e listas enormes ("Captiva / Captiva Sport / ..."). Aqui: rotulo claro, valor com a
# maiuscula certa, sem o que o topo ja diz (marca, modelo, "Original") e sem vazio.
# --------------------------------------------------------------------------
_VALOR_VAZIO = re.compile(r"^(?:-+1?|0|n/?a|nao|não|nenhum[a]?|nao informado|não informado|nao se aplica|"
                          r"não se aplica|conforme aplica[cç][aã]o|sim)$", re.I)
_PAISES = {"brasil", "china", "alemanha", "suecia", "japao", "eua", "estados unidos", "mexico", "argentina",
           "franca", "italia", "espanha", "coreia", "coreia do sul", "india", "tailandia", "portugal",
           "reino unido", "inglaterra", "hungria", "republica tcheca", "polonia", "nacional", "importado"}
_CORES_EN = {"red": "Vermelho", "black": "Preto", "silver": "Prata", "gray": "Cinza", "grey": "Cinza",
             "white": "Branco", "blue": "Azul"}
_LIXO_FABRICANTE = {"original", "originais", "genuina", "genuino", "oem", "new", "novo", "nova", "peca", "pecas"}
_ANOS_FIM = re.compile(r"\s*\(?\b((?:19|20)?\d{2})\s*(?:/|-|–|a|até|ate)\s*((?:19|20)?\d{2})\)?\s*$"
                       r"|\s*\(?\b((?:19|20)\d{2})\)?\s*$", re.I)


def _anos_no_fim(item, y):
    """'XC60 18/24' com a peca 2018-2024 -> 'XC60' (o ano ja esta em "Serve em").
    Ano diferente do da peca fica (e informacao, nao repeticao)."""
    m = _ANOS_FIM.search(item)
    if not m or not y:
        return item
    if m.group(3):
        a = b = int(m.group(3))
    else:
        x, z = m.group(1), m.group(2)
        a = _ano2(x) if len(x) == 2 else int(x)
        b = _ano2(z) if len(z) == 2 else int(z)
    if y[0] - 1 <= min(a, b) and max(a, b) <= y[1] + 1 and item[:m.start()].strip():
        return item[:m.start()].strip()
    return item


def _grafia_carro(item):
    """Grafia de carro: 'PAJERO FULL' -> 'Pajero Full', 'Xc60' -> 'XC60', 'Wr-v' -> 'WR-V'."""
    def palavra(m):
        w = m.group(0)
        k = gi.chave_modelo(w)
        if k in GRAFIA:
            return GRAFIA[k]
        g = _NOMES_PROPRIOS.get(k)
        if g and gi.chave_modelo(g) == k and (w.isupper() or w.islower() or re.search(r"\d", w)):
            return g
        if _maiusc(w) and len(w) >= 4 and k not in SIGLAS_TEXTO:
            return _capital(w)
        if re.fullmatch(r"[a-z]{1,2}\d{1,2}", w):        # versao "t8" -> "T8"
            return w.upper()
        return w
    return _TOKEN.sub(palavra, item)


def _separar_barra(x):
    """Barra sem espaco so separa dois NOMES ("XC60/XC90", "Gol/Voyage"); nunca ano ("18/24"),
    numero ("208/2008", "206/207"), versao curta ("T5/T8", "G5/G6", "R/T") nem frase/parenteses."""
    if "/" not in x or "(" in x or re.search(r"\.\s", x):
        return [x]
    pedacos = x.split("/")
    partes, atual = [], pedacos[0]
    for p in pedacos[1:]:
        antes = re.split(r"[\s/]+", atual.strip())[-1]
        depois = p.split()[0] if p.split() else ""
        if (re.search(r"[A-Za-z]", antes) and re.search(r"[A-Za-z]", depois)
                and not (len(antes) <= 2 and len(depois) <= 2)
                and not atual.endswith(" ") and not p.startswith(" ")):
            partes.append(atual.strip())
            atual = p
        else:
            atual += "/" + p
    partes.append(atual.strip())
    return [p for p in partes if p]


def _separar_modelos(v):
    """'C4 / C4 Cactus / Strada/Bravo' -> ['C4', 'C4 Cactus', 'Strada', 'Bravo']."""
    itens = []
    for x in re.split(r"\s+/\s+|\s*·\s*|\s*;\s*|,\s+", v):
        if x.strip():
            itens += _separar_barra(x.strip())
    return itens


def _eh_carro(w):
    """Palavra que abre um nome de carro (modelo ou marca): 'XC60', 'Tiguan', 'Peugeot'."""
    k = gi.chave_modelo(w)
    return k in _MODELOS_CHAVE or k in _CONHECIDOS_GLOBAL or gi.strip_accents(w).lower() in _ALIAS_MAP


def modelos_ficha(v, marca="", modelo="", y=None):
    """Atributo MODEL do ML -> [rotulo, valor] ou None quando so repete o carro do topo.
    Lista com versoes vira um carro por linha: 'C4 Cactus: Feel, Shine, Live'; lista so de
    carros vira uma linha: 'C320, C200, C180'. Nenhum nome e tirado (o ano igual ao do topo sai)."""
    itens = [_grafia_carro(acentuar_texto(_anos_no_fim(caixa_normal(x), y))) for x in _separar_modelos(v)]
    itens = [x for x in itens if x and not _VALOR_VAZIO.match(x)]
    if not itens:
        return None
    # marca do topo no comeco de todos ("Volkswagen Golf 1.4 TSI", "VW Gol / VW Voyage") sai
    if marca:
        def sem_marca(x):
            t = gi.strip_accents(x).lower()
            for a in sorted([marca.lower(), *MARCAS.get(marca, [])], key=len, reverse=True):
                a = gi.strip_accents(a)
                if t.startswith(a + " "):
                    return x[len(a) + 1:].strip()
            return None
        sem = [sem_marca(x) for x in itens]
        if all(sem):
            itens = sem
    # versoes debaixo do carro: base literal ("C4 Cactus" -> "C4 Cactus Feel") ou carro conhecido
    # que abre 2+ itens sem aparecer sozinho ("Saveiro G3 / Saveiro G4" -> "Saveiro: G3, G4").
    # Pedaco que nao e carro ("XC60 2.0 T5 / T8 SPA", "Passat B6 / B7") fica com o de cima.
    primeiro = Counter(x.split()[0].lower() for x in itens if len(x.split()) > 1)
    bases = {x.lower() for x in itens}
    grupos = []                                  # [base, [versoes], pedacos colados na base]
    for x in itens:
        alvo = None
        for g in sorted(grupos, key=lambda g: -len(g[0])):
            if x.lower().startswith(g[0].lower() + " ") and gi.chave_modelo(x) not in _MODELOS_CHAVE:
                alvo = g
                break
        if alvo is None:
            w0 = x.split()[0]
            if len(x.split()) > 1 and primeiro[w0.lower()] >= 2 and w0.lower() not in bases \
                    and gi.chave_modelo(w0) in _MODELOS_CHAVE:
                alvo = next((g for g in grupos if g[0].lower() == w0.lower()), None)
                if alvo is None:
                    alvo = [w0, []]
                    grupos.append(alvo)
        if alvo is not None:
            resto = x[len(alvo[0]):].strip()
            if resto and resto.lower() not in (r.lower() for r in alvo[1]):
                alvo[1].append(resto)
        elif grupos and not _eh_carro(x.split()[0]):
            ant = grupos[-1]
            if ant[1] or gi.chave_modelo(ant[0]) in _MODELOS_CHAVE:
                ant[1].append(x)                  # "XC60" + "T8" -> "XC60: T8"
            else:
                ant[0] = f"{ant[0]} / {x}"         # "XC60 2.0 T5" + "T8 SPA" -> "XC60 2.0 T5 / T8 SPA"
        elif not any(g[0].lower() == x.lower() for g in grupos):
            grupos.append([x, []])
    if len(grupos) == 1 and not grupos[0][1]:
        unico = grupos[0][0]
        do_topo = {gi.chave_modelo(w) for w in f"{marca} {modelo}".split()} | {gi.chave_modelo(modelo)}
        if modelo and all(gi.chave_modelo(w) in do_topo for w in unico.split()):
            return None                       # "XC60", "Fiesta" com "Serve em Ford New Fiesta": repetido
        return ["Modelo do veículo", unico]
    # o carro da pagina primeiro; o resto na ordem do anuncio
    grupos.sort(key=lambda g: gi.chave_modelo(g[0]) != gi.chave_modelo(modelo or "-"))
    if not any(vs for _, vs in grupos):           # so carros, sem versao: uma linha, na ordem do anuncio
        lista = list(dict.fromkeys(itens))
        lista.sort(key=lambda x: gi.chave_modelo(x) != gi.chave_modelo(modelo or "-"))
        return ["Modelos compatíveis", ", ".join(lista)]
    linhas = [f"{b}: {', '.join(vs)}" if vs else b for b, vs in grupos]
    return ["Modelos e versões", "\n".join(linhas)]


_FORNECEDORES = {gi.chave_modelo(w) for w in _FORNECEDORES_NOMES} | {"trw", "vdo", "zf", "ngk"}
_ALIASES_MARCA = {gi.strip_accents(a).lower() for a in _ALIAS_MAP} | {"general motors", "stellantis", "vag"}


def _fabricante(v, marca):
    """Fabricante da PECA (Bosch, Calsonic Kansei, Hyundai Mobis). Sai quando fala do carro:
    a marca (de qualquer montadora: o carro ja esta em "Serve em"), modelo, ou os dois juntos
    ("FORD NEW", "VOLVO S60", "Gm Cruze", "fordka", "Renaul", "Audi, Original")."""
    import difflib
    toks = [t for t in re.split(r"[\s,/()-]+", v) if t]
    toks = [t for t in toks if gi.chave_modelo(t) not in _LIXO_FABRICANTE]
    if not toks:
        return None
    if any(gi.chave_modelo(t) in _FORNECEDORES for t in toks):
        pass                                                   # "Hyundai Mobis", "Siemens - VDO"
    else:
        texto = gi.strip_accents(" ".join(toks)).lower()
        if texto in _ALIASES_MARCA:
            return None
        nomes = sorted(_ALIASES_MARCA) + sorted(_MODELOS_CHAVE)

        def do_carro(t):
            k = gi.chave_modelo(t)
            if gi.strip_accents(t).lower() in _ALIASES_MARCA or k in _MODELOS_CHAVE or k in _CONHECIDOS_GLOBAL:
                return True
            if any(k.startswith(gi.chave_modelo(a)) for a in _ALIASES_MARCA if len(a) >= 3):
                return True                                    # "fordka", "Renaul"... (pedaco de marca)
            if any(gi.chave_modelo(a).startswith(k) for a in _ALIASES_MARCA if len(k) >= 4):
                return True                                    # "Land", "Renaul"
            return len(k) >= 4 and bool(difflib.get_close_matches(k, nomes, n=1, cutoff=0.75))
        if any(do_carro(t) for t in toks):
            return None
    return " ".join(t.upper() if gi.chave_modelo(t) in SIGLAS_TEXTO
                    else _capital(t) if _maiusc(t) and len(t) > 3 else t for t in toks)


def _origem(v):
    """País de origem. 'Original-31346697' (o vendedor pos o codigo aqui) sai: a pagina ja
    diz que a peca e original (Procedencia). 'Suécia-Motor-Cabeçote' -> 'Suécia'."""
    k = gi.strip_accents(v).lower().strip()
    if k.startswith("original"):
        return None
    pais = k.split("-")[0].strip()
    if pais in _PAISES:
        return frase_valor(v.split("-")[0])
    return frase_valor(v) if k in _PAISES else None


def ficha(p, marca="", modelo="", y=None):
    """Linhas da ficha: [rotulo, valor]. Valor com quebra de linha = um item por linha.
    marca/modelo/y = o carro que o topo ja mostra (o que so repete ele sai)."""
    linhas = []
    cods = codigos_peca(p)
    if cods:
        linhas.append(["Código original (OEM)", " / ".join(cods)])
    attrs = p.get("attrs") or {}
    for chave, rotulo in FICHA:
        v = re.sub(r"\s+", " ", (attrs.get(chave) or "")).strip()
        if not v or _VALOR_VAZIO.match(v):
            continue
        if chave == "MODEL":
            linha = modelos_ficha(v, marca, modelo, y)
        elif chave == "ORIGIN":
            o = _origem(v)
            linha = ["Origem", o] if o else None
        elif chave == "MANUFACTURER":
            f = _fabricante(v, marca)
            linha = ["Fabricante da peça", f] if f else None
        elif chave == "COLOR":
            linha = [rotulo, _CORES_EN.get(v.lower()) or frase_valor(v)]
        else:                                             # POSITION, MATERIAL
            linha = [rotulo, frase_valor(v)]
        if linha and linha[1] and not _VALOR_VAZIO.match(linha[1]):
            linhas.append(linha)
    return linhas


def estoque(p):
    """Unidades em estoque que o ML informa ("available"). So inteiro >= 1; qualquer outra coisa
    vira None e a pagina nao fala de estoque (nada de "peca unica" sem o dado de verdade)."""
    q = p.get("available")
    if isinstance(q, bool) or not isinstance(q, int) or q < 1:
        return None
    return q


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


# --------------------------------------------------------------------------
# Peca que serve em mais de um carro. O titulo do ML lista os carros em sequencia
# ("Conversor Tensao Volvo S60 Xc60 T8", "Modulo Conforto Fiat Palio Siena Strada"):
# antes so o 1o contava, e o dono do XC60 nao via a peca na pagina do carro dele.
# --------------------------------------------------------------------------
def modelos_do_titulo(marca, ws, principal, validos):
    """[principal, outros carros da MESMA marca escritos no trecho do carro do titulo].
    ws = palavras() do titulo; validos = {(marca, chave): nome} dos modelos de 2+ pecas.
    Nome composto vale inteiro ("C4 Cactus", "New Fiesta" nao viram "C4"/"Fiesta" de novo);
    versao, motor e geracao ("T8", "G6", "E60") nao sao outro carro."""
    lista = [principal] if principal else []
    geracao = GERACAO_MARCA.get(marca)
    i = 0
    while i < len(ws):
        achou = None
        for n in (2, 1):
            if i + n > len(ws):
                continue
            # chassi/geracao ("E46", "E60", "W203") nao e outro carro escrito no titulo: o apelido dele
            # (Série 3, Série 5, Classe C) juntaria modelos que o dono ainda vai decidir (item L4)
            if geracao and any(geracao.fullmatch(w.lower()) for w in ws[i:i + n]):
                continue
            nome = modelo_canonico(marca, " ".join(ws[i:i + n]))
            alvo = validos.get((marca, gi.chave_modelo(nome))) if nome else None
            if alvo:
                achou = (alvo, n)
                break
        if achou:
            if achou[0] not in lista:
                lista.append(achou[0])
            i += achou[1]
        else:
            i += 1
    return lista


def anos_por_modelo(ms, marca, a0, a1):
    """(carros, anos de cada um) da peca de 2+ carros. A faixa do titulo vale para todos, cortada no
    periodo de venda de cada carro ("Fit Wr-v 15/21": WR-V so a partir de 2017). Carro cuja faixa fica
    toda fora do periodo dele sai (leitura impossivel). anos = None quando todos ficam com a mesma faixa."""
    if len(ms) < 2 or not a0:
        return ms, None
    carros, anos = [ms[0]], [[a0, a1]]
    for mod in ms[1:]:
        r0, r1 = limitar_anos(a0, a1, marca, mod)
        if r0:
            carros.append(mod)
            anos.append([r0, r1])
    return carros, (anos if any(a != [a0, a1] for a in anos) and len(carros) > 1 else None)


def modelos_de(x):
    """Carros em que a peca serve: o "ms" (2+ carros) ou so o "m"."""
    return x.get("ms") or ([x["m"]] if x.get("m") else [])


def anos_no_modelo(x, mod):
    """Faixa de anos da peca no carro "mod" (a do "ys" quando a peca serve em 2+ carros)."""
    if x.get("ys") and mod in x.get("ms", []):
        return x["ys"][x["ms"].index(mod)]
    return x["y"]


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
    # grafia dos carros do estoque (2+ pecas) para a descricao e a ficha ("GOLF" -> "Golf")
    _aprender_nomes([display[k] for k, v in grafias.items() if sum(v.values()) >= 2], modelos=True)
    # carros que valem como modelo: os de 2+ pecas (leitura de uma peca so e quase sempre errada)
    validos = {k: display[k] for k, v in grafias.items() if sum(v.values()) >= 2}

    # 3) Uma entrada por peca.
    _DIM_PADRAO.clear()
    _DIM_PADRAO.update(dimensoes_padrao(p.get("desc") for p in prods))
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
        # Peca que serve em mais de um carro ("Volvo S60 Xc60"): todos os carros da marca, o principal primeiro
        ms_titulo = modelos_do_titulo(mc, ws, mod, validos) if mod else []
        a0, a1 = anos_do_titulo(p["title"], mc, mod, p.get("part_number"))
        ms, ys = anos_por_modelo(ms_titulo, mc, a0, a1)
        cat = cats.get(p.get("category_id"))
        n = nome_limpo(p["title"], mc, mod, ms_titulo)
        fam0 = gi.familia(cat)
        fam, tipo = classificar(n, fam0, tipo_loja(subtipo(cat, p.get("category_id") or ""), fam0))
        fotos = list(dict.fromkeys(p.get("pics") or ([p["img"]] if p.get("img") else [])))[:12]
        pecas.append({
            "id": p["id"],
            "slug": slugify(p["title"]) + "-" + p["id"],
            "t": p["title"],
            "n": n,
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
            "ficha": ficha(p, mc, mod, [a0, a1] if a0 else None),
            "desc": descricao(p.get("desc"), n),
        })
        if len(ms) > 1:   # so quando serve em 2+ carros (o 1o e sempre o "m")
            pecas[-1]["ms"] = ms
            if ys:        # anos de cada carro, so quando algum difere do "y" (o periodo de venda corta)
                pecas[-1]["ys"] = ys
        q = estoque(p)
        if q:   # sem o dado do ML, a pagina nao diz nada sobre estoque
            pecas[-1]["q"] = q

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
    #    A peca que serve em 2+ carros ("ms") conta em cada um deles (pagina do carro, Meu carro e filtro).
    por_marca = defaultdict(list)
    por_carro = defaultdict(list)
    for x in pecas:
        if x["b"]:
            por_marca[x["b"]].append(x)
            for mod in modelos_de(x):
                por_carro[(x["b"], mod)].append(x)

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
        anos_l = [y for x in lst if anos_no_modelo(x, mod) for y in anos_no_modelo(x, mod)]
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
        mods = Counter(mod for x in lst for mod in modelos_de(x))
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
        # peca que serve em 2+ carros: {indice: [carros]} (so essas; o 1o e o "m") e, quando a faixa
        # muda de um carro para outro, {indice: [[ano0, ano1] de cada carro]}
        "ms": {str(i): x["ms"] for i, x in enumerate(pecas) if x.get("ms")},
        "ys": {str(i): x["ys"] for i, x in enumerate(pecas) if x.get("ys")},
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
    print(f"pecas: {len(pecas)} | sem marca: {sem_marca} | sem modelo: {sem_modelo} | "
          f"em 2+ carros: {sum(1 for x in pecas if x.get('ms'))}")
    print(f"marcas: {len(marcas)} | familias: {len(familias)} | paginas de carro: {len(carros)}")
    print(f"busca.json: {kb:.0f} KB (sem gzip) | {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
