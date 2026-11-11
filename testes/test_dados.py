"""Casos reais que a leitura antiga errava. Rodar:  python testes/test_dados.py"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import preparar_dados as pd  # noqa: E402
from preparar_dados import marca_do_titulo, chave_foto  # noqa: E402
from gerar_paginas_individuais import slugify  # noqa: E402


def _pecas():
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    return {x["id"]: x for x in json.loads(pecas.read_text(encoding="utf-8"))} if pecas.exists() else {}


def _carros(x):
    return x.get("ms") or ([x["m"]] if x.get("m") else [])


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


def test_nome_por_extenso_com_genero():
    """Problema 1: nome cru do ML ("tras esq", "dian dir", sem acento) -> por extenso, com o
    genero e o numero do substantivo. Titulos reais do estoque."""
    from preparar_dados import nome_limpo
    casos = [
        ("Motor Vidro Eletrico Tras Esq Hyundai Hb20 13/16 617015002", "Hyundai", "HB20",
         "Motor vidro elétrico traseiro esquerdo"),
        ("Lanterna Traseira Esq Chevrolet Blazer 96/01 2a01r00ia02f00", "Chevrolet", "Blazer",
         "Lanterna traseira esquerda"),
        ("Suporte Macaneta Diant Dir Peugeot 2008 208 17/22 9670931980 Preto", "Peugeot", "2008",
         "Suporte maçaneta dianteira direita"),
        ("Fechadura Eletrica Tras Dir Fiat Grand Siena 13/20 518921740", "Fiat", "Grand Siena",
         "Fechadura elétrica traseira direita"),
        ("Forro Porta Diant Esquerda Renault Kardian 25/26 809012975r", "Renault", "Kardian",
         "Forro porta dianteira esquerda"),
        ("Carpete Tras Direito Porta Malas Citroen C3 22/26 98375728zd", "Citroën", "C3",
         "Carpete traseiro direito porta-malas"),
        ("Kit Canaleta Portas Tras Citroën C4 Cactus 18/24 9822569780", "Citroën", "C4 Cactus",
         "Kit canaleta portas traseiras"),
        # um lado so: quem e esquerdo e o botao, nao "os vidros"
        ("Botão Vidros Diant Esque Renault Kardian 24/26 254291224r", "Renault", "Kardian",
         "Botão vidros dianteiro esquerdo"),
        # "Traseira" repetida no fim do titulo sai; a sequencia concorda com "externa"
        ("Macaneta Externa Tras Dir Fiat Toro 16/22 252122 Original Prata Traseira", "Fiat", "Toro",
         "Maçaneta externa traseira direita"),
        # "traseira" de outra palavra (tampa) fica
        ("Lanterna Esquerda Tampa Traseira Volvo Xc 60 18/24 A045591", "Volvo", "XC60",
         "Lanterna esquerda tampa traseira"),
        ("Bieleta Barra Estabiliz Tras Esq Volvo Xc60 18/24 31307674", "Volvo", "XC60",
         "Bieleta barra estabilizadora traseira esquerda"),
        ("Suporte Pinça Freio Tras Esq Chevrolet Cruze 12/16 13345403", "Chevrolet", "Cruze",
         "Suporte pinça freio traseira esquerda"),
        ("Quebra Sol Quebra Lado Esquerdo Hyundai Azera 3.3 09/12", "Hyundai", "Azera",
         "Quebra-sol lado esquerdo"),
        ("Camera De Re Honda Wr-v 2017 Ate 2021", "Honda", "WR-V", "Câmera de ré"),
        ("Bloco Expansao Ar Cond Volvo Xc60 18/24 31469762", "Volvo", "XC60", "Bloco expansão ar condicionado"),
        ("Dobradica Porta Dianteira Esquerda Gm Cruze 17/22 80066p", "Chevrolet", "Cruze",
         "Dobradiça porta dianteira esquerda"),
        ("Sup Macaneta Ext Diant Esq Bmw 320i E90 07/12 51217207561 Preto", "BMW", "320i",
         "Suporte maçaneta externa dianteira esquerda"),
        ("Acab Inf Coluna Direcao Jaguar E-pace 18/24 J9c33f900", "Jaguar", "E-Pace",
         "Acabamento inferior coluna direção"),
        # carro/geracao que sobra no fim sai quando o cartao ja mostra o modelo
        ("Motor Vidro Eletrico Vw Gol Voyage Saveiro G5 G6 G7 G8", "Volkswagen", "Gol", "Motor vidro elétrico"),
        ("Sensor Temperatura Renault Kardian 1.0t 24/26 226301872r", "Renault", "Kardian", "Sensor temperatura"),
        ("Corpo Borboleta Tbi Gm Cruze 1.4 Turbo 18/23 12644239aa", "Chevrolet", "Cruze", "Corpo borboleta TBI"),
        ("Tbi Mercedes 2014-2019", "Mercedes-Benz", "", "TBI"),
    ]
    for titulo, marca, modelo, esperado in casos:
        assert nome_limpo(titulo, marca, modelo) == esperado, (titulo, nome_limpo(titulo, marca, modelo))
    # SsangYong e marca (auditoria 10/11, R9): com a marca e o modelo no cartao, o nome sai so com a peca
    assert nome_limpo("Sensor Map Ssangyong Kyron Actyon 10/13 6675420017", "SsangYong", "Actyon") \
        == "Sensor MAP"


def test_codigo_oem_sem_lixo():
    """Problema 2: o campo OEM do ML traz lixo ("Par Mola ...", pedaco, ano, numero de 5 digitos)."""
    from preparar_dados import codigo_valido, codigos_peca, codigos_busca
    p = {"title": "Mola Suspensao Dianteira Volvo Xc60 T8 Hibrida 2019 31476671",
         "oem": "Par Mola Válvula Roda Diant. Volvo Xc60 T8 2019 a 2024 31476671,31476671 "
                "ParMolaVálvulaRodaDiantVolvoXc60T82019a202431476671,31476671 volvo",
         "part_number": "31476671"}
    assert codigos_peca(p) == ["31476671"]                       # a mola do XC60 mostrava "Par"
    p = {"title": "Chave Seta Limpador Vw Golf Audi A3 00/06 8l0953513l",
         "oem": "8L0953513l 2000/2006", "part_number": "8L0953513l 2000-2001-2002-2003-2004-2005-2006"}
    assert codigos_peca(p) == ["8L0953513L"]                     # maiuscula: o "l" nao vira "1"
    p = {"title": "Fechadura Trava Capo Dianteiro Fiat Toro 1.8 16/24 Original",
         "oem": "21544", "part_number": "21544 2016-2017-2018-2019-2020-2021-2022-2023-2024"}
    assert codigos_peca(p) == []                                 # 5 digitos: nao e codigo (some a caixa)
    p = {"title": "Painel Instrumentos Audi A4 2008/2012 Original - 8k0920900 Preto",
         "oem": "920 8K0920900", "part_number": "920 2008-2009-2010-2011-2012"}
    assert codigos_peca(p) == ["8K0920900"]                      # pedaco "920" sai
    p = {"title": "Bocal Oleo Motor Renault Logan Sandero Clio 07/14 Original Preto",
         "oem": "73594 8200639421 735948200639421", "part_number": "73594 2007-2008"}
    assert codigos_peca(p) == ["8200639421"]                     # dois codigos colados saem
    p = {"title": "Modulo Bcm Conforto Ford New Fiesta 13/19 Dn1t15k600jg",
         "oem": "DN1T/15K600/JG DN1T15K600JG", "part_number": "DN1T/15K600/JG/ 2013-2014"}
    assert codigos_peca(p) == ["DN1T-15K600-JG"]                 # barra vira hifen (o site corta na barra)
    p = {"title": "Motor Limpador Vidro Dianteiro Fiat Strada 14/20 Tge64343418",
         "oem": "TGE 64343418", "part_number": "tge64343418 2014-2015-2016"}
    assert codigos_peca(p) == ["TGE64343418"]                    # o pedaco "64343418" sai
    p = {"title": "Luz Do Forro De Porta Traseiro Direito Azera 3.3 09/12 Vermelho",
         "oem": "Hyundai azera", "part_number": "92661-3L000"}
    assert codigos_peca(p) == ["92661-3L000"]                    # atributo part_number quando o oem e lixo
    p = {"title": "Amortecedor Tampa Tras Bmw 320i 07/12 51247250308",
         "oem": "250", "part_number": "250 2007-2008-2009-2010-2011-2012"}
    assert codigos_peca(p) == ["51247250308"]                    # sem codigo no atributo: o do titulo
    assert codigos_busca(p) == "51247250308"
    for lixo in ("Par", "2007", "17mm", "2018-2019-2020", "20072011", "2004/10", "C390", "010101",
                 "123123", "JAG-EPACE-ENC-TRA3", "xDrive30e", "GLA200", "5x114,3", "T145-90D16"):
        assert not codigo_valido(lixo), lixo
    for bom in ("31476671", "8L0953513L", "DS7T-14F239-BP", "A2038201642", "J9C3-237B06-A", "030864"):
        assert codigo_valido(bom), bom


def test_anos_e_modelos():
    """Problema 3: faixa impossivel cortada no periodo do carro; modelo nunca e outra marca."""
    from preparar_dados import anos_do_titulo, modelo_canonico, palavras, ANO_MAX
    casos = [
        # Peugeot 208 nasceu em 2013; Kardian em 2024; Vectra acabou em 2011
        ("Modulo Rele Ventoinha Peugeot 208 2008 12/19 9806675280", "Peugeot", "208", "", (2013, 2019)),
        ("Mangueira Ar Condicionado Kardian 1.0 22/26 924400946r", "Renault", "Kardian", "", (2024, 2026)),
        ("Suporte Coxim Dianteiro Motor Gm Vectra 2.0 00/21 90497256", "Chevrolet", "Vectra", "", (2000, 2011)),
        # faixa toda fora do periodo = leitura errada: fica sem ano (nunca ano impossivel)
        ("Antena Imobilizador Cilindro C4 Peugeot 208 04/11 9663123380", "Peugeot", "208", "", (None, None)),
        # outros jeitos de escrever o ano
        ("Painel Instrumentos Honda Civic 2006 A 2011 Hr-0340 Original Preto", "Honda", "Civic", "", (2006, 2011)),
        ("Rádio Mp3 Player Bluetooth Original Ford Ka+ 2015 16 17 18", "Ford", "Ka", "", (2015, 2018)),
        ("Tampa Caixa Filtro Ar Volvo Xc60 T8 2019/24 Orig 32222303", "Volvo", "XC60", "", (2019, 2024)),
        ("Motor Teto Solar Audi Q3 2011-2018 Webasto 8u0959591", "Audi", "Q3", "", (2011, 2018)),
        ("Chave Luz Seta Limpador Toyota Corolla 20092013 17f056", "Toyota", "Corolla", "", (2009, 2013)),
        # o "2008" da Peugeot e carro, nao ano
        ("Volante Direcao Peugeot 2008 Com Comandos Couro Original Preto", "Peugeot", "2008", "", (None, None)),
        # sem ano no titulo: a lista de anos do part_number do ML
        ("Moldura Cromada Macaneta Porta Jaguar E-pace J9c3-237b06-a Cromado", "Jaguar", "E-Pace",
         "J9C3-237B06-A 2018-2019-2020-2021-2022-2023-2024", (2018, 2024)),
        # ano-modelo do ano que vem ja esta a venda (Kardian 2027); nunca passa de ANO_MAX
        ("Moldura Console Central Renault Kardian 24/27 969132370r", "Renault", "Kardian", "", (2024, min(2027, ANO_MAX))),
    ]
    casos += [
        # "AAAAaa" colado (a barra sumiu): 2019 a 2024; o 2008 da Peugeot continua carro
        ("Moldura Retrovisor Interno Volvo Xc60 2.0 T8 201924 32244473", "Volvo", "XC60", "32244473", (2019, 2024)),
        ("Botão Trava Portas Peugeot 2008 201719 96750883zd Original", "Peugeot", "2008", "96750883zd", (2017, 2019)),
        ("Botão Trava Portas Peugeot 2008 200819 96750883zd Original", "Peugeot", "2008", "", (None, None)),
        # "aa/aa" fora do periodo do Brasil, mas o Yaris de fora existe (o patio tem importado)
        ("Bomba Tanque Toyota Yaris 06/12 770200d370 Original", "Toyota", "Yaris", "", (2006, 2012)),
        # 2 algarismos logo depois do carro (ou da versao/motor) = o ano; modelo numerico nunca e ano
        ("Acabamento Bagagito Traseiro Esquerdo Volvo Xc60 19 31425768 Preto", "Volvo", "XC60", "31425768", (2019, 2019)),
        ("Central Multimidia Radio Volvo Xc60 T8 21  32326628 Original Prata", "Volvo", "XC60", "", (2021, 2021)),
        ("Moldura Botao Vidro Dianteiro Direito Honda Fit Lx 15", "Honda", "Fit", "83545T5N", (2015, 2015)),
        ("Quebra Sol Lado Esquerdo Fiat Toro 23 Original", "Fiat", "Toro", "Não", (2023, 2023)),
        ("Lanterna Traseira Peugeot 208 15 Original", "Peugeot", "208", "", (2015, 2015)),
        ("Painel Instrumentos Fiat 500 12 Original", "Fiat", "500", "", (2012, 2012)),
        # ... mas medida, outra palavra no meio, numero seguido, ano aberto ou carro fora do periodo nao
        ("Lampada Farol Volvo Xc60 12 V 55w", "Volvo", "XC60", "", (None, None)),
        ("Chicote Porta Vw Gol 16 Pinos", "Volkswagen", "Gol", "", (None, None)),
        ("Kit Parafusos Volvo Xc60 Kit 12 Pecas", "Volvo", "XC60", "", (None, None)),
        ("Moldura Coluna Porta Esquerda Fiat Toro 1.8 16v Vermelho 16/ Vermelho", "Fiat", "Toro", "Não", (None, None)),
        ("Farol Fiat Toro 16 17 Original", "Fiat", "Toro", "", (None, None)),
        ("Botao Fiat Toro 12 Original", "Fiat", "Toro", "", (None, None)),
        ("Chave Seta Limpador Parabrisa Volkswagen G8 21 10076793", "Volkswagen", "", "", (None, None)),
    ]
    for titulo, marca, modelo, pn, esperado in casos:
        assert anos_do_titulo(titulo, marca, modelo, pn) == esperado, (titulo, anos_do_titulo(titulo, marca, modelo, pn))
    # a faixa e de outro carro da peca ("Punto" acabou em 2017; "Strada" 18/23): vale a dele, ele vem 1o, e o Punto
    # e o Idea ficam sem ano (continuam na peca)
    from preparar_dados import anos_por_modelo, _ler_anos
    tit = "Suporte Bobina Ignicao Fiat Punto Idea Strada 18/23 55189638"
    assert anos_do_titulo(tit, "Fiat", "Punto", "", ["Punto", "Idea", "Strada"]) == (2018, 2023)
    assert anos_do_titulo(tit, "Fiat", "Punto", "") == (None, None)
    assert anos_por_modelo(["Punto", "Idea", "Strada"], "Fiat", 2018, 2023) == (["Strada", "Punto", "Idea"], [[2018, 2023], None, None])
    # a regra de sempre continua: o 2o carro fora do periodo sai; o que cabe e cortado
    assert anos_por_modelo(["Fit", "WR-V"], "Honda", 2015, 2021) == (["Fit", "WR-V"], [[2015, 2021], [2017, 2021]])
    assert anos_por_modelo(["Toro", "Punto"], "Fiat", 2019, 2023) == (["Toro"], None)
    # colado que nao e ano (codigo "193145": 1931 nao)
    assert _ler_anos("Botao Vidro Passageiro Toyota Yaris Hilux 193145", "Toyota")[:2] == (None, None)
    # modelo nunca e outra marca; apelido/chassi vira o carro
    assert modelo_canonico("Volkswagen", "Audi") == ""
    assert modelo_canonico("BMW", "E60") == "Série 5"
    assert modelo_canonico("Mercedes-Benz", "Classe C180") == "C180"
    assert modelo_canonico("Chevrolet", "Onix Plus") == "Onix"
    assert palavras("Rele 428 Auxiliar Partida Vw Audi Golf Polo 1j0906381b 12v", "Volkswagen")[0] == "Golf"
    assert palavras("Moldura Botão Traseiro Esq Honda Wr-v 2026 8379139km0m1 Preto", "Honda") == ["Wr-v"]
    assert palavras("Coletor Admissao Gm Tracker 1.0 Lt 20/25 25206729", "Chevrolet") == ["Tracker"]
    assert palavras("Lanterna Traseira Esquerda Vw Golf Mk4 98/07 37750719", "Volkswagen") == ["Golf"]
    assert palavras("Grade Frontal Kidney Cromada Bmw Serie 5 E60 E61 03/10 Preto", "BMW")[0] == "Série 5"


def test_dados_gerados_qualidade():
    """No que o preparar_dados gerou: nenhum modelo e marca, nenhum ano fora do periodo do
    carro, nenhum codigo invalido no cartao (invariantes do codigo: nao dependem do estoque)."""
    pasta = ROOT / "site" / "src" / "data"
    if not (pasta / "pecas.json").exists():
        return
    from preparar_dados import (_CHAVES_MARCA, PRODUCAO_BR, ANO_MAX, codigo_valido, _cod_chave)
    import gerar_indice as gi
    pecas = json.loads((pasta / "pecas.json").read_text(encoding="utf-8"))
    resumo = json.loads((pasta / "resumo.json").read_text(encoding="utf-8"))
    for x in pecas:
        assert not x["m"] or gi.chave_modelo(x["m"]) not in _CHAVES_MARCA, (x["id"], x["m"])
        if x["y"]:
            a0, a1 = x["y"]
            assert 1950 <= a0 <= a1 <= ANO_MAX, (x["id"], x["y"])
            ini, fim = PRODUCAO_BR.get((x["b"], gi.chave_modelo(x["m"])), (None, None))
            assert not ini or a0 >= ini, (x["id"], x["t"], x["y"])
            assert not fim or a1 <= fim, (x["id"], x["t"], x["y"])
        for c in x["oem"].split():
            assert codigo_valido(c) and c == c.upper(), (x["id"], x["oem"])
        # o cartao mostra o codigo com traco como na pagina (R10): compara a chave sem traco
        assert [_cod_chave(c) for c in x["o"].split()[:1]] == [_cod_chave(c) for c in x["oem"].split()[:1]], (x["id"], x["o"], x["oem"])
    for c in resumo["carros"]:
        if c["anos"]:
            ini, fim = PRODUCAO_BR.get((c["b"], gi.chave_modelo(c["m"])), (None, None))
            assert (not ini or c["anos"][0] >= ini) and (not fim or c["anos"][1] <= fim), (c["k"], c["anos"])


def test_filtro_de_etiqueta_decisao():
    """Etiqueta = muito texto NA peça E papel claro. Peca com etiqueta tecnica (escura) passa."""
    from capas_estudio import decidir_etiqueta, LIMITE_TEXTO
    assert LIMITE_TEXTO == 0.15
    assert decidir_etiqueta(0.30, 0.80) is True          # papel de etiqueta com texto
    assert decidir_etiqueta(0.30, 0.05) is False         # ECU/sensor com etiqueta: peca, nao papel
    assert decidir_etiqueta(0.05, 0.90) is False         # pouco texto
    assert decidir_etiqueta(None, 0.90) is False         # sem OCR: segue sem filtro


def test_enquadramento_v2_regra():
    """Capa v2: peça sempre na zona segura, base no piso comum e tamanho pelo peso visual (casco)."""
    from capas_estudio import enquadrar, REGRA
    L = 1000
    piso, topo = round(REGRA["PISO"] * L), round(REGRA["TOPO"] * L)
    xmin, xmax = round(REGRA["XMIN"] * L), round(REGRA["XMAX"] * L)
    casos = {
        "compacta": (500, 500, {"casco": 250000, "cx": 250}),
        "comprida": (2000, 100, {"casco": 190000, "cx": 1000}),
        "alta": (200, 1000, {"casco": 180000, "cx": 100}),
        "pequena": (100, 100, {"casco": 10000, "cx": 50}),
        "torta": (800, 600, {"casco": 300000, "cx": 700}),   # massa toda à direita
    }
    r = {k: enquadrar(w, h, med, L) for k, (w, h, med) in casos.items()}
    for k, (s, x, y, nw, nh) in r.items():
        assert xmin <= x and x + nw <= xmax, k            # nunca sai da zona segura
        assert y >= topo and y + nh == piso, k            # base no piso comum, nada na faixa do selo
    assert r["compacta"][3] == round(REGRA["T"] * L)       # compacta: lado = T (peso visual)
    assert r["comprida"][3] == xmax - xmin                 # comprida: usa a largura toda da zona
    assert r["pequena"][0] == REGRA["UP"]                  # foto pequena: amplia no máximo UP
    assert r["torta"][1] < (L - r["torta"][3]) // 2        # centro de massa à direita puxa a peça para a esquerda


def test_enquadramento_v2_peca_cortada():
    """Peça cortada na foto (nenhuma foto a mostra inteira): menor que a capa normal, margem >= 8% dos lados, mesmo
    piso. O peso visual nunca empurra a peça para fora da zona nem a faz maior que no enquadramento normal."""
    from capas_estudio import enquadrar, REGRA, REGRA_CORTADA, MARGEM_CORTADA, BORDA_CAPA
    L = 1000
    piso = round(REGRA["PISO"] * L)
    assert REGRA_CORTADA["PISO"] == REGRA["PISO"] and REGRA_CORTADA["UP"] < REGRA["UP"]
    assert REGRA_CORTADA["XMIN"] >= MARGEM_CORTADA and 1 - REGRA_CORTADA["XMAX"] >= MARGEM_CORTADA
    assert REGRA_CORTADA["T"] < REGRA["T"] and min(REGRA["XMIN"], 1 - REGRA["XMAX"]) >= BORDA_CAPA
    casos = {
        "larga": (1100, 400, {"casco": 380000, "cx": 550}),     # a tampa do porta-malas cortada dos dois lados
        "compacta": (500, 500, {"casco": 250000, "cx": 250}),
        "alta": (300, 1100, {"casco": 300000, "cx": 150}),
        "pequena": (120, 90, {"casco": 9000, "cx": 60}),        # foto pequena: nunca amplia
    }
    for k, (w, h, med) in casos.items():
        s0, x0, y0, nw0, nh0 = enquadrar(w, h, med, L)
        s, x, y, nw, nh = enquadrar(w, h, med, L, REGRA_CORTADA)
        assert s <= REGRA_CORTADA["UP"] and s <= s0, k                   # nunca maior que a capa normal
        assert x >= MARGEM_CORTADA * L and x + nw <= (1 - MARGEM_CORTADA) * L, (k, x, nw)
        assert y >= REGRA_CORTADA["TOPO"] * L and y + nh == piso, k      # mesmo piso das outras capas


def test_subtipo_com_a_mae():
    """Problema 4: subtipo solto ("De Vidros", "Elétrico", "Com Tela") vira nome inteiro, no estilo do ML."""
    from preparar_dados import subtipo
    raiz = ["Acessórios para Veículos", "Peças de Carros e Caminhonetes"]
    casos = [
        (["Peças de Interior", "Interruptores", "De Vidros"], "", "Interruptores de Vidros"),
        (["Peças de Interior", "Interruptores", "De Luzes"], "", "Interruptores de Luzes"),
        (["Fechaduras e Chaves", "para Porta-malas e Portões"], "", "Fechaduras para Porta-malas e Portões"),
        (["Janelas e Vedações", "Sistemas de Elevação", "Elétrico"], "MLB191714", "Máquinas e Motores de Vidro Elétrico"),
        (["Peças de Interior", "Pedais", "Outros"], "", "Pedais"),
        (["Iluminação", "Outros"], "", "Outros"),            # "Outros" logo abaixo da familia continua
        (["Iluminação", "Faróis Traseiros"], "", "Faróis Traseiros"),
    ]
    for path, cid, esperado in casos:
        assert subtipo({"nome": path[-1], "path": raiz + path}, cid) == esperado, (path, subtipo({"nome": path[-1], "path": raiz + path}, cid))
    estereo = {"nome": "Com Tela", "path": ["Acessórios para Veículos", "Som Automotivo", "Reprodutores", "Estéreos", "Com Tela"]}
    assert subtipo(estereo) == "Estéreos com Tela"
    assert subtipo(None) == ""
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        import re
        tipos = {x["s"] for x in json.loads(pecas.read_text(encoding="utf-8"))}
        soltos = {t for t in tipos if re.match(r"^(de|do|da|dos|das|com|sem|para)\s", t, re.I)}
        assert not soltos, soltos                     # regra do codigo: preposicao sempre ganha a mae
        # adjetivo solto depende das categorias novas do ML: so AVISA (nao pode travar a publicacao)
        adjetivos = tipos & {"Elétrico", "Manual", "Hidráulico"}
        if adjetivos:
            print(f"AVISO: subtipo solto sem nome inteiro (por em SUBTIPO_ID): {sorted(adjetivos)}")


def test_caixa_alta_vira_frase():
    """Problema 5: descricao em MAIUSCULAS vira frase normal. Codigo, sigla, marca e carro ficam;
    nada e inventado nem tirado (so sai a repeticao colada "VOLKSWAGEN VOLKSWAGEN")."""
    from preparar_dados import caixa_normal, acentuar_texto

    def f(t):
        return acentuar_texto(caixa_normal(t))
    casos = [
        ("PEDAL ACELERADOR ELETRÔNICO HONDA FIT 1.5 - ORIGINAL DE FABRICA - OEM HondaFit",
         "Pedal acelerador eletrônico Honda Fit 1.5 - original de fábrica - OEM HondaFit"),
        ("MÓDULO ALCANCE FAROL VOLKSWAGEN VOLKSWAGEN GOLF 1.4 TSI - ORIGINAL DE FABRICA - OEM 5Q0907357",
         "Módulo alcance farol Volkswagen Golf 1.4 TSI - original de fábrica - OEM 5Q0907357"),
        ("FECHADURA INFERIOR VW JETTA/PASSAT/GOL/SAVEIRO/VOYAGE - ORIGINAL DE FABRICA - OEM 5U0823509H",
         "Fechadura inferior VW Jetta/Passat/Gol/Saveiro/Voyage - original de fábrica - OEM 5U0823509H"),
        ("BICO INJETOR M270 1.6 MERCEDES-BENZ C180 C200 (MOTOR M270/M274 1.6 CGI) - ORIGINAL - OEM A2780700687",
         "Bico injetor M270 1.6 Mercedes-Benz C180 C200 (motor M270/M274 1.6 CGI) - original - OEM A2780700687"),
        ("TAMPA LATERAL PAINEL DIREITO FORD FIESTA HATCH SEDAN SE SEL TITANIUM ST - ORIGINAL",
         "Tampa lateral painel direito Ford Fiesta hatch sedan SE SEL Titanium ST - original"),
        ("RADIADOR DE AR QUENTE (HEATER CORE) DA CALEFAÇÃO - PEUGEOT 208, 2008 E CITROEN C4 LOUNGE 2013/2017",
         "Radiador de ar quente (heater core) da calefação - Peugeot 208, 2008 e Citroën C4 Lounge 2013/2017"),
        ("DIFUSOR AR LATERAL VOLKSWAGEN VW GOL - ORIGINAL DE FABRICA - OEM 5u0819703",
         "Difusor ar lateral Volkswagen Gol - original de fábrica - OEM 5u0819703"),
        # frase normal com o carro em caixa alta: so o trecho muda
        ("Peça original RENAULT SANDERO DUSTER (2008 até 2022). Código OEM 8200733848. Procedencia legal.",
         "Peça original Renault Sandero Duster (2008 até 2022). Código OEM 8200733848. Procedência legal."),
        # enfase de uma palavra so fica; lista de carros com codigo fica
        ("IMPORTANTE: Este e o lado DIREITO. O lado esquerdo e J9C3-16801-AB.",
         "IMPORTANTE: Este e o lado DIREITO. O lado esquerdo e J9C3-16801-AB."),
        ("Volvo XC60 XC90 S60 S90 V60 V90 2016 2017 2018", "Volvo XC60 XC90 S60 S90 V60 V90 2016 2017 2018"),
    ]
    for antes, depois in casos:
        assert f(antes) == depois, (antes, f(antes))
    # codigo nunca ganha acento ("...JA6" nao vira "...JÁ6")
    assert acentuar_texto("Código OEM: F1EP7K004FD3JA6") == "Código OEM: F1EP7K004FD3JA6"
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():   # no gerado: paragrafo longo em maiusculas so AVISA (sigla de verdade e caixa alta)
        import html
        import re
        altas = []
        for x in json.loads(pecas.read_text(encoding="utf-8")):
            for m in re.finditer(r"<(p|li)>(.*?)</\1>", x["desc"]):
                t = re.sub(r"\S*\d\S*", "", html.unescape(m.group(2)))      # codigo nao conta
                letras = [c for c in t if c.isalpha()]
                if len(letras) > 20 and sum(c.isupper() for c in letras) > 0.7 * len(letras):
                    altas.append((x["id"], t[:60]))
        if altas:
            print(f"AVISO: {len(altas)} trechos da descricao ainda em caixa alta: {altas[:3]}")


def test_descricao_em_lista_sem_lixo():
    """Problema 6: as linhas da lista do anuncio grudavam numa frase so ("+ Peca: X + Cor: Preto");
    "0 cm" e "Conforme aplicacao" nao sao dado; o pedaco de frase que sobrava da linha cortada sai."""
    from preparar_dados import descricao
    texto = ("IDENTIFICACAO DA PECA\n====\n+ Peca: Pedal Acelerador\n+ Cor predominante: Preto\n"
             "+ Largura da peca: 0 cm\n+ Posicao: Conforme aplicacao\n\n"
             "APLICACAO E COMPATIBILIDADE\n====\nPara garantir a compatibilidade exata, recomendamos:\n"
             "1) Conferir o codigo OEM;\n2) Comparar com fotos reais do anuncio;\n"
             "Compatibilidade verificada com base em catalogo Honda oficial e cruzamento OEM\n"
             "em multiplas fontes (banco interno, fabricantes).\n\n"
             "VEICULOS COMPATIVEIS\n====\n- Volvo XC60 - 2018, 2019, 2020, 2021\n- Volvo XC60 T8 - 2018, 2020\n")
    h = descricao(texto)
    assert "<ul><li>Peça: Pedal Acelerador</li><li>Cor predominante: Preto</li></ul>" in h, h
    assert "0 cm" not in h and "Conforme" not in h
    # o site nao tem "anuncio": as fotos sao as da peca (auditoria 3, 2.1)
    assert "<ol><li>Conferir o código OEM;</li><li>Comparar com fotos reais da peça;</li></ol>" in h, h
    assert "multiplas" not in h and "múltiplas" not in h            # resto da linha com promessa
    assert "<li>Volvo XC60 - 2018 a 2021</li>" in h                 # anos seguidos viram faixa
    assert "<li>Volvo XC60 T8 - 2018, 2020</li>" in h               # com buraco, ficam como estao


def test_ficha_limpa():
    """Problema 7: ficha sem o carro repetido, sem "Original-123", sem vazio e com a lista legivel
    (um carro por linha com as versoes; nada do anuncio some)."""
    from preparar_dados import ficha, modelos_ficha, _separar_modelos
    p = {"title": "Biela Motor Gm Captiva 3.6 V6 08/17 12608432", "oem": "12608432", "part_number": "12608432",
         "attrs": {"MODEL": "Captiva / Captiva Sport / Captiva LTZ / Captiva LT / Captiva 3.6 V6 / Omega / "
                            "Omega Fittipaldi / Camaro / Camaro SS",
                   "COLOR": "Metalico", "MATERIAL": "PLASTICO COM COMPONENTES ELETRÔNICOS", "ORIGIN": "Brasil",
                   "MANUFACTURER": "GM", "POSITION": "COLUNA DIREÇÃO"}}
    linhas = dict(ficha(p, "Chevrolet", "Captiva", [2008, 2017]))
    assert linhas["Modelos e versões"] == "Captiva: Sport, LTZ, LT, 3.6 V6\nOmega: Fittipaldi\nCamaro: SS"
    assert linhas["Cor"] == "Metálico"
    assert linhas["Material"] == "Plástico com componentes eletrônicos"
    assert linhas["Posição"] == "Coluna direção"
    assert linhas["Origem"] == "Brasil"
    assert not any(k.startswith("Fabricante") for k in linhas)          # GM = a marca do carro
    # so repete o carro do topo: sai
    assert modelos_ficha("Xc60", "Volvo", "XC60", [2018, 2024]) is None
    assert modelos_ficha("XC60 18/24", "Volvo", "XC60", [2018, 2024]) is None
    assert modelos_ficha("Volkswagen Golf 1.4 TSI", "Volkswagen", "Golf", [2014, 2021]) == ["Modelo do veículo", "Golf 1.4 TSI"]
    # barra: so separa nomes; ano, numero e versao curta ficam ("XC60 18/24" virava "XC60 18 · 24")
    assert _separar_modelos("XC60 2.0 T5/T6/T8") == ["XC60 2.0 T5/T6/T8"]
    assert _separar_modelos("Strada/Bravo/Linea") == ["Strada", "Bravo", "Linea"]
    assert _separar_modelos("Peugeot 206/207") == ["Peugeot 206/207"]
    v = "C4 / C4 Cactus / C4 Cactus Feel / C4 Cactus Shine / C4 Lounge / C4 Lounge Origine / C4 1.6 16V THP"
    assert modelos_ficha(v, "Citroën", "C4 Cactus", [2018, 2024]) == \
        ["Modelos e versões", "C4 Cactus: Feel, Shine\nC4: 1.6 16V THP\nC4 Lounge: Origine"]
    # vazio e lixo: a linha some
    p2 = {"title": "x", "attrs": {"COLOR": "-1", "ORIGIN": "Original-31346697", "MANUFACTURER": "VOLVO S60",
                                  "MODEL": "N/A"}}
    assert ficha(p2, "Volvo", "S60", None) == []
    assert ficha({"title": "x", "attrs": {"MANUFACTURER": "Bosch"}}, "Volvo", "S60") == [["Fabricante da peça", "Bosch"]]


def test_tipos_com_nome_da_loja():
    """Auditoria 2, L1: os tipos da pagina de categoria eram pedacos da arvore do ML ("De Vidros",
    "Faróis Traseiros" para lanternas ao lado de "Lanternas", "Suportes de Bateris", "Catalisador" e
    "Catalisadores"). Agora: o nome que o cliente procura, e os sinonimos num nome so."""
    from preparar_dados import tipo_loja, _titulo_tipo
    assert tipo_loja("Interruptores de Vidros") == "Botões do Vidro Elétrico"
    assert tipo_loja("Interruptores de Luzes") == "Chaves de Seta e Luz"
    assert tipo_loja("Interruptores de Para-brisas") == "Chaves do Limpador"
    assert tipo_loja("Interruptores de Piscas-alertas") == "Botões do Pisca-alerta"
    assert tipo_loja("Faróis Traseiros") == tipo_loja("Lanternas") == "Lanternas Traseiras"
    assert tipo_loja("Faróis de três Stop") == "Brake Light"
    assert tipo_loja("Catalisador") == tipo_loja("Catalisadores") == "Catalisadores"
    assert tipo_loja("Quebra Sol") == tipo_loja("Quebra Sóis") == "Quebra-sóis"
    assert tipo_loja("Mangueira Radiador") == tipo_loja("Mangueiras de Arrefecimento")
    assert tipo_loja("Maçanetas para Portas") == tipo_loja("Maçanetas das Portas")
    assert tipo_loja("Estéreos com Tela") == "Centrais Multimídia" and tipo_loja("Estéreos sem Tela") == "Rádios"
    assert tipo_loja("Suportes de Bateris") == "Caixas e Suportes da Bateria"            # erro do ML
    assert tipo_loja("Pára-Lamas") == "Para-lamas" and tipo_loja("Válvulas Solenóides") == "Válvulas Solenoides"
    # o mesmo nome do ML com sentido diferente conforme a familia
    assert tipo_loja("Bolsas de Ar", "Suspensão e Direção") == "Suspensão a Ar e Nivelamento"
    assert tipo_loja("Bolsas de Ar", "Peças de Interior") == "Airbags, Módulos e Sensores"
    # nome que nao esta na tabela: so a maiuscula padronizada
    assert _titulo_tipo("Painéis laterais") == "Painéis Laterais"
    assert _titulo_tipo("Braços De Suspensão") == "Braços de Suspensão"
    assert tipo_loja("Sondas Novas") == "Sondas Novas"
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        import re
        from collections import defaultdict
        por_fam = defaultdict(set)
        for x in json.loads(pecas.read_text(encoding="utf-8")):
            por_fam[x["c"]].add(x["s"])
        tipos = {t for ts in por_fam.values() for t in ts if t}
        # regra do codigo (vale para qualquer estoque): preposicao ganha a mae e a 1a letra e maiuscula
        ruins = {t for t in tipos if re.match(r"^(de|do|da|dos|das|com|sem|para)\s", t, re.I) or t[:1].islower()}
        assert not ruins, ruins
        # o resto depende das categorias que o ML cria: so AVISA (nao pode travar a publicacao)
        crus = {t for t in tipos if re.search(r"Pára|Bateris|Solenóide|Modulos de Fusiveis|três Stop|^Interruptores de", t)}
        if crus:
            print(f"AVISO: tipo com nome cru do ML (por em TIPO_LOJA): {sorted(crus)}")

        def raiz(t):   # sinonimo singular/plural na mesma familia ("Catalisador" e "Catalisadores")
            return " ".join(re.sub(r"(oes|aes|es|s)$", "", w) for w in gi_sem(t).split())
        for fam, ts in por_fam.items():
            raizes = defaultdict(list)
            for t in ts:
                raizes[raiz(t)].append(t)
            dup = [v for v in raizes.values() if len(v) > 1]
            if dup:
                print(f"AVISO: {fam} com o mesmo tipo em 2 nomes (juntar em TIPO_LOJA): {dup}")


def gi_sem(t):
    import gerar_indice as gi
    return gi.strip_accents(t).lower()


def test_peca_na_familia_certa():
    """Auditoria 2, L7: o nome da peca manda mais que a categoria que o vendedor escolheu no ML."""
    from preparar_dados import classificar, modelo_canonico
    casos = [
        # (nome limpo, familia do ML, tipo do ML) -> (familia, tipo)
        (("Chave roda 17mm", "Fechaduras e Chaves", "Chaves de Roda"), ("Segurança", "Macacos e Chaves de Roda")),
        (("Chave roda", "Fechaduras e Chaves", "Chaves de Roda"), ("Segurança", "Macacos e Chaves de Roda")),
        (("Macaco tesoura", "Janelas e Vedações", "Macacos Hidráulicos"), ("Segurança", "Macacos e Chaves de Roda")),
        (("Módulo câmbio automático", "Ignição", "Módulos de Ignição e Imobilizador"),
         ("Transmissão", "Módulos do Câmbio e da Tração")),
        (("Conversor torque câmbio", "Ignição", "Conversores de Voltagem"), ("Transmissão", "Câmbios e Peças Internas")),
        (("Botão freio de mão", "Ignição", "Outros Botões"), ("Freios", "Botões do Freio de Mão")),
        (("Mangueira vácuo freio", "Ignição", "Mangueiras e Linhas do Motor"),
         ("Freios", "Mangueiras e Flexíveis do Freio")),
        (("Sensor hidrovácuo", "Ignição", "Mangueiras e Linhas do Motor"), ("Freios", "Sensores do Freio")),
        (("Motor vidro dianteiro direito", "Motor", "Motores"),
         ("Janelas e Vedações", "Máquinas e Motores de Vidro Elétrico")),
        (("Botão vidro traseiro direito", "Ignição", "Outros Botões"), ("Peças de Interior", "Botões do Vidro Elétrico")),
        (("Botão start stop engine", "Ignição", "Outros Botões"), ("Ignição", "Botões de Partida")),
        # botoes que o ML mistura: o nome escolhe o tipo
        (("Botão trava portas", "Peças de Interior", "Botões da Trava Elétrica"),
         ("Peças de Interior", "Botões da Trava Elétrica")),
        (("Botão ESP", "Peças de Interior", "Botões da Trava Elétrica"), ("Peças de Interior", "Outros Botões")),
        (("Botão trava memória banco esquerdo", "Peças de Interior", "Botões da Trava Elétrica"),
         ("Peças de Interior", "Outros Botões")),
        (("Botão desembaçador traseiro", "Peças de Interior", "Outros Botões"),
         ("Peças de Interior", "Botões do Desembaçador")),
        # grupo misturado do ML ("Outros"): moldura do painel ganha o tipo certo
        (("Moldura lateral esquerda painel", "Peças de Interior", "Outros"),
         ("Peças de Interior", "Acabamentos do Painel")),
        # revisão 12, P2.2: "Comando rebatimento tampa" no "Comando de válvulas" do ML (pela palavra "comando") é o botão
        # da tampa traseira; o do banco vai para o banco; o motor do retrovisor que rebate não é botão
        (("Comando rebatimento tampa", "Motor", "Comandos de Válvulas"), ("Peças de Interior", "Outros Botões")),
        (("Comando rebatimento banco traseiro", "Motor", "Comandos de Válvulas"), ("Peças de Interior", "Peças de Banco")),
        (("Motor rebatimento retrovisor", "Motor", "Motores"), ("Motor", "Motores")),
        (("Solenoide comando válvulas", "Motor", "Comandos de Válvulas"), ("Motor", "Comandos de Válvulas")),
        # o que ja esta certo nao muda
        (("Alavanca freio de mão", "Peças de Interior", "Alavancas do Freio de Mão"),
         ("Peças de Interior", "Alavancas do Freio de Mão")),
        (("Motor vidro elétrico", "Janelas e Vedações", "Máquinas e Motores de Vidro Elétrico"),
         ("Janelas e Vedações", "Máquinas e Motores de Vidro Elétrico")),
        (("Bomba vácuo", "Freios", "Bombas de Vácuo"), ("Freios", "Bombas de Vácuo")),
    ]
    for (nome, fam, tipo), esperado in casos:
        assert classificar(nome, fam, tipo) == esperado, (nome, classificar(nome, fam, tipo))
    # HB20X e HB20S sao o HB20
    assert modelo_canonico("Hyundai", "Hb20x") == "HB20" and modelo_canonico("Hyundai", "HB20S") == "HB20"
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        import re
        for x in json.loads(pecas.read_text(encoding="utf-8")):
            n = gi_sem(x["n"])
            # "c" agora e o bloco (BLOCOS): chave de roda em Rodas, modulo do cambio no Cambio, motor de vidro no Vidro
            assert not (re.match(r"chave (de )?roda\b", n) and x["c"] != "Rodas"), x["id"]
            assert not (re.match(r"modulo (do )?cambio\b", n) and x["c"] != "Câmbio e Transmissão"), x["id"]
            assert not (re.match(r"(motor|maquina) (de )?vidro\b(?!.*\bmanual)", n) and x["c"] != "Vidro Elétrico"), x["id"]


def test_blocos_do_jeito_que_o_cliente_procura():
    """Nov/2026: o dono reprovou "espelho em Carroceria" e "farol em Iluminação". O campo "c" virou um dos 25 BLOCOS
    (nome, chave e ordem da arte), pelo tipo "s" e, quando o tipo e "Outros", pelo nome. Cada peca num bloco so."""
    from preparar_dados import (BLOCOS, BLOCO_NOME, BLOCO_POR_TIPO, BLOCO_NO_TIPO, FAMILIAS_ANTIGAS, TIPO_LOJA,
                                TIPO_LOJA_FAMILIA, SUBTIPO_ID, REGRAS_NOME, BOTAO_POR_NOME, OUTROS_POR_NOME,
                                TIPO_FAMILIA, bloco, chave_url)
    chaves = [k for k, _ in BLOCOS]
    assert chaves == ["retrovisores", "farois-e-lanternas", "macanetas-e-fechaduras", "vidro-eletrico", "painel-e-console",
                      "botoes-e-chaves-de-seta", "acabamentos-e-forros", "motor", "mangueiras-do-motor",
                      "filtro-de-ar-e-turbo", "injecao-e-combustivel", "arrefecimento", "ar-condicionado",
                      "modulos-e-eletrica", "ignicao-e-partida", "freios", "suspensao-e-direcao", "cambio-e-transmissao",
                      "rodas", "para-choques-e-lataria", "limpador-e-lavador", "airbag-e-seguranca", "som-e-multimidia",
                      "pedais-e-volante", "escapamento"]
    assert all(chave_url(n) == k for k, n in BLOCOS), [(k, chave_url(n)) for k, n in BLOCOS if chave_url(n) != k]
    # mapa completo (estatico): todo tipo que as tabelas produzem tem bloco, e todo bloco tem tipo
    produzidos = (set(TIPO_LOJA.values()) | set(SUBTIPO_ID.values()) | set(TIPO_LOJA_FAMILIA.values())
                  | {t for *_, t in REGRAS_NOME} | {t for _, t in BOTAO_POR_NOME} | set(TIPO_FAMILIA)
                  | {t for rs in OUTROS_POR_NOME.values() for _, t in rs}) - {"Outros"}
    sem = sorted(t for t in produzidos if t not in BLOCO_POR_TIPO and t not in TIPO_LOJA)
    assert not sem, f"tipo sem bloco (por em _TIPOS_DO_BLOCO): {sem}"
    assert set(BLOCO_POR_TIPO.values()) == set(chaves), set(chaves) - set(BLOCO_POR_TIPO.values())
    assert all(b in BLOCO_NOME for rs in BLOCO_NO_TIPO.values() for _, b in rs)
    assert all(t in BLOCO_POR_TIPO for t in BLOCO_NO_TIPO), [t for t in BLOCO_NO_TIPO if t not in BLOCO_POR_TIPO]
    # enderecos antigos: so as chaves que sairam, cada uma para um bloco que existe
    assert all(para in BLOCO_NOME and k not in BLOCO_NOME for k, (_, para) in FAMILIAS_ANTIGAS.items())
    assert set(FAMILIAS_ANTIGAS) >= {"pecas-de-interior", "carroceria", "pecas-de-exterior", "sistema-eletrico",
                                     "climatizacao", "injecao", "janelas-e-vedacoes", "fechaduras-e-chaves",
                                     "iluminacao", "transmissao", "ignicao", "seguranca", "filtros", "escapamentos"}
    # o que o dono apontou e o que a lista do pedido pos em cada bloco
    casos = [
        (("Retrovisor externo direito", "Carroceria", "Retrovisores Externos"), "retrovisores"),
        (("Retrovisor interno", "Peças de Interior", "Retrovisores Internos"), "retrovisores"),
        (("Botão retrovisor", "Peças de Interior", "Botões do Retrovisor"), "retrovisores"),
        (("Farol esquerdo", "Iluminação", "Faróis"), "farois-e-lanternas"),
        (("Luz teto", "Peças de Interior", "Luzes Internas"), "acabamentos-e-forros"),     # auditoria 3: luz do forro
        (("Maçaneta externa", "Carroceria", "Maçanetas das Portas"), "macanetas-e-fechaduras"),
        (("Botão trava portas", "Peças de Interior", "Botões da Trava Elétrica"), "macanetas-e-fechaduras"),
        (("Botão vidro", "Peças de Interior", "Botões do Vidro Elétrico"), "vidro-eletrico"),
        (("Motor teto solar", "Carroceria", "Motores do Teto Solar"), "vidro-eletrico"),
        (("Chave limpador", "Peças de Interior", "Chaves do Limpador"), "botoes-e-chaves-de-seta"),
        (("Bomba vácuo", "Freios", "Bombas de Vácuo"), "motor"),
        (("Mangueira calefação", "Climatização", "Mangueiras de Calefação"), "mangueiras-do-motor"),
        (("Sirene alarme", "Segurança", "Alarmes e Sirenes"), "modulos-e-eletrica"),
        (("Macaco tesoura", "Segurança", "Macacos e Chaves de Roda"), "rodas"),
        (("Semieixo dianteiro", "Suspensão e Direção", "Semieixos"), "cambio-e-transmissao"),
        (("Volante", "Peças de Interior", "Volantes"), "pedais-e-volante"),
        (("Volante motor", "Transmissão", "Volantes de Embreagem"), "cambio-e-transmissao"),
        (("Grade alto-falante porta", "Som e Multimídia", "Grades de Alto-falante"), "acabamentos-e-forros"),
        (("Difusor ar", "Peças de Interior", "Difusores de Ar"), "painel-e-console"),
        # tipo que junta 2 blocos: o nome decide
        (("Antena shark teto", "Peças de Exterior", "Antenas"), "som-e-multimidia"),
        (("Antena chave presença", "Outros", "Antenas"), "modulos-e-eletrica"),
        (("Defletor radiador", "Arrefecimento", "Defletores"), "arrefecimento"),
        (("Defletor disco traseiro esquerdo", "Arrefecimento", "Defletores"), "freios"),
        # o nome manda mais que o tipo errado do ML
        (("Sensor impacto", "Injeção", "Sondas Lambda"), "airbag-e-seguranca"),
        (("Caixa ar condicionado", "Transmissão", "Câmbios e Peças Internas"), "ar-condicionado"),
        (("Botão freio estacionamento", "Peças de Interior", "Outros Botões"), "freios"),
        # "Outros" do ML: pelo nome
        (("Acabamento retrovisor dianteiro direito", "Carroceria", "Outros"), "retrovisores"),
        (("Acabamento painel esquerdo", "Carroceria", "Outros"), "painel-e-console"),
        (("Módulo freio mão elétrico EPB", "Iluminação", "Outros"), "freios"),
        (("Relé auxiliar", "Iluminação", "Outros"), "modulos-e-eletrica"),
        (("Amplificador som", "Sistema Elétrico", "Outros"), "som-e-multimidia"),
        (("Suporte motor", "Motor", "Outros"), "motor"),
        (("Sensor aceleração", "Freios", "Outros"), "freios"),          # familia coerente
        (("Suporte base fixação", "Peças de Interior", "Outros"), ""),  # nada diz: fica em Outros
    ]
    for (nome, fam, tipo), esperado in casos:
        assert bloco(nome, fam, tipo) == esperado, (nome, tipo, bloco(nome, fam, tipo), esperado)
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    resumo = ROOT / "site" / "src" / "data" / "resumo.json"
    if pecas.exists() and resumo.exists():
        from collections import Counter
        lista = json.loads(pecas.read_text(encoding="utf-8"))
        r = json.loads(resumo.read_text(encoding="utf-8"))
        validos = set(BLOCO_NOME.values()) | {"Outros"}
        assert all(x["c"] in validos for x in lista), {x["c"] for x in lista} - validos
        cont = Counter(x["c"] for x in lista)
        # resumo: os blocos na ordem fixa, com a contagem real; "Outros" (fora da grade) no fim
        fams = r["familias"]
        assert [f["k"] for f in fams if f["k"] != "outros"] == [k for k in chaves if cont[BLOCO_NOME[k]]]
        assert all(f["c"] == cont[f["n"]] for f in fams) and sum(f["c"] for f in fams) == len(lista)
        assert all(f["n"] != "Outros" for f in fams[:-1]) and all(f["k"] == "outros" for f in fams if f["n"] == "Outros")
        # o estoque muda: tipo novo do ML sem lugar, bloco vazio e "Outros" grande so AVISAM (nao travam a publicacao)
        novos = sorted({x["s"] for x in lista if x["s"] and x["s"] != "Outros" and x["s"] not in BLOCO_POR_TIPO})
        if novos:
            print(f"AVISO: tipo sem bloco no mapa (por em _TIPOS_DO_BLOCO): {novos}")
        vazios = [k for k in chaves if not cont[BLOCO_NOME[k]]]
        if vazios:
            print(f"AVISO: bloco sem peca agora (a pagina sai do ar e o endereco antigo vai pro catalogo): {vazios}")
        if cont["Outros"] >= 30:
            print(f"AVISO: {cont['Outros']} pecas em Outros (meta: menos de 30)")


def test_tipo_e_do_bloco():
    """Auditoria 3, 3.1/3.2: a peca mudava de bloco pelo nome e levava o tipo antigo ("Caixas do Filtro de Ar" em
    Maçanetas, "Sondas Lambda" em Airbag, "Buzinas" em Pedais); "Faróis e Lanternas" tinha as luzes de teto e o tipo
    "Faróis" tinha esguicho e modulo. Agora o tipo "s" e SEMPRE um tipo do bloco "c" (ou "Outros", sem cartao)."""
    from preparar_dados import (BLOCO_NOME, BLOCO_POR_TIPO, TIPO_NO_BLOCO, classificar, bloco, tipo_no_bloco)

    def bt(nome, fam, tipo):
        f, t = classificar(nome, fam, tipo)
        b = bloco(nome, f, t)
        return b, tipo_no_bloco(nome, t, b)
    casos = [
        # (nome limpo, familia do ML, tipo da loja) -> (bloco, tipo)
        (("Luz teto cortesia", "Peças de Interior", "Luzes Internas"), ("acabamentos-e-forros", "Luzes Internas")),
        (("Lanterna luz teto cortesia", "Peças de Interior", "Luzes Internas"), ("acabamentos-e-forros", "Luzes Internas")),
        (("Luz do forro de porta traseiro direito", "Iluminação", "Refletores"), ("acabamentos-e-forros", "Luzes Internas")),
        (("Luz de placa traseira", "Iluminação", "Luzes de Placa"), ("farois-e-lanternas", "Luzes de Placa")),
        (("Farol direito bi xenon", "Iluminação", "Faróis"), ("farois-e-lanternas", "Faróis")),
        (("Esguicho farol direito", "Iluminação", "Faróis"), ("limpador-e-lavador", "Bombas e Esguichos do Lavador")),
        (("Módulo alcance farol", "Iluminação", "Faróis"), ("farois-e-lanternas", "Módulos e Reatores do Farol")),
        (("Brake light (luz de freio)", "Iluminação", "Lanternas Traseiras"), ("farois-e-lanternas", "Brake Light")),
        (("Alça teto traseira esquerda", "Iluminação", "Luzes de Placa"), ("acabamentos-e-forros", "Alças e Puxadores")),
        # o nome muda o bloco: o tipo passa a ser um do bloco novo (ou "Outros")
        (("Fechadura", "Filtros", "Caixas do Filtro de Ar"), ("macanetas-e-fechaduras", "Outros")),
        (("Sensor impacto", "Injeção", "Sondas Lambda"), ("airbag-e-seguranca", "Airbags, Módulos e Sensores")),
        (("Sensor detonação impacto SRS", "Injeção", "Sensores de Detonação"),
         ("airbag-e-seguranca", "Airbags, Módulos e Sensores")),
        (("Tampa acionador buzina", "Sistema Elétrico", "Buzinas"), ("pedais-e-volante", "Volantes")),
        (("Caixa ar condicionado", "Transmissão", "Câmbios e Peças Internas"), ("ar-condicionado", "Evaporadores")),
        (("Botão freio estacionamento", "Peças de Interior", "Outros Botões"), ("freios", "Botões do Freio de Mão")),
        (("Suporte módulo injeção", "Carroceria", "Suportes da Carroceria"), ("injecao-e-combustivel", "Módulos de Injeção")),
        (("Suporte bobina ignição", "Carroceria", "Suportes da Carroceria"), ("ignicao-e-partida", "Bobinas de Ignição")),
        (("Display multimídia", "Peças de Interior", "Displays e Telas"), ("som-e-multimidia", "Centrais Multimídia")),
        # peca no tipo errado do ML: o nome leva ao sistema certo
        (("Motor limpador traseiro", "Janelas e Vedações", "Máquinas e Motores de Vidro Elétrico"),
         ("limpador-e-lavador", "Motores do Limpador")),
        (("Terminal polo positivo", "Suspensão e Direção", "Terminais de Direção"),
         ("modulos-e-eletrica", "Cabos e Terminais de Bateria")),
        (("Sensor pressão combustível", "Suspensão e Direção", "Sensores da Direção"),
         ("injecao-e-combustivel", "Sensores de Pressão")),
        (("Sensor keyless antena", "Injeção", "Sensores de Posição"), ("modulos-e-eletrica", "Antenas e Módulos Keyless")),
        (("Acabamento inferior coluna direção", "Suspensão e Direção", "Colunas de Direção"),
         ("painel-e-console", "Capas da Coluna de Direção")),
        (("Módulo bluetooth", "Sistema Elétrico", "Módulos Eletrônicos"), ("som-e-multimidia", "Interfaces de Som")),
        (("Módulo ESP", "Sistema Elétrico", "Módulos Eletrônicos"), ("freios", "Módulos ABS")),
        (("Motor ventilador interno", "Arrefecimento", "Motores de Ventilador"), ("ar-condicionado", "Atuadores e Motores do Ar")),
        # o que ja estava certo nao muda
        (("Coluna direção elétrica", "Suspensão e Direção", "Colunas de Direção"), ("suspensao-e-direcao", "Colunas de Direção")),
        (("Módulo câmbio automático", "Transmissão", "Módulos do Câmbio e da Tração"),
         ("cambio-e-transmissao", "Módulos do Câmbio e da Tração")),
        (("Módulo BSI", "Sistema Elétrico", "Módulos de Injeção"), ("modulos-e-eletrica", "Módulos de Conforto (BCM)")),
        (("Sonda lambda", "Injeção", "Sondas Lambda"), ("injecao-e-combustivel", "Sondas Lambda")),
        (("Fechadura banco traseiro", "Iluminação", "Outros"), ("macanetas-e-fechaduras", "Outros")),
    ]
    for (nome, fam, tipo), esperado in casos:
        assert bt(nome, fam, tipo) == esperado, (nome, tipo, bt(nome, fam, tipo), esperado)
    # tipo que o mapa nao conhece fica (o teste dos blocos avisa); tipo do proprio bloco fica
    assert tipo_no_bloco("Peça nova", "Tipo Novo do ML", "motor") == "Tipo Novo do ML"
    assert tipo_no_bloco("Coxim motor", "Coxins do Motor", "motor") == "Coxins do Motor"
    # as regras de cada bloco so dao tipos daquele bloco
    fora = [(b, t) for b, rs in TIPO_NO_BLOCO.items() for _, t in rs if BLOCO_POR_TIPO.get(t) != b]
    assert not fora, fora
    assert set(TIPO_NO_BLOCO) <= set(BLOCO_NOME), set(TIPO_NO_BLOCO) - set(BLOCO_NOME)
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        lista = json.loads(pecas.read_text(encoding="utf-8"))
        # garantido pelo codigo (tipo_no_bloco), vale para qualquer estoque: nenhum tipo conhecido fora do bloco dele
        ruins = sorted({(x["c"], x["s"]) for x in lista
                        if x["s"] in BLOCO_POR_TIPO and BLOCO_NOME[BLOCO_POR_TIPO[x["s"]]] != x["c"]})
        assert not ruins, ruins
        assert not any(x["s"] == "Luzes Internas" and x["c"] == "Faróis e Lanternas" for x in lista)


def test_descricao_sem_promessa():
    """Auditoria 3, 2.1: o modelo de anuncio promete "encaixe perfeito" (2.313), "excelente estado" (3.025), "100%
    testado", "garantida", "testada e aprovada pela nossa equipe técnica" e "semi nova". Vira o fato neutro ou sai."""
    import re
    import preparar_dados as pd
    texto = ("IDENTIFICACAO DA PECA\n====\n+ Peca: Tampa cobertura motor\n+ Material: Plastico\n"
             "+ Condicao: usado em excelente estado de conservacao (semi nova / seminova)\n\n"
             "APLICACAO E COMPATIBILIDADE\n====\nEsta peca foi removida diretamente de um veiculo Volvo XC60 ano "
             "modelo 2018 a 2024. Mesmo OEM = encaixe perfeito, sem adaptacoes, sem furadeira.\n"
             "1) Comparar com fotos reais do anuncio (mostramos a peca, nao foto generica);\n\n"
             "CONDICAO REAL DA PECA\n====\nPeca em excelente estado de conservacao, testada e aprovada pela nossa "
             "equipe tecnica. Funcionamento 100% testado. Removida de veiculo nacional com baixa quilometragem. "
             "Com cinco furos, sua compatibilidade e garantida para modelos selecionados. Estado: Testada e em "
             "perfeito funcionamento. Inspecionada visualmente antes da postagem. Testado - motor gira.\n")
    h = pd.descricao(texto)
    proibido = re.compile(r"encaixe perfeito|excelente|100\s*%|garantid|perfeito funcionamento|sem adapta|furadeira|"
                          r"semi ?nova|seminova|aprovada pela nossa equipe|an[uú]ncio", re.I)
    assert not proibido.search(h), proibido.search(h).group(0)
    assert "Mesmo código do original." in h, h
    assert "<li>Condição: Peça usada conferida; o estado aparece nas fotos</li>" in h, h
    assert h.count("Peça usada conferida") == 1, h                      # o neutro uma vez so
    assert "Removida de veículo nacional com baixa quilometragem." in h, h   # o fato que estava junto fica
    assert "Testado - motor gira." in h, h                                 # nota da propria peca fica
    assert "fotos reais da peça" in h, h
    # frases sem promessa nao mudam
    assert pd._sem_promessa("Sem trincas estruturais.") == "Sem trincas estruturais."
    assert pd._sem_promessa("Material: Plástico") == "Material: Plástico"
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        lista = json.loads(pecas.read_text(encoding="utf-8"))
        # no gerado so AVISA: texto novo do vendedor nao pode travar a publicacao
        ruins = [x["id"] for x in lista if proibido.search(x["desc"])]
        if ruins:
            print(f"AVISO: {len(ruins)} descricoes ainda com promessa ou 'anuncio': {ruins[:5]}")
        dobrado = [x["id"] for x in lista if x["desc"].count(pd.ESTADO_NEUTRO) > 1]
        if dobrado:
            print(f"AVISO: {len(dobrado)} descricoes com o texto neutro do estado repetido: {dobrado[:5]}")


