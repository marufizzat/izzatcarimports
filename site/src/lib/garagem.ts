// Garagem "Meu carro": marca -> modelo -> contagem de peças (total e por ano), montada no build.
// Uma fonte só para o /dados/meu-carro.json (navegador) e para a abertura (grade de marcas já no HTML).
// As marcas, a ordem e o total de cada uma vêm de marcasVisiveis() (lib/dados.ts), a MESMA lista da
// nuvem de marcas da home: "Ver todas as N marcas" bate com os N cartões, e "Ver todas as X peças da
// Volvo" bate com o catálogo filtrado pela marca. A contagem por ano usa a regra do catálogo
// (ano dentro da faixa da peça). Marca sem modelo lido no título (ex.: Mini) vem com modelos = [].
// A peça que serve em 2+ carros ("Volvo S60 Xc60") conta em cada um, com a faixa de anos daquele carro.
// Arte do carro (o "cartão do seu carro" da abertura): a mesma public/arte/v2/carro-<k>.webp do /carros, com o k do
// resumo; `as` = as larguras do srcset (só se as variantes foram feitas da arte atual, lib/variantes.ts).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pecas, marcasVisiveis, logoInfo, resumo } from './dados';
import { modelosDa, anosNoModelo } from './meuCarro';
import { srcsetArte } from './variantes';

/** a = chave da arte (/arte/v2/carro-<a>.webp), as = larguras do srcset ([600, 900, 1200]: -600, -900 e a inteira). */
export type ModeloG = { n: string; c: number; ya: [number, number][]; a?: string; as?: number[] };
/** logo = arquivo com as cores da marca; lw/lh = tamanho de exibição dentro do disco. */
export type MarcaG = { n: string; k: string; logo: string | null; lw: number; lh: number; c: number; modelos: ModeloG[] };
export type GaragemG = { v: number; total: number; marcas: MarcaG[] };

/** Caixa do logo dentro do disco: logo largo fica largo, logo redondo fica redondo. */
export const LOGO_CAIXA: [number, number] = [46, 34];

let memo: GaragemG | null = null;

/** A chave do carro ("Honda" + "HR-V" -> "honda-hr-v"): a MESMA conta do chave_url() do preparar_dados.py (o teste
 *  confere contra todos os carros do resumo). */
export const chaveCarro = (b: string, m: string) =>
  `${b} ${m}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Arte do carro (marca + modelo exatamente como nos dados), se existir. */
function arteDo(b: string, m: string): Pick<ModeloG, 'a' | 'as'> {
  const r = resumo();
  // o apelido salvo (C180 -> Classe C) usa a arte do principal; o modelo com poucas peças (sem página /carros/<k>.html,
  // fora do resumo) usa a chave que a página dele teria: a arte vale no seletor e na abertura mesmo sem a página
  const k = r.carros.find((c) => c.b === b && c.m === m)?.k ?? r.aliases?.find((a) => a.b === b && a.de === m)?.para ?? chaveCarro(b, m);
  if (!k || !existsSync(join(process.cwd(), 'public', 'arte', 'v2', `carro-${k}.webp`))) return {};
  const ss = srcsetArte(`/arte/v2/carro-${k}.webp`);
  const as = ss ? [...ss.matchAll(/ (\d+)w/g)].map((x) => Number(x[1])) : [];
  return as.length ? { a: k, as } : { a: k };
}

export function garagem(): GaragemG {
  if (memo) return memo;
  const lista = marcasVisiveis();
  // apelido de carro unido (C180, New Fiesta): sai do seletor (a peça conta no principal); o Meu carro salvo com ele segue
  const apelidos = new Set((resumo().aliases ?? []).map((a) => `${a.b}|${a.de}`));
  const modelos = new Map<string, Map<string, { n: string; c: number; ya: Map<number, number> }>>(lista.map((m) => [m.n, new Map()]));
  for (const p of pecas()) {
    const doMarca = p.b && p.m ? modelos.get(p.b) : undefined;
    if (!doMarca) continue;
    for (const m of modelosDa(p)) {
      if (apelidos.has(`${p.b}|${m}`)) continue;
      let mo = doMarca.get(m);
      if (!mo) { mo = { n: m, c: 0, ya: new Map() }; doMarca.set(m, mo); }
      mo.c++;
      const a = anosNoModelo(p, m);
      if (a) for (let y = Math.max(1950, a[0]); y <= Math.min(2035, a[1]); y++) mo.ya.set(y, (mo.ya.get(y) ?? 0) + 1);
    }
  }
  const marcas = lista.map((m): MarcaG => {
    const l = logoInfo(m.k, LOGO_CAIXA[0], LOGO_CAIXA[1]);
    return {
      n: m.n,
      k: m.k,
      logo: l?.src ?? null,
      lw: l?.w ?? 0,
      lh: l?.h ?? 0,
      c: m.c,
      modelos: [...modelos.get(m.n)!.values()]
        .sort((a, b) => b.c - a.c || a.n.localeCompare(b.n, 'pt-BR'))
        .map((mo) => ({ n: mo.n, c: mo.c, ya: [...mo.ya.entries()].sort((a, b) => b[0] - a[0]), ...arteDo(m.n, mo.n) })),
    };
  });
  memo = { v: 3, total: pecas().length, marcas };
  return memo;
}
