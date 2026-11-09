// Uso: node fotografar.cjs <saida_dir> <url1,url2,...> [larguras=390,1440] [fullpage=1]
const { chromium, devices } = require('/Users/izzat/wa-export/node_modules/playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [saida, urls, larg = '390,1440', full = '1'] = process.argv.slice(2);
  fs.mkdirSync(saida, { recursive: true });
  const b = await chromium.launch();
  const rel = [];
  for (const w of larg.split(',').map(Number)) {
    const movel = w < 768;
    const ctx = await b.newContext(movel ? { ...devices['iPhone 13'], viewport: { width: w, height: 844 } }
                                         : { viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    for (const u of urls.split(',')) {
      const p = await ctx.newPage(); const erros = [];
      p.on('pageerror', e => erros.push(e.message));
      p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
      p.on('requestfailed', r => erros.push('FALHOU ' + r.url().slice(0, 90)));
      await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => erros.push('goto ' + e.message));
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await p.waitForTimeout(900);
      const m = await p.evaluate(() => ({ vw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, h: document.body.scrollHeight,
        quebradas: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(0, 80)) }));
      const nome = path.join(saida, `${((new URL(u).pathname + new URL(u).search).replace(/\W+/g, '_') || 'home')}-${w}.png`);
      await p.screenshot({ path: nome, fullPage: full === '1' });
      rel.push({ url: u, w, ...m, estouro: m.sw > m.vw, erros: [...new Set(erros)].slice(0, 6), arquivo: nome });
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  for (const r of rel) console.log(JSON.stringify({ url: r.url.replace(/^https?:\/\/[^/]+/, ''), w: r.w, h: r.h, estouro: r.estouro, quebradas: r.quebradas.length, erros: r.erros }));
})();
