"""
IZZAT CAR — logo e enquadramento v2 nas capas MAQUIADAS (ChatGPT) de site/public/estudio-pro.

NÃO mexe nas originais: grava numa pasta de saída (padrão ~/.cache/izzatcar-capas-pro/v2/<logo>/).
Fonte de cada capa: o PNG do ChatGPT (sem perda, 1254 px) em ~/.cache/izzatcar-capas-pro/chatgpt/<MLB>.png;
sem ele, a própria capa instalada em site/public/estudio-pro (800 px).

Como (rota 2, padrão — a peça e a sombra do ChatGPT intactas, só reenquadradas):
  1. ganho global igual ao do capas_pro.instalar (fundo no tom do estúdio; mesma cor da capa aprovada);
  2. recorte nativo (Vision) para MEDIR e separar a peça;
  3. a sombra/reflexo do ChatGPT vira um mapa (foto ÷ fundo estimado) e vai junto com a peça;
  4. peça + sombra são reenquadradas pela MESMA regra da v2 (capas_estudio.enquadrar) sobre o MESMO
     fundo de estúdio das capas automáticas;
  5. logo (mesma opção da v2: a | b | c | 0).
  Os pixels da peça são os do ChatGPT (só mudam de escala); nada é redesenhado.
Rota 1 (--rota 1, para comparar): move/escala o quadro inteiro do ChatGPT e estende o fundo dele.

Uso (Mac; precisa de ~/.local/bin/recorta-fundo):
  python ferramentas/marca_pro.py [--saida PASTA] [--logo a|b|c|0] [--limpa] [--rota 1|2] [MLB ...]
  --limpa  grava também a versão SEM logo (pasta <saida>/limpa) para o Google Shopping.
"""

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import capas_estudio as ce  # noqa: E402

PRO = ROOT / "site" / "public" / "estudio-pro"
TRAB = Path(os.getenv("CAPAS_PRO_TRAB", str(Path.home() / ".cache" / "izzatcar-capas-pro")))
FUNDO_ALVO = (238, 237, 234)   # o mesmo do capas_pro.instalar


