# Folha de aprovação do dono: 3 artes que já estavam (1ª fileira) + as novas, com o nome embaixo. Usa o que está INSTALADO no site.
import sys, json
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/Users/izzat/Projects/izzatcar-wt/_r16carros/scripts')
R = '/Users/izzat/Projects/izzatcar-wt/_r16carros/'
V2 = '/Users/izzat/Projects/izzatcar-wt/r15hero/site/public/arte/v2/'
itens = json.load(open(R + 'qa/_folha.json'))   # [[chave, nome, nota]]
F = lambda t: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', t)
TW, TH, LB, COLS, M = 600, 400, 64, 4, 16
ant = [('volvo-xc60', 'Volvo XC60', 'já estava no site'), ('chevrolet-onix', 'Chevrolet Onix', 'já estava no site'), ('fiat-strada', 'Fiat Strada', 'já estava no site')]
linhas = 1 + -(-len(itens) // COLS)
W = COLS * TW + (COLS + 1) * M; H = 150 + linhas * (TH + LB + M) + 40
b = Image.new('RGB', (W, H), '#F4F3F0'); d = ImageDraw.Draw(b)
d.text((M, 26), 'Artes novas de carro — lote 1 (rodada 16)', fill='#1d1d1f', font=F(46))
d.text((M, 88), f'1ª fileira: 3 artes que já estavam no site, para comparar. Depois: as {len(itens)} novas, como estão instaladas (1200×800).', fill='#555', font=F(26))
def por(i, lin, k, nome, nota, cor='#1d1d1f'):
    x = M + i * (TW + M); y = 150 + lin * (TH + LB + M)
    b.paste(Image.open(f'{V2}carro-{k}.webp').convert('RGB').resize((TW, TH), Image.LANCZOS), (x, y))
    d.text((x + 4, y + TH + 6), nome, fill=cor, font=F(28))
    if nota: d.text((x + 4, y + TH + 38), nota, fill='#777', font=F(19))
for i, (k, n, nt) in enumerate(ant): por(i, 0, k, n, nt, '#8a5a00')
d.text((M + 3 * (TW + M) + 20, 150 + 150), 'referência:\na família', fill='#8a5a00', font=F(34))
for j, (k, n, nt) in enumerate(itens): por(j % COLS, 1 + j // COLS, k, n, nt)
b.save(R + 'APROVACAO.jpg', quality=86)
print(b.size)
