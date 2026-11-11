// De onde os testes tiram o estoque (integração da rodada 15, depois que o robô parou a loja por causa de teste que
// dependia das peças do dia). TRÊS fontes, cada uma para um tipo de pergunta:
//  - o VOCABULÁRIO da loja (fixtures/vocabulario.json, gerado de BLOCOS e _TIPOS_DO_BLOCO do preparar_dados.py por
//    ferramentas/vocabulario_loja.py; testes/test_dados.py confere que anda junto): "este nome de bloco/tipo existe?".
//    Nunca perguntar isso ao estoque do dia: o tipo some quando a última peça dele vende.
//  - o ESTOQUE FIXO (fixtures/busca-fixa.json, uma cópia do /dados/busca.json de 11/11/2026, 5.311 peças): tudo que
//    precisa de peça de verdade para existir ("a frente esquerda acha farol esquerdo", "pelo menos N", exemplos com o
//    XC60 2019). Não muda nunca: o teste só quebra quando o CÓDIGO muda.
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
export const ARQ_FIXO = 'testes/fixtures/busca-fixa.json';
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
