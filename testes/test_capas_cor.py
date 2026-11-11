"""Tom azul da luz nas capas de estúdio (capas_estudio.COR). Rodar:  python testes/test_capas_cor.py

Sem rede: as peças são sintéticas (preto sob luz azul, com textura; detalhes de cor de verdade; cromado) e as fotos do
anúncio são de mentira. Confere: a correção tira o azul da luz sem mexer na luminância nem na textura, não toca cor de
verdade (vermelho, laranja, amarelo, verde, fio azul saturado), cromado não amarela, a peça azul de verdade continua azul,
fora da peça nada muda, a decisão em camadas e o ajuste manual `cor` (com a assinatura).
"""
import io
import json
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import capas_estudio as ce  # noqa: E402

LUMA = np.array(ce.LUMA)


def preto_sob_luz_azul(lado=240, semente=3):
    """Peça 'preta' fotografada sob luz azul: luminância 15–140 com granulado, croma azul que cresce no escuro (como
    nas fotos do vendedor: (13,42,105) a lum 40, (106,114,123) a lum 112). RGBA com fundo transparente."""
    rng = np.random.default_rng(semente)
    yy, xx = np.mgrid[0:lado, 0:lado] / lado
    lum = 15 + 125 * xx + rng.normal(0, 6, (lado, lado))             # degradê + granulado do plástico
    lum[::17, :] -= 18                                               # riscos
    lum = np.clip(lum, 8, 150)
    k = np.clip(1.2 - lum / 120, 0.08, 1.0)                          # quanto mais escuro, mais azul
    croma = np.array(ce._dir_azul()) * 55
    rgb = lum[..., None] + k[..., None] * croma[None, None, :]
    a = ((((xx - 0.5) / 0.46) ** 2 + ((yy - 0.5) / 0.42) ** 2) <= 1).astype(np.uint8) * 255   # elipse: peça inteira
    return Image.fromarray(np.dstack([np.clip(np.rint(rgb), 0, 255), a]).astype(np.uint8), "RGBA")


def br_escuro(img):
    return ce.medir_azul(img)["br"]


def test_neutra_tira_o_azul_e_guarda_luminancia_e_textura():
    p = preto_sob_luz_azul()
    antes = np.asarray(p, float)
    info = {}
    q = ce.corrigir_azul(p, "neutra", info=info)
    depois = np.asarray(q, float)
    assert br_escuro(p) > 30 and abs(br_escuro(q)) < 3, (br_escuro(p), br_escuro(q))
    m = antes[..., 3] > 0
    y0, y1 = antes[..., :3] @ LUMA, depois[..., :3] @ LUMA
    assert np.abs(y1 - y0)[m].max() <= 1.0                           # luminância de cada pixel (só arredondamento)
    assert abs(y1[m].std() - y0[m].std()) < 0.01 * y0[m].std()        # textura (granulado, riscos) igual
    assert (depois[..., 3] == antes[..., 3]).all()                     # alfa intacto (sombra igual)
    assert info["modo"] == "neutra" and info["mudou"] > 0.5


def test_conservadora_tira_so_o_excesso():
    p = preto_sob_luz_azul()
    q = ce.corrigir_azul(p, "conservadora")
    assert abs(br_escuro(q) - ce.COR["ALVO_CONS"]) < 2.5, br_escuro(q)


def test_cor_de_verdade_nao_muda():
    """Lanterna vermelha, conector laranja, fio amarelo, etiqueta verde e um fio AZUL saturado sobre a peça preta
    azulada: os pixels deles ficam idênticos; só o preto muda."""
    p = preto_sob_luz_azul()
    d = ImageDraw.Draw(p)
    cores = {"vermelho": (200, 25, 30), "laranja": (230, 120, 20), "amarelo": (225, 200, 40), "verde": (30, 160, 60),
             "azul_fio": (25, 70, 235)}
    caixas = {}
    for j, (nome, c) in enumerate(cores.items()):
        cx = (20 + 40 * j, 60, 50 + 40 * j, 180)
        d.rectangle(cx, fill=c + (255,))
        caixas[nome] = cx
    q = ce.corrigir_azul(p, "neutra")
    a, b = np.asarray(p, int), np.asarray(q, int)
    for nome, (x0, y0, x1, y1) in caixas.items():
        assert (a[y0:y1, x0:x1] == b[y0:y1, x0:x1]).all(), nome
    assert br_escuro(q) < 0.3 * br_escuro(p)                          # o preto em volta perdeu o azul da luz


