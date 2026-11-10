"""Medidor das fotos do ML da galeria (ferramentas/medir_fotos_ml.py). Rodar:  python testes/test_medir_fotos_ml.py

Sem rede e sem o recorte do Mac: cabeçalhos WebP montados à mão, máscaras sintéticas e um "recorte" de mentira.
Tudo em pasta temporária (nunca no site/). O enquadramento em si (lib/quadroFoto.ts) é testado no vitest.
"""
import json
import struct
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ferramentas"))

import medir_fotos_ml as mf  # noqa: E402


def _riff(tipo, corpo):
    return b"RIFF" + struct.pack("<I", 4 + 8 + len(corpo)) + b"WEBP" + tipo + struct.pack("<I", len(corpo)) + corpo


def test_tamanho_webp():
    # VP8 (com perdas): 3 bytes de quadro, a assinatura 9d 01 2a e largura/altura de 14 bits
    vp8 = _riff(b"VP8 ", b"\x00\x00\x00\x9d\x01\x2a" + struct.pack("<HH", 900, 1200) + b"\x00" * 20)
    assert mf.tamanho_webp(vp8) == (900, 1200)
    # VP8L (sem perdas): 0x2f e (largura-1) | (altura-1) << 14
    vp8l = _riff(b"VP8L", b"\x2f" + struct.pack("<I", (1199) | (761 << 14)) + b"\x00" * 20)
    assert mf.tamanho_webp(vp8l) == (1200, 762)
    # VP8X (estendido): flags, 3 reservados, largura-1 e altura-1 em 24 bits
    vp8x = _riff(b"VP8X", b"\x10\x00\x00\x00" + (1199).to_bytes(3, "little") + (999).to_bytes(3, "little") + b"\x00" * 20)
    assert mf.tamanho_webp(vp8x) == (1200, 1000)
    assert mf.tamanho_webp(b"\xff\xd8\xff\xe0" + b"\x00" * 60) is None    # JPEG: não é WebP
    assert mf.tamanho_webp(b"RIFF") is None


def test_caixa_junta_tudo_e_tira_sujeira():
    import numpy as np
    m = np.zeros((400, 500), dtype="uint8")
    m[100:300, 150:350] = 255          # a peça
    m[20:60, 400:480] = 255            # o carrinho colado no canto: entra na caixa (nada cortado ao meio)
    m[390:392, 5:7] = 255              # sujeira (< 0,2% da foto): fica fora
    assert mf.caixa_da_mascara(m) == (150, 20, 480, 300)
    assert mf.caixa_da_mascara(np.zeros((50, 50), dtype="uint8")) is None
    so_sujeira = np.zeros((400, 500), dtype="uint8")
    so_sujeira[0:3, 0:3] = 255
    assert mf.caixa_da_mascara(so_sujeira) is None


def test_fila_sem_repetir_e_com_prioridade():
    pecas = [
        {"id": "MLB1", "fotos": ["a", "b", "http://x/y.jpg"]},
        {"id": "MLB2", "fotos": ["b", "c", ""]},
        {"id": "MLB3", "fotos": ["d"]},
    ]
    assert mf.fila_de(pecas, {}) == ["a", "b", "c", "d"]
    assert mf.fila_de(pecas, {"a": [1, 1]}) == ["b", "c", "d"]              # o que já tem não é medido de novo
    assert mf.fila_de(pecas, {}, primeiro={"MLB3"}) == ["d", "a", "b", "c"]


