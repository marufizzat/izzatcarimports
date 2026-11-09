// Quadro do checkpoint 1 v2: 3 aberturas + pilotos (marcas, categorias, capas, carro, selo, banner).
const { chromium } = require('/Users/izzat/wa-export/node_modules/playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [saida, base = 'http://localhost:4321'] = process.argv.slice(2);
  fs.mkdirSync(saida, { recursive: true });
  const b = await chromium.launch();

  const tira = async (url, w, h, nome) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.goto(base + url, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(saida, nome) });
    await ctx.close();
  };

  for (const d of ['estudio', 'explodido', 'patio']) await tira(`/piloto-v2/${d}.html`, 1440, 860, `ab-${d}.png`);
  await tira('/piloto-v2/estudio.html', 390, 844, 'ab-celular.png');

  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(base + '/piloto-v2/estudio.html', { waitUntil: 'networkidle' });
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  });
  const els = await p.$$('section.secao');
  let n = 0;
  for (const el of els) {
    await el.scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    n += 1;
    await el.screenshot({ path: path.join(saida, `sec${n}.png`) });
  }
  await ctx.close();

  const img = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(saida, f)).toString('base64');
  const font = path.resolve('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2');
  const aberturas = [['estudio', 'A · Estúdio'], ['explodido', 'B · Carro explodido'], ['patio', 'C · Pátio impecável']]
    .map(([d, t]) => `<div class="c"><h2>${t}</h2><img src="${img('ab-' + d + '.png')}"></div>`).join('');
  const secoes = Array.from({ length: n }, (_, i) => `<div class="c"><img src="${img('sec' + (i + 1) + '.png')}"></div>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
  @font-face{font-family:A;src:url('file://${font}')}
  body{margin:0;padding:56px;background:#e9e9ed;font-family:A,sans-serif;color:#1d1d1f}
  h1{font-stretch:72%;font-weight:850;font-size:62px;margin:0}
  .sub{font-size:22px;color:#55555b;margin:6px 0 34px}
  .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .c{background:#fff;border-radius:24px;padding:18px;box-shadow:0 18px 44px -24px rgb(0 0 0/.35)}
  .c h2{font-stretch:78%;font-weight:840;font-size:30px;margin:4px 4px 12px}
  .c img{width:100%;border-radius:14px;display:block}
  .secs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}
  </style>
  <h1>Site v2 da Izzat Car — pilotos para escolher</h1>
  <p class="sub">Cenário sempre limpo · artes criadas no ChatGPT · peças com capa de estúdio · marcas com logo. Escolha a abertura (A, B ou C).</p>
  <div class="g3">${aberturas}</div>
  <div class="secs">${secoes}</div>`;
  fs.writeFileSync(path.join(saida, 'quadro.html'), html);
  const q = await b.newPage({ viewport: { width: 2400, height: 1400 } });
  await q.goto('file://' + path.join(saida, 'quadro.html'));
  await q.waitForTimeout(800);
  await q.screenshot({ path: path.join(saida, '_QUADRO-PILOTOS-V2.png'), fullPage: true });
  await b.close();
})();