def test_cromado_e_claro_nao_amarelam():
    """Cromado/alumínio claro com reflexo azul de leve fica como está; cinza escuro levemente azul vai ao neutro e
    NUNCA passa dele (B−R nunca fica negativo onde era positivo)."""
    lado = 200
    yy, xx = np.mgrid[0:lado, 0:lado] / lado
    lum = 30 + 200 * xx                                               # do escuro ao cromado
    rgb = lum[..., None] + np.array(ce._dir_azul())[None, None, :] * 12
    a = np.full((lado, lado), 255, np.uint8)
    p = Image.fromarray(np.dstack([np.clip(np.rint(rgb), 0, 255), a]).astype(np.uint8), "RGBA")
    q = ce.corrigir_azul(p, "neutra")
    A, B = np.asarray(p, int)[..., :3], np.asarray(q, int)[..., :3]
    br0, br1 = A[..., 2] - A[..., 0], B[..., 2] - B[..., 0]
    claro = (A @ LUMA) >= ce.COR["L1"]
    assert (A[claro] == B[claro]).all()                               # claro/cromado: intacto
    assert (br1 >= -1).all() and (br1 <= br0 + 1).all()               # nunca amarela, nunca fica mais azul


def test_peca_azul_de_verdade_continua_azul():
    """Azul saturado (tinta, plástico azul) é poupado mesmo no modo neutra: não é a luz."""
    p = Image.new("RGBA", (120, 120), (30, 60, 200, 255))
    q = ce.corrigir_azul(p, "neutra")
    assert (np.asarray(p) == np.asarray(q)).all()


def test_decisao_em_camadas():
    azul = {"br": 45.0}
    preto = {"t": "Alavanca Freio Mao Ford", "n": "Alavanca freio de mão", "ficha": [["Cor", "Preto"]]}
    neutra = {"q1": 12.0, "n": 6}
    azul_todas = {"q1": 41.0, "n": 6}
    d = ce.decidir_cor
    assert d({"br": 5.0}, preto)[0] == "nada"                                       # não está azulada
    assert d({"br": None}, preto)[0] == "nada"
    assert d(azul, preto, "manter")[:2] == ("manter", "ajuste manual (cor: manter)")  # o dono manda
    assert d({"br": 5.0}, preto, "neutra")[0] == "neutra"
    assert d(azul, dict(preto, t="Moldura Painel C4 Picasso Azul"))[0:3:2] == ("manter", False)   # trava do título
    assert d(azul, dict(preto, ficha=[["Cor", "Azul-marinho"]]))[0] == "manter"                    # trava da ficha
    assert d(azul, dict(preto, n="Portinhola tanque combustível"))[0:3:2] == ("manter", True)       # lataria pintada
    assert d(azul, dict(preto, n="Dobradiça porta dianteira direita"))[0] == "manter"
    assert d(azul, dict(preto, n="Maçaneta interna dianteira"), None, None, neutra)[0] == "neutra"  # interna: não
    assert d(azul, preto, None, 45.0, neutra)[0:3:2] == ("manter", True)            # azul forte nos claros: tinta
    assert d(azul, preto, None, 25.0, neutra)[0:3:2] == ("conservadora", True)      # azul nos claros: só o excesso
    assert d(azul, preto, None, 5.0, neutra)[0:3:2] == ("neutra", False)            # fotos mostram neutra
    assert d(azul, preto, None, 5.0, azul_todas)[0:3:2] == ("conservadora", True)   # azul em todas: cor a conferir
    assert d(azul, preto, None, 5.0, {"q1": 10.0, "n": 1})[0] == "conservadora"     # 1 foto só não prova
    assert d(azul, preto, None, None, None)[0:3:2] == ("conservadora", True)        # sem fotos para conferir
    assert ce.palavra_azul("Friso Kicks AZUL") and ce.palavra_azul(None, "azul-marinho") and not ce.palavra_azul("Preto")


