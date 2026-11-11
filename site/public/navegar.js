/* IZZAT CAR — navegar como aplicativo (toda página; o <head> de Base.astro chama com defer).
   1) A foto do cartão tocado "voa" e vira a capa da página da peça (transição entre páginas do global.css: Chrome/Edge
      126+ e Safari 18.2+; quem não tem navega como antes). O nome da transição vai SÓ no cartão tocado (dois iguais
      cancelam tudo); a capa do palco da peça ganha o nome pelo CSS, só durante a troca. Aparelho fraco (html.leve):
      sem transição.
   2) A próxima página já carregada: o Chrome segue as regras <script type="speculationrules"> do <head> (prerender);
      quem não faz prerender (Safari, Firefox) baixa o HTML no toque (pointerdown/touchstart, ~100 ms antes do clique),
      2 por vez no máximo, nunca com economia de dados nem em html.leve. */
(function () {
  'use strict';
  var raiz = document.documentElement;
  var leve = function () { return raiz.classList.contains('leve'); };

  /* 1) a foto que voa */
  var marcado = null;
  var palco = function () { return document.querySelector('.galeria-palco'); };
  function soltar() {
    if (marcado) { marcado.style.viewTransitionName = ''; marcado = null; }
    var p = palco(); if (p) p.style.viewTransitionName = '';
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a.etiqueta') : null;
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var foto = a.querySelector('.etiqueta-foto');
    if (!foto) return;
    soltar();
    // na página da peça ("Do mesmo carro"): a capa desta peça sai da transição, quem voa é o cartão
    var p = palco(); if (p) p.style.viewTransitionName = 'none';
    foto.style.viewTransitionName = 'foto-peca';
    marcado = foto;
  });
  addEventListener('pageswap', function (e) {
    var vt = e.viewTransition; if (!vt) return;
    // troca pulada (aparelho fraco, ou o navegador desistiu) não vira erro no console
    var nada = function () {}; vt.ready.catch(nada); vt.updateCallbackDone.catch(nada);
    if (leve()) vt.skipTransition();
  });
  // voltou pelo bfcache: depois da volta (a foto pode voar de volta para o cartão), tudo como antes
  addEventListener('pageshow', function (e) { if (e.persisted) setTimeout(soltar, 400); });

  /* 2) o HTML da próxima página no toque, só onde não há prerender (document.prerendering existe só no Chrome/Edge) */
  var con = navigator.connection;
  if ('prerendering' in document || leve() || (con && con.saveData) || !window.fetch) return;
  var DESTINO = /^\/(peca\/|carros\/|carros\.html$|categoria\/|marca\/|catalogo\.html$)/;
  var feitos = {}, andando = 0;
  function pre(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin || !DESTINO.test(a.pathname)) return;
    var u = a.pathname + a.search;
    if (feitos[u] || andando >= 2 || u === location.pathname + location.search) return;
    feitos[u] = 1; andando++;
    fetch(u, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) feitos[u] = 0; return r.arrayBuffer(); })
      .catch(function () { feitos[u] = 0; }).then(function () { andando--; });
  }
  addEventListener('touchstart', pre, { passive: true, capture: true });
  addEventListener('pointerdown', pre, { passive: true, capture: true });
})();
