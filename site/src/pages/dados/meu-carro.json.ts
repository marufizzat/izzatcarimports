// Garagem "Meu carro": marca -> modelo -> contagem de peças (total e por ano), gerado no build.
// Pequeno de propósito (o busca.json tem 1,3 MB). A contagem por ano usa a MESMA regra do catálogo
// (ano dentro da faixa da peça); por isso o número da abertura bate com o catálogo filtrado.
import { pecas, resumo, logoInfo } from '../../lib/dados';
import { populares } from '../../lib/populares';

export function GET() {
  const r = resumo();
  const kMarca = new Map(r.marcas.map((m) => [m.n, m.k]));
  const grupos = new Map<string, { n: string; k: string; c: number; modelos: Map<string, { n: string; c: number; ya: Map<number, number> }> }>();
  for (const p of pecas()) {
    if (!p.b || !p.m) continue;
    let g = grupos.get(p.b);
    if (!g) {
      g = { n: p.b, k: kMarca.get(p.b) ?? p.b.toLowerCase().replace(/[^a-z0-9]+/g, '-'), c: 0, modelos: new Map() };
      grupos.set(p.b, g);
    }
    let mo = g.modelos.get(p.m);
    if (!mo) { mo = { n: p.m, c: 0, ya: new Map() }; g.modelos.set(p.m, mo); }
    g.c++;
    mo.c++;
    if (p.y) for (let y = Math.max(1950, p.y[0]); y <= Math.min(2035, p.y[1]); y++) mo.ya.set(y, (mo.ya.get(y) ?? 0) + 1);
  }
  const marcas = [...grupos.values()]
    .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n, 'pt-BR'))
    .map((g) => ({
      n: g.n,
      k: g.k,
      logo: logoInfo(g.k, 64, 40)?.src ?? null,
      c: g.c,
      modelos: [...g.modelos.values()]
        .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n, 'pt-BR'))
        .map((mo) => ({ n: mo.n, c: mo.c, ya: [...mo.ya.entries()].sort((a, b) => b[0] - a[0]) })),
    }));
  return new Response(JSON.stringify({ v: 1, total: r.total, marcas, populares: populares(6) }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