def test_medir_uma_sem_rede():
    """medir_uma com a rede e o recorte trocados por funções locais: px da foto grande, sem peça e erro."""
    import io
    from PIL import Image
    foto = Image.new("RGB", (500, 375), (255, 255, 255))
    buf = io.BytesIO()
    foto.save(buf, "WEBP")
    cab = _riff(b"VP8 ", b"\x00\x00\x00\x9d\x01\x2a" + struct.pack("<HH", 1200, 900) + b"\x00" * 20)
    original = mf._get
    try:
        mf._get = lambda url, faixa=None, tempo=25: cab if faixa else buf.getvalue()

        def recorte(img):
            import numpy as np
            a = np.zeros((img.size[1], img.size[0]), dtype="uint8")
            a[100:200, 50:250] = 255
            return a
        assert mf.medir_uma("k", recorte) == ([1200, 900, 120, 240, 600, 480], None)   # 500 -> 1200 px: × 2,4

        def sem_peca(img):
            raise mf.SemPeca
        assert mf.medir_uma("k", sem_peca) == ([1200, 900], None)

        # com a classificação: classe e assinatura vão no fim da entrada, os sinais voltam para o cache
        sinal = {"t": 0.0, "x": "", "l": 200.0, "c": 0.0, "h": "00ff00ff00ff00ff"}
        e, s = mf.medir_uma("k", recorte, lambda img: dict(sinal))
        # foto branca lisa: nada além da caixa (o teste da faixa vai para o cache em "f"; caixa confiável)
        assert e == [1200, 900, 120, 240, 600, 480, "p", "00ff00ff00ff00ff"] and s == dict(sinal, f=[0.0, 0.0, 0.0, 0.0, 1.0])
        e, _ = mf.medir_uma("k", sem_peca, lambda img: dict(sinal, x="ENTREGA RÁPIDA E SEGURA! | seu pedido", t=0.14))
        assert e == [1200, 900, "m", "00ff00ff00ff00ff"]

        def quebrado(img):
            raise RuntimeError("vision falhou (7)")
        assert mf.medir_uma("k", quebrado) == (None, None)      # não grava: tenta de novo na próxima rodada

        def sem_rede(url, faixa=None, tempo=25):
            raise OSError("sem rede")
        mf._get = sem_rede
        assert mf.medir_uma("k", recorte) == (None, None)
    finally:
        mf._get = original


def test_gravar_e_juntar_com_o_robo():
    with tempfile.TemporaryDirectory() as d:
        arq, extra = Path(d) / "caixas.json", Path(d) / "robo" / "caixas.json"
        mf.gravar({"b": [10, 10], "a": [1200, 900, 1, 2, 3, 4]}, arq)
        txt = arq.read_text(encoding="utf-8")
        assert txt.splitlines()[1].startswith('"a"')          # em ordem, uma foto por linha
        assert json.loads(txt) == {"a": [1200, 900, 1, 2, 3, 4], "b": [10, 10]}
        # o robô junta o cache dele, o do repositório manda, e --podar tira as fotos que saíram dos anúncios
        mf.gravar({"a": [1, 1], "c": [5, 5], "velha": [7, 7]}, extra)
        pecas = Path(d) / "pecas.json"
        pecas.write_text(json.dumps([{"id": "MLB1", "fotos": ["a", "b", "c"]}]), encoding="utf-8")
        antes = (mf.ARQ, mf.PECAS, mf.SINAIS, mf.motores)
        mf.SINAIS = Path(d) / "sinais.json"

        def sem_motor(nome):                       # sem rede no teste: nada é medido nem classificado
            raise RuntimeError("sem motor no teste")
        mf.motores = sem_motor
        try:
            mf.ARQ, mf.PECAS = arq, pecas
            mf.main(["--extra", str(extra), "--podar"])
        finally:
            mf.ARQ, mf.PECAS, mf.SINAIS = antes[:3]
        final = json.loads(arq.read_text(encoding="utf-8"))
        assert final == {"a": [1200, 900, 1, 2, 3, 4], "b": [10, 10], "c": [5, 5]}, final
        assert json.loads(extra.read_text(encoding="utf-8")) == final
        # rodada sem tempo (--so-juntar): nada é medido, mas as medidas do robô entram no JSON do build
        mf.gravar({"a": [1200, 900, 1, 2, 3, 4]}, arq)
        pecas.write_text(json.dumps([{"id": "MLB1", "fotos": ["a", "c", "nova"]}]), encoding="utf-8")
        try:
            mf.ARQ, mf.PECAS, mf.SINAIS = arq, pecas, Path(d) / "sinais.json"
            mf.main(["--extra", str(extra), "--podar", "--so-juntar"])
        finally:
            mf.ARQ, mf.PECAS, mf.SINAIS, mf.motores = antes
        assert json.loads(arq.read_text(encoding="utf-8")) == {"a": [1200, 900, 1, 2, 3, 4], "c": [5, 5]}


