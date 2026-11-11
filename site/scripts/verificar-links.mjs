// Varre dist/ e acusa todo link/arquivo INTERNO que nao existe. Uso: node scripts/verificar-links.mjs
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const DIST = new URL('../dist/', import.meta.url).pathname;
const html = [];
(function andar(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (f.endsWith('.html')) html.push(p); } })(DIST);
const faltam = new Map(); let total = 0;
const re = /(?:href|src|srcset|poster)="([^"]+)"/g;
for (const arq of html) {
  const t = readFileSync(arq, 'utf-8');
  for (const m of t.matchAll(re)) {
    // data: tem vírgula dentro (não é lista de srcset nem link): o valor inteiro fica de fora
    if (/^\s*data:/.test(m[1])) continue;
    for (let u of m[1].split(',').map((s) => s.trim().split(' ')[0])) {
      if (!u || /^(https?:|mailto:|tel:|data:|#|javascript:)/.test(u)) continue;
      u = u.split('#')[0].split('?')[0]; if (!u) continue;
      const alvo = u.startsWith('/') ? join(DIST, decodeURIComponent(u)) : join(arq, '..', decodeURIComponent(u));
      total++;
      if (!existsSync(alvo) && !(u.endsWith('/') && existsSync(join(alvo, 'index.html')))) {
        if (!faltam.has(u)) faltam.set(u, arq.replace(DIST, ''));
      }
    }
  }
}
console.log(`${html.length} páginas, ${total} links internos conferidos, ${faltam.size} quebrados`);
for (const [u, onde] of [...faltam].slice(0, 40)) console.log('  QUEBRADO', u, '  (em', onde + ')');
process.exit(faltam.size ? 1 : 0);
