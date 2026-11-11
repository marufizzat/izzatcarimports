// Só para os testes: os nomes de bloco e de tipo de peça que o ../preparar_dados.py CONHECE (os que ele pode gravar no
// índice), lidos do próprio arquivo. Um tipo some do /dados/busca.json quando a última peça dele vende (isso acontece
// toda semana com os tipos de 1 ou 2 peças: eletroventilador, capô, intercooler); o nome continua valendo, a linha do
// Raio-x só fica sem peça ("a gente procura no pátio"). O teste que exigia o nome NO ÍNDICE DO DIA travava a
// publicação do robô nesse dia; conferir contra esta lista pega o que importa (acento errado, tipo renomeado) com
// qualquer estoque.
import { readFileSync, existsSync } from 'node:fs';

const ARQ = '../preparar_dados.py';
let fonte: string | null = null;
/** O preparar_dados.py está à mão? (no robô e no Mac, sim; num pacote só com a pasta site/, não) */
export const temFonteDosNomes = () => existsSync(ARQ);
/** O nome (de bloco ou de tipo) aparece inteiro no preparar_dados.py, como um nome: entre aspas ou entre as barras
 *  das listas de tipos de cada bloco. */
export function nomeConhecido(nome: string): boolean {
  fonte ??= readFileSync(ARQ, 'utf-8');
  const n = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(["'|]|^)[ \\t]*${n}[ \\t]*(["'|]|$)`, 'm').test(fonte);
}
/** O nome vale: está no índice de agora ou é um nome que o preparar_dados.py conhece. Sem o arquivo à mão, só o
 *  índice decide (o teste de antes). */
export const nomeVale = (noIndice: ReadonlySet<string>, nome: string) => noIndice.has(nome) || (temFonteDosNomes() && nomeConhecido(nome));
