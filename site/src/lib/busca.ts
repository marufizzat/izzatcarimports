// Motor de busca do catálogo — roda no navegador sobre public/dados/busca.json (e no build, para a 1ª tela do catálogo).
// Acha por nome da peça, carro ou CÓDIGO gravado; entende "xc60" = "xc 60" = "XC-60", tolera erro de digitação
// (só em palavra sem número) e combina com os filtros (marca, modelo, ano, tipo, preço).
//
// UMA regra para o catálogo (procurar) e para as sugestões ao vivo (sugestoes):
//   1. ano solto na busca ("palio 2010") vira filtro de ano;
//   2. todas as palavras, sem aproximação; se nada, com aproximação (erro de digitação); se ainda nada,
//      as peças com alguma das palavras (aproximado = true: "nada exato, veja as parecidas");
//   3. o carro digitado vem primeiro ("xc60": as do Volvo XC60; "farol compass": as do Jeep Compass);
//   4. a peça cujo nome começa pela palavra buscada sobe ("farol": "Farol esquerdo" antes de "Interruptor farol");
//   5. o jeito de falar do cliente vale (lib/sinonimos.ts: "sinaleira" = lanterna, "máquina de vidro" = motor vidro,
//      "faróis" = farol) e o lado e a posição digitados viram filtro ("retrovisor direito xc60": os retrovisores DIREITOS
//      do XC60, pela coluna "l" do índice; sem nenhum, a busca volta a valer como texto, como antes).
import MiniSearch, { type Query, type SearchResult } from 'minisearch';
import { serveNoModelo, anosNoModelo, modelosDa } from './meuCarro';
import { MAPA_SINONIMOS, MAPA_FORA, MAIOR_GATILHO, VAZIAS, singulares } from './sinonimos';

