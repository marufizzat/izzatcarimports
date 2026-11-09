# Site da Izzat Car Imports — como funciona (versão nova, nov/2026)

O site **izzatcarimports.com.br** é gerado a partir dos anúncios ativos do Mercado Livre
e publicado sozinho no GitHub Pages a cada 30 minutos.

## O caminho dos dados
1. `atualizar_catalogo.py` puxa os anúncios ativos pelo backend (Cloudflare) com o segredo
   `ADMIN_KEY` e grava `products.json` (só no robô; não vai pro ar). Busca também as
   descrições que faltam (até 150 por rodada).
2. `preparar_dados.py` lê o `products.json` e gera:
   - `site/src/data/pecas.json` e `resumo.json` (usados para montar as páginas);
   - `site/public/dados/busca.json` (o índice que a busca do navegador usa).
   Aqui ficam a leitura de **marca, modelo e ano** pelo título e o **nome limpo** da peça.
   Testes: `python testes/test_dados.py`.
3. `site/` é um projeto **Astro**: `npm --prefix site run build` gera `site/dist/`.
4. O workflow `.github/workflows/atualizar.yml` faz 1→2→3, confere os links e publica `site/dist` no GitHub Pages
   e, se existirem os segredos `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, também no Worker `izzatcar-site`
   (`site/wrangler.jsonc`, servido sem redirecionar `.html`; `site/worker/index.js` só trata `/` e 404).
5. `fotos_limpas.py` escolhe a foto da peça (só a peça); cache em `fotos_limpas.json`.
   `capas_estudio.py` faz a **capa de estúdio** em `site/public/estudio/<MLB>.webp` (jeito A: fundo removido,
   balanço de branco guardado, realce global, sombra de contato, e troca de foto quando a peça encosta na borda).
   - **Filtro de etiqueta**: rapidocr (OCR) mede o texto na peça; se a área do texto passa de 0,15 da peça
     e a peça é papel claro, pula para a próxima foto. Sem rapidocr, segue sem o filtro.
     Limite: `ESTUDIO_LIMITE_TEXTO`. Orçamento por rodada: `ESTUDIO_TEMPO_MAX` (s).
   - `marcar()` grava `"e"` no `busca.json` (0 sem capa, 1 automática, 2 maquiada). O workflow roda
     `capas_estudio.py --so-marcar` sempre, mesmo se a geração falhar.
   - **Maquiadas (ChatGPT)**: `site/public/estudio-pro/<MLB>.webp` vai no master, tem prioridade sobre a automática.
     Conferência: `ferramentas/capas_pro.py` (não mexer sem o dono).
   - As automáticas prontas ficam no ramo **`capas-estudio`** (o robô baixa e gera só as peças novas com rembg).
     Para trocar o ramo pelas capas do Mac: `ferramentas/semear_capas.sh` (ensaio por padrão; `--publicar` faz
     force push — só com o dono mandando, e fora da hora da rodada).
   No Mac: `ESTUDIO_MOTOR=vision` usa o recorte nativo (bem mais rápido).
6. Prévia (noindex): `PREVIA=1 npx astro build` → `site/dist-previa` → `wrangler deploy --config wrangler.previa.jsonc`.

7. **Reputação do Mercado Livre**: `atualizar_catalogo.py` (`save_seller_reputation`) lê a rota pública
   `/users/<seller>` **sem token** e grava `reputation.json` na raiz; falha ou resposta sem nível mantém o
   arquivo anterior. `preparar_dados.py` leva `{nivel, n, lider, vendas}` para `resumo.json` (`reputacao`).
   Selo: `site/src/components/SeloReputacao.astro` (variantes `faixa`, `compacto`, `rodape`). Sem o dado, não aparece.
   Sem logo do Mercado Livre e sem percentual.

## Endereços (não mudar — o Google já conhece)
- `/peca/<slug>-<MLB>.html` — o `slugify` é o MESMO de `gerar_paginas_individuais.py`.
- `/catalogo.html?q=&marca=&modelo=&ano=&tipo=&preco=&frete=&ordem=` — mesmos parâmetros de antes.
- Novos: `/carros.html`, `/carros/<marca-modelo>.html`, `/marca/<marca>.html`, `/categoria/<tipo>.html`,
  `/como-comprar.html`, `/garantia.html`, `/envios.html`, `/sobre.html`, `/contato.html`, `/procuro-peca.html`.
- `/veiculos.html` redireciona para `/carros.html`.

## Onde mexer
| Quero mudar… | Arquivo |
|---|---|
| Cores, fontes, botões, etiqueta da peça | `site/src/styles/global.css` |
| Página da peça | `site/src/pages/peca/[slug].astro` e `site/src/components/PecaTopo.astro` |
| Home | `site/src/pages/index.astro` e `site/src/components/v2/*` (abertura, selos, categorias, marcas, carros, banners) |
| Catálogo (busca e filtros) | `site/src/components/catalogo/Catalogo.tsx` e `site/src/lib/busca.ts` |
| Leitura de marca/modelo/nome | `preparar_dados.py` |
| GA4 / Meta Pixel | `site/public/rastreio.js` (só mede no domínio de verdade) |
| Artes (v2: abertura, categorias, carros, selos, banners, passos, topos, história, 404) | `site/public/arte/v2/` — texto desenhado na arte; prompts em `site/SUPER-PLANEJAMENTO-v2.md` |
| Logos das marcas | `site/public/marcas/` (simple-icons e car-logos-dataset; viewBox recortado) |

## Regras da marca (manual da vitrine)
- **Cenário nunca bagunçado**: nada de vídeo/foto real da loja no site; capa de peça sempre de estúdio.
- Laranja `#FF6A00` **sempre com letra grafite `#1d1d1f`** (nunca branca).
- Logo: só os arquivos originais em `site/public/identidade/` (nunca redesenhar).
- Não escrever: frete grátis em arte, número de peças em arte, "tem aqui", preço em arte,
  "mais barato que", "100% garantido", depoimento inventado.
- Ainda **a confirmar** antes de aparecer no site: endereço, horário, 12x, retirada no local, "lacre".

## Rodar no computador
```
python preparar_dados.py
cd site && npm ci && npm run build && npx astro preview --host 0.0.0.0
```
