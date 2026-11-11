// "Bati o carro" do Raio-x (home sem carro salvo): as linhas dos 8 pontos da batida contadas no estoque inteiro, com a
// peça mais barata de cada linha (lib/batida.ts). Baixado só ao escolher o modo "Bati o carro" (~15 KB sem gzip).
// Com carro salvo ou na página do carro, o painel conta pelo arquivo do carro (/dados/carro/<k>.json), igual ao resto.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, capaItem, type Indice } from '../../lib/busca';
import { kitsDeTodos } from '../../lib/batida';

export const GET: APIRoute = () => {
  const b = new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice);
  const pontos = kitsDeTodos((f) => b.procurar(f), (it) => capaItem(it, 'A'));
  return new Response(JSON.stringify({ v: 1, pontos }), { headers: { 'Content-Type': 'application/json' } });
};
