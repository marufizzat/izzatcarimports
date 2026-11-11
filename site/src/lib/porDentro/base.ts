// As vistas "por dentro" do Raio-x (2º nível: cada parte do carro se abre numa vista explodida). O que as tabelas de
// todas as vistas têm em comum: o formato de um PONTO QUENTE (uma peça da arte, desenhada na forma dela, que leva ao
// link EXATO do catálogo daquele tipo) e a conta de quantas peças cada ponto tem, pela MESMA busca do catálogo.
// Uma tabela por vista (lib/raioXFrente.ts, o piloto, e lib/porDentro/<vista>.ts), baixada só quando a vista abre.
// Sem node:fs e sem valores de lib/busca.ts: roda no build, no teste e no navegador.
import type { Filtros, Lado, Posicao } from '../busca';
import { nomeEh, type Eh } from '../raioX';

export type PontoQuente = {
  k: string;
  /** o nome que aparece ("Farol esquerdo") */
  nome: string;
  /** como a mensagem do WhatsApp fala dela, com o artigo ("o farol esquerdo"): a peça sem anúncio, "a gente procura" */
  procuro: string;
  /** onde fica o número (arte estreita) e de onde sai o rótulo, em pixels da arte: em cima da peça */
  ancora: [number, number];
  /** a forma da peça na arte (uma peça em 2 lugares, como os faróis de milha: 2 polígonos) */
  poligonos: string[];
  /** o tipo do catálogo (sem ele: peça de pátio, o estoque não tem esse tipo) */
  tipo?: string; sub?: string; lado?: Lado; pos?: Posicao;
  /** o tipo do estoque junta a peça do desenho e os acessórios dela ("Escapamentos" só com defletor e atuador;
   *  "Airbags, Módulos e Sensores" só com sensor): qual NOME é a peça desenhada (a regra de lib/raioX.ts, `nomeEh`).
   *  Sem nenhuma peça assim no link, o ponto é de pátio ("a gente procura"), não um link para outra coisa. */
  eh?: Eh | Eh[];
  /** a peça que DIZ esta posição não é a do desenho (a alma TRASEIRA na vista da frente): o estoque quase nunca escreve
   *  "dianteiro", então o link segue sem posição, mas um ponto só com peça da outra ponta vira pátio */
  fora?: Posicao;
};

/** O carro das contas (o do catálogo: marca, modelo e, se houver, o ano). */
export type CarroDoQuente = Partial<Pick<Filtros, 'marca' | 'modelo' | 'ano'>>;

/** Os filtros do catálogo de um ponto quente (os do link). */
export const filtrosDoQuente = (p: PontoQuente, carro: CarroDoQuente = {}): Filtros =>
  ({ ...carro, tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos, ordem: 'novos' });

/** A peça do link É a do desenho do ponto? Sem regra no ponto, toda peça do link é. */
export const ehDoPonto = (p: PontoQuente, it: { n?: string; pos?: string }): boolean =>
  (!p.eh || nomeEh(p.eh, it.n ?? '')) && !(p.fora && it.pos === p.fora);

/** Quantas peças cada ponto quente tem, pela busca do catálogo (`procurar` = Busca.procurar): { 'farol-esquerdo': 4 }.
 *  O número é o do link (o catálogo com os filtros do ponto). Ponto de pátio (sem tipo): 0. Ponto com regra de nome ou
 *  de posição (`eh`, `fora`) cujo link não tem NENHUMA peça que seja a do desenho: 0 também (revisão 15, P2-2: o
 *  "Escapamento" abria um atuador e dois defletores; os "Airbags" do XC60, sensores) — o ponto fica cinza e vira o
 *  pedido "a gente procura no pátio". */
export function contarPontos(procurar: (f: Filtros) => { id: string; n?: string; pos?: string }[], carro: CarroDoQuente, pontos: PontoQuente[]): Record<string, number> {
  return Object.fromEntries(pontos.map((p) => {
    if (!p.tipo) return [p.k, 0];
    const itens = procurar(filtrosDoQuente(p, carro));
    return [p.k, (p.eh || p.fora) && !itens.some((it) => ehDoPonto(p, it)) ? 0 : itens.length];
  }));
}
