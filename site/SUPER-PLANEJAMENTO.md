# Site novo Izzat Car — super planejamento (direção A · Oficina clara, escolhida em 08/11)

## Sistema (vale para tudo)
- **Tokens** em `src/styles/global.css` (`[data-direcao="a"]` + modo escuro automático pelo sistema).
  - fundo `#f5f5f7` / faixa `#ececf0` / superfície `#fff`;
  - texto `#1d1d1f` / secundário `#5b5b61` / terciário `#8e8e93`;
  - linha `#e2e2e7`;
  - laranja `#FF6A00` **sempre com letra grafite `#1d1d1f`**; laranja como texto = `#C2410C`.
- **Tipografia:** só Archivo variável. Título = largura 78%, peso 820. Texto = largura 100%. Preço = largura 80–84%, peso 800–850, `tabular-nums`. Geist Mono só no código gravado (OEM).
- **Raios:** cartão 16–18 px, botão 12 px, janela de mídia 24–28 px. Pílula só em status.
- **Botões desenhados:**
  - `.botao-laranja`: gradiente, brilho interno e sombra quente;
  - `.botao-grafite`;
  - `.botao-linha`.
  - Nunca o botão padrão do navegador.
- **Ícones:**
  - selos = discos laranja aprovados (`/icones/*.webp`);
  - categorias = peça REAL recortada (`/categorias/*.webp`);
  - linha (Lucide) só dentro de botão e campo.
- **Arte com texto desenhado (Codex):** banners, chamadas e passos de "Como comprar", com `alt`/`aria-label` contendo o texto. Logo original aplicado depois, nunca pela IA.
- **Letra viva:** nome da peça, preço, filtros, títulos de seção e textos das páginas (SEO e atualização a cada 30 min).
- **Proibido em qualquer texto ou arte:**
  - frete grátis em arte (só a etiqueta do anúncio, ligada ao ML);
  - número de peças em arte;
  - "tem aqui" / "a gente tem";
  - preço em arte;
  - "mais barato que…";
  - "100% garantido";
  - depoimento inventado.
- **Fatos confirmados:** CDV Detran-RS nº 01060, nota fiscal em toda venda, 90 dias de garantia em toda peça, envio para todo o Brasil, Destaque Aceguá 2025, WhatsApp (53) 99117-0950, @cdvizzatcarimports, loja ML IZZAT_CAR_IMPORTS.
- **Ainda a confirmar com o Maruf (fora do site até lá):** endereço, horário, 12x no cartão, retirada no local, "lacre".
- **Celular primeiro.** Conferir de 320 a 1920 px, na vertical e na horizontal, com toque mínimo de 44 px e `prefers-reduced-motion`.

## Telas

### 1. Home `/index.html`
| Bloco | Celular (390) | Computador (1440) | Arte × dado |
|---|---|---|---|
| Cabeçalho fixo | 68 px, logo 54 px, busca (ícone) + WhatsApp (ícone) | 84 px, logo 66 px, menu de 4 itens + WhatsApp com texto | logo real |
| Abertura | título 44 px, apoio, busca 64 px, seletor marca/modelo/ano, janela de vídeo 1:1.05 com selo CDV e etiqueta flutuante | 2 colunas 1.06/0.94; título 84 px; janela 4:5 | vídeo real `v-showroom` + selo SVG + etiqueta = dado vivo |
| Selos | 2×2 | 4 em linha | discos aprovados |
| Categorias | 2 colunas | 5 colunas | peça real recortada + contagem viva |
| Chegou no pátio | trilho com arrasto | 5 visíveis | etiquetas (dado vivo) |
| Banner "Serve no meu carro?" | arte 3:2 inteira | arte 3:2 com largura máxima | arte Codex (A) → WhatsApp |
| Carros do pátio | trilho de cartões de carro (capas reais de 4 peças) | grade 4 colunas | dado vivo (92 carros) |
| Marcas | pílulas roláveis com contagem | nuvem de marcas | dado vivo |
| Como comprar | 4 cartões-arte em trilho | 4 lado a lado | arte Codex com texto |
| Por dentro do pátio | vídeo `h-galpao` 16:10 + 3 verticais | faixa 2/3 + 1/3 | vídeos reais |
| Oficinas e revendas | arte 3:2 | arte 3:2 | arte Codex → WhatsApp |
| Perguntas | acordeão | acordeão em 2 colunas | texto vivo (FAQPage) |
| Não achou? | arte 3:2 | arte | arte Codex → WhatsApp |
| Rodapé | escuro, logo claro, 4 grupos | 4 colunas | texto vivo |

