"""Ajustes manuais das capas de estúdio (capas_ajustes.json). Rodar:  python testes/test_capas_ajustes.py

Sem rede e sem o recorte do Mac: as fotos são sintéticas (quadrados de cor sobre branco), o recorte é um
limiar simples e o classificador de carro é desligado. Tudo roda em pasta temporária (nunca no site/).
"""
import io
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import capas_estudio as ce  # noqa: E402

# foto sintética de cada chave: (cor da peça, caixas da peça em frações)
# as peças são ELIPSES (peça de verdade não acaba numa reta exata; reta + fundo liso = foto cortada pelo vendedor)
FOTOS = {
    "f-azul": ((30, 60, 200), [(0.30, 0.30, 0.70, 0.70)]),
    "f-vermelha": ((210, 30, 30), [(0.25, 0.20, 0.75, 0.60)]),
    "f-verde": ((30, 170, 60), [(0.30, 0.30, 0.70, 0.70)]),
    "f-dupla": ((30, 170, 60), [(0.10, 0.30, 0.40, 0.70), (0.60, 0.30, 0.90, 0.70)]),   # 2 pedaços: vai p/ revisar
    # peça CORTADA: o vendedor cortou a foto passando pela peça e colou num fundo branco (reta em x = 0,62)
    "f-recortada": ((200, 120, 20), [(0.15, 0.20, 1.05, 0.80)], 0.62),
    # peça CORTADA pela borda da foto (passa da borda direita)
    "f-borda": ((200, 120, 20), [(0.30, 0.25, 1.30, 0.75)]),
    "f-laranja": ((200, 120, 20), [(0.20, 0.25, 0.80, 0.75)]),                        # a mesma peça, inteira
}


def foto_sintetica(chave):
    from PIL import Image, ImageDraw
    cor, caixas, *reta = FOTOS[chave.split("+")[0]]
    im = Image.new("RGB", (600, 400), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in caixas:
        d.ellipse((x0 * 600, y0 * 400, x1 * 600, y1 * 400), fill=cor)
    if reta:                   # corte reto do vendedor: daqui para a direita, só fundo branco
        d.rectangle((reta[0] * 600, 0, 600, 400), fill=(255, 255, 255))
    if "+carro" in chave:      # "carrinho colado" encostado no canto de cima da peça
        d.rectangle((0.60 * 600, 0.05 * 400, 0.95 * 600, 0.32 * 400), fill=(90, 90, 90))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=95)
    return b.getvalue()


def recorte_limiar(img):
    """Recorte de mentira: tudo que não é branco é peça."""
    import numpy as np
    from PIL import Image
    a = np.asarray(img.convert("RGB")).astype(int)
    m = (np.abs(a - 255).sum(2) > 60).astype("uint8") * 255
    out = img.convert("RGBA")
    out.putalpha(Image.fromarray(m))
    return out


def cor_da_capa(arq):
    """Cor média da peça (pixels saturados) na capa gerada."""
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(arq).convert("RGB")).astype(int)
    sat = a.max(2) - a.min(2)
    px = a[sat > 80]
    return tuple(int(v) for v in px.mean(0)) if len(px) else None


def dominante(cor):
    return "rgb"[max(range(3), key=lambda i: cor[i])]


def test_foto_escolhida_pela_chave_e_pelo_indice():
    fotos = ["a", "b", "c"]
    assert ce.foto_escolhida({"chave": "b", "foto": 0}, fotos) == "b"     # chave manda (o índice muda)
    assert ce.foto_escolhida({"chave": "x", "foto": 1}, fotos) is None    # foto saiu: ajuste vencido
    assert ce.foto_escolhida({"foto": 2}, fotos) == "c"                   # sem chave: índice
    assert ce.foto_escolhida({"foto": 5}, fotos) is None
    assert ce.foto_escolhida({"foto": True}, fotos) is None               # bool não é índice
    assert ce.eh_manual({"chave": "a"}) and ce.eh_manual({"foto": 0})
    assert not ce.eh_manual({"sem_capa": True}) and not ce.eh_manual({"ok": True, "chave": "a"})


def test_corte_em_pixels():
    assert ce.caixa_px([0.1, 0.2, 0.9, 1.0], 1000, 500) == (100, 100, 900, 500)
    for ruim in ([0.5, 0.2, 0.4, 1.0], [-0.1, 0, 1, 1], [0, 0, 1.2, 1]):
        try:
            ce.caixa_px(ruim, 100, 100)
        except ValueError:
            continue
        raise AssertionError(f"aceitou corte inválido {ruim}")


