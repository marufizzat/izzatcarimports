/* IZZAT CAR — GA4 + Meta Pixel do site inteiro (mesmos IDs do site antigo).
   Carrega depois da pagina pronta, pra nao atrasar a primeira tela.
   Pagina de peca declara window.IZZAT_PRODUCT antes deste arquivo. */
(function () {
  'use strict';
  /* So mede no dominio de verdade: preview local e testes nao sujam o GA/Pixel. */
  if (!/(^|\.)izzatcarimports\.com\.br$/.test(location.hostname)) {
    window.izzatBusca = function () {};
    return;
  }
  /* Página preparada de antemão (prerender do Chrome, regras de especulação do Base.astro): nada é medido até a pessoa
     abrir a página de verdade (1 visita = 1 page_view). A busca que o catálogo mandar antes disso espera na fila. */
  if (document.prerendering) {
    var fila = [];
    window.izzatBusca = function (termo) { fila.push(termo); };
    document.addEventListener('prerenderingchange', function () { iniciar(); fila.forEach(function (t) { window.izzatBusca(t); }); }, { once: true });
  } else iniciar();

  function iniciar() {
  var META_PIXEL_ID = '2508976816257209';
  var GA_ID = 'G-M9W3R23RY9';
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  gtag('js', new Date()); gtag('config', GA_ID);
  fbq('init', META_PIXEL_ID); fbq('track', 'PageView');

  function carregarGA() { var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID; document.head.appendChild(s); }
  if ('requestIdleCallback' in window) requestIdleCallback(carregarGA, { timeout: 2500 }); else setTimeout(carregarGA, 1200);

  /* Peca vendida: o link velho de uma peca que saiu do site (a 404 de /peca/<slug>-<MLB>.html guarda o MLB) */
  if (window.IZZAT_VENDIDA) gtag('event', 'peca_vendida', { mlb: window.IZZAT_VENDIDA, pagina: location.pathname });

  var prod = window.IZZAT_PRODUCT;
  if (prod && prod.id) {
    fbq('track', 'ViewContent', { content_ids: [prod.id], content_name: prod.name, content_type: 'product',
      content_category: prod.category || undefined, value: prod.price, currency: 'BRL' });
    gtag('event', 'view_item', { currency: 'BRL', value: prod.price, items: [{ item_id: prod.id, item_name: prod.name, price: prod.price }] });
  }
  /* Busca (catalogo e topo): o catalogo chama window.izzatBusca(termo) */
  window.izzatBusca = function (termo) {
    if (!termo) return;
    fbq('track', 'Search', { search_string: termo });
    gtag('event', 'search', { search_term: termo });
  };
  /* Contact = qualquer link de WhatsApp. InitiateCheckout = SO botao de compra
     no Mercado Livre (data-compra), nao o link do perfil da loja.
     O evento contato_whatsapp sai SEMPRE (com ou sem data-botao: a conversao do Google Ads depende dele).
     O botao do evento: data-botao quando o link tem (ex.: "procurar-patio" no catalogo); o "Pedir no WhatsApp" do cartao
     (a.etiqueta-acao) sem o atributo conta como "pedir-cartao" (o mesmo valor dos cartoes que ja levam o atributo);
     senao o texto do link. */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var base = { content_name: (prod && prod.name) || document.title };
    if (prod && prod.id) { base.content_ids = [prod.id]; base.value = prod.price; base.currency = 'BRL'; }
    if (href.indexOf('wa.me') > -1 || href.indexOf('api.whatsapp') > -1) {
      fbq('track', 'Contact', base);
      gtag('event', 'contato_whatsapp', { pagina: location.pathname, botao: a.getAttribute('data-botao') || (/(^|\s)etiqueta-acao(\s|$)/.test(a.className || '') ? 'pedir-cartao' : '') || (a.textContent || '').trim().slice(0, 40) || 'icone' });
    } else if (a.hasAttribute('data-compra')) {
      fbq('track', 'InitiateCheckout', base); gtag('event', 'saida_mercado_livre', { pagina: location.pathname });
    }
  }, true);
  /* Lista de orcamento (lib/lista.ts): peca posta na lista (origem: 'peca' ou 'vai-junto') */
  window.addEventListener('lista', function (e) {
    var d = e && e.detail; if (!d || d.acao !== 'adicionar') return;
    gtag('event', 'lista_adicionar', { mlb: d.id, origem: d.origem || undefined, pagina: location.pathname });
  });
  /* App (components/app/app.ts): o convite para instalar, aceito ou dispensado (onde: chrome, faixa ou ios) */
  window.addEventListener('app-instalar', function (e) {
    var d = e && e.detail; if (!d || !d.resultado) return;
    gtag('event', 'app_instalar', { resultado: d.resultado, onde: d.onde || undefined, pagina: location.pathname });
  });
  /* Meu carro: qual carro o cliente escolheu (so marca/modelo/ano, nada pessoal) */
  window.addEventListener('meu-carro', function (e) {
    var c = e && e.detail; if (!c || !c.b) return;
    gtag('event', 'meu_carro', { marca: c.b, modelo: c.m, ano: c.y || undefined });
  });
  }
})();