def test_peca_em_dois_carros():
    """Auditoria 2, L5: "Volvo S60 Xc60" serve nos dois. Antes so o S60 contava: o dono do XC60 nao via
    a peca na pagina do carro, no filtro nem no Meu carro (a busca achava 515, o carro mostrava 475)."""
    from preparar_dados import modelos_do_titulo, anos_por_modelo, nome_limpo, modelos_de, anos_no_modelo
    volvo = {("Volvo", "s60"): "S60", ("Volvo", "xc60"): "XC60"}
    # chassi nao e outro carro: "320i E90" nao vira "Série 3" (juntar os modelos e decisao do dono, item L4)
    bmw = {("BMW", "320i"): "320i", ("BMW", "serie3"): "Série 3", ("BMW", "530i"): "530i", ("BMW", "serie5"): "Série 5"}
    assert modelos_do_titulo("BMW", ["320i", "E90"], "320i", bmw) == ["320i"]
    assert modelos_do_titulo("BMW", ["330i", "530i", "E46", "E60"], "530i", bmw) == ["530i"]
    merc = {("Mercedes-Benz", "c320"): "C320", ("Mercedes-Benz", "classec"): "Classe C",
            ("Mercedes-Benz", "c180"): "C180", ("Mercedes-Benz", "c200"): "C200"}
    assert modelos_do_titulo("Mercedes-Benz", ["C320", "W203"], "C320", merc) == ["C320"]
    assert modelos_do_titulo("Mercedes-Benz", ["C180", "C200"], "C180", merc) == ["C180", "C200"]   # os 2 escritos
    assert modelos_do_titulo("Volvo", ["S60", "Xc60", "T8"], "S60", volvo) == ["S60", "XC60"]   # T8 e versao
    citroen = {("Citroën", "c4cactus"): "C4 Cactus", ("Citroën", "c4"): "C4"}
    assert modelos_do_titulo("Citroën", ["C4", "Cactus"], "C4 Cactus", citroen) == ["C4 Cactus"]  # nome composto
    vw = {("Volkswagen", "gol"): "Gol", ("Volkswagen", "voyage"): "Voyage"}
    assert modelos_do_titulo("Volkswagen", ["Gol", "Voyage", "G6"], "Gol", vw) == ["Gol", "Voyage"]  # G6 e geracao
    fiat = {("Fiat", "toro"): "Toro", ("Fiat", "argo"): "Argo"}
    assert modelos_do_titulo("Fiat", ["Toro", "Argo", "Renegade"], "Toro", fiat) == ["Toro", "Argo"]  # Jeep fica fora
    assert modelos_do_titulo("Volvo", ["S60"], "S60", volvo) == ["S60"]
    # a faixa do titulo vale para todos, cortada no periodo de venda de cada carro
    assert anos_por_modelo(["Fit", "WR-V"], "Honda", 2015, 2021) == (["Fit", "WR-V"], [[2015, 2021], [2017, 2021]])
    assert anos_por_modelo(["S60", "XC60"], "Volvo", 2018, 2024) == (["S60", "XC60"], None)
    assert anos_por_modelo(["Palio", "Argo"], "Fiat", 2004, 2012) == (["Palio"], None)       # Argo em 2004: impossivel
    # os outros carros saem do nome, como o modelo
    assert nome_limpo("Alternador Fiat Palio Siena Strada 1.0 15/21 83631750", "Fiat", "Palio",
                      ["Palio", "Siena", "Strada"]) == "Alternador"
    x = {"m": "Fit", "y": [2015, 2021], "ms": ["Fit", "WR-V"], "ys": [[2015, 2021], [2017, 2021]]}
    assert modelos_de(x) == ["Fit", "WR-V"] and anos_no_modelo(x, "WR-V") == [2017, 2021]
    assert modelos_de({"m": "XC60", "y": None}) == ["XC60"] and modelos_de({"m": "", "y": None}) == []
    pasta = ROOT / "site" / "src" / "data"
    if (pasta / "pecas.json").exists():
        from collections import Counter
        pecas = json.loads((pasta / "pecas.json").read_text(encoding="utf-8"))
        resumo = json.loads((pasta / "resumo.json").read_text(encoding="utf-8"))
        busca = json.loads((ROOT / "site" / "public" / "dados" / "busca.json").read_text(encoding="utf-8"))
        conta = Counter((x["b"], mod) for x in pecas if x["b"] for mod in modelos_de(x))
        for c in resumo["carros"]:          # a pagina do carro conta a peca de 2+ carros em cada um
            assert c["c"] == conta[(c["b"], c["m"])], (c["k"], c["c"], conta[(c["b"], c["m"])])
        for i, x in enumerate(pecas):
            if x.get("ms"):
                assert x["ms"][0] == x["m"] and len(x["ms"]) == len(set(x["ms"])) >= 2, x["id"]
                assert busca["ms"][str(i)] == x["ms"], x["id"]
                assert not x.get("ys") or (len(x["ys"]) == len(x["ms"]) and busca["ys"][str(i)] == x["ys"]), x["id"]
            else:
                assert str(i) not in busca["ms"] and not x.get("ys"), x["id"]


