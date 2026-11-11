// O endereço de hoje de cada peça à venda, em SHARDS arquivos (lib/vendida.ts: shardDe). A 404 de um endereço antigo
// (/peca/<slug velho>-MLB<n>.html) baixa só o arquivo do seu MLB (uns 2 KB comprimido) e manda para o endereço certo;
// sem o MLB no arquivo, a peça saiu do estoque. Sai do MESMO public/dados/busca.json (o `h` de cada peça).
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHARDS, shardDoEstoque } from '../../../lib/vendida';
import type { Indice } from '../../../lib/busca';

export function getStaticPaths() {
  return Array.from({ length: SHARDS }, (_, k) => ({ params: { k: String(k) } }));
}

export const GET: APIRoute = ({ params }) => {
  const x: Indice = JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8'));
  const pares = x.id.map((id, i) => [id, x.h[i]] as const);
  return new Response(JSON.stringify(shardDoEstoque(pares, Number(params.k))), {
    headers: { 'Content-Type': 'application/json' },
  });
};
