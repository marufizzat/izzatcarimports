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
import type { PontoQuente } from './base';

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