def test_classe_de():
    base = {"t": 0.0, "x": "", "l": 190.0, "c": 0.0}
    assert mf.classe_de(True, base) == "p"
    assert mf.classe_de(False, base) == "s"
    # banners de propaganda (2+ palavras e texto de banner)
    assert mf.classe_de(True, dict(base, x="DICAS PARA VOCÊ!! | Antes da compra | Verifique se o produto", t=0.18)) == "m"
    assert mf.classe_de(True, dict(base, x="ENTREGA RÁPIDA E SEGURA! | seu pedido chegue no | prazo", t=0.14, l=27.0)) == "m"
    # selo pequeno colado na foto da peça, lacre da loja e etiqueta de fábrica com "CLIENTE": continuam peça
    assert mf.classe_de(True, dict(base, x="PRODUTO | SEMI-NOVO | ORIGINAL", t=0.02)) == "p"
    assert mf.classe_de(True, dict(base, x='IZZATCAR | "VENDEMOS QUALIDADE" | LACRE DE SEGURANÇA | GARANTIA', t=0.08)) == "p"
    assert mf.classe_de(True, dict(base, x="APTIV | FAISCEAU PORTAS | REV CLIENTE: D/04", t=0.36)) == "p"
    # cartão escuro com texto
    assert mf.classe_de(True, dict(base, l=27.0, t=0.14, x="algo escrito")) == "m"
    # etiqueta da peça com MUITO texto continua sendo peça (mostra o código ao comprador)
    assert mf.classe_de(True, dict(base, t=0.52, x="RETROVISOR | ELÉTRICO DIANT | ESQ RENAULT | SCENIC 99/10 | E2019001")) == "p"
    assert mf.classe_de(True, dict(base, t=0.34, x="8K0 907 064 DT | Made in Germany | Hella KGaA")) == "p"
    # peça escura (preta, com código gravado) não é cartão
    assert mf.classe_de(True, dict(base, l=30.0, t=0.0)) == "p"
    assert mf.classe_de(True, dict(base, l=54.0, t=0.09, x="CHERY | MADE IN CHINA")) == "p"
    # carro inteiro
    assert mf.classe_de(True, dict(base, c=0.85)) == "c"


def test_entrada_com_classe():
    e = [1200, 900, 1, 2, 3, 4]
    assert mf.classe_da(e) is None and mf.hash_da(e) is None
    c = mf.com_classe(e, "m", "0123456789abcdef")
    assert c == [1200, 900, 1, 2, 3, 4, "m", "0123456789abcdef"]
    assert mf.numeros(c) == e and mf.classe_da(c) == "m" and mf.hash_da(c) == "0123456789abcdef"
    assert mf.com_classe(c, "p", mf.hash_da(c)) == [1200, 900, 1, 2, 3, 4, "p", "0123456789abcdef"]


def test_assinatura_e_modelos():
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (400, 300), (30, 30, 30))
    ImageDraw.Draw(im).rectangle((50, 60, 250, 200), fill=(230, 120, 20))
    h = mf.assinatura(im)
    assert len(h) == 16 and h == mf.assinatura(im.resize((200, 150)))      # a mesma foto menor: a mesma assinatura
    h = "5f73f171e1f371e3"                                                    # o cartão "DICAS PARA VOCÊ" do catálogo
    outro = "%016x" % (int(h, 16) ^ 0b101)                                    # 2 bits de diferença: outra foto
    dados = {"a": [1, 1, "p", h], "b": [1, 1, "p", h], "c": [1, 1, "p", h], "d": [1, 1, "p", outro]}
    pecas = [{"id": "MLB1", "fotos": ["a"]}, {"id": "MLB2", "fotos": ["b"]}, {"id": "MLB3", "fotos": ["c", "d"]}]
    assert mf.modelos(dados, pecas) == {"a", "b", "c"}                       # a mesma foto em 3 anúncios: modelo
    pecas2 = [{"id": "MLB1", "fotos": ["a", "b"]}, {"id": "MLB3", "fotos": ["c", "d"]}]
    assert mf.modelos(dados, pecas2) == set()                                # só 2 anúncios: não é modelo
    for liso in ("0000000000000000", "0f0f0f0f0f0f0f0f", "0c0f0f0f0f0f0f4f"):    # simples demais: fotos diferentes coincidem
        assert mf.modelos({k: [1, 1, "p", liso] for k in "xyz"},
                          [{"id": f"M{i}", "fotos": [k]} for i, k in enumerate("xyz")]) == set()


