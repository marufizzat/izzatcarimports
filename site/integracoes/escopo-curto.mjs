// Escopo curto: troca o atributo de escopo do Astro ("data-astro-cid-ckwniern", 24 letras, repetido em quase toda
// tag dos componentes com <style>) por um nome curto ("data-s7") no HTML, no CSS e no JS do build.
// É só uma troca de nome, a mesma em todos os arquivos: os seletores continuam iguais ([data-s7] no lugar de
// [data-astro-cid-ckwniern], mesma especificidade), então nada muda no visual. Numa página de peça eram ~370
// atributos (~9 KB); com 5 mil páginas, isso pesava no limite de 1 GB do GitHub Pages.
// Roda no fim do build (astro:build:done); no `astro dev` não roda (e não precisa).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RE = /data-astro-cid-([a-z0-9]+)/g;
const TIPOS = /\.(html|css|js|mjs)$/;

function arquivos(dir, lista = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, lista);
    else if (TIPOS.test(nome)) lista.push(p);
  }
  return lista;
}

export default function escopoCurto() {
  return {
    name: 'izzat-escopo-curto',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const raiz = fileURLToPath(dir);
        const lista = arquivos(raiz);
        // 1ª passada: todos os escopos do build, em ordem fixa (o mesmo nome curto em todo arquivo)
        const escopos = new Set();
        const comEscopo = [];
        for (const arq of lista) {
          const t = readFileSync(arq, 'utf-8');
          if (!t.includes('data-astro-cid-')) continue;
          comEscopo.push(arq);
          for (const m of t.matchAll(RE)) escopos.add(m[1]);
        }
        const nomes = new Map([...escopos].sort().map((e, i) => [e, `data-s${i}`]));
        // 2ª passada: troca (lê de novo para não guardar 5 mil páginas na memória)
        let economia = 0;
        for (const arq of comEscopo) {
          const t = readFileSync(arq, 'utf-8');
          const novo = t.replace(RE, (_, e) => nomes.get(e));
          economia += t.length - novo.length;
          writeFileSync(arq, novo);
        }
        logger.info(`${nomes.size} escopos encurtados em ${comEscopo.length} arquivos (${(economia / 1048576).toFixed(1)} MB a menos)`);
      },
    },
  };
}
