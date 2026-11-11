# Site da Izzat Car Imports — como funciona (versão nova, nov/2026)

O site **izzatcarimports.com.br** é gerado a partir dos anúncios ativos do Mercado Livre
e publicado sozinho no GitHub Pages a cada 30 minutos.

## O caminho dos dados
1. `atualizar_catalogo.py` puxa os anúncios ativos pelo backend (Cloudflare) com o segredo
   `ADMIN_KEY` e grava `products.json` (só no robô; não vai pro ar). Busca também as
   descrições que faltam (até 150 por rodada).
2. `preparar_dados.py` lê o `products.json` e gera:
   - `site/src/data/pecas.json` e `resumo.json` (usados para montar as páginas);
   - `site/src/data/unidos.json` (carros unidos: "marca|apelido" -> principal; vai no JS do navegador, item 13);
   - `site/public/dados/busca.json` (o índice que a busca do navegador usa).
   Aqui ficam a leitura de **marca, modelo e ano** pelo título e o **nome limpo** da peça.
   - **Tipo da peça** (`s`, os cartões "Por tipo" da categoria): a árvore do ML vira o nome da loja em `TIPO_LOJA`
     (sinônimos num nome só; grupo do ML que mistura de tudo vira "Outros", sem cartão). Família/tipo errados do ML
     são corrigidos pelo nome da peça em `REGRAS_NOME` (chave de roda, módulo do câmbio, motor de vidro, o "Comando
     rebatimento tampa" que o ML pôs em Comando de válvulas...). O nome limpo nunca termina em preposição ou "e" soltos
     ("Coletor admissão de" -> "Coletor admissão": `FIM_SOLTO`; `test_nome_nunca_termina_em_preposicao` confere o estoque).
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
   - **Tom azul da luz** (nov/2026): a luz do vendedor deixa a peça preta azul-marinho nos escuros. `corrigir_azul()` tira só
     o croma do lado do azul da luz (luminância e textura intactas, nunca passa do neutro: cromado não amarela; poupa
     vermelho/laranja/amarelo/verde, os claros e o azul saturado ou bem acima do típico: fio, conector, ícone), só nos pixels
     da peça. `decidir_cor()`: ajuste `cor` (`"neutra"`|`"manter"`) > azul escrito no título/nome/ficha, lataria pintada ou
     azul forte nos claros da foto (fica) > outras fotos do anúncio (classe `p`, `-O` na caixa, 1º quartil do B−R escuro
     ≤ 30: neutra) > só o excesso + "cor a conferir" no `_revisar.json` (o "preto" do título só vai anotado); registro em
     `<saída>/_cor.json`. A ficha "Cor: Preto" é o padrão do vendedor (não conta). `ESTUDIO_COR=0` desliga, `ESTUDIO_COR_PROVA`
     prova; maquiadas pelo `marca_pro.py`. Teste: `python testes/test_capas_cor.py`.
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
   ao lado do carro na linha da sugestão. No celular o cabeçalho não tem campo: as MESMAS recentes aparecem no foco do
   campo do catálogo vazio (`CampoBusca` em `Catalogo.tsx`, o desenho de `ui/sugestoes.css`, na largura da banda;
   combobox com setas/Enter/Esc; tocar numa busca por ela sem sair da página).

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
   **O preço grande é o do WhatsApp (pedido do dono, 11/11)**: em TODO cartão (`CartaoPeca.astro`, `Etiqueta` do catálogo,
   `cartaoHtml`, "Vai junto") o preço do anúncio vem riscado em cima, o do WhatsApp é o grande e o selo verde "−10% no
   WhatsApp" fica colado nele (`precoCartao`/`SELO_WHATS` em `catalogo/etiqueta.ts`; o leitor de tela lê "de R$ X por R$ Y
   no WhatsApp", e é desse texto que os scripts tiram o preço CHEIO: `precoCheioDoTexto`; a lista e a mensagem do WhatsApp
   continuam partindo do cheio). Depois do fio: "90 dias de garantia" e, só com 1 em estoque no anúncio, "Peça única"
   (coluna `q` do busca.json, '1'/'0' por peça; cartão sem o dado não diz nada). Na página da peça o preço grande também
   é o do WhatsApp; o selo "−10% no WhatsApp" + o preço do anúncio riscado ficam presos no canto do botão laranja (celular)
   ou numa linha com "no Mercado Livre" (PC), e o botão do Mercado Livre leva o preço cheio em toda largura. NÃO mudam: o
   JSON-LD `Product` (preço cheio, o do Mercado Livre), og/meta, o feed, e o filtro e a ordem por preço do catálogo (pelo
   preço cheio). As sugestões da busca seguem com o preço do anúncio.