def test_assinatura_muda_com_o_ajuste():
    a = ce.assinatura({"chave": "k", "corte": [0, 0, 1, 0.5]})
    assert a == ce.assinatura({"chave": "k", "corte": [0, 0, 1, 0.5], "nota": "texto não conta"})
    assert a != ce.assinatura({"chave": "k", "corte": [0, 0, 1, 0.6]})
    assert a != ce.assinatura({"chave": "k2", "corte": [0, 0, 1, 0.5]})


def test_recorte_manual_corta_e_apaga():
    from PIL import Image
    import numpy as np
    img = Image.open(io.BytesIO(foto_sintetica("f-azul+carro"))).convert("RGB")
    # corte: só a metade de baixo; o carrinho (em cima) sai junto
    foto, rec = ce.recorte_manual(img, {"corte": [0, 0.5, 1, 1]}, recorte_limiar)
    assert foto.size == (600, 200)
    # apagar (retângulo e polígono, em frações da foto INTEIRA): some o carrinho, fica a peça
    for apagar in ([[0.6, 0.0, 1.0, 0.30]], [[[0.6, 0.0], [1.0, 0.0], [1.0, 0.30], [0.6, 0.30]]]):
        foto, rec = ce.recorte_manual(img, {"apagar": apagar}, recorte_limiar)
        a = np.asarray(rec.split()[3])
        assert a[int(0.15 * 400), int(0.80 * 600)] == 0          # onde era o carrinho
        assert a[int(0.50 * 400), int(0.50 * 600)] == 255        # a peça continua


def _ambiente(tmp, pecas=None, ajustes=None):
    """Catálogo de mentira e o módulo apontando para a pasta temporária."""
    pecas = pecas or [
        {"id": "MLB1", "fotos": ["f-azul", "f-vermelha", "f-verde"], "limpa": True},   # ajuste: foto 1 (vermelha)
        {"id": "MLB2", "fotos": ["f-azul", "f-verde"], "limpa": True},                 # sem_capa
        {"id": "MLB3", "fotos": ["f-dupla", "f-azul"], "limpa": True},                 # ok (conferida)
        {"id": "MLB4", "fotos": ["f-azul", "f-verde"], "limpa": True},                 # ajuste vencido (foto saiu)
        {"id": "MLB5", "fotos": ["f-dupla"], "limpa": True},                           # sem ajuste: vai p/ revisar
    ]
    (tmp / "site" / "src" / "data").mkdir(parents=True)
    (tmp / "site" / "public" / "dados").mkdir(parents=True)
    (tmp / "site" / "public" / "estudio-pro").mkdir(parents=True)
    ce.PECAS = tmp / "site" / "src" / "data" / "pecas.json"
    ce.PECAS.write_text(json.dumps(pecas), encoding="utf-8")
    (tmp / "site" / "public" / "dados" / "busca.json").write_text(
        json.dumps({"id": [p["id"] for p in pecas]}), encoding="utf-8")
    ce.ROOT = tmp
    ce.SAIDA = tmp / "estudio"
    ce.FALHAS = ce.SAIDA / "_falhas.json"
    ce.REVISAR = ce.SAIDA / "_revisar.json"
    ce.SAIDA_LIMPA = ""
    ce.AJUSTES = tmp / "capas_ajustes.json"
    ce.VERSAO = "2"
    ce.LOGO_OPCAO = "0"            # sem logo: a cor da capa é só a da peça
    ce.prob_carro = lambda img: 0.0
    ce.etiqueta_de_texto = lambda original, recorte: False
    ce.baixar = lambda chave, tam="F": (ce._baixadas.append(chave), foto_sintetica(chave))[1]
    ce._baixadas = []
    ce.SAIDA.mkdir()
    (ce.SAIDA / "MLB2.webp").write_bytes(b"capa velha")       # a capa antiga da peça 'sem_capa'
    ajustes = ajustes if ajustes is not None else {
        "_leia": "comentário",
        "MLB1": {"chave": "f-vermelha", "foto": 1, "corte": [0.0, 0.0, 1.0, 0.8]},
        "MLB2": {"sem_capa": True},
        "MLB3": {"ok": True, "chave": "f-dupla", "foto": 0},
        "MLB4": {"chave": "foto-que-saiu", "foto": 1},
    }
    ce.AJUSTES.write_text(json.dumps(ajustes), encoding="utf-8")
    return ajustes