def test_evidencia_das_outras_fotos():
    """Só fotos de classe "p" (não a da capa, não montagem/marketing), B−R das partes escuras na caixa da peça."""
    def foto(cor_escura):
        im = Image.new("RGB", (400, 300), (245, 245, 245))
        ImageDraw.Draw(im).rectangle((100, 80, 300, 220), fill=cor_escura)
        b = io.BytesIO()
        im.save(b, "JPEG", quality=95)
        return b.getvalue()
    fotos = {"capa": foto((20, 40, 110)), "close1": foto((40, 40, 44)), "close2": foto((38, 39, 45)),
             "close3": foto((30, 45, 90)), "montagem": foto((40, 40, 40)), "sem": foto((40, 40, 40))}
    caixa = [400, 300, 90, 70, 310, 230]
    velho = ce._CAIXAS_ML
    ce._CAIXAS_ML = {"capa": caixa + ["p"], "close1": caixa + ["p"], "close2": caixa + ["p"], "close3": caixa + ["p"],
                     "montagem": caixa + ["c"]}
    try:
        ev = ce.evidencia_cor(list(fotos), "capa", lambda k: fotos[k])
    finally:
        ce._CAIXAS_ML = velho
    assert set(ev["fotos"]) == {"close1", "close2", "close3"}, ev
    assert ev["n"] == 3 and ev["q1"] < 10, ev


def _foto_azulada():
    """Foto de anúncio: peça 'preta' azulada (com granulado) sobre fundo claro levemente azul (luz do vendedor)."""
    p = preto_sob_luz_azul(260)
    im = Image.new("RGB", (600, 400), (232, 236, 244))
    im.paste(p, (170, 70), p)
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def recorte_limiar(img):
    a = np.asarray(img.convert("RGB")).astype(int)
    m = (np.abs(a - np.array([232, 236, 244])).sum(2) > 40).astype("uint8") * 255
    out = img.convert("RGBA")
    out.putalpha(Image.fromarray(m))
    return out


def test_fora_da_peca_nada_muda():
    """A mesma capa com e sem a correção: idênticas em todo pixel fora da peça (fundo, sombra, enquadramento)."""
    original = Image.open(io.BytesIO(_foto_azulada())).convert("RGB")
    rec = recorte_limiar(original)
    velho = ce.prob_carro
    ce.prob_carro = lambda img: 0.0
    try:
        sem, _ = ce.compor_v2(rec, original=original, info={})
        inf = {}
        com, _ = ce.compor_v2(rec, original=original, info=inf,
                              cor=lambda m, g: ("neutra", "teste", False, None))
    finally:
        ce.prob_carro = velho
    a, b = np.asarray(sem, int), np.asarray(com, int)
    x, y, w, h = inf["x"], inf["y"], inf["w"], inf["h"]
    fora = np.ones(a.shape[:2], bool)
    fora[y:y + h, x:x + w] = False
    assert (a[fora] == b[fora]).all()
    assert inf["cor"]["modo"] == "neutra" and inf["cor"]["br"] > 20 and abs(inf["cor"]["br_depois"]) < 4, inf["cor"]
    assert (np.abs(a - b).max(2) > 3).sum() > 1000                    # a peça mudou


