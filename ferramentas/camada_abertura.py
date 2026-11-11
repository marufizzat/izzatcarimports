#!/usr/bin/env python
"""Camadas do palco da abertura da home (site/src/components/v2/AberturaV2.astro).

Cada peça é gerada sozinha num fundo liso (super prompts em site/SUPER-PLANEJAMENTO-v2.md, "Abertura viva") e vira
uma camada com alfa:  python ferramentas/camada_abertura.py <peca.png> <nome> [--larguras 320,640]
  1. recorta o fundo (~/.local/bin/recorta-fundo, Vision do macOS);
  2. borda firme e sem auréola: aperta a rampa do alfa (o do Vision é macio) e troca a cor dos pixels de borda pela do
     pixel opaco mais próximo (a franja clara do fundo aparecia sobre os carros escuros);
  3. apara na caixa da peça e grava site/public/arte/v2/abertura/<nome>-<largura>.webp;
  4. anota largura/altura/variantes em site/src/data/abertura-pecas.json (o palco reserva o lugar: nada pula).
O farol (a peça-herói) ganha também a máscara do DRL (farol-drl.webp: só as luzes acesas), por onde a luz corre.
Conferir a borda com zoom de 200% sobre fundo claro E escuro antes de commitar."""
import sys, subprocess, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, 'site', 'public', 'arte', 'v2', 'abertura')
MANIFESTO = os.path.join(RAIZ, 'site', 'src', 'data', 'abertura-pecas.json')


def recortar(ent: str, tmp: str) -> Image.Image:
    subprocess.run([os.path.expanduser('~/.local/bin/recorta-fundo'), ent, tmp], check=True, capture_output=True)
    im = np.array(Image.open(tmp).convert('RGBA')).astype(np.float32)
    rgb, a = im[..., :3], im[..., 3] / 255.0
    rot, n = ndi.label(a > 0.5)  # só a peça: migalhas soltas saem
    if n > 1:
        tam = ndi.sum(a > 0.5, rot, range(1, n + 1))
        manter = np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= 0.02 * tam.max()])
        a = a * ndi.binary_dilation(manter, iterations=3)
    a2 = ndi.gaussian_filter(np.clip((a - 0.38) / 0.34, 0, 1), 0.55)
    opaco = a2 >= 0.98
    idx = ndi.distance_transform_edt(~opaco, return_distances=False, return_indices=True)
    emprestada = rgb[idx[0], idx[1]]
    emprestada = np.dstack([ndi.gaussian_filter(emprestada[..., i], 2.0) for i in range(3)])
    mist = np.clip((0.85 - a2) / 0.55, 0, 1)[..., None]
    out = np.dstack([rgb * (1 - mist) + emprestada * mist, a2 * 255]).clip(0, 255).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    ys, xs = np.where(a2 > 0.02)
    f = 4
    return img.crop((max(0, xs.min() - f), max(0, ys.min() - f), min(img.width, xs.max() + 1 + f), min(img.height, ys.max() + 1 + f)))


def mascara_drl(img: Image.Image) -> Image.Image:
    """Só as luzes acesas do farol (o branco do DRL e o âmbar da seta), em alfa, um pouco borradas."""
    p = np.array(img).astype(np.float32)
    r, g, b, a = p[..., 0], p[..., 1], p[..., 2], p[..., 3]
    branco = (np.minimum(np.minimum(r, g), b) > 236)
    ambar = (r > 232) & (g > 110) & (g < 205) & (b < 95)
    m = ndi.binary_opening(branco | ambar, iterations=1) & (a > 200)
    rot, n = ndi.label(m)
    if n:
        tam = ndi.sum(m, rot, range(1, n + 1))
        m = np.isin(rot, [i + 1 for i, t in enumerate(tam) if t >= 500])  # brilhos pequenos do cromado ficam de fora
    m = ndi.gaussian_filter(m.astype(np.float32), 2.2)
    alfa = (np.clip(m * 1.5, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([np.full_like(alfa, 255)] * 3 + [alfa]), 'RGBA')


def main():
    ent, nome = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]
    larguras = [int(x) for x in (args[args.index('--larguras') + 1] if '--larguras' in args else '320,640').split(',')]
    os.makedirs(DESTINO, exist_ok=True)
    tmp = os.path.join(os.environ.get('TMPDIR', '/tmp'), f'camada-{nome}-bruto.png')
    img = recortar(ent, tmp)
    if '--png' in args:
        img.save(args[args.index('--png') + 1])
    info = {'w': img.width, 'h': img.height, 'v': []}
    pesos = []
    for w in larguras:
        w = min(w, img.width)
        r = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
        arq = os.path.join(DESTINO, f'{nome}-{w}.webp')
        r.save(arq, 'WEBP', quality=80 if w < 800 else 74, method=6, alpha_quality=88)
        info['v'].append(w)
        pesos.append(f'{w}px {os.path.getsize(arq) / 1024:.1f} KB')
    if nome == 'farol':
        m = mascara_drl(img)
        m = m.resize((800, round(img.height * 800 / img.width)), Image.LANCZOS)
        arq = os.path.join(DESTINO, 'farol-drl.webp')
        m.save(arq, 'WEBP', quality=30, method=6, alpha_quality=60)
        pesos.append(f'drl {os.path.getsize(arq) / 1024:.1f} KB')
    man = json.load(open(MANIFESTO)) if os.path.exists(MANIFESTO) else {}
    man[nome] = info
    with open(MANIFESTO, 'w') as f:
        json.dump(dict(sorted(man.items())), f, indent=1)
        f.write('\n')
    print(nome, f"{info['w']}x{info['h']}", ' | '.join(pesos))


if __name__ == '__main__':
    main()
