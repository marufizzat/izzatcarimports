// "Chegou para o seu carro" (home, components/v2/ChegouCarro.astro): com o carro salvo (lib/meuCarro.ts), as peças mais
// novas daquele carro (no ano salvo, quando há), do /dados/carro/<k>.json (só as peças do carro, o mesmo formato do
// busca.json: pages/dados/carro/[k].json.ts). A lista sai da MESMA busca do catálogo (Busca.procurar com marca, modelo,
// ano e "chegaram agora"): o "Ver todas as N" leva ao catálogo filtrado e o número bate com ele.
// Sem node:fs: roda no build (testes) e no navegador. Só o tipo de lib/busca.ts.
import type { Filtros, Item } from './busca';
import { linkCatalogo, type MeuCarro } from './meuCarro';

/** A chave do carro nos endereços (/carros/<k>.html, /dados/carro/<k>.json): o slugify de gerar_paginas_individuais.py
 *  (chave_url do preparar_dados.py) sobre "marca modelo". */
export function chaveCarro(b: string, m: string): string {
  return `${b} ${m}`.toLowerCase().trim()
    .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export const ARQUIVO_CARRO = (b: string, m: string) => `/dados/carro/${chaveCarro(b, m)}.json`;
/** quantos cartões no trilho */
export const NO_TRILHO = 10;

export type Chegou = {
  /** ok: há peças (no ano salvo, se há ano); sem-ano: o modelo tem peças, nenhuma do ano; sem-modelo: nenhuma */
  estado: 'ok' | 'sem-ano' | 'sem-modelo';
  itens: Item[];
  /** quantas há no catálogo com o mesmo filtro (o "Ver todas as N") */
  total: number;
  /** quantas o modelo tem em todos os anos */
  doModelo: number;
};

/** As mais novas do carro salvo, pela busca do catálogo (`procurar` = Busca.procurar). */
export function chegouParaOCarro(procurar: (f: Filtros) => Item[], c: MeuCarro, n = NO_TRILHO): Chegou {
  const doModelo = procurar({ marca: c.b, modelo: c.m, ordem: 'novos' });
  if (!doModelo.length) return { estado: 'sem-modelo', itens: [], total: 0, doModelo: 0 };
  const lista = c.y ? procurar({ marca: c.b, modelo: c.m, ano: c.y, ordem: 'novos' }) : doModelo;
  if (!lista.length) return { estado: 'sem-ano', itens: [], total: 0, doModelo: doModelo.length };
  return { estado: 'ok', itens: lista.slice(0, n), total: lista.length, doModelo: doModelo.length };
}

/** O catálogo filtrado pelo carro, das mais novas para as mais antigas. */
export const linkChegou = (c: { b: string; m: string; y?: number | null }) => `${linkCatalogo(c)}&ordem=novos`;

/** Antes da 1ª pintura (inline na home, por toString(): sem nada de fora). `carro` = o localStorage do "Meu carro";
 *  `modelos` = os modelos com peça por marca (o data-modelos da abertura, SeletorCarro.astro). null = sem carro salvo.
 *  'convite' quando o modelo saiu do estoque (o mesmo teste da abertura); senão 'trilho' (o ano é conferido depois). */
export function chegouAntes(carro: string | null, modelos: string | null): { estado: 'trilho' | 'convite'; nome: string; link: string } | null {
  try {
    const c = JSON.parse(carro || 'null');
    if (!c || typeof c.b !== 'string' || typeof c.m !== 'string' || !c.b || !c.m) return null;
    const y = typeof c.y === 'number' && c.y > 1900 && c.y < 2100 ? Math.round(c.y) : 0;
    // sem a lista (a abertura mudou): o trilho, e os dados decidem depois
    const lista = modelos == null ? null : JSON.parse(modelos);
    const tem = !lista || (Array.isArray(lista[c.b]) && lista[c.b].indexOf(c.m) >= 0);
    const u = new URLSearchParams({ marca: c.b, modelo: c.m });
    if (y) u.set('ano', String(y));
    return { estado: tem ? 'trilho' : 'convite', nome: c.b + ' ' + c.m + (y ? ' ' + y : ''), link: '/catalogo.html?' + u.toString() + '&ordem=novos' };
  } catch {
    return null;
  }
}
