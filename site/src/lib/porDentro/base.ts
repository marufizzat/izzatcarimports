// As vistas "por dentro" do Raio-x (2º nível: cada parte do carro se abre numa vista explodida). O que as tabelas de
// todas as vistas têm em comum: o formato de um PONTO QUENTE (uma peça da arte, desenhada na forma dela, que leva ao
// link EXATO do catálogo daquele tipo) e a conta de quantas peças cada ponto tem, pela MESMA busca do catálogo.
// Uma tabela por vista (lib/raioXFrente.ts, o piloto, e lib/porDentro/<vista>.ts), baixada só quando a vista abre.
// Sem node:fs e sem valores de lib/busca.ts: roda no build, no teste e no navegador.
import type { Filtros, Item, Lado, Posicao } from '../busca';
import { nomeEh, codigoDaFoto, type Eh } from '../raioX';
import { anosTexto } from '../whats';
import { nomeModelos } from '../meuCarro';

/** O título do ponto é o próprio tipo do catálogo ("Painel (acabamentos)"): toda peça do link é a do título. */
export const TIPO_INTEIRO = 'tipo-inteiro' as const;

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
  /** Qual NOME é a peça do título do ponto (a regra de lib/raioX.ts, `nomeEh`, a MESMA da lista do conserto: a 1ª
   *  palavra do nome é a da peça). TODO ponto com tipo diz a sua (revisão 16, P2-1: antes só alguns diziam, e os
   *  outros contavam o acessório como se fosse a peça: "Motor do teto solar · 1" era uma mangueira de drenagem,
   *  "Fechadura da tampa · 4" não tinha fechadura, "Tampão do porta-malas · 6" eram suportes). Sem NENHUMA peça assim
   *  no link, o ponto é de pátio ("a gente procura"), não um link para outra coisa. `TIPO_INTEIRO`: o título do ponto
   *  é o próprio tipo do catálogo (um grupo de acabamentos), toda peça do link vale. */
  eh?: Eh | Eh[] | typeof TIPO_INTEIRO;
  /** a peça que DIZ esta posição não é a do desenho (a alma TRASEIRA na vista da frente): o estoque quase nunca escreve
   *  "dianteiro", então o link segue sem posição, mas um ponto só com peça da outra ponta vira pátio */
  fora?: Posicao;
};

/** O carro das contas (o do catálogo: marca, modelo e, se houver, o ano). */
export type CarroDoQuente = Partial<Pick<Filtros, 'marca' | 'modelo' | 'ano'>>;

/** Os filtros do catálogo de um ponto quente (os do link). */
export const filtrosDoQuente = (p: PontoQuente, carro: CarroDoQuente = {}): Filtros =>
  ({ ...carro, tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos, ordem: 'novos' });

/** A peça do link É a do título do ponto? Ponto sem regra (não deve existir: o teste cobra): nenhuma é. */
export const ehDoPonto = (p: PontoQuente, it: { n?: string; pos?: string }): boolean =>
  (p.eh === TIPO_INTEIRO || nomeEh(p.eh, it.n ?? '')) && !(p.fora && it.pos === p.fora);

/** A conta de um ponto: `n` = o número que a vista mostra (0 = "a gente procura"); `ligadas` = as peças do link quando
 *  NENHUMA delas é a do título (o 3º estado, ajuste da revisão 16): a loja não tem a peça do título, mas tem peça
 *  ligada a ela (a tampa e a moldura da grade, o absorvedor da alma, as molduras do console). A linha continua
 *  dizendo "a gente procura" e mostra "N ligadas"; as peças aparecem no próprio painel, nunca num link do catálogo.
 *  - com a peça do título no link: `n` = o link inteiro, `ligadas` vazia (o catálogo mostra tudo, como sempre);
 *  - sem a peça do título: `n` = 0 e `ligadas` = o link, menos a peça que DIZ a posição da outra ponta (`fora`: a alma
 *    TRASEIRA não é peça ligada da frente). Nada some do Raio-x: título + ligadas = o que o link mostra, fora essa. */
export type ContaPonto<T> = { n: number; ligadas: T[] };
export function contarComLigadas<T extends { id: string; n?: string; pos?: string }>(procurar: (f: Filtros) => T[], carro: CarroDoQuente, pontos: PontoQuente[]): Record<string, ContaPonto<T>> {
  return Object.fromEntries(pontos.map((p): [string, ContaPonto<T>] => {
    if (!p.tipo) return [p.k, { n: 0, ligadas: [] }];
    const itens = procurar(filtrosDoQuente(p, carro));
    if (itens.some((it) => ehDoPonto(p, it))) return [p.k, { n: itens.length, ligadas: [] }];
    return [p.k, { n: 0, ligadas: itens.filter((it) => !(p.fora && it.pos === p.fora)) }];
  }));
}

/** Quantas peças cada ponto quente tem, pela busca do catálogo (`procurar` = Busca.procurar): { 'farol-esquerdo': 4 }.
 *  Ponto de pátio (sem tipo): 0. Ponto cujo link não tem NENHUMA peça que seja a do título (`ehDoPonto`: a regra do
 *  nome e a guarda de posição): 0 também — o ponto fica cinza e vira o pedido "a gente procura no pátio" (revisão 15,
 *  P2-2, e revisão 16, P2-1: vale para todo ponto). Com a peça do título no link, o número é o do link (o catálogo
 *  com os filtros do ponto). */
export function contarPontos(procurar: (f: Filtros) => { id: string; n?: string; pos?: string }[], carro: CarroDoQuente, pontos: PontoQuente[]): Record<string, number> {
  const c = contarComLigadas(procurar, carro, pontos);
  return Object.fromEntries(pontos.map((p) => [p.k, c[p.k].n]));
}

/** A peça ligada como o painel a mostra (o mínimo: o arquivo do estoque inteiro leva as de quem não tem carro). */
export type Ligada = { id: string; n: string; h: string; p: number; carro: string; anos: string; f: string };
export function ligadaDe(it: Item, fotoDe: (it: Item) => string): Ligada {
  return { id: it.id, n: it.n, h: it.h, p: it.p, carro: nomeModelos(it), anos: anosTexto(it.y), f: codigoDaFoto(fotoDe(it)) };
}
/** "1 ligada", "3 ligadas" (o que a linha mostra ao lado do "a gente procura"). */
export const ligadasTxt = (n: number) => `${n} ${n === 1 ? 'ligada' : 'ligadas'}`;
