// Artes dos blocos de peças (preparar_dados.py: BLOCOS). Só no build: lê public/.
// - cat-<k>.webp: o cartão da grade da home (800×800, com o nome desenhado na arte);
// - topo-cat-<k>.webp: o topo da página da categoria (a mesma arte sem a faixa do nome).
// Arte que ainda não chegou: null (a grade mostra o nome num fundo de estúdio; o topo fica só com o texto).
// As artes entram com scripts/instalar-cats.mjs.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PUB = join(process.cwd(), 'public');
const existe = (arq: string) => existsSync(join(PUB, arq));

/** "/arte/v2/cat-<k>.webp" se a arte existe; senão null. */
export function arteCartao(k: string): string | null {
  const a = `/arte/v2/cat-${k}.webp`;
  return existe(a) ? a : null;
}

/** Largura e altura de um .webp (cabeçalho VP8, VP8L ou VP8X), sem decodificar a imagem. */
export function tamanhoWebp(buf: Uint8Array): { w: number; h: number } | null {
  const txt = (i: number, n: number) => String.fromCharCode(...buf.subarray(i, i + n));
  if (buf.length < 30 || txt(0, 4) !== 'RIFF' || txt(8, 4) !== 'WEBP') return null;
  const tipo = txt(12, 4);
  const u16 = (i: number) => buf[i] | (buf[i + 1] << 8);
  const u24 = (i: number) => buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16);
  if (tipo === 'VP8X') return { w: 1 + u24(24), h: 1 + u24(27) };
  if (tipo === 'VP8 ') return { w: u16(26) & 0x3fff, h: u16(28) & 0x3fff };
  if (tipo === 'VP8L') {
    const b = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >>> 14) & 0x3fff) };
  }
  return null;
}

/** Topo da página da categoria: a arte e o tamanho real dela (a altura do recorte muda de uma arte para outra). */
export function arteTopo(k: string): { src: string; w: number; h: number } | null {
  const src = `/arte/v2/topo-cat-${k}.webp`;
  if (!existe(src)) return null;
  const t = tamanhoWebp(readFileSync(join(PUB, src)));
  return t ? { src, ...t } : null;
}

/** Bento da grade sem buraco: quantos cartões grandes (2×2) e se o cartão final ("Ver o catálogo inteiro")
 *  entra, para `n` cartões fecharem a última fileira de `colunas`. Prefere 2 grandes. */
export function bento(n: number, colunas: number): { grandes: number; todas: boolean } {
  for (const grandes of [2, 3, 1, 4, 0]) {
    if (grandes > n) continue;
    for (const todas of [false, true]) if ((n + 3 * grandes + (todas ? 1 : 0)) % colunas === 0) return { grandes, todas };
  }
  return { grandes: 0, todas: true };
}
