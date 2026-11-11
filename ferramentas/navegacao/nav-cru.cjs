// A3 — do toque até a página nova pintada, no Chromium de verdade (CDP cru: o prerender acontece), 4G lento (proxy 4375)
// e CPU 4× (também na página preparada). Com e sem o prerender (--disable-features=Prerender2 = como antes, só a transição).
// uso (preview na 4374 e o proxy lento na 4375: node proxy-lento.cjs 4375 http://127.0.0.1:4374):
//   MODOS=como-antes,sem-prerender,com-prerender node nav-cru.cjs <rótulo> [rodadas]   (SO=<cena>, VP=390|1440)
const fs = require('fs');
const { abrir, dorme } = require('./cdp-cru.cjs');
const ROT = process.argv[2] || 'x'; const N = Number(process.argv[3] || 3);
const BASE = 'http://127.0.0.1:4375'; const SO = process.env.SO;
const CENAS = {
  'catalogo-peca': ['/catalogo.html', '.cat-grade a.etiqueta', 0],
  'home-carro': ['/', 'main a[href="/carros/volvo-xc60.html"]', 0],
  'carro-peca': ['/carros/volvo-xc60.html', 'main a.etiqueta', 0],
};
const ANTES = `(() => { addEventListener('pointerdown', (e) => sessionStorage.setItem('__toque', String(performance.timeOrigin + e.timeStamp)), { capture: true, once: true });
  window.__loaf = []; try { new PerformanceObserver((l) => l.getEntries().forEach((x) => window.__loaf.push(Math.round(x.duration)))).observe({ type: 'long-animation-frame' }); } catch (e) {}
  addEventListener('pagehide', () => sessionStorage.setItem('__loafVelha', JSON.stringify(window.__loaf))); return 1; })()`;
const DEPOIS = `(async () => { const nav = performance.getEntriesByType('navigation')[0] || {};
  const pegar = (type) => new Promise((ok) => { const xs = []; try { new PerformanceObserver((l) => xs.push(...l.getEntries())).observe({ type, buffered: true }); } catch (e) {} setTimeout(() => ok(xs), 60); });
  const lcp = await pegar('largest-contentful-paint'); const loaf = await pegar('long-animation-frame');
  const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime;
  const ativ = nav.activationStart || 0; const u = lcp[lcp.length - 1]; const revela = Math.max(ativ, fcp || 0);
  return { toque: Number(sessionStorage.getItem('__toque')), origem: performance.timeOrigin, ativ, fcp, lcp: u ? u.startTime : null,
    lcpEl: u && u.element ? u.element.tagName + '.' + [...u.element.classList].slice(0, 2).join('.') : '',
    loafTransicao: loaf.filter((x) => x.startTime + x.duration > revela && x.startTime < revela + 600).map((x) => Math.round(x.duration)),
    loafVelha: JSON.parse(sessionStorage.getItem('__loafVelha') || '[]') }; })()`;
(async () => {
  const res = {};
  for (const modo of (process.env.MODOS || 'sem-prerender,com-prerender').split(',')) for (const [larg, alt] of (process.env.VP === '1440' ? [[1440, 900]] : process.env.VP === '390' ? [[390, 844]] : [[390, 844], [1440, 900]])) for (const [cena, [de, sel, n]] of Object.entries(CENAS).filter(([k]) => !SO || k === SO)) {
    const k = `${modo}-${larg}-${cena}`; res[k] = [];
    for (let i = 0; i < N; i++) {
      const c = await abrir({ largura: larg, altura: alt, escala: larg < 500 ? 2 : 1, cpu: 4, args: modo === 'sem-prerender' ? ['--disable-features=Prerender2'] : modo === 'como-antes' ? ['--disable-features=Prerender2', '--force-prefers-reduced-motion'] : [] });
      try {
        await c.ir(BASE + de); await dorme(3000);
        const b = await c.caixa(sel, n); await dorme(700);
        await c.ev(ANTES);
        if (larg < 500) await c.toque(b.x, b.y, 120); else await c.mouse(b.x, b.y, 300);
        await c.espera(`location.pathname === ${JSON.stringify(b.href)} && document.readyState === 'complete'`, 60000); await dorme(1500);
        const m = await c.ev(DEPOIS);
        m.msFcp = m.fcp != null ? Math.round(m.origem + Math.max(m.fcp, m.ativ) - m.toque) : null;
        m.msLcp = m.lcp != null ? Math.round(m.origem + Math.max(m.lcp, m.ativ) - m.toque) : null;
        m.pre = m.ativ > 0;
        res[k].push(m);
        console.log(k, i, `FCP ${m.msFcp} LCP ${m.msLcp} (${m.lcpEl}) prerender ${m.pre} loafTrans [${m.loafTransicao}] loafVelha [${m.loafVelha}]`);
      } catch (e) { console.log(k, i, 'ERRO', e.message.slice(0, 100)); res[k].push({ erro: e.message }); }
      await c.fechar();
    }
    const med = (f) => { const v = res[k].map(f).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    console.log('==>', k, 'mediana FCP', med((m) => m.msFcp), 'LCP', med((m) => m.msLcp));
  }
  fs.writeFileSync(`nav-cru-${ROT}.json`, JSON.stringify(res, null, 1));
})();
