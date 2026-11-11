# Artes de carro (site/public/arte/v2/carro-<k>.webp) — roteiros da rodada 16 (11/11/2026), como rodaram neste Mac.
# Os caminhos são os desta máquina (pasta de saída /Users/izzat/Projects/izzatcar-wt/_r16carros, Python do venv-rembg,
# âncoras em ~/.cache/izzatcar-carros-cor/cor): para o próximo lote, troque R/COR/REF no topo de cada arquivo.
#
# Ordem:
#  1. alvos.py + refs.py          modelos sem arte com mais peças e as montagens "peça + carro" dos anúncios (quase sempre
#                                 mostram OUTRO carro da mesma plataforma: servem pouco)
#  2. refs_commons.py             foto real de cada modelo no Wikimedia Commons (só referência da geração; nunca vai ao site)
#  3. carros.py                   por carro: geração do estoque, traços, cor de fábrica, arte-âncora e foto real -> o prompt
#  4. gerar.sh / lote.sh          um job do Codex por carro, UMA imagem 1536x1024 (lote confere 5 GB livres antes)
#  5. qa.py (usa medir.py)        caixa do carro, linha do piso, tom da parede, sobreposição a 50% com o piloto e 4 zooms
#  6. instalar.py                 acerta o tom da parede com o da família, reenquadra se precisar, grava o webp 1200x800 q84
#     depois, na pasta site/:     node scripts/variantes-imagens.mjs
#  7. folha.py                    folha de aprovação do dono
#  8. prova.cjs                   Playwright: topo do carro, cartão do seletor e abertura da home com o carro salvo
#
# O que se aprendeu: a arte-âncora de carroceria parecida pode "vazar" (a 1ª Saveiro saiu com a carroceria da Strada): na 2ª
# tentativa a âncora foi a arte do irmão de mesma frente (Voyage). O gerador devolve a parede ~8 níveis mais rosada que a
# família: o instalar.py corrige. Carro que sai maior que a família (Parati, City, Oroch): reenquadre leve no instalar.py.
#
# Lote 2 (11/11, os 64 que faltavam): carros2.py (especificações), refs_commons2.py + folha_refs2.py (fotos reais, 5 por
# modelo), qa2.py (prancha pequena), rejeitar.sh (guarda a miniatura da 1ª e gera a 2ª e última), lote-final.sh, folha2.py.
# Regras que valeram: âncora 2 sempre da MESMA carroceria; irmão de mesma frente = papel MESMA_FRENTE (SpaceFox/CrossFox com o
# Fox, Classic com o Corsa); mesmo carro de outra marca = MESMA_CARROCERIA (Freemont com o Journey); sem âncora segura = só o
# piloto + 2 fotos reais (Montana, Camaro, Fiorino). Grade que leva o símbolo no meio: pedir "sem disco, sem barra diagonal,
# sem placa" (o CLA saiu com um disco preto e o V40 com a barra diagonal da marca: as duas refeitas). O instalar.py encolhe
# sozinho o carro que sai mais largo que 80,5% do quadro. Não esperar um lote com `pgrep -f "scripts/lote.sh"` dentro de um
# comando que tem esse texto: o pgrep acha o próprio shell (três esperas travaram umas nas outras): esperar pelo "FIM" do log.

