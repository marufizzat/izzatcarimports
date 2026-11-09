// Mede no "celular lento" (4G lento + CPU 4x): LCP, CLS, bytes e JS. Uso: node desempenho.cjs url...
const { chromium, devices } = require('/Users/izzat/wa-export/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  for (const u of process.argv.slice(2)) {
    const ctx = await b.newContext({ ...devices['Moto G4'] || devices['Pixel 5'] });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0, js = 0; const tipos = {};
    p.on('response', async (r) => { try { const h = await r.allHeaders(); const n = Number(h['content-length'] || 0) || (await r.body().catch(() => Buffer.alloc(0))).length; bytes += n; const t = r.request().resourceType(); tipos[t] = (tipos[t] || 0) + n; if (t === 'script') js += n; } catch {} });
    await p.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    const t0 = Date.now();
    await p.goto(u, { waitUntil: 'load', timeout: 90000 });
    await p.waitForTimeout(3000);
    const m = await p.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0) }));
    console.log(u.replace('http://localhost:4321', ''), `FCP ${m.fcp}ms | LCP ${m.lcp}ms | CLS ${m.cls} | total ${(bytes / 1024).toFixed(0)} KB | JS ${(js / 1024).toFixed(0)} KB | img ${((tipos.image || 0) / 1024).toFixed(0)} KB | media ${((tipos.media || 0) / 1024).toFixed(0)} KB`);
    await ctx.close();
  }
  await b.close();
})();
