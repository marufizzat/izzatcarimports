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
   aviso: nunca "tudo vendido"). O índice inteiro (`busca.json`, e a busca com o MiniSearch, sob demanda) só na lista de
   um link (precisa de nome, carro, anos e código), quando falta um dado que o leve não tem (nome, endereço, a foto do ML
   de peça sem capa de estúdio) ou UMA vez na lista de antes da rodada 13 (`izzatcar.lista.conferida`, marcada ao começar
   uma lista nova: o nome e o carro guardados já são os de agora). A capa só é pedida depois de saber se a peça existe (a
   da vendida dava 404). O esqueleto é a linha de verdade (as mesmas classes e alturas de linha, barras no lugar do texto;
   no celular o preço do site sempre na 2ª linha): nada pula quando as peças chegam. Link sem rede: o esqueleto parado e
   "Não deu para abrir as peças desta lista agora. Tentar de novo" (nunca "R$ 0,00" nem "Anúncio MLB…" como nome; sem preço
   conferido, a linha fica sem o bloco do preço; "Guardar" só depois que as peças abriram). GA4 `lista_adicionar`
   (`rastreio.js`).
   **"Vai junto"** (`components/peca/VaiJunto.astro`, logo depois da compra): até 4 peças do MESMO carro e geração que
   costumam ser trocadas com a vista, pela regra `GRUPOS`/`JUNTO` de `lib/relacionadas.ts` (`vaiJunto`: lado e
   frente/trás pelo nome, nunca o outro lado nem a outra ponta, nunca a mesma peça repetida); sem peça que combine, o
   bloco não aparece. Nos grupos de motor (`GRUPOS_MOTOR`) nunca entra nome com tampa traseira/porta-malas/rebatimento/
   banco/porta (`FORA_DO_MOTOR`; "banco 1" do motor fica); a válvula do turbo tem o grupo dela (`turbo-valvula`) e o botão
   da tampa vai com a tampa (`tampa-botao`). As peças dele saem do "Do mesmo carro" e do "Mais peças <marca>": sem outra
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

13. **Abertura viva: "o estúdio vira o seu carro" (rodada 15, nov/2026)** — `v2/AberturaV2.astro` (marcação e CSS),
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
   - **Não quebrar**: o seletor (`ui/meuCarroPicker.ts`) não foi tocado — a abertura só OUVE (`meu-carro`,
     MutationObserver no `[data-mc-conteudo]`, as classes `.mc-corpo[data-etapa]` e `.mc-campo-cheio[data-alvo="marca"]`);
     quem mexer nessas classes confere o título. O slot `topo` ("Continuar") e o slot `busca` continuam iguais.

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
- **Tipo manda (rodada 14, cliente oculto atrito 6)**: `busca.ts` separa o TIPO digitado (`alvosDo`) do carro/lado/ano. Peça do tipo = a 1ª palavra do nome (`tipoDe`: "Para-choque…", "Lanterna…"); a 2ª só sob cabeçalho genérico (`GENERICOS`: guia, suporte, moldura, acabamento, grade, tampa, maquina, motor) ou para o sinônimo (forma do `sinonimos.ts`, "pisca" = "Chave seta" e "Botão pisca"; `CONTROLES`); "Botão farol milha" e "Chave seta farol" NÃO são farol. Vários termos: o 1º é o tipo, os outros têm de estar no nome ("motor vidro"). Sem peça do tipo: as PARECIDAS são da família (`familia`: o sistema "s" ou o bloco "c" com a palavra, todas as palavras digitadas), o carro digitado primeiro, com aviso (`aproximado`); busca de sistema ("suspensão xc60", o nome do bloco) não é parecida. Tabela de regressão: `lib/busca.regressao.ts` (gabarito pelo estoque, 926 consultas, a antiga 612) e `lib/busca.regressao.test.ts`. Palavra curta não é raiz ("par" ≠ "paralama"); erro de uma letra em palavra de 6+ letras vale ("esqurdo").
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
  traseira"). Rodada 14: se o filtro não deixar nada, NÃO volta ao texto: a lista sai vazia e `busca.faltou` diz o que faltou (lado/posição), com `busca.outrosLados` (o outro lado, para a dica "tem a esquerda") e o "Não achou? A gente procura no pátio" (nunca trocar por outro lado em silêncio). As fichas "Lado e posição" do
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
