// Prova das artes novas no site (r16): topo da página do carro, cartão do seletor "Meu carro" e abertura da home com o carro salvo.
// uso: node prova.cjs <base> "Marca|Modelo|chave" ...     (Chromium 1440x900 e WebKit 390x844; prints em ../prints)
const pw = require('/Users/izzat/wa-export/node_modules/playwright');
const real = require('/Users/izzat/Projects/izzatcar-wt/r15hero/ferramentas/navegacao/chromium-real.cjs');
const base = process.argv[2];
const carros = process.argv.slice(3).map((x) => x.split('|'));
const SAI = '/Users/izzat/Projects/izzatcar-wt/_r16carros/prints/';
let falhas = 0; const linhas = [];
const ok = (c, msg, extra = '') => { if (!c) falhas++; const l = (c ? '  ok  ' : '  FALHOU ') + msg + (c ? '' : ' ' + extra); linhas.push(l); console.log(l); };
const cls = (p) => p.evaluate(() => new Promise((r) => { let v = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => r(v), 400); })).catch(() => -1);
(async () => {
  for (const [motor, w, h, movel] of [['chromium', 1440, 900, false], ['webkit', 390, 844, true]]) {
    console.log(`== ${motor} ${w}x${h}`);
    const b = await pw[motor].launch(motor === 'chromium' ? real() : {});
    const novo = async (salvo) => {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: movel, deviceScaleFactor: movel ? 2 : 1 });
      await ctx.route(/google-analytics|googletagmanager/, (r) => r.abort());
      const p = await ctx.newPage(); p.erros = [];
      p.on('pageerror', (e) => { if (!/access control checks|Load failed|cancelled/i.test(e.message)) p.erros.push(e.message); });
      if (salvo) await p.addInitScript((c) => { if (!sessionStorage.getItem('posto')) { localStorage.setItem('izzatcar.meuCarro', JSON.stringify(c)); sessionStorage.setItem('posto', '1'); } }, salvo);
      return p;
    };
    for (const [marca, modelo, k] of carros) {
      const tag = `${k}-${movel ? 'cel' : 'pc'}`;
      // 1. página do carro (o modelo com poucas peças não tem página: fica só a home)
      {
        const p = await novo(null);
        const r = await p.goto(new URL(`/carros/${k}.html`, base).href, { waitUntil: 'load' });
        if (r && r.status() === 200) {
          await p.waitForTimeout(700);
          const e = await p.evaluate(() => { const i = document.querySelector('.topo-arte img'); if (!i) return null; const c = i.getBoundingClientRect(); const t = i.closest('.topo-arte').getBoundingClientRect();
            return { larg: i.naturalWidth, alt: i.naturalHeight, src: (i.currentSrc || '').split('/').pop(), caixa: [Math.round(c.width), Math.round(c.height)], topo: [Math.round(t.left), Math.round(t.top), Math.round(t.width), Math.round(t.height)], vw: innerWidth, og: document.querySelector('meta[property="og:image"]')?.content }; });
          ok(e && e.larg > 0 && e.src.startsWith(`carro-${k}`) && e.topo[0] >= 0 && e.topo[0] + e.topo[2] <= e.vw + 1, `${marca} ${modelo}: topo da página com a arte (${e ? e.src + ', ' + e.larg + ' px, caixa ' + e.caixa.join('x') : 'sem <img>'})`, JSON.stringify(e));
          ok(e && (e.og || '').includes(`carro-${k}.webp`), `   og:image = a arte do carro`, e && e.og);
          if (motor === 'chromium') { const v = await cls(p); ok(v >= 0 && v <= 0.01, `   CLS ${v.toFixed(4)}`); }
          ok(p.erros.length === 0, '   0 erros', p.erros.join(' | '));
          await p.screenshot({ path: `${SAI}${tag}-1-pagina.jpg`, type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: w, height: Math.min(h, movel ? 844 : 640) } });
        } else console.log(`  --   ${marca} ${modelo}: sem página própria (poucas peças), só a home`);
        await p.context().close();
      }
      // 2. home com o carro salvo (sem a chave: a arte vem da garagem): a abertura e o cartão do seletor
      {
        const p = await novo({ b: marca, m: modelo, y: null });
        await p.goto(base, { waitUntil: 'load' });
        const cartao = async () => p.evaluate(() => { const i = document.querySelector('[data-hero] img.mc-g-arte, [data-hero] [data-esq-arte]'); if (!i) return null; const c = i.getBoundingClientRect(); return { larg: i.naturalWidth, src: (i.currentSrc || '').split('/').pop(), caixa: [Math.round(c.width), Math.round(c.height)], visivel: c.width > 40 && getComputedStyle(i).visibility !== 'hidden' && getComputedStyle(i).display !== 'none' }; });
        let c = null; for (let i = 0; i < 60; i++) { c = await cartao(); if (c && c.larg > 0 && c.src.startsWith(`carro-${k}`)) break; await p.waitForTimeout(100); }
        ok(c && c.larg > 0 && c.visivel && c.src.startsWith(`carro-${k}`), `${marca} ${modelo}: cartão do seletor com a arte (${c ? c.src + ', caixa ' + c.caixa.join('x') : 'sem <img>'})`, JSON.stringify(c));
        const sel = p.locator('[data-mc-raiz][data-hero]').first();
        await sel.scrollIntoViewIfNeeded(); await p.waitForTimeout(250);
        await sel.screenshot({ path: `${SAI}${tag}-2-seletor.jpg`, type: 'jpeg', quality: 78 });
        if (movel) { await p.locator('[data-ab-palco]').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 120)); }
        const palco = async () => p.evaluate(() => { const pa = document.querySelector('[data-ab-palco]'); const i = document.querySelector('.ab-auto[data-on]'); return { estado: pa && pa.getAttribute('data-ab'), semArte: pa && pa.hasAttribute('data-ab-semarte'), palavra: document.querySelector('[data-ab-palavra]')?.textContent, arte: i ? { larg: i.naturalWidth, op: getComputedStyle(i).opacity, src: (i.currentSrc || '').split('/').pop() } : null }; });
        let e = null; for (let i = 0; i < 80; i++) { e = await palco(); if (e.arte && e.arte.larg > 0 && e.arte.op === '1' && e.arte.src.startsWith(`carro-${k}`)) break; await p.waitForTimeout(100); }
        ok(e.arte && e.arte.larg > 0 && e.arte.op === '1' && e.arte.src.startsWith(`carro-${k}`) && !e.semArte && e.palavra === modelo, `   abertura: ${e.arte ? e.arte.src + ' (' + e.arte.larg + ' px, opacidade ' + e.arte.op + ')' : 'sem arte'}, título "${e.palavra}"`, JSON.stringify(e));
        await p.waitForTimeout(1600);
        if (motor === 'chromium') { const v = await cls(p); ok(v >= 0 && v <= 0.01, `   CLS da home ${v.toFixed(4)}`); }
        ok(p.erros.length === 0, '   0 erros', p.erros.join(' | '));
        if (movel) await p.locator('[data-ab-palco]').screenshot({ path: `${SAI}${tag}-3-abertura.jpg`, type: 'jpeg', quality: 75 });
        else { await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: `${SAI}${tag}-3-abertura.jpg`, type: 'jpeg', quality: 75, clip: { x: 0, y: 0, width: w, height: 760 } }); }
        await p.context().close();
      }
    }
    await b.close();
  }
  require('fs').writeFileSync(SAI + '_prova.txt', linhas.join('\n') + `\n${falhas ? falhas + ' FALHA(S)' : 'TUDO CERTO'}\n`);
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO CERTO');
})();