def test_descricao_sem_lixo_do_ml():
    """Auditoria 2, L2: "chat do anuncio" (o site nao tem chat), "sem giria", o paragrafo da condicao
    duas vezes, o mesmo dado nas duas listas, "Codigo OEM: SEM CODIGO" e a medida-padrao do modelo de
    anuncio (25 x 18 x 15 cm em pecas de todo tamanho) saem."""
    import preparar_dados as pd
    texto = ("MACANETA INTERNA ESQ RENAULT SANDERO DUSTER - ORIGINAL DE FABRICA - OEM 8200733848\n\n"
             "Peca original RENAULT SANDERO DUSTER (2008 ate 2022). Codigo OEM 8200733848. Procedencia legal.\n\n"
             "====\nIDENTIFICACAO DA PECA\n====\n+ Peca: Macaneta Interna Esq\n+ Codigo OEM (Original Equipment "
             "Manufacturer): 8200733848\n+ Codigo de fabrica / Part Number: 8200733848\n+ Material: Plastico\n"
             "+ Cor predominante: Preto\n+ Condicao: Em excelente estado de conservacao\n+ Anos:\n\n"
             "====\nAPLICACAO E COMPATIBILIDADE\n====\nMesmo OEM = encaixe perfeito, sem adaptacoes, sem giria, "
             "sem furadeira.\nPara garantir a compatibilidade exata, recomendamos:\n1) Conferir o codigo OEM;\n"
             "2) Em duvida, envie mensagem pelo chat do anuncio - identificamos na hora.\n\n"
             "====\nESPECIFICACOES TECNICAS\n====\n+ Material: Plastico\n+ Cor: Preto\n+ Comprimento da peca: 25 cm\n"
             "+ Largura da peca: 18 cm\n+ Altura da peca: 15 cm\n+ Peso aproximado embalagem: 1500 g\n"
             "+ Condicao: Em excelente estado\n\n"
             "====\nCONDICAO REAL DA PECA\n====\nSem trincas estruturais, sem rachaduras visiveis e sem partes "
             "faltando.\nPode apresentar discretos sinais superficiais, compativeis com armazenamento e manuseio.\n"
             "Caso exista qualquer detalhe relevante, ele sera demonstrado nas fotos do anuncio.\n\n"
             "====\nPeca em excelente estado de conservacao.\nSem trincas estruturais, sem rachaduras visiveis, sem "
             "partes faltando.\nPode apresentar discretos sinais superficiais.\nSe a peca tiver qualquer detalhe "
             "relevante, mostramos nas fotos do anuncio.\n\n"
             "====\nFUNCAO\n====\nMacaneta Interna: peca original responsavel pela funcao correspondente no veiculo. "
             "Codigo OEM sem codigo. Substituicao recomendada quando houver desgaste.\n")
    antes = set(pd._DIM_PADRAO)
    try:
        pd._DIM_PADRAO.clear()
        pd._DIM_PADRAO.add(("25", "18", "15"))
        h = pd.descricao(texto, "Maçaneta interna esquerda")
    finally:
        pd._DIM_PADRAO.clear()
        pd._DIM_PADRAO.update(antes)
    assert "chat" not in h and "gíria" not in h and "giria" not in h, h
    assert "<li>Em dúvida, chame a gente no WhatsApp.</li>" in h, h
    # auditoria 3, 2.1: a promessa pronta do modelo vira o fato ("mesmo codigo do original"), sem "encaixe perfeito"
    assert "Mesmo código do original." in h and "encaixe" not in h and "furadeira" not in h and "adaptações" not in h, h
    assert "ORIGINAL DE FABRICA" not in h.upper() or "original de fábrica - OEM" not in h, h       # a manchete sai
    assert h.count("Sem trincas") == 1, h                                   # o paragrafo da condicao, uma vez
    assert h.count("Material: Plástico") == 1 and h.count("Preto") == 1, h  # o mesmo dado nas duas listas
    assert "Código OEM: 8200733848" in h and "Part Number" not in h, h
    assert "excelente" not in h and h.count("Peça usada conferida; o estado aparece nas fotos") == 1, h  # o neutro, 1 vez
    assert "25 cm" not in h and "1500 g" not in h, h                        # medida-padrao do modelo
    assert "Anos:" not in h and "sem código" not in h.lower(), h
    assert "função correspondente" not in h and "Substituição recomendada quando houver desgaste." in h, h
    assert "<li>Peça: Maçaneta interna esquerda</li>" in h, h               # o nome limpo, nao "Esq"
    # medida que nao e o padrao fica
    h2 = pd.descricao("ESPECIFICACOES TECNICAS\n====\n+ Comprimento da peca: 11 cm\n+ Largura da peca: 21 cm\n"
                      "+ Altura da peca: 43 cm\n")
    assert "11 cm" in h2 and "43 cm" in h2, h2
    assert pd.dimensoes_padrao([texto] * pd.DIM_PADRAO_MIN) == {("25", "18", "15")}
    assert pd.dimensoes_padrao([texto] * (pd.DIM_PADRAO_MIN - 1)) == set()
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        import re
        # no gerado so AVISA: o vendedor pode mudar o modelo do anuncio (nao pode travar a publicacao)
        ruim = re.compile(r"chat do an|g[ií]ria|sem c[oó]digo|m[uú]ltiplas fontes|fun[cç][aã]o correspondente", re.I)
        ruins = [x["id"] for x in json.loads(pecas.read_text(encoding="utf-8")) if ruim.search(x["desc"])]
        if ruins:
            print(f"AVISO: {len(ruins)} descricoes ainda com lixo do anuncio: {ruins[:5]}")