# Especificação de cada arte do lote r16: geração do estoque, traços, cor de fábrica, âncoras de estilo e foto real de referência.
COR = '/Users/izzat/.cache/izzatcar-carros-cor/cor/'           # artes aprovadas (1536x1024, coloridas) = âncoras de estilo
REF = '/Users/izzat/Projects/izzatcar-wt/_r16carros/refs/'
PILOTO = COR + 'volvo-xc60.png'
# k: (nome, geração, traços, cor, âncora 2, foto real, nota sobre a foto)
CARROS = {
 'volkswagen-voyage': ('Volkswagen Voyage', 'geração G5, 2008–2012, sedã compacto brasileiro de três volumes',
   'sedã compacto de quatro portas com porta-malas curto e alto; frente igual à do Gol G5: faróis grandes em forma de gota puxados para os para-lamas, grade superior estreita com duas barras horizontais cromadas, entrada de ar inferior larga em trapézio no para-choque com faróis de neblina redondos nos cantos; rodas de liga simples de 15 polegadas',
   'prata metálico claro', 'fiat-grand-siena', 'w_volkswagen-saveiro_1.jpg', 'a foto mostra o hatch (Gol G5), que tem EXATAMENTE a mesma frente; o carro pedido é a versão SEDÃ de três volumes, com porta-malas saliente'),
 'audi-a5': ('Audi A5 Sportback', 'primeira geração 8T, 2009–2016, liftback de cinco portas',
   'cupê de quatro portas baixo e largo, com teto em arco contínuo até a tampa traseira e vidros das portas sem moldura; grande grade trapezoidal de moldura única com lâminas horizontais; faróis retangulares afilados com linha de LEDs diurnos na base; faróis de neblina redondos nas entradas laterais do para-choque',
   'preto brilhante', 'audi-a4', 'w_audi-a5_1.jpg', ''),
 'mini-cooper': ('Mini Cooper', 'segunda geração R56, 2007–2013, hatch de três portas',
   'hatch pequeno de três portas; teto plano "flutuante" em cor contrastante com as colunas pretas; faróis ovais grandes e inclinados com aro cromado; grade hexagonal de cantos arredondados com moldura cromada e barras horizontais; molduras plásticas pretas nas caixas de roda; capô arredondado em concha, SEM tomada de ar (versão Cooper, não S)',
   'vermelho sólido vivo com teto e capas dos retrovisores brancos', 'volkswagen-up', 'w_mini-cooper_1.jpg', ''),
 'chevrolet-prisma': ('Chevrolet Prisma', 'segunda geração, 2013–2019, sedã compacto derivado do Onix, visual 2013–2016',
   'sedã compacto de quatro portas com traseira curta e alta; grade dividida em duas partes por uma barra horizontal na cor do carro (a de cima estreita, a de baixo grande, em colmeia); faróis grandes e alongados que sobem pelos para-lamas; vinco marcado na lateral; faróis de neblina redondos',
   'azul-marinho metálico escuro', 'fiat-grand-siena', 'w_chevrolet-prisma_0.jpg', ''),
 'volkswagen-saveiro': ('Volkswagen Saveiro', 'geração G5, 2009–2013, picape compacta de cabine simples',
   'picape pequena de cabine simples (duas portas) com caçamba longa e aberta; frente igual à do Gol G5: faróis em forma de gota, grade superior estreita com duas barras horizontais, entrada inferior em trapézio; para-choques na cor do carro; rodas simples de 14/15 polegadas',
   'branco sólido', 'fiat-strada', 'w_volkswagen-parati_8.jpg', ''),
 'fiat-siena': ('Fiat Siena EL', 'primeira geração com a reestilização de 2008, vendido até 2016',
   'sedã compacto de quatro portas de linhas arredondadas; faróis grandes em forma de gota com contorno curvo; grade superior pequena e estreita com moldura cromada; para-choque com entrada de ar inferior larga e faróis de neblina redondos; traseira curta',
   'bordô metálico (vinho)', 'renault-logan', 'w_fiat-siena_0.jpg', ''),
 'volkswagen-bora': ('Volkswagen Bora', 'quarta geração A4/1J, 2000–2006, sedã médio (o mesmo carro do Jetta IV)',
   'sedã médio de três volumes de linhas arredondadas e limpas; faróis retangulares de cantos arredondados com lente lisa única; grade superior pequena com lâminas horizontais pretas; para-choque liso na cor do carro com entrada inferior estreita; colunas grossas e teto arqueado; rodas de liga de 15/16 polegadas',
   'bege champanhe metálico', 'toyota-corolla', 'w_volkswagen-bora_9.jpg', ''),
 'volvo-xc90': ('Volvo XC90', 'segunda geração, 2015–2024, SUV grande de sete lugares',
   'SUV grande e alto de linhas retas, maior e mais comprido que o XC60 da imagem 1, com terceira janela lateral longa; grade retangular grande e vertical com barras verticais cromadas côncavas; faróis com assinatura de LED em "T" deitado; capô longo e plano; para-choque com entradas laterais verticais; rodas de liga grandes de 20 polegadas',
   'bege-acinzentado claro metálico (cinza seixo)', 'jeep-compass', 'w_volvo-xc90_8.jpg', 'a foto mostra a frente; ignore totalmente a plaqueta com texto'),
 'audi-q5': ('Audi Q5', 'primeira geração 8R, 2009–2016, visual 2009–2012',
   'SUV médio de linhas arredondadas com teto que desce suave; grande grade trapezoidal de moldura única com barras verticais cromadas; faróis retangulares com fileira de LEDs diurnos na borda inferior; faróis de neblina redondos em nichos laterais; barras de teto',
   'cinza grafite metálico escuro', 'audi-q3', 'w_audi-q5_5.jpg', ''),
 'volvo-v60': ('Volvo V60', 'segunda geração, 2018–2024, perua média',
   'perua baixa e comprida, com teto longo e traseira quase vertical; grade retangular com barras verticais côncavas; faróis com assinatura de LED em "T" deitado; capô longo; linha de cintura reta; versão normal de rua, SEM molduras plásticas pretas nas caixas de roda e com altura normal',
   'vermelho metálico profundo', 'volvo-s60', 'w_volvo-v60_5.jpg', 'a foto mostra a versão Cross Country (mais alta, com molduras pretas); o carro pedido é o V60 normal, mais baixo e todo na cor do carro'),
 'volkswagen-tiguan': ('Volkswagen Tiguan', 'primeira geração, reestilização 2012–2016',
   'SUV compacto de formas arredondadas; grade superior estreita com duas barras horizontais cromadas ligando os faróis; faróis retangulares com contorno inferior em degrau e LEDs diurnos; para-choque com entrada inferior larga e faróis de neblina; barras de teto; molduras pretas discretas nas caixas de roda',
   'marrom bronze metálico', 'jeep-compass', 'w_volkswagen-tiguan_3.jpg', 'a foto está de frente; use-a só para o desenho da frente'),
 'chevrolet-cobalt': ('Chevrolet Cobalt', 'sedã compacto brasileiro, reestilização 2016–2019',
   'sedã de três volumes alto e espaçoso, com porta-malas grande; faróis afilados e alongados que avançam pelos para-lamas; grade dividida em duas partes por uma barra na cor do carro (a de baixo grande, com moldura cromada); para-choque com nichos de neblina com moldura cromada em "C"',
   'cinza aço metálico médio', 'renault-logan', 'w_chevrolet-cobalt_9.jpg', ''),
 'peugeot-308': ('Peugeot 308', 'primeira geração, hatch feito na Argentina, 2012–2015',
   'hatch médio de cinco portas com capô longo e inclinado e para-brisa muito inclinado; faróis grandes e alongados que sobem pelos para-lamas; grade "flutuante" pequena com moldura cromada no centro do para-choque; LEDs diurnos nas extremidades do para-choque',
   'cinza-azulado sólido claro', 'volkswagen-golf', 'w_peugeot-308_5.jpg', ''),
 'fiat-cronos': ('Fiat Cronos', 'sedã compacto, 2018–2022',
   'sedã compacto moderno de quatro portas com traseira curta e alta; faróis afilados e puxados para trás; grade superior estreita em colmeia com friso cromado ligando os faróis; para-choque com grande entrada inferior e nichos laterais de neblina; vinco forte na lateral; rodas de liga diamantadas de 16/17 polegadas',
   'branco perolizado', 'chevrolet-cruze', 'w_fiat-cronos_0.jpg', ''),
 'volkswagen-virtus': ('Volkswagen Virtus', 'sedã compacto, 2018–2022',
   'sedã de quatro portas longo, com teto em arco e traseira curta; frente igual à do Polo 2018: faróis retangulares afilados ligados por uma grade superior estreita com frisos horizontais cromados; para-choque com entrada inferior larga em colmeia e nichos de neblina; vinco reto ao longo da lateral',
   'azul metálico médio e vivo', 'volkswagen-jetta', 'w_volkswagen-virtus_1.jpg', ''),
 'citroen-c3-aircross': ('Citroën Aircross', 'C3 Aircross brasileiro, reestilização 2016–2020',
   'minivan aventureira compacta e alta; para-lamas e para-choques com molduras plásticas pretas; barras de teto altas; frente com duas barras cromadas finas e horizontais ligando faróis afilados (SEM símbolo no centro); para-choque com protetor inferior prata; para-brisa grande e avançado',
   'branco perolizado com teto preto', 'ford-ecosport', 'w_citroen-c3-aircross_2.jpg', ''),
 'fiat-mobi': ('Fiat Mobi', 'subcompacto urbano, 2016–2024',
   'hatch subcompacto alto e curto de cinco portas; faróis grandes e angulosos que sobem pelo capô; grade superior estreita em colmeia preta; para-choque com entrada inferior grande em trapézio; rodas pequenas de 14 polegadas; molduras pretas nas caixas de roda',
   'prata metálico', 'volkswagen-up', 'w_fiat-mobi_4.jpg', ''),
 'renault-oroch': ('Renault Duster Oroch', 'picape de cabine dupla, 2015–2021',
   'picape média de cabine dupla, com quatro portas e caçamba curta; frente do Duster: grade larga com duas barras cromadas horizontais, faróis retangulares grandes; para-lamas largos e musculosos; para-choque com protetor inferior prata; barras de teto; molduras pretas nas caixas de roda',
   'verde-oliva escuro metálico', 'fiat-toro', 'w_renault-oroch_0.jpg', ''),
 'bmw-x5': ('BMW X5', 'segunda geração E70, 2007–2013',
   'SUV grande de formas musculosas; grade dupla com duas aberturas arredondadas lado a lado, com barras verticais cromadas; faróis alongados com quatro anéis luminosos; capô com vincos em V; para-choque com entradas largas e faróis de neblina redondos; barras de teto; rodas de liga grandes',
   'azul-marinho metálico escuro', 'bmw-x3', 'w_bmw-x5_5.jpg', ''),
 'volkswagen-parati': ('Volkswagen Parati', 'geração G3, 2000–2005, perua compacta',
   'perua compacta de cinco portas com teto longo e reto e traseira vertical; frente do Gol G3: faróis retangulares de cantos arredondados com lente lisa, grade superior estreita com duas lâminas horizontais; para-choque arredondado na cor do carro com entrada inferior estreita; barras longitudinais no teto; rodas de liga de 14/15 polegadas',
   'verde escuro metálico', 'fiat-palio-weekend', 'w_volkswagen-parati_1.jpg', 'a foto está de lado; use-a para a silhueta de perua e o desenho geral'),
 'honda-city': ('Honda City', 'quinta geração GM2, 2009–2014',
   'sedã compacto em forma de cunha, com capô curto e inclinado e para-brisa avançado; faróis afilados e puxados para trás; grade com uma barra cromada larga e espessa entre os faróis; para-choque com entrada inferior trapezoidal; teto em arco e traseira curta e alta',
   'bege dourado claro metálico (champanhe)', 'renault-logan', 'w_honda-city_0.jpg', ''),
 'honda-hr-v': ('Honda HR-V', 'segunda geração, 2015–2021 no Brasil',
   'SUV compacto com perfil de cupê: teto que desce para trás e maçaneta da porta traseira escondida na coluna; faróis afilados ligados por uma barra preta brilhante larga na grade; vinco lateral ascendente forte; para-choque com entradas laterais e faróis de neblina; molduras pretas nas caixas de roda',
   'cinza grafite metálico escuro', 'nissan-kicks', 'w_honda-hr-v_0.jpg', ''),
}
# 2ª tentativa: outra âncora 2 (caminho) e o papel dela, quando a 1ª copiou o carro da âncora
T2 = {
 'volkswagen-saveiro': ('/Users/izzat/Projects/izzatcar-wt/_r16carros/gerados/carro-volkswagen-voyage.png',
   'Imagem 2: arte aprovada do sedã irmão (mesma geração G5), que tem EXATAMENTE a mesma frente, o mesmo capô, os mesmos faróis, a mesma grade e o mesmo para-choque do carro pedido; copiar dela a frente inteira e o estúdio, trocando a carroceria da coluna da porta para trás por cabine simples de duas portas + caçamba. '),
}
def prompt(k, extra=''):
    nome, ger, tracos, cor, anc, foto, nota = CARROS[k]
    anc2, papel2 = (T2[k] if extra and k in T2 else (COR + anc + '.png', None))
    refs = [PILOTO, anc2] + ([REF + foto] if foto else [])
    p = ('Nova geração independente; não editar nenhuma imagem anterior. Use case: ads-marketing. Arte de catálogo horizontal 1536×1024. '
         'Imagem 1: arte-piloto aprovada, referência EXATA de estúdio, câmera, enquadramento e luz. '
         + (papel2 or 'Imagem 2: arte aprovada da mesma família com carroceria parecida; usar só como referência de estúdio, enquadramento e proporção no quadro; NÃO copiar o carro dela: faróis, grade, para-choque, capô, laterais, vidros e rodas são os do modelo pedido (os da foto real). '))
    if foto:
        p += ('Imagem 3: foto real do modelo pedido; usar SOMENTE para o desenho do carro (silhueta, faróis, grade, para-choque, proporções, rodas); '
              'ignorar o ângulo, o fundo, a cor, a sujeira, os emblemas, a placa e qualquer texto da foto' + (f' ({nota})' if nota else '') + '. ')
    p += (f'Fotografia publicitária ultra realista de um {nome} ({ger}) na cor {cor}, de fábrica, impecável, em vista 3/4 dianteira com a frente voltada para a ESQUERDA do quadro '
          '(mesmo lado e mesmo ângulo das imagens 1 e 2), rodas dianteiras levemente viradas, no MESMO estúdio das imagens 1 e 2: fundo infinito liso em tom neutro quente rosado claro, '
          'mais claro à esquerda e um pouco mais escuro à direita; piso refletivo suave com o reflexo do carro; sombra de contato; filete de luz laranja (#FF6A00) no piso, atrás do carro, na mesma altura das referências. '
          'Mesma câmera, mesma altura de câmera, mesma distância e mesmo tamanho do carro no quadro das referências (o carro ocupa cerca de 76% da largura, um pouco à direita do centro, inteiro, sem nada cortado, '
          'com as rodas apoiadas na mesma linha do piso das referências) e mesma luz suave vinda de cima à esquerda. '
          f'Traços distintivos obrigatórios do modelo: {tracos}. '
          'SEM emblemas, SEM logos, SEM letras, SEM placa: grade, capô e tampa lisos, e o lugar da placa liso, sem placa nem suporte. Centros das rodas completamente lisos, sem marca; pneus sem inscrições legíveis; '
          'nenhum emblema no volante nem na carroceria. Um único carro. Sem texto, sem marca-d\'água, sem pessoas, sem objetos. Limpo e premium.')
    if extra: p += ' CORREÇÃO OBRIGATÓRIA em relação à tentativa anterior: ' + extra
    return p, refs


