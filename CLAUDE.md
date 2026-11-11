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
   - **Bloco** (`c`, as categorias da home e `/categoria/<k>.html`): os 25 `BLOCOS` do jeito que o cliente procura
     (Retrovisores, Faróis e Lanternas, Maçanetas e Fechaduras…; nome, chave e ordem iguais aos da arte), nunca a
     família do ML. Sai do tipo `s` (`_TIPOS_DO_BLOCO`); o nome manda quando o ML errou (`BLOCO_PELO_NOME`) ou quando o
     tipo junta 2 blocos (`BLOCO_NO_TIPO`); o tipo "Outros" vai pelas palavras do nome. O que não cai em nada fica em
     "Outros" (fora da grade). Tipo novo do ML sem bloco: o teste avisa.
   - **Peça de 2+ carros** (`ms`, e `ys` quando a faixa de anos muda de um carro para outro): "Volvo S60 Xc60" aparece
     na página, no filtro, na contagem e no Meu carro dos dois (`site/src/lib/meuCarro.ts`: `modelosDa`,
     `serveNoModelo`, `anosNoModelo`). A URL da peça não muda.
   - **Lado e posição** (`l` e `pos` no busca.json, uma letra por peça, '0' sem; `lado_posicao()`): lidos do NOME LIMPO.
     "motorista" = esquerdo e "passageiro" = direito (no Brasil); os dois lados (ou as duas posições) no nome = nenhum;
     a luz do airbag do passageiro fica sem lado; o que vai na tampa traseira é traseiro ("Lanterna tampa traseira
     esquerda" = esquerda e traseira); "dianteira/traseira" = `A` (serve nas duas, entra nas duas fichas); nome sem
     posição usa a do tipo ("Lanternas Traseiras": a busca antiga achava "Lanterna mala" por ele). Nov/2026: 1.709 com
     lado, 1.378 com posição. Teste: `test_lado_e_posicao_pelo_nome`.
   - **Descrição**: só as seções sobre a peça; "chat do anúncio" vira WhatsApp; sai o dado repetido e a medida-padrão
     do modelo de anúncio (`DIM_PADRAO_MIN`); o que está em espanhol sai (`_espanhol`: tudo em espanhol = só a ficha) e
     o "tu/teu" do vendedor vira "você/seu" (`sem_tu`).
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
     Separa sozinha a foto montagem e pula a foto com o carrinho do anúncio colado. **Peça cortada na foto** (encosta
     na borda ou acaba na reta do recorte do vendedor, colada num fundo branco: `cortes_na_foto`): procura outra foto
     do anúncio com a peça inteira (até depois da 6ª); se nenhuma serve, a capa sai menor que a normal, com 10% de
     margem dos lados e o mesmo piso (`REGRA_CORTADA`), e entra no `_revisar.json` como "cortada na capa". A foto
     conferida (`ok`) e a escolhida a mão nunca são trocadas. As suspeitas vão para `_revisar.json`; a folha sai com
     `ferramentas/folha_revisar.py <pasta>`. Para o Google Shopping, a cópia sem logo
     sai com `ESTUDIO_SAIDA_LIMPA` (o feed não aceita logo sobreposto). O feed usa as fotos do anúncio na ordem da
     galeria; a peça que SÓ tem a montagem com o carro vai com a cópia limpa de `site/public/estudio-limpa/<MLB>.webp`
     (no master; `ferramentas/capas_limpas_feed.py` põe/tira, rodar no Mac depois de reclassificar), senão a montagem. Maquiadas na v2: `ferramentas/marca_pro.py`
     (grava noutra pasta e nunca sobrescreve `estudio-pro`). Ao ligar a v2, pôr `ESTUDIO_VERSAO`/`ESTUDIO_LOGO` também no `atualizar.yml`.
   - **Ajustes manuais** (`capas_ajustes.json` na raiz, o robô respeita): por peça, a foto escolhida (`chave` do ML;
     `foto` = índice só para o olho humano), `corte` e `apagar` (frações da foto inteira) — nessa foto não valem os
     filtros automáticos; `sem_capa` = nenhuma foto serve (o robô apaga a capa e o site mostra a foto do ML);
     `ok` = falso alarme conferido (não volta ao `_revisar.json`). Ajuste novo/mudado refaz a capa (assinatura em
     `<saída>/_ajustes_aplicados.json`, que vai junto no ramo). Teste: `python testes/test_capas_ajustes.py`.
   - **Fotos do anúncio na galeria da peça** (depois da capa): o mesmo quadro quadrado da capa, fundo do estúdio
     (`#F4F3F0→#E7E5E1`) e a foto "multiplicando" sobre ele (o branco cru do ML vira o tom do estúdio). A peça fica
     centrada ocupando ~84% quando a foto deixa (`site/src/lib/quadroFoto.ts`, só CSS, a foto do ML não é copiada), com
     4 regras para nenhuma peça parecer cortada: **nunca amplia além do quadrado da própria foto** (o lado curto aparece
     sempre inteiro; o quadro só corta o eixo longo, onde a caixa diz que não há peça); **caixa incerta** ou sem peça
     achada = a foto inteira no meio (respiro de 6%); **respiro mínimo de 4%** entre a peça e a borda do palco (peça
     encostada na borda da foto: a foto vai para o meio, com folga); **foto pequena** (lado maior < 1024 px) inteira, no
     máximo 1,25× no palco retina. Onde o quadro passa da foto, as bordas se desfazem no fundo (classe `i`, também nas
     miniaturas e na faixa da tela cheia).
     A caixa da peça de cada foto fica em `site/src/data/fotos-ml-caixas.json` (commitado): `ferramentas/medir_fotos_ml.py`
     mede só o que falta (Mac: Vision num processo aberto, `ferramentas/caixa_vision.swift`, 8 em paralelo, ~1h15 para as
     45 mil; robô: rembg nas fotos novas, cache `caixas-`, até 4 min por rodada). Foto sem medida aparece inteira, como
     antes. **Caixa incerta** (`"incerta"` no fim da entrada): o teste da faixa de segurança (`faixas()`) procura "coisa"
     (pixel 25+ diferente do fundo, pega plástico branco; as letras de etiqueta viram uma mancha só) em toda a foto além
     da caixa no eixo longo — montagem com o carro colado, plástico branco medido só na parte preta, zoom na etiqueta.
     Também incerta: caixa de borda a borda no lado curto e borda da foto sem cara de fundo de estúdio (close da peça:
     não há fundo para conferir). Foto quadrada nunca (o quadro não corta nada). Medida por lado no cache dos sinais
     (`"f"`, 5 números); sem ela: `medir_fotos_ml.py --faixas` (baixa a `-O` de novo, 8 linhas; `MEDIR_FOTOS_O` = pasta
     com as `-O` já baixadas). Nov/2026: 11.116 de 45.153 incertas (10.168 pelo teste da faixa + 948 montagens com carro).
     Miniaturas pela foto `-A` do ML (228 px, proporção da foto). Tela cheia: fundo escuro, foto inteira.
     **Classe de cada foto** (no mesmo JSON, com a assinatura dHash): `p` peça, `s` sem peça, `m` marketing do anúncio
     (palavras de propaganda no OCR — entrega, garantia, dicas, seminovo…; cartão escuro com texto; ou a mesma foto em
     3+ anúncios), `c` montagem com o carro: só na tela BRANCA pura da montagem do vendedor (borda >= 240; foto de estúdio,
     fundo cinza ~215-235, nunca é carro: lanterna, grade e farol enganavam o classificador). O **detector de objetos**
     (SSD MobileNet, COCO, `detector_carro`, modelo de 29 MB em `~/.rembg/models/detector`, baixa sozinho) acha o carro
     e diz onde: carro (classe 3) com score >= 0,5 numa caixa de até 45% da foto = montagem, mesmo colado na peça, cortado
     na borda ou numa foto panorâmica. A regra antiga das janelas (`prob_carro` > 0,6 na foto inteira ou a média das 3
     melhores janelas no formato de carro > 0,63, com o carro inteiro na janela, `i` > 0,45, ou solto da peça) continua
     valendo para o carro grande, mas só se o detector viu algum carro (a soleira do F-Pace sozinha saiu). A
     "caminhonete" do detector não abre caminho novo (módulo, válvula e trava sozinhos davam 0,6-0,86). Sinais
     `b`/`k`/`i`/`n`/`d` no cache; sem eles: `medir_fotos_ml.py --montagem` (~25 min) e `--detector` (~3 min, só a tela
     branca), depois `--reclassificar`; sem o `d`, só as janelas. Nov/2026 (rodada 9): 1.250 montagens.
     A montagem leva a marca de incerta (aparece inteira, também a foto quadrada). `fotosGaleria()` (lib/quadroFoto.ts) tira `m` e põe `c` no
     fim na galeria, miniaturas, tela cheia, JSON-LD, og:image e feed. Muito texto sozinho não é marketing: é a
     etiqueta da peça (mostra o código). Mudou uma regra: `medir_fotos_ml.py --reclassificar` (sinais em cache local).
     **Foto do código** (`"#"` no fim da entrada, só em foto `p`/`s`, depois da classe): a foto em que o OCR leu o código
     que a página mostra (`codigo_da_peca` = `codigoDaPeca`), inteiro e começando num pedaço do texto (`codigo_no_texto`),
     com 4%+ de texto (`TEXTO_CODIGO`); várias = a de mais texto. `marcar_codigos` roda no fim de toda rodada, só nas fotos
     com o texto no cache. Na página, a caixa do código ganha "Ver o código na foto" (`fotoDoCodigo`, lib/quadroFoto.ts).
     Testes: `python testes/test_medir_fotos_ml.py` e `site/testes/quadroFoto.test.ts`.
6. Prévia (noindex): `PREVIA=1 npx astro build` → `site/dist-previa` → `wrangler deploy --config wrangler.previa.jsonc`.

7. **Reputação do Mercado Livre**: `atualizar_catalogo.py` (`save_seller_reputation`) lê a rota pública
   `/users/<seller>` **sem token** e grava `reputation.json` na raiz; falha ou resposta sem nível mantém o
   arquivo anterior. `preparar_dados.py` leva `{nivel, n, lider, vendas}` para `resumo.json` (`reputacao`).
   Selo: `site/src/components/SeloReputacao.astro` (variantes `faixa`, `compacto`, `rodape`). Sem o dado, não aparece.
   Sem logo do Mercado Livre e sem percentual.

8. **Busca e "a gente procura" (rodada 10, nov/2026)**: código digitado com espaço/traço/ponto ("8200 328 856") é juntado
   (`codigoJunto()`/`separar()` em `lib/busca.ts`) e acha a peça em 1º; o título do resultado nunca diz "Nenhuma peça" com
   resultado na tela. Quando a busca dá 0, só parecidas, ou nenhuma peça serve no carro/ano (`Busca.bate()`), o catálogo
   mostra o bloco "Não achou? A gente procura no pátio" (WhatsApp com o digitado + o carro do filtro/digitado/salvo, no
   formato de `lib/whats.ts`; GA4 `contato_whatsapp` com `botao: 'procurar-patio'`, lido de `data-botao` no `rastreio.js`;
   link `procuro-peca.html?q=&carro=` pré-preenche o formulário). Mesmo código + carro com preços diferentes: o campo `dif`
   (`diferencas()` em `preparar_dados.py`, só o que o TÍTULO do anúncio diz: "T8", "2.0", "G5/G6") vira a pílula
   `.etiqueta-dif` ao lado do carro no cartão (catálogo e `CartaoPeca.astro`). O WhatsApp do cabeçalho/menu leva o carro
   salvo ("Procuro uma peça para Volvo XC60 2019.") via `data-whats-carro`. **Sugestões (nov/2026)**: com o campo vazio,
   as últimas 5 buscas da pessoa (`lib/buscasRecentes.ts`, só no navegador: localStorage `izzatcar.buscas`, sem repetir,
   com "Limpar"; entram no Enter/Buscar, ao escolher uma sugestão e no Buscar do catálogo); a pílula `dif` ("T8") também
   ao lado do carro na linha da sugestão.

9. **10% no WhatsApp em toda peça (decisão do dono, 10/11)**: `DESCONTO_WHATS`, `precoWhats()` e `precoWhatsTxt()` em
   `site/src/lib/whats.ts` (sempre calculado do preço do anúncio; nunca em arte). Na página da peça, UM elemento
   (`.compra-de-por`) com dois desenhos: no celular e no tablet (< 960 px) um selo "−10% de R$ X por R$ Y" preso no
   canto de cima do botão laranja, sem ocupar altura (o botão tem de caber na 1ª tela: revisão 11); no PC, a faixa "No
   WhatsApp de/por" acima do botão e o preço de cada caminho dentro dos dois botões. A barra fixa do celular mostra o
   preço do WhatsApp e o do anúncio riscado. Nos cartões, a linha "Meu carro: …" entra na mensagem no clique
   (`comMeuCarro`, ouvinte único no `Cabecalho.astro`). A mensagem do "Pedir no WhatsApp" (página,
   cartões, barra) é um pedido organizado: `*PEDIDO DE PEÇA*`, nome em negrito, carro · anos, código, anúncio (MLB),
   "Preço no site" + "No WhatsApp (10% de desconto)", "Meu carro: …", "Serve e ainda tem?" e o link por último
   (`cabecaPeca` + `linhaMeuCarro` + `caudaPeca`; o frete pelo CEP usa a mesma ficha: `*COTAÇÃO DE FRETE*`). Só Brasil
   (sem versão em espanhol).

10. **Lista de orçamento (rodada 12, nov/2026)**: o "carrinho" de quem compra pelo WhatsApp. Estado só no navegador em
   `site/src/lib/lista.ts` (`localStorage['izzatcar.lista']`, até 30 peças, evento `lista` com a ação; funções puras
   testadas; dinheiro em centavos: o total no WhatsApp é a SOMA das linhas com 10%, `somaPrecos` em `lib/whats.ts`).
   Página da peça: "Adicionar à lista de orçamento" abaixo dos dois botões da compra (só o botão no HTML; os dados vêm do
   h1, da linha do carro, do código e do `IZZAT_PRODUCT`; `components/peca/listaPeca.ts`); na barra fixa do celular NÃO
   (não cabe sem apertar). Cabeçalho: o ícone com o número só com 1+ peça (script no HTML antes da 1ª pintura marca
   `html[data-lista]`); abaixo de 1100 px ele ocupa o lugar da lupa. `/lista.html` (noindex, fora do sitemap,
   `pages/lista.astro` + `components/lista/paginaLista.ts`): preço do site e no WhatsApp por peça, tirar com "Desfazer",
   subtotal/desconto/total, "Pedir tudo no WhatsApp" (`mensagemLista`, GA4 `contato_whatsapp` com `data-botao="lista"`),
   "Copiar o link da lista" (`/lista.html?i=MLB1,MLB2`: quem abre vê a mesma lista, só para ver e pedir, e "Guardar na
   minha lista" junta sem apagar a dele); preço e disponibilidade conferidos no `/dados/busca.json` (peça fora dele =
   "Já vendida", fora do total; sem rede, ficam os valores guardados com um aviso). GA4 `lista_adicionar` (`rastreio.js`).
   **"Vai junto"** (`components/peca/VaiJunto.astro`, logo depois da compra): até 4 peças do MESMO carro e geração que
   costumam ser trocadas com a vista, pela regra `GRUPOS`/`JUNTO` de `lib/relacionadas.ts` (`vaiJunto`: lado e
   frente/trás pelo nome, nunca o outro lado nem a outra ponta, nunca a mesma peça repetida); sem peça que combine, o
   bloco não aparece. As peças dele saem do "Do mesmo carro". Teste do estoque real em `relacionadas.test.ts`.

11. **A home que conhece o cliente (rodada 13, nov/2026)** — tudo só no navegador, sem ilha React, e nada aparece (nem se
   mexe) para quem não tem histórico: cada bloco decide antes da 1ª pintura num script mínimo (função pura testada,
   copiada por `toString()` e minificada por `lib/scriptCurto.ts`) que marca o `<html>` (`data-continuar`,
   `data-chegou`, `data-vistos`) e põe o esqueleto dos cartões; os cartões (`cartaoHtml`) chegam depois do load.
   - **Vistos** (`lib/vistos.ts`, `localStorage['izzatcar.vistos']`, 12 peças): gravados pela peça
     (`components/peca/vistosPeca.ts`, com o que a página já mostra); "Você viu" na home (2+, `v2/VoceViu.astro`, com
     "Limpar") e "Você também viu" no fim da peça (até 6, nasce quando o navegador folga, só abaixo da tela). A peça que
     vendeu sai pelo `/dados/ativas.json` (id, preço, capa: `pages/dados/ativas.json.ts`, ~34 KB comprimido).
   - **"Chegou para o seu <carro>"** (`v2/ChegouCarro.astro`, `lib/chegouCarro.ts`): as 10 mais novas do carro salvo
     (ano salvo incluído) pela MESMA busca do catálogo sobre `/dados/carro/<k>.json` (agora um por modelo da garagem;
     `chaveCarro` = o slugify do Python); sem peça: "Me avise quando chegar peça para o <carro>" (`data-botao="avise-carro"`).
   - **"Continuar de onde parou"** (`v2/Continuar.astro`, `lib/continuar.ts`): a lista (total no WhatsApp em centavos) ou a
     última busca (`localStorage['izzatcar.busca']`, gravada pelo `catalogo.astro`, 14 dias); × lembrado em
     `izzatcar.continuar`.
   - **Tela cheia da peça (celular)**: a conta do toque em `components/ui/zoomToque.ts` (pinça em volta dos dedos, toque
     duplo 2,5×, limite pela foto desenhada, elástico); o mouse continua como era.

12. **O app instalável (rodada 14, nov/2026)** — o site vira app na tela de início (Android/Chrome e iPhone) SEM nunca
   mostrar preço velho nem peça vendida "à venda". A mudança mais arriscada do site: um service worker errado prende o
   site numa versão velha e é difícil de desfazer. Por isso ele é conservador.
   - **Manifesto** (`public/site.webmanifest`): "Izzat Car Imports"/"Izzat Car", `start_url` `/?app=1` (a home; a canônica
     e o `rastreio.js` não mudam, o GA só vê o `?app=1` no endereço), `display: standalone`, cores claras do site, ícones
     192/512 + `maskable` (`icone-maskable-*.png`: o desenho original a 75% num fundo igual ao dele, dentro do círculo
     seguro de 80%), atalhos Catálogo, Meu carro (`/carros.html`), Lista de orçamento e WhatsApp (`/contato.html`: o
     `wa.me` é de outro domínio e o Chrome descarta atalho fora do site; ícones em `public/app/`). iPhone: o
     `apple-touch-icon`, `apple-mobile-web-app-title` e a barra de status `default` (clara) no `Base.astro`.
   - **Registro**: `components/app/app.ts`, um pedaço à parte que o script do cabeçalho (`Cabecalho.astro`, toda página
     do site) pede só DEPOIS do `load` (um `<script>` no `<head>` do `Base.astro` era mais um pedido disputando a 1ª tela:
     a LCP da home na 1ª visita piorava ~60 ms). O cabeçalho guarda a janela de instalar do Chrome que chega antes
     (`window.__izzatInstalar`). O registro só 5 s depois do load, com o navegador folgando (a instalação caía em cima do
     1º toque da 1ª visita). Página preparada pelo prerender não faz nada até ser aberta. O botão de pânico é conferido
     antes do registro e, na página que JÁ tem o SW (ou com `?sw=0`), logo no load (sem os 5 s). O `/offline.html` não tem
     cabeçalho nem registro (só aparece sem rede).
   - **Service worker** (`public/sw.js`; a versão e o casco entram no build por `integracoes/service-worker.mjs`, a ÚLTIMA
     integração do `astro.config.mjs`):

     | Pedido | Estratégia |
     |---|---|
     | Página (navegação) | **Rede primeiro, sempre** (preload de navegação). Rede falhou ou passou de 3 s: a cópia guardada daquela página com a faixa "Você está sem conexão: mostrando a última versão que você viu" (ou "Sua conexão está lenta…") posta no HTML pelo SW (aparece na 1ª pintura, sem pulo) e `html[data-copia]`. Sem cópia: `/offline.html`; se só está lenta, espera a rede. 404/410 passa direto e apaga a cópia (peça vendida). Guarda só 200 + HTML, nunca redirecionado; chave = o caminho sem `?` (60 páginas). |
     | Prerender/prefetch do Chrome (`Sec-Purpose`) e o fetch do `navegar.js` | Não toca (rede, como sem SW). A página preparada pede a própria cópia depois de aberta (sai do cache HTTP). |
     | `/dados/*.json` (busca, ativas, carro) | **Rede primeiro**, sem prazo. A cópia só vai para a página que já é cópia (com a faixa); página que veio da rede segue como sem SW (mostra os avisos dela). |
     | `/_astro/*` (nome com hash) | Cache primeiro, guardado na hora (250 itens). A cópia de uma página também põe na fila o CSS e os scripts dela. |
     | Capas e artes (`/estudio*/`, `/arte/`, `/marcas/`, `/icones*`, `/identidade/`, fontes) | Só a que JÁ está guardada passa pelo SW (índice na memória): a guardada na hora, e a nova por trás quando ela passa de 1 h (300 itens, no máximo 7 dias). A nova vai direto à rede, com a prioridade do navegador, e é guardada ~1,5 s depois, do cache HTTP (sem baixar de novo). Medido: o SW respondendo toda foto nova da página preparada atrasava o CSS dela (home→carro no PC +350 ms). |
     | Outro domínio (WhatsApp, Mercado Livre, fotos do ML, GA, Pixel), não-GET, `Range` | Nunca (as fotos do ML, GA e Pixel nem acordam o SW: rotas estáticas do Chrome 123+). |

     Casco (baixado na instalação): só o `/offline.html` com o CSS, os scripts (e imports), o logo, o sprite e a fonte
     latina (13 arquivos, ~190 KB). **Versão** = hash do `sw.js` + casco: o robô reconstrói a cada 30 min só com dados e a versão NÃO
     muda (ninguém reinstala nada); muda quando o código do casco muda. Por isso o `offline.html` não pode ter dado do
     estoque. Os caches de páginas/dados/artes têm a versão do formato (`R = 'v1'` no `sw.js`, trocar à mão se o jeito de
     guardar mudar); a ativação apaga todo `izzat-*` que não é o atual. `skipWaiting` + `clients.claim`, nunca recarrega a
     página sozinho (sem laço). O cache HTTP do GitHub Pages (`max-age=600`) continua igual: o SW não acrescenta atraso.
   - **`/offline.html`** (`pages/offline.astro` + `components/app/paginaOffline.ts`, noindex, fora do sitemap): a
     mensagem, "Tentar de novo", o WhatsApp, a lista de orçamento com o total e o "Pedir tudo no WhatsApp" e as peças
     vistas (as guardadas no aparelho com o selo "Abre sem internet"). Voltou a conexão: recarrega sozinha.
   - **Convite para instalar** (`lib/app.ts`, testado em `app.test.ts`; desenho em `components/app/convite.ts`, só desce
     quando vai aparecer): no celular, só na 2ª visita, ou com peça na lista, ou depois de 3 peças abertas; uma vez por
     sessão; o "×" lembra por 30 dias (`localStorage['izzatcar.app']`); nunca no app instalado nem na página com barra
     fixa (peça, lista). Android/Chrome: guarda o `beforeinstallprompt` (a barra do Chrome não aparece sozinha) e o botão
     "Instalar" abre a janela. iPhone (Safari/Chrome/Firefox/Edge, nunca o navegador do Instagram/Facebook): a dica
     "Toque em Compartilhar → Adicionar à Tela de Início". GA4 `app_instalar` (`resultado`: aceito/dispensado, `onde`:
     chrome/faixa/ios), pelo evento `app-instalar` no `rastreio.js`.
   - **No app instalado** (`html.app`): link para fora (WhatsApp, Mercado Livre) abre fora do app; a área segura no
     `global.css` (`@media (display-mode: standalone)`); voltou depois de 30 min ou mais em segundo plano = a página de
     agora (recarrega, só com rede).
   - **Medido em 11/11/2026** (Chromium, 4G lento 150 ms/1,6 Mbps com os cabeçalhos do GitHub Pages, CPU 4×; A/B
     intercalado no MESMO build, "sem" = o proxy dando 404 para o `/sw.js` e o pedaço do app): toque→página pintada (LCP, mediana de 4, sem → com): celular catálogo→peça 916 → 836,
     carro→peça 829 → 838 (rodada de 5: 897 → 794), home→carro 1.262 → 1.320 (rodadas anteriores: 1.278 → 1.287); PC
     794 → 700, 723 → 689, 1.526 → 1.394. Carga da página (1ª visita, LCP): home 940 → 920, catálogo 708 → 636, peça
     868 → 800; CLS igual; volta com o SW controlando: home 148 → 128, catálogo 532 → 572, peça 716 → 780 (o ruído entre
     rodadas é ±80 ms). Prerender continua (Success, o HTML preparado desce 1 vez), transição entre páginas e bfcache
     iguais (3/3 com e sem SW); 1 visita = 1 `page_view` (preparada e não aberta = 0). Sem rede: página vista abre em
     ~40 ms com a faixa, nunca vista → `/offline.html` em ~15 ms; rede lenta (5 s): a cópia "lenta" em 3,1 s (sem SW:
     10,6 s). Cache depois de 30 páginas: 10,7 MB. Página de peça: +129 bytes (só as 2 metas do iPhone).
     Teste: o Playwright não deixa o Chrome fazer prerender nem desligar SW parado; use o CDP cru (`cdp-cru.cjs`) e, para
     http com o domínio de verdade, `--unsafely-treat-insecure-origin-as-secure` no Chrome for Testing (o headless-shell
     ignora).
   - **Como DESLIGAR (botão de pânico)**: escrever `1` em `site/public/sw-desligar.txt` e publicar (push no master; o
     robô publica). Toda página com o SW confere esse arquivo no load (sem cache; a que ainda não tem, antes de registrar)
     e, com "1", desregistra o SW e apaga os caches `izzat-*`; o próprio SW confere na ativação e a cada 6 h (hora
     gravada no cache `izzat-ctl-v1`, lida a cada navegação). Para religar:
     voltar para `0` e publicar. Num aparelho só: abrir qualquer página com `?sw=0` no endereço. **Nunca** apagar o
     `sw.js` nem o registro do `Base.astro` para "desligar": o SW instalado continua no aparelho; o `/sw.js` tem de ficar
     sempre no MESMO endereço (é por ele que o navegador acha a versão nova). Último recurso: um `sw.js` que só se
     desregistra (`self.addEventListener('activate', () => self.registration.unregister())`).

## Endereços (não mudar — o Google já conhece)
- `/peca/<slug>-<MLB>.html` — o `slugify` é o MESMO de `gerar_paginas_individuais.py`.
- `/catalogo.html?q=&marca=&modelo=&ano=&tipo=&preco=&frete=&ordem=` — mesmos parâmetros de antes.
- `/catalogo.html?...&lado=esquerdo|direito&pos=dianteiro|traseiro` (nov/2026): as fichas de lado e posição; endereço sem
  elas continua igual.
- Novos: `/carros.html`, `/carros/<marca-modelo>.html`, `/marca/<marca>.html`, `/categoria/<tipo>.html`,
  `/como-comprar.html`, `/garantia.html`, `/envios.html`, `/sobre.html`, `/contato.html`, `/procuro-peca.html`.
- `/veiculos.html` redireciona para `/carros.html`.
- `/categoria/<família antiga do ML>.html` (pecas-de-interior, carroceria, iluminacao…) redireciona para o bloco mais
  próximo (`FAMILIAS_ANTIGAS` em `preparar_dados.py` → `site/src/pages/categoria/[antiga].html.ts`); o `?tipo=` antigo
  do catálogo vira o bloco novo no `<head>` de `catalogo.astro`.

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
| Artes dos blocos (`cat-<k>.webp` e o topo sem o nome) | `node scripts/instalar-cats.mjs [pasta dos PNG]` na pasta `site/` (PNG de 1536: cartão em 1200, topo em 1254, nunca aumenta; bloco sem arte: o nome num fundo de estúdio) |
| Variantes menores das artes (srcset) | `node scripts/variantes-imagens.mjs` na pasta `site/` depois de pôr/trocar `carro-<k>.webp`, `cat-<k>.webp` ou `topo-cat-<k>.webp`: faz `-600`/`-900` (carro), `-600` (cat) e `-640` (topo) e o hash em `src/data/variantes-arte.json`; commitar junto. Sem rodar, a arte nova sai só no `src` (variante velha nunca aparece). `sizes` de cada lugar: `src/lib/variantes.ts` |
| Logos das marcas | `site/public/marcas/` (simple-icons e car-logos-dataset; viewBox recortado) |

## Regras da marca (manual da vitrine)
- **Cenário nunca bagunçado**: nada de vídeo/foto real da loja no site; capa de peça sempre de estúdio.
- Laranja `#FF6A00` **sempre com letra grafite `#1d1d1f`** (nunca branca).
- Logo: só os arquivos originais em `site/public/identidade/` (nunca redesenhar).
- Não escrever: frete grátis em arte, número de peças em arte, "tem aqui", preço em arte,
  "mais barato que", "100% garantido", depoimento inventado.
- Ainda **a confirmar** antes de aparecer no site: 12x, retirada no local, "lacre". Endereço e horário confirmados
  em 10/11/2026 (os do Perfil da Empresa no Google): ficam só em `site/src/lib/loja.ts` (JSON-LD da loja e Contato).

## SEO (10/11/2026)
- `robots.txt` bloqueia `/catalogo.html?` (as variações com filtro têm a canônica em /catalogo.html); as páginas de
  carro (`TodasAsPecas` quando passa de 48), categoria e o pé do catálogo dão link de verdade para toda peça.
- Sitemap: `lastmod` por peça = `u` (dia da última mudança do anúncio, `last_updated` do ML, em `marcar_datas` no fim
  do `preparar_dados.py`); carro/marca/categoria = o dia mais novo das suas peças. Nunca a data da rodada em tudo.
- Página da peça: o h1 é nome + carro + anos (visual de 2 linhas igual); JSON-LD Product sem `mpn` inventado (só o
  código real) e sem marca "Original"; `seller` = a loja (`@id` /#loja). `og:type` product.
- `noindex` vira "noindex, follow" (`Base.astro`); páginas de redirecionamento só com canônica + refresh.

## Peso e fluidez (o Pages aceita até 1 GB; cada byte da página de peça vale 5 mil vezes)
- Página de peça ≈ 38 KB de HTML (era 87 KB). Antes de pôr algo em todo cartão ou em toda peça, pense nisso.
- Arte grande em cartão pequeno sempre com `srcset`/`sizes` (`srcArte` de `src/lib/variantes.ts`): o /carros caiu de
  5,9 MB para ~2 MB rolando no iPhone só com as variantes de 600 px.
- **Capas leves dos cartões** (nov/2026): a capa de estúdio tem 1000 px (~41 KB) e o cartão mostra 125–300 px. O build
  faz `public/estudio-400/<MLB>.webp` (~8 KB) e `public/estudio-640/<MLB>.webp` (~17 KB) da capa que o site usa (a
  maquiada manda) — `site/scripts/capas-cartao.mjs`, chamado pela integração `integracoes/capas-cartao.mjs` no começo de
  TODO build (`npm run build`, `npx astro build`, prévia). Refaz só a capa nova ou trocada (hash em
  `src/data/capas-cartao.json`); a leve de capa trocada ou de peça sem capa sai antes de tudo. Pastas e manifesto fora do
  git: o robô guarda no cache do Actions (`capas-cartao-<hash do manifesto>`; rodada sem mudança não grava). Sem cache:
  ~2 min para as 5,3 mil no Mac. O busca.json ganha a coluna `r` ('1' = leve em dia) para os cartões do navegador.
  UMA regra para src/srcset: `fotoCartao()` (lib/busca.ts) nos 3 que montam cartão (`CartaoPeca.astro`, `Etiqueta` do
  catálogo, `cartaoHtml`); o `sizes` de cada lugar em `SIZES_CARTAO`. 640 e não 600: o cartão de 208 px num celular 3x
  pede 624 px. Leve que falha: o cartão cai na capa inteira (nunca imagem quebrada). A página da peça usa a de 1000.
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
  **Jeito de falar do cliente** (nov/2026): `lib/sinonimos.ts`, UMA tabela no navegador (~2 KB no JS com cache; no
  busca.json custaria em toda peça): "sinaleira" = lanterna, "máquina de vidro" = motor/máquina vidro, "pisca" = seta,
  "farolete" = farol de milha, "frente" = grade/farol/capô/para-choque dianteiro, "central"/"ECU" = módulo, "TBI" = corpo
  de borboleta, "caneta" = bobina, "mola a gás" = amortecedor da tampa/capô, "tapete" = carpete, "estepe"/"roda"... Só
  ACRESCENTA alternativas (a palavra digitada continua valendo e pesa mais: sinônimo × 0,25, nome que diz o digitado
  × 1,5), a frase mais longa primeiro, sem as palavras vazias
  ("de", "da"...); o plural vale sozinho ("faróis" = farol, só a palavra inteira). Cada linha aponta para um nome que
  EXISTE no estoque (`sinonimos.test.ts` confere); tipo novo no estoque = conferir a tabela. O "começa pela palavra" e o
  `bate()` (bloco "Não achou?") usam as mesmas formas.
  **Lado e posição digitados viram filtro** ("retrovisor direito xc60": os DIREITOS do XC60, pela coluna `l`;
  "motorista" = esquerdo; "dianteira", "traseira", "frontal", "esq", "dir", "tras"): saem do texto (`separarLadoPos`),
  filtram e marcam a ficha; a peça cujo nome diz a mesma palavra sobe ("amortecedor traseiro" antes da "tampa
  traseira"). Se o filtro não deixar nada, a busca volta ao texto de antes (nunca pior). As fichas "Lado e posição" do
  catálogo (`Catalogo.tsx`, depois do Ano, só com peça na lista) contam sem o próprio filtro; tocar numa tira a palavra
  da busca (`Busca.semLadoPos`).
- Fichas de ano (página do carro e seletor "Seu carro", `lib/anosFila.ts`): sem ano escolhido, a fila já abre na janela
  de anos com mais peças (na página do carro, num `<script is:inline>` antes da 1ª pintura); o "Todos" fica fixo à
  esquerda (`.ac-fixo`/`.mc-fixo`, sticky). Só o scrollLeft da fila, nunca a página.
- Página do carro com mais de 48 peças: a grade do ano sai de `/dados/carro/<k>.json` (um por modelo da garagem; só as peças do carro, feito no
  build do mesmo busca.json; XC60 140 KB em vez de 1,4 MB) e entra em partes (12 cartões, o resto, a lista completa em
  fatias de 6 ms); os grupos da lista "Todas as N peças" têm `content-visibility: auto`.
- **Troca de página sem tela branca** (nov/2026): transição entre documentos (`@view-transition` no fim do
  `global.css`; Chrome/Edge 126+ e Safari 18.2+, quem não tem navega como antes), até 250 ms, nenhuma com
  `prefers-reduced-motion` e o `html.leve` pula no `pageswap`. O cabeçalho fica parado (grupo `cab`, fundo cheio só
  durante a troca) e a foto do cartão tocado vira a capa da peça: `public/navegar.js` (no `<head>` do `Base.astro`, com
  defer) põe `view-transition-name: foto-peca` SÓ no `.etiqueta-foto` do clique (na página da peça, a capa do palco solta o
  nome: dois iguais cancelam a transição) e o CSS dá o mesmo nome ao `.galeria-palco` só durante a troca
  (`:active-view-transition`). Nada de `unload`/`no-store`: o voltar (bfcache) continua instantâneo.
  Teste no Playwright: o Chromium dele desliga `PaintHolding` e `RenderDocument` (a página nova nem pinta com a
  transição); religar os dois (`ferramentas/navegacao/chromium-real.cjs`). O WebKit confere a transição inteira.
- **A próxima página já carregada** (nov/2026): `<script type="speculationrules">` no `<head>` do `Base.astro` (o MESMO
  bloco de ~170 bytes em toda página): `prerender` com `eagerness: "moderate"` (no celular, no toque; no PC, com o mouse
  parado 200 ms) só para `/peca/*`, `/carros/*`, `/carros.html`, `/categoria/*`, `/marca/*` e `/catalogo.html` (com ou sem
  filtro); WhatsApp, Mercado Livre e o resto ficam de fora por não estarem na lista. Quem não faz prerender (Safari,
  Firefox; `'prerendering' in document` só existe no Chrome/Edge) baixa o HTML no `pointerdown`/`touchstart`
  (`public/navegar.js`, 2 por vez, nunca com economia de dados nem em `html.leve`). **Métrica**: `rastreio.js` não mede
  nada enquanto `document.prerendering` (espera o `prerenderingchange`; a busca que o catálogo mandar antes fica na
  fila): 1 visita = 1 `page_view`/`PageView`, página preparada e não aberta = 0; `contato_whatsapp` igual.
  Teste do prerender: o Playwright faz o Chrome recusar ("PrerenderingDisabledByDevTools"); usar o CDP cru preso na aba
  (`ferramentas/navegacao/cdp-cru.cjs`; `metrica2.cjs` confere a métrica, `vt-cru.cjs` a transição, `nav-cru.cjs` mede).
- **Medido em 10/11/2026** (Chromium, 4G lento 150 ms/1,6 Mbps pelo `proxy-lento.cjs`, CPU 4×, do toque até a página
  nova pintada, mediana de 3; "antes" = mesmo navegador sem transição nem prerender): catálogo→peça 713 → 633 ms no
  celular e 616 → 414 no PC; carro→peça 653 → 515 e 530 → 417; home→carro 1.109 → 1.119 e 1.031 → 880. No celular o
  prerender só começa no toque (~120 ms antes do clique): ganho menor que no PC (mouse parado 200 ms). O único quadro
  longo da troca é a 1ª pintura da página nova (estilo + layout, 70–110 ms com CPU 4×, igual antes: 79–95); a animação
  não tem script. LCP, CLS, TBT e INP das páginas iguais (±12 ms); bfcache em todas; peça +229 bytes (+95 com gzip).
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