def test_nome_sem_lado_repetido_nem_codigo_minusculo():
    """Auditoria 2, L6: lado repetido ("esquerda esquerdo/motorista"), trecho dobrado, "Break light fuz
    freio" e codigo de motor em minuscula ("m270")."""
    from preparar_dados import nome_limpo
    casos = [
        ("Lanterna Traseira Esquerda Esquerdo/motorista Volvo Xc60 18/24 31420415", "Volvo", "XC60",
         "Lanterna traseira esquerda"),
        ("Lanterna Tampa Traseira Direita Direito/passageiro Jeep Compass 17/21", "Jeep", "Compass",
         "Lanterna tampa traseira direita"),
        ("Macaneta Interna Esquerda Cromada Lado Esquerdo (motorista) Hyundai Hb20 12/19", "Hyundai", "HB20",
         "Maçaneta interna esquerda cromada"),
        ("Quebra Sol Motorista Esquerdo Fiat Toro 16/24", "Fiat", "Toro", "Quebra-sol esquerdo"),
        ("Quebra Sol Direito Passageiro Fiat Toro 16/24", "Fiat", "Toro", "Quebra-sol direito"),
        ("Moldura Painel Instrumentos Moldura Painel Instrumentos Volvo Xc60 18/24", "Volvo", "XC60",
         "Moldura painel instrumentos"),
        ("Break Light Luz Freio Volvo Xc60 18/24 31395779", "Volvo", "XC60", "Brake light (luz de freio)"),
        ("Break Light Fuz Freio Fiat Toro 16/24", "Fiat", "Toro", "Brake light (luz de freio)"),
        ("Luz De Freio Break Light Fiat Toro 16/24", "Fiat", "Toro", "Luz de freio (brake light)"),
        ("Chicote Chassis B200 W246 Mercedes 12/18", "Mercedes-Benz", "", "Chicote chassis B200 W246"),
        # lado diferente fica: e outra informacao
        ("Par Lanterna Esquerda Direita Volvo Xc60 18/24", "Volvo", "XC60", "Par lanterna esquerda direita"),
        # sem modelo no cartao: o carro escrito no nome e a pista, com a grafia certa
        ("Botao Retrovisor Nissan Versa Kicks 2017", "Nissan", "", "Botão retrovisor Versa Kicks"),
    ]
    for titulo, marca, modelo, esperado in casos:
        assert nome_limpo(titulo, marca, modelo) == esperado, (titulo, nome_limpo(titulo, marca, modelo))
    # "polo" da bateria nao vira carro quando a peca ja tem modelo
    assert nome_limpo("Cabo Polo Negativo Bateria Jaguar E-pace 18/24", "Jaguar", "E-Pace") == "Cabo polo negativo bateria"


