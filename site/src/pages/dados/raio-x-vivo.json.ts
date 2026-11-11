// "O Raio-x vivo" (components/v2/RaioX.astro, lib/raioXVivo.ts): as peças que chegaram agora — as MESMAS do selo
// "Chegou agora" dos cartões e do trilho "Chegou no pátio" (`resumo().chegou`) — com a zona do carro onde cada uma
// fica. No máximo 24 peças (~1 KB comprimido). O navegador baixa quando a arte do Raio-x chega perto da tela e decide
// ali quais servem no carro salvo.
import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Busca, type Indice } from '../../lib/busca';
import { resumo } from '../../lib/dados';
import { pecasVivas, type VivoJson } from '../../lib/raioXVivo';

export const GET: APIRoute = () => {
  const b = new Busca(JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8')) as Indice);
  const j: VivoJson = { v: 1, p: pecasVivas(resumo().chegou, b.itens) };
  return new Response(JSON.stringify(j), { headers: { 'Content-Type': 'application/json' } });
};