### 2. Catálogo `/catalogo.html` (ilha React)
- **Topo:** título + busca grande com sugestões (foto, nome e preço) + seletor de carro.
- **Barra:** "N peças" + ordenar (relevância, menor preço, maior preço, mais novos) + botão "Filtros", que abre a gaveta no celular.
- **Lateral no computador:** marca → modelo, ano, tipo de peça, preço e "frete grátis no ML", com contagem que exclui a própria faceta.
- **Fichas ativas:** removíveis.
- **Grade de etiquetas:** 2 colunas no celular, 3 a 4 no computador, "Ver mais 48".
- **Estado vazio:** ilustração sem texto + texto vivo com o termo + WhatsApp "Procuro: …".
- **Estado na URL** com os parâmetros antigos: `q, marca, modelo, ano, tipo, preco, frete, ordem`.
- **Sem JS:** lista estática das 48 primeiras + links por categoria (SEO).

### 3. Peça `/peca/<slug>.html` (×5.316)
- Trilha (Início / Catálogo / Categoria / Carro).
- **Topo:** galeria (deslizar, miniaturas, tela cheia com zoom) + compra (serve em, nome limpo, título do ML, preço, WhatsApp com mensagem pronta, Mercado Livre, aviso "confirme o seu carro", código com copiar, 4 selos).
- **Barra de compra fixa no celular** depois de rolar a abertura: preço + WhatsApp.
- **Abaixo:**
  - ficha técnica (tabela);
  - descrição em HTML limpo;
  - "Outras peças deste carro" (8);
  - banner "Serve no meu carro?".
- **JSON-LD:** Product + Offer + BreadcrumbList. `window.IZZAT_PRODUCT` vem antes do rastreio.

### 4. Carros `/carros/index.html` + `/carros/<marca-modelo>.html` (92)
- **Índice:** busca por nome + grade de cartões de carro (mosaico de 4 fotos reais, marca, modelo, anos e nº de peças).
- **Página do carro:**
  - topo com o nome grande e os anos;
  - atalhos por sistema (com contagem);
  - grade de etiquetas;
  - banner "Serve no meu carro?".

### 5. Marcas `/marca/<k>.html` (27) · Categorias `/categoria/<k>.html` (20)
- **Marca:** topo + modelos (cartões) + peças.
- **Categoria:** topo com a peça recortada grande + marcas que têm a peça + grade.

### 6. Institucionais
- Como comprar, Garantia e trocas, Envios, O pátio (sobre), Contato, Procuro peça (formulário → WhatsApp) e 404.
- Só fatos confirmados.

### 7. Técnico
- `veiculos.html` → meta refresh + canonical `/carros/index.html`.
- Rastreio: GA4 `G-M9W3R23RY9` + Pixel `2508976816257209`, carregados depois do conteúdo.
  - Eventos: PageView, ViewContent (peça), Search, Contact (wa.me), InitiateCheckout (só os botões de compra no ML).
- Sitemap índice + partes (peças, carros, marcas, categorias, páginas) com lastmod. `robots.txt`.
- Deploy: workflow `atualizar.yml` → python atualizar → preparar_dados → astro build → deploy-pages.