10. **Lista de orçamento (rodada 12, nov/2026)**: o "carrinho" de quem compra pelo WhatsApp. Estado só no navegador em
   `site/src/lib/lista.ts` (`localStorage['izzatcar.lista']`, até 30 peças, evento `lista` com a ação; funções puras
   testadas; dinheiro em centavos: o total no WhatsApp é a SOMA das linhas com 10%, `somaPrecos` em `lib/whats.ts`).
   Página da peça: "Adicionar à lista de orçamento" abaixo dos dois botões da compra (só o botão no HTML; os dados vêm do
   h1, da linha do carro, do código e do `IZZAT_PRODUCT`; `components/peca/listaPeca.ts`); na barra fixa do celular NÃO
   (não cabe sem apertar). O botão só PÕE (sem `aria-pressed`); com a peça na lista, o verde é um LINK para a lista ("Na
   sua lista · Ver lista (n)"; a 320 px "Na lista · …") e o "Tirar" pequeno e escrito ao lado; o foco segue o toque e o
   aviso sai no `role=status` (revisão 12: tocar no verde tirava a peça sem avisar). Cabeçalho: o ícone com o número só
   com 1+ peça (script no HTML antes da 1ª pintura marca `html[data-lista]`); só abaixo de 360 px ele ocupa o lugar da
   lupa (de 360 a 1099 a lupa continua ao lado; medido em 13 larguras). `/lista.html` (noindex, fora do sitemap,
   `pages/lista.astro` + `components/lista/paginaLista.ts`): preço do site e no WhatsApp por peça, tirar com "Desfazer",
   subtotal/desconto/total, "Pedir tudo no WhatsApp" (`mensagemLista`, GA4 `contato_whatsapp` com `data-botao="lista"`),
   "Copiar o link da lista" (`/lista.html?i=MLB1,MLB2`: quem abre vê a mesma lista, só para ver e pedir, e "Guardar na
   minha lista" junta sem apagar a dele); preço e disponibilidade conferidos no `/dados/ativas.json` (o leve: id, preço,
   capa; peça fora dele = "Já vendida", fora do total; sem rede, ou o arquivo vazio, ficam os valores guardados com um
   aviso: nunca "tudo vendido"). Voltar/avançar (bfcache): o `pageshow` com `persisted` dispara o mesmo aviso de "mudou noutra
   aba" (`ouvirOutrasAbas`, `lib/lista.ts`): os cartões e o número do cabeçalho acompanham a lista. O índice inteiro (`busca.json`, e a busca com o MiniSearch, sob demanda) só na lista de
   um link (precisa de nome, carro, anos e código), quando falta um dado que o leve não tem (nome, endereço, a foto do ML
   de peça sem capa de estúdio) ou UMA vez na lista de antes da rodada 13 (`izzatcar.lista.conferida`, marcada ao começar
   uma lista nova: o nome e o carro guardados já são os de agora). A capa só é pedida depois de saber se a peça existe (a
   da vendida dava 404). O esqueleto é a linha de verdade (as mesmas classes e alturas de linha, barras no lugar do texto;
   no celular o preço do site sempre na 2ª linha): nada pula quando as peças chegam. Link sem rede: o esqueleto parado e
   "Não deu para abrir as peças desta lista agora. Tentar de novo" (nunca "R$ 0,00" nem "Anúncio MLB…" como nome; sem preço
   conferido, a linha fica sem o bloco do preço; "Guardar" só depois que as peças abriram). GA4 `lista_adicionar`
   (`rastreio.js`).
   **"Vai junto"** (`components/peca/VaiJunto.astro`, logo depois da compra; regra refeita na rodada 15): 1 a 3 peças do
   MESMO carro e geração que entram NO MESMO SERVIÇO que a vista. Em `lib/relacionadas.ts`, cada peça tem um PAPEL
   (`PAPEIS`: o tipo `s` + o que o nome diz: "Suporte farol", "Mangueira radiador", "Moldura botão vidro") e cada papel
   lista os papéis que a oficina troca ou precisa junto, do mais ligado ao menos (farol -> suporte, friso, guia do
   para-choque, para-choque, grade; bomba d'água -> termostática, mangueira da bomba, tensor; máquina de vidro -> botão e
   forro da MESMA porta; lanterna -> a lanterna da tampa do mesmo lado, soquete, guia do para-choque traseiro...). Papel
   sem companheiro de serviço (botão do pisca-alerta, sensor solto, capa do motor, console) não tem bloco. `casa()`: lado e
   posição iguais quando as duas dizem; só uma diz = vale se a outra for peça "de uma só" (`lat`/`fz`); na porta (`porta`)
   a porta tem de ser a mesma ("motorista" = dianteira esquerda). Nunca a mesma peça de novo: mesmo código, mesmo nome, o
   mesmo nome noutro canto (`esqueleto`) ou com palavras a mais (`contida`). Sem companheira certa, o bloco não aparece
   (nov/2026: 1.543 de 5.311 páginas; a tabela de antes, por grupos largos, dava 4.173 com sugestão sem sentido). Tipo
   novo no estoque: conferir se cabe num papel. Amostra para conferir uma a uma: `npx vite-node scripts/amostra-vai-junto.ts`
   (na pasta `site/`, semente fixa, espalhada pelos blocos). As peças dele saem do "Do mesmo carro" e do "Mais peças
   <marca>": sem outra
   peça do carro, o "Do mesmo carro" não aparece (nunca volta à lista inteira e repete). Cartão: o texto num `<span>`
   (nome, anos, e o "Cód." numa linha só dele, inteiro, quebra sem reticências), o preço e o "+ Lista" ESCRITO (nome
   acessível "Adicionar à Lista de orçamento: <peça>"); já na lista, o verde "Na lista" leva à lista. O `<li data-carro>`
   leva o carro DA PEÇA (`nomeModelos`): o "+ Lista" grava esse, não o da página. O desenho segue a largura do cartão
   (container query): estreito (< 420 px), o preço e o "+ Lista" numa linha de pé; largo, tudo numa fila só. No PC
   (1200+): com 4, o título em cima e as 4 numa fila; com 1 a 3, o título à esquerda e os cartões dividindo o resto; em 2
   colunas, o último sozinho ocupa a linha. Teste do estoque real em `relacionadas.test.ts`.

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

12. **Raio-x do carro (rodada 14, nov/2026)** — quem não sabe o nome da peça aponta onde ela fica. `v2/RaioX.astro` na home
   (depois das categorias) e na página do carro (no lugar de "Peças por categoria"; abaixo de 1024 px vem recolhido num
   cartão com a miniatura: a arte inteira na 1ª tela virava o LCP). Arte `public/arte/v2/raio-x.webp` (ChatGPT, vista
   fantasma, aprovada pelo dono; variantes 320/900 pelo `variantes-imagens.mjs`). As 9 zonas em `lib/raioX.ts` (`ZONAS`:
   área de toque que reparte a arte inteira, contorno que acende, ponto, etiqueta e os GRUPOS do estoque: bloco `c`,
   tipos `s`, lado/posição); cada linha do painel é um link EXATO do catálogo (tipo + sub + lado/pos + carro) e o número
   é o do catálogo (`contarZonas` usa `Busca.procurar`; teste `raioX.test.ts` com o estoque real). O catálogo entende UM
   tipo e UM sub: a zona inteira não cabe num endereço, então o botão "Ver as peças da frente" mostra as 12 mais novas
   no próprio painel (com carro: `/dados/carro/<k>.json`; sem carro: `/dados/raio-x.json`, `pages/dados/raio-x.json.ts`).
   Com carro salvo, as contas do carro saem no 1º toque (uma zona por vez, sem tarefa longa); zona sem peça = cinza com
   "Me avise quando chegar" (`linkAvisoParte` em `lib/aviso.ts`). Véu laranja e véu escuro = duas camadas SVG com
   `filter: blur` do CSS (o filtro do SVG custava 60–110 ms por toque com CPU 6×). Tipo novo no estoque: conferir a zona
   dele em `ZONAS` (o teste avisa nome de bloco/tipo que sumiu).

13. **Correções da revisão 14 (11/11/2026)** — o que ficou valendo:
   - **Carros unidos** (C180/C200/C320 = Classe C, 320i/330i = Série 3, 530i = Série 5, GLA200 = GLA, New Fiesta = Fiesta,
     New Civic = Civic): o `preparar_dados.py` grava `site/src/data/unidos.json` (`"marca|apelido" -> principal`, TODOS os
     pares, também o apelido com menos de 8 peças). `lib/meuCarro.ts` lê o arquivo (`UNIDOS`, `import.meta.glob`) e:
     (1) o **Meu carro salvo com o apelido vira o principal na leitura** (`carroDe`/`lerMeuCarro`, mesmo ano, regrava o
     localStorage uma vez; antes da pintura na home, no catálogo e na página do carro: `components/MigrarCarro.astro` no
     `<head>`, que também troca o `?modelo=<apelido>` do catálogo); (2) **a tela e o WhatsApp mostram o carro uma vez, pelo
     principal** (`gruposModelos`, `nomeModelos`: "Mercedes-Benz Classe C", nunca "Classe C, C180 e C200"); (3) **o que o
     Google lê guarda as versões** (`nomeModelosVersoes`: "Classe C (C180, C200)" no `<title>`, description, JSON-LD, feed e
     no "Serve em" da ficha técnica; quando não cabe, a forma do anúncio "Mercedes-Benz C320", `nomeSoVersoes`). A arte do
     carro principal sem arte própria é a do apelido (`arteDoCarro` em `lib/dados.ts`: Série 3 usa a do 320i).
   - **Botão da lista no cartão** (`.etiqueta-lista`, `styles/global.css`): canto de cima à ESQUERDA da foto (o da direita é
     do logo da capa); redondo 44×44 só com o ícone abaixo de 700 px, pílula "Lista" acima; um "+" só (o do desenho); área
     de toque 8 px maior (`::after`). O selo "Chegou agora" fica no PÉ da foto e sai quando aparece o "Serve no seu…".
     Lista cheia (30): aviso à vista (`components/ui/avisoLista.ts`), não só para leitor de tela.
   - **Página da peça, "Antes de comprar"**: a pergunta é "E se a peça der problema?" (só a garantia de 90 dias e como
     acionar). Nunca "E se não servir?": o dono confirmou garantia e NENHUMA troca; encaixe é assunto de antes da compra.
   - **Raio-x sem carro salvo**: o painel abre com o estoque inteiro e o "Ver todas no catálogo" é `linkZona(k, filtro)`
     (`lib/raioX.ts`: `/catalogo.html?zona=<k>` sem carro; sempre o MESMO filtro das contagens). O Tab só acende a parte;
     Enter/Espaço abre; o painel que troca sem foco é dito no `role=status`.
   - **WhatsApp**: `data-botao` em todo link (valores novos: `pedir-peca`, `pedir-barra`, `pedir-cartao`, `serve-no-carro`,
     `foto-codigo`, `rodape`, `banner-*`, `chamada-*`, `vendida-avise`, `404-*`, `carro-avise`, `procuro-*`, `meu-carro-*`…;
     os antigos não mudam). O evento `contato_whatsapp` sai com ou sem `data-botao` (o `rastreio.js` conta todo link `wa.me`).
     Mensagem de dúvida com a lacuna "Meu carro é ____": o carro salvo entra no clique (`comCarroNaFrase`, ouvinte do
     `Cabecalho.astro`). Pátio com peça na tela: `pedidoPatioAchou` (`lib/patio.ts`), nunca "Não achei no site".
   - **404 de endereço de peça** (`conferirAntes` em `lib/vendida.ts`, inline no `<head>`): só o `<main>` fica escondido, o
     arquivo do estoque é pedido no `<head>` e a peça à venda abre sem esperar o script da página; 400 ms: "Abrindo a
     peça…"; 2,5 s: "Conferindo a peça…" com saídas (nunca "Página não encontrada" antes de saber, e daí em diante nada
     navega sozinho: botão "Abrir a peça"). "mlb" minúsculo e barra no fim valem (`caminhoLimpo`). Anúncio do
     `excluir_do_site.json`: abre o gêmeo à venda; sem gêmeo, "Essa peça saiu do site" (nunca "já foi vendida").
   - **Tela cheia da foto**: o "Voltar" do aparelho fecha a foto (estado no histórico, `GaleriaTelaCheia.ts`).

