/* ==========================================================================
   IZZAT CAR IMPORTS — script compartilhado do site inteiro.

   Carregado por TODAS as paginas (home, catalogo, veiculos e as ~3.981
   paginas de peca). E aqui que mora o Meta Pixel e o Google Analytics: quem
   abrir QUALQUER pagina do site ja entra no Pixel.

   Ficar aqui, e nao colado dentro de cada pagina, resolve dois problemas:
   1. As paginas de peca sao geradas do zero a cada atualizacao do catalogo —
      antes o Pixel era apagado junto e precisava ser reinjetado na mao.
   2. Trocar o ID do Pixel passa a ser mexer em UM arquivo.
   ========================================================================== */

(function () {
  'use strict';

  var META_PIXEL_ID = '2508976816257209';
  var GA_ID = 'G-M9W3R23RY9';
  var WHATS = '5553991170950';

  /* --- Google Analytics ------------------------------------------------ */
  var ga = document.createElement('script');
  ga.async = true;
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(ga);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_ID);

  /* --- Meta Pixel ------------------------------------------------------ */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', META_PIXEL_ID);
  fbq('track', 'PageView');

  /* Pagina de peca declara window.IZZAT_PRODUCT antes de carregar este script.
     Sem isso o Meta nao consegue otimizar a campanha por produto nem montar
     publico de quem viu peca cara. */
  var prod = window.IZZAT_PRODUCT;
  if (prod && prod.id) {
    fbq('track', 'ViewContent', {
      content_ids: [prod.id],
      content_name: prod.name,
      content_type: 'product',
      content_category: prod.category || undefined,
      value: prod.price,
      currency: 'BRL'
    });
    gtag('event', 'view_item', {
      currency: 'BRL',
      value: prod.price,
      items: [{ item_id: prod.id, item_name: prod.name, price: prod.price }]
    });
  }

  /* --- Eventos de intencao de compra ----------------------------------- */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';

    if (href.indexOf('wa.me') > -1 || href.indexOf('api.whatsapp') > -1) {
      var p = { content_name: (prod && prod.name) || document.title };
      if (prod && prod.id) { p.content_ids = [prod.id]; p.value = prod.price; p.currency = 'BRL'; }
      fbq('track', 'Contact', p);
      gtag('event', 'contato_whatsapp', { pagina: location.pathname });
    } else if (href.indexOf('mercadolivre.com') > -1 || href.indexOf('mercadolibre.com') > -1) {
      var m = { content_name: (prod && prod.name) || document.title };
      if (prod && prod.id) { m.content_ids = [prod.id]; m.value = prod.price; m.currency = 'BRL'; }
      fbq('track', 'InitiateCheckout', m);
      gtag('event', 'saida_mercado_livre', { pagina: location.pathname });
    }
  }, true);

  /* --- Utilidades de tela ---------------------------------------------- */
  function pronto(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  pronto(function () {
    var toggle = document.querySelector('.nav-toggle');
    var links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        var aberto = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
    }
  });

  /* Link de WhatsApp com mensagem pronta — usado pelo catalogo e pela peca. */
  window.izzatWhats = function (texto) {
    return 'https://wa.me/' + WHATS + '?text=' + encodeURIComponent(texto);
  };

  window.izzatPreco = function (v) {
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
})();
