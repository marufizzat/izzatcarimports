// Motor de busca do catálogo — roda no navegador sobre public/dados/busca.json (e no build, para a 1ª tela do catálogo).
// Acha por nome da peça, carro ou CÓDIGO gravado; entende "xc60" = "xc 60" = "XC-60", tolera erro de digitação
// (só em palavra sem número) e combina com os filtros (marca, modelo, ano, tipo, preço).
//
// UMA regra para o catálogo (procurar) e para as sugestões ao vivo (sugestoes):
//   1. ano solto na busca ("palio 2010") vira filtro de ano;
//   2. todas as palavras, sem aproximação; se nada, com aproximação (erro de digitação); se ainda nada,
//      as peças com alguma das palavras (aproximado = true: "nada exato, veja as parecidas");
//   3. o carro digitado vem primeiro ("xc60": as do Volvo XC60; "farol compass": as do Jeep Compass);
//   4. a peça cujo nome começa pela palavra buscada sobe ("farol": "Farol esquerdo" antes de "Interruptor farol").
import MiniSearch, { type Query, type SearchResult } from 'minisearch';
import { serveNoModelo, anosNoModelo, modelosDa } from './meuCarro';

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
  /** subtipo (campo s: "Lanternas Traseiras"), o mesmo dos cartões "Por tipo" da página da categoria */
  sub?: string;
  preco?: string; frete?: boolean; ordem?: 'rel' | 'asc' | 'desc' | 'novos';
};
export type Carro = { b: string; m: string };
/** Linha de atalho das sugestões: o carro, a marca ou o sistema que a pessoa digitou, com a contagem. */
export type Atalho = { tipo: 'carro' | 'marca' | 'sistema'; rot: string; sub: string; n: number; href: string };
export type Sugestoes = { itens: Item[]; total: number; aproximado: boolean; atalhos: Atalho[]; carros: Carro[] };
export type Facetas = {
  marcas: [string, number][]; modelos: [string, number][]; tipos: [string, number][]; subs: [string, number][];
  anos: [number, number][]; precos: (readonly [string, string, number])[];
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

/** Palavras do texto, na ordem, sem acento e sem pontuação. */
export function palavras(texto: string): string[] {
  return normal(texto).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}
const compacto = (s: string) => palavras(s).join('');

// letra(s) + número de modelo separados ("xc 60", "s 10", "c 4"): a forma junta também vale
const parLetraNumero = (a: string, b: string) => /^[a-z]{1,3}$/.test(a) && /^\d{1,3}[a-z]?$/.test(b);

const digitos = (s: string) => s.replace(/\D/g, '').length;

/** Termos de um texto para o ÍNDICE: as palavras + as formas juntas ("xc 60"/"XC-60" -> "xc60";
 *  "Para-choque" -> "parachoque"; "T-Cross" -> "tcross"; código com traço, ponto ou barra, de qualquer tamanho:
 *  "1K0.959.653.C" -> "1k0959653c", só com 5+ números: "18/24" nunca vira "1824"). */
export function termos(texto: string): string[] {
  const out: string[] = [];
  const extra = new Set<string>();
  let ant = '';
  for (const bloco of normal(texto).split(/\s+/)) {
    const partes = bloco.split(/[^a-z0-9]+/).filter(Boolean);
    if (!partes.length) continue;
    // palavra com hífen ("para-choque", "e-pace", "wr-v"): a forma junta também
    if (partes.length > 1 && partes.length <= 3 && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(bloco.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))) {
      extra.add(partes.join(''));
    }
    if (partes.length > 1 && digitos(bloco) >= 5) extra.add(partes.join(''));
    for (const p of partes) {
      if (ant && parLetraNumero(ant, p)) extra.add(ant + p);
      out.push(p);
      ant = p;
    }
  }
  for (const x of extra) if (!out.includes(x)) out.push(x);
  return out;
}

/** Código gravado digitado com espaço, traço, ponto ou barra ("8200 328 856", "8200-328-856", "A045.591", "1K0 959 653 C"):
 *  a forma junta ("8200328856"). '' quando a busca não tem cara de código: cada pedaço só com letras, números e
 *  .-/, todo pedaço com número (letra solta de 1 ou 2 só nas pontas: "1K0 959 653 C", "A 204 820 08 42"), algum
 *  separador e, junto, de 6 a 20 caracteres com 5+ números ("xc60 2019", "farol 31476671" e "s60 t5" não são). */
