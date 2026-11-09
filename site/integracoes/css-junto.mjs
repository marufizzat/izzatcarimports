// CSS junto: o Astro corta o CSS em pedacinhos conforme quais páginas usam cada componente, e cada página acabava
// com 4 a 7 <link rel="stylesheet"> (na peça eram 6: o global e mais 5 de 1 a 18 KB: banner, reputação, busca,
// perguntas e a própria peça). Cada um trava a 1ª pintura até chegar.
// Aqui, no fim do build, cada página fica com 2: o global (o mesmo em todo o site, com cache) e UM arquivo com o resto,
// na MESMA ordem dos links (a cascata não muda). Páginas com o mesmo conjunto (as 5 mil peças) dividem o mesmo arquivo.
// O nome do arquivo junto vem do conteúdo (troca sozinho quando um CSS muda). Os arquivos pequenos continuam no
// dist (HTML antigo em cache ainda aponta para eles). Roda depois do escopo-curto.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const LINK = /<link rel="stylesheet" href="(\/_astro\/[^"?#]+\.css)">/g;

function htmls(dir, lista = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) htmls(p, lista);
    else if (nome.endsWith('.html')) lista.push(p);
  }
  return lista;
}

export default function cssJunto() {
  return {
    name: 'izzat-css-junto',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const lista = htmls(raiz);
        // 1ª passada: a folha usada por mais páginas é a base (fica sozinha)
        const uso = new Map();
        for (const arq of lista) {
          for (const m of readFileSync(arq, 'utf-8').matchAll(LINK)) uso.set(m[1], (uso.get(m[1]) ?? 0) + 1);
        }
        const base = [...uso.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const juntos = new Map(); // conjunto de folhas -> href do arquivo junto
        let paginas = 0, links = 0;
        for (const arq of lista) {
          const html = readFileSync(arq, 'utf-8');
          const achados = [...html.matchAll(LINK)];
          // a base só fica sozinha quando é a 1ª (a ordem da cascata não pode mudar)
          const resto = achados[0]?.[1] === base ? achados.slice(1) : achados;
          if (resto.length < 2) continue;
          const chave = resto.map((m) => m[1]).join('|');
          let href = juntos.get(chave);
          if (!href) {
            const css = resto.map((m) => readFileSync(join(raiz, m[1]), 'utf-8')).join('\n');
            href = `/_astro/junto.${createHash('sha256').update(css).digest('base64url').slice(0, 10)}.css`;
            writeFileSync(join(raiz, href), css);
            juntos.set(chave, href);
          }
          // troca o 1º link do resto pelo arquivo junto e apaga os outros
          let i = 0;
          const novo = html.replace(LINK, (tag, h) => {
            if (i >= achados.length) return tag;
            const m = achados[i++];
            if (!resto.includes(m)) return tag;
            return m === resto[0] ? `<link rel="stylesheet" href="${href}">` : '';
          });
          writeFileSync(arq, novo);
          paginas++;
          links += resto.length - 1;
        }
        logger.info(`${paginas} páginas com o CSS junto (${juntos.size} arquivos, ${links} links a menos)`);
      },
    },
  };
}
