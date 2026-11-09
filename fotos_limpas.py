"""
IZZAT CAR — escolhe a foto "limpa" de cada peca (so a peca, sem o carro colado).

Muito anuncio do ML usa de capa uma montagem: a peca + a foto do carro inteiro.
No site isso deixa os cartoes, os mosaicos de carro e a foto principal poluidos.
Aqui cada foto e analisada (miniatura de 280 px): separamos o que nao e fundo e
contamos os "objetos" soltos. Peca sozinha = um objeto grande; montagem com
carro = dois ou mais. A primeira foto limpa do anuncio vira a capa.

O resultado fica em fotos_limpas.json (cache): so foto nova e analisada.
Sem internet ou sem Pillow, nada quebra: a ordem original das fotos e mantida.
"""

import concurrent.futures as cf
import io
import json
import urllib.request
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "fotos_limpas.json"
LADO = 72


def _baixar(chave):
    url = f"https://http2.mlstatic.com/D_{chave}-E.jpg"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (izzatcar-site)"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read()


def analisar(dados):
    """Devolve {'limpa': bool, 'objetos': n, 'area': fracao do maior objeto}."""
    from PIL import Image
    im = Image.open(io.BytesIO(dados)).convert("RGB")
    im.thumbnail((LADO, LADO))
    w, h = im.size
    px = im.load()
    borda = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + \
            [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    borda.sort(key=sum)
    fundo = borda[len(borda) // 2]
    claro = sum(fundo) / 3 > 200
    mask = [[sum(abs(px[x, y][i] - fundo[i]) for i in range(3)) > 60 for x in range(w)] for y in range(h)]
    # erosao (2x): separa objetos que so se tocam por uma sombra ou borda fina
    # (a montagem com o carro encostado na peca virava um objeto so)
    for _ in range(2):
        mask = [[mask[y][x] and all(mask[yy][xx] for yy in (y - 1, y, y + 1) for xx in (x - 1, x, x + 1)
                                    if 0 <= yy < h and 0 <= xx < w) for x in range(w)] for y in range(h)]
    visto = [[False] * w for _ in range(h)]
    comps = []   # (tamanho, x0, y0, x1, y1)
    for y in range(h):
        for x in range(w):
            if mask[y][x] and not visto[y][x]:
                n, fila = 0, deque([(x, y)])
                x0 = x1 = x
                y0 = y1 = y
                visto[y][x] = True
                while fila:
                    cx, cy = fila.popleft()
                    n += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1),
                                   (cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)):
                        if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not visto[ny][nx]:
                            visto[ny][nx] = True
                            fila.append((nx, ny))
                comps.append((n, x0, y0, x1, y1))
    area = w * h
    comps.sort(reverse=True)
    tamanhos = [c[0] for c in comps]
    grandes = [t for t in tamanhos if t > area * 0.02]
    maior = tamanhos[0] / area if tamanhos else 0
    total = sum(tamanhos) or 1
    # "satelite": pedaco fora da caixa da peca (janelas/rodas de um carro branco colado)
    satelite = False
    if comps:
        _, mx0, my0, mx1, my1 = comps[0]
        for n, x0, y0, x1, y1 in comps[1:]:
            fora = x1 < mx0 - 1 or x0 > mx1 + 1 or y1 < my0 - 1 or y0 > my1 + 1
            if fora and n > area * 0.005:
                satelite = True
                break
    # carro colorido colado num canto de cima (vermelho/azul/cinza-escuro de carroceria)
    import colorsys
    canto = 0
    cw, ch = int(w * 0.42), int(h * 0.42)
    for (ax, ay) in ((0, 0), (w - cw, 0)):
        sat = 0
        for yy in range(ay, ay + ch):
            for xx in range(ax, ax + cw):
                r_, g_, b_ = px[xx, yy]
                _, s_, v_ = colorsys.rgb_to_hsv(r_ / 255, g_ / 255, b_ / 255)
                if s_ > 0.45 and v_ > 0.25:
                    sat += 1
        canto = max(canto, sat / (cw * ch))
    carro_no_canto = canto > 0.06 and maior < 0.6
    limpa = (claro and len(grandes) == 1 and not satelite and not carro_no_canto
             and tamanhos[0] / total > 0.85 and 0.03 < maior < 0.8)
    return {"limpa": bool(limpa), "objetos": len(grandes), "area": round(maior, 3)}


def carregar_cache():
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def ordenar_fotos(pecas, max_por_peca=6, threads=24):
    """Reordena p['fotos'] de cada peca com a 1a foto limpa na frente.
    pecas: lista de dicts com 'fotos' (chaves do ML). Atualiza o cache."""
    try:
        import PIL  # noqa: F401
    except Exception:
        print("fotos limpas: Pillow ausente, ordem original mantida")
        return
    cache = carregar_cache()

    def um(k):
        try:
            return k, analisar(_baixar(k))
        except Exception:
            return k, None

    # Rodadas: 1a foto de todas; a 2a so de quem nao tem a 1a limpa; e assim por diante.
    novas = 0
    for i in range(max_por_peca):
        faltam = []
        for p in pecas:
            fs = [k for k in p["fotos"][:max_por_peca] if k and not k.startswith("http")]
            if i >= len(fs) or any(cache.get(k, {}).get("limpa") for k in fs[:i]):
                continue
            if fs[i] not in cache:
                faltam.append(fs[i])
        faltam = list(dict.fromkeys(faltam))
        if not faltam:
            continue
        print(f"fotos limpas: rodada {i + 1}, analisando {len(faltam)} fotos...")
        with cf.ThreadPoolExecutor(max_workers=threads) as ex:
            for k, r in ex.map(um, faltam):
                if r:
                    cache[k] = r
                    novas += 1
    if novas:
        CACHE.write_text(json.dumps(cache, separators=(",", ":")), encoding="utf-8")

    trocadas = 0
    for p in pecas:
        fotos = p["fotos"]
        for i, k in enumerate(fotos[:max_por_peca]):
            if cache.get(k, {}).get("limpa"):
                if i > 0:
                    p["fotos"] = [k] + fotos[:i] + fotos[i + 1:]
                    trocadas += 1
                break
        p["limpa"] = bool(cache.get(p["fotos"][0], {}).get("limpa")) if p["fotos"] else False
    print(f"fotos limpas: capa trocada em {trocadas} pecas; "
          f"{sum(1 for p in pecas if p['limpa'])}/{len(pecas)} com capa limpa")


def limpas(chaves, threads=16):
    """Analisa (com cache) uma lista de fotos e devolve as que sao limpas."""
    try:
        import PIL  # noqa: F401
    except Exception:
        return []
    cache = carregar_cache()
    faltam = [k for k in dict.fromkeys(chaves) if k and not k.startswith("http") and k not in cache]

    def um(k):
        try:
            return k, analisar(_baixar(k))
        except Exception:
            return k, None

    if faltam:
        with cf.ThreadPoolExecutor(max_workers=threads) as ex:
            for k, r in ex.map(um, faltam):
                if r:
                    cache[k] = r
        CACHE.write_text(json.dumps(cache, separators=(",", ":")), encoding="utf-8")
    return [k for k in chaves if cache.get(k, {}).get("limpa")]