def _foto(w, h, fundo=(255, 255, 255)):
    from PIL import Image
    return Image.new("RGB", (w, h), fundo)


def test_faixa_foto_limpa_e_sombra_colada():
    from PIL import ImageDraw
    im = _foto(500, 375)
    d = ImageDraw.Draw(im)
    d.rectangle((150, 100, 349, 274), fill=(30, 30, 30))          # a peça
    d.rectangle((150, 275, 349, 280), fill=(205, 205, 205))       # sombra colada embaixo (dentro dos 2%)
    f = mf.faixas(im, (150, 100, 350, 275))
    assert f == [0.0, 0.0, 0.0, 0.0, 1.0], f
    assert not mf.incerta(1200, 900, f)
    # a caixa encostada na borda da foto: nada além daquele lado (-1)
    assert mf.faixas(im, (0, 100, 350, 275))[0] == -1


def test_faixa_pega_o_carro_colado_e_o_plastico_branco():
    from PIL import ImageDraw
    # montagem: o recorte pegou só o carro (à direita); a peça escura à esquerda fica além da caixa
    im = _foto(500, 290)
    d = ImageDraw.Draw(im)
    d.rectangle((20, 160, 260, 250), fill=(20, 30, 70))           # a peça
    d.rectangle((300, 20, 480, 120), fill=(180, 30, 30))          # o carro colado
    f = mf.faixas(im, (300, 20, 481, 121))
    assert f[0] > mf.FAIXA_MANCHA and mf.incerta(1115, 404, f), f
    # plástico branco (30 abaixo do fundo) com a tampa preta no meio: a caixa pegou só a tampa
    im = _foto(500, 375, (245, 245, 245))
    d = ImageDraw.Draw(im)
    d.rectangle((40, 150, 460, 230), fill=(215, 215, 215))        # o tubo de plástico, de lado a lado
    d.ellipse((220, 160, 280, 220), fill=(15, 15, 15))            # a tampa preta
    f = mf.faixas(im, (220, 160, 281, 221))
    assert min(f[0], f[2]) > mf.FAIXA_MANCHA and mf.incerta(1200, 900, f), f
    # a mesma foto em pé: o quadro só corta em cima e embaixo, e ali não há nada (o tubo fica inteiro no lado curto)
    assert not mf.incerta(900, 1200, [f[0], 0.0, f[2], 0.0])
    # foto quadrada nunca é cortada pelo quadro: nunca incerta
    assert not mf.incerta(1200, 1200, f)


def test_faixa_ignora_o_degrade_do_fundo_de_estudio():
    import numpy as np
    from PIL import Image
    a = np.zeros((375, 500, 3), dtype="uint8")
    a[:] = np.linspace(250, 190, 375, dtype="uint8")[:, None, None]   # o fundo escurece 60 de cima para baixo
    a[120:250, 180:320] = 25                                          # a peça
    f = mf.faixas(Image.fromarray(a), (180, 120, 320, 250))
    assert not mf.incerta(1200, 900, f) and not mf.incerta(900, 1200, f), f


