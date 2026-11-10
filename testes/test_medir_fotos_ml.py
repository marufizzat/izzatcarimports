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
        assert e == [1200, 900, 120, 240, 600, 480, "p", "00ff00ff00ff00ff"] and s == sinal
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


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
