"""
IZZAT CAR — capas MAQUIADAS (ChatGPT) das peças em destaque, com conferência de fidelidade.

A capa automática (capas_estudio.py) vale para todas as peças. Para as peças que mais aparecem
(home, mais vendidas, mais caras) a foto real é maquiada no ChatGPT — SEM mudar nada da peça —
e só entra no site depois de passar pela conferência automática + olho humano.

Fila e situação de cada peça: capas_pro.json (no repositório).
Fotos de trabalho (original e resultado do ChatGPT): ~/.cache/izzatcar-capas-pro/{orig,chatgpt,qa}/
Saída aprovada: site/public/estudio-pro/<MLB>.webp (o site prefere esta à capa automática).

Uso (Mac; precisa de ~/.local/bin/recorta-fundo e ~/.local/bin/izzat-ocr — ver ferramentas/ocr.swift):
  python ferramentas/capas_pro.py lista [N]        monta/atualiza a fila (padrão 300 peças)
  python ferramentas/capas_pro.py preparar [N]     baixa a melhor foto das próximas N peças da fila
  python ferramentas/capas_pro.py conferir <MLB>   compara original × ChatGPT; imprime o veredito
  python ferramentas/capas_pro.py instalar <MLB>   grava a capa aprovada em site/public/estudio-pro
  python ferramentas/capas_pro.py reprovar <MLB> "motivo"
  python ferramentas/capas_pro.py status

Regras da conferência (reprova = não entra):
  - silhueta: recorta a peça nas duas fotos; formato (proporção da caixa) e sobreposição (IoU) têm que bater;
  - texto: todo CÓDIGO impresso (sequência com número, ex. 13.601_11212A) lido na original tem que estar
    IGUAL na maquiada; código parecido mas diferente = reprovada (o ChatGPT "reescreveu" a etiqueta);
  - texto novo que a original não mostra = "conferir" (pode ser só a original borrada): olho humano decide.
"""

import io
import json
import os
import re
import subprocess
import sys
import tempfile
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import capas_estudio as ce  # noqa: E402

FILA = ROOT / "capas_pro.json"
SAIDA = ROOT / "site" / "public" / "estudio-pro"
TRAB = Path(os.getenv("CAPAS_PRO_TRAB", str(Path.home() / ".cache" / "izzatcar-capas-pro")))
OCR = os.path.expanduser("~/.local/bin/izzat-ocr")
LADO = 800
FUNDO_ALVO = (238, 237, 234)   # tom do estúdio das capas automáticas (meio do degradê)


def ler_fila():
    return json.loads(FILA.read_text(encoding="utf-8")) if FILA.exists() else {}


def gravar_fila(f):
    FILA.write_text(json.dumps(f, ensure_ascii=False, indent=1), encoding="utf-8")


# ---------------- fila ----------------
def lista(n=300):
    pecas = {x["id"]: x for x in json.loads((ROOT / "site/src/data/pecas.json").read_text(encoding="utf-8"))}
    resumo = json.loads((ROOT / "site/src/data/resumo.json").read_text(encoding="utf-8"))
    vendidas = {}
    prod = ROOT / "products.json"
    if prod.exists():
        for x in json.loads(prod.read_text(encoding="utf-8"))["products"]:
            vendidas[x["id"]] = x.get("sold") or 0
    ordem = []
    ordem += [i for i in resumo.get("chegou", [])[:20]]                          # vitrine da home
    ordem += sorted(pecas, key=lambda i: -vendidas.get(i, 0))[:n]                # mais vendidas
    ordem += sorted(pecas, key=lambda i: -pecas[i].get("p", 0))[:n]              # mais caras
    fila = ler_fila()
    vistos = set()
    for i in ordem:
        if i in vistos or i not in pecas or not pecas[i].get("fotos"):
            continue
        vistos.add(i)
        fila.setdefault(i, {"status": "fila", "n": pecas[i]["n"], "carro": f'{pecas[i].get("b", "")} {pecas[i].get("m", "")}'.strip()})
        if len(vistos) >= n:
            break
    gravar_fila(fila)
    print(f"fila: {len(fila)} peças | " + ", ".join(f"{s}: {sum(1 for v in fila.values() if v['status'] == s)}"
                                                      for s in ("fila", "pronta", "ok", "reprovada", "conferir", "pulada")))


