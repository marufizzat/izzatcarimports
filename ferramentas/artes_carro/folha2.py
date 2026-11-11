# Folha de aprovação do lote 2: 3 artes da família (1ª fileira), as novas como estão instaladas, e as 3 refeitas do lote 1 (antes x depois).
import sys, json, io, re, subprocess, unicodedata
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, '/Users/izzat/Projects/izzatcar-wt/_r16carros/scripts')
import carros
R = '/Users/izzat/Projects/izzatcar-wt/_r16carros/'
REPO = '/Users/izzat/Projects/izzatcar-wt/r15hero/'
V2 = REPO + 'site/public/arte/v2/'
F = lambda t: ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', t)
chave = lambda s: re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()).strip('-')
g = json.load(open(REPO + 'site/dist/dados/meu-carro.json'))
pecas = {chave(ma['n'] + ' ' + mo['n']): (mo['c'], ma['n'] + ' ' + mo['n']) for ma in g['marcas'] for mo in ma['modelos']}
rej = dict(l.strip().split('|', 1) for l in open(R + 'qa/_rejeitadas.txt') if '|' in l)
COPIAS = {'mercedes-benz-c230': 'arte aprovada do C320 (W203)', 'mercedes-benz-c250': 'arte aprovada do C320 (W203)', 'bmw-330i': 'arte aprovada do 320i (Série 3)', 'mitsubishi-pajero': 'arte aprovada do Pajero Full'}
novas = [l.strip() for l in open(R + 'qa/_aprovadas2.txt') if l.strip()] + list(COPIAS)
itens = []
for k in novas:
    n, nome = pecas.get(k, (0, k))
    ger = COPIAS.get(k) or (carros.CARROS2[k][1] if len(carros.CARROS2[k][1]) <= 46 else carros.CARROS2[k][1][:45].rsplit(' ', 1)[0].rstrip(',') + '…')
    itens.append((k, nome, f'{ger} · {n} peça{"s" if n != 1 else ""}' + (' · 2ª tentativa' if k in rej else ''), n))
itens.sort(key=lambda x: -x[3])
json.dump([{'k': k, 'nome': nm, 'nota': nt, 'pecas': n} for k, nm, nt, n in itens], open(R + 'verificacao-lote2.json', 'w'), ensure_ascii=False, indent=1)
TW, TH, LB, COLS, M = 480, 320, 56, 5, 16
linhas = 1 + -(-len(itens) // COLS) + 2
W = COLS * TW + (COLS + 1) * M; H = 150 + linhas * (TH + LB + M) + 110
b = Image.new('RGB', (W, H), '#F4F3F0'); d = ImageDraw.Draw(b)
d.text((M, 26), 'Artes novas de carro — lote 2 (rodada 16)', fill='#1d1d1f', font=F(44))
d.text((M, 86), f'1ª fileira: 3 artes da família, para comparar. Depois: as {len(itens)} novas como estão instaladas (1200×800), das de mais peças para as de menos. No fim: as 3 refeitas do lote 1.', fill='#555', font=F(23))
def por(i, lin, im, nome, nota, cor='#1d1d1f', dy=0):
    x = M + i * (TW + M); y = 150 + lin * (TH + LB + M) + dy
    b.paste(im.convert('RGB').resize((TW, TH), Image.LANCZOS), (x, y))
    d.text((x + 4, y + TH + 5), nome, fill=cor, font=F(24))
    if nota: d.text((x + 4, y + TH + 33), nota, fill='#777', font=F(16))
arte = lambda k: Image.open(f'{V2}carro-{k}.webp')
for i, (k, n) in enumerate([('volvo-xc60', 'Volvo XC60'), ('chevrolet-onix', 'Chevrolet Onix'), ('fiat-strada', 'Fiat Strada')]): por(i, 0, arte(k), n, 'já estava no site (referência da família)', '#8a5a00')
for j, (k, nome, nota, n) in enumerate(itens): por(j % COLS, 1 + j // COLS, arte(k), nome, nota)
lin = 1 + -(-len(itens) // COLS)
y0 = 150 + lin * (TH + LB + M)
d.text((M, y0 + 14), 'Refeitas do lote 1 — antes × depois', fill='#1d1d1f', font=F(34))
antes = lambda k: Image.open(io.BytesIO(subprocess.run(['git', '-C', REPO, 'show', f'{sys.argv[1] if len(sys.argv) > 1 else "HEAD"}:site/public/arte/v2/carro-{k}.webp'], capture_output=True, check=True).stdout))
por(0, lin, antes('peugeot-308'), 'Peugeot 308 — ANTES', 'grade com frisos cromados a mais', '#a11', 70)
por(1, lin, arte('peugeot-308'), 'Peugeot 308 — DEPOIS (trocada)', 'grade e LEDs do 308 2012–2015, pela foto certa', '#063', 70)
por(2, lin, antes('volkswagen-bora'), 'VW Bora — ANTES', 'repetidor âmbar no para-choque', '#a11', 70)
por(3, lin, arte('volkswagen-bora'), 'VW Bora — DEPOIS (trocada)', 'para-choque liso, sem repetidor', '#063', 70)
por(0, lin + 1, arte('citroen-c3-aircross'), 'C3 Aircross — ATUAL (mantida)', 'a do lote 1 continua no site', '#1d1d1f', 70)
por(1, lin + 1, Image.open(R + 'rejeitados/carro-citroen-c3-aircross_refeita_nao-trocada.jpg'), 'C3 Aircross — REFEITA (não trocada)', 'saiu igual à atual: não é claramente melhor', '#777', 70)
b.save(R + 'APROVACAO-lote2.jpg', quality=84)
print(b.size, len(itens))
