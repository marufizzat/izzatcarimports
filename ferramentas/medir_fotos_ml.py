#!/usr/bin/env python3
"""Mede e classifica cada foto do Mercado Livre que aparece na galeria da página da peça.

Grava em site/src/data/fotos-ml-caixas.json, por chave da foto:
    [W, H, x0, y0, x1, y1, classe, hash]   tamanho da foto grande (-F), a caixa da peça (px dela), classe e assinatura
    [W, H, x0, y0, x1, y1, classe, hash, "incerta"]   a caixa pode não ter pegado a peça toda: a galeria mostra a foto
                                           inteira (teste da faixa de segurança, abaixo)
    [W, H, classe, hash]                   nenhuma peça achada
(classe e hash faltam enquanto a foto não foi classificada; entrada antiga só com números = sem classe).
A "caixa da peça" é a de tudo o que está em primeiro plano (nada fica cortado ao meio). O site (src/lib/quadroFoto.ts)
enquadra a foto no quadro quadrado com a peça centrada e ocupando ~84%, só com CSS, e nunca amplia além do quadrado da
própria foto: o quadro só corta a foto no eixo LONGO.

Caixa incerta (teste da faixa de segurança, `faixas()`): o recorte às vezes pega só um pedaço — a montagem com o carro
colado (pega o carro), o plástico branco/transparente (pega só a parte preta), o zoom na etiqueta (pega a etiqueta).
Então, em toda a região da foto além de cada lado da caixa (a partir de 2% dela, na altura/largura inteira da foto),
procura "coisa": pixel que difere 25+ do fundo (pega o plástico branco). Mancha de 0,1% da foto ou mais além da caixa,
num lado do eixo longo (onde o quadro corta) = "incerta"; também a caixa que vai de uma borda à outra no lado curto e a
borda da foto escura ou bagunçada (close da peça ou etiqueta na frente: não há fundo para conferir). Foto quadrada nunca
é cortada: nunca fica incerta.
A medida de cada lado fica no cache dos sinais ("f"): mudar o limite = --reclassificar, sem baixar nada.

Classes (a galeria, o JSON-LD e o feed tiram "m" e põem "c" no fim):
    p  peça                     s  sem peça achada (aparece inteira)
    m  marketing do anúncio: banner de entrega/garantia/dicas (2+ palavras de propaganda no texto lido pelo OCR, com
       texto de banner, 5%+ da foto), cartão escuro com texto, ou a MESMA foto (assinatura idêntica) em 3+ anúncios
       diferentes. O selo pequeno "produto seminovo original" e o lacre da loja colados na foto da peça NÃO contam.
    c  carro inteiro (classificador prob_carro do capas_estudio.py > 0,6): vai para o fim da galeria
Muito texto sozinho NÃO é marketing: nas fotos do catálogo, mais de 15% de texto é quase sempre a etiqueta da peça
(nome, carro e código do vendedor, ou a etiqueta de fábrica), que mostra o código ao comprador.

Só mede/classifica o que falta (nunca baixa de novo o que já tem); grava aos poucos (pode parar e retomar).
Baixa a foto média (-O, até 500 px) só na memória, e os 64 primeiros bytes da grande (-F) para o tamanho.
Os sinais brutos de cada foto (texto, luz, carro, hash) ficam num cache local (MEDIR_SINAIS, fora do repositório):
--reclassificar refaz as classes por eles, sem baixar nada.

Motor (MEDIR_MOTOR): vision (Mac: ferramentas/caixa_vision.swift aberto em cada uma das 8 linhas de trabalho, recorte
e OCR do Vision; sem swiftc, o ~/.local/bin/recorta-fundo e sem classe) | rembg (robô: recorte rembg e OCR rapidocr;
sem rapidocr, mede e deixa a classe para a próxima rodada).
Variáveis: MEDIR_PARALELO (8), MEDIR_TEMPO_MAX (s, 0 = sem limite), MEDIR_IDS (MLBs que vão primeiro),
MEDIR_LIMITE (fotos por rodada, 0 = todas), MEDIR_SINAIS (cache dos sinais), MEDIR_FOTOS_O (pasta com <chave>.webp da
foto -O já baixada: usada no lugar da rede).
Opções: --extra ARQ       junta o JSON do robô (cache entre rodadas) e grava o resultado nele também
        --podar           tira do JSON as fotos que não estão mais em nenhum anúncio
        --so-juntar       não mede nada: só junta o JSON do robô e grava (rodada sem tempo)
        --reclassificar   refaz as classes (e a caixa incerta) pelos sinais em cache (depois de mudar uma regra)
        --faixas          faz o teste da faixa nas fotos com caixa que ainda não têm ("f" no cache, ou o antigo de 4
                          números): baixa a -O de novo
Teste: python testes/test_medir_fotos_ml.py
"""
import io
import json
import os
import re
import struct
import sys
import threading
import time
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PECAS = ROOT / "site" / "src" / "data" / "pecas.json"
ARQ = Path(os.getenv("MEDIR_ARQ") or ROOT / "site" / "src" / "data" / "fotos-ml-caixas.json")
SINAIS = Path(os.getenv("MEDIR_SINAIS") or Path.home() / ".cache" / "izzatcar" / "fotos-ml-sinais.json")
CDN = "https://http2.mlstatic.com/D_{}-{}.webp"
UA = {"User-Agent": "Mozilla/5.0 (izzatcar-site)"}
LADO_MEDIDA = 500          # a foto -O já vem com até 500 px: a caixa sai em fração, a resolução basta