export function codigoJunto(texto: string): string {
  const t = normal(texto).trim();
  if (!/[\s.\-/]/.test(t) || !/^[a-z0-9][a-z0-9\s.\-/]*$/.test(t)) return '';
  const ps = t.split(/[\s.\-/]+/).filter(Boolean);
  if (ps.length < 2) return '';
  const solta = (p: string, i: number) => /^[a-z]{1,2}$/.test(p) && (i === 0 || i === ps.length - 1);
  if (!ps.every((p, i) => /\d/.test(p) || solta(p, i))) return '';
  const j = ps.join('');
  return j.length >= 6 && j.length <= 20 && digitos(j) >= 5 ? j : '';
}

/** "palio 2010" -> { texto: "palio", ano: 2010 } (os carros da Peugeot com nome de ano ficam no texto). */
export function separarAno(q: string): { texto: string; ano?: number } {
  const m = q.match(/\b(19[89]\d|20[0-3]\d)\b/);
  if (!m || (/peugeot/i.test(q) && /\b(2008|3008|5008)\b/.test(q))) return { texto: q.trim() };
  return { texto: q.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), ano: Number(m[1]) };
}

/** A peça é do carro? (mesma marca; o modelo é o dela ou um dos carros da peça de 2+ carros, "Volvo S60 Xc60"). */
const doCarro = (it: Item, c: Carro) => it.b === c.b && serveNoModelo(it, c.m);
const dentro = (ano: number, y: [number, number] | null) => (y ? ano >= y[0] && ano <= y[1] : false);

/** Contagem por modelo (a peça de 2+ carros conta em cada um), da maior para a menor. */
function contarModelos(itens: Item[]): [string, number][] {
  const m = new Map<string, number>();
  for (const it of itens) for (const k of it.ms ?? [it.m]) if (k) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

type Entendido = {
  /** carros digitados (modelo exato, com a marca quando ela também foi digitada) */
  carros: Carro[];
  /** marcas digitadas sem modelo */
  marcas: string[];
  /** palavras que não são carro nem marca (o que a pessoa procura: "farol", "lanterna"…) */
  resto: string[];
  /** sistema do carro (família) quando o texto inteiro, tirando o carro, é o nome dela */
  familia?: string;
};
/** codigo: o código gravado buscado ("8200328856"), quando alguma peça da lista tem exatamente esse código */
type PorTexto = { base: Item[]; aproximado: boolean; carros: Carro[]; codigo?: string };

/** Os códigos gravados da peça (campo o, já sem hífen nem ponto: "1j0858601 1j0858601d"). */
const codigosDa = (it: Item) => (it.o ? it.o.split(' ') : []);

// palavras que não dizem qual é a peça ("peça original para xc60"): não precisam estar no anúncio
// (tudo no site é peça original); só contam se a busca tiver só elas
const VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'e', 'o', 'a', 'os', 'as', 'um', 'uma',
  'peca', 'pecas', 'original', 'originais', 'usada', 'usadas', 'usado', 'usados']);

// apelidos comuns de marca
const APELIDOS: Record<string, string> = { gm: 'Chevrolet', vw: 'Volkswagen', mercedes: 'Mercedes-Benz', mb: 'Mercedes-Benz' };

