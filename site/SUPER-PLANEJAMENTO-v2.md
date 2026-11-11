# Izzat Car — Site v2 · super planejamento (09/11/2026)

Regra-mãe (Izzat, 09/11): **cenário nunca pode ser bagunçado** · todo bloco é arte criada (ChatGPT, super prompt) ou componente de referência (21st.dev/GitHub) · marcas com logo + nome · nada de vídeo/foto real da loja.

## Bíblia visual (vale para TODA arte)
- **Mundo:** estúdio fotográfico automotivo premium, fundo infinito (cyclorama) em neutro quente muito claro (#F4F3F0 → #E7E5E1), piso levemente refletivo, luz de softbox grande do alto-esquerda, contraluz suave, **um toque de laranja #FF6A00** (filete de luz, aro, faixa), sombras de contato nítidas. Limpo, organizado, caro. Nada de chão sujo, graxa, caixas, bagunça, pessoas ao fundo.
- **Peças:** fotorrealistas, originais de fábrica, limpas e bem conservadas, fiéis à peça real (formato, conectores, materiais). Ângulo 3/4, iluminação de produto.
- **Tipografia desenhada (quando houver texto):** sans-serif condensada extra-pesada em grafite #1d1d1f (estilo Archivo Condensed Black), sublinhado de pincel laranja #FF6A00 sob a palavra-chave, subtítulo em sans-serif regular grafite #3a3a3d. Laranja SEMPRE com texto grafite, nunca branco.
- **Proibido em arte:** logos ou emblemas de montadoras inventados/distorcidos, marcas d'água, texto extra, preço, "frete grátis", número de peças, "tem aqui", mãos deformadas.
- **Personagem Maruf** (só onde indicado): fichas e texto-trava de `ARTES FEED/maruf-referencia/PADRAO-PERSONAGEM-MARUF.md`.

## Telas (home) — bloco a bloco
| # | Bloco | Arte × dado vivo | Celular (390) | PC (1440) | Referência |
|---|---|---|---|---|---|
| 1 | Abertura | arte de fundo (3 direções no piloto) + H1, busca com sugestões e seletor de carro VIVOS numa zona reservada à esquerda (PC) / em cima (celular) | arte 1024×1536 recortada, zona de texto no topo 45% | arte 2400×1200 (ampliada), zona de texto 42% à esquerda | Hero Scrub #12213 (direção B) |
| 2 | Selos de confiança | 4 ícones-arte 3D (escudo 90 dias, nota fiscal, selo CDV, caixa de envio) + nome vivo | 2×2 | 4 em linha, ícone 72 px | — |
| 3 | Marcas | logo real (simple-icons / car-logos-dataset) + nome + nº de peças | marquee 2 linhas | grade 9×3 com hover | Logo Cloud #21465 / marquee #26922 |
| 4 | Categorias | 20 artes (peça em estúdio, mesma câmera/luz, **nome desenhado**) + nº de peças vivo em selo | 2 colunas | bento 4–5 colunas, 2 destaques grandes | Shop by Category Grid #29288 |
| 5 | Chegou no pátio | cartão de peça com **capa de estúdio** (automática) | trilho com arrasto | carrossel 3D coverflow | #25480 / #2583 |
| 6 | Banner "Serve no meu carro?" | arte nova (PC + celular) | 2:3 | 3:2 | — |
| 7 | Carros do pátio | 12 artes de carro em estúdio (sem emblema) + logo da marca + nome vivo | trilho | grade 4×3 | — |
| 8 | Como comprar | 4 artes de passo (nova leva) | trilho | 4 em linha | — |
| 9 | Oficinas / Não achou | 2 banners novos (PC + celular) | 2:3 | lado a lado | — |
| 10 | Perguntas | acordeão + cartão de atendimento com arte do Maruf | — | 2 colunas | FAQ #31986 |
| 11 | Rodapé | marca gigante, colunas, arte de selos | — | — | Footer #33904 |
| — | **REMOVIDO** | "Por dentro do pátio", todos os vídeos | | | |

## Super prompts dos pilotos (checkpoint 1)
### P1 · Abertura A "Estúdio" (1536×1024 + versão 1024×1536)
> Fotografia publicitária automotiva premium, ultra realista. Estúdio com fundo infinito em neutro quente muito claro (#F4F3F0 a #E7E5E1), piso de resina clara levemente refletivo. No terço DIREITO da imagem: um farol dianteiro LED moderno (genérico, sem marca) como peça-herói, em ângulo 3/4, iluminado por softbox grande; ao redor, flutuando em níveis diferentes e bem espaçados, quatro peças originais limpas: um alternador, uma pinça de freio, um amortecedor, uma central multimídia — composição elegante, harmônica, com sombras suaves projetadas no piso. Um fino filete de luz laranja (#FF6A00) contorna o farol. Os 55% da ESQUERDA da imagem ficam com o fundo limpo e vazio (área reservada para texto e busca do site). Sem texto, sem logos, sem marcas d'água, sem pessoas. Luz de manhã, sensação de loja premium, organizada e cara.

### P2 · Abertura B "Carro explodido" (1536×1024)
> Render fotorrealista estilo publicidade de montadora: um SUV médio moderno genérico (sem emblema, sem logo, sem placa), prata, em vista explodida técnica 3/4 dianteira — carroceria ao centro e as principais peças afastadas em camadas ordenadas: faróis, para-choque, capô, rodas com discos e pinças de freio, amortecedores, motor, câmbio, radiador, bancos, painel — todas limpas e alinhadas com precisão, como um diagrama de engenharia de luxo. Estúdio claro com fundo infinito neutro quente (#F4F3F0), sombras suaves, um filete de luz laranja (#FF6A00) no piso. Composição ocupando os 60% da DIREITA; os 40% da esquerda vazios e limpos (área para texto). Sem texto, sem logos.

### P3 · Abertura C "Pátio impecável" (1536×1024) — com Maruf (anexos + texto-trava)
> [texto-trava do personagem] Cena: Maruf em pé, sorriso leve, segurando um farol LED original com as duas mãos, num galpão de peças PERFEITAMENTE organizado e limpo — prateleiras metálicas grafite com detalhes laranja (#FF6A00), peças alinhadas e etiquetadas, piso de concreto polido claro, luz natural entrando por janelas altas. Nada de bagunça, sujeira, caixas soltas ou outras pessoas. Maruf no terço DIREITO; os 55% da esquerda com fundo desfocado e calmo (área para texto). Sem texto, sem logos, sem emblemas de carro. Fotografia cinematográfica realista, profundidade de campo suave.

### P4 · Categoria (padrão das 20) — piloto com **Iluminação** e **Freios** (1024×1024)
> Fotografia de produto premium, ultra realista. Uma única peça automotiva original e limpa — [PEÇA: "um farol dianteiro LED moderno" | "uma pinça de freio com disco ventilado"] — em ângulo 3/4, sobre um pedestal baixo redondo de resina grafite fosca, no centro-alto do quadro. Fundo infinito neutro quente muito claro (#F4F3F0 → #E7E5E1), softbox do alto-esquerda, contraluz suave, sombra de contato nítida, um fino aro de luz laranja (#FF6A00) na borda do pedestal. Na parte de BAIXO, alinhado à esquerda com margem de 7%, o texto desenhado "[NOME: Iluminação | Freios]" em sans-serif condensada extra-pesada grafite #1d1d1f, com um sublinhado curto de pincel laranja #FF6A00 abaixo. Deixe o canto SUPERIOR DIREITO livre (selo com número de peças entra depois). Nenhum outro texto, sem logos, sem marcas.

### P5 · Carro do pátio (padrão dos 12) — piloto **Volvo XC60** (1536×1024)
> Fotografia publicitária ultra realista de um Volvo XC60 (geração 2018–2024) prata, vista 3/4 dianteira, rodas viradas levemente, num estúdio com fundo infinito neutro quente muito claro (#F4F3F0), piso refletivo suave, sombra de contato, filete de luz laranja (#FF6A00) no piso. SEM emblemas, SEM logos, SEM placa (grade e tampa lisas). Carro ocupando 75% da largura, centralizado um pouco à direita. Sem texto, sem pessoas, sem objetos. Limpo e premium.

### P6 · Selo de confiança (padrão dos 4) — piloto **90 dias de garantia** (1024×1024)
> Ícone 3D premium estilo renderização de produto: um escudo arredondado em laranja #FF6A00 acetinado com um check grafite em relevo, levemente inclinado, sobre fundo neutro quente muito claro (#F4F3F0), sombra suave, luz de estúdio. Um único objeto, silhueta clara, reconhecível a 64 px. Sem texto, sem números, sem outros objetos.

### P7 · Banner "Serve no meu carro?" v2 (1536×1024 + 1024×1536) — com Maruf
> [texto-trava] Mesmo conceito do banner aprovado, mas em ESTÚDIO LIMPO (fundo neutro quente, sem prateleiras): Maruf segurando um farol LED e um celular. Textos desenhados EXATOS: pílula "SERVE NO MEU CARRO?" (laranja #FF6A00, letra grafite), título "Manda o modelo e o ano." (condensada extra-pesada grafite, pincel laranja sob "modelo e o ano"), subtítulo "A gente confere e te responde com foto." (sans-serif regular grafite, grande e legível), botão desenhado "Chamar no WhatsApp" (laranja, letra grafite). Canto inferior direito livre para o logo. Nenhum outro texto.

## Verificação de cada arte (obrigatória)
Zoom em: ortografia exata (acentos), nenhum texto extra, peça fiel/real, sem logo inventado, mãos com 5 dedos, rosto do Maruf igual à ficha, zona reservada vazia, cenário sem nenhuma bagunça. Reprovou → refaz do zero (conversa nova) · até 3 tentativas · reprovadas vão para a Lixeira.


## Produção completa — DIREÇÃO ESCOLHIDA: A · Estúdio (Izzat, 09/11)
Regras de produção (valem para todas):
- **Uma família = uma ferramenta + a arte-piloto anexada como referência de estilo** em toda geração (categorias e selos: ChatGPT; carros, banners com Maruf, passos, topos, história, OG/404/vazio: Codex).
- **Um objeto só** por arte de categoria/selo (regra "ícone = um objeto só").
- **Nome desenhado = nome da família no site** (o mesmo do título da página e da trilha). "Outros" fica fora da grade (não tem página).
- Texto das categorias: mesma fonte, tamanho e posição da referência (maiúsculas ≈ 8% da altura); nome longo quebra em DUAS linhas, nunca diminui a letra.

### Categorias (17 restantes; padrão = prompt P4 + anexar `arte-v2/p4-cat-iluminacao.png`; 1:1)
| arquivo | NOME desenhado (exato) | PEÇA (uma só) |
|---|---|---|
| cat-pecas-de-interior | Peças de Interior | um volante original em couro preto com costura cinza, miolo central liso sem emblema |
| cat-motor | Motor | um motor 4 cilindros completo e limpo (bloco, cabeçote com tampa de válvulas e coletor), sem marca visível |
| cat-carroceria | Carroceria | um retrovisor externo elétrico prata com pisca integrado |
| cat-sistema-eletrico | Sistema Elétrico | um módulo eletrônico automotivo (ECU) de alumínio com conectores pretos, sem etiqueta e sem texto |
| cat-climatizacao | Climatização | um compressor de ar-condicionado automotivo com polia |
| cat-injecao | Injeção | um corpo de borboleta eletrônico (TBI) de alumínio com conector |
| cat-pecas-de-exterior | Peças de Exterior | uma grade dianteira moderna preto brilhante, centro liso sem emblema |
| cat-janelas-e-vedacoes | Janelas e Vedações | uma máquina de vidro elétrico com motor, trilho e cabos |
| cat-fechaduras-e-chaves | Fechaduras e Chaves | uma chave canivete automotiva aberta com controle de 3 botões, sem logotipo |
| cat-suspensao-e-direcao | Suspensão e Direção | um amortecedor com mola helicoidal (conjunto completo) preto e prata |
| cat-ignicao | Ignição | uma bobina de ignição individual tipo caneta, preta, em pé |
| cat-transmissao | Transmissão | uma caixa de câmbio automático de alumínio, limpa |
| cat-seguranca | Segurança | um módulo de airbag do volante com capa grafite lisa, sem emblema |
| cat-som-e-multimidia | Som e Multimídia | uma central multimídia automotiva com a tela APAGADA (preta, sem ícones) e botões sem texto |
| cat-filtros | Filtros | uma caixa de filtro de ar automotiva preta com o duto de entrada |
| cat-arrefecimento | Arrefecimento | um radiador de alumínio com eletroventilador acoplado |
| cat-escapamentos | Escapamentos | um silencioso (abafador) de aço inox escovado com ponteira |

### Selos (3 restantes; padrão = prompt P6 + anexar `arte-v2/p6-selo-garantia.png`; 1:1; SEM texto)
- selo-nota-fiscal: uma folha de nota fiscal com o cantinho dobrado, linhas cinza sem letras legíveis, e um carimbo redondo laranja #FF6A00 com check grafite
- selo-cdv: um selo oficial de credenciamento — medalha redonda grafite com borda serrilhada, aro laranja #FF6A00, duas fitas laranja penduradas abaixo e um check em relevo no centro
- selo-envio: uma caixa de papelão fechada e limpa com fita laranja #FF6A00 e uma seta curva de movimento grafite

### Abertura A — celular (refazer)
P1 vertical 2:3, mesma composição de `arte-v2/p1-estudio-celular.png`, mas SEM a central multimídia (troca por um turbocompressor): nenhuma tela, nenhum ícone, nenhum texto. Topo 45% vazio.

### Carros do pátio (11; padrão = P5 + anexar `arte-v2-codex/p5-carro-xc60.png` + fotos reais do modelo; 3:2)
BMW X3 (2018+), Jaguar E-Pace, Jeep Compass (2017+), Volvo S60 (2019+), Renault Kardian, Honda WR-V, Citroën C3, Chevrolet Tracker (2020+), Audi A4 (B8), Fiat Toro, Volkswagen Gol (G5/G6). Todos prata, 3/4 dianteira, mesmo estúdio, SEM emblema/logo/placa.

### Banners v2 com Maruf (PC 3:2 + celular 2:3; padrão P7 + anexar `arte-v2-codex/p7-banner-serve-pc.png` + fichas)
- **Oficinas:** pílula "OFICINAS E REVENDAS" · título "Separamos as peças pra sua oficina." (pincel sob "pra sua oficina") · subtítulo "Manda a lista com carro e ano: a gente confere e responde com foto e código." · botão "Falar com a gente" · Maruf segurando uma prancheta com as duas mãos.
- **Não achou:** pílula "NÃO ACHOU A PEÇA?" · título "A gente procura no pátio." (pincel sob "no pátio") · subtítulo "Nem toda peça está anunciada. Manda o carro e a peça no WhatsApp." · botão "Chamar no WhatsApp" · Maruf de braços cruzados, sorriso confiante, ao lado de uma bancada de estúdio limpa com 3 peças alinhadas (alternador, farol, pinça de freio).

### Como comprar (4 artes 1:1; estúdio claro; a 1ª vira referência das outras 3)
Disco laranja #FF6A00 com o algarismo grafite no canto superior esquerdo; objeto 3D no centro-alto; título (condensada extra-pesada grafite) e subtítulo (regular grafite, grande) desenhados embaixo, alinhados à esquerda.
1. "Ache a peça" / "Pelo nome, pelo carro ou pelo código gravado." — uma lupa grafite sobre um alternador
2. "Confirme o seu carro" / "Manda o modelo e o ano. A gente confere na peça." — um celular de tela apagada em pé ao lado de um farol, com um balão de conversa 3D laranja flutuando
3. "Feche a compra" / "No Mercado Livre ou direto pelo WhatsApp." — uma sacola de compras grafite com alça laranja com uma pinça de freio dentro
4. "Receba em casa" / "Com nota fiscal e código de rastreio." — uma caixa de papelão com fita laranja e uma nota fiscal dobrada encostada

### Topo de páginas (7; gerar 3:2 com TUDO dentro da faixa central de 25% a 75% da altura — recorte final 2,4:1; objeto no terço direito, 55% da esquerda vazio; sem texto)
Catálogo (fila de peças sobre balcão de estúdio: farol, alternador, pinça, bobina, retrovisor) · Carros (frente de um SUV prata genérico sem emblema saindo da penumbra do estúdio) · Garantia (escudo 3D laranja com check grafite, grande) · Envios (caixa com fita laranja sobre rampa de estúdio, seta de movimento) · Contato (celular de tela apagada com balão de conversa 3D laranja) · Procuro peça (lupa grande sobre três peças) · O pátio (bancada de estúdio impecável com peças alinhadas, cada uma com etiqueta laranja pendurada sem texto)

### O pátio — "Do carro à peça" (4 cenas 3:2, sem texto, sem pessoas, tudo impecável)
1. Carro chega: SUV prata genérico sem emblema/placa num box claro e vazio, pasta de documentos grafite sobre um pedestal ao lado
2. Desmontagem cuidadosa: o farol já removido apoiado num carrinho de ferramentas grafite impecável, ao lado da frente do carro
3. Peça conferida e etiquetada: um alternador limpo sobre bancada clara com etiqueta laranja pendurada e uma lupa
4. Embalada e enviada: caixa de papelão com fita laranja, plástico-bolha limpo e a peça dentro

### Outros (Codex)
- og (1536×1024 → recorte 1200×630): estúdio com farol-herói e 3 peças à direita; à esquerda o título desenhado "Peças originais de desmanche legalizado." e subtítulo "Nota fiscal e 90 dias de garantia."; canto inferior esquerdo livre para o logo real.
- 404 (1:1, sem texto): um único parafuso sobre o pedestal grafite com aro laranja, sob um holofote, estúdio vazio.
- vazio-busca (1:1, sem texto): uma lupa grafite deitada sobre o pedestal vazio com aro laranja.


## Abertura viva — "o estúdio vira o seu carro" (rodada 15, 11/11/2026)
Pedido: "aqui você não trabalhou né… fazer a coisa mais fantástica do mundo". A arte parada (P1) saiu; a abertura virou
uma cena que responde ao seletor. Três conceitos pesados (o escolhido e os dois descartados):
1. **O estúdio vira o seu carro** (ESCOLHIDO): palco com peças em camadas que são links; ao escolher o carro, o título
   passa a dizer o carro, a arte dele entra e as peças viram atalhos com a contagem real. O "uau" acontece na hora em que
   o cliente faz o que a loja mais quer (dizer o carro) e o que aparece encurta o caminho até a peça.
2. **O carro que se desmonta** (descartado): sequência presa à rolagem até o Raio-x. Mais vistoso e pior para o cliente
   (atrasa, pesa no celular barato, o Raio-x fica 3 seções abaixo).
3. **O seletor é o herói** (descartado como conceito, aproveitado em parte): só o cartão, grande e tátil. O mais direto e
   o menos memorável; dele ficou o retorno a cada passo (título que se reescreve).

### Tela (o que é arte × o que é dado vivo)
| Bloco | Arte | Dado vivo |
|---|---|---|
| Olho + título | traço de pincel laranja (SVG) | "Peças originais usadas"; a palavra do título (carro/marca/modelo e ano) |
| Selos | medalhões desenhados em CSS (grafite com escudo; verde WhatsApp) | "Desmanche legal · CDV Detran-RS nº 01060"; "10% de desconto · comprando pelo WhatsApp" |
| Cartão | — | o seletor e a busca, iguais |
| Palco | fundo de estúdio em CSS (parede, piso, linha de luz laranja) + 18 peças recortadas + as 93 artes de carro que já existiam | rótulo de cada peça (bloco), número de peças do carro, legenda "Para o seu Onix 2019" |
| Celular, 1ª tela | o farol aceso espiando da direita (140 px) | — |

### Super prompt das peças (Codex, uma geração por peça; anexos: a arte antiga da abertura e o Raio-x, só como acabamento)
Regras comuns (em toda geração): UM objeto só, sozinho; peça limpa, original, quase nova, fiel à peça real; fundo liso
e uniforme cinza quente claro `#DAD6D1`, sem linha de piso, sem reflexo, sem vinheta, SEM sombra projetada (a peça como
se estivesse suspensa); a peça inteira no quadro, centrada, 78–86% do lado maior, margem de 6% nos quatro lados; lente
85 mm, vista 3/4 um pouco de cima, f/8, tudo nítido; um softbox grande do alto-esquerda, preenchimento suave da direita;
PROIBIDO: texto, números, etiquetas, adesivos, códigos, logos ou emblemas (reais ou inventados), marca d'água, pessoas.
| arquivo | objeto |
|---|---|
| farol (1536×1024, a heroína) | farol full-LED de sedã genérico, lente clara, moldura preto brilhante, dois projetores cromados, guia de luz do DRL em L ACESA (branco limpo), filete âmbar ACESO no contorno externo, carcaça com as abas de fixação; 3/4 pela esquerda, deitado, 84% da largura |
| pinca | pinça de freio monobloco de 4 pistões pintada no laranja da marca `#FF6A00`, pastilhas montadas, sangrador, face externa lisa (sem letras) |
| turbo | turbocompressor: caracol de alumínio acetinado com as pás à vista, carcaça da turbina em ferro fundido com flange quadrada, atuador da wastegate |
| amortecedor | conjunto amortecedor + mola dianteiro, mola preta, haste cromada, coifa, batente superior com 3 prisioneiros; na diagonal |
| retrovisor | retrovisor externo esquerdo, capa prata metálica, base preta, pisca apagado, vidro refletindo só um estúdio cinza liso |
| alternador | alternador de alumínio com os enrolamentos de cobre à vista, polia poly-V preta |
| motor | motor 4 cilindros a gasolina completo e limpo, coletor de admissão preto, tampa de válvulas lisa |
| modulo | módulo de injeção (ECU) de alumínio com aletas e dois conectores pretos, sem etiqueta |
| borboleta | corpo de borboleta eletrônico de alumínio com a borboleta cor de latão entreaberta |
| macaneta | maçaneta externa prata com filete cromado no suporte preto (mola, alavanca do cabo) |
| difusor | difusor de ar redondo tipo turbina, aro cromado acetinado, aletas preto brilhante |
| compressor | compressor de ar-condicionado de alumínio com polia e embreagem eletromagnética, duas saídas com tampa |
| vidro | comando de vidro elétrico da porta do motorista, 4 teclas com filete cromado e o botão do retrovisor (só pictogramas, sem letras) |
| seta | chave de seta e limpador (conjunto da coluna), duas hastes abertas, só pictogramas |
| mangueira | mangueira do radiador moldada em S, borracha preta fosca, uma abraçadeira de mola em cada ponta |
| parachoque | para-choque dianteiro prata, grade inferior de colmeia preta, nichos de farol de milha, sem placa nem emblema |
| cambio | alavanca de câmbio manual com manopla de couro lisa (sem o desenho das marchas), coifa e a base com os cabos |
| forro | forro de porta dianteira esquerda preto e grafite, com apoio de braço, puxador e grade do alto-falante |
Recorte: `python ferramentas/camada_abertura.py`. Conferência de cada peça: zoom de 200% da borda sobre fundo claro e
escuro (sem auréola), nenhuma letra, um objeto só. Reprovadas e originais: `izzatcar-wt/_r15hero/arte/gerados/`.
