// A2 — métrica com prerender de verdade (CDP cru): 1 visita = 1 page_view; a preparada e não aberta não mede nada.
// uso: RTT=0 BPS=1000000000 node proxy-lento.cjs 4376 http://127.0.0.1:4374 (o domínio de verdade cai no preview, o
// rastreio.js só mede nele) e node metrica2.cjs. GA e Pixel bloqueados na resolução de nomes: nada sai para Google/Meta.
const { abrir, dorme } = require('./cdp-cru.cjs');
const MAP = ['MAP izzatcarimports.com.br 127.0.0.1:4376', 'MAP www.googletagmanager.com ~NOTFOUND', 'MAP connect.facebook.net ~NOTFOUND',
  'MAP *.google-analytics.com ~NOTFOUND', 'MAP *.facebook.com ~NOTFOUND', 'MAP *.doubleclick.net ~NOTFOUND', 'MAP *.mlstatic.com ~NOTFOUND'].join(',');
const SITE = 'http://izzatcarimports.com.br';
const MEDIR = `(() => { const dl = (window.dataLayer || []).map((x) => [...x]); const fq = ((window.fbq && window.fbq.queue) || []).map((x) => [...x]);
  const nav = performance.getEntriesByType('navigation')[0] || {};
  return { config: dl.filter((x) => x[0] === 'config').length, eventos: dl.filter((x) => x[0] === 'event').map((x) => x[1] + (x[2] && x[2].botao ? ':' + x[2].botao : '')),
    pixel: fq.filter((x) => x[0] === 'track').map((x) => x[1]), prerender: (nav.activationStart || 0) > 0, ativ: Math.round(nav.activationStart || 0), url: location.pathname.slice(0, 40) }; })()`;
(async () => {
  const out = {};
  for (const [nome, larg, alt] of [['celular', 390, 844], ['pc', 1440, 900]]) {
    const c = await abrir({ largura: larg, altura: alt, escala: larg < 500 ? 2 : 1, args: ['--host-resolver-rules=' + MAP] });
    const pre = []; c.on((d) => { if (d.method === 'Preload.prerenderStatusUpdated') pre.push(d.params.status + ' ' + (d.params.prerenderStatus || '') + ' ' + d.params.key.url.split('/').pop().slice(0, 24)); });
    const r = {};
    if (nome === 'celular') {
      await c.ir(SITE + '/catalogo.html'); await dorme(2500);
      r.catalogo = await c.ev(MEDIR);
      const cx = await c.caixa('.cat-grade a.etiqueta', 1); await dorme(400);
      await c.toque(cx.x, cx.y, 250);
      await c.espera(`location.pathname === ${JSON.stringify(cx.href)} && document.readyState === 'complete'`); await dorme(1200);
      r.peca = await c.ev(MEDIR);
      r.pecaWhats = await c.ev(`(() => { const a = [...document.querySelectorAll('a.botao[href*="wa.me"]')].find((x) => x.offsetParent); a.addEventListener('click', (e) => e.preventDefault()); a.click(); return ${MEDIR}; })()`);
    } else {
      await c.ir(SITE + '/carros/volvo-xc60.html'); await dorme(2500);
      for (const i of [0, 1]) { const b = await c.caixa('main a.etiqueta', i); await c.input('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y }); await dorme(1500); }
      r.preparadas = [];
      for (const [sid, p] of c.paginas) if (p.subtype === 'prerender') r.preparadas.push(await c.ev(`JSON.stringify({ prerendering: document.prerendering, config: (window.dataLayer || []).filter((x) => x[0] === 'config').length, pixel: ((window.fbq && window.fbq.queue) || []).length, url: location.pathname.slice(0, 28) })`, sid).catch((e) => 'erro ' + e.message.slice(0, 40)));
      const b3 = await c.caixa('main a.etiqueta', 2); await c.mouse(b3.x, b3.y, 400);
      await c.espera(`location.pathname === ${JSON.stringify(b3.href)} && document.readyState === 'complete'`); await dorme(1200);
      r.peca = await c.ev(MEDIR);
    }
    r.prerenders = pre; out[nome] = r;
    await c.fechar();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.log('ERRO', e.stack); process.exit(1); });
