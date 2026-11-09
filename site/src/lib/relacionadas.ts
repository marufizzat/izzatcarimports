// "Do mesmo carro" na página da peça: primeiro as peças da MESMA GERAÇÃO do carro (anos que se
// sobrepõem), as da mesma família/subfamília na frente. Outra geração só entra para completar quando
// faltam peças, e sempre num grupo à parte, com o nome dito ("Outros anos do Golf").
// Funções puras (recebem a lista do modelo), para os testes rodarem sem o build.
import type { Peca } from './dados';

type Anos = [number, number];

/** Parte da faixa MENOR que cai dentro da outra, de 0 a 1. [2014, 2021] x [2013, 2020] = 7/8. */
export function sobreposicao(a: Anos, b: Anos): number {
  const ini = Math.max(a[0], b[0]);
  const fim = Math.min(a[1], b[1]);
  if (fim < ini) return 0;
  const menor = Math.min(a[1] - a[0], b[1] - b[0]) + 1;
  return (fim - ini + 1) / menor;
}

/** Mesma geração: metade (ou mais) da faixa menor dentro da outra. Só encostar não basta:
 *  Golf 1999–2014 e Golf 2014–2021 dividem um ano só (1/8) e são gerações diferentes. */
export function mesmaGeracao(a: Anos | null | undefined, b: Anos | null | undefined): boolean {
  return !!a && !!b && sobreposicao(a, b) >= 0.5;
}

export type DoCarro = {
  /** Mesma geração (ou, se a peça não tem ano, todas do modelo). */
  mesma: Peca[];
  /** Outros anos (sem sobreposição suficiente), só para completar quando a mesma geração tem poucas.
   *  Peça sem ano não entra aqui: não dá para dizer que é de "outros anos". */
  outras: Peca[];
  /** A peça não tem ano: não dá para separar geração (a página pede para conferir o ano). */
  semAno: boolean;
};

export const MAX_CARRO = 8;
/** Com menos que isto da mesma geração, completa com outros anos (em grupo separado). */
export const MIN_MESMA = 5;

/** Ordem: mesma subfamília (na mesma família), depois mesma família, depois o resto; empate pelo nome. */
export function doMesmoCarro(p: Peca, doModelo: Peca[], max = MAX_CARRO, minimo = MIN_MESMA): DoCarro {
  const nivel = (x: Peca) => (x.c === p.c ? (x.s && x.s === p.s ? 0 : 1) : 2);
  const porNome = (a: Peca, b: Peca) => a.n.localeCompare(b.n, 'pt-BR') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const outros = doModelo.filter((x) => x.id !== p.id);
  if (!p.y) {
    const todas = [...outros].sort((a, b) => nivel(a) - nivel(b) || porNome(a, b));
    return { mesma: todas.slice(0, max), outras: [], semAno: true };
  }
  const y = p.y;
  const mesma = outros.filter((x) => mesmaGeracao(y, x.y)).sort((a, b) => nivel(a) - nivel(b) || porNome(a, b)).slice(0, max);
  if (mesma.length >= minimo) return { mesma, outras: [], semAno: false };
  // outros anos: os mais perto primeiro (peça sem ano fica de fora: não é "outro ano")
  const distancia = (x: Peca) => (x.y ? Math.min(Math.abs(x.y[0] - y[0]), Math.abs(x.y[1] - y[1])) : 999);
  const outras = outros
    .filter((x) => !!x.y && !mesmaGeracao(y, x.y))
    .sort((a, b) => nivel(a) - nivel(b) || distancia(a) - distancia(b) || porNome(a, b))
    .slice(0, max - mesma.length);
  return { mesma, outras, semAno: false };
}
