// Abertura da home: a arte do carro NO PALCO em todos os caminhos (CLAUDE.md, item 16) — nascer com o carro salvo (com e sem
// a chave da arte, com e sem ano), modelo sem arte, escolher, trocar, esquecer e escolher outro, voltar pelo histórico,
// apelido de carro unido. Confere naturalWidth > 0 e opacidade 1 (o estado sozinho não basta: já passou com o palco vazio).
// uso (com o preview no ar): node scripts/abertura-arte.cjs http://localhost:4321/
const pw = require('/Users/izzat/wa-export/node_modules/playwright');
// o Chromium do Playwright para de pintar depois de uma troca de página com transição: religar o PaintHolding (CLAUDE.md)
const real = require('../../ferramentas/navegacao/chromium-real.cjs');
const base = process.argv[2];
let falhas = 0;
const ok = (c, msg, extra = '') => { if (!c) falhas++; console.log((c ? '  ok  ' : '  FALHOU ') + msg + (c ? '' : ' ' + extra)); };
const estadoArte = (p) => p.evaluate(() => {
  const palco = document.querySelector('[data-ab-palco]'); if (!palco || !document.querySelector('[data-ab-palavra]')) return { arte: null, cedo: true }; const i = document.querySelector('.ab-auto[data-on]');
  const at = [...document.querySelectorAll('.ab-p[data-slot]')].filter((li) => li.classList.contains('ab-on'));
  const rp = palco.getBoundingClientRect();
  const ys = at.map((li) => { const r = li.getBoundingClientRect(); return (r.top + r.height / 2 - rp.top) / rp.height; });
  return { estado: palco.getAttribute('data-ab'), semArte: palco.hasAttribute('data-ab-semarte'), dorme: palco.hasAttribute('data-ab-dorme'),
    arte: i ? { larg: i.naturalWidth, op: getComputedStyle(i).opacity, src: (i.currentSrc || '').split('/').pop(), caixa: Math.round(i.getBoundingClientRect().width) } : null,
    atalhos: at.length, comImagem: at.filter((li) => li.querySelector('img.ab-img').naturalWidth > 0).length, yMedio: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null,
    palavra: document.querySelector('[data-ab-palavra]').textContent };
});
/** espera a arte `chave` carregada e à vista; devolve os ms desde `t0` (ou null) */
async function esperaArte(p, chave, t0, limite = 6000) {
  while (Date.now() - t0 < limite) {
    const e = await estadoArte(p);
    if (e.arte && e.arte.larg > 0 && e.arte.op === '1' && e.arte.src.includes(chave)) return Date.now() - t0;
    await p.waitForTimeout(50);
  }
  return null;
}
(async () => {
  for (const [motor, w, h, movel] of [['chromium', 1440, 900, false], ['chromium', 360, 640, true], ['webkit', 390, 844, true]]) {
    console.log(`== ${motor} ${w}x${h}`);
    const b = await pw[motor].launch(motor === 'chromium' ? real() : {});
    const novo = async (salvo) => {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: movel, isMobile: movel && motor === 'chromium', deviceScaleFactor: movel ? 2 : 1 });
      const p = await ctx.newPage(); p.erros = []; p.on('pageerror', (e) => { if (!/access control checks|Load failed|cancelled/i.test(e.message)) p.erros.push(e.message); });
      if (salvo) await p.addInitScript((c) => { if (!sessionStorage.getItem('posto')) { localStorage.setItem('izzatcar.meuCarro', JSON.stringify(c)); sessionStorage.setItem('posto', '1'); } }, salvo);
      return p;
    };
    const aoPalco = async (p) => { if (movel) { await p.locator('[data-ab-palco]').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 120)); } };
    const cls = (p) => p.evaluate(() => new Promise((ok) => { let v = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: 'layout-shift', buffered: true }); setTimeout(() => ok(v), 300); })).catch(() => 0);

    // 1. nascer com o carro salvo: com a chave da arte, SEM a chave (salvo por outra página), com e sem ano
    for (const [rot, c, chave, palavra] of [
      ['salvo com a chave da arte (Onix 2019)', { b: 'Chevrolet', m: 'Onix', y: 2019, a: 'chevrolet-onix', as: [600, 900, 1200] }, 'carro-chevrolet-onix', 'Onix 2019'],
      ['salvo SEM a chave, com ano (XC60 2019)', { b: 'Volvo', m: 'XC60', y: 2019 }, 'carro-volvo-xc60', 'XC60 2019'],
      ['salvo SEM a chave, sem ano (XC60)', { b: 'Volvo', m: 'XC60', y: null }, 'carro-volvo-xc60', 'XC60'],
    ]) {
      const p = await novo(c); const t0 = Date.now();
      await p.goto(base, { waitUntil: 'commit' });
      if (movel) { await p.waitForLoadState('load'); await aoPalco(p); }
      const t1 = movel ? Date.now() : t0;
      const ms = await esperaArte(p, chave, t1);
      ok(ms != null && (movel || ms <= 1500), `nascer ${rot}: arte carregada e à vista em ${ms} ms${movel ? ' depois de o palco entrar na tela' : ' (limite 1.500)'}`, JSON.stringify(await estadoArte(p)));
      await p.waitForTimeout(1500);
      const e = await estadoArte(p);
      ok(e.palavra === palavra && e.atalhos >= 3 && e.comImagem === e.atalhos && !e.semArte, `   título "${e.palavra}", ${e.atalhos} atalhos com imagem`, JSON.stringify(e));
      if (motor === 'chromium') { const v = await cls(p); ok(v <= 0.01, `   CLS ${v.toFixed(4)}`); }
      ok(p.erros.length === 0, '   0 erros', p.erros.join(' | ')); await p.context().close();
    }
    // 2. carro SEM arte própria: o desenho "sem carro" (atalhos grandes no meio), nunca um buraco
    {
      const p = await novo({ b: 'Volkswagen', m: 'Voyage', y: null }); await p.goto(base, { waitUntil: 'load' }); await aoPalco(p); await p.waitForTimeout(2600);
      const e = await estadoArte(p);
      ok(e.estado === 'carro' && e.semArte && !e.arte, 'carro sem arte (Voyage): palco no desenho "sem carro"', JSON.stringify(e));
      ok(e.atalhos >= 3 && e.comImagem === e.atalhos && e.yMedio > 0.3 && e.yMedio < 0.62, `   ${e.atalhos} atalhos com imagem, no meio do palco (centro em ${(e.yMedio * 100).toFixed(0)}% da altura)`, JSON.stringify(e));
      await p.context().close();
    }
    // 3. escolher no seletor, trocar de carro, esquecer e escolher outro
    {
      const p = await novo(null); await p.goto(base, { waitUntil: 'load' }); await p.waitForTimeout(700);
      const toque = async (sel) => { const e = p.locator(sel).first(); await e.scrollIntoViewIfNeeded(); await e.click(); };
      await toque('[data-hero] [data-acao="marca"][data-n="Chevrolet"]'); await toque('[data-hero] [data-acao="modelo"][data-n="Onix"]');
      await aoPalco(p); let ms = await esperaArte(p, 'carro-chevrolet-onix', Date.now());
      ok(ms != null, `escolher no seletor (Onix): arte à vista em ${ms} ms`, JSON.stringify(await estadoArte(p)));
      await toque('[data-hero] [data-acao="trocar"]'); await toque('[data-hero] [data-acao="marca"][data-n="Volvo"]'); await p.waitForTimeout(250);
      let e = await estadoArte(p); ok(e.estado === 'marca' && e.palavra === 'Volvo', '   trocar -> marca Volvo: o título diz "Volvo" e o palco volta à cena', JSON.stringify(e));
      await toque('[data-hero] [data-acao="modelo"][data-n="XC60"]'); await aoPalco(p); ms = await esperaArte(p, 'carro-volvo-xc60', Date.now());
      await p.waitForTimeout(900); e = await estadoArte(p);
      ok(ms != null && e.palavra === 'XC60' && await p.locator('.ab-auto[data-on]').count() === 1, `trocar de carro (Onix -> XC60): a arte nova à vista em ${ms} ms, só ela`, JSON.stringify(e));
      await toque('[data-hero] [data-acao="tirar"]'); await p.waitForTimeout(700); e = await estadoArte(p);
      ok(e.estado === null && !e.arte && e.palavra === 'carro', '"Esquecer": sem arte de carro, cena de abertura', JSON.stringify(e));
      await toque('[data-hero] [data-acao="marca"][data-n="Fiat"]'); await toque('[data-hero] [data-acao="modelo"][data-n="Uno"]'); await aoPalco(p); ms = await esperaArte(p, 'carro-fiat-uno', Date.now());
      ok(ms != null, `esquecer e escolher outro (Fiat Uno): arte à vista em ${ms} ms`, JSON.stringify(await estadoArte(p)));
      // 4. sair e voltar (bfcache ou recarga): a arte continua lá
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
      await p.goto(new URL('/carros.html', base).href, { waitUntil: 'load' }); await p.goBack({ waitUntil: 'load' }); await p.waitForTimeout(400); await aoPalco(p);
      ms = await esperaArte(p, 'carro-fiat-uno', Date.now()); e = await estadoArte(p);
      ok(ms != null && e.palavra.startsWith('Uno'), `voltar pelo histórico: a arte do Uno à vista (${ms} ms), título "${e.palavra}"`, JSON.stringify(e));
      ok(p.erros.length === 0, '   0 erros', p.erros.join(' | ')); await p.context().close();
    }
    // 5. carro unido com apelido (C180 -> Classe C): hoje o salvo com o apelido não está na garagem; quando a leitura
    //    migrar para o principal (sem evento), a abertura segue o seletor
    {
      const p = await novo({ b: 'Mercedes-Benz', m: 'C180', y: null }); await p.goto(base, { waitUntil: 'load' }); await aoPalco(p); await p.waitForTimeout(1800);
      let e = await estadoArte(p);
      const coerente = (e.estado === null && e.palavra === 'carro') || (e.estado === 'carro' && (e.arte ? e.arte.larg > 0 : e.semArte));
      ok(coerente, `apelido salvo (C180): abertura coerente (estado ${e.estado}, título "${e.palavra}", arte ${e.arte ? e.arte.src : 'nenhuma'})`, JSON.stringify(e));
      // a migração na leitura: o carro passa a ser o principal SEM o evento "meu-carro"; o seletor recarrega e a abertura segue
      await p.evaluate(() => { localStorage.setItem('izzatcar.meuCarro', JSON.stringify({ b: 'Mercedes-Benz', m: 'Classe C', y: null })); document.querySelector('[data-mc-raiz][data-hero]')._meuCarro.recarregar(); });
      await aoPalco(p); const ms = await esperaArte(p, 'carro-mercedes-benz-classe-c', Date.now()); e = await estadoArte(p);
      ok(e.palavra === 'Classe C' && e.estado === 'carro' && (ms != null || e.semArte), `   migrado para Classe C sem evento: título "${e.palavra}", ${ms != null ? 'arte à vista em ' + ms + ' ms' : 'desenho sem arte'}`, JSON.stringify(e));
      await p.context().close();
    }
    await b.close();
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO CERTO');
})();
