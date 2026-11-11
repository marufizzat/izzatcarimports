// Service worker do app (public/sw.js): no fim do build, põe no dist/sw.js
//  - CASCO: o mínimo para a página sem conexão abrir sem rede (offline.html, o CSS e o JS dela com os imports, o logo,
//    o sprite de ícones e a fonte latina). Lido do dist/offline.html FINAL (depois do escopo-curto e do css-junto: esta
//    integração vem por último em astro.config.mjs);
//  - VERSAO: o hash do conteúdo do sw.js + do casco. Muda só quando o código muda (o robô reconstrói a cada 30 min só
//    com dados novos: a versão fica a mesma e ninguém reinstala nada). O offline.html não pode ter dado do estoque.
// Sem o offline.html (build parcial) ou com erro: o sw.js fica com 'dev' e só a página sem conexão (funciona igual).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

/** Os arquivos do casco a partir do HTML da página sem conexão (e dos imports dos scripts dela). Exportada para o teste. */
export function cascoDe(html, ler) {
  const lista = new Set(['/offline.html']);
  const add = (u) => { if (u && u.startsWith('/') && !u.startsWith('//')) lista.add(u.split('#')[0].split('?')[0]); };
  for (const m of html.matchAll(/<link\b[^>]*\brel="(?:stylesheet|modulepreload|preload)"[^>]*>/g)) add((/\bhref="([^"]+)"/.exec(m[0]) || [])[1]);
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) add(m[1]);
  // o sprite vai com o ?v= do endereço (é o que a página pede: a chave do cache é o endereço inteiro)
  const sprite = /(?:href|xlink:href)="(\/icones\.svg(?:\?[^"#]*)?)#/.exec(html);
  if (sprite) lista.add(sprite[1]);
  // os imports estáticos dos módulos (os pedaços que o Vite separou), e as fontes latinas do CSS
  const fila = [...lista].filter((u) => u.endsWith('.js'));
  while (fila.length) {
    const u = fila.shift();
    const js = ler(u);
    if (js == null) continue;
    for (const m of js.matchAll(/(?:\bimport|\bfrom)\s*["']([^"']+\.js)["']/g)) {
      const alvo = new URL(m[1], 'https://x' + u).pathname;
      if (!lista.has(alvo)) { lista.add(alvo); fila.push(alvo); }
    }
  }
  for (const u of [...lista].filter((x) => x.endsWith('.css'))) {
    const css = ler(u) || '';
    // português cabe no subconjunto "latin" (á, ã, ç, é, õ): as outras fontes só descem se a página pedir
    for (const m of css.matchAll(/url\(["']?([^"')]+-latin-(?!ext)[^"')]*\.woff2)["']?\)/g)) add(new URL(m[1], 'https://x' + u).pathname);
  }
  return [...lista].sort((a, b) => (a === '/offline.html' ? -1 : b === '/offline.html' ? 1 : a.localeCompare(b)));
}

export default function serviceWorker() {
  return {
    name: 'izzat-service-worker',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const sw = join(raiz, 'sw.js');
        const off = join(raiz, 'offline.html');
        if (!existsSync(sw) || !existsSync(off)) { logger.warn('sw.js ou offline.html fora do dist: o service worker fica com a versão dev'); return; }
        try {
          // o arquivo de um endereço do casco (o ?v= do sprite não faz parte do nome)
          const arq = (u) => join(raiz, decodeURIComponent(u.split('?')[0]));
          const ler = (u) => (existsSync(arq(u)) ? readFileSync(arq(u), 'utf-8') : null);
          const casco = cascoDe(readFileSync(off, 'utf-8'), ler);
          const faltam = casco.filter((u) => !existsSync(arq(u)));
          if (faltam.length) throw new Error('casco com arquivo que não existe: ' + faltam.join(', '));
          let modelo = readFileSync(sw, 'utf-8');
          const h = createHash('sha256').update(modelo);
          let bytes = 0;
          for (const u of casco) { const b = readFileSync(arq(u)); bytes += b.length; h.update(u).update(b); }
          const versao = h.digest('base64url').slice(0, 10).replace(/[-_]/g, 'x');
          const antes = modelo;
          modelo = modelo.replace(/^const VERSAO = 'dev';$/m, `const VERSAO = '${versao}';`)
            .replace(/^const CASCO = \['\/offline\.html'\];$/m, `const CASCO = ${JSON.stringify(casco)};`);
          if (modelo === antes || !modelo.includes(versao)) throw new Error('marcas VERSAO/CASCO não encontradas no sw.js');
          writeFileSync(sw, modelo);
          logger.info(`sw.js versão ${versao}: casco com ${casco.length} arquivos (${Math.round(bytes / 1024)} KB)`);
        } catch (e) {
          logger.warn(`service worker: ${String(e?.message ?? e)} (fica a versão dev)`);
        }
      },
    },
  };
}