14. **Página do carro por família (rodada 15, nov/2026; cliente oculto 2, atrito 8)** — `pages/carros/[k].astro` +
   `lib/carroPagina.ts` + `components/AnosDoCarro.astro`. As **fichas de ano** ficam DENTRO da caixa do carro (na 1ª tela
   do celular de 360×640); o ano do carro salvo deste modelo já vem aceso e à vista antes da 1ª pintura (script inline,
   `rolarFila`); tocar num ano filtra a página e **salva o "Meu carro"** ("Salvo como seu carro · Desfazer"; se havia
   outro carro, "Salvo no lugar do Onix 2015"; o Desfazer devolve o carro e o ano de antes); "Todos" não mexe no carro
   salvo. No PC as fichas têm largura fixa (a quebra de linha não muda quando a letra chega: era o CLS 0,11 das páginas
   pequenas, revisão 14) e, no carro sem arte, a coluna do disco da marca tem a largura dele desde o começo (a regra mora em
   `TopoArte.astro`: uma regra na página do carro perde para a do componente, por causa do atributo de escopo do Astro; com
   `auto` as fichas mudavam de linha quando o disco chegava no HTML, CLS 0,02 a 0,05 em toda carga lenta). As **peças** saem agrupadas pelos blocos (`agrupar`: mais peças primeiro, "Outros" no fim), com
   a barra de fichas presa sob o cabeçalho (`.gp-barra`, só as famílias com peça no ano, pela contagem; pula para o grupo
   com `scroll-margin-top`; a ficha ativa acompanha a rolagem) e, em cada grupo, 8 cartões no HTML (o CSS mostra 4 no
   celular, 6 no tablet, 8 no PC) + "Ver as N de <família>" (catálogo com `marca`, `modelo`, `tipo` e `ano`). Carro com
   mais de 48 peças: só os primeiros grupos levam os cartões no HTML (`cartoesNoHtml`, 40 cartões; antes eram 48 soltos) e
   os outros chegam de `/dados/carro/<k>.json` quando o navegador folga, com o lugar guardado (`data-espera`); a vista do
   ano é montada do mesmo arquivo, um grupo por tarefa. TODA peça segue com link de verdade na lista "Todas as N peças".
   Carro com menos de 20 peças (ou de uma família só): a grade simples. **Selo do carro unido** (revisão 14, B7): a peça
   de UMA versão (`data-v1`/`it.v1`, `versaoUnica` em `catalogo/etiqueta.ts`: "C180" dentro do Classe C, "New Fiesta"
   dentro do Fiesta) não ganha "Serve no seu…": ganha "Confira a versão".

