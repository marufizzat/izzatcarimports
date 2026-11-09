// Motor de busca do catalogo — roda no navegador, sobre public/dados/busca.json.
// Acha por nome da peca, carro ou CODIGO gravado; entende "xc60" = "xc 60" = "XC-60",
// tolera erro de digitacao e combina com os filtros (marca, modelo, ano, tipo, preco).
import MiniSearch from 'minisearch';

export type Indice = {
  v: number; updated: string; marcas: string[]; familias: string[]; tipos: string[];
  id: string[]; t: string[]; n: string[]; p: number[]; i: string[]; h: string[]; f: string;
  b: number[]; m: string[]; y: ([number, number] | 0)[]; c: number[]; s: number[]; o: string[];
};
export type Item = {
  k: number; id: string; t: string; n: string; p: number; i: string; h: string; f: boolean;
  b: string; m: string; y: [number, number] | null; c: string; s: string; o: string;
};
export type Filtros = {
  q?: string; marca?: string; modelo?: string; ano?: number; tipo?: string;
  preco?: string; frete?: boolean; ordem?: 'rel' | 'asc' | 'desc' | 'novos';
};

export const FAIXAS: [string, string, number, number][] = [
  ['0-100', 'Até R$ 100', 0, 100],
  ['100-250', 'R$ 100 a R$ 250', 100, 250],
  ['250-500', 'R$ 250 a R$ 500', 250, 500],
  ['500-1000', 'R$ 500 a R$ 1.000', 500, 1000],
  ['1000-2500', 'R$ 1.000 a R$ 2.500', 1000, 2500],
  ['2500+', 'Acima de R$ 2.500', 2500, Infinity],
];

export const normal = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "xc 60" e "xc-60" viram tambem "xc60"; "31663477" acha "316-63477".
function termos(texto: string): string[] {
  const base = normal(texto).replace(/[^a-z0-9]+/g, ' ').trim();
  if (!base) return [];
  const ws = base.split(' ');
  const extra: string[] = [];
  for (let i = 0; i < ws.length - 1; i++) {
    if (/^[a-z]{1,3}$/.test(ws[i]) && /^\d{1,3}[a-z]?$/.test(ws[i + 1])) extra.push(ws[i] + ws[i + 1]);
  }
  return [...ws, ...extra];
}

export class Busca {
  itens: Item[];
  /** true quando nenhuma peca tinha TODAS as palavras e a lista mostra as mais proximas */
  aproximado = false;
  ms: MiniSearch<Item>;
  constructor(ix: Indice) {
    this.itens = ix.id.map((id, k) => ({
      k, id, t: ix.t[k], n: ix.n[k], p: ix.p[k], i: ix.i[k], h: ix.h[k], f: ix.f[k] === '1',
      b: ix.marcas[ix.b[k]] ?? '', m: ix.m[k], y: ix.y[k] || null,
      c: ix.familias[ix.c[k]] ?? '', s: ix.tipos[ix.s[k]] ?? '', o: ix.o[k],
    }));
    this.ms = new MiniSearch<Item>({
      idField: 'k',
      fields: ['n', 't', 'carro', 's', 'o'],
      extractField: (doc, campo) =>
        campo === 'carro' ? `${doc.b} ${doc.m}` : (doc as any)[campo] ?? '',
      tokenize: (s) => termos(s),
      processTerm: (t) => (t.length ? t : null),
      searchOptions: {
        boost: { n: 3, carro: 2, o: 2.5, s: 1, t: 1 },
        prefix: (t) => t.length >= 3,
        fuzzy: (t) => (t.length >= 5 && !/\d/.test(t) ? 0.2 : false),
        combineWith: 'AND',
      },
    });
    this.ms.addAll(this.itens);
  }

  procurar(f: Filtros): Item[] {
    let base: Item[];
    let score: Map<number, number> | null = null;
    const q = (f.q || '').trim();
    let anoQ: number | undefined;
    let texto = q;
    // um ano solto na busca ("palio 2010") vira filtro de ano
    const mAno = q.match(/\b(19[89]\d|20[0-3]\d)\b/);
    if (mAno && !(/peugeot/i.test(q) && /\b(2008|3008|5008)\b/.test(q))) { anoQ = Number(mAno[1]); texto = q.replace(mAno[0], ' ').trim(); }
    if (texto) {
      let r = this.ms.search(texto);
      this.aproximado = false;
      if (!r.length) { r = this.ms.search(texto, { combineWith: 'OR' }).slice(0, 300); this.aproximado = r.length > 0; }
      score = new Map(r.map((x) => [x.id as number, x.score]));
      base = r.map((x) => this.itens[x.id as number]);
    } else { base = this.itens; this.aproximado = false; }

    const ano = f.ano || anoQ;
    const faixa = FAIXAS.find((x) => x[0] === f.preco);
    const out = base.filter((it) =>
      (!f.marca || it.b === f.marca) &&
      (!f.modelo || it.m === f.modelo) &&
      (!ano || (it.y ? ano >= it.y[0] && ano <= it.y[1] : false)) &&
      (!f.tipo || it.c === f.tipo) &&
      (!faixa || (it.p >= faixa[2] && it.p < faixa[3])) &&
      (!f.frete || it.f));

    const o = f.ordem || 'rel';
    if (o === 'asc') out.sort((a, b) => a.p - b.p);
    else if (o === 'desc') out.sort((a, b) => b.p - a.p);
    else if (o === 'novos' || (!score && o === 'rel'))
      out.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
    return out;
  }

  // contagem de cada faceta SEM o proprio filtro (igual ao Mercado Livre)
  facetas(f: Filtros) {
    const conta = (sem: keyof Filtros, chave: (i: Item) => string) => {
      const m = new Map<string, number>();
      for (const it of this.procurar({ ...f, [sem]: undefined, ordem: 'rel' })) {
        const k = chave(it); if (k) m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      marcas: conta('marca', (i) => i.b),
      modelos: f.marca ? conta('modelo', (i) => i.m) : [],
      tipos: conta('tipo', (i) => i.c),
      precos: FAIXAS.map(([k, rot, a, b]) => [k, rot,
        this.procurar({ ...f, preco: undefined }).filter((i) => i.p >= a && i.p < b).length] as const),
    };
  }

  sugestoes(q: string, n = 6): Item[] {
    if (q.trim().length < 2) return [];
    return this.ms.search(q, { prefix: true, fuzzy: 0.15 }).slice(0, n).map((x) => this.itens[x.id as number]);
  }
}

export function foto(chave: string, tam = 'V') {
  if (!chave) return '';
  return chave.startsWith('http') ? chave : `https://http2.mlstatic.com/D_${chave}-${tam}.webp`;
}
