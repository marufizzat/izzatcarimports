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
   - **Tipo da peça** (`s`, os cartões "Por tipo" da categoria): a árvore do ML vira o nome da loja em `TIPO_LOJA`
     (sinônimos num nome só; grupo do ML que mistura de tudo vira "Outros", sem cartão). Família/tipo errados do ML
     são corrigidos pelo nome da peça em `REGRAS_NOME` (chave de roda, módulo do câmbio, motor de vidro...).
   - **Peça de 2+ carros** (`ms`, e `ys` quando a faixa de anos muda de um carro para outro): "Volvo S60 Xc60" aparece
     na página, no filtro, na contagem e no Meu carro dos dois (`site/src/lib/meuCarro.ts`: `modelosDa`,
     `serveNoModelo`, `anosNoModelo`). A URL da peça não muda.
   - **Descrição**: só as seções sobre a peça; "chat do anúncio" vira WhatsApp; sai o dado repetido e a medida-padrão
     do modelo de anúncio (`DIM_PADRAO_MIN`).
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
   - **Versão 2** (`ESTUDIO_VERSAO=2`; o padrão segue 1 até o dono aprovar). Saída em 1000 px, enquadramento por regra:
     peso visual igual pelo casco convexo, piso comum a 0,79, centro de massa, hastes finas na diagonal.
     Leva o logo original (`ESTUDIO_LOGO=a` selo no canto, recomendado | `b` relevo | `c` assinatura | `0` sem logo).
     Separa sozinha a foto montagem e pula a foto com o carrinho do anúncio colado. As suspeitas vão para
     `_revisar.json`; a folha sai com `ferramentas/folha_revisar.py <pasta>`. Para o Google Shopping, a cópia sem logo
     sai com `ESTUDIO_SAIDA_LIMPA` (o feed não aceita logo sobreposto). Maquiadas na v2: `ferramentas/marca_pro.py`
     (grava noutra pasta e nunca sobrescreve `estudio-pro`). Ao ligar a v2, pôr `ESTUDIO_VERSAO`/`ESTUDIO_LOGO` também no `atualizar.yml`.
   - **Ajustes manuais** (`capas_ajustes.json` na raiz, o robô respeita): por peça, a foto escolhida (`chave` do ML;
     `foto` = índice só para o olho humano), `corte` e `apagar` (frações da foto inteira) — nessa foto não valem os
     filtros automáticos; `sem_capa` = nenhuma foto serve (o robô apaga a capa e o site mostra a foto do ML);
     `ok` = falso alarme conferido (não volta ao `_revisar.json`). Ajuste novo/mudado refaz a capa (assinatura em
     `<saída>/_ajustes_aplicados.json`, que vai junto no ramo). Teste: `python testes/test_capas_ajustes.py`.
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

## Peso e fluidez (o Pages aceita até 1 GB; cada byte da página de peça vale 5 mil vezes)
- Página de peça ≈ 38 KB de HTML (era 87 KB). Antes de pôr algo em todo cartão ou em toda peça, pense nisso.
- Ícones: desenhos em `site/src/lib/icones.ts`; os longos (WhatsApp, escudo, carro…) vêm do sprite `/icones.svg`
  com `<use>` (`Icone.astro`). Nunca colar o `<path>` do WhatsApp direto na página.
- CSS e scripts de componente saem em arquivo com cache (`astro.config.mjs`); `site/integracoes/escopo-curto.mjs`
  encurta o atributo de escopo do Astro no fim do build. Componentes da peça, cabeçalho e rodapé usam `<style is:global>`
  com as classes presas à raiz do componente (`.detalhes …`, `.rodape …`, `.cab …`).
- Sem ilha do Astro na página da peça: a busca do cabeçalho monta o React no 1º contato com o campo e a galeria em tela
  cheia monta quando o navegador folga (`PecaTopo.astro`). "Pedir no WhatsApp" do cartão e os estados do "Serve no seu
  carro" são montados pelo script. "Do mesmo carro" mostra 6 cartões.
- Aparelho fraco (`html.leve`, marcado no `<head>` do `Base.astro`: até 2 núcleos, até 4 GB no Chrome ou economia de
  dados; o Safari informa sempre 4 ou 8 núcleos, então iPhone não entra): sem vidro desfocado, sem 3D no coverflow,
  sem o "respirar" da abertura e sem animação de altura nas perguntas.
- Busca: UMA regra para o catálogo e as sugestões (`lib/busca.ts`): ano solto vira filtro; todas as palavras, depois com
  erro de digitação (nunca em termo com número), depois as parecidas (`aproximado`); o carro digitado vem primeiro.
  O índice de texto (MiniSearch) é montado aos poucos (`Busca.prepararIndice`); sem texto ele nem é preciso.
- Catálogo: a 1ª tela (24 cartões e os filtros) vem pronta no HTML, feita no build com o MESMO `busca.json`; o índice só
  desce depois das fotos dela, ou já se o endereço traz busca/filtro (`html.cat-url`, marcado no `<head>` de
  `catalogo.astro`, que também guarda o lugar das fichas e do "Seu carro"). Lotes de 48 (2 entram sozinhos, depois o
  botão); dentro do lote, 12 cartões e depois 4 por vez quando o navegador folga. O selo "Serve no seu…" fica sobre a
  foto do cartão (aparecer não empurra a grade).

## Rodar no computador
```
python preparar_dados.py
cd site && npm ci && npm run build && npx astro preview --host 0.0.0.0
```
