// A1+A2 no Chromium de verdade (CDP cru, prerender ligado): a transição chega na página nova? (pagereveal)
const { abrir, dorme } = require('./cdp-cru.cjs');
const INIT = `window.__vt=null;addEventListener('pagereveal',function(e){var v=e.viewTransition;window.__vt={tem:!!v,grupos:[]};if(v)v.ready.then(function(){window.__vt.grupos=[...new Set(document.getAnimations().map(function(a){return a.effect&&a.effect.pseudoElement}).filter(function(x){return x&&/group/.test(x)}).map(function(x){return x.replace(/::view-transition-group\\((.*)\\)/,'$1')}))]}).catch(function(x){window.__vt.erro=String(x)})});`;
(async () => {
  for (const [larg, alt] of [[390, 844], [1440, 900]]) {
    const c = await abrir({ largura: larg, altura: alt, escala: larg < 500 ? 2 : 1, init: INIT });
    for (const [nome, de, sel, n] of [['catalogo-peca', '/catalogo.html', '.cat-grade a.etiqueta', 2], ['carro-peca', '/carros/volvo-xc60.html', 'main a.etiqueta', 3], ['home-carro', '/', 'main a[href="/carros/volvo-xc60.html"]', 0], ['peca-peca', null, '.etiqueta-cx a.etiqueta', 0]]) {
      let url = de;
      if (!url) { await c.ir('http://127.0.0.1:4374/carros/volvo-xc60.html'); url = await c.ev(`document.querySelectorAll('main a.etiqueta')[5].getAttribute('href')`); }
      await c.ir('http://127.0.0.1:4374' + url); await dorme(1800);
      const b = await c.caixa(sel, n); await dorme(300);
      if (larg < 500) await c.toque(b.x, b.y, 250); else await c.mouse(b.x, b.y, 350);
      await c.espera(`location.pathname === ${JSON.stringify(b.href)} && document.readyState === 'complete'`); await dorme(900);
      const r = await c.ev(`JSON.stringify({ vt: window.__vt, pre: (performance.getEntriesByType('navigation')[0].activationStart || 0) > 0 })`);
      console.log(larg, nome, r);
    }
    await c.fechar();
  }
})().catch((e) => { console.log('ERRO', e.stack); process.exit(1); });
