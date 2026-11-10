// Textos proprios das paginas de categoria, carro e marca. Tudo sai dos dados reais da pagina
// (quantidade, familias, tipos de peca, marcas, modelos, anos). A frase escolhida e sempre a mesma
// para a mesma pagina (escolha por hash do endereco), mas muda de uma pagina para outra.
// Funcoes puras: nao lêem arquivo, para os testes rodarem sem o build.
import type { Peca, Resumo } from './dados';

type Carro = Resumo['carros'][number];
type Marca = Resumo['marcas'][number];

// Hash FNV-1a: mesma chave, mesma frase, em qualquer build.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function escolha<T>(chave: string, opcoes: readonly T[]): T {
  return opcoes[hash(chave) % opcoes.length];
}

/** "A", "A e B", "A, B e C". */
export function juntar(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`;
}

/** Blocos de peças na frase, com o "de" repetido: o nome do bloco já tem "e" ("faróis e lanternas"), e
 *  "motor, faróis e lanternas e painel e console" não se lê. -> "de motor, de faróis e lanternas e de painel e console". */
export function juntarDe(xs: string[]): string {
  return juntar(xs.map((x) => `de ${x}`));
}

/** Como a frase chama o bloco: "peças de freios" (tema "freios") ou, quando o nome do bloco já é a peça,
 *  "241 mangueiras do motor originais" (ehPeca). */
const BLOCO_E_PECA: Record<string, string> = {
  'botoes-e-chaves-de-seta': 'botões e chaves de seta',
  'acabamentos-e-forros': 'acabamentos e forros',
  'mangueiras-do-motor': 'mangueiras do motor',
  'modulos-e-eletrica': 'módulos e peças elétricas',
};
export function temaCategoria(f: { n: string; k: string }): { tema: string; ehPeca: boolean } {
  const peca = BLOCO_E_PECA[f.k];
  return peca ? { tema: peca, ehPeca: true } : { tema: f.n.replace(/^Peças de /i, '').toLowerCase(), ehPeca: false };
}

const P = (n: number) => (n === 1 ? 'peça' : 'peças');
/** Familia como sistema do carro, para a frase: "peças de interior" -> "interior". */
const sistema = (n: string) => n.replace(/^peças de /i, '');
const O = (n: number) => (n === 1 ? 'original' : 'originais');
const M = (n: number) => (n === 1 ? 'modelo' : 'modelos');
// "São 34 peças" / "É 1 peça" (sem "temos": a voz da loja no site é "a gente")
const S = (n: number) => (n === 1 ? 'É' : 'São');

/** Subtipo de peca em minusculas (ex.: "Bielas" -> "bielas"), mantendo siglas (ABS) e codigos com numero. */
export function minuscula(s: string): string {
  return s
    .split(' ')
    .map((w) => (/\d/.test(w) || (w.length > 1 && w === w.toUpperCase()) ? w : w.toLowerCase()))
    .join(' ');
}

/** Os 'n' mais frequentes (sem vazios e sem "Outros"/"Outros Botões"); empate em ordem alfabetica. */
export function contar(itens: (string | null | undefined)[], n = 3): string[] {
  const m = new Map<string, number>();
  for (const x of itens) {
    const v = (x ?? '').trim();
    if (!v || /^outr[oa]s\b/i.test(v)) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, n)
    .map((e) => e[0]);
}

/** Raiz do nome, para nao repetir singular e plural ("Catalisador" e "Catalisadores"). */
export function raiz(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/)
    .map((w) => w.replace(/(oes|aes|es|s)$/, '')).join(' ');
}

/** Os 'n' tipos de peca mais frequentes, sem repetir a mesma raiz, em minusculas para a frase. */
export function tiposFrase(itens: (string | null | undefined)[], n = 2): string[] {
  const out: string[] = [];
  const vistos = new Set<string>();
  for (const t of contar(itens, 30)) {
    const r = raiz(t);
    if (vistos.has(r)) continue;
    vistos.add(r);
    out.push(minuscula(t));
    if (out.length >= n) break;
  }
  return out;
}

/** Faixa de anos das pecas que tem ano lido (y). null se nenhuma tem. */
export function faixaAnos(lista: Peca[]): [number, number] | null {
  const ys = lista.map((p) => p.y).filter((y): y is [number, number] => !!y);
  if (!ys.length) return null;
  return [Math.min(...ys.map((y) => y[0])), Math.max(...ys.map((y) => y[1]))];
}

const anoTxt = (a: [number, number] | null | undefined) =>
  !a ? '' : a[0] === a[1] ? `${a[0]}` : `${a[0]} a ${a[1]}`;

// Descrição (meta) com até 160 caracteres: o Google corta o resto (auditoria 4, 9.1).
export const DESCRICAO_MAX = 160;

/** A 1ª opção que cabe em `max`; se nenhuma couber, a última cortada no fim de uma palavra, com reticências. */
export function caber(opcoes: string[], max = DESCRICAO_MAX): string {
  const limpas = opcoes.map((o) => o.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const ok = limpas.find((o) => o.length <= max);
  if (ok) return ok;
  const ult = limpas[limpas.length - 1] ?? '';
  const corte = ult.slice(0, max - 1);
  const i = corte.lastIndexOf(' ');
  return `${(i > max * 0.6 ? corte.slice(0, i) : corte).replace(/[\s,.;:·–-]+$/, '')}…`;
}

/** Corta no fim de uma palavra, com reticências, se passar de `max`. */
export function encurtar(s: string, max: number): string {
  if (s.length <= max) return s;
  const i = s.lastIndexOf(' ', max - 1);
  return `${s.slice(0, i > 0 ? i : max - 1).replace(/[\s,.;:·–-]+$/, '')}…`;
}

export type Textos = { paragrafos: string[]; meta: string };

/** Pagina de categoria (/categoria/<k>.html). */
export function textosCategoria(f: { n: string; k: string }, lista: Peca[]): Textos {
  const N = lista.length;
  if (!N) return { paragrafos: [], meta: f.n };
  const { tema, ehPeca } = temaCategoria(f);
  const subs = tiposFrase(lista.map((p) => p.s), 2);
  const marcas = contar(lista.map((p) => p.b), 3);
  const modelos = new Set(lista.flatMap((p) => (p.ms?.length ? p.ms : p.m ? [p.m] : []).map((m) => `${p.b} ${m}`))).size;
  const a = faixaAnos(lista);
  const anosFrase = a ? `, de carros de ${a[0] === a[1] ? a[0] : `${a[0]} a ${a[1]}`}` : '';
  const k = `categoria:${f.k}`;

  const p1 = escolha(`${k}:1`, ehPeca ? [
    `${S(N)} ${N} ${tema} ${O(N)} no estoque.`,
    `No estoque há ${N} ${tema} ${O(N)}, de carros com baixa legal no Detran-RS.`,
    `Esta categoria reúne ${N} ${tema} ${O(N)}, de carros com baixa legal no Detran-RS.`,
  ] : [
    `${S(N)} ${N} ${P(N)} de ${tema} ${O(N)} no estoque.`,
    `No estoque há ${N} ${P(N)} de ${tema} ${O(N)}, de carros com baixa legal no Detran-RS.`,
    `Esta categoria reúne ${N} ${P(N)} ${O(N)} de ${tema}, retiradas de carros com baixa legal no Detran-RS.`,
  ]);
  const paragrafos = [p1];
  if (subs.length) {
    paragrafos.push(escolha(`${k}:2`, [
      `Os tipos com mais peças são ${juntar(subs)}.`,
      `Entre elas, as mais comuns são ${juntar(subs)}.`,
      `O que mais aparece aqui: ${juntar(subs)}.`,
    ]));
  }
  if (marcas.length) {
    const base = modelos ? `${modelos} ${M(modelos)}` : '';
    paragrafos.push(base ? escolha(`${k}:3`, [
      `As marcas com mais peças são ${juntar(marcas)}, e há peças para ${base}${anosFrase}.`,
      `Há peças para ${base}${anosFrase}; a marca com mais peças é ${marcas[0]}.`,
    ]) : `As marcas com mais peças são ${juntar(marcas)}${anosFrase}.`);
  }
  const qtd = ehPeca ? `${N} ${tema} ${O(N)}` : `${N} peças originais de ${tema}`;
  const meta = caber([
    `${qtd}${subs.length ? `: ${juntar(subs.slice(0, 2))}` : ''}. Nota fiscal e 90 dias de garantia. CDV nº 01060.`,
    `${qtd}. Nota fiscal e 90 dias de garantia. CDV nº 01060.`,
    `${qtd}. Nota fiscal e 90 dias de garantia.`,
  ]);
  return { paragrafos, meta };
}

/** Pagina de carro (/carros/<marca-modelo>.html). */
export function textosCarro(c: Pick<Carro, 'k' | 'b' | 'm' | 'c' | 'anos' | 'fams'>, lista: Peca[]): Textos {
  const N = lista.length;
  if (!N) return { paragrafos: [], meta: `${c.b} ${c.m}` };
  const nome = `${c.b} ${c.m}`;
  const a = c.anos ?? faixaAnos(lista);
  const anos = a ? ` (${anoTxt(a)})` : '';
  const k = `carro:${c.k}`;
  const fams = (c.fams ?? []).filter(([n]) => n !== 'Outros').slice(0, 3).map(([n]) => n.toLowerCase());
  const subs = tiposFrase(lista.map((p) => p.s), 2);

  const p1 = escolha(`${k}:1`, [
    `${S(N)} ${N} ${P(N)} ${O(N)} para ${nome}${anos}.`,
    `No estoque há ${N} ${P(N)} para ${nome}${anos}, de carros com baixa legal no Detran-RS.`,
    `Para ${nome}${anos}, ${S(N).toLowerCase()} ${N} ${P(N)} ${O(N)} em estoque.`,
  ]);
  const paragrafos = [p1];
  if (fams.length && N < 5) {
    paragrafos.push(N === 1 ? `A peça do ${nome} é ${juntarDe(fams)}.` : `As peças do ${nome} são ${juntarDe(fams)}.`);
  } else if (fams.length) {
    paragrafos.push(escolha(`${k}:2`, [
      `No ${nome}, a maioria das peças é ${juntarDe(fams)}.`,
      `Para o ${nome}, aparecem mais peças ${juntarDe(fams.map(sistema))}.`,
      `No ${nome}, o que mais tem é peça ${juntarDe(fams.map(sistema))}.`,
    ]));
  }
  if (subs.length) {
    paragrafos.push(escolha(`${k}:3`, [
      `Os tipos de peça que mais aparecem para o ${nome} são ${juntar(subs)}.`,
      `Entre as peças do ${nome}, as mais comuns são ${juntar(subs)}.`,
    ]));
  } else {
    paragrafos.push(`Antes de pedir, confira o ano e o código gravado da peça para ${nome}; na dúvida, a gente confere pelo WhatsApp.`);
  }
  const meta = caber([
    `${N} ${P(N)} ${O(N)} de ${nome}${anos}${fams.length ? `: ${fams.slice(0, 2).join(', ')}` : ''}. Nota fiscal e 90 dias de garantia. CDV nº 01060.`,
    `${N} ${P(N)} ${O(N)} de ${nome}${anos}. Nota fiscal e 90 dias de garantia. CDV nº 01060.`,
    `${N} ${P(N)} ${O(N)} de ${nome}${anos}. Nota fiscal e 90 dias de garantia.`,
  ]);
  return { paragrafos, meta };
}

/** Pagina de marca (/marca/<marca>.html). */
export function textosMarca(m: Pick<Marca, 'n' | 'c' | 'm'>, lista: Peca[]): Textos {
  const N = m.c || lista.length;
  const modelos = m.m.length;
  if (!N) return { paragrafos: [], meta: m.n };
  const nomes = m.m.slice(0, 3).map((x) => x.n);
  const fams = contar(lista.map((p) => p.c), 3).map((x) => x.toLowerCase());
  const a = faixaAnos(lista);
  const anosFrase = a ? `, com carros de ${anoTxt(a)}` : '';
  const k = `marca:${m.n}`;

  // sem modelo lido (Mini, Lifan): nada de "para 0 modelos"
  const paragrafos: string[] = [
    modelos ? escolha(`${k}:1`, [
      `${S(N)} ${N} ${P(N)} ${O(N)} de ${m.n} para ${modelos} ${M(modelos)}.`,
      `Há ${N} ${P(N)} ${O(N)} de ${m.n} em estoque, para ${modelos} ${M(modelos)}${modelos > 1 ? ' diferentes' : ''}.`,
      `As peças de ${m.n} no estoque somam ${N}, de ${modelos} ${M(modelos)}.`,
    ]) : `${S(N)} ${N} ${P(N)} ${O(N)} de ${m.n} no estoque.`,
  ];
  if (nomes.length) {
    paragrafos.push(escolha(`${k}:2`, [
      `Os modelos com mais peças são ${juntar(nomes)}.`,
      `Entre os carros, ${juntar(nomes)} são os que mais aparecem.`,
      `Os carros com mais anúncios são ${juntar(nomes)}.`,
    ]));
  }
  if (fams.length) {
    // "A maioria" só com 5+ peças (auditoria 4, 7.2: a Lifan tinha 1 peça e "A maioria é de faróis")
    paragrafos.push(N === 1 ? `A peça é ${juntarDe(fams)}${a ? `, para carros de ${anoTxt(a)}` : ''}.`
      : N < 5 ? `São peças ${juntarDe(fams)}${anosFrase}.`
      : escolha(`${k}:3`, [
        `A maioria é ${juntarDe(fams)}${anosFrase}.`,
        `O que mais tem é peça ${juntarDe(fams.map(sistema))}${anosFrase}.`,
      ]));
  }
  const meta = caber([
    `${N} ${P(N)} ${O(N)} de ${m.n}${modelos ? ` para ${modelos} ${M(modelos)}` : ''}${nomes.length ? `: ${juntar(nomes.slice(0, 2))}` : ''}. Nota fiscal e 90 dias de garantia. CDV nº 01060.`,
    `${N} ${P(N)} ${O(N)} de ${m.n}${modelos ? ` para ${modelos} ${M(modelos)}` : ''}. Nota fiscal e 90 dias de garantia. CDV nº 01060.`,
    `${N} ${P(N)} ${O(N)} de ${m.n}. Nota fiscal e 90 dias de garantia.`,
  ]);
  return { paragrafos, meta };
}

// Titulos (<title>) das paginas de lista: cada uma e unica, com a marca no fim.
export const tituloCategoria = (n: string) => `${n}: peças originais | Izzat Car Imports`;
export const tituloCarro = (b: string, m: string, anos: [number, number] | null) =>
  `Peças ${b} ${m}${anos ? ` ${anos[0]} a ${anos[1]}` : ''} originais | Izzat Car Imports`;
export const tituloMarca = (n: string) => `Peças ${n} originais | Izzat Car Imports`;

/** Termos que nunca podem aparecer nos textos (regras da marca: nada nao confirmado). */
export const PROIBIDOS = ['frete grátis', 'tem aqui', 'mais barato', '100% garantido', 'lacre', 'retirada no local', 'horário', 'endereço', '12x'];
