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
        (("Luz teto", "Peças de Interior", "Luzes Internas"), "farois-e-lanternas"),
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
    assert "sem adaptações, sem furadeira." in h, h
    assert "ORIGINAL DE FABRICA" not in h.upper() or "original de fábrica - OEM" not in h, h       # a manchete sai
    assert h.count("Sem trincas") == 1, h                                   # o paragrafo da condicao, uma vez
    assert h.count("Material: Plástico") == 1 and h.count("Preto") == 1, h  # o mesmo dado nas duas listas
    assert "Código OEM: 8200733848" in h and "Part Number" not in h, h
    assert "Em excelente estado</li>" not in h, h                           # so encurta o de cima: sai
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


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