export class Busca {
  itens: Item[];
  /** true quando nenhuma peça tinha TODAS as palavras e a lista mostra as mais próximas */
  aproximado = false;
  /** carros que a pessoa digitou na última busca (as peças deles vêm primeiro) */
  carrosDaBusca: Carro[] = [];
  /** na busca aproximada em ordem de relevância: quantas peças do carro digitado abrem a lista (para os blocos) */
  nDoCarro = 0;
  /** a última busca foi um código gravado que alguma peça tem ("8200 328 856" -> "8200328856"); senão '' */
  codigoDaBusca = '';
  // Fluidez: o índice de texto (MiniSearch, ~5 mil peças) não é montado de uma vez no construtor.
  // Sem texto na busca (catálogo aberto, filtros) ele nem é preciso; prepararIndice() monta aos poucos,
  // em pedaços pequenos entre as tarefas da página; quem precisar antes (this.ms) completa na hora. O índice
  // final é o mesmo (as peças entram na mesma ordem).
  private _ms: MiniSearch<Item> | null = null;
  private _feitos = 0;
  // a mesma busca de texto se repete muitas vezes (lista + cada faceta + sugestões): guarda as últimas
  private _textos = new Map<string, PorTexto>();
  private _novos: Item[] | null = null;
  private _modelos: Map<string, (Carro & { n: number })[]> | null = null;
  private _marcas: Map<string, { b: string; n: number }> | null = null;
  private _familias: Map<string, { c: string; n: number }> | null = null;
  private _anosCarro = new Map<string, [number, number]>();
  private _codigos: string[] | null = null;

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
      searchOptions: { boost: { n: 3, carro: 2, o: 2.5, s: 1, t: 1 } },
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
    // os nomes de carro, marca e sistema também ficam prontos antes da 1ª letra
    await new Promise((r) => setTimeout(r, 0));
    this.montarNomes();
  }

  // ---- carros, marcas e sistemas do estoque (para entender o que foi digitado) ----
  private montarNomes() {
    if (this._modelos) return;
    const modelos = new Map<string, (Carro & { n: number })[]>();
    const marcas = new Map<string, { b: string; n: number }>();
    const familias = new Map<string, { c: string; n: number }>();
    const porCarro = new Map<string, Carro & { n: number }>();
    // poucas marcas, modelos e sistemas: cada nome é normalizado uma vez só (celular fraco)
    const memo = new Map<string, string>();
    const compacto = (x: string) => { let k = memo.get(x); if (k === undefined) { k = palavras(x).join(''); memo.set(x, k); } return k; };
    for (const it of this.itens) {
      if (it.b) {
        const kb = compacto(it.b);
        const mb = marcas.get(kb) ?? { b: it.b, n: 0 };
        mb.n++; marcas.set(kb, mb);
        for (const m of modelosDa(it)) {
          const kc = `${it.b}|${m}`;
          let c = porCarro.get(kc);
          if (!c) { c = { b: it.b, m, n: 0 }; porCarro.set(kc, c); }
          c.n++;
          const y = anosNoModelo(it, m);
          if (y) {
            const a = this._anosCarro.get(kc);
            this._anosCarro.set(kc, a ? [Math.min(a[0], y[0]), Math.max(a[1], y[1])] : [y[0], y[1]]);
          }
        }
      }
      if (it.c) {
        const kf = compacto(it.c);
        const fm = familias.get(kf) ?? { c: it.c, n: 0 };
        fm.n++; familias.set(kf, fm);
      }
    }
    for (const c of porCarro.values()) {
      const k = compacto(c.m);
      if (k.length < 2) continue;
      const l = modelos.get(k) ?? [];
      l.push(c); l.sort((a, b) => b.n - a.n);
      modelos.set(k, l);
    }
    for (const [ap, b] of Object.entries(APELIDOS)) {
      const mb = marcas.get(compacto(b));
      if (mb && !marcas.has(ap)) marcas.set(ap, mb);
    }
    // sistema pelo nome inteiro ("faroiselanternas", "suspensaoedirecao") e pela 1ª palavra que diz o que é ("farois",
    // "suspensao", "som"); "Para-choques e Lataria" -> "choques", nunca "para"
    for (const [k, fm] of [...familias]) {
      const w = palavras(fm.c).filter((x) => !['pecas', 'de', 'do', 'da', 'e', 'sistema', 'para'].includes(x))[0];
      if (w && w.length >= 3 && !familias.has(w)) familias.set(w, fm);
      if (k === 'outros') familias.delete(k);
    }
    this._modelos = modelos; this._marcas = marcas; this._familias = familias;
  }

  /** O que foi digitado: carro(s), marca(s), sistema e o resto (o nome da peça). */
  entender(texto: string): Entendido {
    this.montarNomes();
    const ws = palavras(texto);
    const usado = ws.map(() => false);
    const achados: Carro[] = [];
    const marcas: string[] = [];
    for (let n = Math.min(3, ws.length); n >= 1; n--) {
      for (let i = 0; i + n <= ws.length; i++) {
        if (usado.slice(i, i + n).some(Boolean)) continue;
        const k = ws.slice(i, i + n).join('');
        const cs = this._modelos!.get(k);
        if (cs) { achados.push(...cs); for (let j = i; j < i + n; j++) usado[j] = true; continue; }
        const mb = this._marcas!.get(k);
        if (mb) { if (!marcas.includes(mb.b)) marcas.push(mb.b); for (let j = i; j < i + n; j++) usado[j] = true; }
      }
    }
    // "volvo xc60": a marca escolhe entre modelos de mesmo nome e deixa de ser "marca solta"
    let carros = achados;
    if (marcas.length && achados.some((c) => marcas.includes(c.b))) carros = achados.filter((c) => marcas.includes(c.b));
    const marcasSoltas = marcas.filter((b) => !carros.some((c) => c.b === b));
    const resto = ws.filter((w, i) => !usado[i] && !VAZIAS.has(w));
    const familia = !carros.length && !marcasSoltas.length && resto.length ? this._familias!.get(resto.join(''))?.c : undefined;
    return { carros: carros.map(({ b, m }) => ({ b, m })), marcas: marcasSoltas, resto, familia };
  }

  /** Árvore da busca: cada palavra é um termo; "xc 60", "para-choque" e "8200-328-856" valem junto OU separado. */
  private arvore(texto: string): { grupos: Query[]; ultima: string } {
    const grupos: Query[] = [];
    const blocos = normal(texto).split(/\s+/).filter(Boolean);
    const ws: { w: string; bloco: number }[] = [];
    blocos.forEach((bl, b) => bl.split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => ws.push({ w, bloco: b })));
    const juntoOuSeparado = (partes: string[]): Query => ({ combineWith: 'OR', queries: [{ combineWith: 'AND', queries: partes }, partes.join('')] });
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i], p = ws[i + 1];
      // bloco com hífen, ponto ou barra ("xc-60", "316-63477", "para-choque", "8200-328-856"): o bloco inteiro
      if (p && a.bloco === p.bloco && /[-./]/.test(blocos[a.bloco])) {
        let fim = i + 1;
        while (ws[fim + 1]?.bloco === a.bloco) fim++;
        grupos.push(juntoOuSeparado(ws.slice(i, fim + 1).map((x) => x.w)));
        i = fim;
      } else if (p && parLetraNumero(a.w, p.w)) { // letra + número ("xc 60")
        grupos.push(juntoOuSeparado([a.w, p.w]));
        i++;
      } else if (!VAZIAS.has(a.w) || ws.every((x) => VAZIAS.has(x.w))) grupos.push(a.w);
    }
    return { grupos, ultima: ws.length ? ws[ws.length - 1].w : '' };
  }

  /** Algum código gravado do estoque é este ou começa por ele (a busca ao vivo digita o código aos poucos)? */
  private temCodigo(cod: string): boolean {
    this._codigos ??= this.itens.flatMap(codigosDa);
    return this._codigos.some((c) => c.startsWith(cod));
  }

  /** O texto e o ano da busca. Código gravado com espaço, traço ou ponto que existe no estoque vira a forma junta
   *  ("8200 328 856" -> "8200328856") ANTES de tudo: nenhum pedaço dele vira ano nem palavra solta. */
  private separar(q: string): { texto: string; ano?: number } {
    const cod = codigoJunto(q);
    return cod && this.temCodigo(cod) ? { texto: cod } : separarAno(q);
  }

  /** Peças da busca de texto, na ordem de relevância (com as mais próximas quando nenhuma tem todas as palavras). */
  private porTexto(texto: string): PorTexto {
    const chave = normal(texto).replace(/\s+/g, ' ').trim();
    let m = this._textos.get(chave);
    if (m) return m;
    const { grupos, ultima } = this.arvore(chave);
    const ent = this.entender(chave);
    // a última palavra pode estar pela metade (busca ao vivo): vale o começo dela a partir de 2 letras
    const prefix = (t: string) => t.length >= 3 || (t === ultima && t.length >= 2);
    const comErro = (t: string) => (t.length >= 5 && !/\d/.test(t) ? 0.2 : false);
    const tokenize = (s: string) => [s];
    const busca = (como: 'AND' | 'OR', erro: boolean) => this.ms.search(
      { combineWith: como, queries: grupos },
      { prefix, fuzzy: erro ? comErro : false, tokenize, combineWith: 'AND' },
    );
    let r: SearchResult[] = grupos.length ? busca('AND', false) : [];
    if (!r.length && grupos.length) r = busca('AND', true);
    let aproximado = false;
    if (!r.length && grupos.length) { r = busca('OR', true).slice(0, 300); aproximado = r.length > 0; }

    // o nome da peça começa pela palavra buscada: sobe ("farol" -> "Farol esquerdo" antes de "Interruptor farol")
    const principais = ent.resto.filter((w) => w.length >= 3 || w === ultima);
    const nota = new Map<number, number>();
    for (const x of r) {
      const it = this.itens[x.id as number];
      const nome = normal(it.n);
      const comeca = principais.some((w) => nome.startsWith(w));
      nota.set(it.k, x.score * (comeca ? 1.6 : 1));
    }
    let base = r.map((x) => this.itens[x.id as number]).sort((a, b) => nota.get(b.k)! - nota.get(a.k)!);
    // Parecidas ("farol compass" sem farol do Compass): o NOME da peça é o que diz o que a pessoa procura. As categorias
    // das peças com a palavra no nome ("farol" -> Faróis e Lanternas) passam na frente dentro de cada bloco abaixo:
    // as peças do Compass dessa categoria antes das outras do Compass (antes eram fechaduras, em ordem qualquer).
    let daPalavra: (it: Item) => boolean = () => false;
    if (aproximado) {
      const cats = new Map<string, number>();
      for (const x of r) if (Object.values(x.match).some((f) => f.includes('n'))) {
        const c = this.itens[x.id as number].c;
        if (c) cats.set(c, (cats.get(c) ?? 0) + 1);
      }
      const max = Math.max(0, ...cats.values());
      const fortes = new Set([...cats].filter(([, n]) => n >= max * 0.3).map(([c]) => c));
      const nomeTem = new Set(r.filter((x) => Object.values(x.match).some((f) => f.includes('n'))).map((x) => x.id as number));
      daPalavra = (it) => nomeTem.has(it.k) || fortes.has(it.c);
    }
    const frente = (xs: Item[]) => (aproximado ? [...xs.filter(daPalavra), ...xs.filter((x) => !daPalavra(x))] : xs);
    // o carro digitado primeiro; depois a marca digitada; depois o resto (a ordem dentro de cada bloco fica)
    if (ent.carros.length || ent.marcas.length) {
      const doCarroDig: Item[] = [], daMarca: Item[] = [], outras: Item[] = [];
      for (const it of base) {
        if (ent.carros.some((c) => doCarro(it, c))) doCarroDig.push(it);
        else if (ent.marcas.includes(it.b)) daMarca.push(it);
        else outras.push(it);
      }
      base = [...frente(doCarroDig), ...frente(daMarca), ...outras];
    } else base = frente(base);
    // código gravado buscado ("8200328856"): a peça com esse código abre a lista, antes das que só o citam
    let codigo: string | undefined;
    if (!aproximado && /^[a-z0-9]{6,20}$/.test(chave) && digitos(chave) >= 5) {
      const tem = (it: Item) => codigosDa(it).includes(chave);
      const comCodigo = base.filter(tem);
      if (comCodigo.length) { base = [...comCodigo, ...base.filter((it) => !tem(it))]; codigo = chave; }
    }
    m = { base, aproximado, carros: ent.carros, codigo };
    this._textos.set(chave, m);
    if (this._textos.size > 24) this._textos.delete(this._textos.keys().next().value!);
    return m;
  }

  /** Todas as peças, das que chegaram agora para as mais antigas (os ids do ML crescem). */
  private porNovos(): Item[] {
    return (this._novos ??= [...this.itens].sort((a, b) => b.id.length - a.id.length || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)));
  }

  /** A lista para os filtros, sem mexer no estado público (aproximado, carrosDaBusca). */
  private filtrar(f: Filtros): { itens: Item[]; aproximado: boolean; carros: Carro[]; comTexto: boolean; codigo: string } {
    const { texto, ano: anoQ } = this.separar((f.q || '').trim());
    const o = f.ordem || 'rel';
    let r: PorTexto;
    if (texto) r = this.porTexto(texto);
    // sem texto, "relevantes" e "chegaram agora" são a mesma ordem: a lista já vem ordenada
    else r = { base: o === 'rel' || o === 'novos' ? this.porNovos() : this.itens, aproximado: false, carros: [] };
    const ano = f.ano || anoQ;
    const faixa = FAIXAS.find((x) => x[0] === f.preco);
    const itens = r.base.filter((it) =>
      (!f.marca || it.b === f.marca) &&
      (!f.modelo || serveNoModelo(it, f.modelo)) &&
      (!ano || dentro(ano, f.modelo ? anosNoModelo(it, f.modelo) : it.y)) &&
      (!f.tipo || it.c === f.tipo) &&
      (!f.sub || it.s === f.sub) &&
      (!faixa || (it.p >= faixa[2] && it.p < faixa[3])) &&
      (!f.frete || it.f));
    return { itens, aproximado: r.aproximado, carros: r.carros, comTexto: !!texto, codigo: r.codigo ?? '' };
  }

  procurar(f: Filtros): Item[] {
    const r = this.filtrar(f);
    const out = r.itens;
    const o = f.ordem || 'rel';
    if (o === 'asc') out.sort((a, b) => a.p - b.p);
    else if (o === 'desc') out.sort((a, b) => b.p - a.p);
    else if (o === 'novos' && r.comTexto) out.sort((a, b) => b.id.length - a.id.length || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
    this.aproximado = r.aproximado;
    this.carrosDaBusca = r.carros;
    this.codigoDaBusca = r.codigo && out.some((it) => codigosDa(it).includes(r.codigo)) ? r.codigo : '';
    this.nDoCarro = 0;
    if (r.aproximado && o === 'rel' && r.carros.length) {
      while (this.nDoCarro < out.length && r.carros.some((c) => doCarro(out[this.nDoCarro], c))) this.nDoCarro++;
    }
    return out;
  }

  // contagem de cada faceta SEM o próprio filtro (igual ao Mercado Livre)
  facetas(f: Filtros): Facetas {
    const conta = (sem: keyof Filtros, chave: (i: Item) => string) => {
      const m = new Map<string, number>();
      for (const it of this.filtrar({ ...f, [sem]: undefined, ordem: 'rel' }).itens) {
        const k = chave(it); if (k) m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    // anos: só os que têm peça (uma peça de 2018–2024 conta em cada um desses anos), do mais novo para o mais velho
    const porAno = new Map<number, number>();
    const semAno = this.filtrar({ ...f, ano: undefined, q: f.q ? this.separar(f.q).texto : f.q, ordem: 'rel' }).itens;
    for (const it of semAno) {
      const y = f.modelo ? anosNoModelo(it, f.modelo) : it.y;
      if (y) for (let a = y[0]; a <= y[1]; a++) porAno.set(a, (porAno.get(a) || 0) + 1);
    }
    const semPreco = this.filtrar({ ...f, preco: undefined, ordem: 'rel' }).itens;
    return {
      marcas: conta('marca', (i) => i.b),
      modelos: f.marca ? contarModelos(this.filtrar({ ...f, modelo: undefined, ordem: 'rel' }).itens) : [],
      tipos: conta('tipo', (i) => i.c),
      // tipos de peça dentro do sistema escolhido (como os modelos dentro da marca)
      subs: f.tipo ? conta('sub', (i) => i.s) : [],
      anos: [...porAno.entries()].sort((a, b) => b[0] - a[0]),
      precos: FAIXAS.map(([k, rot, a, b]) => [k, rot, semPreco.filter((i) => i.p >= a && i.p < b).length] as const),
    };
  }

  /** A lista tem o que a pessoa procura? (cliente oculto 10/11, atrito 1: com o XC60 2019, "retrovisor direito" só
   *  achava a "Capa espelho retrovisor direito", e o site não oferecia "a gente procura no pátio".)
   *  Bate quando alguma peça da lista serve no carro-alvo (o do filtro, o digitado ou o salvo; no ano, quando a peça
   *  diz os anos) e o nome dela começa pela palavra principal buscada ("retrovisor", "retrovisores" ou com 1 letra
   *  trocada). Código gravado achado bate; busca só de carro, marca ou sistema ("xc60", "suspensão") também.
   *  Sem carro-alvo, vale qualquer peça da lista. */
  bate(lista: Item[], q: string, alvo?: { b: string; m: string; y?: number | null } | null): boolean {
    if (!lista.length) return false;
    const { texto } = this.separar((q || '').trim());
    if (!texto) return true;
    const r = this.porTexto(texto);
    if (r.codigo) return lista.some((it) => codigosDa(it).includes(r.codigo!));
    const ent = this.entender(texto);
    const principal = ent.resto.find((w) => w.length >= 3 && !/\d/.test(w));
    if (!principal || ent.familia) return true;
    const raiz = (a: string, b: string) => {
      let n = 0;
      while (n < a.length && n < b.length && a[n] === b[n]) n++;
      const menor = Math.min(a.length, b.length);
      return n >= Math.min(4, menor) && n >= menor - 3;
    };
    return lista.some((it) => {
      if (!raiz(palavras(it.n)[0] || '', principal)) return false;
      if (!alvo) return true;
      if (!doCarro(it, alvo)) return false;
      const y = anosNoModelo(it, alvo.m);
      return !alvo.y || !y || dentro(alvo.y, y);
    });
  }

  /** Quantas peças do carro (no ano, se houver) — a mesma conta do catálogo filtrado por marca, modelo e ano. */
  contaCarro(c: Carro, ano?: number): number {
    let n = 0;
    for (const it of this.itens) if (doCarro(it, c) && (!ano || dentro(ano, anosNoModelo(it, c.m)))) n++;
    return n;
  }

  /** Sugestões ao vivo: a MESMA regra do catálogo (procurar), com atalhos de carro, marca ou sistema no topo. */
  sugestoes(q: string, n = 6): Sugestoes {
    const vazio: Sugestoes = { itens: [], total: 0, aproximado: false, atalhos: [], carros: [] };
    if (q.trim().length < 2) return vazio;
    const { texto, ano } = this.separar(q.trim());
    // só o ano ("2019"): as peças desse ano, como no catálogo
    const r: PorTexto = texto ? this.porTexto(texto) : { base: this.porNovos(), aproximado: false, carros: [] };
    const lista = ano ? r.base.filter((it) => dentro(ano, it.y)) : r.base;
    return { itens: lista.slice(0, n), total: lista.length, aproximado: r.aproximado, atalhos: this.atalhos(texto, ano), carros: r.carros };
  }

  /** 1 ou 2 linhas de atalho: o carro digitado ("Volvo XC60 · 475 peças"), senão a marca, senão o sistema. */
  private atalhos(texto: string, ano?: number): Atalho[] {
    const ent = this.entender(texto);
    const pecas = (x: number) => `${x.toLocaleString('pt-BR')} ${x === 1 ? 'peça' : 'peças'}`;
    const out: Atalho[] = [];
    for (const c of ent.carros.slice(0, 2)) {
      const x = this.contaCarro(c, ano);
      if (!x) continue;
      const a = this._anosCarro.get(`${c.b}|${c.m}`);
      const anos = ano ? String(ano) : a ? (a[0] === a[1] ? String(a[0]) : `${a[0]}–${a[1]}`) : '';
      const u = new URLSearchParams({ marca: c.b, modelo: c.m });
      if (ano) u.set('ano', String(ano));
      out.push({ tipo: 'carro', rot: `${c.b} ${c.m}`, sub: [anos, pecas(x)].filter(Boolean).join(' · '), n: x, href: `/catalogo.html?${u}` });
    }
    if (!out.length && ent.marcas.length) {
      const b = ent.marcas[0];
      const x = this.itens.reduce((s, it) => s + (it.b === b && (!ano || dentro(ano, it.y)) ? 1 : 0), 0);
      const u = new URLSearchParams({ marca: b });
      if (ano) u.set('ano', String(ano));
      if (x) out.push({ tipo: 'marca', rot: `Peças ${b}`, sub: `Todos os modelos · ${pecas(x)}`, n: x, href: `/catalogo.html?${u}` });
    }
    if (!out.length && ent.familia) {
      const fm = ent.familia;
      const x = this.itens.reduce((s, it) => s + (it.c === fm ? 1 : 0), 0);
      if (x) out.push({ tipo: 'sistema', rot: fm, sub: `Sistema do carro · ${pecas(x)}`, n: x, href: `/catalogo.html?${new URLSearchParams({ tipo: fm })}` });
    }
    return out.slice(0, 2);
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

/** "Volvo XC60 · 2018–2024" (peça de 2+ carros: "Volvo S60 / XC60 · 2018–2024", como no cartão) */
export function carroAnos(it: Pick<Item, 'b' | 'm' | 'y' | 'ms'>) {
  const carro = [it.b, it.ms && it.ms.length > 1 ? it.ms.join(' / ') : it.m].filter(Boolean).join(' ');
  const anos = it.y ? (it.y[0] === it.y[1] ? String(it.y[0]) : `${it.y[0]}–${it.y[1]}`) : '';
  return [carro, anos].filter(Boolean).join(' · ');
}
