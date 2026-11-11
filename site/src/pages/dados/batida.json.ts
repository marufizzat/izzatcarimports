// "Bati o carro" do Raio-x (home sem carro salvo): as linhas dos 8 pontos da batida contadas no estoque inteiro, com a
// peça mais barata de cada linha (lib/batida.ts). Baixado só ao escolher o modo "Bati o carro".
// Formato curto (components/v2/raioXBatida.ts: BatidaJson): as peças UMA vez só (a mesma aparece em 2 ou 3 pontos) e,
// por ponto, [quantas, qual peça] de cada linha, na ordem de PONTOS[k].linhas (linha sem peça: [0, -1]).
// Com carro salvo ou na página do carro, o painel conta pelo arquivo do carro (/dados/carro/<k>.json), igual ao resto.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, capaItem, type Indice } from '../../lib/busca';
import { PONTOS, itensDaLinha, repDe, type Rep } from '../../lib/batida';

export const GET: APIRoute = () => {
  const b = new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice);
  const pecas: Rep[] = [];
  const lugar = new Map<string, number>();
  const pontos: Record<string, [number, number][]> = {};
  for (const p of PONTOS) {
    pontos[p.k] = p.linhas.map((l) => {
      const itens = itensDaLinha(p, l, (f) => b.procurar(f));
      if (!itens.length) return [0, -1];
      const it = itens[0];
      if (!lugar.has(it.id)) lugar.set(it.id, pecas.push(repDe(it, (x) => capaItem(x, 'A'))) - 1);
      return [itens.length, lugar.get(it.id)!];
    });
  }
  return new Response(JSON.stringify({ v: 2, pecas, pontos }), { headers: { 'Content-Type': 'application/json' } });
};