def fonte(mlb):
    """(imagem RGB, de onde veio). PNG do ChatGPT quando existe (sem perda); senão a capa instalada."""
    from PIL import Image
    png = TRAB / "chatgpt" / f"{mlb}.png"
    if png.exists():
        im = Image.open(png).convert("RGB")
        w, h = im.size
        lado = min(w, h)   # o instalar recorta o quadrado do meio: mesma coisa aqui
        im = im.crop(((w - lado) // 2, (h - lado) // 2, (w - lado) // 2 + lado, (h - lado) // 2 + lado))
        return im, "png"
    return Image.open(PRO / f"{mlb}.webp").convert("RGB"), "webp"


def ganho_estudio(im):
    """Ganho global (igual na foto toda) que leva o fundo do ChatGPT ao tom do estúdio — o mesmo do instalar."""
    import numpy as np
    from PIL import Image
    a = np.asarray(im, float)
    b = max(8, round(a.shape[0] * 0.05))
    borda = np.concatenate([a[:b].reshape(-1, 3), a[:, :b].reshape(-1, 3), a[:, -b:].reshape(-1, 3)])
    fundo = np.median(borda, axis=0)
    g = np.clip(np.array(FUNDO_ALVO) / np.maximum(fundo, 1), 0.92, 1.10)
    return Image.fromarray(np.clip(a * g[None, None, :], 0, 255).astype("uint8"))


def _poli(X, Y):
    import numpy as np
    return np.stack([np.ones_like(X), X, Y, X * X, X * Y, Y * Y, X ** 3, Y ** 3, X * X * Y, X * Y * Y], -1)


def fundo_estimado(a, livre):
    """Superfície suave (polinômio de grau 3 por canal) ajustada ao fundo livre; tira as sombras em 3 voltas."""
    import numpy as np
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    X, Y = xx / W - 0.5, yy / H - 0.5
    M = _poli(X, Y)
    usar = livre.copy()
    coef = None
    for _ in range(3):
        idx = np.flatnonzero(usar.ravel())
        if len(idx) > 60000:
            idx = idx[:: len(idx) // 60000 + 1]
        A = M.reshape(-1, M.shape[-1])[idx]
        coef = np.linalg.lstsq(A, a.reshape(-1, 3)[idx], rcond=None)[0]
        B = (M.reshape(-1, M.shape[-1]) @ coef).reshape(H, W, 3)
        res = a.mean(2) - B.mean(2)
        usar = livre & (res > -2.5)        # mais escuro que o fundo = sombra: fora do ajuste
    return B, coef


def capa_v2(mlb, logo="a", rota=2):
    """Devolve (capa_com_logo, capa_sem_logo, info)."""
    import numpy as np
    from PIL import Image, ImageFilter
    from scipy import ndimage
    im, origem = fonte(mlb)
    im = ganho_estudio(im)
    W, H = im.size
    rec = ce.recortar_vision(im)
    rec, _ = ce.limpar_mascara(rec, checar_cantos=False)
    if rec is None:
        raise RuntimeError("recorte vazio")
    alfa = np.asarray(rec.split()[3], float) / 255
    caixa = rec.split()[3].point(lambda v: 255 if v > 24 else 0).getbbox()
    x0, y0, x1, y1 = caixa
    med = ce.medir(alfa[y0:y1, x0:x1])
    L = ce.LADO_V2
    s, x, y, nw, nh = ce.enquadrar(x1 - x0, y1 - y0, med, L)
    ox, oy = x - x0 * s, y - y0 * s           # deslocamento do quadro do ChatGPT no quadro novo
    a = np.asarray(im, float)
    perto = ndimage.binary_dilation(alfa > 0.02, iterations=max(4, round(0.03 * W)))
    B, coef = fundo_estimado(a, ~perto)
    info = dict(id=mlb, fonte=origem, escala=round(s, 3), x=x, y=y, w=nw, h=nh, rota=rota)

    if rota == 1:
        # quadro inteiro escalado + fundo do ChatGPT estendido pelo polinômio (fora do quadro original)
        Ws, Hs = max(1, round(W * s)), max(1, round(H * s))
        esc = im.resize((Ws, Hs), Image.LANCZOS)
        yy, xx = np.mgrid[0:L, 0:L]
        U, V = (xx - ox) / s / W - 0.5, (yy - oy) / s / H - 0.5
        ext = (_poli(U, V).reshape(-1, coef.shape[0]) @ coef).reshape(L, L, 3)
        tela = Image.fromarray(np.clip(ext, 0, 255).astype("uint8"))
        m = Image.new("L", (Ws, Hs), 0)
        pad = max(6, round(0.02 * Ws))
        m.paste(255, (pad, pad, Ws - pad, Hs - pad))
        m = m.filter(ImageFilter.GaussianBlur(pad / 2))
        tela.paste(esc, (round(ox), round(oy)), m)
        limpa = tela
    else:
        # mapa de sombra = foto / fundo (só fora da peça), completado por baixo da peça por difusão
        lum = a.mean(2)
        S = np.clip(lum / np.maximum(B.mean(2), 1), 0, 1.0)
        fora = alfa < 0.05
        peso = fora.astype(float)
        num = ndimage.gaussian_filter(S * peso, 6)
        den = ndimage.gaussian_filter(peso, 6)
        S = np.where(fora, S, num / np.maximum(den, 1e-3))
        S = ndimage.gaussian_filter(S, 1.0)
        S = 1 - np.maximum(0, (1 - S) - 0.012)       # tira o "grão" do fundo (< 1,2%): só sombra de verdade
        Ws, Hs = max(1, round(W * s)), max(1, round(H * s))
        Sm = Image.fromarray(np.clip(S * 255, 0, 255).astype("uint8")).resize((Ws, Hs), Image.BILINEAR)
        mapa = Image.new("L", (L, L), 255)
        mapa.paste(Sm, (round(ox), round(oy)))
        fundo = np.asarray(ce._fundo_v2(L), float) * (np.asarray(mapa, float) / 255)[..., None]
        tela = Image.fromarray(np.clip(fundo, 0, 255).astype("uint8")).convert("RGBA")
        peca = rec.crop(caixa).resize((nw, nh), Image.LANCZOS)
        tela.alpha_composite(peca, (x, y))
        limpa = tela.convert("RGB")
    return ce.com_logo(limpa, logo), limpa, info


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="MLBs (padrão: todas de site/public/estudio-pro)")
    ap.add_argument("--saida", default=str(TRAB / "v2"))
    ap.add_argument("--logo", default=ce.LOGO_OPCAO, choices=["a", "b", "c", "0"])
    ap.add_argument("--rota", type=int, default=2, choices=[1, 2])
    ap.add_argument("--limpa", action="store_true", help="grava também a versão sem logo (Google Shopping)")
    args = ap.parse_args()
    saida = Path(args.saida).expanduser().resolve()
    if saida == PRO.resolve():
        raise SystemExit("a saída não pode ser a pasta das originais (site/public/estudio-pro)")
    ids = args.ids or sorted(p.stem for p in PRO.glob("*.webp"))
    pasta = saida / args.logo
    pasta.mkdir(parents=True, exist_ok=True)
    if args.limpa:
        (saida / "limpa").mkdir(parents=True, exist_ok=True)
    for i in ids:
        try:
            com, sem, info = capa_v2(i, args.logo, args.rota)
        except Exception as e:  # noqa: BLE001
            print(f"  {i}  FALHOU: {e}")
            continue
        com.save(pasta / f"{i}.webp", quality=ce.QUALIDADE_V2, method=6)
        if args.limpa:
            sem.save(saida / "limpa" / f"{i}.webp", quality=ce.QUALIDADE_V2, method=6)
        print(f"  {i}  fonte {info['fonte']}  escala {info['escala']}  -> {pasta / (i + '.webp')}")
    print(f"pronto: {len(ids)} capas em {pasta}")


if __name__ == "__main__":
    main()
