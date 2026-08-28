/* ==========================================================================
   IZZAT CAR IMPORTS — home.

   Monta o seletor de carro, os tipos de peca, as marcas e a vitrine a partir
   de home_data.js. Nao carrega o indice inteiro do catalogo (1,9 MB): a home
   e a pagina que o anuncio da Meta abre, quase sempre no celular e no 4G, e
   os 7 KB daqui evitam a tela branca que faz o cliente desistir.

   Tudo aponta pra catalogo.html com os filtros ja na URL, que e a mesma
   linguagem que assets/catalogo.js le.
   ========================================================================== */

(function () {
  'use strict';

  var H = window.IZZAT_HOME;
  if (!H) return;

  var $ = function (id) { return document.getElementById(id); };

  function texto(n) { return Number(n).toLocaleString('pt-BR'); }

  /* --- Seletor de carro ------------------------------------------------- */
  var selMarca = $('hMarca'), selModelo = $('hModelo'), selAno = $('hAno');

  H.brands.forEach(function (b) {
    var o = document.createElement('option');
    o.value = b.n;
    o.textContent = b.n + ' (' + b.c + ')';
    selMarca.appendChild(o);
  });

  /* Os anos vem do titulo do anuncio ("18/24"), entao a faixa util e a dos
     carros que a gente desmancha: de 1998 pra ca. */
  var agora = new Date().getFullYear();
  for (var a = agora; a >= 1998; a--) {
    var oa = document.createElement('option');
    oa.value = String(a);
    oa.textContent = String(a);
    selAno.appendChild(oa);
  }

  selMarca.addEventListener('change', function () {
    selModelo.innerHTML = '';
    var marca = selMarca.value;
    var achou = null;
    H.brands.forEach(function (b) { if (b.n === marca) achou = b; });

    var vazio = document.createElement('option');
    vazio.value = '';
    vazio.textContent = marca ? 'Todos os modelos' : 'Escolha a marca';
    selModelo.appendChild(vazio);

    if (!achou || !achou.m.length) { selModelo.disabled = true; return; }
    selModelo.disabled = false;
    achou.m.forEach(function (nome) {
      var o = document.createElement('option');
      o.value = nome;
      o.textContent = nome;
      selModelo.appendChild(o);
    });
  });

  $('verCarro').addEventListener('click', function () {
    var p = [];
    if (selMarca.value) p.push('marca=' + encodeURIComponent(selMarca.value));
    if (selModelo.value) p.push('modelo=' + encodeURIComponent(selModelo.value));
    if (selAno.value) p.push('ano=' + selAno.value);
    location.href = 'catalogo.html' + (p.length ? '?' + p.join('&') : '');
  });

  /* --- Tipos de peca ---------------------------------------------------- */
  /* Um desenho por familia. O que nao estiver aqui cai no icone de engrenagem
     — melhor um icone generico do que um icone errado. */
  var ICONE = {
    'Peças de Interior': '<path d="M4 19v-7l3-6h10l3 6v7"/><path d="M7 19v2M17 19v2M4 14h16"/>',
    'Motor': '<path d="M5 15V9h3l2-2h4v3h3l2 2v3h-2v2H7z"/><path d="M12 4h3"/>',
    'Carroceria': '<path d="M3 16v-3l2-5h14l2 5v3"/><circle cx="7.5" cy="16.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    'Sistema Elétrico': '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    'Injeção': '<path d="M9 3h6v5l3 4v9H6v-9l3-4z"/><path d="M9 8h6"/>',
    'Climatização': '<path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/>',
    'Janelas e Vedações': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/>',
    'Fechaduras e Chaves': '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8 2 2-2 2 2 2-3 3-2-2z"/>',
    'Peças de Exterior': '<path d="M4 17V9l3-4h10l3 4v8"/><path d="M4 13h16"/>',
    'Suspensão e Direção': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5M4.5 16l4.3-2.5M19.5 16l-4.3-2.5"/>',
    'Ignição': '<path d="M12 21c-3.5-2.5-6-5.5-6-9a6 6 0 0112 0c0 3.5-2.5 6.5-6 9z"/><circle cx="12" cy="11" r="2"/>',
    'Iluminação': '<path d="M4 12a8 8 0 018-8v16a8 8 0 01-8-8z"/><path d="M14 8h6M14 12h7M14 16h6"/>',
    'Freios': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
    'Transmissão': '<path d="M6 5v14M12 5v14M18 5v6"/><circle cx="6" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="18" cy="5" r="1.5"/><path d="M6 12h12"/>',
    'Som e Multimídia': '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="3"/><path d="M15 10h3M15 14h3"/>',
    'Segurança': '<path d="M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z"/>',
    'Filtros': '<path d="M4 5h16l-6 7v7l-4-2v-5z"/>',
    'Arrefecimento': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M12 4v16M16 4v16"/>',
    'Escapamentos': '<path d="M3 14h11a3 3 0 013 3v1H6a3 3 0 01-3-3z"/><path d="M17 15h4"/>'
  };
  var ICONE_PADRAO = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1v.3a2 2 0 11-4 0v-.2a1.6 1.6 0 00-2.8-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 003.6 15a2 2 0 110-4 1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 0010.4 4.4a2 2 0 114 0 1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 001.1 2.7 2 2 0 110 4z"/>';

  var tipos = $('tipos');
  H.families.forEach(function (f) {
    if (f.n === 'Outros') return;         // nao ajuda ninguem a achar peca
    var a = document.createElement('a');
    a.className = 'tipo';
    a.href = 'catalogo.html?tipo=' + encodeURIComponent(f.n);

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICONE[f.n] || ICONE_PADRAO;

    var box = document.createElement('div');
    var b = document.createElement('b');
    b.textContent = f.n;
    var s = document.createElement('span');
    s.textContent = texto(f.c) + (f.c === 1 ? ' peça' : ' peças');
    box.appendChild(b);
    box.appendChild(s);

    a.appendChild(svg);
    a.appendChild(box);
    tipos.appendChild(a);
  });

  /* --- Marcas ----------------------------------------------------------- */
  var marcas = $('marcas');
  H.brands.forEach(function (b) {
    if (b.c < 5) return;                  // marca com 2 peças vira ruído
    var a = document.createElement('a');
    a.className = 'pill';
    a.href = 'catalogo.html?marca=' + encodeURIComponent(b.n);
    a.appendChild(document.createTextNode(b.n));
    var c = document.createElement('span');
    c.className = 'count';
    c.textContent = texto(b.c);
    a.appendChild(c);
    marcas.appendChild(a);
  });

  /* --- Vitrine ---------------------------------------------------------- */
  /* Cartao montado com createElement, nunca com innerHTML: titulo do Mercado
     Livre vem com aspas e sinal de maior no meio. */
  function cartao(it) {
    var a = document.createElement('a');
    a.className = 'card';
    a.href = 'peca/' + it.h + '.html';

    var media = document.createElement('div');
    media.className = 'card-media';
    var img = document.createElement('img');
    img.src = it.i;
    img.alt = it.t;
    img.loading = 'lazy';
    media.appendChild(img);

    var body = document.createElement('div');
    body.className = 'card-body';

    if (it.c) {
      var cat = document.createElement('div');
      cat.className = 'card-cat';
      cat.textContent = it.c;
      body.appendChild(cat);
    }

    var tit = document.createElement('div');
    tit.className = 'card-title';
    tit.textContent = it.t;
    body.appendChild(tit);

    if (it.b) {
      var fit = document.createElement('div');
      fit.className = 'card-fit';
      fit.textContent = it.b + (it.m ? ' ' + it.m : '');
      body.appendChild(fit);
    }

    var pre = document.createElement('div');
    pre.className = 'card-price';
    pre.textContent = window.izzatPreco(it.p);
    body.appendChild(pre);

    if (it.f) {
      var tag = document.createElement('span');
      tag.className = 'tag tag-free';
      tag.textContent = 'Frete grátis';
      body.appendChild(tag);
    }

    a.appendChild(media);
    a.appendChild(body);
    return a;
  }

  var grid = $('destaques');
  H.featured.forEach(function (it) { grid.appendChild(cartao(it)); });

  /* --- Números reais ---------------------------------------------------- */
  $('selTotal').textContent = texto(H.total) + ' peças';
  $('verTudo').textContent = 'Ver as ' + texto(H.total) + ' peças do catálogo';
})();