def test_codigo_de_enchimento():
    """Auditoria 2, L8: "101010101" e enchimento, nao codigo gravado na peca."""
    from preparar_dados import codigo_valido
    for lixo in ("101010101", "1212121", "5555551", "010101", "123123"):
        assert not codigo_valido(lixo), lixo
    for bom in ("1J0858601", "030864", "31476671", "9806675280", "1000001"):
        assert codigo_valido(bom), bom


def test_descricao_acentos_e_perfeito_estado():
    """Auditoria 4, 7.3: "botoes", "saidas", "Alem", "Genuino", "esteticos" saiam sem acento na descricao, e
    "perfeito estado de funcionamento" e promessa sem olhar a peca (vira o texto neutro)."""
    from preparar_dados import descricao, acentuar_texto, ESTADO_NEUTRO
    assert acentuar_texto("Botoes de controle e saidas de ar") == "Botões de controle e saídas de ar"
    assert acentuar_texto("Alem disso, peca Genuino com acabamentos esteticos") == "Além disso, peça Genuíno com acabamentos estéticos"
    assert acentuar_texto("BOTOES") == "BOTÕES"
    d = descricao("CONDICAO\nPeça usada original em perfeito estado de funcionamento.\nCom os botoes do painel.", "Painel")
    txt = str(d)
    assert "perfeito estado" not in txt
    assert ESTADO_NEUTRO in txt
    assert "botões" in txt and "botoes" not in txt


