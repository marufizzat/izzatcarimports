// Grava um passeio real pelo site no tamanho de um iPhone. Uso: node video-navegacao.cjs <saida_dir>
const { chromium, devices } = require('/Users/izzat/wa-export/node_modules/playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [saida] = process.argv.slice(2); fs.mkdirSync(saida, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, recordVideo: { dir: saida, size: { width: 390, height: 844 } } });
  const p = await ctx.newPage(); const base = 'http://localhost:4321';
  const rolar = async (px, passos = 24) => { for (let i = 0; i < passos; i++) { await p.mouse.wheel(0, px / passos); await p.waitForTimeout(28); } };
  await p.goto(base + '/index.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
  await rolar(900); await p.waitForTimeout(900); await rolar(1600); await p.waitForTimeout(900); await rolar(1400); await p.waitForTimeout(900);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await p.waitForTimeout(1400);
  const campo = p.locator('input[type="search"]').first(); await campo.click(); await p.waitForTimeout(900);
  await campo.type('farol compass', { delay: 110 }); await p.waitForTimeout(2200);
  await p.keyboard.press('Enter'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000);
  await rolar(700); await p.waitForTimeout(800);
  const filtros = p.getByRole('button', { name: /Filtros/ }).first();
  if (await filtros.count()) { await filtros.click(); await p.waitForTimeout(1600); await p.keyboard.press('Escape'); await p.waitForTimeout(900); }
  await p.locator('a.etiqueta').first().click(); await p.waitForLoadState('networkidle'); await p.waitForTimeout(2000);
  await p.locator('.galeria-trilho').first().evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: 'smooth' })); await p.waitForTimeout(1300);
  await p.locator('.galeria-trilho img').nth(1).click(); await p.waitForTimeout(1800);
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  await rolar(1100); await p.waitForTimeout(1200); await rolar(900); await p.waitForTimeout(1000);
  await p.goto(base + '/carros/volvo-xc60.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(1800); await rolar(1200); await p.waitForTimeout(1200);
  await p.goto(base + '/sobre.html', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500); await rolar(1500); await p.waitForTimeout(1500);
  const v = await p.video().path(); await ctx.close(); await b.close();
  fs.renameSync(v, path.join(saida, 'passeio.webm')); console.log(path.join(saida, 'passeio.webm'));
})();
