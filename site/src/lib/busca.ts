// Motor de busca do catalogo — roda no navegador, sobre public/dados/busca.json.
// Acha por nome da peca, carro ou CODIGO gravado; entende "xc60" = "xc 60" = "XC-60",
// tolera erro de digitacao e combina com os filtros (marca, modelo, ano, tipo, preco).
import MiniSearch from 'minisearch';
import { serveNoModelo, anosNoModelo } from './meuCarro';

export type Indice = {
  v: number; updated: string; marcas: string[]; familias: string[]; tipos: string[];
  id: string[]; t: string[]; n: string[]; p: number[]; i: string[]; h: string[]; f: string;
  b: number[]; m: string[]; y: ([number, number] | 0)[]; c: number[]; s: number[]; o: string[];
  e?: string; // capa de estúdio por peça: '0' nenhuma, '1' automática, '2' maquiada (estudio-pro)
  // peça que serve em 2+ carros: {índice: ["S60", "XC60"]} e, quando a faixa muda, {índice: [[2018, 2024], ...]}
  ms?: Record<string, string[]>; ys?: Record<string, ([number, number] | null)[]>;
};
export type Item = {
  k: number; id: string; t: string; n: string; p: number; i: string; h: string; f: boolean;
  b: string; m: string; y: [number, number] | null; c: string; s: string; o: string; e: string;
  ms?: string[]; ys?: ([number, number] | null)[];
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

const dentro = (ano: number, y: [number, number] | null) => (y ? ano >= y[0] && ano <= y[1] : false);

/** Contagem por modelo (a peça de 2+ carros conta em cada um), da maior para a menor. */
function contarModelos(itens: Item[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of itens) for (const k of it.ms ?? [it.m]) if (k) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export class Busca {
  itens: Item[];
  /** true quando nenhuma peca tinha TODAS as palavras e a lista mostra as mais proximas */
  aproximado = false;
  // Fluidez: o índice de texto (MiniSearch, ~5 mil peças) não é montado de uma vez no construtor.
  // Sem texto na busca (catálogo aberto, filtros) ele nem é preciso; prepararIndice() monta aos poucos,
  // em pedaços pequenos entre as tarefas da página; quem precisar antes (this.ms) completa na hora. O índice
  // final é o mesmo (as peças entram na mesma ordem).
  private _ms: MiniSearch<Item> | null = null;
  private _feitos = 0;
  // a mesma busca de texto se repete muitas vezes (lista + cada faceta): guarda as últimas
  private _textos = new Map<string, { base: Item[]; aproximado: boolean }>();
  private _novos: Item[] | null = null;
  constructor(ix: Indice) {
    this.itens = ix.id.map((id, k) => ({
      k, id, t: ix.t[k], n: ix.n[k], p: ix.p[k], i: ix.i[k], h: ix.h[k], f: ix.f[k] === '1', e: ix.e?.[k] || '0',
      b: ix.marcas[ix.b[k]] ?? '', m: ix.m[k], y: ix.y[k] || null, ms: ix.ms?.[k], ys: ix.ys?.[k],
      c: ix.familias[ix.c[k]] ?? '', s: ix.tipos[ix.s[k]] ?? '', o: ix.o[k],
    }));
  }

  private indice(): MiniSearch<Item> {
    return (this._ms ??= new MiniSearch<Item>({
      idField: 'k',
      fields: ['n', 't', 'carro', 's', 'o'],
      extractField: (doc, campo) =>
        campo === 'carro' ? `${doc.b} ${(doc.ms ?? [doc.m]).join(' ')}` : (doc as any)[campo] ?? '',
      tokenize: (s) => termos(s),
      processTerm: (t) => (t.length ? t : null),
      searchOptions: {
        boost: { n: 3, carro: 2, o: 2.5, s: 1, t: 1 },
        prefix: (t) => t.length >= 3,
        fuzzy: (t) => (t.length >= 5 && !/\d/.test(t) ? 0.2 : false),
        combineWith: 'AND',
      },
    }));
  }

  /** O índice de texto completo (completa agora o que faltar). */
  get ms(): MiniSearch<Item> {
    const ms = this.indice();
    while (this._feitos < this.itens.length) ms.add(this.itens[this._feitos++]);
    return ms;
  }

  /** Monta o índice aos poucos (~8 ms por vez, cedendo a vez para a página entre os pedaços). */
  async prepararIndice(): Promise<void> {
    const ms = this.indice();
    while (this._feitos < this.itens.length) {
      const fim = performance.now() + 8;
      while (this._feitos < this.itens.length && performance.now() < fim) ms.add(this.itens[this._feitos++]);
      if (this._feitos < this.itens.length) await new Promise((r) => setTimeout(r, 0));
    }
  }

  /** Peças da busca de texto, na ordem de relevância (com as mais próximas quando nenhuma tem todas as palavras). */
  private porTexto(texto: string): { base: Item[]; aproximado: boolean } {
    let m = this._textos.get(texto);
    if (!m) {
      let r = this.ms.search(texto);
      let aproximado = false;
      if (!r.length) { r = this.ms.search(texto, { combineWith: 'OR' }).slice(0, 300); aproximado = r.length > 0; }
      m = { base: r.map((x) => this.itens[x.id as number]), aproximado };
      this._textos.set(texto, m);
      if (this._textos.size > 24) this._textos.delete(this._textos.keys().next().value!);
    }
    return m;
  }

  /** Todas as peças, das que chegaram agora para as mais antigas (os ids do ML crescem). */
  private porNovos(): Item[] {
    return (this._novos ??= [...this.itens].sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)));
  }

  procurar(f: Filtros): Item[] {
    let base: Item[];
    let comTexto = false;
    const q = (f.q || '').trim();
    let anoQ: number | undefined;
    let texto = q;
    // um ano solto na busca ("palio 2010") vira filtro de ano
    const mAno = q.match(/\b(19[89]\d|20[0-3]\d)\b/);
    if (mAno && !(/peugeot/i.test(q) && /\b(2008|3008|5008)\b/.test(q))) { anoQ = Number(mAno[1]); texto = q.replace(mAno[0], ' ').trim(); }
    const o = f.ordem || 'rel';
    if (texto) {
      const r = this.porTexto(texto);
      this.aproximado = r.aproximado;
      base = r.base;
      comTexto = true;
    } else {
      this.aproximado = false;
      // sem texto, "relevantes" e "chegaram agora" são a mesma ordem: a lista já vem ordenada
      base = o === 'rel' || o === 'novos' ? this.porNovos() : this.itens;
    }

    const ano = f.ano || anoQ;
    const faixa = FAIXAS.find((x) => x[0] === f.preco);
    const out = base.filter((it) =>
      (!f.marca || it.b === f.marca) &&
      (!f.modelo || serveNoModelo(it, f.modelo)) &&
      (!ano || dentro(ano, f.modelo ? anosNoModelo(it, f.modelo) : it.y)) &&
      (!f.tipo || it.c === f.tipo) &&
      (!faixa || (it.p >= faixa[2] && it.p < faixa[3])) &&
      (!f.frete || it.f));

    if (o === 'asc') out.sort((a, b) => a.p - b.p);
    else if (o === 'desc') out.sort((a, b) => b.p - a.p);
    else if (o === 'novos' && comTexto)
      out.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
    return out;
  }

  // contagem de cada faceta SEM o proprio filtro (igual ao Mercado Livre)
  facetas(f: Filtros) {
    const aprox = this.aproximado; // as contagens não mexem no aviso de "mais próximas" da lista
    const conta = (sem: keyof Filtros, chave: (i: Item) => string) => {
      const m = new Map<string, number>();
      for (const it of this.procurar({ ...f, [sem]: undefined, ordem: 'rel' })) {
        const k = chave(it); if (k) m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const semPreco = this.procurar({ ...f, preco: undefined, ordem: 'rel' });
    const r = {
      marcas: conta('marca', (i) => i.b),
      modelos: f.marca ? contarModelos(this.procurar({ ...f, modelo: undefined, ordem: 'rel' })) : [],
      tipos: conta('tipo', (i) => i.c),
      precos: FAIXAS.map(([k, rot, a, b]) => [k, rot, semPreco.filter((i) => i.p >= a && i.p < b).length] as const),
    };
    this.aproximado = aprox;
    return r;
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

/** Capa da peça na busca: a de estúdio quando existe (igual às páginas), senão a foto do ML. */
export function capaItem(it: Item, tam = 'O') {
  if (it.e === '2') return `/estudio-pro/${it.id}.webp`;
  if (it.e === '1') return `/estudio/${it.id}.webp`;
  return foto(it.i, tam);
}