def test_robo_respeita_os_ajustes():
    os.environ.pop("ESTUDIO_REFAZER", None)
    os.environ.pop("ESTUDIO_IDS", None)
    os.environ.pop("ESTUDIO_FATIA", None)
    os.environ["ESTUDIO_SAIDA"] = "teste"          # não chama marcar() no fim do main
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        ajustes = _ambiente(tmp)
        ce.main(recortar=recorte_limiar)
        s = ce.SAIDA
        # MLB1: a foto escolhida a mão (vermelha), não a 1a limpa (azul)
        assert dominante(cor_da_capa(s / "MLB1.webp")) == "r"
        # MLB2: sem capa — a velha foi apagada e nenhuma nova foi gerada
        assert not (s / "MLB2.webp").exists()
        # MLB3: automática (2 pedaços) mas conferida: fora do _revisar; MLB5 (igual, sem ajuste) entra
        # MLB4: a foto do ajuste saiu do anúncio -> automático (azul)
        assert dominante(cor_da_capa(s / "MLB3.webp")) == "g"
        assert dominante(cor_da_capa(s / "MLB4.webp")) == "b"
        aplicados = ce.ler_aplicados()
        assert aplicados == {"MLB1": ce.assinatura(ajustes["MLB1"], "f-vermelha")}
        revisar = json.loads(ce.REVISAR.read_text(encoding="utf-8"))
        assert "MLB5" in revisar and "MLB1" not in revisar and "MLB3" not in revisar, revisar

        # 2a rodada sem mudança: nada é refeito
        ce._baixadas.clear()
        ce.main(recortar=recorte_limiar)
        assert ce._baixadas == [], ce._baixadas

        # ajuste mudado (outro corte): só a MLB1 é refeita, mesmo com a capa já pronta
        ajustes["MLB1"]["corte"] = [0.0, 0.1, 1.0, 0.9]
        ce.AJUSTES.write_text(json.dumps(ajustes), encoding="utf-8")
        ce._baixadas.clear()
        ce.main(recortar=recorte_limiar)
        assert ce._baixadas == ["f-vermelha"], ce._baixadas
        assert ce.ler_aplicados()["MLB1"] == ce.assinatura(ajustes["MLB1"], "f-vermelha")

        # marcar(): a peça 'sem_capa' fica com e=0 mesmo se a capa reaparecer na pasta (ramo antigo)
        (s / "MLB2.webp").write_bytes(b"capa velha de novo")
        ce.marcar()
        assert not (s / "MLB2.webp").exists()
        b = json.loads((tmp / "site" / "public" / "dados" / "busca.json").read_text(encoding="utf-8"))
        assert b["e"] == "10111", b["e"]
    os.environ.pop("ESTUDIO_SAIDA", None)


def caixa_da_peca(arq):
    """Caixa da peça colorida na capa (o estúdio é cinza): (x0, y0, x1, y1) em frações do quadro."""
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(arq).convert("RGB")).astype(int)
    ys, xs = np.nonzero((a.max(2) - a.min(2)) > 80)
    L = a.shape[1]
    return xs.min() / L, ys.min() / L, (xs.max() + 1) / L, (ys.max() + 1) / L


def test_detector_de_peca_cortada():
    """Cortada = encosta na borda da foto OU acaba numa reta exata com fundo liso (corte do vendedor)."""
    import numpy as np
    from PIL import Image

    def cortes(chave):
        img = Image.open(io.BytesIO(foto_sintetica(chave))).convert("RGB")
        return ce.cortes_na_foto(recorte_limiar(img).split()[3], img)
    assert cortes("f-laranja") == {} and cortes("f-azul") == {} and cortes("f-vermelha") == {}
    c = cortes("f-recortada")
    assert set(c) == {"dir"} and c["dir"] > 0.8, c            # a reta do vendedor, no meio da foto
    c = cortes("f-borda")
    assert c.get("dir", 0) > 0.5, c                            # passa da borda da foto
    # foto de bancada (fundo com textura): a reta não conta, só a borda da foto
    img = Image.open(io.BytesIO(foto_sintetica("f-recortada"))).convert("RGB")
    ruido = np.random.default_rng(1).integers(-12, 12, (400, 600, 3))
    fundo = np.clip(np.asarray(img).astype(int) + ruido * (np.asarray(img).min(2, keepdims=True) > 240), 0, 255)
    img2 = Image.fromarray(fundo.astype("uint8"))
    assert ce.cortes_na_foto(recorte_limiar(img).split()[3], img2) == {}
    assert ce.peso_do_corte({}) == 0 and ce.peso_do_corte({"dir": 0.4, "topo": 0.7}) == 0.7


