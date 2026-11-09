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


## Produção completa (depois do checkpoint 1)
### Categorias (17 restantes; padrão = prompt P4, mesma câmera/pedestal/luz; 1:1)
| arquivo | NOME desenhado | PEÇA |
|---|---|---|
| cat-pecas-de-interior.webp | Interior | um volante esportivo original em couro preto com costura cinza, sem emblema no centro |
| cat-motor.webp | Motor | um motor 4 cilindros completo e limpo (bloco, cabeçote e coletor), sem marca visível |
| cat-carroceria.webp | Carroceria | um retrovisor externo elétrico prata com pisca integrado |
| cat-sistema-eletrico.webp | Elétrica | um módulo eletrônico automotivo (ECU) de alumínio com conectores pretos |
| cat-climatizacao.webp | Climatização | um compressor de ar-condicionado automotivo com polia |
| cat-injecao.webp | Injeção | um corpo de borboleta eletrônico (TBI) de alumínio com conector |
| cat-pecas-de-exterior.webp | Exterior | uma grade dianteira moderna preto brilhante, sem emblema |
| cat-janelas-e-vedacoes.webp | Vidros e Vedações | uma máquina de vidro elétrico com motor, trilho e cabos |
| cat-fechaduras-e-chaves.webp | Travas e Chaves | uma chave canivete automotiva com controle de 3 botões, sem logotipo, ao lado de uma fechadura de porta |
| cat-suspensao-e-direcao.webp | Suspensão e Direção | um amortecedor com mola helicoidal (conjunto coilover) preto e prata |
| cat-ignicao.webp | Ignição | uma bobina de ignição individual (tipo caneta) preta |
| cat-transmissao.webp | Câmbio | uma caixa de câmbio automático de alumínio, limpa |
| cat-seguranca.webp | Segurança | um módulo de airbag do volante e um cinto de segurança com pré-tensionador |
| cat-som-e-multimidia.webp | Som e Multimídia | uma central multimídia automotiva com tela touch APAGADA (tela preta, sem ícones) |
| cat-filtros.webp | Filtros | uma caixa de filtro de ar automotiva preta com o duto de entrada |
| cat-arrefecimento.webp | Arrefecimento | um radiador de alumínio com eletroventilador acoplado |
| cat-escapamentos.webp | Escapamento | um catalisador e silencioso em aço inox escovado |

### Carros do pátio (11 restantes; padrão = prompt P5, sem emblema/logo/placa, mesma cor prata, 3/4 dianteira)
BMW X3, Jaguar E-Pace, Jeep Compass, Volvo S60, Renault Kardian, Honda WR-V, Citroën C3, Chevrolet Tracker, Audi A4, Fiat Toro, Volkswagen Gol

### Selos (3 restantes; padrão = prompt P6, um objeto 3D só)
- selo-nota-fiscal: uma folha de nota fiscal com cantinho dobrado e um carimbo de check laranja
- selo-cdv: um escudo/medalha redonda grafite com aro laranja e o número "01060" em relevo (ÚNICO texto)
- selo-envio: uma caixa de papelão fechada com fita laranja e seta de movimento

### Banners v2 (PC 3:2 + celular 2:3, estúdio limpo, padrão P7)
- Oficinas e revendas (Maruf com prancheta) · Não achou a peça? (Maruf com lanterna, estúdio)
### Como comprar (4 artes 1:1, estúdio claro, número em disco laranja com algarismo grafite, título e subtítulo desenhados)
### Topo de páginas (7, 3:1 panorâmicas, peça-símbolo em estúdio + zona livre à esquerda): Catálogo, Carros, Garantia (escudo), Envios (caixa), Contato (celular com balão), Procuro peça (lupa sobre peças), O pátio (galpão impecável sem pessoas)
### O pátio — "Do carro à peça" (4 cenas limpas e organizadas): chega com baixa legal · desmontagem cuidadosa · peça conferida e etiquetada · embalada e enviada
### Outros: estado vazio da busca, 404, imagem de compartilhamento (OG)