15. **Raio-x, 2º nível (rodadas 15 e 16, nov/2026)** — três coisas em cima do Raio-x; o código e o estilo de cada uma só descem
   quando a pessoa usa (`import()` + CSS `?inline`: nada no CSS que trava a 1ª pintura, +0,4 KB no HTML da home).
   - **"Bati o carro"** (o seletor de dois modos acima da arte; `v2/raioXBatida.ts` + `.css`): a arte troca as 9 zonas
     pelos **8 pontos da batida** (`lib/batida.ts`: `PONTOS`, medidos na arte; o lado de lá fica na borda visível, com a
     etiqueta dizendo o lado) e o painel vira a **lista do conserto**: as linhas na ordem da oficina, com a peça mais
     barata de cada uma **que É a peça do título da linha** (revisão 15, P1-2: o tipo do estoque junta a peça e os
     acessórios dela, e "a mais barata" punha o suporte na linha da maçaneta, o forro do porta-malas na do forro da
     porta e a polaina na do para-choque, já marcados e somados: 98 de 708 linhas nos carros com 20+ peças. Cada linha
     diz qual nome é a peça dela, `eh` = a 1ª palavra do nome, como o "tipo" da busca; `itensDaLinha` ordena primeiro as
     que são a peça, depois as outras do tipo, a mais barata na frente em cada grupo; a linha principal que só tem peça
     LIGADA vira o título no pátio + a ligada em "Também costuma ir junto" com "(peça ligada)" no nome, sem marcar:
     `linhasDoPainel`, `marcadasDeInicio`; o teste confere em TODO carro e ponto, nos dois estoques. Linha nova = dizer
     o `eh` dela) (capa, nome, preço do site riscado e o do WhatsApp por `precoWhats`), caixa de marcar de verdade,
     "Outra opção" (passa pelas outras peças da mesma linha; nunca a palavra "trocar") e o total ao vivo (`somaPrecos`, em centavos). Regras do kit:
     peça que vem em par é pedida com o LADO do ponto; a que não tem lado entra sem ele e a guarda do ponto tira só a que
     DIZ o lado/posição oposta (o estoque quase nunca escreve "dianteiro" em grade, alma e guia); linha **principal** sem
     peça fica como "a gente procura no pátio" (ficha de marcar: vai no pedido como item para procurar); linha **extra**
     (dobradiça, emblema, defletor…) só aparece com peça, no grupo "Também costuma ir junto", e nunca vem marcada (o total
     não infla sozinho). **Com carro** (o salvo na home; na página do carro, o da página, no ano do salvo se for o mesmo):
     a conta sai do `/dados/carro/<k>.json` e as principais já vêm marcadas. **Sem carro**: o estoque inteiro pelo
     `/dados/batida.json` (curto: cada peça uma vez), NADA marcado (são peças de carros diferentes), 6 linhas à vista e o
     convite "Dizer o meu carro". Pé preso ao pé da tela: "Pedir o conserto no WhatsApp" (`mensagemConserto`,
     `data-botao="raiox-conserto"` → `contato_whatsapp`; a ordem da mensagem é a da tela) e "Guardar na lista"
     (`adicionarNaLista`). Nunca dizer que o kit está completo: "Peça usada: quando vende, acabou. A gente confere na peça
     antes de você comprar." O desmanche vende muito mais peça pequena que lataria (8 faróis e 5 para-choques no estoque
     inteiro): frente com poucas linhas é o estoque de verdade. Tipo novo no estoque: conferir as linhas (o teste avisa
     tipo que sumiu). Testes: `lib/batida.test.ts` (estoque real, lado/posição, sem peça em dobro) e `lib/conserto.test.ts`.
   - **"Onde fica"** (`components/peca/OndeFica.astro`, depois dos detalhes da peça): mini Raio-x com a zona DESTA peça
     acesa, "Fica na frente do carro" (`Zona.fica`) e o link "Ver as outras peças da frente do XC60" →
     `/carros/<k>.html#raio-x=<zona>` (carro sem Raio-x na página: `/#raio-x=<zona>`). A zona é a do painel
     (`zonasDaPeca` em `lib/raioX.ts`, a mesma regra da busca; `zonaDaPecaId` em `lib/raioXDados.ts`); peça sem zona ou
     em duas zonas (pos `A`) não mostra o bloco. HTML parado; estilo no arquivo com cache.
   - **As vistas "por dentro"** (rodada 16: todas as zonas; a Frente foi o piloto da 15): o botão "Ver o motor por
     dentro" do painel de cada zona troca a arte do carro pela vista explodida daquela parte no MESMO palco, com View
     Transition onde existe (o zoom sai do ponto da zona). `lib/raioXVistas.ts` (`VISTAS`, pela chave da zona: a arte,
     o título, o botão, a linha de apoio) é o ÚNICO pedaço que o script do Raio-x importa; o código
     (`v2/raioXPorDentro.ts` + `.css`), a arte (`public/arte/v2/raio-x-<vista>.webp`, variantes 320/900 pelo
     `variantes-imagens.mjs`) e a tabela das peças de CADA vista (`lib/raioXFrente.ts` e `lib/porDentro/<vista>.ts`,
     um pedaço por vista: `TABELAS`) só descem no clique. As duas laterais usam a MESMA arte e a mesma tabela
     (`pontosLateral(lado)`: o lado vai nos links; o desenho é o do lado esquerdo, e a nota do painel diz).
     Cada peça é um link com a FORMA dela (`PontoQuente`, `lib/porDentro/base.ts`: contornos tirados da arte), com o
     nome e quantas há; o número é o do catálogo com os filtros do link (`contarPontos`; sem carro:
     `/dados/raio-x-dentro.json`, um arquivo para todas as vistas). Sem peça, ou tipo que o estoque não tem (capô,
     tampa traseira, vidro e quadro do teto solar, forro do teto, longarinas, bancos, disco de freio, protetor de
     cárter): cinza e o link é o WhatsApp "a gente procura no pátio" (`linkProcuraPeca` em `lib/aviso.ts`,
     `data-botao="raio-x"`). Zona sem peça do carro também mostra o botão (a vista vira a lista de pedidos de pátio).
     No toque, o 1º toque acende e mostra o rótulo, o 2º vai. Esc e "Voltar ao carro" devolvem a arte e o foco (o
     botão por cima da arte desce para a fila quando a arte tem peça naquele canto: `data-canto`). Orientação: na
     frente, o farol à direita de quem olha é o ESQUERDO do carro; na traseira (vista por trás), a lanterna à esquerda
     de quem olha é a ESQUERDA. Ponto de outra zona, de propósito: o semieixo na suspensão e os airbags no teto.
     **Arte nova ou trocada**: gerar no padrão da frente (estúdio claro, peças soltas com vão entre elas, sem marca e
     sem texto), tirar os contornos da arte, pôr a tabela em `lib/porDentro/`, registrar em `VISTAS`, `TABELAS` e
     `lib/porDentro/todas.ts`, rodar o `variantes-imagens.mjs`. Teste `lib/porDentro.test.ts` (todas as vistas, com o
     estoque real: forma dentro da arte, números que não se encostam a 320 px, link = número do catálogo, peça da
     parte certa do carro); o da frente continua em `raioXFrente.test.ts`.
   - **Endereços que já abrem**: `#raio-x=<zona>`, `#raio-x=batida`, `#raio-x=batida:<ponto>`,
     `#raio-x=por-dentro:<zona>` (sem a zona: a frente) (na home e na página do carro; só o `#`, nenhum endereço novo).

