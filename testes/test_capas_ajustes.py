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
FOTOS = {
    "f-azul": ((30, 60, 200), [(0.30, 0.30, 0.70, 0.70)]),
    "f-vermelha": ((210, 30, 30), [(0.25, 0.20, 0.75, 0.60)]),
    "f-verde": ((30, 170, 60), [(0.30, 0.30, 0.70, 0.70)]),
    "f-dupla": ((30, 170, 60), [(0.10, 0.30, 0.40, 0.70), (0.60, 0.30, 0.90, 0.70)]),   # 2 pedaços: vai p/ revisar
}


def foto_sintetica(chave):
    from PIL import Image, ImageDraw
    cor, caixas = FOTOS[chave.split("+")[0]]
    im = Image.new("RGB", (600, 400), (255, 255, 255))
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in caixas:
        d.rectangle((x0 * 600, y0 * 400, x1 * 600, y1 * 400), fill=cor)
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


def _ambiente(tmp):
    """Catálogo de mentira e o módulo apontando para a pasta temporária."""
    pecas = [
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
    ajustes = {
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
