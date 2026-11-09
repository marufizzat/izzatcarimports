"""Zona da sombra das capas maquiadas (ferramentas/marca_pro.py). Rodar:  python testes/test_marca_pro.py

A sombra/reflexo do ChatGPT só vale junto da peça e cai a zero antes da borda do quadro do ChatGPT; fora dela o fundo
é o do estúdio. Sem isso a vinheta do ChatGPT vinha junto e a borda do quadro aparecia como uma "caixa" na vitrine.
Sem rede e sem o recorte do Mac: alfa sintético.
"""
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "ferramentas"))

import marca_pro as mp  # noqa: E402

L = 400


def alfa_peca():
    """Peça retangular no meio, um pouco abaixo do centro (como nas fotos do ChatGPT)."""
    a = np.zeros((L, L))
    a[150:260, 120:280] = 1.0
    return a


def test_peca_e_piso_logo_abaixo_valem_inteiros():
    w = mp.zona_sombra(alfa_peca())
    assert w[150:260, 120:280].min() > 0.99            # na peça
    assert w[262:285, 140:260].min() > 0.99            # no piso logo abaixo (reflexo/sombra de contato)


def test_borda_do_quadro_vai_a_zero():
    w = mp.zona_sombra(alfa_peca())
    for borda in (w[0, :], w[-1, :], w[:, 0], w[:, -1]):
        assert borda.max() < 1e-6                      # sem degrau na borda: o mapa encosta no fundo do estúdio


def test_longe_da_peca_nao_leva_nada():
    w = mp.zona_sombra(alfa_peca())
    assert w[10:90, 10:90].max() < 1e-6                # canto de cima: a vinheta do ChatGPT fica de fora
    assert w[10:60, 300:390].max() < 1e-6


def test_vinheta_some_e_sombra_fica():
    """Mapa de escurecimento = vinheta forte nas bordas (10%) + sombra junto da peça (30%): depois da zona,
    a vinheta some e a sombra fica."""
    a = alfa_peca()
    yy, xx = np.mgrid[0:L, 0:L] / L
    vinheta = 0.10 * np.clip(np.maximum(np.abs(xx - 0.5), np.abs(yy - 0.5)) * 2 - 0.6, 0, 1) / 0.4
    sombra = np.zeros((L, L))
    sombra[262:280, 130:270] = 0.30
    d = np.maximum(vinheta, sombra) * mp.zona_sombra(a)
    assert d[:20].max() < 1e-6 and d[:, :20].max() < 1e-6 and d[:, -20:].max() < 1e-6 and d[-20:].max() < 1e-6
    assert d[265:278, 140:260].min() > 0.29


def test_rampa_suave():
    w = mp.zona_sombra(alfa_peca())
    perfil = w[200, :120]                               # da borda esquerda até a peça
    assert np.all(np.diff(perfil) >= -1e-9)             # só sobe (sem degrau voltando)
    assert np.abs(np.diff(perfil)).max() < 0.08         # sem salto: no máximo 8% por pixel neste quadro de 400 px


if __name__ == "__main__":
    for nome, f in list(globals().items()):
        if nome.startswith("test_"):
            f()
            print("ok", nome)