# ---------- rede ----------
def _get(url, faixa=None, tempo=25):
    h = dict(UA)
    if faixa:
        h["Range"] = f"bytes=0-{faixa - 1}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=tempo) as r:
        return r.read()


def tamanho_webp(b):
    """(largura, altura) pelo cabeçalho de um WebP (VP8, VP8L ou VP8X); None se não der."""
    if len(b) < 30 or b[:4] != b"RIFF" or b[8:12] != b"WEBP":
        return None
    tipo = b[12:16]
    if tipo == b"VP8 " and b[23:26] == b"\x9d\x01\x2a":
        w, h = struct.unpack("<HH", b[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if tipo == b"VP8L" and b[20] == 0x2F:
        v = struct.unpack("<I", b[21:25])[0]
        return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
    if tipo == b"VP8X":
        w = int.from_bytes(b[24:27], "little") + 1
        h = int.from_bytes(b[27:30], "little") + 1
        return w, h
    return None


# ---------- a caixa da peça ----------
def caixa_da_mascara(alfa, sujeira=0.002):
    """Caixa (x0, y0, x1, y1) de TUDO o que o recorte achou em primeiro plano (máscara 2D 0-255), ou None.
    Só tira a sujeira (pedaço < 0,2% da foto). Diferente da capa de estúdio, aqui não se separa a peça do resto:
    o carrinho colado do anúncio, uma etiqueta ou uma 2ª peça entram na caixa, para o quadro nunca cortar nada ao meio."""
    import numpy as np
    from scipy import ndimage
    m = np.asarray(alfa) > 24
    rot, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n == 0:
        return None
    areas = np.bincount(rot.ravel())
    manter = areas >= m.size * sujeira
    manter[0] = False
    if not manter.any():
        return None
    ys, xs = np.nonzero(manter[rot])
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


FAIXA_DIF = 25         # diferença do fundo (0-255, no canal que mais muda) que já é "coisa": pega o plástico branco
FAIXA_GAP = 0.02       # a procura começa a 2% (do lado menor da foto) da caixa: sombra colada e borda do recorte fora
FAIXA_MANCHA = 0.001   # mancha de "coisa" com 0,1% da foto ou mais além da caixa = a caixa não pegou tudo
FUNDO_LISO = 0.85      # menos que isso da borda da foto com cara de fundo de estúdio = a peça enche a foto (close):
                       # não dá para conferir a caixa (conferido na folha: de 0,6 a 0,85 são todas closes)
FUNDO_ESCURO = 110     # borda da foto mais escura que isso (0-255) = não é o fundo claro do estúdio (close da peça)
INCERTA = "incerta"    # marca na entrada: a galeria mostra a foto inteira (lib/quadroFoto.ts)


def faixas(img, caixa):
    """Teste da faixa de segurança. `img` é a foto (PIL, a -O na memória), `caixa` (x0, y0, x1, y1) em px dela.
    Para cada lado da caixa [esq, topo, dir, base]: a maior mancha de "coisa" em TODA a região da foto além daquele
    lado (de FAIXA_GAP da caixa até a borda da foto, na altura/largura inteira dela: pega também o que está na
    diagonal), em fração da área da foto; -1 = a caixa chega na borda da foto (nada além). E no fim, `fundo`: a fração
    da borda da foto com cara de fundo de estúdio (0 se a borda é escura): close da peça, etiqueta em cima da peça ou
    fundo bagunçado não deixam conferir nada (a "coisa" é medida contra a borda).
    "Coisa" = pixel que difere FAIXA_DIF+ de três estimativas do fundo: a borda da foto daquele lado, a borda inteira e
    o perfil linha a linha das bordas laterais (o degradê do fundo de estúdio não conta). O fechamento (~1,4% da foto)
    junta as letras de uma etiqueta numa mancha só; depois a abertura 3x3 tira os pontinhos soltos (ruído do JPEG)."""
    import numpy as np
    from scipy import ndimage
    a = np.asarray(img.convert("RGB"), dtype=np.int16)
    h, w = a.shape[:2]
    s = min(w, h)
    b, g, k = max(2, round(0.02 * s)), max(1, round(FAIXA_GAP * s)), max(3, round(0.014 * s))
    bordas = {"esq": a[:, :b], "topo": a[:b, :], "dir": a[:, -b:], "base": a[-b:, :]}
    fundo = np.median(np.concatenate([v.reshape(-1, 3) for v in bordas.values()]), axis=0)
    perfil = np.median(np.concatenate([a[:, :b], a[:, -b:]], axis=1), axis=1)            # fundo de cada linha
    perfil = ndimage.median_filter(perfil, size=(max(3, h // 50), 1))
    dif = np.minimum(np.abs(a - fundo).max(axis=2), np.abs(a - perfil[:, None, :]).max(axis=2))
    na_borda = np.ones((h, w), dtype=bool)
    na_borda[b:-b, b:-b] = False
    luz = np.median(a[na_borda].mean(axis=1))
    liso = 0.0 if luz < FUNDO_ESCURO else float((dif[na_borda] < FAIXA_DIF).mean())
    x0, y0, x1, y1 = caixa
    regioes = {"esq": (0, x0 - g, 0, h), "topo": (0, w, 0, y0 - g), "dir": (x1 + g, w, 0, h), "base": (0, w, y1 + g, h)}
    saida = []
    for lado, (xa, xb, ya, yb) in regioes.items():
        xa, xb, ya, yb = max(0, xa), min(w, xb), max(0, ya), min(h, yb)
        if xb - xa < 3 or yb - ya < 3:
            saida.append(-1)
            continue
        do_lado = np.abs(a[ya:yb, xa:xb] - np.median(bordas[lado].reshape(-1, 3), axis=0)).max(axis=2)
        coisa = ndimage.binary_closing(np.minimum(dif[ya:yb, xa:xb], do_lado) >= FAIXA_DIF, structure=np.ones((k, k)))
        coisa = ndimage.binary_opening(coisa, structure=np.ones((3, 3)))
        rot, n = ndimage.label(coisa, structure=np.ones((3, 3)))
        maior = int(np.bincount(rot.ravel())[1:].max()) if n else 0
        saida.append(round(maior / (w * h), 4))
    return saida + [round(liso, 3)]


def incerta(W, H, f, caixa=None):
    """A caixa não é confiável onde o quadro corta a foto: só no eixo longo (o quadro nunca corta o lado curto,
    lib/quadroFoto.ts), se há mancha além dela (f = faixas() ou None), se a borda da foto não tem cara de fundo de
    estúdio, ou se a caixa vai de uma borda à outra no lado curto (x0, y0, x1, y1 em px da foto -F): nesses dois a foto
    não tem fundo para conferir a caixa (close da peça, que continua além da foto, ou etiqueta na frente dela). Foto
    quadrada nunca é cortada: nunca incerta."""
    if W == H:
        return False
    if caixa and (caixa[1] <= 0.01 * H and caixa[3] >= 0.99 * H if W > H else caixa[0] <= 0.01 * W and caixa[2] >= 0.99 * W):
        return True
    if f and len(f) > 4 and f[4] < FUNDO_LISO:
        return True
    return bool(f) and any(f[i] > FAIXA_MANCHA for i in ((0, 2) if W > H else (1, 3)))


def caixa_na_foto(e, img):
    """A caixa da entrada (px da foto -F) em px da foto `img` (a -O), ou None sem caixa."""
    n = numeros(e)
    if len(n) < 6:
        return None
    kx, ky = img.size[0] / n[0], img.size[1] / n[1]
    return round(n[2] * kx), round(n[3] * ky), round(n[4] * kx), round(n[5] * ky)


class SemPeca(Exception):
    """O recorte não achou nada em primeiro plano (foto sem peça destacada): vale como medida."""


def _ajudante_vision():
    """ferramentas/caixa_vision.swift compilado (uma vez, em ~/.cache): o recorte do Vision num processo só, que fica
    aberto e recebe uma foto por linha (~3x mais rápido que abrir o recorta-fundo a cada foto). None sem o swiftc."""
    import shutil
    import subprocess
    fonte = Path(__file__).with_name("caixa_vision.swift")
    prog = Path.home() / ".cache" / "izzatcar" / "caixa_vision"
    if prog.exists() and prog.stat().st_mtime >= fonte.stat().st_mtime:
        return str(prog)
    if not shutil.which("swiftc"):
        return None
    prog.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["swiftc", "-O", str(fonte), "-o", str(prog)], capture_output=True, timeout=300)
    return str(prog) if r.returncode == 0 and prog.exists() else None


class Vision:
    """O Vision do Mac: recorte do primeiro plano (o mesmo do capas_estudio.py, todas as instâncias) e OCR. Com o
    ajudante em Swift, cada linha de trabalho tem o seu processo aberto; sem ele, o ~/.local/bin/recorta-fundo a cada
    foto (saída 5 = nenhum primeiro plano) e sem OCR (sem classe)."""

    def __init__(self):
        self.ajudante = _ajudante_vision()
        self.local = threading.local()

    def _pedir(self, linha):
        import subprocess
        pr = getattr(self.local, "pr", None)
        if pr is None or pr.poll() is not None:
            pr = self.local.pr = subprocess.Popen([self.ajudante], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                                  text=True, bufsize=1)
        pr.stdin.write(linha + "\n")
        pr.stdin.flush()
        resp = pr.stdout.readline().rstrip("\n")
        if not resp:                       # o processo caiu: abre outro na próxima foto
            self.local.pr = None
            raise RuntimeError("vision: o ajudante parou")
        return resp

    def recortar(self, img):
        import subprocess
        import tempfile
        from PIL import Image
        with tempfile.TemporaryDirectory() as d:
            ent, sai = os.path.join(d, "e.png"), os.path.join(d, "s.png")
            img.save(ent)
            if self.ajudante:
                resp = self._pedir(f"{ent}\t{sai}")
                cod = 5 if resp == "SEM" else 0 if resp == "OK" else 1
            else:
                cod = subprocess.run([os.path.expanduser("~/.local/bin/recorta-fundo"), ent, sai],
                                     capture_output=True, timeout=60).returncode
            if cod == 5:
                raise SemPeca
            if cod != 0 or not os.path.exists(sai):
                raise RuntimeError(f"vision falhou ({cod})")
            return Image.open(sai).split()[3].copy()

    def texto(self, img):
        """(área de texto em fração da foto, texto lido)."""
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            ent = os.path.join(d, "e.png")
            img.save(ent)
            resp = self._pedir(f"TEXTO\t{ent}")
        partes = resp.split(" ", 3)
        if partes[0] != "T":
            raise RuntimeError(f"vision: OCR falhou ({resp[:20]})")
        return float(partes[1]), (partes[3] if len(partes) > 3 else "")


def texto_rapidocr():
    """OCR do robô (rapidocr, o mesmo do filtro de etiqueta das capas); None sem ele."""
    sys.path.insert(0, str(ROOT))
    import capas_estudio as ce
    ocr = ce._ocr()
    if ocr is None:
        return None

    def ler(img):
        import numpy as np
        res, _ = ocr(np.asarray(img.convert("RGB")))
        area, lidas = 0.0, []
        for box, txt, conf in res or []:
            if float(conf) < 0.5 or sum(ch.isalnum() for ch in txt) < 3:
                continue
            xs, ys = [q[0] for q in box], [q[1] for q in box]
            area += (max(xs) - min(xs)) * (max(ys) - min(ys))
            lidas.append(txt.replace("|", "/"))
        return min(1.0, area / (img.size[0] * img.size[1])), " | ".join(lidas)
    return ler


def prob_carro_foto():
    """prob_carro do capas_estudio.py na foto inteira (MobileNetV2, 14 MB, CPU)."""
    sys.path.insert(0, str(ROOT))
    import capas_estudio as ce
    from PIL import Image
    ce.prob_carro(Image.new("RGBA", (32, 32), (255, 255, 255, 255)))     # carrega o modelo antes das linhas
    return lambda img: ce.prob_carro(img.convert("RGBA"))


def motores(nome):
    """(recortar, ler_texto ou None, prob_carro ou None, linhas de trabalho)."""
    try:
        prob = prob_carro_foto()
    except Exception as e:  # noqa: BLE001  (sem onnxruntime/modelo: mede, classifica depois)
        print(f"sem o classificador de carro: {str(e)[:80]}", flush=True)
        prob = None
    if nome == "vision":
        v = Vision()
        return v.recortar, (v.texto if v.ajudante else None), prob, int(os.getenv("MEDIR_PARALELO", "8"))
    from rembg import new_session, remove
    sessao = new_session(os.getenv("MEDIR_MODELO", "isnet-general-use"), providers=["CPUExecutionProvider"])
    try:
        ler = texto_rapidocr()
    except Exception:  # noqa: BLE001
        ler = None
    return (lambda img: remove(img, session=sessao, only_mask=True, post_process_mask=True)), ler, prob, 1


def baixar_media(chave):
    from PIL import Image
    local = os.getenv("MEDIR_FOTOS_O")
    if local and (Path(local) / f"{chave}.webp").exists():
        return Image.open(Path(local) / f"{chave}.webp").convert("RGB")
    return Image.open(io.BytesIO(_get(CDN.format(chave, "O")))).convert("RGB")


def medir_uma(chave, recortar, classificar=None):
    """Mede a foto nova: [W, H, x0, y0, x1, y1] (px da foto -F) ou [W, H] sem peça, com classe e assinatura se
    `classificar` (img -> sinais) foi dado. Devolve (entrada, sinais) ou (None, None) se a rede/recorte falhou."""
    try:
        media = baixar_media(chave)
    except Exception:  # noqa: BLE001  (rede, foto que saiu do ar)
        return None, None
    try:
        grande = tamanho_webp(_get(CDN.format(chave, "F"), faixa=64))
    except Exception:  # noqa: BLE001
        grande = None
    if not grande:   # sem o cabeçalho: a média já é a foto inteira (ou o máximo de 1200 px do ML)
        k = 1 if max(media.size) < LADO_MEDIDA else 1200 / max(media.size)
        grande = (round(media.size[0] * k), round(media.size[1] * k))
    W, H = grande
    media.thumbnail((LADO_MEDIDA, LADO_MEDIDA))
    try:
        cx = caixa_da_mascara(recortar(media))
    except SemPeca:
        cx = None
    except Exception:  # noqa: BLE001  (recorte falhou: não grava, tenta na próxima rodada)
        return None, None
    f = None
    if cx:
        kx, ky = W / media.size[0], H / media.size[1]
        x0, y0, x1, y1 = cx
        e = [W, H, round(x0 * kx), round(y0 * ky), min(W, round(x1 * kx)), min(H, round(y1 * ky))]
        f = faixas(media, cx)
    else:
        e = [W, H]
    inc = len(e) == 6 and incerta(W, H, f, e[2:6])
    if classificar is None:
        return e + ([INCERTA] if inc else []), None
    try:
        s = classificar(media)
    except Exception:  # noqa: BLE001  (OCR falhou: fica medida, a classe vem depois)
        return e + ([INCERTA] if inc else []), None
    if f is not None:
        s["f"] = f
    return com_classe(e, classe_de(bool(cx), s), s["h"], inc), s


def classificar_uma(chave, entrada, classificar):
    """Classe de uma foto já medida (e o teste da faixa): (entrada com classe, sinais) ou (None, None) se a rede/OCR
    falhou."""
    try:
        media = baixar_media(chave)
        s = classificar(media)
    except Exception:  # noqa: BLE001
        return None, None
    cx = caixa_na_foto(entrada, media)
    if cx:
        s["f"] = faixas(media, cx)
    n = numeros(entrada)
    return com_classe(entrada, classe_de(len(n) >= 6, s), s["h"], len(n) >= 6 and incerta(n[0], n[1], s.get("f"), n[2:6])), s


def faixa_uma(chave, entrada):
    """Só o teste da faixa (--faixas) numa foto já medida: a lista do faixas() ou None se a rede falhou."""
    try:
        media = baixar_media(chave)
    except Exception:  # noqa: BLE001
        return None
    cx = caixa_na_foto(entrada, media)
    return faixas(media, cx) if cx else None


# ---------- a classe da foto ----------
ESCURO = 45            # luz média (0-255) abaixo disso + texto = cartão escuro de propaganda
TEXTO_ESCURO = 0.08    # área de texto mínima (fração da foto) no cartão escuro (peça preta com código gravado: menos)
TEXTO_BANNER = 0.05    # área de texto mínima para as palavras de propaganda valerem (selo pequeno na foto da peça: menos)
CARRO = 0.6            # prob_carro (capas_estudio.py) acima disso = foto do carro inteiro
MODELO_ANUNCIOS = 3    # a mesma foto (assinatura idêntica) em tantos anúncios diferentes = modelo do vendedor
MODELO_BYTES = 5       # assinatura com menos bytes diferentes que isso é simples demais para dizer "a mesma foto"
# palavras de propaganda (nunca aparecem na etiqueta da peça: nome, carro, anos e código). Banner = 2 delas ou mais
PROPAGANDA = re.compile(
    r"\b(ENTREGA|ENTREGAMOS|ENVIO|ENVIAMOS|FRETE|GARANTIA|DICAS?|SEMI-? ?NOVO|SEMINOVA?|COMPRA|COMPRE|PEDIDO|"
    r"QUALIDADE|PROCEDENCIA|ATENDIMENTO|DUVIDAS?|VERIFIQUE|CONFIRA|WHATS ?APP|INSTAGRAM|NOTA FISCAL|DESMANCHE|"
    r"CREDENCIAD[OA]|AGILIDADE|CUIDADO|SATISFACAO|PRONTA ENTREGA|ESTOQUE|INSTALACAO|MECANICO|PRAZO)\b")
# o selo/lacre da loja colado na peça é foto da peça (não esconde)
LACRE = re.compile(r"\b(LACRE|SELO|NAO REMOVA|VIOLAD[OA])\b")


def _normal(t):
    return unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().upper()


def assinatura(img):
    """Assinatura de 64 bits da foto (dHash 9x8): fotos quase iguais têm quase os mesmos bits."""
    import numpy as np
    from PIL import Image
    g = np.asarray(img.convert("L").resize((9, 8), Image.BILINEAR), dtype="int16")
    bits = (g[:, 1:] > g[:, :-1]).ravel()
    return "%016x" % int("".join("1" if b else "0" for b in bits), 2)


def sinais(img, ler_texto, prob_carro):
    """Os sinais brutos de uma foto: t = área de texto (0-1), x = texto lido, l = luz média, c = carro, h = assinatura."""
    import numpy as np
    area, texto = ler_texto(img)
    return {"t": round(float(area), 4), "x": (texto or "")[:300], "l": round(float(np.asarray(img.convert("L")).mean()), 1),
            "c": round(float(prob_carro(img)), 3), "h": assinatura(img)}


def classe_de(tem_caixa, s):
    """p | s | m | c pelos sinais de UMA foto (o modelo repetido em vários anúncios é marcado depois, em modelos())."""
    x = _normal(s.get("x"))
    palavras = {m.group(1) for m in PROPAGANDA.finditer(x)}
    if len(palavras) >= 2 and s["t"] >= TEXTO_BANNER and not LACRE.search(x):
        return "m"
    if s["l"] < ESCURO and s["t"] > TEXTO_ESCURO:
        return "m"
    if s["c"] > CARRO:
        return "c"
    return "p" if tem_caixa else "s"


def numeros(e):
    return [v for v in e if not isinstance(v, str)]


def classe_da(e):
    return next((v for v in e if isinstance(v, str) and len(v) == 1), None)


def hash_da(e):
    return next((v for v in e if isinstance(v, str) and len(v) == 16), None)


def incerta_da(e):
    return INCERTA in e


def com_classe(e, classe, h, inc=None):
    """Os números da entrada + classe + assinatura (+ a marca de caixa incerta). inc None = mantém a marca de `e`."""
    if inc is None:
        inc = incerta_da(e)
    return numeros(e) + [classe] + ([h] if h else []) + ([INCERTA] if inc and len(numeros(e)) >= 6 else [])


def incerta_pelo_cache(e, s):
    """A caixa incerta pelos sinais guardados (None = sem o teste da faixa no cache: mantém a marca da entrada)."""
    n = numeros(e)
    if not s or "f" not in s or len(n) < 6:
        return None
    return incerta(n[0], n[1], s["f"], n[2:6])


def modelos(dados, pecas):
    """Chaves das fotos que são a MESMA imagem (assinatura idêntica) em MODELO_ANUNCIOS+ anúncios diferentes: banner ou
    cartão do vendedor. Assinatura simples demais (menos de MODELO_BYTES bytes diferentes, como 0f0f0f0f0f0f0f0f de
    tanta foto de peça clara no meio) não conta: aí fotos diferentes coincidem. Só igualdade exata: com "quase igual"
    (3 bits) as coincidências se encadeavam e levavam 1,5 mil fotos de peça (conferido na folha)."""
    anuncios = {}
    for p in pecas:
        for k in p.get("fotos") or []:
            anuncios.setdefault(k, set()).add(p["id"])
    grupos = {}
    for k, e in dados.items():
        h = hash_da(e)
        if h and len({h[i:i + 2] for i in range(0, 16, 2)}) >= MODELO_BYTES:
            grupos.setdefault(h, []).append(k)
    saida = set()
    for g in grupos.values():
        if len(set().union(*(anuncios.get(k, set()) for k in g))) >= MODELO_ANUNCIOS:
            saida.update(g)
    return saida


# ---------- JSON ----------
def ler(arq):
    try:
        return json.loads(Path(arq).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def gravar(dados, arq):
    """Uma foto por linha, em ordem (diff pequeno no git), escrita atômica."""
    arq = Path(arq)
    arq.parent.mkdir(parents=True, exist_ok=True)
    linhas = [f"{json.dumps(k)}:{json.dumps(dados[k], separators=(',', ':'))}" for k in sorted(dados)]
    tmp = arq.with_suffix(".tmp")
    tmp.write_text("{\n" + ",\n".join(linhas) + "\n}\n", encoding="utf-8")
    tmp.replace(arq)


def fila_de(pecas, feitas, primeiro=()):
    """Fotos da galeria que faltam medir, sem repetir; as peças de `primeiro` vão na frente."""
    ordem = sorted(pecas, key=lambda p: p["id"] not in primeiro)
    vistas, fila = set(feitas), []
    for p in ordem:
        for k in p.get("fotos") or []:
            if k and not k.startswith("http") and k not in vistas:
                vistas.add(k)
                fila.append(k)
    return fila


def fazer_faixas(dados, cache, chaves):
    """--faixas: o teste da faixa nas `chaves` (baixa a -O de novo, ou lê de MEDIR_FOTOS_O), grava a medida no cache
    ("f") e a marca de caixa incerta na entrada. MEDIR_PARALELO linhas; respeita MEDIR_TEMPO_MAX."""
    import concurrent.futures as cf
    t0, tempo_max = time.time(), float(os.getenv("MEDIR_TEMPO_MAX", "0") or 0)
    trava, cont = threading.Lock(), {"i": 0, "erro": 0}
    print(f"teste da faixa: {len(chaves)} fotos", flush=True)

    def uma(k):
        if tempo_max and time.time() - t0 > tempo_max:
            return
        f = faixa_uma(k, dados[k])
        with trava:
            cont["i"] += 1
            if f is None:
                cont["erro"] += 1
                return
            cache.setdefault(k, {})["f"] = f
            e = dados[k]
            dados[k] = com_classe(e, classe_da(e), hash_da(e), incerta_pelo_cache(e, cache[k])) if classe_da(e) \
                else numeros(e) + ([INCERTA] if incerta_pelo_cache(e, cache[k]) else [])
            if cont["i"] % 2000 == 0:
                gravar(cache, SINAIS)
                print(f"  {cont['i']}/{len(chaves)}  {time.time() - t0:.0f}s", flush=True)

    with cf.ThreadPoolExecutor(int(os.getenv("MEDIR_PARALELO", "8"))) as ex:
        list(ex.map(uma, chaves))
    print(f"teste da faixa: {cont['i'] - cont['erro']} feitas, {cont['erro']} erro de rede | {time.time() - t0:.0f}s",
          flush=True)


def main(argv):
    extra = argv[argv.index("--extra") + 1] if "--extra" in argv else None
    t0 = time.time()
    pecas = json.loads(PECAS.read_text(encoding="utf-8"))
    dados = ler(extra) if extra else {}
    for k, e in ler(ARQ).items():                # o do repositório (medido no Mac) manda, mas não perde a classe
        dados[k] = e if classe_da(e) or not dados.get(k) or numeros(dados[k]) != numeros(e) else dados[k]
    if "--podar" in argv:
        usadas = {k for p in pecas for k in (p.get("fotos") or [])}
        dados = {k: v for k, v in dados.items() if k in usadas}
    cache = ler(SINAIS)
    tem_sinais = lambda k: k in cache and "h" in cache[k]     # noqa: E731  (só "f" = teste da faixa sem os sinais)
    if "--reclassificar" in argv:                # regra nova: refaz pelos sinais guardados, sem baixar nada
        for k, e in dados.items():
            if tem_sinais(k):
                dados[k] = com_classe(e, classe_de(len(numeros(e)) >= 6, cache[k]), cache[k]["h"],
                                      incerta_pelo_cache(e, cache[k]))
            elif k in cache and classe_da(e):
                dados[k] = com_classe(e, classe_da(e), hash_da(e), incerta_pelo_cache(e, cache[k]))
    primeiro = set(filter(None, os.getenv("MEDIR_IDS", "").split(",")))
    fila = fila_de(pecas, dados, primeiro)
    sem_classe = [k for k in fila_de(pecas, {}, primeiro) if k in dados and not classe_da(dados[k])]
    for k in [k for k in sem_classe if tem_sinais(k)]:   # sinais já guardados: classe sem baixar de novo
        dados[k] = com_classe(dados[k], classe_de(len(numeros(dados[k])) >= 6, cache[k]), cache[k]["h"],
                              incerta_pelo_cache(dados[k], cache[k]))
    sem_classe = [k for k in sem_classe if not classe_da(dados[k])]
    if "--faixas" in argv:                       # o teste da faixa nas fotos com caixa que ainda não têm
        fazer_faixas(dados, cache, [k for k in fila_de(pecas, {}, primeiro)       # sem o teste ou com o de 4 lados só
                                    if k in dados and len(numeros(dados[k])) >= 6 and len(cache.get(k, {}).get("f", [])) < 5])
    limite = int(os.getenv("MEDIR_LIMITE", "0") or 0)
    if limite:
        fila, sem_classe = fila[:limite], sem_classe[:max(0, limite - len(fila))]
    if "--so-juntar" in argv:
        fila, sem_classe = [], []
    print(f"fotos da galeria: {len(dados)} medidas | {len(fila)} a medir | {len(sem_classe)} a classificar", flush=True)
    motor = os.getenv("MEDIR_MOTOR") or ("vision" if sys.platform == "darwin" else "rembg")
    recortar = ler_texto = prob = None
    n = 1
    if fila or sem_classe:
        try:
            recortar, ler_texto, prob, n = motores(motor)
        except Exception as e:  # noqa: BLE001  (sem rembg/onnx: grava só a junção, mede na próxima rodada)
            print(f"sem o recorte ({motor}): {str(e)[:80]} — fica para a próxima rodada", flush=True)
            fila, sem_classe = [], []
    classificar = (lambda img: sinais(img, ler_texto, prob)) if ler_texto and prob else None
    if not classificar:
        sem_classe = []
    tempo_max = float(os.getenv("MEDIR_TEMPO_MAX", "0") or 0)
    trava = threading.Lock()
    cont = {"i": 0, "ok": 0, "sem": 0, "classe": 0, "erro": 0}
    total = len(fila) + len(sem_classe)

    def guardar(k, e, s):
        with trava:
            cont["i"] += 1
            if e is None:
                cont["erro"] += 1
            else:
                if k in fila_set:
                    cont["ok" if len(numeros(e)) == 6 else "sem"] += 1
                if classe_da(e):
                    cont["classe"] += 1
                dados[k] = e
            if s is not None:
                cache[k] = s
            if cont["i"] % 500 == 0:
                gravar(dados, ARQ)
                gravar(cache, SINAIS)
                seg = time.time() - t0
                print(f"  {cont['i']}/{total}  {seg:.0f}s  ({cont['i'] / seg:.1f}/s)", flush=True)

    def uma(k):
        if tempo_max and time.time() - t0 > tempo_max:
            return
        if k in fila_set:
            guardar(k, *medir_uma(k, recortar, classificar))
        else:
            guardar(k, *classificar_uma(k, dados[k], classificar))

    fila_set = set(fila)
    if total:
        trabalho = fila + sem_classe
        if n > 1:
            import concurrent.futures as cf
            with cf.ThreadPoolExecutor(n) as ex:
                list(ex.map(uma, trabalho))
        else:
            for k in trabalho:
                uma(k)
        print(f"medidas: +{cont['ok']} com a peça, +{cont['sem']} sem peça achada, +{cont['classe']} classificadas, "
              f"{cont['erro']} erro de rede | {time.time() - t0:.0f}s", flush=True)
    rep = modelos(dados, pecas)                  # a mesma foto em vários anúncios: modelo do vendedor (marketing)
    for k in rep:
        dados[k] = com_classe(dados[k], "m", hash_da(dados[k]))
    contagem = {}
    for e in dados.values():
        c = classe_da(e) or "-"
        contagem[c] = contagem.get(c, 0) + 1
    print("classes: " + ", ".join(f"{c} {n}" for c, n in sorted(contagem.items())) + f" (modelo repetido: {len(rep)})"
          + f" | caixa incerta: {sum(1 for e in dados.values() if incerta_da(e))}", flush=True)
    gravar(dados, ARQ)
    if cache and (fila or sem_classe or "--faixas" in argv):
        gravar(cache, SINAIS)
    if extra:
        gravar(dados, extra)


if __name__ == "__main__":
    main(sys.argv[1:])
