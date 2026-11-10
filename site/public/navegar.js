/* IZZAT CAR — navegar como aplicativo (toda página; o <head> de Base.astro chama com defer).
   1) A foto do cartão tocado "voa" e vira a capa da página da peça (transição entre páginas do global.css: Chrome/Edge
      126+ e Safari 18.2+; quem não tem navega como antes). O nome da transição vai SÓ no cartão tocado (dois iguais
      cancelam tudo); a capa do palco da peça ganha o nome pelo CSS, só durante a troca. Aparelho fraco (html.leve):
      sem transição. */
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
})();
