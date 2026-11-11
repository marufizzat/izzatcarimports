// Todas as tabelas das vistas "por dentro", juntas: SÓ para o build (pages/dados/raio-x-dentro.json.ts) e os testes.
// O navegador nunca importa este arquivo: lá cada tabela desce sozinha, quando a vista dela abre
// (components/v2/raioXPorDentro.ts: TABELAS).
import { PONTOS_QUENTES } from '../raioXFrente';
import { PONTOS as MOTOR } from './motor';
import { pontosLateral } from './lateral';
import { PONTOS as INTERIOR } from './interior';
import { PONTOS as TETO } from './teto';
import { PONTOS as TRASEIRA } from './traseira';
import { PONTOS as RODAS } from './rodas';
import { PONTOS as EMBAIXO } from './embaixo';
import { contarComLigadas, ligadaDe, type Ligada, type PontoQuente } from './base';
import type { Filtros, Item } from '../busca';

/** Os pontos quentes de cada vista, pela chave da ZONA do Raio-x (as mesmas chaves de VISTAS, lib/raioXVistas.ts). */
export const PONTOS_DA_ZONA: Record<string, PontoQuente[]> = {
  frente: PONTOS_QUENTES,
  motor: MOTOR,
  'lateral-esquerda': pontosLateral('E'),
  'lateral-direita': pontosLateral('D'),
  interior: INTERIOR,
  teto: TETO,
  traseira: TRASEIRA,
  rodas: RODAS,
  embaixo: EMBAIXO,
};

/** O arquivo das vistas para quem NÃO tem carro (/dados/raio-x-dentro.json): `z` = quantas peças de cada ponto, por
 *  vista; `l` = as peças ligadas dos pontos que não têm a peça do título no estoque inteiro (poucos), para o painel
 *  mostrar sem link de catálogo. */
export type DentroJson = { v: number; z: Record<string, Record<string, number>>; l: Record<string, Record<string, Ligada[]>> };
export function dentroJson(procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string): DentroJson {
  const z: DentroJson['z'] = {}, l: DentroJson['l'] = {};
  for (const [k, pontos] of Object.entries(PONTOS_DA_ZONA)) {
    const c = contarComLigadas(procurar, {}, pontos);
    z[k] = Object.fromEntries(pontos.map((p) => [p.k, c[p.k].n]));
    const lig = pontos.filter((p) => c[p.k].ligadas.length).map((p) => [p.k, c[p.k].ligadas.map((it) => ligadaDe(it, fotoDe))]);
    if (lig.length) l[k] = Object.fromEntries(lig);
  }
  return { v: 2, z, l };
}
