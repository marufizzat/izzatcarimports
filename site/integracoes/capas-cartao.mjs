// Capas leves dos cartões (scripts/capas-cartao.mjs) no começo de todo build: `npm run build`, `npx astro build` e a
// prévia (PREVIA=1) saem sempre com as reduzidas em dia e a coluna "r" do busca.json certa, depois de qualquer passo do
// Python (preparar_dados.py reescreve o busca.json sem ela; capas_estudio.py --so-marcar pode trocar o "e").
// Falhou (sharp, disco): o build segue e o cartão usa a capa inteira. No `astro dev` não roda.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capasCartao } from '../scripts/capas-cartao.mjs';

export default function capasCartaoIntegracao() {
  return {
    name: 'izzat-capas-cartao',
    hooks: {
      'astro:config:done': ({ config }) => { capasCartaoIntegracao.raiz = fileURLToPath(config.root); },
      'astro:build:start': async ({ logger }) => {
        try {
          await capasCartao({ raiz: capasCartaoIntegracao.raiz ?? process.cwd(), log: (m) => logger.info(m) });
        } catch (e) {
          logger.warn(`capas do cartão: ${String(e?.message ?? e).split('\n')[0]} (os cartões usam a capa inteira)`);
          // sem a coluna "r" os cartões do navegador nunca pedem uma reduzida que pode não estar em dia
          try {
            const arq = join(capasCartaoIntegracao.raiz ?? process.cwd(), 'public', 'dados', 'busca.json');
            if (existsSync(arq)) { const ix = JSON.parse(readFileSync(arq, 'utf-8')); delete ix.r; writeFileSync(arq, JSON.stringify(ix)); }
          } catch { /* o build segue */ }
        }
      },
    },
  };
}