# ---------------------------------------------------------------- lote 2
from carros2 import CARROS2, FOTOS2
REF2 = '/Users/izzat/Projects/izzatcar-wt/_r16carros/refs2/'
GER = '/Users/izzat/Projects/izzatcar-wt/_r16carros/gerados/'
FOTO_T2 = {'peugeot-308': [REF2 + 'peugeot-308_c3.jpg'], 'volkswagen-bora': [REF2 + 'volkswagen-bora_2.jpg'],
           'citroen-c3-aircross': [REF + 'w_citroen-c3-aircross_2.jpg', REF + 'w_citroen-c3-aircross_0.jpg']}   # refação de arte do lote 1: outra foto real (caminho inteiro)
_prompt1 = prompt
def _ancora(a):
    return None if not a else (GER + 'carro-' + a[2:] + '.png' if a.startswith('G:') else COR + a + '.png')
def prompt(k, extra=''):
    if k not in CARROS2:
        p, refs = _prompt1(k, extra)
        if extra and k in FOTO_T2: refs = refs[:2] + FOTO_T2[k]
        return p, refs
    nome, ger, tracos, cor, anc, nota, papel = CARROS2[k]
    anc, foto = _ancora(anc), FOTOS2.get(k)
    fotos = [] if not foto else ([foto] if isinstance(foto, str) else list(foto))
    refs = [PILOTO] + ([anc] if anc else []) + [REF2 + x for x in fotos]
    nf = len(refs) - len(fotos) + 1   # a 1ª foto real
    p = ('Nova geração independente; não editar nenhuma imagem anterior. Use case: ads-marketing. Arte de catálogo horizontal 1536×1024. '
         'Imagem 1: arte-piloto aprovada, referência EXATA de estúdio, câmera, enquadramento e luz. ')
    if anc:
        p += papel or ('Imagem 2: arte aprovada da mesma família com o mesmo tipo de carroceria; usar só como referência de estúdio, enquadramento e proporção no quadro; '
                       'NÃO copiar o carro dela: faróis, grade, para-choque, capô, laterais, vidros e rodas são os do modelo pedido' + (' (os da foto real). ' if foto else '. '))
    if foto:
        p += ((f'Imagem {nf}: foto real do modelo pedido' if len(fotos) == 1 else f'Imagens {nf} e {nf + 1}: fotos reais do modelo pedido') + '; usar SOMENTE para o desenho do carro (silhueta, faróis, grade, para-choque, proporções, rodas); '
              'ignorar o ângulo, o fundo, a cor, a sujeira, os emblemas, a placa e qualquer texto da foto' + (f' ({nota})' if nota else '') + '. ')
    refs_txt = 'das imagens 1 e 2' if anc else 'da imagem 1'
    p += (f'Fotografia publicitária ultra realista de um {nome} ({ger}) na cor {cor}, de fábrica, impecável, em vista 3/4 dianteira com a frente voltada para a ESQUERDA do quadro '
          f'(mesmo lado e mesmo ângulo {refs_txt}), rodas dianteiras levemente viradas, no MESMO estúdio {refs_txt}: fundo infinito liso em tom neutro quente rosado claro, '
          'mais claro à esquerda e um pouco mais escuro à direita; piso refletivo suave com o reflexo do carro; sombra de contato; filete de luz laranja (#FF6A00) no piso, atrás do carro, na mesma altura das referências. '
          'Mesma câmera, mesma altura de câmera, mesma distância e mesmo tamanho do carro no quadro das referências (o carro ocupa cerca de 76% da largura, um pouco à direita do centro, inteiro, sem nada cortado, '
          'com boa margem de parede dos dois lados e as rodas apoiadas na mesma linha do piso das referências) e mesma luz suave vinda de cima à esquerda. '
          f'Traços distintivos obrigatórios do modelo: {tracos}. '
          'SEM emblemas, SEM logos, SEM letras, SEM placa: grade, capô e tampa lisos, e o lugar da placa liso, sem placa nem suporte. Centros das rodas completamente lisos, sem marca; pneus sem inscrições legíveis; '
          'nenhum emblema no volante nem na carroceria. Um único carro. Sem texto, sem marca-d\'água, sem pessoas, sem objetos. Limpo e premium.')
    if extra: p += ' CORREÇÃO OBRIGATÓRIA em relação à tentativa anterior: ' + extra
    return p, refs
