// "A frente por dentro" do Raio-x (components/v2/raioXPorDentro.ts) para quem NÃO tem carro salvo: quantas peças o
// estoque inteiro tem de cada ponto quente da arte (lib/raioXFrente.ts), pela MESMA busca do catálogo (o número é o do
// link). ~250 bytes, baixado só ao abrir a vista. Com carro, a conta sai do /dados/carro/<k>.json, como o resto.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, type Indice } from '../../lib/busca';
import { contarQuentes } from '../../lib/raioXFrente';

export const GET: APIRoute = () => {
  const b = new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice);
  return new Response(JSON.stringify({ v: 1, n: contarQuentes((f) => b.procurar(f)) }), { headers: { 'Content-Type': 'application/json' } });
};