16. **Abertura viva: "o estúdio vira o seu carro" (rodada 15, nov/2026)** — `v2/AberturaV2.astro` (marcação e CSS),
   `v2/aberturaPalco.ts` (comportamento, chega depois da 1ª pintura) e `lib/abertura.ts` (contas puras, testadas com o
   estoque real em `abertura.test.ts`). Conceito e os dois descartados: `site/SUPER-PLANEJAMENTO-v2.md` ("Abertura viva").
   - **Título com a palavra viva**: "De qual peça o seu ___ precisa?" — "carro" -> a marca (passo 1 do seletor, lida do que
     ele desenha: `olharSeletor`) -> o modelo e o ano (evento `meu-carro`). `palavraViva()` decide o texto e estima a
     largura da 2ª linha pela classe de cada letra (`--ab-l`, em "em"; medido com os 374 nomes do estoque: erra de -1% a
     +3,6%); o CSS diminui a letra só o necessário para a linha caber na coluna de cada tela (`--ab-col`) e a altura do h1
     é fixa (2 linhas cheias). O h1 é UM bloco de texto (linha em `display: block`/`inline-block` dividiria a área dele e
     o LCP do celular passaria para uma imagem: a palavra só vira caixa durante a troca, `.ab-anima`). O HTML continua
     com "De qual peça o seu carro precisa?" (SEO); quem volta com carro salvo recebe o título dele no script do fim da
     seção, antes da 1ª pintura (só se o `SeletorCarro` marcou `data-salvo`, isto é, o carro ainda tem peça).
   - **Selos** (no lugar da frase cinza): "Desmanche legal · CDV Detran-RS nº 01060" (grafite) e "10% de desconto ·
     comprando pelo WhatsApp" (verde, o ÚNICO verde da abertura; link com `data-botao="abertura-desconto"`, a mensagem
     leva o carro salvo). Laranja só no botão principal do seletor e nos traços.
   - **Palco** (à direita a partir de 1024 px; abaixo do cartão no celular/tablet): fundo de estúdio em CSS + peças
     recortadas, uma por camada (`public/arte/v2/abertura/<k>-<largura>.webp`, medidas em `src/data/abertura-pecas.json`).
     Cada peça é um LINK do bloco dela (`PECAS_PALCO`, 18 peças = 18 dos 25 blocos: farol-herói, retrovisor, pinça,
     amortecedor e turbo na cena de abertura; as outras 13 só como atalho de carro). Com o carro escolhido:
     a arte do carro entra (as 93 têm a mesma pose e o mesmo estúdio; o horizonte dela casa com o do palco:
     `--ab-horizonte`) e as peças viram até 5 atalhos DELE, do bloco com mais peças para o de menos, com o número do
     catálogo (`contarBlocos` sobre `/dados/carro/<k>.json`, o mesmo arquivo do "Chegou para o seu carro";
     `linkAtalho` = `/catalogo.html?tipo=&marca=&modelo=&ano=`). Bloco sem peça não vira atalho; ano salvo sem peça =
     os atalhos do modelo em todos os anos. A peça é ilustrativa do BLOCO (nunca dizer que é a peça do carro).
   - **Peça nova no palco**: gerar sozinha em fundo liso `#DAD6D1` (super prompt no SUPER-PLANEJAMENTO), rodar
     `python ferramentas/camada_abertura.py <png> <nome> --larguras 320,480` (recorte do Vision, borda firme, sem auréola;
     conferir a 200% sobre claro e escuro), pôr em `PECAS_PALCO` com o nome EXATO do bloco (o teste confere) e commitar o
     json. Trocar o farol: `--larguras 400,800,1200` (refaz também `farol-drl.webp`, a máscara por onde a luz corre).
   - **Movimento** (tudo transform/opacity): entrada das peças quando as imagens estão decodificadas (80 ms entre elas),
     luz correndo pelo DRL, "pisca" ao escolher marca/carro, deriva lenta em CSS, paralaxe pelo ponteiro (só mouse, laço
     de rAF que para sozinho), saída em camadas na rolagem (CSS `animation-timeline`, só PC). Pausa fora da tela e com a
     aba escondida (`data-ab-vivo`). `prefers-reduced-motion` e `html.leve`: a mesma cena, parada, trocas secas.
   - **Orçamento (não estourar)**: celular — a única imagem da 1ª tela é o farolzinho do topo (`farol-400.webp`, ~20 KB)
     e ela tem de continuar MENOR em área que o título (o LCP do celular é o h1); o palco fica abaixo do cartão e DORME
     (`data-ab-dorme`: a cena com `display: none` e as imagens sem `srcset`, guardado em `data-srcset`) até chegar a 80 px
     da tela — montado desde o começo ele custava um layout de 35 ms a mais com CPU 4× e baixava ~250 KB na 1ª visita.
     PC — o LCP é o farol recortado (ou a arte do carro salvo), pedido no `<head>` pelo script de `index.astro` com o
     MESMO `srcset`/`sizes` do `<img>` (`SIZES_HEROI`/`SIZES_AUTO`: mudou num, mude no outro; no celular o `sizes` é
     menor que a tela de propósito, senão a tela 3x pede o arquivo de 1200 px). As peças fora da cena só baixam quando
     viram atalho; com carro salvo, as da cena também não baixam. Nada entra empurrando: tudo no palco é absoluto; os
     selos têm colunas de largura fixa e a grade do conteúdo é `minmax(0, 1fr)` (a fonte que chega depois não mexe em
     nada: a fonte de espera "Ab Espera" tem as medidas verticais da Archivo). Estados (`data-ab`, `data-ab-vivo`,
     `data-ab-entrada`) ficam no `.ab-palco`, não na seção. JS novo: um arquivo de ~4 KB gzip, sem biblioteca.
   - **Medido em 11/11/2026** (A/B intercalado com a rodada 14, 7 cargas de cada; Moto G4, 4G lento pelo `proxy-lento.cjs`,
     CPU 4×): 1ª visita — LCP 648 → 656 ms (o h1 nos dois), CLS 0,0008 → 0,0003, 1,0 tarefa longa por carga nos dois (a
     da 1ª pintura, que já existia: 80 → 77 ms), 597 → 582 KB na rede; carro salvo — LCP 684 → 648 ms, CLS 0,0006 → 0,0002,
     970 → 953 KB. PC 1440 sem freio: LCP 56–104 → 80–108 ms, nenhuma tarefa longa. O que a abertura pesa (gzip): HTML
     +2,3 KB, CSS +3,0 KB, JS +4,5 KB; imagens da 1ª tela: celular 72,5 → 28 KB, PC 109 → 122 KB (tela 1x) ou ~207 KB (2x).
   - **A arte do carro no palco**: o carro escolhido no seletor traz a chave (`a`/`as`); o salvo por outra página (ou antes
     de a arte existir) NÃO traz — a chave vem da garagem (`arteDe`, o mesmo `/dados/meu-carro.json` do seletor). Modelo
     sem arte própria (nenhum dos 173 em 11/11/2026, depois dos dois lotes; o modelo novo que entrar no estoque nasce sem): desenho "sem carro" (`data-ab-semarte`: os atalhos maiores, em duas
     fileiras no meio do palco), nunca um buraco. A abertura segue o seletor também quando ele mostra um carro SEM o
     evento `meu-carro` (etapa `pronto` no `olharSeletor`: apelido migrado na leitura, outra aba). Antes de mexer:
     `node scripts/abertura-arte.cjs <url>` (confere `naturalWidth` da arte em todos os caminhos: nascer salvo com e sem a
     chave, sem arte, escolher, trocar, esquecer, voltar pelo histórico, apelido) e `node scripts/abertura-fluxo.cjs <url>`.
   - **Não quebrar**: o seletor (`ui/meuCarroPicker.ts`) não foi tocado — a abertura só OUVE (`meu-carro`,
     MutationObserver no `[data-mc-conteudo]`, as classes `.mc-corpo[data-etapa]` e `.mc-campo-cheio[data-alvo="marca"]`);
     quem mexer nessas classes confere o título. O slot `topo` ("Continuar") e o slot `busca` continuam iguais.

