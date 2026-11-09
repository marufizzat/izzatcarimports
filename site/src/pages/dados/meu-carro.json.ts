// Garagem "Meu carro" para o navegador: marca -> modelo -> contagem de peças (total e por ano).
// Pequeno de propósito (o busca.json tem 1,3 MB). Montada em lib/garagem.ts, a MESMA fonte da
// grade de marcas que já vem no HTML da abertura; o número bate com o catálogo filtrado.
import { garagem } from '../../lib/garagem';

export function GET() {
  return new Response(JSON.stringify(garagem()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
