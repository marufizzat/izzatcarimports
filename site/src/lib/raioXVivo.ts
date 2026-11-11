// "O Raio-x vivo" (components/v2/RaioX.astro): o carro mostra ONDE chegou peça. A parte do carro onde há uma peça que
// acabou de chegar ganha um anel calmo no ponto e um pontinho na ficha, e o painel dela abre com "Chegou agora: <peça>".
//
// O QUE É "CHEGOU AGORA": a MESMA regra do selo "Chegou agora" dos cartões (components/CartaoPeca.astro) e do trilho
// "Chegou no pátio" da home: a peça está em `resumo().chegou`, os 24 anúncios mais novos do estoque (o número do
// anúncio do Mercado Livre cresce com o tempo: preparar_dados.py). NÃO é o campo `u` da peça: o `u` é o dia da última
// MUDANÇA do anúncio (o lastmod do sitemap), e uma peça antiga com o preço corrigido hoje viraria "nova". Nada aqui
// inventa urgência: sem peça na lista para a parte (ou para o carro da pessoa), nada pulsa e a linha não aparece.
//
// COM CARRO (o salvo na home; na página do carro, o da página, no ano do salvo se é o mesmo modelo): só as peças que
// servem nele, pela MESMA conta do filtro do catálogo (lib/busca.ts: marca igual, serveNoModelo e o ano dentro de
// anosNoModelo). SEM CARRO: as do estoque inteiro ("Chegou no pátio").
// A zona de cada peça é a do painel (zonasDaPeca, lib/raioX.ts): a peça que pulsa numa parte está na lista dela.
// Sem node:fs e sem valores de lib/busca.ts: roda no build (pages/dados/raio-x-vivo.json.ts), no teste e no navegador.
import type { Item } from './busca';
import { serveNoModelo, anosNoModelo } from './meuCarro';
import { zonasDaPeca } from './raioX';

/** O arquivo das peças que chegaram agora, com a zona de cada uma (≤ 24 peças, ~1 KB comprimido): baixado quando a
 *  arte do Raio-x chega perto da tela, com o navegador folgando. */
export const ARQUIVO_VIVO = '/dados/raio-x-vivo.json';

/** Uma peça que chegou agora, como o Raio-x precisa dela: o nome limpo, o endereço (/peca/<h>.html), as zonas onde ela
 *  fica (quase sempre uma) e o carro (os mesmos campos do índice: b, m, y, ms, ys). */
export type PecaViva = {
  id: string; n: string; h: string; z: string[];
  b: string; m: string; y: [number, number] | null; ms?: string[]; ys?: ([number, number] | null)[];
};
export type VivoJson = { v: 1; p: PecaViva[] };

/** No build: as peças de `chegou` (os ids do selo "Chegou agora", da mais nova para a mais antiga) que estão no índice
 *  e têm lugar no carro, na mesma ordem. Peça sem zona (tipo sem lugar certo, peça de porta sem o lado) fica de fora:
 *  o Raio-x não tem onde mostrar. */
export function pecasVivas(chegou: readonly string[], itens: readonly Item[]): PecaViva[] {
  const porId = new Map(itens.map((it) => [it.id, it]));
  const out: PecaViva[] = [];
  for (const id of chegou) {
    const it = porId.get(id);
    if (!it) continue;
    const z = zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).map((x) => x.k);
    if (!z.length) continue;
    const p: PecaViva = { id: it.id, n: it.n, h: it.h, z, b: it.b, m: it.m, y: it.y };
    if (it.ms) p.ms = it.ms;
    if (it.ys) p.ys = it.ys;
    out.push(p);
  }
  return out;
}

/** O carro da pessoa (ou o da página): marca, modelo e, se houver, o ano. */
export type CarroVivo = { b: string; m: string; y?: number | null };

/** A peça serve no carro? A conta do filtro do catálogo (Busca.filtrar): marca igual, o modelo entre os da peça e,
 *  com ano, o ano dentro da faixa da peça NAQUELE modelo (peça sem faixa de anos não passa pelo filtro de ano). */
export function serveNoCarro(p: Pick<PecaViva, 'b' | 'm' | 'y' | 'ms' | 'ys'>, c: CarroVivo): boolean {
  if (p.b !== c.b || !serveNoModelo(p, c.m)) return false;
  if (!c.y) return true;
  const y = anosNoModelo(p, c.m);
  return !!y && c.y >= y[0] && c.y <= y[1];
}

/** A peça que chegou em cada zona (a mais nova: a lista vem da mais nova para a mais antiga). Com `carro`, só as que
 *  servem nele. Zona sem peça nova não aparece no resultado: nela nada pulsa. */
export function vivoPorZona(pecas: readonly PecaViva[], carro?: CarroVivo | null): Record<string, PecaViva> {
  const out: Record<string, PecaViva> = {};
  for (const p of pecas) {
    if (carro && !serveNoCarro(p, carro)) continue;
    for (const k of p.z) out[k] ??= p;
  }
  return out;
}
