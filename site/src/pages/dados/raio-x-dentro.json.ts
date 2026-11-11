// As vistas "por dentro" do Raio-x (components/v2/raioXPorDentro.ts) para quem NÃO tem carro salvo: quantas peças o
// estoque inteiro tem de cada ponto quente de cada vista ({ z: { motor: { alternador: 9 } } }), pela MESMA busca do
// catálogo (o número é o do link), e as peças ligadas dos poucos pontos sem a peça do título ({ l: { rodas: {
// agregado: [...] } } }). Um arquivo só para todas as vistas, baixado ao abrir a 1ª. A conta mora em
// lib/porDentro/todas.ts (`dentroJson`). Com carro, sai do /dados/carro/<k>.json, como o resto do Raio-x.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, capaItem, type Indice } from '../../lib/busca';
import { dentroJson } from '../../lib/porDentro/todas';

export const GET: APIRoute = () => {
  const b = new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice);
  return new Response(JSON.stringify(dentroJson((f) => b.procurar(f), (x) => capaItem(x, 'A'))), { headers: { 'Content-Type': 'application/json' } });
};
