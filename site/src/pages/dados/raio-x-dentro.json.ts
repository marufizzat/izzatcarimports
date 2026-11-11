// As vistas "por dentro" do Raio-x (components/v2/raioXPorDentro.ts) para quem NÃO tem carro salvo: quantas peças o
// estoque inteiro tem de cada ponto quente de cada vista ({ z: { motor: { alternador: 9 } } }), pela MESMA busca do
// catálogo (o número é o do link). Um arquivo só para todas as vistas (~1 KB comprimido), baixado ao abrir a 1ª.
// Com carro, a conta sai do /dados/carro/<k>.json, como o resto do Raio-x.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, type Indice } from '../../lib/busca';
import { contarPontos } from '../../lib/porDentro/base';
import { PONTOS_DA_ZONA } from '../../lib/porDentro/todas';

export const GET: APIRoute = () => {
  const b = new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice);
  const z = Object.fromEntries(Object.entries(PONTOS_DA_ZONA).map(([k, pontos]) => [k, contarPontos((f) => b.procurar(f), {}, pontos)]));
  return new Response(JSON.stringify({ v: 1, z }), { headers: { 'Content-Type': 'application/json' } });
};
