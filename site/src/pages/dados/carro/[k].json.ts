// O índice da busca só com as peças de UM carro (o mesmo formato de /dados/busca.json): as fichas de ano da página do
// carro montam a grade do ano com ele (AnosDoCarro.astro). Antes o 1º toque num ano baixava e lia o índice inteiro
// (1,4 MB, 5 mil peças): um quadro de 70–110 ms num celular lento. No XC60 são 515 peças (~10%). Só para os carros com
// mais de 48 peças (os outros já têm todas na grade). Sai do MESMO public/dados/busca.json (com o "r" das capas leves).
// Rodada 13: um arquivo para CADA carro da garagem do "Meu carro" (todo modelo que o seletor oferece, também os de menos
// de 8 peças, sem página própria): o "Chegou para o seu carro" da home lê o do carro salvo (lib/chegouCarro.ts, a chave é
// chaveCarro(marca, modelo), a mesma das páginas /carros/<k>.html).
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { garagem } from '../../../lib/garagem';
import { resumo } from '../../../lib/dados';
import { serveNoModelo } from '../../../lib/meuCarro';
import { chaveCarro } from '../../../lib/chegouCarro';
import type { Indice } from '../../../lib/busca';

let ix: Indice | null = null;
const indice = (): Indice => (ix ??= JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')));

export function getStaticPaths() {
  const vistos = new Set<string>();
  // + os apelidos de carro unido (C180, New Fiesta): o "Meu carro" salvo com eles ainda acha o "Chegou para o seu carro"
  const apelidos = (resumo().aliases ?? []).map((a) => ({ b: a.b, m: a.de }));
  return [...garagem().marcas.flatMap((mc) => mc.modelos.map((mo) => ({ b: mc.n, m: mo.n }))), ...apelidos]
    .map((x) => ({ params: { k: chaveCarro(x.b, x.m) }, props: { b: x.b, m: x.m } }))
    .filter((x) => !vistos.has(x.params.k) && !!vistos.add(x.params.k));
}

/** As colunas do índice só nas posições `ks` (listas e textos de uma letra por peça; os mapas esparsos renumerados). */
function recortar(x: Indice, ks: number[]): Indice {
  const N = x.id.length;
  const novo = new Map(ks.map((k, i) => [String(k), String(i)]));
  const out: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(x)) {
    if (Array.isArray(v) && v.length === N) out[chave] = ks.map((k) => v[k]);
    else if (typeof v === 'string' && v.length === N && chave !== 'updated') out[chave] = ks.map((k) => v[k]).join('');
    else if (v && typeof v === 'object' && !Array.isArray(v) && ['ms', 'ys', 'dif'].includes(chave)) {
      out[chave] = Object.fromEntries(Object.entries(v).filter(([k]) => novo.has(k)).map(([k, w]) => [novo.get(k), w]));
    } else out[chave] = v;
  }
  return out as Indice;
}

export const GET: APIRoute = ({ props }) => {
  const x = indice();
  const ks = x.id.map((_, k) => k).filter((k) => x.marcas[x.b[k]] === props.b && serveNoModelo({ m: x.m[k], ms: x.ms?.[k] }, props.m));
  return new Response(JSON.stringify(recortar(x, ks)), { headers: { 'Content-Type': 'application/json' } });
};