17. **O app instalável (rodadas 14 e 15, nov/2026)** — o site vira app na tela de início (Android/Chrome e iPhone) SEM nunca
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
     fixa (peça, lista) nem por cima do pé da lista do conserto do Raio-x (`.rxb-fixo`: com ele na página o convite some; na
     integração da rodada 15 ele cobria o "Pedir o conserto no WhatsApp"). O texto do convite não diz "na hora". Android/Chrome: guarda o `beforeinstallprompt` (a barra do Chrome não aparece sozinha) e o botão
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

## Testes e o estoque do dia (regra de 11/11/2026: o robô parou a loja por causa de teste)
O robô roda `python testes/test_dados.py` e `npm --prefix site test` com o ESTOQUE DO DIA antes de publicar: teste vermelho
= loja parada. Por isso nenhum teste pode depender do que está à venda hoje. Três fontes (`site/testes/estoques.ts`):
- **Vocabulário da loja** (`site/testes/fixtures/vocabulario.json`): os nomes de bloco e de tipo que o `preparar_dados.py`
  sabe escrever (`BLOCOS`, `_TIPOS_DO_BLOCO`). "Este nome existe?" pergunta-se a ele, nunca ao índice do dia (o tipo some
  quando a última peça vende). Mudou um nome: `python ferramentas/vocabulario_loja.py` e commitar o json (o
  `test_vocabulario_da_loja_em_dia` do `test_dados.py` confere, sem olhar o estoque).
- **Estoque fixo** (`fixtures/estoque-busca.json` = o índice congelado de 09/11/2026, o mesmo dos testes da busca;
  `fixtures/pecas-xc60.json` = as peças do XC60 de 11/11): tudo que precisa de peça para existir ("toda zona tem peça",
  "a frente esquerda acha farol esquerdo", "pelo menos N", exemplos com o XC60). Não regenerar.
- **Estoque do dia** (`public/dados/busca.json`, `src/data/pecas.json`): só REGRAS que valem para qualquer estoque (o número
  do painel = o do catálogo, nenhuma peça do lado errado, nada em dobro), com o carro que o estoque tiver
  (`carroMaisCheio`). Nunca um anúncio, um carro, uma peça ou uma quantidade escritos no teste.
