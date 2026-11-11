// De onde os testes tiram o estoque (integração da rodada 15, depois que o robô parou a loja por causa de teste que
// dependia das peças do dia). TRÊS fontes, cada uma para um tipo de pergunta:
//  - o VOCABULÁRIO da loja (fixtures/vocabulario.json, gerado de BLOCOS e _TIPOS_DO_BLOCO do preparar_dados.py por
//    ferramentas/vocabulario_loja.py; testes/test_dados.py confere que anda junto): "este nome de bloco/tipo existe?".
//    Nunca perguntar isso ao estoque do dia: o tipo some quando a última peça dele vende.
//  - o ESTOQUE FIXO (fixtures/estoque-busca.json: o /dados/busca.json congelado de 09/11/2026, 5.311 peças, sem as
//    colunas de foto e de endereço; o MESMO dos testes da busca, rodada 14b; não regenerar): tudo que precisa de peça de
//    verdade para existir ("a frente esquerda acha farol esquerdo", "pelo menos N", exemplos com o XC60 2019). Não muda
//    nunca: o teste só quebra quando o CÓDIGO muda.
//  - o ESTOQUE DO DIA (public/dados/busca.json, o que o robô acabou de gerar): só REGRAS que valem para qualquer estoque
//    (o número do painel = o do catálogo, nenhuma peça do lado errado, nada em dobro). Nunca "tem de existir", nunca um
//    anúncio, um carro ou uma quantidade escritos no teste.
// Os caminhos são relativos à pasta site/ (de onde o vitest roda).
import { readFileSync, existsSync } from 'node:fs';
import type { Indice } from '../src/lib/busca';

const voc = JSON.parse(readFileSync('testes/fixtures/vocabulario.json', 'utf-8')) as { blocos: string[]; tipos: Record<string, string> };
/** Os nomes de bloco que a loja sabe escrever (os 25 da grade + "Outros"). */
export const BLOCOS_DA_LOJA: ReadonlySet<string> = new Set(voc.blocos);
/** Os nomes de tipo que a loja sabe escrever (o `s` do índice). */
export const TIPOS_DA_LOJA: ReadonlySet<string> = new Set(Object.keys(voc.tipos));

export const ARQ_DO_DIA = 'public/dados/busca.json';
export const ARQ_FIXO = 'testes/fixtures/estoque-busca.json';
let fixo: Indice | null = null;
/** O estoque fixo dos testes (sempre o mesmo). */
export const indiceFixo = (): Indice => (fixo ??= JSON.parse(readFileSync(ARQ_FIXO, 'utf-8')) as Indice);
/** O estoque que o robô acabou de gerar; null no computador que ainda não rodou o preparar_dados.py. */
export const indiceDoDia = (): Indice | null => (existsSync(ARQ_DO_DIA) ? (JSON.parse(readFileSync(ARQ_DO_DIA, 'utf-8')) as Indice) : null);
/** Os dois estoques para o `describe.each`: as regras rodam nos dois; o que precisa de peça para existir, só no fixo
 *  (`fixo === true`). */
export function estoques(): { nome: string; ix: Indice; fixo: boolean }[] {
  const dia = indiceDoDia();
  return [{ nome: 'estoque fixo', ix: indiceFixo(), fixo: true }, ...(dia ? [{ nome: 'estoque do dia', ix: dia, fixo: false }] : [])];
}
/** O carro com mais peças de um índice (para o exemplo "com carro" no estoque do dia, sem escrever um carro no teste). */
export function carroMaisCheio(ix: Indice): { marca: string; modelo: string } | null {
  const n = new Map<string, number>();
  ix.id.forEach((_, k) => { const b = ix.marcas[ix.b[k]], m = ix.m[k]; if (b && m) n.set(`${b}|${m}`, (n.get(`${b}|${m}`) ?? 0) + 1); });
  const melhor = [...n].sort((a, z) => z[1] - a[1] || (a[0] < z[0] ? -1 : 1))[0];
  if (!melhor) return null;
  const [marca, modelo] = melhor[0].split('|');
  return { marca, modelo };
}

/** Todos os carros (marca + modelo) de um índice, também os que só aparecem como 2º carro de uma peça (`ms`). */
export function carrosDoIndice(ix: Indice): { marca: string; modelo: string }[] {
  const v = new Map<string, { marca: string; modelo: string }>();
  ix.id.forEach((_, k) => {
    const marca = ix.marcas[ix.b[k]];
    for (const modelo of ix.ms?.[String(k)] ?? [ix.m[k]]) if (marca && modelo) v.set(`${marca}|${modelo}`, { marca, modelo });
  });
  return [...v.values()];
}
/** O índice só com as peças de UM carro, como o /dados/carro/<k>.json que o navegador baixa (pages/dados/carro/[k].json.ts:
 *  as colunas recortadas nas posições do carro, os mapas esparsos renumerados). A lista do conserto e as vistas do
 *  Raio-x contam nele, não no índice inteiro. */
export function indiceDoCarro(ix: Indice, marca: string, modelo: string): Indice {
  const N = ix.id.length;
  const ks = ix.id.map((_, k) => k).filter((k) => ix.marcas[ix.b[k]] === marca && (ix.ms?.[String(k)] ?? [ix.m[k]]).includes(modelo));
  const novo = new Map(ks.map((k, i) => [String(k), String(i)]));
  const out: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(ix)) {
    if (Array.isArray(v) && v.length === N) out[chave] = ks.map((k) => v[k]);
    else if (typeof v === 'string' && v.length === N && chave !== 'updated') out[chave] = ks.map((k) => v[k]).join('');
    else if (v && typeof v === 'object' && !Array.isArray(v) && ['ms', 'ys', 'dif'].includes(chave)) {
      out[chave] = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => novo.has(k)).map(([k, w]) => [novo.get(k), w]));
    } else out[chave] = v;
  }
  return out as Indice;
}