def test_nome_sem_palavra_repetida():
    """Auditoria 4, 3.3: a mesma palavra de novo no fim do nome sai; versao com a grafia da marca."""
    from preparar_dados import _sem_palavra_repetida
    assert _sem_palavra_repetida("Jogo bancos terracota interior xdrive kit terracota") == "Jogo bancos terracota interior xDrive kit"
    assert _sem_palavra_repetida("Motor atuador termostato motor") == "Motor atuador termostato"
    # palavra curta e lado ficam (sao outra informacao)
    assert _sem_palavra_repetida("Par lanterna esquerda direita") == "Par lanterna esquerda direita"
    assert _sem_palavra_repetida("Kit par de molas par") == "Kit par de molas par"


def test_nome_sem_outro_carro_pedaco_de_codigo_nem_cor():
    """Revisão 7, P3.9: outro carro no meio do nome ("...anti ruído evoque suporte do rádio" do Discovery), pedaço
    de código do anúncio ("2s65", "801b"), a cor que sobra ("cor", "Amarelo (tampa)"), acento ("reles") e o gênero
    trocado pelo anúncio ("Lanterna traseira esquerdo"). Regras gerais, nunca por peça."""
    import preparar_dados as pd
    novos = {"evoque", "golf", "pulse"} - pd._CONHECIDOS_GLOBAL      # sem o main(): os carros do estoque à mão
    pd._CONHECIDOS_GLOBAL.update(novos)
    try:
        casos = [
            ("Sensor Módulo Antena Anti Ruido Discovery Evoque Original Suporte Do Radio Land Rover Discovery 4 2012",
             "Land Rover", "Discovery", "Sensor módulo antena anti ruído Evoque suporte do rádio"),
            ("Motor Vidro Eletrico Direito Audi A3 Vw Golf Mqb 13/21 801b", "Audi", "A3", "Motor vidro elétrico direito"),
            ("Mangueira Filtro Ar Pulse Fastback Jeep Compass 21/26 520798", "Jeep", "Compass", "Mangueira filtro ar"),
            ("Macaneta Interna Diant Dir Ford Fiesta New Fiesta 02/12 2s65 Preto", "Ford", "Fiesta",
             "Maçaneta interna dianteira direita"),
            ("Caixa Fusiveis Reles Motor Hyundai Genesis 09/14 Original", "Hyundai", "Genesis", "Caixa fusíveis relés motor"),
            ("Gargalo Reservatorio Agua Parabrisa Fiat Toro 16/24 90569800 Amarelo (tampa) / Branco (corpo)", "Fiat",
             "Toro", "Gargalo reservatório água para-brisa"),
            ("Modulo Conforto Sensor De Estacionamento Vw Up 1sb919475 Cor Preto", "Volkswagen", "Up",
             "Módulo conforto sensor de estacionamento"),
            ("Grade Churrasqueira Citroen C3 2024 Preto Fosco", "Citroën", "C3", "Grade churrasqueira"),
            ("Tubo Flexivel Escapamento Volvo Xc60 18/24 31465022 Prata Metálico", "Volvo", "XC60", "Tubo flexível escapamento"),
            ("Lanterna Traseira Esquerdo Audi A4 09/12 8k5945093d", "Audi", "A4", "Lanterna traseira esquerda"),
            ("Acabamento Externo Dianteira Direito Vw Passat 07/12 Preto", "Volkswagen", "Passat",
             "Acabamento externo dianteiro direito"),
            ("Motor Vidro Eletrico Dianteiro Direito Fiat Toro 16/26 Bosch", "Fiat", "Toro",
             "Motor vidro elétrico dianteiro direito Bosch"),
            # o que fica: a medida, o código de motor, o "polo" da bateria, o computador de bordo, a tampa traseira
            ("Chave Roda 17mm Vw Audi Original 4d0012219a", "Volkswagen", "", "Chave roda 17mm"),
            ("Chicote Chassis B200 W246 Mercedes 12/18", "Mercedes-Benz", "", "Chicote chassis B200 W246"),
            ("Cabo Polo Negativo Bateria Jaguar E-pace 18/24", "Jaguar", "E-Pace", "Cabo polo negativo bateria"),
            ("Display Computador Bordo Renault Sandero 08/14 8200722451", "Renault", "Sandero", "Display computador bordo"),
            ("Amortecedor Tampa Traseira Direito Honda Wr-v 2026 7482031xj", "Honda", "WR-V",
             "Amortecedor tampa traseira direito"),
            # sem modelo no cartão, o carro do nome é a pista: fica
            ("Botao Retrovisor Nissan Versa Kicks 2017", "Nissan", "", "Botão retrovisor Versa Kicks"),
        ]
        for titulo, marca, modelo, esperado in casos:
            assert pd.nome_limpo(titulo, marca, modelo) == esperado, (titulo, pd.nome_limpo(titulo, marca, modelo))
    finally:
        pd._CONHECIDOS_GLOBAL.difference_update(novos)


def test_foto_do_cartao_na_ordem_da_galeria():
    """"i" do busca.json = a 1a foto da galeria (fotosGaleria do site): sem marketing, montagem com o carro no fim."""
    from preparar_dados import fotos_galeria
    cl = {"a": "c", "b": "m", "c1": "p", "d": "s"}
    assert fotos_galeria(["a", "b", "c1", "d"], cl) == ["c1", "d", "a"]
    assert fotos_galeria(["a"], cl) == ["a"]                    # so a montagem: fica (nunca peca sem foto)
    assert fotos_galeria(["b"], cl) == ["b"]                    # tudo marketing: a lista como veio
    assert fotos_galeria(["x", "a", "y"], {}) == ["x", "a", "y"]   # sem classe: a ordem do anuncio
    assert fotos_galeria([], cl) == []
    busca = ROOT / "site" / "public" / "dados" / "busca.json"
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if busca.exists() and pecas.exists():
        from preparar_dados import ler_classes_fotos
        classes = ler_classes_fotos()
        b = json.loads(busca.read_text(encoding="utf-8"))
        por_id = {x["id"]: x for x in json.loads(pecas.read_text(encoding="utf-8"))}
        ruins = [i for i, f in zip(b["id"], b["i"])
                 if f != (fotos_galeria(por_id[i]["fotos"], classes) or [""])[0]] if set(b["id"]) <= set(por_id) else []
        assert not ruins, f"{len(ruins)} pecas com o 'i' fora da ordem da galeria: {ruins[:5]}"
        monta = [i for i, f in zip(b["id"], b["i"]) if classes.get(f) == "c"
                 and any(classes.get(k) != "c" for k in fotos_galeria(por_id[i]["fotos"], classes))]
        assert not monta, f"{len(monta)} pecas com a montagem no 'i' tendo foto da peca: {monta[:5]}"


def test_palavra_cortada_no_fim_e_modelo_colado():
    """Rodada 8: "AT9 die" (diesel cortado pelo limite do ML), "multimedia" sem acento e o "X32.0" (X3 2.0) sem modelo."""
    import preparar_dados as pd
    assert pd.nome_limpo("Engrenagem Planetaria Câmbio At9 Fiat Toro 2.0 2.2 15/21 Die", "Fiat", "Toro") \
        == "Engrenagem planetária câmbio AT9 diesel"
    assert pd.palavra_cortada("Die") == "diesel" and pd.palavra_cortada("gasol") == "gasolina"
    assert pd.palavra_cortada("gas") is None          # palavra conhecida ("gás"), nunca pedaço
    assert pd.palavra_cortada("compl") is None        # abreviação: o nome resolve ("completa")
    assert pd.palavra_cortada("Bosch") is None
    # título curto: a última palavra não foi cortada pelo ML
    assert pd.nome_limpo("Bico Injetor Fiat Toro Die", "Fiat", "Toro").endswith("die")
    assert pd.nome_limpo("Central Multimedia Peugeot 208 13/18 9809503580 Original", "Peugeot", "208") == "Central multimídia"
    k = {"x3", "q5", "xc60"}
    assert pd.limpar_titulo("Mangueira Ventilação Cárter Bmw X32.0 18/24 11157623746", k) \
        == "Mangueira Ventilação Cárter Bmw X3 2.0 18/24 11157623746"
    assert pd.palavras(pd.limpar_titulo("Mangueira Cárter Bmw X32.0 18/24", k), "BMW") == ["X3"]
    assert pd.limpar_titulo("Sensor Abc12.0 Vw Gol", k) == "Sensor Abc12.0 Vw Gol"   # não é carro: não parte