Prova antes de juntar ramo com teste novo: na pasta `site/`, `PYTHON=<python com as dependências> node
scripts/estoque-perturbado.mjs` (30 estoques sorteados: 2–20% dos anúncios fora e, a cada 3, TODO um tipo de um carro; gera
os dados como o robô e roda a suíte inteira; ver também o item "Teste que o robô roda…" em Peso e fluidez). Tudo verde ou
não vai. É proibido pular, excluir ou afrouxar teste no robô.

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
| Abertura da home (título vivo, selos, palco com as peças e o carro) | `site/src/components/v2/AberturaV2.astro`, `aberturaPalco.ts`, `site/src/lib/abertura.ts`; camadas: `ferramentas/camada_abertura.py` |
| Catálogo (busca e filtros) | `site/src/components/catalogo/Catalogo.tsx` e `site/src/lib/busca.ts` |
| Leitura de marca/modelo/nome | `preparar_dados.py` |
| GA4 / Meta Pixel | `site/public/rastreio.js` (só mede no domínio de verdade) |
| Artes (v2: abertura, categorias, carros, selos, banners, passos, topos, história, 404) | `site/public/arte/v2/` — texto desenhado na arte; prompts em `site/SUPER-PLANEJAMENTO-v2.md` |
| Artes dos blocos (`cat-<k>.webp` e o topo sem o nome) | `node scripts/instalar-cats.mjs [pasta dos PNG]` na pasta `site/` (PNG de 1536: cartão em 1200, topo em 1254, nunca aumenta; bloco sem arte: o nome num fundo de estúdio) |
| Variantes menores das artes (srcset) | `node scripts/variantes-imagens.mjs` na pasta `site/` depois de pôr/trocar `carro-<k>.webp`, `cat-<k>.webp` ou `topo-cat-<k>.webp`: faz `-600`/`-900` (carro), `-600` (cat) e `-640` (topo) e o hash em `src/data/variantes-arte.json`; commitar junto. Sem rodar, a arte nova sai só no `src` (variante velha nunca aparece). `sizes` de cada lugar: `src/lib/variantes.ts` |
| Arte nova de carro (`carro-<k>.webp`) | Um arquivo e um comando: `site/public/arte/v2/carro-<k>.webp` (1200×800, webp q84; `<k>` = a chave do carro, `chaveCarro()` em `lib/garagem.ts`, a mesma do `/carros/<k>.html`) + `node scripts/variantes-imagens.mjs`. Não há lista para registrar: o topo do carro, `/carros`, a marca, o cartão do seletor e a abertura acham a arte pelo arquivo (modelo com menos de 8 peças, sem página, também: a garagem usa a chave que a página teria). A arte tem de ser da família: 3/4 dianteira com a frente para a esquerda, carro de ~16% a ~94% da largura, rodas em ~83% da altura, filete laranja em ~70%, parede no tom `rgb(229 214 208)` (a abertura dissolve uma arte na outra e sobre o estúdio em CSS; parede mais rosada = emenda). Roteiros da rodada 16 (geração pelo Codex com 2 artes-âncora + foto real, medida do enquadramento, acerto do tom, instalação): `ferramentas/artes_carro/` (as lições dos dois lotes estão no topo do `carros.py`: âncora sempre da mesma carroceria, irmão de mesma frente, grade sem o lugar do símbolo). Modelo que divide o carro com um apelido ou versão (C230/C250 = Classe C W203, 330i = Série 3, Pajero = Pajero Full): cópia da arte aprovada, sem gerar. Provas: `npx vitest run src/lib/garagem.test.ts` e `node scripts/abertura-arte.cjs <url> "Marca|Modelo" ...` |
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
- Página de peça ≈ 44 KB de HTML (mediana das 5,3 mil no dist: 43,7 KB, 9,8 KB com gzip, nov/2026; era 87 KB; o "Vai junto"
  pôs ~2 KB). Antes de pôr algo em todo cartão ou em toda peça, pense nisso.
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
  sem movimento no palco da abertura e sem animação de altura nas perguntas.
