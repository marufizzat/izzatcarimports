/* ==========================================================================
   CATALOGO — busca, filtros e listagem.

   Roda em cima do IZZAT_INDEX (catalogo_index.js), gerado por gerar_indice.py.
   Tudo acontece no navegador: nao ha chamada de API nenhuma nesta pagina.

   Cada item do indice:
     id  MLB…            t  titulo         p  preco       i  foto
     u   link do ML      h  pagina da peca no nosso site   f  frete gratis
     b   marca           m  modelo         y  [ano_ini, ano_fim]
     c   familia         s  tipo da peca   o  codigos OEM (texto)
   ========================================================================== */

(function () {
  'use strict';

  var IX = window.IZZAT_INDEX;
  var $ = function (id) { return document.getElementById(id); };

  if (!IX || !IX.items || !IX.items.length) {
    $('total').textContent = 'Não foi possível carregar o catálogo. Atualize a página.';
    return;
  }

  var ITENS = IX.items;
  var LOTE = 48;

  /* --- Texto: tirar acento e pontuacao para a busca nao depender disso ---- */
  function normal(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /* Um "palheiro" por peca, montado uma vez so. Junta titulo, carro, tipo e
     TODOS os codigos OEM — e por isso que digitar 31663477 acha a peca. */
  var PALHEIRO = ITENS.map(function (it) {
    return normal([it.t, it.b, it.m, it.s, it.c, it.o].join(' '));
  });
  var TITULO_N = ITENS.map(function (it) { return normal(it.t); });

  /* Mesmo palheiro sem os espacos: quem digita "parachoque" tem que achar os 9
     anuncios escritos "para-choque". */
  var PALHEIRO_JUNTO = PALHEIRO.map(function (s) { return s.replace(/ /g, ''); });

  /* Carro que se chama numero (Peugeot 2008). Sem esta lista, "lanterna peugeot
     2008" le o 2008 como ANO e nao acha nada. */
  var MODELO_NUMERO = {};
  IX.brands.forEach(function (b) {
    (b.m || []).forEach(function (m) {
      if (/^\d{4}$/.test(m.n)) MODELO_NUMERO[m.n] = true;
    });
  });

  var FAIXAS = [
    { k: '0-100',    n: 'Até R$ 100',           min: 0,    max: 100 },
    { k: '100-250',  n: 'R$ 100 a R$ 250',      min: 100,  max: 250 },
    { k: '250-500',  n: 'R$ 250 a R$ 500',      min: 250,  max: 500 },
    { k: '500-1000', n: 'R$ 500 a R$ 1.000',    min: 500,  max: 1000 },
    { k: '1000-2500', n: 'R$ 1.000 a R$ 2.500', min: 1000, max: 2500 },
    { k: '2500+',    n: 'Acima de R$ 2.500',    min: 2500, max: Infinity }
  ];
  var FAIXA_POR_K = {};
  FAIXAS.forEach(function (f) { FAIXA_POR_K[f.k] = f; });

  var estado = { q: '', marca: '', modelo: '', ano: '', familia: '', faixa: '', frete: false, ordem: 'rel' };
  var mostrando = LOTE;
  var resultado = [];

  /* --- Interpretacao da busca -------------------------------------------- */
  /* "modulo xc60 2019" vira: termos ["modulo","xc60"] + ano 2019. Sem isso o
     2019 seria procurado como texto e nao acharia nada. */
  function lerBusca(q) {
    var termos = [], ano = 0;
    normal(q).split(' ').forEach(function (t) {
      if (!t) return;
      if (/^(19|20)\d{2}$/.test(t) && !ano && !MODELO_NUMERO[t]) {
        ano = parseInt(t, 10); return;
      }
      termos.push(t);
    });
    return { termos: termos, ano: ano };
  }

  function casaTexto(idx, busca) {
    for (var i = 0; i < busca.termos.length; i++) {
      var t = busca.termos[i];
      if (PALHEIRO[idx].indexOf(t) >= 0) continue;
      // So palavra longa pode casar sem espaco, senao "gol" acharia qualquer coisa.
      if (t.length >= 5 && PALHEIRO_JUNTO[idx].indexOf(t) >= 0) continue;
      return false;
    }
    return true;
  }

  function cobreAno(it, ano) {
    return !!(it.y && it.y[0] <= ano && ano <= it.y[1]);
  }

  /* --- Filtros, separados para dar pra contar cada faceta sozinha --------- */
  function passaCarro(it, busca) {
    if (estado.marca && it.b !== estado.marca) return false;
    if (estado.modelo && it.m !== estado.modelo) return false;
    var ano = estado.ano ? parseInt(estado.ano, 10) : busca.ano;
    if (ano && !cobreAno(it, ano)) return false;
    return true;
  }
  function passaFamilia(it) { return !estado.familia || it.c === estado.familia; }
  function passaPreco(it) {
    if (!estado.faixa) return true;
    var f = FAIXA_POR_K[estado.faixa];
    return f && it.p > f.min - 0.0001 && it.p <= f.max;
  }
  function passaFrete(it) { return !estado.frete || !!it.f; }

  /* Peca cujo titulo COMECA com o que foi digitado vem primeiro. Sem isso
     "farol" traz antes o "suporte do farol" que so cita a palavra no meio. */
  function relevancia(idx, busca) {
    var t = TITULO_N[idx], nota = 0;
    for (var i = 0; i < busca.termos.length; i++) {
      var pos = t.indexOf(busca.termos[i]);
      if (pos === 0) nota += 3;
      else if (pos > 0) nota += (t.charAt(pos - 1) === ' ' ? 2 : 1);
    }
    return nota;
  }

  function calcular() {
    var busca = lerBusca(estado.q);
    var base = [];                       // passa texto + carro
    for (var i = 0; i < ITENS.length; i++) {
      if (casaTexto(i, busca) && passaCarro(ITENS[i], busca)) base.push(i);
    }

    /* Contagem de cada faceta ignorando ela mesma — e assim que o Mercado
       Livre mostra "Motor (485)" sem zerar tudo ao clicar. */
    var cFam = {}, cPreco = {}, cFrete = 0;
    base.forEach(function (i) {
      var it = ITENS[i];
      if (passaPreco(it) && passaFrete(it)) cFam[it.c] = (cFam[it.c] || 0) + 1;
      if (passaFamilia(it) && passaFrete(it)) {
        for (var k = 0; k < FAIXAS.length; k++) {
          if (it.p > FAIXAS[k].min - 0.0001 && it.p <= FAIXAS[k].max) {
            cPreco[FAIXAS[k].k] = (cPreco[FAIXAS[k].k] || 0) + 1; break;
          }
        }
      }
      if (passaFamilia(it) && passaPreco(it) && it.f) cFrete++;
    });

    var finais = base.filter(function (i) {
      var it = ITENS[i];
      return passaFamilia(it) && passaPreco(it) && passaFrete(it);
    });

    if (estado.ordem === 'asc') finais.sort(function (a, b) { return ITENS[a].p - ITENS[b].p; });
    else if (estado.ordem === 'desc') finais.sort(function (a, b) { return ITENS[b].p - ITENS[a].p; });
    else if (busca.termos.length) {
      var nota = {};
      finais.forEach(function (i) { nota[i] = relevancia(i, busca); });
      finais.sort(function (a, b) { return nota[b] - nota[a] || a - b; });
    }

    resultado = finais;
    return { fam: cFam, preco: cPreco, frete: cFrete };
  }

  /* --- Desenho ----------------------------------------------------------- */
  /* Montado com createElement, nunca com innerHTML: titulo de anuncio vem do
     Mercado Livre e pode ter aspas ou sinal de menor. */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function cartao(it) {
    var a = el('a', 'card');
    a.href = 'peca/' + it.h + '.html';

    var media = el('div', 'card-media');
    var img = el('img');
    img.src = it.i; img.alt = it.t; img.loading = 'lazy'; img.decoding = 'async';
    media.appendChild(img);
    a.appendChild(media);

    var body = el('div', 'card-body');
    if (it.c) body.appendChild(el('span', 'card-cat', it.c));
    body.appendChild(el('h3', 'card-title', it.t));

    var carro = [it.b, it.m].filter(Boolean).join(' ');
    if (it.y) carro += (carro ? ' ' : '') + it.y[0] + '–' + it.y[1];
    if (carro) body.appendChild(el('span', 'card-fit', carro));

    body.appendChild(el('span', 'card-price', window.izzatPreco(it.p)));
    if (it.f) body.appendChild(el('span', 'tag tag-free', 'Frete grátis'));

    a.appendChild(body);
    return a;
  }

  function desenharGrid() {
    var grid = $('grid');
    grid.textContent = '';
    var frag = document.createDocumentFragment();
    resultado.slice(0, mostrando).forEach(function (i) { frag.appendChild(cartao(ITENS[i])); });
    grid.appendChild(frag);

    $('vazio').hidden = resultado.length > 0;

    var mais = $('mais');
    var falta = resultado.length - mostrando;
    mais.hidden = falta <= 0;
    if (falta > 0) mais.textContent = 'Ver mais ' + Math.min(falta, LOTE) + ' peças';

    var n = resultado.length;
    $('total').innerHTML = '';
    var b = el('b', null, n.toLocaleString('pt-BR'));
    $('total').appendChild(b);
    $('total').appendChild(document.createTextNode(n === 1 ? ' peça encontrada' : ' peças encontradas'));
  }

  function opcao(rotulo, contagem, ativo, aoClicar) {
    var b = el('button', 'opcao');
    b.type = 'button';
    b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    b.appendChild(el('span', null, rotulo));
    b.appendChild(el('span', 'count', contagem ? contagem.toLocaleString('pt-BR') : '0'));
    if (!contagem && !ativo) b.disabled = true;
    b.addEventListener('click', aoClicar);
    return b;
  }

  function desenharFacetas(cont) {
    var fam = $('fFamilias');
    fam.textContent = '';
    IX.families.forEach(function (f) {
      var nome = f.n || f;
      fam.appendChild(opcao(nome, cont.fam[nome] || 0, estado.familia === nome, function () {
        estado.familia = estado.familia === nome ? '' : nome;
        atualizar();
      }));
    });

    var pre = $('fPrecos');
    pre.textContent = '';
    FAIXAS.forEach(function (f) {
      pre.appendChild(opcao(f.n, cont.preco[f.k] || 0, estado.faixa === f.k, function () {
        estado.faixa = estado.faixa === f.k ? '' : f.k;
        atualizar();
      }));
    });

    $('fFrete').setAttribute('aria-pressed', estado.frete ? 'true' : 'false');
    $('cFrete').textContent = (cont.frete || 0).toLocaleString('pt-BR');
  }

  function desenharChips() {
    var box = $('ativos');
    box.textContent = '';
    var ativos = [];
    if (estado.q) ativos.push(['"' + estado.q + '"', function () { estado.q = ''; $('q').value = ''; }]);
    if (estado.marca) ativos.push([estado.marca, function () { estado.marca = ''; estado.modelo = ''; }]);
    if (estado.modelo) ativos.push([estado.modelo, function () { estado.modelo = ''; }]);
    if (estado.ano) ativos.push(['Ano ' + estado.ano, function () { estado.ano = ''; }]);
    if (estado.familia) ativos.push([estado.familia, function () { estado.familia = ''; }]);
    if (estado.faixa) ativos.push([FAIXA_POR_K[estado.faixa].n, function () { estado.faixa = ''; }]);
    if (estado.frete) ativos.push(['Frete grátis', function () { estado.frete = false; }]);

    if (!ativos.length) return;

    ativos.forEach(function (par) {
      var chip = el('span', 'chip');
      chip.appendChild(document.createTextNode(par[0]));
      var x = el('button', null);
      x.type = 'button';
      x.setAttribute('aria-label', 'Tirar filtro ' + par[0]);
      x.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      x.addEventListener('click', function () { par[1](); sincronizarSelects(); atualizar(); });
      chip.appendChild(x);
      box.appendChild(chip);
    });

    if (ativos.length > 1) {
      var limpar = el('button', 'chip', 'Limpar tudo');
      limpar.type = 'button';
      limpar.style.background = 'transparent';
      limpar.style.borderColor = 'var(--line-strong)';
      limpar.style.color = 'var(--text-muted)';
      limpar.style.padding = '0 var(--s3)';
      limpar.addEventListener('click', function () {
        estado.q = ''; $('q').value = '';
        estado.marca = ''; estado.modelo = ''; estado.ano = '';
        estado.familia = ''; estado.faixa = ''; estado.frete = false;
        sincronizarSelects(); atualizar();
      });
      box.appendChild(limpar);
    }
  }

  /* --- Seletores de carro ------------------------------------------------ */
  function marcaObj(nome) {
    for (var i = 0; i < IX.brands.length; i++) if (IX.brands[i].n === nome) return IX.brands[i];
    return null;
  }

  function encherModelos() {
    var sel = $('fModelo');
    sel.textContent = '';
    var mo = marcaObj(estado.marca);
    if (!mo || !mo.m || !mo.m.length) {
      sel.appendChild(new Option(estado.marca ? 'Todos os modelos' : 'Escolha a marca', ''));
      sel.disabled = true;
      estado.modelo = '';
      return;
    }
    sel.disabled = false;
    sel.appendChild(new Option('Todos os modelos', ''));
    mo.m.forEach(function (m) {
      sel.appendChild(new Option(m.n + ' (' + m.c + ')', m.n));
    });
    sel.value = estado.modelo || '';
    if (sel.value !== estado.modelo) estado.modelo = '';
  }

  function sincronizarSelects() {
    $('fMarca').value = estado.marca;
    encherModelos();
    $('fAno').value = estado.ano;
    $('ordenar').value = estado.ordem;
    $('busca').classList.toggle('tem-texto', !!$('q').value);
  }

  function montarSelects() {
    var m = $('fMarca');
    IX.brands.forEach(function (b) { m.appendChild(new Option(b.n + ' (' + b.c + ')', b.n)); });

    var min = 3000, max = 0;
    ITENS.forEach(function (it) {
      if (!it.y) return;
      if (it.y[0] < min) min = it.y[0];
      if (it.y[1] > max) max = it.y[1];
    });
    var a = $('fAno');
    for (var y = max; y >= min; y--) a.appendChild(new Option(y, y));
  }

  /* --- Endereco na barra: filtro escolhido sobrevive ao F5 e da pra mandar
         o link no WhatsApp ------------------------------------------------- */
  function gravarURL() {
    var p = new URLSearchParams();
    if (estado.q) p.set('q', estado.q);
    if (estado.marca) p.set('marca', estado.marca);
    if (estado.modelo) p.set('modelo', estado.modelo);
    if (estado.ano) p.set('ano', estado.ano);
    if (estado.familia) p.set('tipo', estado.familia);
    if (estado.faixa) p.set('preco', estado.faixa);
    if (estado.frete) p.set('frete', '1');
    if (estado.ordem !== 'rel') p.set('ordem', estado.ordem);
    var s = p.toString();
    history.replaceState(null, '', s ? '?' + s : location.pathname);
  }

  function lerURL() {
    var p = new URLSearchParams(location.search);
    estado.q = p.get('q') || '';
    estado.marca = p.get('marca') || '';
    estado.modelo = p.get('modelo') || '';
    estado.ano = p.get('ano') || '';
    estado.familia = p.get('tipo') || '';
    estado.faixa = FAIXA_POR_K[p.get('preco')] ? p.get('preco') : '';
    estado.frete = p.get('frete') === '1';
    estado.ordem = ['asc', 'desc'].indexOf(p.get('ordem')) >= 0 ? p.get('ordem') : 'rel';
    $('q').value = estado.q;
  }

  function atualizar(manterPosicao) {
    if (!manterPosicao) mostrando = LOTE;
    var cont = calcular();
    desenharFacetas(cont);
    desenharChips();
    desenharGrid();
    gravarURL();

    var texto = estado.q || [estado.marca, estado.modelo].filter(Boolean).join(' ') || 'a peça que preciso';
    $('vazioWhats').href = window.izzatWhats('Olá! Procuro: ' + texto + '. Tem no estoque?');
  }

  /* --- Ligacoes ---------------------------------------------------------- */
  var timer;
  $('q').addEventListener('input', function () {
    $('busca').classList.toggle('tem-texto', !!this.value);
    clearTimeout(timer);
    var v = this.value;
    timer = setTimeout(function () { estado.q = v.trim(); atualizar(); }, 180);
  });
  $('qLimpar').addEventListener('click', function () {
    $('q').value = ''; estado.q = '';
    $('busca').classList.remove('tem-texto');
    $('q').focus(); atualizar();
  });

  $('fMarca').addEventListener('change', function () {
    estado.marca = this.value; estado.modelo = '';
    encherModelos(); atualizar();
  });
  $('fModelo').addEventListener('change', function () { estado.modelo = this.value; atualizar(); });
  $('fAno').addEventListener('change', function () { estado.ano = this.value; atualizar(); });
  $('limparCarro').addEventListener('click', function () {
    estado.marca = ''; estado.modelo = ''; estado.ano = '';
    sincronizarSelects(); atualizar();
  });

  $('fFrete').addEventListener('click', function () { estado.frete = !estado.frete; atualizar(); });
  $('ordenar').addEventListener('change', function () { estado.ordem = this.value; atualizar(); });

  $('mais').addEventListener('click', function () {
    mostrando += LOTE;
    atualizar(true);
    this.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  var lado = $('lado');
  function fecharPainel() { lado.classList.remove('open'); document.body.style.overflow = ''; }
  $('abrirFiltros').addEventListener('click', function () {
    lado.classList.add('open'); document.body.style.overflow = 'hidden';
  });
  $('fecharFiltros').addEventListener('click', fecharPainel);
  $('verResultados').addEventListener('click', fecharPainel);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lado.classList.contains('open')) fecharPainel();
  });

  /* --- Partida ----------------------------------------------------------- */
  montarSelects();
  lerURL();
  sincronizarSelects();
  atualizar();
})();