def test_faixa_pega_a_etiqueta_e_o_close():
    from PIL import ImageDraw
    # etiqueta de papel embaixo da peça (letras finas, papel quase do tom do fundo): as letras viram uma mancha só
    im = _foto(375, 500, (238, 238, 238))
    d = ImageDraw.Draw(im)
    d.rectangle((110, 100, 270, 300), fill=(25, 25, 25))           # a peça
    d.rectangle((100, 380, 280, 470), fill=(250, 250, 250))         # o papel da etiqueta
    for i in range(4):                                               # 4 linhas de letras de 1 px
        for x in range(110, 270, 6):
            d.line((x, 392 + i * 18, x + 3, 392 + i * 18 + 8), fill=(20, 20, 20), width=1)
    f = mf.faixas(im, (110, 100, 271, 301))
    assert f[3] > mf.FAIXA_MANCHA and mf.incerta(900, 1200, f), f
    # close: a caixa vai de uma borda à outra no lado curto (não há fundo dos lados para conferir)
    assert mf.incerta(900, 1200, [0.0, 0.0, 0.0, 0.0], (0, 194, 900, 1133))
    assert mf.incerta(1200, 900, None, (100, 3, 1000, 897))
    assert not mf.incerta(900, 1200, [0.0, 0.0, 0.0, 0.0], (30, 194, 900, 1133))
    assert not mf.incerta(1200, 1200, None, (0, 0, 1200, 1200))      # quadrada: nunca cortada
    # close da etiqueta numa peça escura que enche a foto: a borda é a peça (escura), não o fundo do estúdio
    import numpy as np
    from PIL import Image
    a = np.full((500, 375, 3), 45, dtype="uint8")
    a[::7] = 70                                                       # a textura do plástico
    a[200:300, 60:375] = 245                                          # a etiqueta branca no meio
    f = mf.faixas(Image.fromarray(a), (60, 200, 375, 300))
    assert f[4] == 0.0 and mf.incerta(900, 1200, f, (144, 480, 900, 720)), f
    assert not mf.incerta(900, 1200, [0.0, 0.0, 0.0, 0.0, 0.9])


def test_marca_incerta_na_entrada():
    e = [1200, 900, 10, 20, 300, 400, "p", "0123456789abcdef", mf.INCERTA]
    assert mf.classe_da(e) == "p" and mf.hash_da(e) == "0123456789abcdef" and mf.incerta_da(e)
    assert mf.numeros(e) == [1200, 900, 10, 20, 300, 400]
    assert mf.com_classe(e, "m", mf.hash_da(e)) == [1200, 900, 10, 20, 300, 400, "m", "0123456789abcdef", mf.INCERTA]
    assert mf.com_classe(e, "p", mf.hash_da(e), False) == [1200, 900, 10, 20, 300, 400, "p", "0123456789abcdef"]
    assert mf.com_classe([1200, 900], "s", None, True) == [1200, 900, "s"]          # sem caixa: nunca incerta
    assert mf.incerta_pelo_cache(e, {"h": "x"}) is None                              # sem o teste no cache: mantém
    assert mf.incerta_pelo_cache(e, {"f": [0.0, -1, 0.2, 0.0]}) is True
    assert mf.incerta_pelo_cache(e, {"f": [0.0, 0.5, 0.0, 0.5]}) is False             # só o eixo longo conta


def test_incerta_sobrevive_a_gravar_juntar_e_reclassificar():
    with tempfile.TemporaryDirectory() as d:
        arq, pecas, sinais = Path(d) / "caixas.json", Path(d) / "pecas.json", Path(d) / "sinais.json"
        h = "0123456789abcdef"
        mf.gravar({"a": [1200, 900, 400, 300, 800, 600, "p", h, mf.INCERTA], "b": [1200, 900, 400, 300, 800, 600, "p", h]},
                  arq)
        pecas.write_text(json.dumps([{"id": "MLB1", "fotos": ["a", "b"]}]), encoding="utf-8")
        base = {"t": 0.0, "x": "", "l": 190.0, "c": 0.0, "h": h}
        # "a" sem o teste no cache (mantém a marca); "b" com mancha além da caixa no eixo longo (vira incerta)
        mf.gravar({"a": dict(base), "b": dict(base, f=[0.3, 0.0, 0.0, 0.0])}, sinais)
        antes = (mf.ARQ, mf.PECAS, mf.SINAIS)
        try:
            mf.ARQ, mf.PECAS, mf.SINAIS = arq, pecas, sinais
            mf.main(["--reclassificar", "--so-juntar"])
        finally:
            mf.ARQ, mf.PECAS, mf.SINAIS = antes
        final = json.loads(arq.read_text(encoding="utf-8"))
        assert final["a"][-1] == mf.INCERTA and final["b"] == [1200, 900, 400, 300, 800, 600, "p", h, mf.INCERTA], final


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
