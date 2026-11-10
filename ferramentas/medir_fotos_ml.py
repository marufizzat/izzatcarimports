#!/usr/bin/env python3
"""Mede e classifica cada foto do Mercado Livre que aparece na galeria da página da peça.

Grava em site/src/data/fotos-ml-caixas.json, por chave da foto:
    [W, H, x0, y0, x1, y1, classe, hash]   tamanho da foto grande (-F), a caixa da peça (px dela), classe e assinatura
    [W, H, classe, hash]                   nenhuma peça achada
(classe e hash faltam enquanto a foto não foi classificada; entrada antiga só com números = sem classe).
A "caixa da peça" é a de tudo o que está em primeiro plano (nada fica cortado ao meio). O site (src/lib/quadroFoto.ts)
enquadra a foto no quadro quadrado com a peça centrada e ocupando ~84%, só com CSS.

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
MEDIR_LIMITE (fotos por rodada, 0 = todas), MEDIR_SINAIS (cache dos sinais).
Opções: --extra ARQ       junta o JSON do robô (cache entre rodadas) e grava o resultado nele também
        --podar           tira do JSON as fotos que não estão mais em nenhum anúncio
        --so-juntar       não mede nada: só junta o JSON do robô e grava (rodada sem tempo)
        --reclassificar   refaz as classes pelos sinais em cache (depois de mudar uma regra)
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
    if cx:
        kx, ky = W / media.size[0], H / media.size[1]
        x0, y0, x1, y1 = cx
        e = [W, H, round(x0 * kx), round(y0 * ky), min(W, round(x1 * kx)), min(H, round(y1 * ky))]
    else:
        e = [W, H]
    if classificar is None:
        return e, None
    try:
        s = classificar(media)
    except Exception:  # noqa: BLE001  (OCR falhou: fica medida, a classe vem depois)
        return e, None
    return com_classe(e, classe_de(bool(cx), s), s["h"]), s


def classificar_uma(chave, entrada, classificar):
    """Classe de uma foto já medida: (entrada com classe, sinais) ou (None, None) se a rede/OCR falhou."""
    try:
        s = classificar(baixar_media(chave))
    except Exception:  # noqa: BLE001
        return None, None
    return com_classe(entrada, classe_de(len(numeros(entrada)) >= 6, s), s["h"]), s


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


def com_classe(e, classe, h):
    return numeros(e) + [classe] + ([h] if h else [])


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
    if "--reclassificar" in argv:                # regra nova: refaz pelos sinais guardados, sem baixar nada
        for k, e in dados.items():
            if k in cache:
                dados[k] = com_classe(e, classe_de(len(numeros(e)) >= 6, cache[k]), cache[k]["h"])
    primeiro = set(filter(None, os.getenv("MEDIR_IDS", "").split(",")))
    fila = fila_de(pecas, dados, primeiro)
    sem_classe = [k for k in fila_de(pecas, {}, primeiro) if k in dados and not classe_da(dados[k])]
    for k in [k for k in sem_classe if k in cache]:   # sinais já guardados: classe sem baixar de novo
        dados[k] = com_classe(dados[k], classe_de(len(numeros(dados[k])) >= 6, cache[k]), cache[k]["h"])
    sem_classe = [k for k in sem_classe if not classe_da(dados[k])]
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
    print("classes: " + ", ".join(f"{c} {n}" for c, n in sorted(contagem.items())) + f" (modelo repetido: {len(rep)})",
          flush=True)
    gravar(dados, ARQ)
    if cache and (fila or sem_classe):
        gravar(cache, SINAIS)
    if extra:
        gravar(dados, extra)


if __name__ == "__main__":
    main(sys.argv[1:])
