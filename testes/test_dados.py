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
    # Nao piorar: sem modelo no cartao, o carro escrito no nome e a unica pista e fica
    assert nome_limpo("Sensor Map Ssangyong Kyron Actyon 10/13 6675420017", "", "") \
        == "Sensor MAP ssangyong kyron actyon"


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
    for titulo, marca, modelo, pn, esperado in casos:
        assert anos_do_titulo(titulo, marca, modelo, pn) == esperado, (titulo, anos_do_titulo(titulo, marca, modelo, pn))
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
        assert x["o"].split()[:1] == [_cod_chave(c) for c in x["oem"].split()[:1]], (x["id"], x["o"], x["oem"])
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
    assert "<ol><li>Conferir o código OEM;</li><li>Comparar com fotos reais do anúncio;</li></ol>" in h, h
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


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
