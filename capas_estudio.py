"""
IZZAT CAR — capa de estúdio de cada peça (fundo limpo, padrão único).

A capa do anúncio do ML vem com chão, oficina, bancada... ("cenário nunca pode
ser bagunçado"). Aqui o fundo é removido (rembg, modelo isnet) e a peça vai
para uma base de estúdio clara com sombra de contato — todas no mesmo padrão.

Saída: site/public/estudio/<MLB>.webp (800x800, ~40 KB) + marca "estudio" em
pecas.json/busca.json para o site usar. Fonte: a 1ª foto LIMPA do anúncio
(fotos_limpas.py); se nenhuma for limpa, a 2ª foto (a 1ª costuma ser a montagem
com o carro). Pedaços soltos bem menores que a peça (carro colado) são removidos.
Só processa capa que ainda não tem estúdio (cache). Limite por rodada:
ESTUDIO_POR_RODADA (padrão 400). Falhas ficam anotadas em estudio_falhas.json
para não serem tentadas de novo a cada 30 min.

Rodar depois de preparar_dados.py (usa site/src/data/pecas.json):
    python capas_estudio.py

VERSÃO 2 (ESTUDIO_VERSAO=2; o padrão continua 1 até o dono aprovar): 1000 px, enquadramento por regra
(peso visual igual, piso comum, centro de massa, hastes na diagonal), logo da Izzat Car (ESTUDIO_LOGO=a|b|c|0),
foto montagem separada sozinha e lista de capas suspeitas em <saída>/_revisar.json
(folha: ferramentas/folha_revisar.py). Cópia sem logo para o Google Shopping: ESTUDIO_SAIDA_LIMPA=<pasta>.
Regenerar tudo no Mac (numa pasta nova, fora do site; depois ela substitui site/public/estudio e o ramo
capas-estudio é semeado com ferramentas/semear_capas.sh — só com o dono mandando):
    ESTUDIO_VERSAO=2 ESTUDIO_LOGO=a ESTUDIO_MOTOR=vision ESTUDIO_PARALELO=8 ESTUDIO_REFAZER=1 \\
    ESTUDIO_POR_RODADA=99999 ESTUDIO_SAIDA="$HOME/izzatcar-capas-v2/estudio" \\
    ESTUDIO_SAIDA_LIMPA="$HOME/izzatcar-capas-v2/estudio-limpa" python capas_estudio.py
"""

import io
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PECAS = ROOT / "site" / "src" / "data" / "pecas.json"
SAIDA = Path(os.getenv("ESTUDIO_SAIDA", str(ROOT / "site" / "public" / "estudio")))
FALHAS = SAIDA / "_falhas.json"   # vai junto no ramo capas-estudio
REVISAR = SAIDA / "_revisar.json"  # v2: capas suspeitas (montagem, cortada, vários pedaços) para o olho humano
LADO = 800

# paleta do estúdio (bíblia visual v2)
TOPO = (247, 246, 243)
BASE = (229, 227, 223)


def fundo(lado=None):
    """Estúdio infinito: degradê claro, luz suave de softbox atrás da peça e vinheta bem leve."""
    import numpy as np
    from PIL import Image
    LADO = lado or globals()["LADO"]   # v1: 800; v2: ESTUDIO_LADO
    topo, base = np.array(TOPO, float), np.array(BASE, float)
    y = np.linspace(0, 1, LADO)[:, None]
    t = np.clip((y - 0.50) / 0.50, 0, 1) ** 1.2
    cor = topo[None, None, :] * (1 - t[..., None]) + base[None, None, :] * t[..., None]
    cor = np.repeat(cor, LADO, axis=1)
    yy, xx = np.mgrid[0:LADO, 0:LADO] / LADO
    luz = np.exp(-(((xx - 0.42) / 0.42) ** 2 + ((yy - 0.38) / 0.34) ** 2)) * 6
    vin = (((xx - 0.5) ** 2 + (yy - 0.5) ** 2) ** 0.5) * 10
    cor = cor + luz[..., None] - vin[..., None]
    return Image.fromarray(np.clip(cor, 0, 255).astype("uint8"), "RGB")


_FUNDO = None


class _nulo:
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

# ---- "isto é um carro inteiro?" (MobileNetV2/ImageNet, 14 MB, roda na CPU) ----
CLASSES_CARRO = {407, 436, 468, 511, 609, 627, 656, 661, 675, 717, 734, 751, 817, 864, 867, 803, 829}
MODELO_CLASSIF = Path(os.getenv("CLASSIF_MODELO", str(Path.home() / ".rembg/models/classificador/mobilenetv2-12.onnx")))
URL_CLASSIF = "https://github.com/onnx/models/raw/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx"
_CLASSIF = None


