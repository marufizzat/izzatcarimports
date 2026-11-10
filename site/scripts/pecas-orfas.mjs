// Grafo de links do dist/: parte da home (index.html), segue todo <a href> interno de página em página e conta as
// páginas de peça que NENHUM caminho de links alcança (só no sitemap = "órfã" para o Google). Auditoria 3, item 9.1.
// Também conta quantos links de entrada cada peça tem. Uso: node scripts/pecas-orfas.mjs [pasta do dist]  (sai 1 se sobrar órfã)
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
const DIST = process.argv[2] ? process.argv[2].replace(/\/?$/, '/') : new URL('../dist/', import.meta.url).pathname;

// todas as páginas de peça que o build gerou
const pecas = readdirSync(join(DIST, 'peca')).filter((f) => f.endsWith('.html')).map((f) => `peca/${f}`);

// href -> caminho relativo ao dist ("peca/x.html", "index.html"), ou null se for externo/âncora/arquivo que não é página
function alvo(href, de) {
  if (!href || /^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(href)) {
    const m = /^https?:\/\/(www\.)?izzatcarimports\.com\.br(\/[^"]*)?$/i.exec(href || '');
    if (!m) return null;                                   // externo
    href = m[2] || '/';
  }
  let u = href.split('#')[0].split('?')[0];
  if (!u) return null;
  try { u = decodeURIComponent(u); } catch { /* fica cru */ }
  let rel = u.startsWith('/') ? u.slice(1) : posix.normalize(posix.join(dirname(de), u));
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (!/\.html$/.test(rel)) {
    if (existsSync(join(DIST, rel + '.html'))) rel += '.html';
    else if (existsSync(join(DIST, rel, 'index.html'))) rel = posix.join(rel, 'index.html');
    else return null;                                      // imagem, json, xml...
  }
  return existsSync(join(DIST, rel)) && statSync(join(DIST, rel)).isFile() ? rel : null;
}

const visto = new Set(['index.html']);
const fila = ['index.html'];
const entrada = new Map();                                 // peça -> nº de páginas que linkam para ela
const reHref = /<a\b[^>]*?\shref="([^"]*)"/gi;
while (fila.length) {
  const pag = fila.shift();
  const html = readFileSync(join(DIST, pag), 'utf-8');
  const daqui = new Set();
  for (const m of html.matchAll(reHref)) {
    const r = alvo(m[1].replace(/&amp;/g, '&'), pag);
    if (!r || r === pag) continue;
    daqui.add(r);
    if (!visto.has(r)) { visto.add(r); fila.push(r); }
  }
  for (const r of daqui) if (r.startsWith('peca/')) entrada.set(r, (entrada.get(r) ?? 0) + 1);
}

const orfas = pecas.filter((p) => !visto.has(p));
const hist = {};
for (const p of pecas) { const n = Math.min(entrada.get(p) ?? 0, 10); hist[n] = (hist[n] ?? 0) + 1; }
console.log(`${visto.size} páginas alcançadas a partir da home | ${pecas.length} páginas de peça | ${orfas.length} órfãs`);
console.log('links de entrada por peça (10 = 10 ou mais):', JSON.stringify(hist));
for (const o of orfas.slice(0, 20)) console.log('  ÓRFÃ', o);
process.exit(orfas.length ? 1 : 0);
