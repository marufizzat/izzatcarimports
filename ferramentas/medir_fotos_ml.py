#!/usr/bin/env python3
"""Mede onde está a PEÇA em cada foto do Mercado Livre que aparece na galeria da página da peça.

Para cada foto do anúncio (a capa de estúdio já é enquadrada pelo capas_estudio.py) grava em
site/src/data/fotos-ml-caixas.json:
    "<chave>": [W, H, x0, y0, x1, y1]   tamanho da foto grande (-F) e a caixa da peça, em px dela
    "<chave>": [W, H]                   nenhuma peça achada (a galeria mostra a foto inteira)
O site (src/lib/quadroFoto.ts) usa isso no build para enquadrar a foto no quadro quadrado com a peça
centrada e ocupando ~84%, sem cortar a peça e sem copiar nem alterar a foto (só CSS). A "caixa da peça" é a de tudo
o que está em primeiro plano na foto (nada fica cortado ao meio).

Só mede o que falta no JSON (nunca baixa de novo o que já tem); grava aos poucos (pode parar e retomar).
Baixa a foto média (-O, até 500 px, ~9 KB) só na memória, e os 64 primeiros bytes da grande (-F) para o tamanho.

Motor (MEDIR_MOTOR): vision (Mac, recorte nativo ~/.local/bin/recorta-fundo, 8 em paralelo) | rembg (robô).
Variáveis: MEDIR_PARALELO (8), MEDIR_TEMPO_MAX (s, 0 = sem limite), MEDIR_IDS (MLBs que vão primeiro),
MEDIR_LIMITE (fotos por rodada, 0 = todas).
Opções: --extra ARQ   junta o JSON do robô (cache entre rodadas) e grava o resultado nele também
        --podar       tira do JSON as fotos que não estão mais em nenhum anúncio
Teste: python testes/test_medir_fotos_ml.py
"""
import io
import json
import os
import struct
import sys
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PECAS = ROOT / "site" / "src" / "data" / "pecas.json"
ARQ = Path(os.getenv("MEDIR_ARQ") or ROOT / "site" / "src" / "data" / "fotos-ml-caixas.json")
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


def motor_vision():
    """Recorte nativo do Mac (o mesmo do capas_estudio.py). Saída 5 = nenhum primeiro plano."""
    import subprocess
    import tempfile
    from PIL import Image
    prog = os.path.expanduser("~/.local/bin/recorta-fundo")

    def recortar(img):
        with tempfile.TemporaryDirectory() as d:
            ent, sai = os.path.join(d, "e.png"), os.path.join(d, "s.png")
            img.save(ent)
            r = subprocess.run([prog, ent, sai], capture_output=True, timeout=60)
            if r.returncode == 5:
                raise SemPeca
            if r.returncode != 0 or not os.path.exists(sai):
                raise RuntimeError(f"vision falhou ({r.returncode})")
            return Image.open(sai).split()[3].copy()
    return recortar, int(os.getenv("MEDIR_PARALELO", "8"))


def motor_rembg():
    from rembg import new_session, remove
    sessao = new_session(os.getenv("MEDIR_MODELO", "isnet-general-use"), providers=["CPUExecutionProvider"])
    return (lambda img: remove(img, session=sessao, only_mask=True, post_process_mask=True)), 1


def medir_uma(chave, recortar):
    """[W, H, x0, y0, x1, y1] (px da foto -F), [W, H] sem peça, ou None (rede: tenta na próxima rodada)."""
    from PIL import Image
    try:
        media = Image.open(io.BytesIO(_get(CDN.format(chave, "O")))).convert("RGB")
    except Exception:  # noqa: BLE001  (rede, foto que saiu do ar)
        return None
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
        return None
    if not cx:
        return [W, H]
    kx, ky = W / media.size[0], H / media.size[1]
    x0, y0, x1, y1 = cx
    return [W, H, round(x0 * kx), round(y0 * ky), min(W, round(x1 * kx)), min(H, round(y1 * ky))]


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
    dados.update(ler(ARQ))                       # o do repositório (medido no Mac) manda
    if "--podar" in argv:
        usadas = {k for p in pecas for k in (p.get("fotos") or [])}
        dados = {k: v for k, v in dados.items() if k in usadas}
    primeiro = set(filter(None, os.getenv("MEDIR_IDS", "").split(",")))
    fila = fila_de(pecas, dados, primeiro)
    limite = int(os.getenv("MEDIR_LIMITE", "0") or 0)
    if limite:
        fila = fila[:limite]
    print(f"fotos da galeria: {len(dados)} medidas | {len(fila)} nesta rodada", flush=True)
    motor = os.getenv("MEDIR_MOTOR") or ("vision" if sys.platform == "darwin" else "rembg")
    try:
        recortar, n = (motor_vision() if motor == "vision" else motor_rembg()) if fila else (None, 0)
    except Exception as e:  # noqa: BLE001  (sem rembg/onnx: grava só a junção, mede na próxima rodada)
        print(f"sem o recorte ({motor}): {str(e)[:80]} — fica para a próxima rodada", flush=True)
        fila = []
    if fila:
        tempo_max = float(os.getenv("MEDIR_TEMPO_MAX", "0") or 0)
        trava = threading.Lock()
        cont = {"i": 0, "ok": 0, "sem": 0, "erro": 0}

        def uma(k):
            if tempo_max and time.time() - t0 > tempo_max:
                return
            r = medir_uma(k, recortar)
            with trava:
                cont["i"] += 1
                if r is None:
                    cont["erro"] += 1
                else:
                    dados[k] = r
                    cont["ok" if len(r) == 6 else "sem"] += 1
                if cont["i"] % 500 == 0:
                    gravar(dados, ARQ)
                    seg = time.time() - t0
                    print(f"  {cont['i']}/{len(fila)}  {seg:.0f}s  ({cont['i'] / seg:.1f}/s)", flush=True)

        if n > 1:
            import concurrent.futures as cf
            with cf.ThreadPoolExecutor(n) as ex:
                list(ex.map(uma, fila))
        else:
            for k in fila:
                uma(k)
        print(f"medidas: +{cont['ok']} com a peça, +{cont['sem']} sem peça achada, {cont['erro']} erro de rede"
              f" | {time.time() - t0:.0f}s", flush=True)
    gravar(dados, ARQ)
    if extra:
        gravar(dados, extra)


if __name__ == "__main__":
    main(sys.argv[1:])
