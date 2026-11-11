// As peças à venda agora, só o que o "Você viu" (home) e o "Você também viu" (peça) precisam para tirar a peça que
// vendeu e mostrar o preço e a capa de hoje (lib/vistos.ts: lerAtivas, paraMostrar): id (sem o "MLB"), preço e as
// colunas "e" (capa de estúdio) e "r" (capas leves) do MESMO public/dados/busca.json. ~110 KB (~45 KB comprimido)
// em vez do índice inteiro (1,4 MB): a home e a peça não baixam a busca só para conferir 12 peças.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Indice } from '../../lib/busca';

export function GET() {
  const x: Indice = JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8'));
  const id = x.id.map((s) => Number(s.replace(/^MLB/, '')));
  const out = { u: x.updated, id, p: x.p, e: x.e ?? '0'.repeat(id.length), r: x.r ?? '0'.repeat(id.length) };
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}