def test_capa_nunca_toca_a_borda():
    """Peça cortada na foto: o robô pega uma foto em que ela aparece inteira (até depois das 6 primeiras); se nenhuma
    serve, a capa sai MENOR que a normal, com margem >= 8% dos lados e o piso comum, e entra no _revisar.json como
    "cortada na capa". Nenhuma capa encosta na borda. A foto conferida (ok) nunca é trocada."""
    os.environ.pop("ESTUDIO_REFAZER", None)
    os.environ.pop("ESTUDIO_IDS", None)
    os.environ.pop("ESTUDIO_FATIA", None)
    os.environ["ESTUDIO_SAIDA"] = "teste"
    sete = ["f-borda+1", "f-recortada+2", "f-borda+3", "f-borda+4", "f-recortada+5", "f-borda+6", "f-laranja+7"]
    pecas = [
        {"id": "MLB10", "fotos": ["f-recortada", "f-laranja"], "limpa": True},   # troca pela foto inteira
        {"id": "MLB11", "fotos": ["f-recortada"], "limpa": True},                # nenhuma inteira: menor, com margem
        {"id": "MLB12", "fotos": sete, "limpa": True},                           # a inteira é a 7ª foto
        {"id": "MLB13", "fotos": ["f-recortada", "f-laranja"], "limpa": True},   # conferida a olho: fica a dela
        {"id": "MLB14", "fotos": ["f-laranja"], "limpa": True},                  # normal
    ]
    ajustes = {"MLB13": {"ok": True, "chave": "f-recortada", "foto": 0}}
    with tempfile.TemporaryDirectory() as d:
        _ambiente(Path(d), pecas, ajustes)
        ce.main(recortar=recorte_limiar)
        s = ce.SAIDA
        revisar = json.loads(ce.REVISAR.read_text(encoding="utf-8"))
        cx = {m: caixa_da_peca(s / f"{m}.webp") for m in ("MLB10", "MLB11", "MLB12", "MLB13", "MLB14")}
        prop = {m: (c[2] - c[0]) / (c[3] - c[1]) for m, c in cx.items()}
        for m, (x0, y0, x1, y1) in cx.items():            # nenhuma capa encosta na borda
            assert min(x0, 1 - x1) >= 0.07 - 0.005 and min(y0, 1 - y1) >= ce.BORDA_CAPA, (m, cx[m])
            assert abs(y1 - ce.REGRA["PISO"]) < 0.01, (m, cx[m])                       # piso comum
        inteira, cortada = prop["MLB14"], prop["MLB11"]
        assert inteira > 1.5 and cortada < 1.3, prop
        assert abs(prop["MLB10"] - inteira) < 0.1 and "MLB10" not in revisar       # trocou pela foto inteira
        assert abs(prop["MLB12"] - inteira) < 0.1 and "MLB12" not in revisar       # achou a 7ª foto
        assert "f-laranja+7" in ce._baixadas
        x0, y0, x1, y1 = cx["MLB11"]
        assert min(x0, 1 - x1) >= ce.MARGEM_CORTADA, cx["MLB11"]                  # margem larga dos lados
        assert (x1 - x0) * 1000 <= (0.62 - 0.15) * 600 * ce.REGRA_CORTADA["UP"] + 4, cx["MLB11"]   # ampliou pouco
        assert (x1 - x0) < cx["MLB14"][2] - cx["MLB14"][0] or (y1 - y0) < cx["MLB14"][3] - cx["MLB14"][1]  # menor
        assert any("cortada na capa" in m for m in revisar["MLB11"]["motivos"]), revisar
        assert abs(prop["MLB13"] - cortada) < 0.1 and "MLB13" not in revisar       # conferida: não troca
        assert "MLB14" not in revisar
    os.environ.pop("ESTUDIO_SAIDA", None)


def test_capas_ajustes_do_repositorio():
    """O capas_ajustes.json versionado é válido: chave existe no anúncio (quando há catálogo), corte/apagar ok."""
    arq = ROOT / "capas_ajustes.json"
    if not arq.exists():
        return
    dados = json.loads(arq.read_text(encoding="utf-8"))
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    fotos = {x["id"]: x.get("fotos") or [] for x in json.loads(pecas.read_text(encoding="utf-8"))} if pecas.exists() else {}
    for mlb, aj in dados.items():
        if mlb.startswith("_"):
            continue
        assert mlb.startswith("MLB") and isinstance(aj, dict), mlb
        tipos = [bool(aj.get("sem_capa")), bool(aj.get("ok")), ce.eh_manual(aj)]
        assert sum(tipos) == 1, (mlb, aj)
        if aj.get("corte"):
            ce.caixa_px(aj["corte"], 1000, 1000)
        for r in aj.get("apagar") or []:
            if isinstance(r[0], (list, tuple)):
                assert len(r) >= 3 and all(0 <= v <= 1 for p in r for v in p), (mlb, r)
            else:
                ce.caixa_px(r, 1000, 1000)
        if mlb in fotos and aj.get("chave") and aj.get("foto") is not None:
            # o índice é só para o olho humano; se a ordem mudou, só avisa (a chave manda)
            if aj["chave"] not in fotos[mlb]:
                print(f"AVISO: {mlb}: a foto do ajuste saiu do anúncio (o robô volta ao automático)")


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
