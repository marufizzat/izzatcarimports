// Bateria de QA: modelos de pagina + 60 pecas, de 320 a 1920 px, claro e escuro.
// Uso: node scripts/qa.cjs <saida> [base=http://localhost:4321]
const { chromium, devices } = require('/Users/izzat/wa-export/node_modules/playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const [saida, base = 'http://localhost:4321'] = process.argv.slice(2);
  fs.mkdirSync(path.join(saida, 'telas'), { recursive: true });
  const pecas = JSON.parse(fs.readFileSync('src/data/pecas.json', 'utf-8'));
  // amostra variada: nº de fotos 1..12, titulos longos, sem modelo, com/sem descricao
  const am = new Map();
  for (const n of [1, 2, 3, 5, 7, 9, 11, 12]) pecas.filter((p) => p.fotos.length === n).slice(0, 4).forEach((p) => am.set(p.id, p));
  [...pecas].sort((a, b) => b.t.length - a.t.length).slice(0, 8).forEach((p) => am.set(p.id, p));
  [...pecas].sort((a, b) => b.n.length - a.n.length).slice(0, 6).forEach((p) => am.set(p.id, p));
  pecas.filter((p) => !p.m).slice(0, 5).forEach((p) => am.set(p.id, p));
  pecas.filter((p) => !p.desc).slice(0, 4).forEach((p) => am.set(p.id, p));
  [...pecas].sort((a, b) => b.p - a.p).slice(0, 3).forEach((p) => am.set(p.id, p));
  const amostra = [...am.values()].slice(0, 60).map((p) => `/peca/${p.slug}.html`);
  const modelos = ['/index.html', '/catalogo.html', '/catalogo.html?q=farol%20compass', '/catalogo.html?marca=Volvo&modelo=XC60&ano=2020',
    '/catalogo.html?q=zzzqqq', '/carros.html', '/carros/volvo-xc60.html', '/marca/volvo.html', '/categoria/iluminacao.html',
    '/como-comprar.html', '/garantia.html', '/envios.html', '/sobre.html', '/contato.html', '/procuro-peca.html', '/404.html', amostra[0]];
  const telas = [[320, 640], [360, 760], [390, 844], [414, 896], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]];
  const b = await chromium.launch();
  const rel = [];
  async function testar(u, w, h, esquema, foto) {
    const movel = w < 900 && h > w || w <= 844 && h <= 390;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: foto && w < 900 ? 2 : 1, colorScheme: esquema,
      isMobile: movel, hasTouch: movel, userAgent: movel ? devices['iPhone 13'].userAgent : undefined, reducedMotion: 'reduce' });
    const p = await ctx.newPage(); const erros = [];
    p.on('pageerror', (e) => erros.push('JS: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/mlstatic|ERR_CONNECTION|QUIC|net::ERR/.test(m.text())) erros.push('console: ' + m.text().slice(0, 140)); });
    p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) erros.push(`HTTP ${r.status()} ${r.url().replace(base, '')}`); });
    try { await p.goto(base + u, { waitUntil: 'load', timeout: 45000 }); } catch (e) { erros.push('goto ' + e.message.slice(0, 80)); }
    await p.waitForTimeout(600);
    await p.evaluate(async () => { const H = Math.min(document.body.scrollHeight, 30000); for (let y = 0; y < H; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
    await p.waitForTimeout(700);
    const m = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const fora = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        if (el.closest('dialog:not([open]), [hidden], .barra-compra, [aria-hidden="true"]')) continue;
        let anc = el.parentElement, rola = false;
        while (anc && anc !== document.body) { const o = getComputedStyle(anc).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { rola = true; break; } anc = anc.parentElement; }
        if (rola) continue;
        const r = el.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) fora.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} (${Math.round(r.left)}→${Math.round(r.right)})`);
      }
      const proprias = [...document.images].filter((i) => !/mlstatic/.test(i.src));
      return { vw, sw: document.documentElement.scrollWidth, fora: fora.slice(0, 5),
        quebradas: proprias.filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.src.replace(location.origin, '')).slice(0, 5),
        h1: document.querySelectorAll('h1').length, titulo: document.title };
    });
    if (foto) await p.screenshot({ path: path.join(saida, 'telas', `${u.replace(/\W+/g, '_').slice(0, 60)}-${w}x${h}-${esquema}.png`), fullPage: true });
    rel.push({ u, w, h, esquema, ...m, erros: [...new Set(erros)].slice(0, 5), ok: m.sw <= m.vw && !m.fora.length && !m.quebradas.length && !erros.length && m.h1 === 1 });
    await ctx.close();
  }
  const fila = [];
  for (const u of modelos) for (const [w, h] of telas) for (const esq of ['light', 'dark']) {
    const foto = (w === 390 || w === 1440) && (esq === 'light' || u === '/index.html' || u.startsWith('/peca/'));
    fila.push([u, w, h, esq, foto]);
  }
  for (const u of amostra) for (const [w, h] of [[320, 640], [390, 844], [1024, 768], [1440, 900]]) fila.push([u, w, h, 'light', false]);
  let i = 0;
  const trabalhador = async () => { while (i < fila.length) { const t = fila[i++]; await testar(...t); if (i % 50 === 0) console.log('..', i, '/', fila.length); } };
  await Promise.all(Array.from({ length: 6 }, trabalhador));
  fs.writeFileSync(path.join(saida, 'relatorio.json'), JSON.stringify(rel, null, 1));
  const ruins = rel.filter((r) => !r.ok);
  console.log(`${rel.length} testes | ${rel.length - ruins.length} ok | ${ruins.length} com problema`);
  const agrup = {};
  for (const r of ruins) { const k = r.u.startsWith('/peca/') ? '/peca/*' : r.u; (agrup[k] ||= []).push(`${r.w}x${r.h} ${r.esquema}: ${r.sw > r.vw ? `ESTOURO ${r.sw}/${r.vw} ` : ''}${r.fora.join(' ')} ${r.quebradas.join(' ')} ${r.erros.join(' | ')} ${r.h1 !== 1 ? 'H1=' + r.h1 : ''}`); }
  for (const [k, v] of Object.entries(agrup)) { console.log('\n' + k + ` (${v.length})`); [...new Set(v)].slice(0, 6).forEach((x) => console.log('  ' + x)); }
  await b.close();
})();