def preparar(n=20):
    """Escolhe a foto da peça como a capa automática (1ª foto limpa e INTEIRA no quadro) e baixa em alta."""
    from PIL import Image
    pecas = {x["id"]: x for x in json.loads((ROOT / "site/src/data/pecas.json").read_text(encoding="utf-8"))}
    fila = ler_fila()
    (TRAB / "orig").mkdir(parents=True, exist_ok=True)
    feitos = 0
    for i, v in fila.items():
        if feitos >= n:
            break
        if v["status"] != "fila":
            continue
        x = pecas.get(i)
        if not x:
            continue
        fs = [k for k in (x.get("fotos") or []) if k and not k.startswith("http")]
        cands = fs[:4] if x.get("limpa") else (fs[1:4] + fs[:1])
        escolhida = None
        for k in cands:
            try:
                img = Image.open(io.BytesIO(ce.baixar(k))).convert("RGB")
                peq = img.copy()
                peq.thumbnail((1000, 1000))
                capa, cortada = ce.compor(ce.recortar_vision(peq), original=peq)
                if capa is not None and not cortada:
                    escolhida = (k, img)
                    break
            except Exception:
                continue
        if not escolhida:
            v["status"], v["motivo"] = "reprovada", "nenhuma foto com a peça inteira e limpa"
            continue
        k, img = escolhida
        img.save(TRAB / "orig" / f"{i}.jpg", quality=95)
        if min(img.size) < 600:   # foto pequena: etiqueta/detalhe ilegível, não dá para conferir a maquiada
            v["status"], v["motivo"], v["foto"] = "pulada", f"foto pequena demais para conferir ({img.size[0]}x{img.size[1]})", k
            print(f"  {i}  pulada (foto pequena {img.size[0]}x{img.size[1]})")
            continue
        etq = tem_etiqueta(TRAB / "orig" / f"{i}.jpg")
        if etq:   # não gasta ChatGPT: fica com a capa automática (que já é boa)
            v["status"], v["motivo"], v["foto"] = "pulada", f"etiqueta impressa: {etq}", k
            print(f"  {i}  pulada ({etq})")
            continue
        v["status"], v["foto"] = "pronta", k
        feitos += 1
        print(f"  {i}  {v['n']} · {v['carro']}  <- {k}")
    gravar_fila(fila)
    print(f"preparadas: {feitos}  (originais em {TRAB / 'orig'})")


# ---------------- conferência ----------------
def mascara(caminho):
    from PIL import Image
    im = Image.open(caminho).convert("RGB")
    im.thumbnail((1000, 1000))
    r = ce.recortar_vision(im)
    a = r.split()[3].point(lambda v: 255 if v > 24 else 0)
    return a.crop(a.getbbox()) if a.getbbox() else None