def test_descricao_sem_espanhol_e_sem_tu():
    """Rodada 8: descrição copiada em espanhol (câmera de ré do WR-V) e "quando tu freia" no texto do vendedor."""
    import preparar_dados as pd
    es = ("La cámara de reversa para Honda WR-V 2017 a 2021 es un accesorio esencial para mejorar la seguridad y la "
          "comodidad al conducir. Su instalación es sencilla.")
    assert pd.descricao(es) == ""                                  # tudo em espanhol: só a ficha
    misto = "Peça original do Honda WR-V, conferida.\n" + es
    assert pd.descricao(misto) == "<p>Peça original do Honda WR-V, conferida.</p>"
    # português com palavras que o espanhol também usa: fica
    pt = "Para garantir a compatibilidade exata, recomendamos conferir o código da peça antes de comprar."
    assert not pd._espanhol(pt) and pd.descricao(pt).startswith("<p>Para garantir")
    assert "você freia" in pd.descricao("A lanterna serve pra sinalizar pro carro de tras quando tu freia, da re ou liga o pisca.")
    assert pd.sem_tu("Tu tens a peça certa. Confira teu carro e tua nota.") == "Você tem a peça certa. Confira seu carro e sua nota."
    assert pd.sem_tu("pronto pra te ajudar") == "pronto pra ajudar você"
    assert pd.sem_tu("Peça para Hyundai Tucson tubo") == "Peça para Hyundai Tucson tubo"
    assert not pd._espanhol("módulo câmbio automático AL4, Peugeot 307 módulo câmbio, Citroën C4 módulo câmbio AL4 EN590 ES9")
    # estoque real: só AVISA (o estoque muda a cada rodada; não pode travar a publicação)
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        import re
        por = json.loads(pecas.read_text(encoding="utf-8"))
        es = [x["id"] for x in por if pd._espanhol(re.sub(r"<[^>]+>", " ", x["desc"]))]
        tu = [x["id"] for x in por if re.search(r"\b(tu|teu|tua|teus|tuas)\b", re.sub(r"<[^>]+>", " ", x["desc"]))]
        if es or tu:
            print(f"AVISO: descrição com cara de espanhol {es[:5]} | com 'tu' {tu[:5]}")


def test_mesma_peca_precos_diferentes_dif():
    """Cliente oculto 10/11 (atrito 7): mesmo codigo, mesmo carro e precos diferentes. A pilula "dif" diz a versao que o
    TITULO traz ("T8" no retrovisor A044297 de R$ 3.785); sem diferenca no titulo, sem pilula (nunca inventar)."""
    import preparar_dados as pd
    assert pd._texto_versao(pd.versao_do_titulo("Retrovisor Eletrico Esquerdo Volvo Xc60 T8 18/24 A044297 Ori")) == "T8"
    assert pd._texto_versao(pd.versao_do_titulo("Coxim Inferior Volvo Xc60 Xc90 T5 T6 2.0 18/24 31359890")) == "T5/T6 2.0"
    assert pd._texto_versao(pd.versao_do_titulo("Corpo Borboleta Tbi Dodge Journey 3.6 V6 11/19 05184349ac")) == "3.6 V6"
    assert pd._texto_versao(pd.versao_do_titulo("Corpo Borboleta Tbi Fiat Strada 1.6 1.8 16v 12/21 55254306")) == "1.6/1.8 16V"
    assert pd._texto_versao(pd.versao_do_titulo("Porta Luvas Volkswagen Gol Voyage G5 G6 09/12 5u1857097")) == "G5/G6"
    assert pd._texto_versao(pd.versao_do_titulo("Roda Aro 17 Mercedes C 200 W204 08/14 A2044017502 Preto")) == "W204"
    # nada de modelo, ano, codigo, voltagem ou palavra cortada como versao
    assert pd.versao_do_titulo("Lanterna Volvo S60 V60 Xc60 18/24 31655925 12v Ori") == []
    assert pd.versao_do_titulo("Peugeot 2008 208 C3 Hb20 S10 Q3 X6 A200 Gla200") == []

    def peca(i, t, p, o="a044297", m="XC60", n="Retrovisor elétrico esquerdo"):
        return {"id": f"MLB{i}", "t": t, "p": p, "o": o, "b": "Volvo", "m": m, "n": n}
    # o caso do relatorio: so o mais caro diz T8
    g = [peca(1, "Retrovisor Eletrico Esquerdo Volvo Xc60 18/24 A044297 Origi", 2799.77),
         peca(2, "Retrovisor Eletrico Esquerdo Volvo Xc60 T8 18/24 A044297 Ori", 3785.77)]
    assert pd.diferencas(g) == 1 and "dif" not in g[0] and g[1]["dif"] == "T8"
    # mesma versao nas duas (T8 e T8; T5 e "T5 2.0"): sem pilula
    g = [peca(1, "Mangueira Ar Condicionado Volvo Xc60 T8 18/24 31389351", 286.44, "31389351"),
         peca(2, "Mangueira Ar Condicionado Volvo Xc60 T8 18/24 31389351", 365.44, "31389351")]
    g += [peca(3, "Tampa Bomba Combustivel Volvo Xc60 T5 18/25 31395822 Preto 2018", 174.44, "31395822"),
          peca(4, "Tampa Bomba Combustivel Volvo Xc60 T5 2.0 18/24 31395822 Preto 2018", 229.98, "31395822")]
    assert pd.diferencas(g) == 0
    # so o ano muda (o cartao ja mostra): sem pilula
    g = [peca(1, "Motor Vidro Eletrico Diant Dir Ford Focus 13/15 0130822214", 243.77, "0130822214", "Focus"),
         peca(2, "Motor Vidro Eletrico Diant Dir Ford Focus 09/13 0130822214", 379.77, "0130822214", "Focus")]
    assert pd.diferencas(g) == 0
    # mesmo preco: nao e grupo; outro carro: outro grupo
    g = [peca(1, "Retrovisor Volvo Xc60 18/24 A044297", 100.0), peca(2, "Retrovisor Volvo Xc60 T8 18/24 A044297", 100.0),
         peca(3, "Retrovisor Volvo S60 T8 18/24 A044297", 300.0, m="S60")]
    assert pd.diferencas(g) == 0
    # sem versao em nenhuma: o motor; sem motor: a cor que o titulo diz, na ordem dele
    g = [peca(1, "Sensor Fluxo Ar Onix Prisma 1.0 1.4 12/16 15865791", 148.33, "15865791", "Onix"),
         peca(2, "Sensor Fluxo Ar Chevrolet Onix Prisma 1.0 12/16 15865791", 264.64, "15865791", "Onix")]
    g += [peca(3, "Antena Teto Shark Volvo S60 18/24 31346765 Cinza Preto", 741.77, "31346765", "S60"),
          peca(4, "Antena Teto Shark Volvo S60 Xc60 V60 18/24 31346765 Preto", 843.77, "31346765", "S60")]
    pd.diferencas(g)
    assert [x.get("dif") for x in g] == ["1.0/1.4", "1.0", "Cinza e preto", "Preto"]
    # o dado gerado: "dif" so nas pecas de um grupo, e o busca.json leva o mapa esparso
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    busca = ROOT / "site" / "public" / "dados" / "busca.json"
    if pecas.exists() and busca.exists():
        por = json.loads(pecas.read_text(encoding="utf-8"))
        ix = json.loads(busca.read_text(encoding="utf-8"))
        com = {x["id"]: x["dif"] for x in por if x.get("dif")}
        if com:
            assert {ix["id"][int(k)]: v for k, v in (ix.get("dif") or {}).items()} == com
            assert all(len(v) <= 24 for v in com.values())


FIM_PREPOSICAO = {"de", "da", "do", "das", "dos", "com", "para", "em", "e"}


def test_nome_nunca_termina_em_preposicao():
    """Revisão 12, P2.2: "Coletor Admissao De Volvo Xc60..." virava "Coletor admissão de" (o carro sai e a preposição
    sobrava). Regra geral: o nome limpo nunca termina em de/da/do/das/dos/com/para/em/e (a palavra inteira: "drive-e" e
    "d/e" ficam)."""
    import preparar_dados as pd
    casos = [
        ("Coletor Admissao De Volvo Xc60 T8 Hybrid 2018/2024 P31441970", "Volvo", "XC60", "Coletor admissão"),
        ("Sensor Temperatura Interna Volvo Xc60 18/24 32289547 Preto Com Prata", "Volvo", "XC60",
         "Sensor temperatura interna"),
        ("Bomba D'água Original Volvo Xc60 2.0 T8 Híbrido Drive-e 2022", "Volvo", "XC60", "Bomba d'água drive-e"),
        ("Apoio Braco Forro Porta Couro Bmw 530 E60 03/11 1054337 D/e Preto", "BMW", "530i",
         "Apoio braço forro porta couro d/e"),
    ]
    for titulo, marca, modelo, esperado in casos:
        assert pd.nome_limpo(titulo, marca, modelo) == esperado, (titulo, pd.nome_limpo(titulo, marca, modelo))
    # o estoque inteiro: a última palavra (separada por espaço) de nenhum nome é uma preposição solta
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    if pecas.exists():
        ruins = [(p["id"], p["n"]) for p in json.loads(pecas.read_text(encoding="utf-8"))
                 if gi_sem(p["n"].split()[-1] if p["n"].split() else "") in FIM_PREPOSICAO]
        assert not ruins, ruins


def test_lado_e_posicao_pelo_nome():
    """Fichas "Esquerdo · Direito" e "Dianteiro · Traseiro" do catálogo: o lado e a posição que o nome limpo diz."""
    from preparar_dados import lado_posicao
    casos = {
        "Retrovisor elétrico direito": ("D", ""),
        "Lanterna traseira esquerda": ("E", "T"),
        # a porta-malas fica atrás: o que vai nela é traseiro (e o lado continua valendo)
        "Lanterna tampa traseira esquerda": ("E", "T"),
        "Amortecedor tampa traseira": ("", "T"),
        "Porta dianteira esquerda": ("E", "D"),
        "Para-choque dianteiro": ("", "D"),
        "Câmera frontal": ("", "D"),
        # no Brasil o motorista vai à esquerda
        "Airbag motorista": ("E", ""),
        "Botão vidro elétrico passageiro": ("D", ""),
        "Retrovisor lado motorista": ("E", ""),
        # a luz do airbag do passageiro fica no meio do painel
        "Painel luz airbag passageiro": ("", ""),
        # os dois lados ou as duas posições: nenhum
        "Acabamento trilho esquerdo banco direito": ("", ""),
        # as duas posições: serve nas duas (entra nas duas fichas)
        "Maçaneta externa direita dianteira/traseira": ("D", "A"),
        "Módulo injeção": ("", ""),
    }
    for nome, esperado in casos.items():
        assert lado_posicao(nome) == esperado, (nome, lado_posicao(nome))
    # o nome sem posição usa a do tipo da peça
    assert lado_posicao("Lanterna mala esquerda", "Lanternas Traseiras") == ("E", "T")
    assert lado_posicao("Lanterna dianteira", "Lanternas Traseiras") == ("", "D")
    # o dado gerado: uma letra por peça, igual ao que o nome diz
    pecas = ROOT / "site" / "src" / "data" / "pecas.json"
    busca = ROOT / "site" / "public" / "dados" / "busca.json"
    if pecas.exists() and busca.exists():
        ix = json.loads(busca.read_text(encoding="utf-8"))
        if "l" in ix:
            assert len(ix["l"]) == len(ix["id"]) == len(ix["pos"])
            assert set(ix["l"]) <= set("ED0") and set(ix["pos"]) <= set("DTA0")
            tipos = [ix["tipos"][i] if i >= 0 else "" for i in ix["s"]]
            for n, t, l, p in zip(ix["n"], tipos, ix["l"], ix["pos"]):
                assert lado_posicao(n, t) == (l.replace("0", ""), p.replace("0", "")), n
            assert ix["l"].count("E") + ix["l"].count("D") > 1000
        # "Peça única" do cartão (coluna "q"): '1' só com 1 em estoque no anúncio; nada de urgência inventada
        if "q" in ix:
            por_id = {p["id"]: p for p in json.loads(pecas.read_text(encoding="utf-8"))}
            assert len(ix["q"]) == len(ix["id"]) and set(ix["q"]) <= set("01")
            for i, q in zip(ix["id"], ix["q"]):
                assert (por_id[i].get("q") == 1) == (q == "1"), i


# ---- auditoria de dados 10/11/2026: regras R1–R13 ----
# R1 — carro citado no título (em qualquer posição) é carro da peça
def test_carro_citado_no_titulo_entra_na_peca():
    by = _pecas()
    if not by:
        return
    casos = {"Saveiro": "Volkswagen", "Xc90": "Volvo", "V60": "Volvo", "Q5": "Audi", "A5": "Audi", "Bora": "Volkswagen",
             "Parati": "Volkswagen", "X4": "BMW"}
    for palavra, marca in casos.items():
        rx = re.compile(r"\b" + palavra + r"\b", re.I)
        for x in by.values():
            if x["b"] == marca and x.get("m") and rx.search(x["t"]):
                chaves = {pd.gi.chave_modelo(m) for m in _carros(x)}
                assert pd.gi.chave_modelo(palavra) in chaves, (x["t"], _carros(x))


