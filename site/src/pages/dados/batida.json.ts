// "Bati o carro" do Raio-x (home sem carro salvo): as linhas dos 8 pontos da batida contadas no estoque inteiro, com a
// peça mais barata de cada linha (lib/batida.ts). Baixado só ao escolher o modo "Bati o carro".
// O formato (curto) e a conta moram em lib/batida.ts: `batidaJson` escreve, `linhaDoJson` lê (o painel e o teste usam
// a mesma leitura). Com carro salvo ou na página do carro, o painel conta pelo arquivo do carro
// (/dados/carro/<k>.json), igual ao resto.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, capaItem, type Indice } from '../../lib/busca';
import { batidaJson } from '../../lib/batida';

export const GET: APIRoute = () => {
  const b = new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice);
  return new Response(JSON.stringify(batidaJson((f) => b.procurar(f), (x) => capaItem(x, 'A'))), { headers: { 'Content-Type': 'application/json' } });
};
