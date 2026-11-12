// srcset das artes grandes de public/arte/v2/ com as variantes menores (scripts/variantes-imagens.mjs). Só no build.
// A variante só entra se foi feita da arte ATUAL (hash em src/data/variantes-arte.json); arte nova ou trocada sem o
// script rodar: sem srcset (só a arte inteira), nunca a variante velha.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { larga } from './escalaTela';

const RAIZ = process.cwd();
const PUB = join(RAIZ, 'public');
export type Entrada = { h: string; w: number; v: number[] };
let manifesto: Record<string, Entrada> | null = null;
const memo = new Map<string, string | undefined>();

function lerManifesto(): Record<string, Entrada> {
  if (manifesto) return manifesto;
  const arq = join(RAIZ, 'src', 'data', 'variantes-arte.json');
  manifesto = existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf-8')) : {};
  return manifesto!;
}

/** O srcset de `src` com as variantes do manifesto, se elas foram feitas da arte atual (senão undefined).
 *  `pub` e `manifesto` vêm de fora só no teste. */
export function montarSrcset(src: string, pub: string, man: Record<string, Entrada>): string | undefined {
  const e = man[src.slice(src.lastIndexOf('/') + 1)];
  const arq = join(pub, src);
  if (!e || !e.v.length || !existsSync(arq)) return undefined;
  const h = createHash('sha1').update(readFileSync(arq)).digest('hex').slice(0, 12);
  const nome = (w: number) => src.replace(/\.webp$/, `-${w}.webp`);
  if (h !== e.h || !e.v.every((w) => existsSync(join(pub, nome(w))))) return undefined;
  return [...e.v.map((w) => `${nome(w)} ${w}w`), `${src} ${e.w}w`].join(', ');
}

/** "/arte/v2/carro-x.webp" -> "/arte/v2/carro-x-600.webp 600w, /arte/v2/carro-x-900.webp 900w, /arte/v2/carro-x.webp 1200w"
 *  (ou undefined: sem variante em dia, o <img> fica só com o src). */
export function srcsetArte(src: string): string | undefined {
  if (!memo.has(src)) memo.set(src, montarSrcset(src, PUB, lerManifesto()));
  return memo.get(src);
}

/** Atributos para o <img> ({...srcArte(src, sizes)}): srcset e sizes juntos, ou nada (só o src). */
export function srcArte(src: string, sizes: string): { srcset?: string; sizes?: string } {
  const srcset = srcsetArte(src);
  return srcset ? { srcset, sizes } : {};
}

// sizes de cada lugar, tirados do CSS (moldura = min(100vw - 32px, 1240px); a partir de 768, min(100vw - 64px, 1240px),
// e chega aos 1240 em 1304 px). Um pouco a mais é melhor que a menos: arredondado para cima.
// A medida do PC (o último valor) passa por larga(): na tela larga o site cresce com o zoom da raiz (global.css).
export const SIZES = {
  // /carros (CarrosPatio todos): 2 colunas (gap 10) até 759, 3 (gap 16) até 1179, 4 (gap 18)
  carrosTodos: '(max-width: 759px) calc(50vw - 21px), (max-width: 1179px) calc(33.4vw - 31px), (max-width: 1303px) calc(25vw - 29px), ' + larga(297),
  // home (CarrosPatio): trilho de 80% até 699, 2 colunas (gap 16) até 1079, 3 (gap 18)
  carrosHome: '(max-width: 699px) calc(80vw - 25px), (max-width: 1079px) calc(50vw - 40px), (max-width: 1303px) calc(33.4vw - 33px), ' + larga(402),
  // /carros, topo do PC (some abaixo de 900): metade da caixa (gap 40), vitrine até 620; cv-1 58%, cv-2 e cv-3 46%
  vitrine1: '(max-width: 1303px) calc(29vw - 30px), ' + larga(360),
  vitrine23: '(max-width: 1303px) calc(23vw - 24px), ' + larga(286),
  // topo do carro (TopoArte "meio"): no celular a coluna de 46%; no PC, de 48% até o fim da caixa
  topoCarro: '(max-width: 899px) calc(46vw - 25px), (max-width: 1303px) calc(52vw - 33px), ' + larga(645),
  // topo da categoria (TopoArte "contem"): no celular a coluna de 46%; no PC, a metade direita da caixa
  topoCategoria: '(max-width: 899px) calc(46vw - 25px), (max-width: 1303px) calc(50vw - 32px), ' + larga(620),
  // marca: 3 maiores (gap 12 no celular, 18 no PC)
  marcaPrimeiro: '(max-width: 899px) calc(100vw - 32px), (max-width: 1303px) calc(60vw - 49px), ' + larga(734), // mm-d3 e mm-d1
  marcaDupla: '(max-width: 899px) calc(50vw - 22px), (max-width: 1303px) calc(50vw - 41px), ' + larga(611), // mm-d2
  marcaLado: '(max-width: 899px) calc(50vw - 22px), (max-width: 1303px) calc(40vw - 33px), ' + larga(490), // mm-d3, 2º e 3º
  // marca, os outros carros: 2 colunas (gap 12) até 699, 3 até 1099, 4 (gap 16)
  marcaGrade: '(max-width: 699px) calc(50vw - 22px), (max-width: 1099px) calc(33.4vw - 19px), (max-width: 1303px) calc(25vw - 28px), ' + larga(298),
} as const;

/** Cartão da grade de categorias (home): 2 colunas (gap 10) até 699, 4 (gap 14) até 1079, 5 (gap 14). Os grandes do
 *  bento ocupam 2×2 (g4 no tablet, g5 no PC); com carro salvo eles voltam a 1×1 (a conta fica para cima, sem perda). */
export function sizesCategoria(g4: boolean, g5: boolean): string {
  const tablet = g4 ? 'calc(50vw - 24px)' : 'calc(25vw - 19px)';
  const pc = g5 ? `(max-width: 1303px) calc(40vw - 34px), ${larga(488)}` : `(max-width: 1303px) calc(20vw - 24px), ${larga(237)}`;
  return `(max-width: 699px) calc(50vw - 21px), (max-width: 1079px) ${tablet}, ${pc}`;
}
