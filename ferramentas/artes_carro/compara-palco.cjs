// Palco da abertura lado a lado: uma arte que já estava x artes novas (emenda com o estúdio, corte, tom).
const pw = require('/Users/izzat/wa-export/node_modules/playwright');
const real = require('/Users/izzat/Projects/izzatcar-wt/r15hero/ferramentas/navegacao/chromium-real.cjs');
(async () => {
  const b = await pw.chromium.launch(real());
  for (const [marca, modelo, k] of process.argv.slice(3).map((x) => x.split('|'))) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/google-analytics|googletagmanager/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.addInitScript((c) => localStorage.setItem('izzatcar.meuCarro', JSON.stringify(c)), { b: marca, m: modelo, y: null });
    await p.goto(process.argv[2], { waitUntil: 'load' });
    await p.waitForFunction(() => { const i = document.querySelector('.ab-auto[data-on]'); return i && i.naturalWidth > 0 && getComputedStyle(i).opacity === '1'; }, null, { timeout: 8000 });
    await p.waitForTimeout(1800);
    await p.screenshot({ path: `/Users/izzat/Projects/izzatcar-wt/_r16carros/prints/_palco-${k}.jpg`, type: 'jpeg', quality: 80, clip: { x: 690, y: 85, width: 750, height: 815 } });
    await ctx.close();
  }
  await b.close();
})();
