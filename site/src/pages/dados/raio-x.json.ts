// "Ver as peças da frente" do Raio-x do carro (components/v2/RaioX.astro) para quem NÃO tem carro salvo: as peças mais
// novas de cada parte do carro, no mesmo formato do /dados/busca.json (só essas peças, ~100), e a lista de cada zona
// ({ zonas: { frente: [índices] } }). Baixado só no clique do botão (~8 KB comprimido; o índice inteiro tem 370 KB).
// Com carro salvo, o painel usa o /dados/carro/<k>.json, que já tem todas as peças do carro.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, type Indice } from '../../lib/busca';
import { ZONAS, pecasDaZona, NA_GALERIA } from '../../lib/raioX';

/** As colunas do índice só nas posições `ks` (o mesmo recorte de /dados/carro/<k>.json). */
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

export const GET: APIRoute = () => {
  const ix = JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice;
  const b = new Busca(ix);
  const pos = new Map(ix.id.map((id, k) => [id, k]));
  const porZona = ZONAS.map((z) => ({ k: z.k, ids: pecasDaZona((f) => b.procurar(f), {}, z).slice(0, NA_GALERIA).map((it) => it.id) }));
  const ks = [...new Set(porZona.flatMap((z) => z.ids.map((id) => pos.get(id)!)))].sort((a, c) => a - c);
  const lugar = new Map(ks.map((k, i) => [ix.id[k], i]));
  const sub = recortar(ix, ks) as Indice & { zonas?: Record<string, number[]> };
  sub.zonas = Object.fromEntries(porZona.map((z) => [z.k, z.ids.map((id) => lugar.get(id)!)]));
  return new Response(JSON.stringify(sub), { headers: { 'Content-Type': 'application/json' } });
};