# R2 — "Mini Cooper": o nome da marca não come o modelo
def test_mini_cooper_tem_modelo():
    assert pd.palavras("Coletor Admissao Mini Cooper 1.6 16v 07/16 V752817280", "Mini")[:1] == ["Cooper"]
    by = _pecas()
    sem = [x["t"] for x in by.values() if x["b"] == "Mini" and not x.get("m")]
    assert not sem, sem[:3]


# R3 — o 1º carro do título com 1 peça só não apaga os outros carros do título
def test_primeiro_carro_raro_nao_apaga_os_outros():
    by = _pecas()
    casos = {"MLB4627333841": "Q3", "MLB6691333402": "Strada", "MLB6906771776": "Kicks", "MLB6792167198": "Fit",
             "MLB7406470122": "WR-V", "MLB7614387096": "Ranger"}
    for i, carro in casos.items():
        if i in by:
            assert carro in _carros(by[i]), (by[i]["t"], _carros(by[i]))


# R4 — preço no pico R$ 2.000,xx: o robô lista para o dono (não esconde o preço: 26 das 81 podem ser preço real)
def test_preco_de_reserva_sinalizado():
    assert pd.preco_reserva(2000.64) and pd.preco_reserva(2000.0)
    assert not pd.preco_reserva(2001.0) and not pd.preco_reserva(1999.99)


# R13 — marcação de material do plástico (PA66 GF30) não é o código da peça
def test_codigo_de_material_nao_e_codigo():
    for c in ("PA66GF30", "PA6-1-GF30", "PA66GF20"):
        assert not pd.codigo_valido(c), c
    for c in ("8K0951177", "DS7T-14F239-BP", "31476671"):
        assert pd.codigo_valido(c), c


# R5 — anos de cada carro: a faixa do título é cortada no período de CADA carro, não só no do 1º
def test_anos_de_cada_carro_da_peca():
    by = _pecas()
    x = by.get("MLB6769111792")            # "Chave Limpador Ford Fiesta Ka 14/21": o Ka foi até 2021
    if x:
        ms, ys = x.get("ms") or [], x.get("ys") or []
        assert "Ka" in ms and ys and ys[ms.index("Ka")] == [2014, 2021], (ms, ys)
    x = by.get("MLB4638210101")            # "Coletor Admissao Peugeot 2008 208 C3 1.6 13/19": o 208 é de 2013
    if x:
        ms, ys = x.get("ms") or [], x.get("ys") or []
        assert "208" in ms and ys and ys[ms.index("208")] == [2013, 2019], (ms, ys)


# R6 — "C4" de 2018 em diante é o C4 Cactus (o C4 hatch/Lounge saiu de linha em 2020)
def test_c4_depois_de_2020_e_cactus():
    assert pd.modelo_no_periodo("Citroën", "C4", 2018) == "C4 Cactus"
    assert pd.modelo_no_periodo("Citroën", "C4", 2011) == "C4"
    by = _pecas()
    ruins = [x["t"] for x in by.values() if x["b"] == "Citroën" and "C4" in _carros(x) and x.get("y") and x["y"][1] > 2020]
    assert not ruins, ruins[:3]


# R7 — o nome manda no bloco quando a categoria do ML mistura (relé em "Interruptores", moldura do painel em
# "Colunas e Copos", suporte do motor em "Coxim do Câmbio", módulo em "Máquina de vidro"...)
def test_bloco_pelo_nome_quando_o_ml_mistura():
    casos = [
        ("Relé limpador vidro", "Peças de Interior", "Chaves do Limpador", "modulos-e-eletrica"),
        ("Relé auxiliar pisca-alerta", "Peças de Interior", "Botões do Pisca-alerta", "modulos-e-eletrica"),
        ("Moldura painel instrumentos", "Peças de Interior", "Acabamentos de Coluna", "painel-e-console"),
        ("Suporte motor", "Transmissão", "Coxins do Câmbio", "motor"),
        ("Mangueira retorno radiador", "Climatização", "Mangueiras de Ar Condicionado", "mangueiras-do-motor"),
        ("Mangueira óleo turbina", "Suspensão e Direção", "Mangueiras da Direção", "mangueiras-do-motor"),
        ("Módulo conforto porta esquerda", "Janelas e Vedações", "Máquinas e Motores de Vidro Elétrico", "modulos-e-eletrica"),
        ("Comando rádio Sony", "Climatização", "Comandos de Ar Condicionado", "som-e-multimidia"),
        ("Duto distribuição ar condicionado", "Motor", "Mangueiras de Admissão", "ar-condicionado"),
        ("Filtro ressonador", "Motor", "Mangueiras de Admissão", "filtro-de-ar-e-turbo"),
        # o que já estava certo continua
        ("Moldura inferior coluna", "Peças de Interior", "Acabamentos de Coluna", "acabamentos-e-forros"),
        ("Coxim câmbio esquerdo", "Transmissão", "Coxins do Câmbio", "cambio-e-transmissao"),
    ]
    for nome, fam, tipo, esperado in casos:
        f, t = pd.classificar(nome, fam, tipo)
        assert pd.bloco(nome, f, t) == esperado, (nome, f, t, pd.bloco(nome, f, t))


# R8 — título quebrado no ML ("Fechadura", "Painel/forro"): a leitura usa o atributo BRAND/MODEL/PART_NUMBER
def test_titulo_quebrado_le_o_atributo():
    p = {"title": "Fechadura", "attrs": {"BRAND": "Volvo Coletor Admissao", "MODEL": "XC60"},
         "part_number": "P32257808 2018-2019-2020-2021-2022-2023-2024"}
    assert pd.titulo_de_leitura(p) == "Coletor Admissao Volvo XC60 18/24"
    p2 = {"title": "Lanterna Traseira Esquerda Volvo Xc60 18/24", "attrs": {"BRAND": "Volvo Lanterna"}}
    assert pd.titulo_de_leitura(p2) == p2["title"]          # título bom não muda
    by = _pecas()
    ruins = [x["id"] for x in by.values() if len(x["t"].split()) <= 2 and not x["b"]]
    assert not ruins, ruins


# R9 — SsangYong é marca
def test_ssangyong_e_marca():
    assert pd.marca_do_titulo("Coletor Admissao Ssangyong Actyon 2.0 08/14 A6641410801") == "SsangYong"


# R10 — o código do cartão (lido do "o") é o mesmo da página (lido do "oem"): com traço
def test_codigo_do_cartao_igual_ao_da_pagina():
    def codigo_cartao(o):          # = codigoPeca() de components/catalogo/etiqueta.ts
        return next((t.upper() for t in re.split(r"[\s,;/|]+", o or "") if 5 <= len(t) <= 24 and re.search(r"\d", t)), "")
    p = {"oem": "DS7T-14F239-BP", "part_number": "", "title": "Modulo Apim Ford Fusion Ds7t-14f239-bp"}
    assert codigo_cartao(pd.codigos_busca(p)) == pd.codigos_peca(p)[0] == "DS7T-14F239-BP"
    assert "ds7t14f239bp" in pd.codigos_busca(p).split()            # a busca sem traço continua achando


# R11 — nome: o lado e o aro antes do ano não somem ("Cruze Esq 17/23", "Aro 17 ... 11/14"), a letra da coluna fica
def test_nome_guarda_lado_aro_e_coluna():
    assert pd.nome_limpo("Moldura Lateral Painel Chevrolet Cruze Esq 17/23 84142244", "Chevrolet", "Cruze") \
        == "Moldura lateral painel esquerdo"
    assert pd.nome_limpo("Suporte Maçaneta Renault Kardian Diant Dir 24/26 806067754r", "Renault", "Kardian") \
        == "Suporte maçaneta dianteira direita"
    assert pd.nome_limpo("Roda Aro 17 Vw Passat 09/16 3c0601025k Prateado", "Volkswagen", "Passat") == "Roda aro 17"
    assert pd.nome_limpo("Acabamento Coluna B Dir Volvo Xc60 18/24 31479434", "Volvo", "XC60") == "Acabamento coluna B direita"
    assert pd.nome_limpo("Carter Oleo Motor Fiat Toro 1.8 16/24 55242408", "Fiat", "Toro") == "Cárter óleo motor"


# R12 — ano da descrição quando o título e o part_number não têm
def test_ano_da_descricao():
    assert pd.anos_da_descricao("+ Anos compativeis: 2013 ate 2020") == (2013, 2020)
    assert pd.anos_da_descricao("Volkswagen Golf Bora Passat 1999 2000 2001 2002 2003") == (1999, 2003)
    assert pd.anos_da_descricao("Fiat Palio 1.6 2008, Fiat Palio 1.6 2009, Fiat Palio 1.6 2010") == (2008, 2010)
    assert pd.anos_da_descricao("Código 2008 e 2015") == (None, None)




# ---- 10/11 (dono): mesmo carro em 1 pagina; lixo do anuncio; banco; excluir_do_site.json ----
ENDERECOS_ANTIGOS = {"mercedes-benz-c180", "mercedes-benz-c200", "mercedes-benz-c320", "mercedes-benz-gla200",
                     "bmw-320i", "bmw-530i", "ford-new-fiesta", "honda-new-civic"}


def test_carro_unido_mantem_enderecos_e_peca():
    """Os enderecos antigos /carros/<k>.html continuam (aliases, com canonical) e nenhuma peca perde o carro que tinha:
    quem salvou "C180" no Meu carro continua vendo as pecas, e o principal (Classe C) tem todas."""
    resumo = json.loads((ROOT / "site" / "src" / "data" / "resumo.json").read_text(encoding="utf-8"))
    chaves = {c["k"] for c in resumo["carros"]}
    al = resumo.get("aliases", [])
    assert ENDERECOS_ANTIGOS <= (chaves | {a["k"] for a in al}), ENDERECOS_ANTIGOS - (chaves | {a["k"] for a in al})
    assert not ({a["k"] for a in al} & chaves), "apelido nao pode ser pagina de carro (sitemap e menus)"
    for a in al:
        assert a["para"] in chaves, a
    by = _pecas()
    for (marca, apelido), principal in pd.UNIR_CARRO_PARES.items():
        for x in by.values():
            if x["b"] == marca and apelido in _carros(x):
                assert principal in _carros(x), (x["t"], _carros(x))


def test_lixo_do_anuncio_sai_do_nome():
    assert pd.limpar_lixo_anuncio("Bomba Agua Aux Recharge Ford 12/15") == "Bomba Agua auxiliar Ford 12/15"
    assert pd.limpar_lixo_anuncio("Motor Limpador Para-brisa Dia Fiat") == "Motor Limpador Para-brisa dianteiro Fiat"
    assert pd.limpar_lixo_anuncio("Caixa Filtro Ar Ex Lx Lxl Honda") == "Caixa Filtro Ar Honda"
    assert pd.limpar_lixo_anuncio("Fell Pack Moldura Coluna Direita Citroen") == "Moldura Coluna Direita Citroen"
    assert pd.limpar_lixo_anuncio("Acabamento coluna direito rh Volvo") == "Acabamento coluna direito Volvo"
    assert pd.limpar_lixo_anuncio("Fechadura Porta Lh Volvo") == "Fechadura Porta esquerda Volvo"
    assert pd.limpar_lixo_anuncio("Grade Dianteiro Ford") == "grade dianteira Ford"
    assert pd.limpar_lixo_anuncio("Bolsa Air Bag Volante Ford") == "Bolsa Air Bag Volante Ford"


def test_siglas_em_caixa_alta():
    assert pd.nome_limpo("Modulo Ipm Ford Ka 15/18 1234567", "Ford", "Ka") == "Módulo IPM"
    assert pd.nome_limpo("Modulo Ventoinha Pwm Ford Ka 15/18 1234567", "Ford", "Ka") == "Módulo ventoinha PWM"


def test_fechadura_do_banco_nao_e_da_porta():
    f, t = pd.classificar("Fechadura banco traseiro", "Maçanetas e Fechaduras", "Outros")
    assert t == "Peças de Banco", (f, t)
    f, t = pd.classificar("Fechadura porta traseira esquerda", "Maçanetas e Fechaduras", "Fechaduras das Portas")
    assert t == "Fechaduras das Portas", (f, t)


def test_excluidos_do_site_sao_poucos_e_com_motivo():
    import preparar_dados as _pd
    excl = json.loads((ROOT / "excluir_do_site.json").read_text(encoding="utf-8")) if (ROOT / "excluir_do_site.json").exists() else {}
    assert len(excl) <= _pd.TETO_EXCLUIDOS
    assert all(str(v).strip() for v in excl.values())
    by = _pecas()
    assert not [k for k in excl if k in by], "anuncio excluido ainda esta no pecas.json"



def test_apelido_de_carro_unido_fora_das_listas():
    """O apelido (C180) tem o nome salvo em "de" e nao aparece nas listas de modelo da marca (o principal aparece)."""
    resumo = json.loads((ROOT / "site" / "src" / "data" / "resumo.json").read_text(encoding="utf-8"))
    for a in resumo.get("aliases", []):
        assert a.get("de"), a
    marcas = {m["n"]: {x["n"] for x in m["m"]} for m in resumo["marcas"]}
    for a in resumo.get("aliases", []):
        assert a["de"] not in marcas.get(a["b"], set()), a
    busca = json.loads((ROOT / "site" / "public" / "dados" / "busca.json").read_text(encoding="utf-8"))
    assert set(busca.get("apelidos", [])) == {f"{a['b']}|{a['de']}" for a in resumo.get("aliases", [])}


def test_vocabulario_da_loja_em_dia():
    """site/testes/fixtures/vocabulario.json (os nomes de bloco e de tipo que os testes do site aceitam nos mapas do
    Raio-x, da batida e da abertura) e o MESMO que BLOCOS e _TIPOS_DO_BLOCO dizem. Nao olha o estoque: so o codigo.
    Mudou um nome: python ferramentas/vocabulario_loja.py e commitar o json."""
    sys.path.insert(0, str(ROOT / "ferramentas"))
    import vocabulario_loja as _v
    assert _v.ARQ.exists(), "falta site/testes/fixtures/vocabulario.json (python ferramentas/vocabulario_loja.py)"
    assert _v.ARQ.read_text(encoding="utf-8") == _v.texto(), "vocabulario.json fora de dia: python ferramentas/vocabulario_loja.py"


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