export type Indice = {
  v: number; updated: string; marcas: string[]; familias: string[]; tipos: string[];
  /** apelidos de carro unido ("Mercedes-Benz|C180"): fora das listas de modelo; a busca e o filtro ainda os acham */
  apelidos?: string[];
  id: string[]; t: string[]; n: string[]; p: number[]; i: string[]; h: string[]; f: string;
  b: number[]; m: string[]; y: ([number, number] | 0)[]; c: number[]; s: number[]; o: string[];
  e?: string; // capa de estúdio por peça: '0' nenhuma, '1' automática, '2' maquiada (estudio-pro)
  // capas leves do cartão (scripts/capas-cartao.mjs, no build): '1' = as de 400/640 px são da capa que o "e" diz
  r?: string;
  // peça que serve em 2+ carros: {índice: ["S60", "XC60"]} e, quando a faixa muda, {índice: [[2018, 2024], ...]}
  ms?: Record<string, string[]>; ys?: Record<string, ([number, number] | null)[]>;
  // mesma peça (código e carro) com preço diferente: a versão que o título diz, só nas que têm ({índice: "T8"})
  dif?: Record<string, string>;
  // lado e posição pelo nome (preparar_dados.py, lado_posicao): uma letra por peça, '0' quando o nome não diz
  l?: string; pos?: string;
};
/** Lado da peça: E esquerdo (motorista), D direito (passageiro). */
export type Lado = 'E' | 'D';
/** Posição da peça: D dianteiro, T traseiro (no índice também A: as duas, "dianteira/traseira", entra nas duas fichas). */
export type Posicao = 'D' | 'T';
export type Item = {
  k: number; id: string; t: string; n: string; p: number; i: string; h: string; f: boolean;
  b: string; m: string; y: [number, number] | null; c: string; s: string; o: string; e: string;
  /** 1 = a capa tem as versões leves de 400/640 px em dia (fotoCartao); ausente = só a capa inteira */
  r?: 1;
  ms?: string[]; ys?: ([number, number] | null)[];
  /** a versão que separa esta peça das outras de mesmo código e carro com outro preço ("T8", "2.0", "G5/G6") */
  dif?: string;
  /** lado e posição que o nome diz (só quando diz; a posição, senão, a do tipo; A = as duas) */
  l?: Lado; pos?: Posicao | 'A';
};
export type Filtros = {
  q?: string; marca?: string; modelo?: string; ano?: number; tipo?: string;
  /** subtipo (campo s: "Lanternas Traseiras"), o mesmo dos cartões "Por tipo" da página da categoria */
  sub?: string;
  preco?: string; frete?: boolean; ordem?: 'rel' | 'asc' | 'desc' | 'novos';
  /** fichas "Esquerdo · Direito" e "Dianteiro · Traseiro" (endereço: &lado=esquerdo|direito, &pos=dianteiro|traseiro) */
  lado?: Lado; pos?: Posicao;
};
export type Carro = { b: string; m: string };
/** Linha de atalho das sugestões: o carro, a marca ou o sistema que a pessoa digitou, com a contagem. */
export type Atalho = { tipo: 'carro' | 'marca' | 'sistema'; rot: string; sub: string; n: number; href: string };
export type Sugestoes = { itens: Item[]; total: number; aproximado: boolean; atalhos: Atalho[]; carros: Carro[] };
export type Facetas = {
  marcas: [string, number][]; modelos: [string, number][]; tipos: [string, number][]; subs: [string, number][];
  anos: [number, number][]; precos: (readonly [string, string, number])[];
  /** quantas peças de cada lado ('E', 'D') e posição ('D', 'T') na lista sem esse filtro (só os que têm peça) */
  lados: [Lado, number][]; posicoes: [Posicao, number][];
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

// lado e posição digitados (no Brasil o motorista vai à esquerda). "le" fica de fora: é o começo de "led", "lente".
const LADO_Q: Record<string, Lado> = {
  esquerdo: 'E', esquerda: 'E', esquerdos: 'E', esquerdas: 'E', esq: 'E', motorista: 'E',
  direito: 'D', direita: 'D', direitos: 'D', direitas: 'D', dir: 'D', ld: 'D', passageiro: 'D',
};
const POS_Q: Record<string, Posicao> = {
  dianteiro: 'D', dianteira: 'D', dianteiros: 'D', dianteiras: 'D', diant: 'D', frontal: 'D',
  traseiro: 'T', traseira: 'T', traseiros: 'T', traseiras: 'T', tras: 'T',
};

/** "retrovisor lado direito xc60" -> { texto: "retrovisor xc60", lado: 'D', palavras: ["direito"] }. Os dois lados (ou as
 *  duas posições) na mesma busca ficam no texto ("maçaneta dianteira/traseira"). */
export function separarLadoPos(q: string): { texto: string; lado?: Lado; pos?: Posicao; palavras: string[] } {
  const ws = q.trim().split(/\s+/).filter(Boolean);
  const ns = ws.map((w) => normal(w).replace(/[^a-z0-9]/g, ''));
  const lados = new Set(ns.filter((w) => LADO_Q[w]).map((w) => LADO_Q[w]));
  const poss = new Set(ns.filter((w) => POS_Q[w]).map((w) => POS_Q[w]));
  const lado = lados.size === 1 ? [...lados][0] : undefined;
  const pos = poss.size === 1 ? [...poss][0] : undefined;
  if (!lado && !pos) return { texto: q.trim(), palavras: [] };
  const sai = (w: string) => (!!lado && (!!LADO_Q[w] || w === 'lado')) || (!!pos && !!POS_Q[w]);
  return {
    texto: ws.filter((_, i) => !sai(ns[i])).join(' '), lado, pos,
    palavras: ns.filter((w) => sai(w) && w !== 'lado'),
  };
}

/** A peça é do carro? (mesma marca; o modelo é o dela ou um dos carros da peça de 2+ carros, "Volvo S60 Xc60"). */
const doCarro = (it: Item, c: Carro) => it.b === c.b && serveNoModelo(it, c.m);
const dentro = (ano: number, y: [number, number] | null) => (y ? ano >= y[0] && ano <= y[1] : false);

/** Contagem por modelo (a peça de 2+ carros conta em cada um), da maior para a menor. */
function contarModelos(itens: Item[], apelidos: Set<string>): [string, number][] {
  const m = new Map<string, number>();
  for (const it of itens) for (const k of it.ms ?? [it.m]) if (k && !apelidos.has(`${it.b}|${k}`)) m.set(k, (m.get(k) || 0) + 1);
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
/** A busca separada: o texto (sem o ano, o lado e a posição), o ano, o lado e a posição digitados e o texto com o lado e
 *  a posição (a volta ao jeito antigo quando o filtro não deixa nada). */
type Separado = { texto: string; ano?: number; lado?: Lado; pos?: Posicao; textoCom: string; palavrasLP: string[] };
/** Como filtrar: derivado = usar o lado/posição digitados (undefined: usa e, se a lista ficar vazia, volta ao texto);
 *  semLado/semPos = sem esse filtro (as contagens das fichas). */
type ComoFiltrar = { derivado?: boolean; semLado?: boolean; semPos?: boolean };

/** Os códigos gravados da peça (campo o, já sem hífen nem ponto: "1j0858601 1j0858601d"). */
const codigosDa = (it: Item) => (it.o ? it.o.split(' ') : []);

// o peso das outras formas de dizer (lib/sinonimos.ts) perto da palavra digitada
const PESO_SINONIMO = 0.25;

// palavras que não dizem qual é a peça ("peça original para xc60", VAZIAS em lib/sinonimos.ts): não precisam estar no
// anúncio (tudo no site é peça original); só contam se a busca tiver só elas

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
  /** lado e posição que a última busca digitou e que estão filtrando a lista ("retrovisor direito": 'D') */
  ladoDaBusca: Lado | undefined = undefined;
  posDaBusca: Posicao | undefined = undefined;
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

  private apelidos: Set<string>;
  constructor(ix: Indice) {
    this.apelidos = new Set(ix.apelidos ?? []);
    this.itens = ix.id.map((id, k) => {
      const it: Item = {
        k, id, t: ix.t[k], n: ix.n[k], p: ix.p[k], i: ix.i[k], h: ix.h[k], f: ix.f[k] === '1', e: ix.e?.[k] || '0',
        b: ix.marcas[ix.b[k]] ?? '', m: ix.m[k], y: ix.y[k] || null,
        c: ix.familias[ix.c[k]] ?? '', s: ix.tipos[ix.s[k]] ?? '', o: ix.o[k],
      };
      // os campos raros só quando existem: a 1ª tela do catálogo vai serializada no HTML ("ms":[0] em 24 cartões pesava)
      const ms = ix.ms?.[k], ys = ix.ys?.[k], dif = ix.dif?.[k], l = ix.l?.[k], pos = ix.pos?.[k];
      if (ix.r?.[k] === '1') it.r = 1;
      if (l === 'E' || l === 'D') it.l = l;
      if (pos === 'D' || pos === 'T' || pos === 'A') it.pos = pos;
      if (ms) it.ms = ms;
      if (ys) it.ys = ys;
      if (dif) it.dif = dif;
      return it;
    });
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

  /** Árvore da busca: cada palavra é um termo; "xc 60", "para-choque" e "8200-328-856" valem junto OU separado.
   *  O jeito de falar do cliente (lib/sinonimos.ts, a frase mais longa primeiro) acrescenta as outras formas: "sinaleira"
   *  = sinaleira OU lanterna; "máquina de vidro" = (máquina E vidro) OU (motor E vidro)...; e o plural, a forma no singular
   *  ("faróis" = faróis OU farol, só a palavra inteira). formas: para cada palavra, as formas que valem por ela
   *  (o "começa pela palavra" da ordem e o bate() usam). */
  private arvore(texto: string): { grupos: Query[]; ultima: string; formas: Map<string, string[]> } {
    const grupos: Query[] = [];
    const formas = new Map<string, string[]>();
    const blocos = normal(texto).split(/\s+/).filter(Boolean);
    const ws: { w: string; bloco: number }[] = [];
    blocos.forEach((bl, b) => bl.split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => ws.push({ w, bloco: b })));
    const juntoOuSeparado = (partes: string[]): Query => ({ combineWith: 'OR', queries: [{ combineWith: 'AND', queries: partes }, partes.join('')] });
    // as unidades da busca: palavra solta, bloco com hífen/ponto/barra e letra + número
    const uns: { q: Query; chave: string; solta: boolean }[] = [];
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i], p = ws[i + 1];
      // bloco com hífen, ponto ou barra ("xc-60", "316-63477", "para-choque", "8200-328-856"): o bloco inteiro
      if (p && a.bloco === p.bloco && /[-./]/.test(blocos[a.bloco])) {
        let fim = i + 1;
        while (ws[fim + 1]?.bloco === a.bloco) fim++;
        const partes = ws.slice(i, fim + 1).map((x) => x.w);
        uns.push({ q: juntoOuSeparado(partes), chave: partes.join(''), solta: false });
        i = fim;
      } else if (p && parLetraNumero(a.w, p.w)) { // letra + número ("xc 60")
        uns.push({ q: juntoOuSeparado([a.w, p.w]), chave: a.w + p.w, solta: false });
        i++;
      } else if (!VAZIAS.has(a.w) || ws.every((x) => VAZIAS.has(x.w))) uns.push({ q: a.w, chave: a.w, solta: true });
    }
    const frase = (f: string[]): Query => (f.length === 1 ? f[0] : { combineWith: 'AND', queries: f });
    for (let i = 0; i < uns.length;) {
      let n = Math.min(MAIOR_GATILHO, uns.length - i);
      for (; n >= 1; n--) if (MAPA_SINONIMOS.has(uns.slice(i, i + n).map((u) => u.chave).join(' '))) break;
      if (n >= 1) {
        const k = uns.slice(i, i + n).map((u) => u.chave).join(' ');
        const alts = MAPA_SINONIMOS.get(k)!.filter((f) => f.join(' ') !== k);
        const orig: Query = n === 1 ? uns[i].q : { combineWith: 'AND', queries: uns.slice(i, i + n).map((u) => u.q) };
        // as outras formas valem um pouco menos que a digitada (e a soma de 2 formas não passa a frente dela); com o
        // "fora" da tabela, a peça cujo nome ou tipo diz aquela palavra não entra pelo sinônimo ("frente": a grade do
        // alto-falante e a moldura do painel não)
        // (a pessoa que digitou a palavra do "fora" quer aquela peça: "frente painel" continua achando a moldura do painel)
        const fora = MAPA_FORA.get(k)?.filter((w) => !uns.some((u) => u.chave.length >= 3 && (u.chave.startsWith(w) || w.startsWith(u.chave))));
        const comFora = MAPA_FORA.has(k);
        const outras: Query = { combineWith: 'OR', queries: alts.map(frase), boostTerm: () => PESO_SINONIMO, ...(comFora ? { fields: ['n'] } : {}) };
        const semFora: Query = fora?.length
          ? { combineWith: 'AND_NOT', queries: [outras, { combineWith: 'OR', queries: fora.map((w) => w.replace(/-/g, '')), fields: ['n', 's'], prefix: true, fuzzy: false }] }
          : outras;
        grupos.push(alts.length ? { combineWith: 'OR', queries: [orig, semFora] } : orig);
        formas.set(uns[i].chave, [...new Set(alts.map((f) => f[0]))]);
        i += n;
        continue;
      }
      // plural ("faróis", "lanternas", "retrovisores"): a forma no singular também, só a palavra inteira (sem começo de
      // palavra nem erro de digitação: "mais" nunca vira "mal...")
      const u = uns[i];
      const sing = u.solta ? singulares(u.chave) : [];
      if (sing.length) {
        grupos.push({ combineWith: 'OR', queries: [u.q, { combineWith: 'OR', queries: sing, prefix: false, fuzzy: false }] });
        formas.set(u.chave, sing);
      } else grupos.push(u.q);
      i++;
    }
    return { grupos, ultima: ws.length ? ws[ws.length - 1].w : '', formas };
  }

  /** Algum código gravado do estoque é este ou começa por ele (a busca ao vivo digita o código aos poucos)? */
  private temCodigo(cod: string): boolean {
    this._codigos ??= this.itens.flatMap(codigosDa);
    return this._codigos.some((c) => c.startsWith(cod));
  }

  /** O texto, o ano, o lado e a posição da busca. Código gravado com espaço, traço ou ponto que existe no estoque vira a
   *  forma junta ("8200 328 856" -> "8200328856") ANTES de tudo: nenhum pedaço dele vira ano nem palavra solta. */
  private separar(q: string): Separado {
    const cod = codigoJunto(q);
    if (cod && this.temCodigo(cod)) return { texto: cod, textoCom: cod, palavrasLP: [] };
    const { texto: semAno, ano } = separarAno(q);
    const lp = separarLadoPos(semAno);
    return { texto: lp.texto, ano, lado: lp.lado, pos: lp.pos, textoCom: semAno, palavrasLP: lp.palavras };
  }

  /** A busca sem o ano (as contagens dos anos), com o lado e a posição como estavam. */
  private semAnoQ(q: string): string {
    const cod = codigoJunto(q);
    return cod && this.temCodigo(cod) ? cod : separarAno(q).texto;
  }

  /** A busca sem as palavras de lado e posição ("retrovisor direito xc60" -> "retrovisor xc60"): a ficha tocada passa a
   *  mandar no lugar delas. */
  semLadoPos(q: string, o: { lado?: boolean; pos?: boolean } = { lado: true, pos: true }): string {
    const sep = separarLadoPos(q);
    const lado = !!o.lado && !!sep.lado, pos = !!o.pos && !!sep.pos;
    if (!lado && !pos) return q;
    // só o que foi pedido sai: a posição fica quando a ficha é a do lado (e vice-versa)
    const tirar = (w: string) => {
      const n = normal(w).replace(/[^a-z0-9]/g, '');
      return (lado && (!!LADO_Q[n] || n === 'lado')) || (pos && !!POS_Q[n]);
    };
    return q.trim().split(/\s+/).filter((w) => w && !tirar(w)).join(' ');
  }

  /** Peças da busca de texto, na ordem de relevância (com as mais próximas quando nenhuma tem todas as palavras).
   *  bonus: o lado/posição digitados que viraram filtro ("amortecedor traseiro"): a peça cujo nome diz a mesma palavra
   *  sobe um pouco ("Amortecedor traseiro" antes de "Amortecedor tampa traseira"). */
  private porTexto(texto: string, bonus: string[] = []): PorTexto {
    const chave = normal(texto).replace(/\s+/g, ' ').trim();
    const chaveCache = bonus.length ? `${chave}|${bonus.join(' ')}` : chave;
    let m = this._textos.get(chaveCache);
    if (m) return m;
    const { grupos, ultima, formas } = this.arvore(chave);
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

    // o nome da peça começa pela palavra buscada (ou uma forma dela: "sinaleira" -> "Lanterna"): sobe
    // ("farol" -> "Farol esquerdo" antes de "Interruptor farol")
    const principais = ent.resto.filter((w) => w.length >= 3 || w === ultima).flatMap((w) => [w, ...(formas.get(w) ?? [])]);
    // só conta quando a busca tem sinônimo ou plural (sem eles, a ordem fica a de antes)
    const digitadas = formas.size ? ent.resto.filter((w) => w.length >= 3 && !/\d/.test(w)) : [];
    const nota = new Map<number, number>();
    for (const x of r) {
      const it = this.itens[x.id as number];
      const nome = normal(it.n);
      const comeca = principais.some((w) => nome.startsWith(w));
      const ws = nome.split(/[^a-z0-9]+/);
      const diz = bonus.length > 0 && ws.some((w) => bonus.includes(w));
      // o nome diz o que foi digitado, do jeito que foi digitado (não só um sinônimo): sobe um pouco
      const exato = digitadas.length > 0 && digitadas.every((d) => ws.some((w) => w.startsWith(d)));
      nota.set(it.k, x.score * (comeca ? 1.6 : 1) * (diz ? 1.25 : 1) * (exato ? 1.5 : 1));
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
    this._textos.set(chaveCache, m);
    if (this._textos.size > 24) this._textos.delete(this._textos.keys().next().value!);
    return m;
  }

  /** Todas as peças, das que chegaram agora para as mais antigas (os ids do ML crescem). */
  private porNovos(): Item[] {
    return (this._novos ??= [...this.itens].sort((a, b) => b.id.length - a.id.length || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)));
  }

  /** A lista para os filtros, sem mexer no estado público (aproximado, carrosDaBusca).
   *  Lado e posição digitados ("retrovisor direito xc60") filtram como as fichas; se a lista ficar vazia com eles, a busca
   *  volta ao jeito antigo (as palavras como texto, e as parecidas): nunca pior que antes. derivado diz qual valeu. */
  private filtrar(f: Filtros, como: ComoFiltrar = {}): {
    itens: Item[]; aproximado: boolean; carros: Carro[]; comTexto: boolean; codigo: string; derivado: boolean;
    ladoQ?: Lado; posQ?: Posicao;
  } {
    const sep = this.separar((f.q || '').trim());
    const o = f.ordem || 'rel';
    const ano = f.ano || sep.ano;
    const faixa = FAIXAS.find((x) => x[0] === f.preco);
    const tem = sep.palavrasLP.length > 0;
    const rodar = (derivado: boolean) => {
      const texto = derivado ? sep.texto : sep.textoCom;
      let r: PorTexto;
      if (texto) r = this.porTexto(texto, derivado ? sep.palavrasLP : []);
      // sem texto, "relevantes" e "chegaram agora" são a mesma ordem: a lista já vem ordenada
      else r = { base: o === 'rel' || o === 'novos' ? this.porNovos() : this.itens, aproximado: false, carros: [] };
      const ladoQ = derivado && !f.lado ? sep.lado : undefined;
      const posQ = derivado && !f.pos ? sep.pos : undefined;
      const lado = como.semLado ? undefined : f.lado ?? ladoQ;
      const pos = como.semPos ? undefined : f.pos ?? posQ;
      const itens = r.base.filter((it) =>
        (!f.marca || it.b === f.marca) &&
        (!f.modelo || serveNoModelo(it, f.modelo)) &&
        (!ano || dentro(ano, f.modelo ? anosNoModelo(it, f.modelo) : it.y)) &&
        (!f.tipo || it.c === f.tipo) &&
        (!f.sub || it.s === f.sub) &&
        (!faixa || (it.p >= faixa[2] && it.p < faixa[3])) &&
        (!f.frete || it.f) &&
        (!lado || it.l === lado) &&
        (!pos || it.pos === pos || it.pos === 'A'));
      return { itens, aproximado: r.aproximado, carros: r.carros, comTexto: !!texto, codigo: r.codigo ?? '', derivado, ladoQ, posQ };
    };
    if (!tem || como.derivado === false) return rodar(false);
    const r = rodar(true);
    return r.itens.length || como.derivado === true ? r : rodar(false);
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
    this.ladoDaBusca = r.ladoQ;
    this.posDaBusca = r.posQ;
    this.codigoDaBusca = r.codigo && out.some((it) => codigosDa(it).includes(r.codigo)) ? r.codigo : '';
    this.nDoCarro = 0;
    if (r.aproximado && o === 'rel' && r.carros.length) {
      while (this.nDoCarro < out.length && r.carros.some((c) => doCarro(out[this.nDoCarro], c))) this.nDoCarro++;
    }
    return out;
  }

  // contagem de cada faceta SEM o próprio filtro (igual ao Mercado Livre)
  facetas(f: Filtros): Facetas {
    // o lado/posição digitados valem (ou não) do mesmo jeito que na lista
    const derivado = this.filtrar({ ...f, ordem: 'rel' }).derivado;
    const lista = (g: Filtros, como: ComoFiltrar = {}) => this.filtrar({ ...g, ordem: 'rel' }, { derivado, ...como }).itens;
    const conta = (sem: keyof Filtros, chave: (i: Item) => string) => {
      const m = new Map<string, number>();
      for (const it of lista({ ...f, [sem]: undefined })) {
        const k = chave(it); if (k) m.set(k, (m.get(k) || 0) + 1);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    // anos: só os que têm peça (uma peça de 2018–2024 conta em cada um desses anos), do mais novo para o mais velho
    const porAno = new Map<number, number>();
    const semAno = lista({ ...f, ano: undefined, q: f.q ? this.semAnoQ(f.q) : f.q });
    for (const it of semAno) {
      const y = f.modelo ? anosNoModelo(it, f.modelo) : it.y;
      if (y) for (let a = y[0]; a <= y[1]; a++) porAno.set(a, (porAno.get(a) || 0) + 1);
    }
    const semPreco = lista({ ...f, preco: undefined });
    // lado e posição: as duas fichas de cada um, na ordem fixa (Esquerdo, Direito; Dianteiro, Traseiro), só as que têm peça
    const contaFixa = <K extends string>(itens: Item[], chave: (i: Item) => K | undefined, ordem: K[]) => {
      const m = new Map<K, number>();
      for (const it of itens) { const k = chave(it); if (k) m.set(k, (m.get(k) || 0) + 1); }
      return ordem.filter((k) => m.get(k)).map((k) => [k, m.get(k)!] as [K, number]);
    };
    return {
      marcas: conta('marca', (i) => i.b),
      modelos: f.marca ? contarModelos(lista({ ...f, modelo: undefined }), this.apelidos) : [],
      tipos: conta('tipo', (i) => i.c),
      // tipos de peça dentro do sistema escolhido (como os modelos dentro da marca)
      subs: f.tipo ? conta('sub', (i) => i.s) : [],
      anos: [...porAno.entries()].sort((a, b) => b[0] - a[0]),
      precos: FAIXAS.map(([k, rot, a, b]) => [k, rot, semPreco.filter((i) => i.p >= a && i.p < b).length] as const),
      lados: contaFixa<Lado>(lista({ ...f, lado: undefined }, { semLado: true }), (i) => i.l, ['E', 'D']),
      // a peça das duas posições (A) conta nas duas fichas
      posicoes: (['D', 'T'] as Posicao[]).map((k) => [k, lista({ ...f, pos: undefined }, { semPos: true }).filter((i) => i.pos === k || i.pos === 'A').length] as [Posicao, number]).filter(([, n]) => n > 0),
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
    // a palavra principal ou uma forma dela ("sinaleira" -> lanterna, "faróis" -> farol)
    const formas = [principal, ...(this.arvore(texto).formas.get(principal) ?? [])];
    const raiz = (a: string, b: string) => {
      let n = 0;
      while (n < a.length && n < b.length && a[n] === b[n]) n++;
      const menor = Math.min(a.length, b.length);
      return n >= Math.min(4, menor) && n >= menor - 3;
    };
    return lista.some((it) => {
      const p0 = palavras(it.n)[0] || '';
      if (!formas.some((w) => raiz(p0, w))) return false;
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

  /** Sugestões ao vivo: a MESMA regra do catálogo (procurar, sem filtro nenhum além da busca: o ano, o lado e a posição
   *  digitados valem igual), com atalhos de carro, marca ou sistema no topo. */
  sugestoes(q: string, n = 6): Sugestoes {
    const vazio: Sugestoes = { itens: [], total: 0, aproximado: false, atalhos: [], carros: [] };
    if (q.trim().length < 2) return vazio;
    const { texto, ano } = this.separar(q.trim());
    const r = this.filtrar({ q: q.trim() });
    return { itens: r.itens.slice(0, n), total: r.itens.length, aproximado: r.aproximado, atalhos: this.atalhos(texto, ano), carros: r.carros };
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

type Capa = Pick<Item, 'id' | 'e' | 'i' | 'r'>;
/** Capa da peça na busca: a de estúdio quando existe (igual às páginas), senão a foto do ML. Miniatura (tam 'E' ou
 *  'A', as sugestões da busca): a capa leve de 400 px quando ela está em dia (a inteira tem 1000 px para 56 na tela). */
export function capaItem(it: Capa, tam = 'O') {
  if (it.e !== '0' && it.r && (tam === 'E' || tam === 'A')) return `/estudio-400/${it.id}.webp`;
  if (it.e === '2') return `/estudio-pro/${it.id}.webp`;
  if (it.e === '1') return `/estudio/${it.id}.webp`;
  return foto(it.i, tam);
}

/** Larguras das capas leves dos cartões (scripts/capas-cartao.mjs): public/estudio-400/ e public/estudio-640/. */
export const LARGURAS_CAPA = [400, 640] as const;

/** sizes do cartão em cada lugar: a largura da FOTO do cartão, medida de 320 a 1920 px (moldura = 100vw - 32px até
 *  767, 100vw - 64px depois, no máximo 1240); arredondado para cima (um pouco a mais é melhor que a menos). */
export const SIZES_CARTAO = {
  // grade de 2/3/4 colunas (gap 12/16/18): categoria, carro e a grade do ano da página do carro (GradePecas.astro)
  grade: '(max-width: 699px) calc(50vw - 22px), (max-width: 1099px) calc(33.4vw - 21px), (max-width: 1303px) calc(25vw - 29px), 297px',
  // catálogo: 2/3 colunas; do 1024 a lateral dos filtros (264 + 28) entra; 4 colunas do 1280
  catalogo: '(max-width: 699px) calc(50vw - 22px), (max-width: 1023px) calc(33.4vw - 21px), (max-width: 1279px) calc(33.4vw - 129px), (max-width: 1303px) calc(25vw - 102px), 224px',
  // home, "Os mais procurados": trilho de 2,2 cartões no celular, 4 colunas do 700 (VitrineDestaques.astro)
  vitrine: '(max-width: 699px) calc(45.5vw - 20px), (max-width: 1303px) calc(25vw - 28px), 297px',
  // home, carrossel (Coverflow.astro): 208 px; no PC em 3D o do meio chega a 300
  carrossel: '(min-width: 1024px) 300px, 208px',
  // peça vendida (404) e "do mesmo carro" da peça: trilho de 208 px; 30vw do 1024; 6 colunas do 1280
  parecidas: '(min-width: 1280px) 200px, (min-width: 1024px) 30vw, 208px',
} as const;

/** A foto do cartão (UMA regra para os 3 que montam cartão: CartaoPeca.astro, a Etiqueta do catálogo e cartaoHtml):
 *  - capa de estúdio: src = a capa inteira (navegador sem srcset e o socorro do erro); com as capas leves em dia (r),
 *    srcset 400/640/inteira e o sizes do lugar: o celular 2x baixa ~8 KB e o 3x ~17 KB, não os ~41 KB da inteira;
 *  - sem capa: a foto do ML em 320/400/500. */
export function fotoCartao(it: Capa, sizes: string): { src: string; srcset?: string; sizes?: string; estudio: boolean } {
  if (it.e !== '0') {
    const src = capaItem(it);
    if (!it.r) return { src, estudio: true };
    return { src, srcset: [...LARGURAS_CAPA.map((w) => `/estudio-${w}/${it.id}.webp ${w}w`), `${src} 1000w`].join(', '), sizes, estudio: true };
  }
  if (!it.i || it.i.startsWith('http')) return { src: foto(it.i), estudio: false };
  return { src: foto(it.i, 'O'), srcset: `${foto(it.i, 'V')} 320w, ${foto(it.i, 'C')} 400w, ${foto(it.i, 'O')} 500w`, sizes, estudio: false };
}

/** "Volvo XC60 · 2018–2024" (peça de 2+ carros: "Volvo S60 / XC60 · 2018–2024", como no cartão) */
export function carroAnos(it: Pick<Item, 'b' | 'm' | 'y' | 'ms'>) {
  const carro = [it.b, it.ms && it.ms.length > 1 ? it.ms.join(' / ') : it.m].filter(Boolean).join(' ');
  const anos = it.y ? (it.y[0] === it.y[1] ? String(it.y[0]) : `${it.y[0]}–${it.y[1]}`) : '';
  return [carro, anos].filter(Boolean).join(' · ');
}
