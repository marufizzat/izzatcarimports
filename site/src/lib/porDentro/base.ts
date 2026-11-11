// As vistas "por dentro" do Raio-x (2º nível: cada parte do carro se abre numa vista explodida). O que as tabelas de
// todas as vistas têm em comum: o formato de um PONTO QUENTE (uma peça da arte, desenhada na forma dela, que leva ao
// link EXATO do catálogo daquele tipo) e a conta de quantas peças cada ponto tem, pela MESMA busca do catálogo.
// Uma tabela por vista (lib/raioXFrente.ts, o piloto, e lib/porDentro/<vista>.ts), baixada só quando a vista abre.
// Sem node:fs e sem valores de lib/busca.ts: roda no build, no teste e no navegador.
import type { Filtros, Lado, Posicao } from '../busca';

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
};

/** O carro das contas (o do catálogo: marca, modelo e, se houver, o ano). */
export type CarroDoQuente = Partial<Pick<Filtros, 'marca' | 'modelo' | 'ano'>>;

/** Os filtros do catálogo de um ponto quente (os do link). */
export const filtrosDoQuente = (p: PontoQuente, carro: CarroDoQuente = {}): Filtros =>
  ({ ...carro, tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos, ordem: 'novos' });

/** Quantas peças cada ponto quente tem, pela busca do catálogo (`procurar` = Busca.procurar): { 'farol-esquerdo': 4 }.
 *  Ponto de pátio (sem tipo): 0. */
export function contarPontos(procurar: (f: Filtros) => { id: string }[], carro: CarroDoQuente, pontos: PontoQuente[]): Record<string, number> {
  return Object.fromEntries(pontos.map((p) => [p.k, p.tipo ? procurar(filtrosDoQuente(p, carro)).length : 0]));
}
