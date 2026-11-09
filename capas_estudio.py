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
SAIDA = ROOT / "site" / "public" / "estudio"
FALHAS = SAIDA / "_falhas.json"   # vai junto no ramo capas-estudio
LADO = 800

# paleta do estúdio (bíblia visual v2)
TOPO = (246, 245, 242)
BASE = (231, 229, 225)


def fundo():
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (LADO, LADO), TOPO)
    d = ImageDraw.Draw(im)
    for y in range(LADO):
        t = max(0.0, (y - LADO * 0.55) / (LADO * 0.45))
        c = tuple(round(TOPO[i] + (BASE[i] - TOPO[i]) * t) for i in range(3))
        d.line([(0, y), (LADO, y)], fill=c)
    return im


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


def limpar_mascara(recorte, checar_cantos=True):
    """Separa os pedaços recortados; tira os que são CARRO INTEIRO e a sujeira.
    Devolve (recorte_limpo, tirou_carro) ou (None, x) se só sobrou carro."""
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
                canto = r.crop((cx0, y0, cx0 + int(w * fw), y0 + int(h * fh)))
                if canto.split()[3].getbbox() and prob_carro(canto) > lim:
                    return None, True
    return r, tirou


def compor(recorte, checar_cantos=True):
    """Peça recortada (RGBA) -> capa 800x800 em estúdio, com sombra de contato."""
    from PIL import Image, ImageFilter
    global _FUNDO
    recorte, _ = limpar_mascara(recorte, checar_cantos)
    if recorte is None:
        return None
    if _FUNDO is None:
        _FUNDO = fundo()
    alfa = recorte.split()[3]
    caixa = alfa.point(lambda v: 255 if v > 24 else 0).getbbox()
    if not caixa:
        return None
    peca = recorte.crop(caixa)
    w, h = peca.size
    if w * h < 400:
        return None
    escala = min(LADO * 0.78 / w, LADO * 0.70 / h)
    peca = peca.resize((max(1, round(w * escala)), max(1, round(h * escala))), Image.LANCZOS)
    w, h = peca.size
    x = (LADO - w) // 2
    y = round(LADO * 0.47 - h / 2)
    y = max(int(LADO * 0.06), min(y, int(LADO * 0.86) - h))
    tela = _FUNDO.copy().convert("RGBA")
    # sombra de contato: elipse achatada sob a peça + sombra suave da silhueta
    sombra = Image.new("L", (LADO, LADO), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(sombra).ellipse((x + w * 0.12, y + h - h * 0.04, x + w * 0.88, y + h + max(10, h * 0.07)), fill=95)
    sombra = sombra.filter(ImageFilter.GaussianBlur(14))
    silhueta = Image.new("L", (LADO, LADO), 0)
    silhueta.paste(peca.split()[3].point(lambda v: v * 0.28), (x + 6, y + 10))
    silhueta = silhueta.filter(ImageFilter.GaussianBlur(18))
    escuro = Image.new("RGBA", (LADO, LADO), (40, 36, 32, 255))
    tela = Image.composite(escuro, tela, sombra)
    tela = Image.composite(escuro, tela, silhueta)
    tela.alpha_composite(peca, (x, y))
    return tela.convert("RGB")


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
    fila = []
    for x in pecas:
        fs = [k for k in (x.get("fotos") or []) if k and not k.startswith("http")]
        if not fs:
            continue
        cands = fs[:3] if x.get("limpa") else (fs[1:3] + fs[:1])
        if x["id"] not in feitas and x["id"] not in falhas:
            fila.append((x["id"], cands))
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

    def uma(item):
        mlb, cands = item
        capa, motivo, reserva = None, "recorte vazio", None
        for k in cands:
            try:
                original = Image.open(io.BytesIO(baixar(k))).convert("RGB")
                original.thumbnail((1000, 1000))
                with trava if trabalhadores > 1 and recortar is not recortar_vision else _nulo():
                    recorte = recortar(original)
                capa = compor(recorte)
                if capa is not None:
                    break
                if reserva is None:   # se nenhuma foto ficar limpa, usa a 1a sem os pedaços de carro soltos
                    reserva = compor(recorte, checar_cantos=False)
                motivo = "so carro/vazio"
            except Exception as e:  # rede, imagem corrompida...
                motivo = str(e)[:80]
        capa = capa or reserva
        with trava:
            contagem["i"] += 1
            if contagem["i"] % 200 == 0:
                print(f"  {contagem['i']}/{min(limite, len(fila))}  ({time.time() - t0:.0f}s)", flush=True)
        if capa is None:
            with trava:
                falhas[mlb] = motivo
            return
        capa.save(SAIDA / f"{mlb}.webp", quality=82, method=6)
        with trava:
            contagem["ok"] += 1

    if trabalhadores > 1:
        import concurrent.futures as cf
        global _FUNDO
        _FUNDO = _FUNDO or fundo()                                   # inicia antes das threads
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
    print(f"capas de estúdio: +{ok} nesta rodada | falhas {len(falhas)} | {time.time() - t0:.0f}s")
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
        b["e"] = "".join("1" if i in feitas else "0" for i in b["id"])
        busca.write_text(json.dumps(b, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"capas de estúdio marcadas: {sum(1 for x in pecas if x['estudio'])}/{len(pecas)}")


if __name__ == "__main__":
    sys.exit(main())
