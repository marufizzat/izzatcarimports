// Proxy "4G lento" (150 ms de ida e volta + 1,6 Mbps de descida, divididos entre as conexões) na frente do preview.
// Vale para TODA requisição, também as do prerender (o throttling do DevTools é por alvo e pode não pegar o prerender).
// uso: node proxy-lento.cjs <porta> <destino>   (ex.: 4375 http://127.0.0.1:4374)
const http = require('http'); const zlib = require('zlib');
const PORTA = Number(process.argv[2] || 4375); const DEST = new URL(process.argv[3] || 'http://127.0.0.1:4374');
const RTT = Number(process.env.RTT ?? 150), BPS = Number(process.env.BPS ?? (1.6 * 1024 * 1024) / 8); // bytes por segundo
let livre = Date.now(); // a "linha" de descida é uma só: cada pedaço espera a sua vez
const agendar = (n) => { const agora = Date.now(); livre = Math.max(livre, agora) + (n / BPS) * 1000; return livre - agora; };
http.createServer((req, res) => {
  const t0 = Date.now();
  const opts = { hostname: DEST.hostname, port: DEST.port, path: req.url, method: req.method, headers: { ...req.headers, host: DEST.host, 'accept-encoding': 'identity' } };
  const p = http.request(opts, (r) => {
    setTimeout(() => {
      const pedacos = []; r.on('data', (c) => pedacos.push(c));
      r.on('end', async () => {
        // como o GitHub Pages: texto vai com gzip (o preview do Astro manda cru)
        let corpo = Buffer.concat(pedacos); const h = { ...r.headers };
        if (/html|javascript|css|json|svg|xml/.test(h['content-type'] || '') && /gzip/.test(req.headers['accept-encoding'] || '') && corpo.length > 512) {
          corpo = zlib.gzipSync(corpo, { level: 6 }); h['content-encoding'] = 'gzip'; h['content-length'] = String(corpo.length);
        }
        res.writeHead(r.statusCode, h);
        for (const c of [corpo]) {
          for (let i = 0; i < c.length; i += 16384) {
            const parte = c.subarray(i, i + 16384);
            await new Promise((ok) => setTimeout(ok, agendar(parte.length)));
            res.write(parte);
          }
        }
        res.end();
      });
    }, Math.max(0, RTT - (Date.now() - t0)));
  });
  p.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(p);
}).listen(PORTA, '127.0.0.1', () => console.log('proxy lento em', PORTA, '->', DEST.href));