def prob_carro(img_rgba):
    """Probabilidade (0-1) de o recorte ser um CARRO INTEIRO (e não uma peça)."""
    global _CLASSIF
    import numpy as np
    from PIL import Image
    if _CLASSIF is None:
        import onnxruntime as ort
        if not MODELO_CLASSIF.exists():
            MODELO_CLASSIF.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(URL_CLASSIF, MODELO_CLASSIF)
        _CLASSIF = ort.InferenceSession(str(MODELO_CLASSIF), providers=["CPUExecutionProvider"])
    fundo_b = Image.new("RGB", img_rgba.size, (255, 255, 255))
    fundo_b.paste(img_rgba, mask=img_rgba.split()[3])
    w, h = fundo_b.size
    lado = max(w, h)
    q = Image.new("RGB", (lado, lado), (255, 255, 255))
    q.paste(fundo_b, ((lado - w) // 2, (lado - h) // 2))
    x = np.asarray(q.resize((224, 224), Image.BILINEAR), dtype="float32") / 255.0
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype("float32")
    out = _CLASSIF.run(None, {_CLASSIF.get_inputs()[0].name: x})[0][0]
    p = np.exp(out - out.max())
    p /= p.sum()
    return float(sum(p[i] for i in CLASSES_CARRO))


def limpar_mascara(recorte, checar_cantos=True, cantos_baixo=False):
    """Separa os pedaços recortados; tira os que são CARRO INTEIRO e a sujeira.
    Devolve (recorte_limpo, tirou_carro) ou (None, x) se só sobrou carro.
    cantos_baixo (v2): olha também os cantos de BAIXO (foto com o carrinho do anúncio colado na peça)."""
    import numpy as np
    from PIL import Image
    from scipy import ndimage
    a = np.array(recorte.split()[3])
    rot, n = ndimage.label(a > 24, structure=np.ones((3, 3)))
    if n == 0:
        return None, False
    areas = np.bincount(rot.ravel())
    areas[0] = 0
    total = a.size
    caixas = ndimage.find_objects(rot)
    manter = np.zeros(n + 1, dtype=bool)
    tirou = False
    for i in range(1, n + 1):
        if areas[i] < total * 0.004:
            continue
        sl = caixas[i - 1]
        pedaco = recorte.crop((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
        m = (rot[sl] == i).astype("uint8") * 255
        pedaco.putalpha(Image.fromarray(m))
        if areas[i] > total * 0.01 and prob_carro(pedaco) > 0.30:
            tirou = True
            continue
        manter[i] = True
    if not manter.any():
        return None, tirou
    maior = areas[manter].max()
    manter &= areas >= maior * 0.15
    a = np.where(manter[rot], a, 0).astype("uint8")
    r = recorte.copy()
    r.putalpha(Image.fromarray(a))
    # etiqueta/cartão de papel com texto (foto de "informação", não da peça)
    caixa0 = Image.fromarray(a).getbbox()
    if caixa0:
        reg = np.asarray(r.convert("L").crop(caixa0), dtype="float32")
        al = np.asarray(Image.fromarray(a).crop(caixa0), dtype="float32") / 255
        preench = al.mean()
        claro = (reg * al).sum() / max(al.sum(), 1)
        if preench > 0.85 and claro > 215:
            return None, False
    # carro GRUDADO na peça (vira um pedaço só): olha os cantos de cima
    caixa = Image.fromarray(a).getbbox() if checar_cantos else None
    if caixa:
        x0, y0, x1, y1 = caixa
        w, h = x1 - x0, y1 - y0
        for fw, fh, lim in ((.55, .5, .6), (.42, .4, .5), (.32, .32, .5)):
            for esquerda in (True, False):
                cx0 = x0 if esquerda else x1 - int(w * fw)
                for cy0 in ((y0, y1 - int(h * fh)) if cantos_baixo else (y0,)):
                    canto = r.crop((cx0, cy0, cx0 + int(w * fw), cy0 + int(h * fh)))
                    if canto.split()[3].getbbox() and prob_carro(canto) > lim:
                        return None, True
    return r, tirou


def balanco(original, alfa):
    """Balanço de branco pelo FUNDO da foto, só quando ele é claro e quase neutro (fundo de foto de
    produto). Fundo de oficina/chão colorido: não mexe (ganho 1). Só corrige o tom da luz."""
    import numpy as np
    if original is None:
        return np.ones(3)
    a = np.asarray(original.convert("RGB"), float)
    if alfa.size != original.size:
        alfa = alfa.resize(original.size)
    m = np.asarray(alfa, float) < 10
    if m.sum() < 1000:
        return np.ones(3)
    f = np.percentile(a[m], 70, axis=0)
    if f.mean() < 170 or f.max() - f.min() > 28:
        return np.ones(3)
    return np.clip(f.mean() / np.maximum(f, 1), 0.90, 1.12)


def realcar(peca, ganho):
    """Correções GLOBAIS e iguais na peça inteira: tom da luz, branco, contraste local e nitidez.
    Nada é apagado, desenhado ou trocado; preto continua preto (nunca clareia sombra)."""
    import numpy as np
    from PIL import Image, ImageEnhance, ImageFilter
    alfa = peca.split()[3]
    rgb = np.asarray(peca.convert("RGB"), float) * ganho[None, None, :]
    m = np.asarray(alfa) > 128
    if m.sum() > 50:
        hi = np.percentile(rgb.mean(axis=2)[m], 99.2)
        if 120 < hi < 238:                       # peça clara apagada: só puxa o branco
            rgb = rgb * min(1.12, 240 / hi)
    im = Image.fromarray(np.clip(rgb, 0, 255).astype("uint8"), "RGB")
    raio = max(6, round(max(im.size) * 0.03))
    im = im.filter(ImageFilter.UnsharpMask(radius=raio, percent=24, threshold=2))   # "clareza"
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=70, threshold=2))    # nitidez fina
    im = ImageEnhance.Color(im).enhance(1.05)
    im.putalpha(alfa)
    return im


def compor(recorte, checar_cantos=True, original=None):
    """Peça recortada (RGBA) -> capa LADOxLADO em estúdio (jeito A).
    Devolve (capa, cortada) — cortada = a peça encosta na borda da foto (falta pedaço)."""
    from PIL import Image, ImageDraw, ImageFilter
    global _FUNDO
    recorte, _ = limpar_mascara(recorte, checar_cantos)
    if recorte is None:
        return None, False
    if _FUNDO is None:
        _FUNDO = fundo()
    alfa = recorte.split()[3]
    caixa = alfa.point(lambda v: 255 if v > 24 else 0).getbbox()
    if not caixa:
        return None, False
    W0, H0 = recorte.size
    cortada = caixa[0] <= 2 or caixa[1] <= 2 or caixa[2] >= W0 - 2 or caixa[3] >= H0 - 2
    peca = recorte.crop(caixa)
    w, h = peca.size
    if w * h < 400:
        return None, False
    peca = realcar(peca, balanco(original, alfa))
    escala = min(LADO * 0.84 / w, LADO * 0.72 / h)
    peca = peca.resize((max(1, round(w * escala)), max(1, round(h * escala))), Image.LANCZOS)
    w, h = peca.size
    x = (LADO - w) // 2
    y = round(LADO * 0.47 - h / 2)
    y = max(int(LADO * 0.05), min(y, int(LADO * 0.86) - h))
    tela = _FUNDO.copy().convert("RGBA")
    escuro = Image.new("RGBA", (LADO, LADO), (38, 34, 30, 255))
    a = peca.split()[3]
    # 1) sombra de contato: a própria silhueta achatada no piso, colada na base
    contato = Image.new("L", (LADO, LADO), 0)
    contato.paste(a.resize((w, max(2, round(h * 0.10)))).point(lambda v: v * 0.62), (x, y + h - round(h * 0.05)))
    contato = contato.filter(ImageFilter.GaussianBlur(max(5, h * 0.018)))
    # 2) sombra ambiente larga e suave
    amb = Image.new("L", (LADO, LADO), 0)
    ImageDraw.Draw(amb).ellipse((x + w * 0.06, y + h * 0.90, x + w * 0.94, y + h * 1.05), fill=70)
    amb = amb.filter(ImageFilter.GaussianBlur(max(18, w * 0.05)))
    tela = Image.composite(escuro, tela, amb)
    tela = Image.composite(escuro, tela, contato)
    tela.alpha_composite(peca, (x, y))
    return tela.convert("RGB"), cortada


# =====================================================================================================
# VERSÃO 2 (ESTUDIO_VERSAO=2): enquadramento por regra objetiva + logo da Izzat Car na capa.
# A v1 (compor acima) continua o padrão até o dono aprovar; nada da v1 muda.
#
# Regra de enquadramento (frações do lado do quadro):
#   1. TAMANHO pelo "peso visual": a raiz da área do casco convexo da silhueta vale T (0,62) do lado —
#      peça compacta e peça vazada/comprida ficam com o mesmo peso; nunca passa da zona segura
#      (x 0,07–0,93; y 0,16–0,79) nem amplia a foto mais de 2x (foto mole é pior que peça menor).
#   2. PISO comum: a base da peça pousa na linha 0,79 — a sombra fica sempre no mesmo lugar.
#   3. CENTRO pelo centro de massa visual (metade centroide da silhueta, metade centro da caixa).
#   4. HASTE (alongamento PCA >= 8: amortecedor de tampa, friso, vareta): vai para a diagonal de 33°.
#   Faixas livres de peça: alto (0–0,16, selo/relevo) e base (0,84–1, assinatura).
# Logo (só o arquivo original site/public/identidade/logo.png): ESTUDIO_LOGO=a|b|c|0
#   a = selo pequeno no canto superior direito (recomendado) · b = baixo-relevo tom sobre tom no alto
#   c = assinatura pequena centrada na base · 0 = sem logo.
# ESTUDIO_LADO (1000), ESTUDIO_QUALIDADE (82), ESTUDIO_SAIDA_LIMPA = pasta para a cópia SEM logo
# (o Google Shopping não aceita logo sobreposto na imagem principal).
# =====================================================================================================
VERSAO = (os.getenv("ESTUDIO_VERSAO", "1").strip() or "1")
LADO_V2 = int(os.getenv("ESTUDIO_LADO", "1000"))
QUALIDADE_V2 = int(os.getenv("ESTUDIO_QUALIDADE", "82"))
LOGO_OPCAO = (os.getenv("ESTUDIO_LOGO", "a").strip().lower() or "a")
SAIDA_LIMPA = os.getenv("ESTUDIO_SAIDA_LIMPA", "")
LOGO_ARQ = ROOT / "site" / "public" / "identidade" / "logo.png"
REGRA = dict(
    T=0.62,                  # peso visual: raiz(área do casco) = T x lado
    XMIN=0.07, XMAX=0.93,    # zona segura na horizontal
    TOPO=0.16,               # nada da peça acima disto (faixa do selo / relevo)
    PISO=0.79,               # linha do piso: a base da peça pousa aqui
    UP=2.0,                  # ampliação máxima da foto
    MIX=0.5,                 # centro visual = MIX x centroide + (1 - MIX) x centro da caixa
    HASTE=8.0,               # alongamento a partir do qual a peça vai para a diagonal
    ANG=33.0,                # ângulo da diagonal (graus, subindo para a direita)
)
_FUNDOS = {}


def _fundo_v2(lado):
    if lado not in _FUNDOS:
        _FUNDOS[lado] = fundo(lado)
    return _FUNDOS[lado]


def alongamento(alfa):
    """PCA da silhueta (alfa 0..1): (extensão no eixo maior / no menor, ângulo do eixo maior em graus,
    anti-horário, entre -90 e 90)."""
    import numpy as np
    ys, xs = np.nonzero(alfa > 0.5)
    if len(xs) < 20:
        return 1.0, 0.0
    p = np.column_stack([xs, ys]).astype(float)
    if len(p) > 60000:
        p = p[:: len(p) // 60000 + 1]
    p -= p.mean(0)
    _, vec = np.linalg.eigh(np.cov(p.T))
    pr = p @ vec
    ext = pr.max(0) - pr.min(0)
    maj = vec[:, 1]
    ang = (float(np.degrees(np.arctan2(-maj[1], maj[0]))) + 90) % 180 - 90
    return float(ext[1] / max(ext[0], 1.0)), ang


def medir(alfa):
    """Área do casco convexo e centroide da silhueta (alfa 0..1, já recortada na caixa)."""
    import numpy as np
    from scipy.spatial import ConvexHull
    m = alfa > 0.5
    ys, xs = np.nonzero(m)
    if len(xs) < 10:
        return None
    pts = np.column_stack([xs, ys]).astype(float)
    if len(pts) > 40000:
        pts = pts[:: len(pts) // 40000 + 1]
    try:
        casco = float(ConvexHull(pts).volume)
    except Exception:  # noqa: BLE001  (pontos colineares)
        casco = float(m.sum())
    peso = float(alfa.sum())
    yy, xx = np.mgrid[0:alfa.shape[0], 0:alfa.shape[1]]
    return dict(casco=max(casco, float(m.sum())), cx=float((alfa * xx).sum() / peso),
                cy=float((alfa * yy).sum() / peso))


def enquadrar(w, h, med, lado=None, r=REGRA):
    """Regra de enquadramento pura (sem imagem): escala e posição (x, y) da peça no quadro.
    w, h = caixa da peça na foto; med = medir(); devolve (escala, x, y, nova_largura, nova_altura)."""
    L = lado or LADO_V2
    s = min(r["T"] * L / med["casco"] ** 0.5,
            (r["XMAX"] - r["XMIN"]) * L / w,
            (r["PISO"] - r["TOPO"]) * L / h,
            r["UP"])
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    vx = r["MIX"] * med["cx"] * s + (1 - r["MIX"]) * nw / 2      # centro visual (em px da peça)
    x = round(L / 2 - vx)
    x = max(round(r["XMIN"] * L), min(x, round(r["XMAX"] * L) - nw))
    y = round(r["PISO"] * L) - nh
    return s, x, y, nw, nh


def _girar(peca, graus):
    """Gira a peça (RGBA) sem franja escura na borda (alfa pré-multiplicado)."""
    from PIL import Image
    g = peca.convert("RGBa").rotate(graus, resample=Image.BICUBIC, expand=True).convert("RGBA")
    caixa = g.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
    return g.crop(caixa) if caixa else g


def compor_v2(recorte, checar_cantos=True, original=None, info=None):
    """Peça recortada (RGBA) -> capa LADO_V2 x LADO_V2, enquadrada pela REGRA (SEM logo; ver com_logo).
    Devolve (capa, cortada) como compor()."""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFilter
    recorte, tirou = limpar_mascara(recorte, checar_cantos, cantos_baixo=checar_cantos)
    if recorte is None:
        if info is not None:
            info["so_carro"] = tirou            # carro inteiro ou colado na peça (ex.: o carrinho do anúncio)
        return None, False
    alfa = recorte.split()[3]
    caixa = alfa.point(lambda v: 255 if v > 24 else 0).getbbox()
    if not caixa:
        return None, False
    W0, H0 = recorte.size
    cortada = caixa[0] <= 2 or caixa[1] <= 2 or caixa[2] >= W0 - 2 or caixa[3] >= H0 - 2
    peca = recorte.crop(caixa)
    w, h = peca.size
    if w * h < 400:
        return None, False
    peca = realcar(peca, balanco(original, alfa))
    a0 = np.asarray(peca.split()[3], float) / 255
    E, ang = alongamento(a0)
    if E >= REGRA["HASTE"]:                      # haste fina: na diagonal do quadro
        peca = _girar(peca, REGRA["ANG"] - ang)
        w, h = peca.size
        a0 = np.asarray(peca.split()[3], float) / 255
    med = medir(a0)
    if med is None:
        return None, False
    L = LADO_V2
    s, x, y, nw, nh = enquadrar(w, h, med, L)
    peca = peca.resize((nw, nh), Image.LANCZOS)
    if s > 1.15:                                  # ampliou: devolve a nitidez fina
        rgb = peca.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        rgb.putalpha(peca.split()[3])
        peca = rgb
    if info is not None:
        info.update(escala=round(s, 3), x=x, y=y, w=nw, h=nh, alongamento=round(E, 1), haste=E >= REGRA["HASTE"],
                    pedacos=pedacos_grandes(recorte.split()[3]))
    tela = _fundo_v2(L).copy().convert("RGBA")
    escuro = Image.new("RGBA", (L, L), (38, 34, 30, 255))
    a = peca.split()[3]
    piso = y + nh
    # 1) sombra de contato: a silhueta achatada no piso (espessura limitada: igual em peça alta e baixa)
    ch = int(np.clip(nh * 0.10, 0.012 * L, 0.045 * L))
    contato = Image.new("L", (L, L), 0)
    contato.paste(a.resize((nw, ch)).point(lambda v: v * 0.62), (x, piso - round(ch * 0.55)))
    contato = contato.filter(ImageFilter.GaussianBlur(max(4, 0.010 * L)))
    # 2) sombra ambiente: elipse larga no piso, espessura pela LARGURA da peça (não pela altura)
    eh = float(np.clip(nw * 0.045, 0.012 * L, 0.030 * L))
    amb = Image.new("L", (L, L), 0)
    ImageDraw.Draw(amb).ellipse((x + nw * 0.06, piso - eh * 0.9, x + nw * 0.94, piso + eh * 1.1), fill=70)
    amb = amb.filter(ImageFilter.GaussianBlur(max(14, nw * 0.045)))
    tela = Image.composite(escuro, tela, amb)
    tela = Image.composite(escuro, tela, contato)
    tela.alpha_composite(peca, (x, y))
    return tela.convert("RGB"), cortada


# ---- foto MONTAGEM (duas fotos coladas numa só, ex.: o painel do carro em cima e a peça solta embaixo) ----
# O recorte pega as duas juntas e a capa fica "quebrada". Sinal: uma FAIXA de fundo claro atravessando a
# foto (linhas ou colunas quase todas claras) com recorte dos dois lados, e um dos lados encostado em 2+
# bordas da foto (é a foto colada, não a peça). Aí corta a foto do lado da peça e recorta de novo.
def _claro(arr):
    """Pixel de fundo claro (branco/cinza muito claro, sem cor)."""
    return (arr.mean(2) > 226) & ((arr.max(2) - arr.min(2)) < 24)


def faixas_claras(original, eixo=0, frac=0.85):
    """Faixas da FOTO (eixo 0 = linhas, 1 = colunas) em que >= frac dos pixels são fundo claro, longe das bordas.
    Devolve [(início, fim)] em px."""
    import numpy as np
    claro = _claro(np.asarray(original.convert("RGB"), dtype=np.int16))
    fr = claro.mean(axis=1 if eixo == 0 else 0)
    N = len(fr)
    minimo = max(6, round(0.008 * N))
    out, i = [], 0
    while i < N:
        if fr[i] >= frac:
            j = i
            while j < N and fr[j] >= frac:
                j += 1
            if j - i >= minimo and i > 0.10 * N and j < 0.90 * N:
                out.append((i, j))
            i = j
        else:
            i += 1
    return out


def _bordas_tocadas(m, lados, minimo=0.15):
    """Quantos lados da foto o pedaço de máscara m (no tamanho da foto) encosta em >= minimo do comprimento."""
    import numpy as np
    linhas = {"topo": m[:3].any(0), "base": m[-3:].any(0), "esq": m[:, :3].any(1), "dir": m[:, -3:].any(1)}
    return sum(1 for ld in lados if np.mean(linhas[ld]) >= minimo)


def sinal_montagem(original, recorte):
    """Foto montagem? Devolve dict(eixo, b0, b1, manter) ou None. manter = 'depois' (fica o bloco de baixo /
    da direita), 'antes' (de cima / da esquerda) ou None (não dá para saber qual é a peça: tenta outra foto)."""
    import numpy as np
    a = recorte.split()[3]
    if a.size != original.size:
        a = a.resize(original.size)
    m = np.asarray(a) > 128
    tot = m.sum()
    if tot < 400:
        return None
    for eixo in (0, 1):
        for b0, b1 in faixas_claras(original, eixo):
            A = np.zeros_like(m)
            B = np.zeros_like(m)
            if eixo == 0:
                A[:b0], B[b1:] = m[:b0], m[b1:]
                la, lb = ("topo", "esq", "dir"), ("base", "esq", "dir")
            else:
                A[:, :b0], B[:, b1:] = m[:, :b0], m[:, b1:]
                la, lb = ("esq", "topo", "base"), ("dir", "topo", "base")
            if A.sum() < 0.08 * tot or B.sum() < 0.08 * tot:
                continue                                   # não há recorte dos dois lados da faixa
            ta, tb = _bordas_tocadas(A, la), _bordas_tocadas(B, lb)
            if ta < 2 and tb < 2:
                continue                                   # nenhum lado parece foto colada: não é montagem
            manter = "depois" if ta >= 2 > tb else "antes" if tb >= 2 > ta else None
            return dict(eixo=eixo, b0=int(b0), b1=int(b1), manter=manter)
    return None


def isolar_montagem(original, sinal, recortar):
    """Corta a foto do lado da peça e recorta de novo. Começa na faixa clara e recua aos poucos (até 12%)
    até a peça ficar inteira (sem encostar na linha do corte). Devolve (foto_cortada, recorte) ou None."""
    import numpy as np
    W, H = original.size
    eixo, b0, b1, manter = sinal["eixo"], sinal["b0"], sinal["b1"], sinal["manter"]
    if manter is None:
        return None
    N = H if eixo == 0 else W
    for k in range(7):
        d = round(k * 0.02 * N)
        if manter == "depois":
            c = max(0, b0 - d)
            caixa = (0, c, W, H) if eixo == 0 else (c, 0, W, H)
        else:
            c = min(N, b1 + d)
            caixa = (0, 0, W, c) if eixo == 0 else (0, 0, c, H)
        foto = original.crop(caixa)
        rec = recortar(foto)
        lim, _ = limpar_mascara(rec, checar_cantos=False)
        if lim is None:
            continue
        al = np.asarray(lim.split()[3]) > 128
        borda = (al[:3] if eixo == 0 else al[:, :3]) if manter == "depois" else (al[-3:] if eixo == 0 else al[:, -3:])
        if not borda.any():
            return foto, rec
    return None


def pedacos_grandes(alfa, minimo=0.25):
    """Quantos pedaços separados com >= minimo da área do maior (alfa = máscara já limpa)."""
    import numpy as np
    from scipy import ndimage
    rot, n = ndimage.label(np.asarray(alfa) > 24, structure=np.ones((3, 3)))
    if n <= 1:
        return n
    areas = np.bincount(rot.ravel())[1:]
    return int((areas >= areas.max() * minimo).sum())


# ---- logo na capa (só o arquivo original; nunca redesenhado) ----
_LOGOS = {}


def _logo(larg_px):
    """logo.png original, sem a margem transparente, na largura pedida (cache por tamanho)."""
    from PIL import Image
    larg_px = max(8, int(round(larg_px)))
    if larg_px not in _LOGOS:
        lg = Image.open(LOGO_ARQ).convert("RGBA")
        lg = lg.crop(lg.getbbox())
        k = larg_px / lg.size[0]
        _LOGOS[larg_px] = lg.resize((larg_px, max(1, round(lg.size[1] * k))), Image.LANCZOS)
    return _LOGOS[larg_px]


def _colar(img, lg, x, y, opacidade):
    lg = lg.copy()
    lg.putalpha(lg.split()[3].point(lambda v: round(v * opacidade)))
    out = img.convert("RGBA")
    out.alpha_composite(lg, (int(x), int(y)))
    return out.convert("RGB")


def logo_selo(img, larg=0.12, opacidade=0.90, margem_x=0.07, topo=0.05):
    """(a) selo pequeno no canto superior direito, cores originais, alinhado à margem direita da peça."""
    L = img.size[0]
    lg = _logo(larg * L)
    return _colar(img, lg, L - round(margem_x * L) - lg.size[0], round(topo * L), opacidade)


def logo_relevo(img, larg=0.17, cy=0.085, forca=6.0, tinta=0.12):
    """(b) baixo-relevo tom sobre tom no alto da parede (centrado), luz de cima: a FORMA é o alfa do
    arquivo original; só um toque (tinta) da cor original."""
    import numpy as np
    from PIL import Image, ImageFilter
    L = img.size[0]
    lg = _logo(larg * L)
    lw, lh = lg.size
    pad = 6
    x0, y0 = (L - lw) // 2, round(cy * L - lh / 2)
    cx0, cy0 = max(0, x0 - pad), max(0, y0 - pad)
    cx1, cy1 = min(L, x0 + lw + pad), min(L, y0 + lh + pad)
    H = np.zeros((cy1 - cy0, cx1 - cx0))
    H[y0 - cy0:y0 - cy0 + lh, x0 - cx0:x0 - cx0 + lw] = np.asarray(lg.split()[3], float) / 255
    Hs = np.asarray(Image.fromarray((H * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(max(0.8, L / 900))),
                    float) / 255
    gx = np.zeros_like(Hs)
    gy = np.zeros_like(Hs)
    gx[:, 1:-1] = (Hs[:, 2:] - Hs[:, :-2]) / 2
    gy[1:-1, :] = (Hs[2:, :] - Hs[:-2, :]) / 2
    rel = -(gx * 0.6 + gy) * forca * 9 - Hs * forca * 0.30      # gravado: borda de cima escura, de baixo clara
    base = np.asarray(img.convert("RGB"), float)
    reg = base[cy0:cy1, cx0:cx1] + rel[..., None]
    if tinta:
        cor = np.zeros_like(reg)
        cor[y0 - cy0:y0 - cy0 + lh, x0 - cx0:x0 - cx0 + lw] = np.asarray(lg.convert("RGB"), float)
        m = tinta * Hs[..., None]
        reg = reg * (1 - m) + cor * m
    base[cy0:cy1, cx0:cx1] = reg
    return Image.fromarray(np.clip(base, 0, 255).astype("uint8"))


def logo_assinatura(img, larg=0.11, opacidade=0.90, cy=0.915):
    """(c) assinatura: logo pequeno centrado na base, abaixo da sombra (faixa livre de peça)."""
    L = img.size[0]
    lg = _logo(larg * L)
    return _colar(img, lg, (L - lg.size[0]) // 2, round(cy * L - lg.size[1] / 2), opacidade)


def com_logo(img, opcao=None):
    """Aplica o logo na opção pedida (a/b/c); '0' ou vazio = sem logo."""
    opcao = (opcao or LOGO_OPCAO).lower()
    if opcao == "a":
        return logo_selo(img)
    if opcao == "b":
        return logo_relevo(img)
    if opcao == "c":
        return logo_assinatura(img)
    return img


# ---- filtro de etiqueta: foto de PAPEL/ETIQUETA com texto (informação, não a peça) ----
# Regra: caixas de texto (OCR) cujo centro cai na peça somam > LIMITE_TEXTO da área da peça E a peça
# é de papel claro. A trava do "papel claro" poupa peça com etiqueta técnica (ECU, sensor, motor):
# texto sobre metal/plástico escuro não conta. Sem rapidocr: segue sem o filtro (nunca quebra).
LIMITE_TEXTO = float(os.getenv("ESTUDIO_LIMITE_TEXTO", "0.15"))
_OCR = None
_OCR_FALHOU = False


def _ocr():
    global _OCR, _OCR_FALHOU
    if _OCR is None and not _OCR_FALHOU:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _OCR = RapidOCR()
        except Exception as e:
            _OCR_FALHOU = True
            print(f"  filtro de etiqueta desligado (rapidocr: {str(e)[:80]})", flush=True)
    return _OCR


def decidir_etiqueta(razao, frac_clara):
    """Puro (sem imagem): True = etiqueta. razao = area do texto / area da peça; frac_clara = fracao da
    peça que e papel claro e sem cor (branco/cinza claro)."""
    return razao is not None and razao > LIMITE_TEXTO and frac_clara > 0.40


def etiqueta_de_texto(original, recorte):
    """True se a foto da peça e etiqueta/papel com texto. Mede o tempo (ver ESTUDIO_DEBUG=1)."""
    ocr = _ocr()
    if ocr is None:
        return False
    import numpy as np
    from PIL import Image
    t0 = time.time()
    alfa = recorte.split()[3]
    if alfa.size != original.size:
        alfa = alfa.resize(original.size)
    m = np.asarray(alfa) > 128
    area = int(m.sum())
    if area < 400:
        return False
    rgb = np.asarray(original.convert("RGB"))
    px = rgb[m].astype(float)
    sat = px.max(axis=1) - px.min(axis=1)
    frac_clara = float(np.mean((px.mean(axis=1) > 190) & (sat < 35)))
    g = original.convert("RGB")
    k = 640 / max(g.size)
    if k < 1:
        g = g.resize((round(g.size[0] * k), round(g.size[1] * k)), Image.BILINEAR)
    sx, sy = original.size[0] / g.size[0], original.size[1] / g.size[1]
    res, _ = ocr(np.asarray(g))
    t_area = 0.0
    for box, txt, conf in (res or []):
        if float(conf) < 0.6 or len(txt.strip()) < 2:
            continue
        xs = [p[0] * sx for p in box]
        ys = [p[1] * sy for p in box]
        cx, cy = int((min(xs) + max(xs)) / 2), int((min(ys) + max(ys)) / 2)
        if 0 <= cy < m.shape[0] and 0 <= cx < m.shape[1] and m[cy, cx]:
            t_area += (max(xs) - min(xs)) * (max(ys) - min(ys))
    razao = t_area / area
    tem = decidir_etiqueta(razao, frac_clara)
    if os.getenv("ESTUDIO_DEBUG") == "1":
        print(f"    etiqueta? razao={razao:.3f} clara={frac_clara:.2f} -> {tem} ({time.time() - t0:.2f}s)", flush=True)
    return tem


def baixar(chave, tam="F"):
    url = f"https://http2.mlstatic.com/D_{chave}-{tam}.jpg"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (izzatcar-site)"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def recortar_vision(img):
    """Mac: recorte nativo (Vision) pelo ~/.local/bin/recorta-fundo — rápido e grátis."""
    import subprocess
    import tempfile
    from PIL import Image
    with tempfile.TemporaryDirectory() as d:
        ent, sai = os.path.join(d, "e.png"), os.path.join(d, "s.png")
        img.save(ent)
        r = subprocess.run([os.path.expanduser("~/.local/bin/recorta-fundo"), ent, sai], capture_output=True, timeout=60)
        if r.returncode != 0 or not os.path.exists(sai):
            raise RuntimeError("vision falhou")
        return Image.open(sai).convert("RGBA").copy()


def main():
    from PIL import Image
    t0 = time.time()
    SAIDA.mkdir(parents=True, exist_ok=True)
    pecas = json.loads(PECAS.read_text(encoding="utf-8"))
    falhas = json.loads(FALHAS.read_text(encoding="utf-8")) if FALHAS.exists() else {}
    feitas = {p.stem for p in SAIDA.glob("*.webp")}
    refazer = os.getenv("ESTUDIO_REFAZER") == "1"   # gerar de novo numa SAIDA nova (retoma se parar)
    fila = []
    for x in pecas:
        fs = [k for k in (x.get("fotos") or []) if k and not k.startswith("http")]
        if not fs:
            continue
        if VERSAO == "2":   # v2: até 6 fotos (há anúncio com o carrinho colado nas 3 primeiras); para na 1ª limpa
            cands = fs[:6] if x.get("limpa") else (fs[1:6] + fs[:1])
        else:
            cands = fs[:3] if x.get("limpa") else (fs[1:3] + fs[:1])
        if x["id"] not in feitas and (refazer or x["id"] not in falhas):
            fila.append((x["id"], cands))
    so = set(filter(None, os.getenv("ESTUDIO_IDS", "").split(",")))   # ex.: teste em poucas peças
    if so:
        fila = [f for f in fila if f[0] in so]
    fatia = os.getenv("ESTUDIO_FATIA", "")          # ex.: "2/4" = 2a de 4 partes
    if fatia:
        i_f, n_f = (int(v) for v in fatia.split("/"))
        fila = [f for j, f in enumerate(fila) if j % n_f == i_f - 1]
    limite = int(os.getenv("ESTUDIO_POR_RODADA", "400"))
    print(f"capas de estúdio: {len(feitas)} prontas | {len(fila)} faltando | esta rodada: {min(limite, len(fila))}")
    if not fila or limite <= 0:
        marcar()
        return
    if os.getenv("ESTUDIO_MOTOR") == "vision":
        recortar = recortar_vision
        trabalhadores = int(os.getenv("ESTUDIO_PARALELO", "10"))
    else:
        from rembg import new_session, remove
        sessao = new_session(os.getenv("ESTUDIO_MODELO", "isnet-general-use"), providers=["CPUExecutionProvider"])
        recortar = lambda img: remove(img, session=sessao, post_process_mask=True)  # noqa: E731
        trabalhadores = 1
    import threading
    trava = threading.Lock()
    contagem = {"ok": 0, "i": 0}

    tempo_max = float(os.getenv("ESTUDIO_TEMPO_MAX", "0") or 0)   # orcamento da rodada (s); 0 = sem limite
    v2 = VERSAO == "2"
    montar = compor_v2 if v2 else compor
    fonte = 1200 if v2 else 1000            # v2 sai em 1000 px: recorta a foto na resolução cheia do ML
    limpa = Path(SAIDA_LIMPA) if (v2 and SAIDA_LIMPA) else None
    if limpa:
        limpa.mkdir(parents=True, exist_ok=True)
    if v2:
        print(f"  versão 2: {LADO_V2} px, logo '{LOGO_OPCAO}', qualidade {QUALIDADE_V2}"
              + (f", cópia sem logo em {limpa}" if limpa else ""), flush=True)

    revisar = {}    # v2: capas suspeitas para o olho humano (montagem, cortada, vários pedaços, reserva)

    def cortar_fundo(img):
        with trava if trabalhadores > 1 and recortar is not recortar_vision else _nulo():
            return recortar(img)

    def montar(recorte, original, checar_cantos=True, inf=None):
        if v2:
            return compor_v2(recorte, checar_cantos=checar_cantos, original=original, info=inf)
        return compor(recorte, checar_cantos=checar_cantos, original=original)

    def uma(item):
        if tempo_max and time.time() - t0 > tempo_max:
            return   # sem falha: fica pra proxima rodada
        mlb, cands = item
        capa, motivo, reserva, cortada = None, "recorte vazio", None, None
        montagem = None                       # v2: montagem que não deu para separar (último recurso)
        notas, inf_de = [], {}                # v2: o que aconteceu com cada foto / info da capa escolhida
        for k in cands:
            try:
                original = Image.open(io.BytesIO(baixar(k))).convert("RGB")
                original.thumbnail((fonte, fonte))
                recorte = cortar_fundo(original)
                if etiqueta_de_texto(original, recorte):
                    motivo = "etiqueta de texto"
                    continue   # proxima foto candidata
                sinal = sinal_montagem(original, recorte) if v2 else None
                if sinal:                                   # foto montagem: fica só o bloco da peça
                    iso = isolar_montagem(original, sinal, cortar_fundo)
                    if iso is None:
                        img, _ = montar(recorte, original)
                        if img is not None and montagem is None:
                            montagem = (img, k)
                        notas.append(f"montagem sem separar ({k})")
                        motivo = "montagem"
                        continue                            # tenta a próxima foto
                    original, recorte = iso
                    notas.append(f"montagem separada ({k})")
                inf = {}
                img, corte = montar(recorte, original, inf=inf)
                if img is None and inf.get("so_carro"):
                    notas.append(f"carro colado na foto ({k})")
                if img is not None and not corte:
                    capa = img
                    inf_de = dict(inf, foto=k)
                    break
                if img is not None:   # peça encostada na borda da foto: só se nenhuma outra servir
                    if cortada is None:
                        cortada, inf_cortada = img, dict(inf, foto=k)
                    motivo = "cortada"
                    continue
                if reserva is None:   # se nenhuma foto ficar limpa, usa a 1a sem os pedaços de carro soltos
                    inf = {}
                    reserva, _ = montar(recorte, original, checar_cantos=False, inf=inf)
                    inf_reserva = dict(inf, foto=k)
                motivo = "so carro/vazio"
            except Exception as e:  # rede, imagem corrompida...
                motivo = str(e)[:80]
        if v2 and capa is None:
            if cortada is not None:
                capa, inf_de = cortada, inf_cortada
                notas.append("peça cortada na foto")
            elif montagem is not None:
                capa, inf_de = montagem[0], {"foto": montagem[1]}
                notas.append("capa de foto montagem")
            elif reserva is not None:
                capa, inf_de = reserva, inf_reserva
                notas.append("sem foto limpa (reserva)")
        capa = capa or cortada or reserva
        if v2 and capa is not None:
            if inf_de.get("pedacos", 1) > 1:
                notas.append(f"{inf_de['pedacos']} pedaços grandes")
            if notas:
                with trava:
                    revisar[mlb] = {"motivos": notas, "foto": inf_de.get("foto")}
        with trava:
            contagem["i"] += 1
            if contagem["i"] % 200 == 0:
                print(f"  {contagem['i']}/{min(limite, len(fila))}  ({time.time() - t0:.0f}s)", flush=True)
        if capa is None:
            with trava:
                falhas[mlb] = motivo
            return
        if v2:
            if limpa:                                    # cópia sem logo (Google Shopping)
                capa.save(limpa / f"{mlb}.webp", quality=QUALIDADE_V2, method=6)
            com_logo(capa).save(SAIDA / f"{mlb}.webp", quality=QUALIDADE_V2, method=6)
        else:
            capa.save(SAIDA / f"{mlb}.webp", quality=84, method=6)
        with trava:
            contagem["ok"] += 1

    if v2:                                                           # carrega antes das threads
        _fundo_v2(LADO_V2)
        com_logo(Image.new("RGB", (LADO_V2, LADO_V2), TOPO))
    if trabalhadores > 1:
        import concurrent.futures as cf
        global _FUNDO
        _FUNDO = _FUNDO or fundo()                                   # inicia antes das threads
        _ocr()                                                        # carrega o OCR antes das threads
        prob_carro(Image.new("RGBA", (32, 32), (255, 255, 255, 255)))
        with cf.ThreadPoolExecutor(trabalhadores) as ex:
            list(ex.map(uma, fila[:limite]))
    else:
        for item in fila[:limite]:
            uma(item)
    ok = contagem["ok"]
    if fatia:   # cada fatia grava as suas falhas; junta no fim
        Path(str(FALHAS).replace(".json", f".{fatia.replace('/', 'de')}.json")).write_text(
            json.dumps(falhas, ensure_ascii=False), encoding="utf-8")
    else:
        FALHAS.write_text(json.dumps(falhas, ensure_ascii=False, indent=0), encoding="utf-8")
    if v2:   # lista para o olho humano (ferramentas/folha_revisar.py monta a folha)
        arq = REVISAR if not fatia else Path(str(REVISAR).replace(".json", f".{fatia.replace('/', 'de')}.json"))
        antigo = json.loads(arq.read_text(encoding="utf-8")) if arq.exists() else {}
        antigo.update(revisar)
        arq.write_text(json.dumps(antigo, ensure_ascii=False, indent=0), encoding="utf-8")
        print(f"  para revisar: {len(revisar)} nesta rodada -> {arq}", flush=True)
    print(f"capas de estúdio: +{ok} nesta rodada | falhas {len(falhas)} | {time.time() - t0:.0f}s")
    if not os.getenv("ESTUDIO_SAIDA"):
        marcar()


def marcar():
    """Marca no pecas.json e no busca.json quais peças já têm capa de estúdio."""
    feitas = {p.stem for p in SAIDA.glob("*.webp")}
    pecas = json.loads(PECAS.read_text(encoding="utf-8"))
    for x in pecas:
        x["estudio"] = x["id"] in feitas
    PECAS.write_text(json.dumps(pecas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    busca = ROOT / "site" / "public" / "dados" / "busca.json"
    if busca.exists():
        b = json.loads(busca.read_text(encoding="utf-8"))
        pro = {q.stem for q in (ROOT / "site" / "public" / "estudio-pro").glob("*.webp")}   # maquiadas (ChatGPT)
        b["e"] = "".join("2" if i in pro else "1" if i in feitas else "0" for i in b["id"])
        busca.write_text(json.dumps(b, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"capas de estúdio marcadas: {sum(1 for x in pecas if x['estudio'])}/{len(pecas)}")


if __name__ == "__main__":
    if "--so-marcar" in sys.argv:          # so grava "estudio"/"e" no pecas.json e busca.json (sem rembg)
        marcar()
        sys.exit(0)
    try:
        sys.exit(main())
    finally:
        # busca.json SEMPRE com o campo "e", mesmo se a geracao de capas falhar no meio
        if not os.getenv("ESTUDIO_SAIDA"):
            try:
                marcar()
            except Exception as e:
                print(f"capas de estúdio: marcar falhou ({e})", flush=True)
