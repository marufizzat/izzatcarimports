// Monta o quadro comparativo das 3 direcoes (primeira dobra no PC e no celular).
const { chromium, devices } = require('/Users/izzat/wa-export/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [saida] = process.argv.slice(2);
  fs.mkdirSync(saida, { recursive: true });
  const b = await chromium.launch();
  for (const d of ['a', 'b', 'c']) {
    for (const [nome, opts] of [['pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }],
                                ['celular', { ...devices['iPhone 13'] }]]) {
      const ctx = await b.newContext(opts); const p = await ctx.newPage();
      await p.goto(`http://localhost:4321/direcoes/${d}.html`, { waitUntil: 'networkidle' });
      await p.evaluate(() => Promise.all([...document.querySelectorAll('video')].map(v => { v.currentTime = 2.2; return new Promise(r => { v.onseeked = r; setTimeout(r, 1500); }); })));
      await p.waitForTimeout(1200);
      await p.screenshot({ path: `${saida}/${d}-${nome}-dobra.png` });
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); } window.scrollTo(0, 0); });
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${saida}/${d}-${nome}-inteira.png`, fullPage: true });
      await ctx.close();
    }
  }
  await b.close();
})();