def iou(a, b):
    import numpy as np
    from PIL import Image
    L = 256

    def caixa(m):
        w, h = m.size
        e = L / max(w, h)
        m = m.resize((max(1, round(w * e)), max(1, round(h * e))), Image.BILINEAR)
        t = Image.new("L", (L, L), 0)
        t.paste(m, ((L - m.size[0]) // 2, (L - m.size[1]) // 2))
        return np.asarray(t) > 127
    x, y = caixa(a), caixa(b)
    return float((x & y).sum() / max((x | y).sum(), 1))


def ler_ocr(caminho):
    r = subprocess.run([OCR, str(caminho)], capture_output=True, text=True, timeout=120)
    linha = (r.stdout or "").strip().splitlines()
    return json.loads(linha[0]) if linha else {"t": [], "c": 0}


def textos(caminho):
    return ler_ocr(caminho)["t"]


def tem_etiqueta(caminho):
    """Etiqueta impressa = código de barras/QR ou código longo impresso. O ChatGPT sempre redesenha
    esses textos (reprovou 5 de 8 na 1ª leva), então a peça fica com a capa automática."""
    o = ler_ocr(caminho)
    longos = [c for c in codigos(o["t"]) if len(c) >= 6]
    if o.get("c", 0) > 0:
        return "código de barras/QR na etiqueta"
    if longos:
        return f"código impresso ({', '.join(longos[:3])})"
    return None


def codigos(lidos):
    """Sequências com número (códigos, versões, part numbers), só letras e números, maiúsculas."""
    out = set()
    for s, c in lidos:
        if c < 0.5:
            continue
        for tok in re.split(r"\s+", s):
            t = re.sub(r"[^0-9A-Za-z]", "", tok).upper()
            if len(t) >= 4 and re.search(r"\d", t):
                out.add(t)
    return out


def conferir(i, silencioso=False):
    from PIL import Image, ImageDraw
    orig = TRAB / "orig" / f"{i}.jpg"
    res = TRAB / "chatgpt" / f"{i}.png"
    if not orig.exists() or not res.exists():
        raise SystemExit(f"faltam arquivos: {orig.exists() and 'ok' or orig} | {res.exists() and 'ok' or res}")
    motivos, avisos = [], []
    ma, mb = mascara(orig), mascara(res)
    if ma is None or mb is None:
        motivos.append("não achei a peça numa das fotos")
        sil = 0.0
    else:
        pa, pb = ma.size[0] / ma.size[1], mb.size[0] / mb.size[1]
        dif_prop = abs(pa - pb) / max(pa, pb)
        sil = iou(ma, mb)
        if dif_prop > 0.10:
            motivos.append(f"formato mudou (proporção {pa:.2f} → {pb:.2f})")
        if sil < 0.82:
            motivos.append(f"silhueta diferente (sobreposição {sil:.2f})")
        elif sil < 0.88:
            avisos.append(f"silhueta {sil:.2f}: conferir")
    ca, cb = codigos(textos(orig)), codigos(textos(res))
    for c in sorted(ca):
        if c in cb:
            continue
        parecido = max(cb, key=lambda d: SequenceMatcher(None, c, d).ratio(), default=None)
        if parecido and SequenceMatcher(None, c, parecido).ratio() >= 0.6:
            motivos.append(f"código mudou: {c} → {parecido}")
        else:
            avisos.append(f"código {c} não lido na maquiada: conferir")
    for d in sorted(cb - ca):
        if any(SequenceMatcher(None, c, d).ratio() >= 0.6 for c in ca):
            continue   # já contado acima como "mudou"
        avisos.append(f"texto novo {d}: conferir (pode ser só a original borrada)")
    veredito = "reprovada" if motivos else ("conferir" if avisos else "ok")
    # folha de conferência: original | maquiada (para o olho humano)
    (TRAB / "qa").mkdir(parents=True, exist_ok=True)
    a, b = Image.open(orig).convert("RGB"), Image.open(res).convert("RGB")
    a.thumbnail((900, 900))
    b.thumbnail((900, 900))
    folha = Image.new("RGB", (1820, 940), (255, 255, 255))
    folha.paste(a, (0, 40))
    folha.paste(b, (920, 40))
    ImageDraw.Draw(folha).text((10, 10), f"{i}  ORIGINAL | MAQUIADA  -> {veredito}  {'; '.join(motivos + avisos)[:180]}", fill=(200, 0, 0))
    folha.save(TRAB / "qa" / f"{i}.jpg", quality=88)
    r = {"id": i, "veredito": veredito, "silhueta": round(sil, 3), "motivos": motivos, "avisos": avisos,
         "codigos_original": sorted(ca), "codigos_maquiada": sorted(cb), "folha": str(TRAB / "qa" / f"{i}.jpg")}
    if not silencioso:
        print(json.dumps(r, ensure_ascii=False, indent=1))
    return r


# ---------------- instalar ----------------
def instalar(i):
    """Quadrado 800, e o fundo acertado para o MESMO tom das capas automáticas (ganho global, igual na foto toda)."""
    import numpy as np
    from PIL import Image
    res = TRAB / "chatgpt" / f"{i}.png"
    im = Image.open(res).convert("RGB")
    w, h = im.size
    l = min(w, h)
    im = im.crop(((w - l) // 2, (h - l) // 2, (w - l) // 2 + l, (h - l) // 2 + l)).resize((LADO, LADO), Image.LANCZOS)
    a = np.asarray(im, float)
    borda = np.concatenate([a[:40].reshape(-1, 3), a[:, :40].reshape(-1, 3), a[:, -40:].reshape(-1, 3)])
    fundo = np.median(borda, axis=0)
    ganho = np.clip(np.array(FUNDO_ALVO) / np.maximum(fundo, 1), 0.92, 1.10)
    a = np.clip(a * ganho[None, None, :], 0, 255).astype("uint8")
    SAIDA.mkdir(parents=True, exist_ok=True)
    Image.fromarray(a).save(SAIDA / f"{i}.webp", quality=86, method=6)
    fila = ler_fila()
    fila.setdefault(i, {})
    fila[i]["status"] = "ok"
    fila[i].pop("motivo", None)
    gravar_fila(fila)
    print(f"instalada: site/public/estudio-pro/{i}.webp (fundo {fundo.round()} → ganho {ganho.round(3)})")


def reprovar(i, motivo):
    fila = ler_fila()
    fila.setdefault(i, {})
    fila[i]["status"], fila[i]["motivo"] = "reprovada", motivo
    gravar_fila(fila)
    print(f"reprovada: {i} — {motivo}")


def status():
    fila = ler_fila()
    for s in ("fila", "pronta", "conferir", "ok", "reprovada", "pulada"):
        print(f"{s:10s} {sum(1 for v in fila.values() if v.get('status') == s)}")


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["status"]
    if cmd == "lista":
        lista(int(args[0]) if args else 300)
    elif cmd == "preparar":
        preparar(int(args[0]) if args else 20)
    elif cmd == "conferir":
        conferir(args[0])
    elif cmd == "instalar":
        instalar(args[0])
    elif cmd == "reprovar":
        reprovar(args[0], " ".join(args[1:]) or "reprovada na conferência")
    else:
        status()