def test_ajuste_cor_no_robo():
    """`cor: "neutra"` no capas_ajustes.json: a capa sai neutra, a assinatura vai para _ajustes_aplicados.json e
    mudar para "manter" refaz a capa; o registro vai para _cor.json. Sem ajuste e sem fotos para conferir: só o excesso
    sai e a peça entra no _revisar.json como "cor a conferir"."""
    import test_capas_ajustes as base
    base.FOTOS["f-azulada"] = None
    os.environ.pop("ESTUDIO_REFAZER", None)
    os.environ.pop("ESTUDIO_IDS", None)
    os.environ["ESTUDIO_SAIDA"] = "teste"
    pecas = [{"id": "MLB21", "fotos": ["f-azulada"], "limpa": True, "t": "Alavanca Freio Mao", "n": "Alavanca"},
             {"id": "MLB22", "fotos": ["f-azulada"], "limpa": True, "t": "Alavanca Freio Mao", "n": "Alavanca"}]
    ajustes = {"MLB21": {"cor": "neutra"}}
    try:
        with tempfile.TemporaryDirectory() as d:
            base._ambiente(Path(d), pecas, ajustes)
            ce.baixar = lambda chave, tam="F": (ce._baixadas.append(chave), _foto_azulada())[1]
            ce.main(recortar=recorte_limiar)
            cores = json.loads((ce.SAIDA / "_cor.json").read_text(encoding="utf-8"))
            assert cores["MLB21"]["modo"] == "neutra" and abs(cores["MLB21"]["br_depois"]) < 4, cores
            assert cores["MLB22"]["modo"] == "conservadora" and cores["MLB22"]["conferir"], cores
            revisar = json.loads(ce.REVISAR.read_text(encoding="utf-8"))
            assert "MLB21" not in revisar and any("cor a conferir" in m for m in revisar["MLB22"]["motivos"])
            assert ce.ler_aplicados()["MLB21"] == ce.assinatura(ajustes["MLB21"])
            # rodada sem mudança: nada refeito; ajuste mudado: só a MLB21 refeita
            ce._baixadas.clear()
            ce.main(recortar=recorte_limiar)
            assert ce._baixadas == [], ce._baixadas
            ajustes["MLB21"]["cor"] = "manter"
            ce.AJUSTES.write_text(json.dumps(ajustes), encoding="utf-8")
            ce.main(recortar=recorte_limiar)
            assert ce._baixadas == ["f-azulada"], ce._baixadas
            cores = json.loads((ce.SAIDA / "_cor.json").read_text(encoding="utf-8"))
            assert cores["MLB21"]["modo"] == "manter", cores["MLB21"]
            # ESTUDIO_COR=0 desliga (comparação): a capa sai como antes desta correção
            os.environ["ESTUDIO_COR"] = "0"
            os.environ["ESTUDIO_REFAZER"] = "1"
            (ce.SAIDA / "MLB22.webp").unlink()
            ce.main(recortar=recorte_limiar)
            cap = np.asarray(Image.open(ce.SAIDA / "MLB22.webp").convert("RGB"), float)
            assert ce.medir_azul(cap, (np.abs(cap - np.asarray(ce._fundo_v2(1000), float)).max(2) > 30) * 255)["br"] > 20
    finally:
        os.environ.pop("ESTUDIO_COR", None)
        os.environ.pop("ESTUDIO_REFAZER", None)
        os.environ.pop("ESTUDIO_SAIDA", None)
        base.FOTOS.pop("f-azulada", None)


def test_assinatura_dos_ajustes_antigos_nao_muda():
    """A cor só entra na assinatura quando existe: os ajustes já aplicados no ramo não são refeitos pelo robô."""
    import hashlib

    def antiga(aj, chave=None):   # a fórmula de antes da cor (nov/2026)
        base = {"chave": chave or aj.get("chave"), "foto": None if (chave or aj.get("chave")) else aj.get("foto"),
                "corte": aj.get("corte"), "apagar": aj.get("apagar")}
        return hashlib.sha1(json.dumps(base, sort_keys=True).encode()).hexdigest()[:12]
    exemplos = [{"chave": "k", "corte": [0, 0, 1, 0.5]}, {"foto": 2}, {"chave": "k", "apagar": [[0, 0, 0.5, 0.5]]}]
    arq = ROOT / "capas_ajustes.json"
    if arq.exists():
        exemplos += [a for a in ce.carregar_ajustes(arq).values() if ce.eh_manual(a) and not a.get("cor")]
    for aj in exemplos:
        assert ce.assinatura(aj) == antiga(aj) and ce.assinatura(aj, "x") == antiga(aj, "x"), aj
    aj = {"chave": "k"}
    assert ce.assinatura(aj) != ce.assinatura(dict(aj, cor="neutra")) != ce.assinatura(dict(aj, cor="manter"))


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
