"""Casos reais que a leitura antiga errava. Rodar:  python testes/test_dados.py"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from preparar_dados import marca_do_titulo, chave_foto  # noqa: E402
from gerar_paginas_individuais import slugify  # noqa: E402


def test_marca_por_palavra_inteira():
    assert marca_do_titulo("Coletor Admissao Ford New Fiesta Ka Focus Ecosport Sigma 1.5") == "Ford"
    assert marca_do_titulo("Biela Motor Gm Captiva 3.6 V6 08/17 12608432") == "Chevrolet"
    assert marca_do_titulo("Lanterna Traseira Esquerda Citoen C3 11/16 9687871880") == "Citroën"
    assert marca_do_titulo("Acabamento Porta Copos Mercedes Gla 200 2019") == "Mercedes-Benz"
    assert marca_do_titulo("Chave Farol Range Rover Sport 09/13 E0201043") == "Land Rover"
    assert marca_do_titulo("Sirene Alarme Vw Jetta Golf Passat 06/16") == "Volkswagen"


def test_foto_vira_chave():
    u = "https://http2.mlstatic.com/D_957636-MLB110353255009_042026-O.webp"
    assert chave_foto(u) == "957636-MLB110353255009_042026"


def test_slug_identico_ao_gerador_antigo():
    t = "Antena Teto Shark Volvo S60 Xc60 V60 18/24 31346765 Preto"
    assert slugify(t) == "antena-teto-shark-volvo-s60-xc60-v60-18-24-31346765-preto"


def test_dados_gerados():
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if not pecas.exists():
        return
    by = {x["id"]: x for x in json.loads(pecas.read_text(encoding="utf-8"))}
    # "Volvo Xc 60" (separado) tem que virar XC60 — se existir no estoque de hoje
    import re as _re
    for x in by.values():
        if _re.search(r"\bvolvo\b.*\bxc 60\b", x["t"], _re.I):
            assert x["m"] == "XC60", (x["id"], x["t"], x["m"])
            break
    # qualidade da leitura: so AVISA (o estoque muda; nao pode travar a publicacao)
    sem_modelo = sum(1 for x in by.values() if not x["m"])
    if sem_modelo / len(by) >= 0.04:
        print(f"AVISO: {sem_modelo} pecas sem modelo ({sem_modelo * 100 // len(by)}%)")
    assert all("SELLER_SKU" not in json.dumps(x) for x in list(by.values())[:200])
    # nada de promessa ainda nao confirmada pelo Maruf nas descricoes publicadas
    import re
    proibido = re.compile(r"lacre|retirada|presencial|hor[aá]rio|horas [uú]teis|d[ée]cada|frete|despach", re.I)
    ruins = [x["id"] for x in by.values() if proibido.search(x["desc"])]
    assert not ruins, f"{len(ruins)} descricoes com promessa nao confirmada: {ruins[:5]}"


def test_estoque_so_com_dado_de_verdade():
    """"q" (estoque) so existe com inteiro >= 1 vindo do ML: sem dado, a pagina nao fala de estoque."""
    from preparar_dados import estoque
    assert estoque({"available": 1}) == 1          # peca unica
    assert estoque({"available": 3}) == 3
    assert estoque({"available": 0}) is None       # zerado: nada de "peca unica"
    assert estoque({"available": None}) is None
    assert estoque({}) is None
    assert estoque({"available": True}) is None    # bool nao e quantidade
    assert estoque({"available": "2"}) is None     # texto nao e quantidade
    assert estoque({"available": -1}) is None
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        lista = json.loads(pecas.read_text(encoding="utf-8"))
        qs = [x["q"] for x in lista if "q" in x]
        assert all(isinstance(q, int) and not isinstance(q, bool) and q >= 1 for q in qs), "q fora do contrato"
        if lista and not qs:
            print("AVISO: nenhuma peca com estoque (q) no pecas.json")


def test_reputacao_do_robo():
    import tempfile
    from preparar_dados import ler_reputacao
    with tempfile.TemporaryDirectory() as d:
        arq = Path(d) / "reputation.json"
        base = {"level_id": "5_green", "power_seller_status": "silver", "completed": 669}
        arq.write_text(json.dumps(base), encoding="utf-8")
        assert ler_reputacao(arq) == {"nivel": "verde", "n": 5, "lider": "prata", "vendas": 669}
        arq.write_text(json.dumps({**base, "power_seller_status": ""}), encoding="utf-8")
        assert "lider" not in ler_reputacao(arq)            # sem MercadoLider: some so a linha
        arq.write_text(json.dumps({**base, "completed": 0}), encoding="utf-8")
        assert "vendas" not in ler_reputacao(arq)           # zero vendas nao vira "0 vendas"
        arq.write_text(json.dumps({**base, "level_id": "9_xx"}), encoding="utf-8")
        assert ler_reputacao(arq) is None                   # nivel desconhecido: sem termometro
        arq.write_text("nao e json", encoding="utf-8")
        assert ler_reputacao(arq) is None
    assert ler_reputacao(Path("/caminho/que/nao/existe.json")) is None


def test_atualizar_reputacao_mantem_arquivo_anterior():
    """Falha da API do ML nunca apaga nem embaralha o reputation.json anterior."""
    import tempfile
    try:
        import atualizar_catalogo as ac
    except ImportError:   # sem requests/dotenv nesta maquina: o robo (CI) tem
        return
    antes = {"level_id": "5_green", "completed": 669}
    with tempfile.TemporaryDirectory() as d:
        dest = Path(d)
        (dest / "reputation.json").write_text(json.dumps(antes), encoding="utf-8")
        orig_site, orig_get = ac.SITE_DIR, ac.requests.get
        ac.SITE_DIR = dest
        try:
            class Falha:
                status_code = 403
                def json(self):
                    return {}
            ac.requests.get = lambda *a, **k: Falha()
            ac.save_seller_reputation()
            assert json.loads((dest / "reputation.json").read_text(encoding="utf-8")) == antes
            def estoura(*a, **k):
                raise OSError("rede caiu")
            ac.requests.get = estoura
            ac.save_seller_reputation()
            assert json.loads((dest / "reputation.json").read_text(encoding="utf-8")) == antes
            class Ok:
                status_code = 200
                def json(self):
                    return {"nickname": "X", "seller_reputation": {"level_id": "4_light_green",
                            "power_seller_status": "gold", "transactions": {"total": 900, "completed": 700,
                            "canceled": 1, "ratings": {"positive": 0.9}}}}
            ac.requests.get = lambda *a, **k: Ok()
            ac.save_seller_reputation()
            novo = json.loads((dest / "reputation.json").read_text(encoding="utf-8"))
            assert novo["level_id"] == "4_light_green" and novo["completed"] == 700
            assert not (dest / "reputation.json.tmp").exists()
        finally:
            ac.SITE_DIR, ac.requests.get = orig_site, orig_get


def test_filtro_de_etiqueta_decisao():
    """Etiqueta = muito texto NA peça E papel claro. Peca com etiqueta tecnica (escura) passa."""
    from capas_estudio import decidir_etiqueta, LIMITE_TEXTO
    assert LIMITE_TEXTO == 0.15
    assert decidir_etiqueta(0.30, 0.80) is True          # papel de etiqueta com texto
    assert decidir_etiqueta(0.30, 0.05) is False         # ECU/sensor com etiqueta: peca, nao papel
    assert decidir_etiqueta(0.05, 0.90) is False         # pouco texto
    assert decidir_etiqueta(None, 0.90) is False         # sem OCR: segue sem filtro


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