- **Busca em camadas (rodada 14, depois da revisão que barrou a 1ª versão do "tipo manda")**: o MiniSearch acha como sempre (todas as palavras) e `Busca.calcular()` ordena o que ele achou, sem esconder nada: (0/1) as que SÃO o que foi digitado, a 1ª palavra do nome é a da busca ("Farol direito", "Módulo ABS", "Motor vidro"); (2) as que citam no nome ("Suporte farol", "Alavanca freio mão"); (3) as que só o anúncio cita. `busca.nExatas` = quantas do começo são a peça (o catálogo escreve "12 peças para “farol” e mais 66 ligadas" e o bloco "Outras peças ligadas a “farol”"); `busca.citam` = nenhuma peça do estoque tem esse nome, a palavra é o lugar ou o assunto ("teto", "porta-malas", "capô", "ar condicionado", "suspensão xc60": "N peças ligadas a …", nunca "para"). `aproximado` (aviso "Nada exato" + pátio) quando: a peça existe no estoque mas não para o carro digitado ou não com as outras palavras ("alternador gol" só com o "Suporte alternador" do Gol: o do Gol primeiro, depois o alternador dos outros carros; "caixa de direção"); ou nada tem todas as palavras, e aí vêm as PARECIDAS DO TIPO, o carro digitado primeiro ("forro de teto": forros; "lanterna led gol": as lanternas do Gol; "farol compass": as luzes do Compass e depois os faróis), nunca zero com o tipo no estoque e nunca outro tipo. O "tipo" é a 1ª unidade digitada que é nome de peça (`casador()`: `cabecas`, `unNaCabeca`, `todas`); as palavras dos nomes ficam em índices montados uma vez (`montarVocab`, fora do busca.json e fora das peças). Regras que a revisão cobrou e têm teste: composta com espaço vale junta quando a junção é palavra de nome do estoque ("porta luvas", "para choque", "semi eixo"; antes de tirar as vazias) e duas palavras do estoque digitadas juntas se separam ("arcondicionado"); "d'água"/"dagua"/"d agua" = água (`limpar`); gatilho e destino do sinônimo são UMA unidade ("espelho retrovisor"); carro e marca valem só como palavra inteira ("gol" não é "Golf"), "vw"/"gm"/"volks" valem pela marca e o apelido de carro unido pelo principal ("new fiesta" = Fiesta, na busca e no filtro `modelo=`); 2 letras no fim só valem como começo quando não são palavra de nome ("sensor de ré" não é Renault; "modulo ab" segue achando ABS); erro de digitação é corrigido ANTES das camadas (`corrigir`: 1 letra, 2 invertidas ou o mesmo som: "retrovizor", "alternadro", "fexadura", "sinalera"); o carro salvo sobe dentro de cada parte da lista sem esconder as outras (`procurar(f, meuCarro)`, `sugestoes(q, n, meuCarro)`); "MLB…" acha o anúncio e "cod 123" o código. **O juiz**: `lib/busca.diferencial.test.ts` roda 541 consultas (as 291 do revisor, as da revisão e 190 do jeito que o cliente digita) com gabarito escrito à mão, no candidato e no motor do ar (commit fixo de `origin/master`, lido pelo git para `node_modules/.cache/busca-no-ar`; no robô o clone é raso e a comparação é pulada): o candidato não pode falhar o gabarito nem perder para o do ar em nenhuma (541/541, 192 vitórias, 0 derrotas; o do ar cumpre 354). `BUSCA_RELATORIO=arquivo` grava a tabela consulta a consulta; `BUSCA_CANDIDATO=/caminho/busca.mjs` julga outro motor. Mexeu na busca ou em `sinonimos.ts`: rodar o juiz.
- **Teste que o robô roda não pode depender do estoque do dia (rodada 14b, 11/11/2026)**: o robô roda `npm --prefix site test` e `python testes/test_dados.py` ANTES de publicar, a cada 30 min, com o estoque do momento; teste vermelho = nada é publicado e o catálogo no ar congela. A rodada 14 foi recusada assim: vendeu a única lanterna do XC60 e dois testes tinham o estoque de 09/11 no gabarito. Daí em diante: (1) o que cita peça, carro que "tem" algo ou contagem roda no **estoque congelado** `site/testes/fixtures/estoque-busca.json` (o busca.json de 09/11, sem as colunas de foto; não regenerar): o juiz, os casos escritos à mão de `lib/busca.regressao.test.ts`, a conferência da tabela de sinônimos; (2) no **estoque do dia** só regra que sai do próprio estoque testado (`lib/busca.regressao.ts`: 926 consultas geradas; a peça existe = a 1ª é ela; não existe = zero ou lista com aviso e a 1ª da família; o que só o título do anúncio liga nunca antes do que o nome/tipo/bloco ligam); (3) `lib/busca.vendas.test.ts` tira peças do congelado (as 18 vendidas em 11/11, um tipo inteiro de um carro, um tipo do estoque inteiro, um carro) e exige as mesmas regras. **A prova antes de mandar ao robô**: na pasta `site/`, `PYTHON=<python com as dependências> node scripts/estoque-perturbado.mjs` (30 estoques sorteados: tira 2–20% dos anúncios e, a cada 3, um tipo inteiro de um carro; gera os dados como o robô e roda a suíte inteira; `--hoje` usa o `/dados/ativas.json` do site no ar; `--arquivo outro-products.json` testa outro estoque). Tudo verde ou não vai.
- **O que a busca garante com qualquer estoque (rodada 14b)**: palavra que o estoque conhece (nome, tipo, bloco, carro, marca, gatilho do jeito de falar) nunca é lida como erro de digitação de outra (`casam().certa`, `mesmaForma`: "lanterna" não é "antena" nem "interna", "módulo" não é "modelo"; a aproximação do MiniSearch só vale para palavra desconhecida). Sem peça que SEJA o que foi digitado, nada conta como achado (`aproximado` ou `citam`, `nExatas` 0) e a ordem é: o que o nome cita, o que o tipo "s"/bloco "c" cita, a peça dos outros carros, e por último o que só o texto do anúncio liga (nível 4 em `calcular`). O carro digitado sozinho não faz "parecida" ("churrasqueira gol" sem churrasqueira no estoque = zero + pátio, nunca a lista das peças do Gol). O nome que começa pelo digitado, na ordem, é chave de ordem (não só peso).
- Busca: UMA regra para o catálogo e as sugestões (`lib/busca.ts`): ano solto vira filtro; todas as palavras, depois com
  erro de digitação (nunca em termo com número), depois as parecidas (`aproximado`); o carro digitado vem primeiro.
  O índice de texto (MiniSearch) é montado aos poucos (`Busca.prepararIndice`); sem texto ele nem é preciso.
  **Jeito de falar do cliente** (nov/2026): `lib/sinonimos.ts`, UMA tabela no navegador (~2 KB no JS com cache; no
  busca.json custaria em toda peça): "sinaleira" = lanterna, "máquina de vidro" = motor/máquina vidro, "pisca" = seta,
  "farolete" = farol de milha, "frente" = grade/churrasqueira/farol/capô/para-choque dianteiro, "central"/"ECU" = módulo, "TBI" = corpo
  de borboleta, "caneta" = bobina, "mola a gás" = amortecedor da tampa/capô, "tapete" = carpete, "estepe"/"roda"... Só
  ACRESCENTA alternativas (a palavra digitada continua valendo e pesa mais: sinônimo × 0,25, nome que diz o digitado
  × 1,5), a frase mais longa primeiro, sem as palavras vazias
  ("de", "da"...); o plural vale sozinho ("faróis" = farol, só a palavra inteira). Cada linha aponta para um nome que
  EXISTE no estoque (`sinonimos.test.ts` confere); tipo novo no estoque = conferir a tabela. O "começa pela palavra" e o
  `bate()` (bloco "Não achou?") usam as mesmas formas. Uma linha pode ter um 3º item, o "fora" (`MAPA_FORA`): a peça cujo
  nome ou tipo diz aquela palavra não entra pelo sinônimo (AND_NOT do MiniSearch) e as outras formas valem só no nome;
  "frente" tira painel, console, alto-falante, difusor, traseira e porta-malas ("frente xc60": a grade em 1º, não a
  "Moldura frontal painel"); quem digita a palavra do "fora" ("frente painel") continua achando.
  **Lado e posição digitados viram filtro** ("retrovisor direito xc60": os DIREITOS do XC60, pela coluna `l`;
  "motorista" = esquerdo; "dianteira", "traseira", "frontal", "esq", "dir", "tras"): saem do texto (`separarLadoPos`),
  filtram e marcam a ficha; a peça cujo nome diz a mesma palavra sobe ("amortecedor traseiro" antes da "tampa
  traseira"). Rodada 14: se o estoque tem a peça digitada mas não desse lado/posição, NÃO volta ao texto nem mostra as que só citam: a lista sai vazia e `busca.faltou` diz o que faltou (lado, posição e `fem`, o gênero lido do nome das peças, para a tela escrever "Nenhum retrovisor direito para Volvo XC60" / "Nenhuma lanterna traseira direita"), com `busca.outrosLados` (o outro lado na MESMA posição, para a dica "Do lado esquerdo a gente tem…") e o "Não achou? A gente procura no pátio" (nunca trocar por outro lado em silêncio; peça que não diz o lado no nome não entra como "a direita"). Posição que o estoque não registra para a peça ("grade dianteira") não filtra. Na tela vazia cada texto tem a sua linha (`.cat-vazio-texto` e `.cat-vazio-pe` em `catalogo.astro`). As fichas "Lado e posição" do
  catálogo (`Catalogo.tsx`, depois do Ano, só com peça na lista) contam sem o próprio filtro; tocar numa tira a palavra
  da busca (`Busca.semLadoPos`).
- Fichas de ano (página do carro e seletor "Seu carro", `lib/anosFila.ts`): sem ano escolhido, a fila já abre na janela
  de anos com mais peças (na página do carro, num `<script is:inline>` antes da 1ª pintura); o "Todos" fica fixo à
  esquerda (`.ac-fixo`/`.mc-fixo`, sticky). Só o scrollLeft da fila, nunca a página.
- Página do carro: a vista do ano e os grupos que não vêm no HTML saem de `/dados/carro/<k>.json` (um por modelo da garagem; só as peças do carro, feito no
  build do mesmo busca.json; XC60 140 KB em vez de 1,4 MB) e entram um grupo por tarefa (a lista completa em
  fatias de 6 ms); os grupos da lista "Todas as N peças" têm `content-visibility: auto`. Ver o item 14.
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
