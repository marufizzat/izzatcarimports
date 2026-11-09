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
SAIDA = Path(os.getenv("ESTUDIO_SAIDA", str(ROOT / "site" / "public" / "estudio")))
FALHAS = SAIDA / "_falhas.json"   # vai junto no ramo capas-estudio
LADO = 800

# paleta do estúdio (bíblia visual v2)
TOPO = (247, 246, 243)
BASE = (229, 227, 223)


def fundo():
    """Estúdio infinito: degradê claro, luz suave de softbox atrás da peça e vinheta bem leve."""
    import numpy as np
    from PIL import Image
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

    def uma(item):
        if tempo_max and time.time() - t0 > tempo_max:
            return   # sem falha: fica pra proxima rodada
        mlb, cands = item
        capa, motivo, reserva, cortada = None, "recorte vazio", None, None
        for k in cands:
            try:
                original = Image.open(io.BytesIO(baixar(k))).convert("RGB")
                original.thumbnail((1000, 1000))
                with trava if trabalhadores > 1 and recortar is not recortar_vision else _nulo():
                    recorte = recortar(original)
                if etiqueta_de_texto(original, recorte):
                    motivo = "etiqueta de texto"
                    continue   # proxima foto candidata
                img, corte = compor(recorte, original=original)
                if img is not None and not corte:
                    capa = img
                    break
                if img is not None:   # peça encostada na borda da foto: só se nenhuma outra servir
                    cortada = cortada or img
                    motivo = "cortada"
                    continue
                if reserva is None:   # se nenhuma foto ficar limpa, usa a 1a sem os pedaços de carro soltos
                    reserva, _ = compor(recorte, checar_cantos=False, original=original)
                motivo = "so carro/vazio"
            except Exception as e:  # rede, imagem corrompida...
                motivo = str(e)[:80]
        capa = capa or cortada or reserva
        with trava:
            contagem["i"] += 1
            if contagem["i"] % 200 == 0:
                print(f"  {contagem['i']}/{min(limite, len(fila))}  ({time.time() - t0:.0f}s)", flush=True)
        if capa is None:
            with trava:
                falhas[mlb] = motivo
            return
        capa.save(SAIDA / f"{mlb}.webp", quality=84, method=6)
        with trava:
            contagem["ok"] += 1

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
