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
import { MAPA_SINONIMOS, MAPA_FORA, MAIOR_GATILHO, VAZIAS, singulares, plural } from './sinonimos';
import { zonaDaChave, pecaNaZona } from './raioX';

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
  // peça única (estoque 1 no anúncio): '1' ou '0' por peça. O cartão diz "Peça única" só com o dado (preparar_dados.py)
  q?: string;
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
  /** 1 = peça única (uma só em estoque no anúncio): o cartão diz "Peça única"; ausente = sem o dado ou mais de uma */
  q?: 1;
};
export type Filtros = {
  q?: string; marca?: string; modelo?: string; ano?: number; tipo?: string;
  /** subtipo (campo s: "Lanternas Traseiras"), o mesmo dos cartões "Por tipo" da página da categoria */
  sub?: string;
  preco?: string; frete?: boolean; ordem?: 'rel' | 'asc' | 'desc' | 'novos';
  /** fichas "Esquerdo · Direito" e "Dianteiro · Traseiro" (endereço: &lado=esquerdo|direito, &pos=dianteiro|traseiro) */
  lado?: Lado; pos?: Posicao;
  /** parte do carro do Raio-x (lib/raioX.ts ZONAS: 'frente', 'motor'…): a zona inteira, com a mesma regra do painel */
  zona?: string;
};
export type Carro = { b: string; m: string };
/** Linha de atalho das sugestões: o carro, a marca ou o sistema que a pessoa digitou, com a contagem. */
export type Atalho = { tipo: 'carro' | 'marca' | 'sistema'; rot: string; sub: string; n: number; href: string };
export type Sugestoes = {
  itens: Item[]; total: number; aproximado: boolean; atalhos: Atalho[]; carros: Carro[];
  /** quantas peças do começo da lista SÃO o que foi digitado; citam = nenhuma é, a lista é das que citam a palavra no
   *  nome; faltou = o lado/posição que o estoque não tem */
  nExatas: number; citam: boolean; faltou: Faltou | null;
};
/** O carro salvo no "Meu carro" (lib/meuCarro.ts): as peças dele sobem na busca. */
export type CarroSalvo = { b: string; m: string; y?: number | null };
/** O lado ou a posição que a busca pediu e o estoque não tem para a peça digitada. fem = o gênero da peça, lido do nome
 *  das peças do estoque ("Lanterna traseira esquerda": true; "Retrovisor esquerdo": false), para a frase da tela. */
export type Faltou = { lado?: Lado; pos?: Posicao; fem?: boolean };
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
/** Só letras e números, sem hífen nem espaço ("Para-choque" -> "parachoque"). */
const cp = (s: string) => s.replace(/[^a-z0-9]/g, '');

/** a e b diferem em uma letra só (trocada, a mais, a menos ou duas vizinhas invertidas: "alternadro"). */
function umaEdicao(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [curta, longa] = a.length < b.length ? [a, b] : [b, a];
  return curta.slice(i) === longa.slice(i + 1);
}

/** Como a palavra soa, para o erro de quem escreve de ouvido ("fexadura", "amortesedor", "compresor", "retrovizor"). */
const som = (w: string) => w.replace(/ch/g, 'x').replace(/ss|c(?=[ei])/g, 's').replace(/z/g, 's').replace(/(.)\1/g, '$1');

/** Uma palavra do estoque e uma palavra digitada são a MESMA palavra? Igual, plural/singular ("lanternas", "faróis",
 *  "botões"), a concordância ("elétrico"/"elétrica", "dianteiro"/"dianteira") ou um erro de digitação em palavra de 6+
 *  letras ("retrovizor", "alternadro"). Palavra curta só é igual a ela mesma ("par" não é "paralama"; "capa" não é "capô")
 *  e o começo da palavra não basta ("porta" não é "porta-luvas"; "motor" não é "motorista"). */
export function mesmaPalavra(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (la < 3 || lb < 3 || la - lb > 2 || lb - la > 2) return false;
  const menor = la < lb ? la : lb;
  // a 1ª letra diferente só vale como erro de digitação ("etrovisor")
  if (a.charCodeAt(0) !== b.charCodeAt(0)) return menor >= 6 && umaEdicao(a, b);
  let n = 1;
  while (n < menor && a.charCodeAt(n) === b.charCodeAt(n)) n++;
  if (menor >= 5 && n >= 4 && n >= menor - 1) return true;
  if (n >= 2) {
    const l = la >= lb ? a : b;
    if (l.charCodeAt(l.length - 1) === 115 /* s */ && singulares(l).includes(la >= lb ? b : a)) return true;
  }
  return menor >= 6 && umaEdicao(a, b);
}

/** O que a pessoa procura, tirando o carro, a marca, o ano, o lado e a posição: cada unidade é uma palavra, uma composta
 *  ("para choque" = "parachoque") ou um gatilho do jeito de falar. formas[0] = como foi digitado; as outras = as formas
 *  de lib/sinonimos.ts ("sinaleira": [sinaleira], [lanterna]; "espelho retrovisor": [espelho, retrovisor], [retrovisor]).
 *  fora = as palavras que tiram a peça do caminho do sinônimo ("frente": não o painel). */
type Unidade = { chave: string; formas: string[][]; fora: string[] };
/** A busca montada: os grupos para o MiniSearch, a última palavra (pode estar pela metade), as formas de cada palavra (a
 *  ordem usa), as unidades da peça, os termos de carro e marca (valem só inteiros: "gol" não é "Golf") e quantas
 *  unidades a busca tem ao todo. */
type Arvore = { grupos: Query[]; ultima: string; formas: Map<string, string[]>; uns: Unidade[]; exatos: Set<string>; n: number };
/** Onde um carro ou marca foi digitado (palavras i a i+n-1) e o que também vale por ele no texto do anúncio: a marca por
 *  extenso para "vw"/"gm", o carro principal para o apelido de carro unido ("new fiesta" -> fiesta). */
type Janela = { i: number; n: number; alt?: string[] };

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
// erro de digitação comum nas palavras de lado e posição ("trazeira", "esqerdo", "diantero")
const ERRO_LP: Record<string, string> = {
  esqerdo: 'esquerdo', esqerda: 'esquerda', esquedo: 'esquerdo', esqueda: 'esquerda', esquerdo: 'esquerdo',
  diantero: 'dianteiro', diantera: 'dianteira', dianterio: 'dianteiro', dianteria: 'dianteira',
  traseio: 'traseiro', traseia: 'traseira', trazero: 'traseiro', trazera: 'traseira',
};
/** A palavra de lado ou posição como a tabela conhece ("trazeira" -> "traseira"); as outras voltam iguais. */
const palavraLP = (w: string): string => {
  if (LADO_Q[w] || POS_Q[w]) return w;
  const s = w.replace(/z/g, 's');
  if (POS_Q[s] || LADO_Q[s]) return s;
  return ERRO_LP[w] ?? w;
};

/** A busca como a pessoa digitou, sem o que só atrapalha: o apóstrofo de "bomba d'água" (e "d agua", "dagua") e o
 *  "cod"/"código"/"ref" antes de um código ("cod 31476671"). */
export function limpar(q: string): string {
  return q.replace(/[’‘`´]/g, "'")
    .replace(/(^|\s)d'\s*(?=\p{L})/giu, '$1')
    .replace(/(^|\s)d\s+(?=[aáâãeéêoóôu])/giu, '$1')
    .replace(/(^|\s)d[aá]gua(?=\s|$)/giu, '$1agua')
    .replace(/(^|\s)(c[oó]d(igo)?|ref(er[eê]ncia)?)\s*[.:]?\s+(?=\S*\d)/giu, '$1')
    .replace(/'/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "retrovisor lado direito xc60" -> { texto: "retrovisor xc60", lado: 'D', palavras: ["direito"] }. Os dois lados (ou as
 *  duas posições) na mesma busca ficam no texto ("maçaneta dianteira/traseira"). */
export function separarLadoPos(q: string): { texto: string; lado?: Lado; pos?: Posicao; palavras: string[] } {
  const ws = q.trim().split(/\s+/).filter(Boolean);
  const ns = ws.map((w) => palavraLP(normal(w).replace(/[^a-z0-9]/g, '')));
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
  /** por palavra do texto (palavras()): é carro ou marca; e onde cada um foi digitado */
  usado: boolean[]; janelas: Janela[];
  /** os apelidos de carro unido digitados ("c180", "new fiesta"): a peça que diz o apelido vem antes das outras do principal */
  apelidos: Carro[];
};
/** codigo: o código gravado buscado ("8200328856"), quando alguma peça da lista tem exatamente esse código */
type PorTexto = {
  base: Item[]; aproximado: boolean; carros: Carro[]; codigo?: string;
  /** as peças que SÃO o que foi digitado (o nome começa pela palavra); null = a busca não separa (só carro, código, ou a
   *  palavra não é nome de peça no estoque) */
  exatas: Set<number> | null;
  /** nenhuma peça do estoque tem esse nome; a lista é das peças ligadas à palavra: as que a citam no nome ("capô": a
   *  "Fechadura capô") e, quando a palavra é o nome de um bloco ("suspensão"), o bloco */
  citam: boolean;
  /** a busca tem palavra de peça (não é só carro, marca ou ano) */
  temTipo: boolean;
};
type Filtrado = {
  itens: Item[]; aproximado: boolean; carros: Carro[]; comTexto: boolean; codigo: string; derivado: boolean;
  ladoQ?: Lado; posQ?: Posicao; faltou?: Faltou; outros: Item[]; exatas: Set<number> | null; citam: boolean; temTipo: boolean;
};
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
const APELIDOS: Record<string, string> = {
  gm: 'Chevrolet', chevy: 'Chevrolet', vw: 'Volkswagen', volks: 'Volkswagen', volkswagem: 'Volkswagen', wolkswagen: 'Volkswagen',
  mercedes: 'Mercedes-Benz', mb: 'Mercedes-Benz',
};
/** As palavras dos gatilhos do jeito de falar (lib/sinonimos.ts): o erro de digitação também é corrigido para elas. */
const GATILHOS = new Set([...MAPA_SINONIMOS.keys()].flatMap((k) => k.split(' ')));

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
  /** a busca pediu um lado ou posição que o estoque não tem para o tipo digitado ("sinaleira direita tracker" sem a
   *  direita): a lista sai vazia e isto diz o que faltou; outrosLados = as peças do outro lado (a dica "tem a esquerda"). */
  faltou: Faltou | null = null;
  outrosLados: Item[] = [];
  /** quantas peças do começo da lista SÃO o que foi digitado ("farol": os 12 faróis; depois vêm as que só citam, "Suporte
   *  farol", sob o título "Outras peças com…"). Igual ao tamanho da lista quando a busca não separa; 0 nas parecidas. */
  nExatas = 0;
  /** nenhuma peça do estoque tem o nome digitado; a lista é das peças ligadas à palavra: as que a citam no nome ("capô":
   *  a "Fechadura capô"; "teto": a "Luz teto") e o bloco, quando a palavra é o nome de um ("suspensão"). A tela diz
   *  "N peças ligadas a “capô”", nunca "N peças para “capô”". */
  citam = false;
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
  // as palavras dos nomes (montarVocab): por peça (_nt) e por palavra (_cab: a 1ª do nome; _nome: qualquer uma; _sis: as
  // do tipo "s"; _bloco: as do bloco "c"; _porS: as peças de cada tipo); _pares: vizinhas no nome, juntas; _prefixos: a
  // 1ª parte das compostas com hífen; _principal: apelido de carro unido -> o carro principal
  private _nt: string[][] | null = null;
  private _cab = new Map<string, number[]>();
  private _nome = new Map<string, number[]>();
  private _sis = new Map<string, number[]>();
  private _bloco = new Map<string, number[]>();
  private _porS = new Map<string, number[]>();
  private _pares = new Map<string, [string, string]>();
  private _prefixos = new Set<string>();
  private _vocab: string[] = [];
  private _vocabPor = new Map<string, string[]>();
  /** o nome de cada peça sem acento e em minúsculas (a ordem usa em toda busca) */
  private _nn: string[] = [];
  private _casam = new Map<string, { ig: string[]; pre: string[] }>();
  private _principal = new Map<string, string>();

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
      if (ix.q?.[k] === '1') it.q = 1;
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
    // os nomes de carro, marca e sistema e as palavras dos nomes das peças também ficam prontos antes da 1ª letra
    await new Promise((r) => setTimeout(r, 0));
    this.montarNomes();
    await new Promise((r) => setTimeout(r, 0));
    this.montarVocab();
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
    // apelido de carro unido ("Ford|New Fiesta"): o principal é o modelo que mais aparece nas peças dele
    for (const ap of this.apelidos) {
      const [b, a] = ap.split('|');
      const conta = new Map<string, number>();
      for (const it of this.itens) if (it.b === b && it.ms?.includes(a)) for (const m of it.ms) if (m !== a && !this.apelidos.has(`${b}|${m}`)) conta.set(m, (conta.get(m) ?? 0) + 1);
      const pr = [...conta].sort((x, y) => y[1] - x[1])[0]?.[0];
      if (pr) this._principal.set(ap, pr);
    }
    this._modelos = modelos; this._marcas = marcas; this._familias = familias;
  }

  /** O que foi digitado: carro(s), marca(s), sistema e o resto (o nome da peça). usado = quais palavras (na ordem de
   *  palavras(texto)) são carro ou marca; janelas = onde cada um foi digitado. Apelido de carro unido ("new fiesta",
   *  "c180") vale pelo carro principal ("Fiesta", "Classe C"). */
  entender(texto: string): Entendido {
    this.montarNomes();
    const ws = palavras(texto);
    const usado = ws.map(() => false);
    const achados: Carro[] = [];
    const marcas: string[] = [];
    const janelas: Janela[] = [];
    const apelidos: Carro[] = [];
    for (let n = Math.min(3, ws.length); n >= 1; n--) {
      for (let i = 0; i + n <= ws.length; i++) {
        if (usado.slice(i, i + n).some(Boolean)) continue;
        const k = ws.slice(i, i + n).join('');
        const cs = this._modelos!.get(k);
        if (cs) {
          let alt: string[] | undefined;
          for (const c of cs) {
            const pr = this._principal.get(`${c.b}|${c.m}`);
            if (pr) { alt = palavras(pr); apelidos.push({ b: c.b, m: c.m }); }
            const car = pr ? { b: c.b, m: pr } : { b: c.b, m: c.m };
            if (!achados.some((x) => x.b === car.b && x.m === car.m)) achados.push(car);
          }
          for (let j = i; j < i + n; j++) usado[j] = true;
          janelas.push({ i, n, alt });
          continue;
        }
        const mb = this._marcas!.get(k);
        if (mb) {
          if (!marcas.includes(mb.b)) marcas.push(mb.b);
          for (let j = i; j < i + n; j++) usado[j] = true;
          janelas.push({ i, n, alt: APELIDOS[k] ? [compacto(mb.b)] : undefined });
        }
      }
    }
    // "volvo xc60": a marca escolhe entre modelos de mesmo nome e deixa de ser "marca solta"
    let carros = achados;
    if (marcas.length && achados.some((c) => marcas.includes(c.b))) carros = achados.filter((c) => marcas.includes(c.b));
    const marcasSoltas = marcas.filter((b) => !carros.some((c) => c.b === b));
    const resto = ws.filter((w, i) => !usado[i] && !VAZIAS.has(w));
    const familia = !carros.length && !marcasSoltas.length && resto.length ? this._familias!.get(resto.join(''))?.c : undefined;
    return { carros: carros.map(({ b, m }) => ({ b, m })), marcas: marcasSoltas, resto, familia, usado, janelas, apelidos };
  }

  // ---- as palavras dos nomes do estoque (para saber o que a peça É) ----
  /** Palavras de um nome ou de um sistema: sem acento, sem as vazias, composta junta ("Para-choque" -> parachoque;
   *  "Bomba d'água" -> bomba, agua; "Brake light (luz de freio)" -> brake, light, luz, freio). */
  private palavrasDoNome(s: string): string[] {
    return normal(s).replace(/\bd'/g, '').split(/\s+/).map(cp).filter((w) => w && !VAZIAS.has(w));
  }

  /** Monta, uma vez, as palavras do nome de cada peça e os índices por palavra (a 1ª do nome, qualquer uma do nome, as do
   *  tipo "s" e as do bloco "c"). Não vai no busca.json nem nas peças (a 1ª tela do catálogo é serializada no HTML). */
  private montarVocab() {
    if (this._nt) return;
    const nt: string[][] = [];
    const por = (m: Map<string, number[]>, w: string, k: number) => { const l = m.get(w); if (l) { if (l[l.length - 1] !== k) l.push(k); } else m.set(w, [k]); };
    const memo = new Map<string, string[]>();
    const doSistema = (s: string) => { let r = memo.get(s); if (!r) { r = this.palavrasDoNome(s); memo.set(s, r); } return r; };
    for (const it of this.itens) {
      const ws = this.palavrasDoNome(it.n);
      nt.push(ws);
      if (ws.length) por(this._cab, ws[0], it.k);
      for (let i = 0; i < ws.length; i++) {
        por(this._nome, ws[i], it.k);
        // vizinhas no nome: "ar condicionado" digitado junto ("arcondicionado")
        if (i + 1 < ws.length && !this._pares.has(ws[i] + ws[i + 1])) this._pares.set(ws[i] + ws[i + 1], [ws[i], ws[i + 1]]);
      }
      for (const w of doSistema(it.s)) por(this._sis, w, it.k);
      if (it.s) por(this._porS, it.s, it.k);
      for (const w of doSistema(it.c)) por(this._bloco, w, it.k);
      // 1ª parte das compostas com hífen ("para", "porta", "quebra", "alto"): quem pode se juntar com a vizinha
      for (const w of normal(it.n).split(/\s+/)) { const i = w.indexOf('-'); if (i > 1) this._prefixos.add(w.slice(0, i)); }
    }
    this._vocab = [...new Set([...this._nome.keys(), ...this._sis.keys(), ...this._bloco.keys()])];
    for (const t of this._vocab) { const l = this._vocabPor.get(t[0]); if (l) l.push(t); else this._vocabPor.set(t[0], [t]); }
    this._nn = this.itens.map((it) => normal(it.n));
    this._nt = nt;
  }

  /** As palavras do estoque que são a palavra digitada (ig) e as que só começam por ela (pre: a busca ao vivo). */
  private casam(w: string): { ig: string[]; pre: string[] } {
    let m = this._casam.get(w);
    if (!m) {
      const ig: string[] = [], pre: string[] = [];
      // (só as que começam pela mesma letra: o erro na 1ª letra fica com o corretor e com a aproximação do MiniSearch)
      for (const t of this._vocabPor.get(w[0]) ?? []) { if (mesmaPalavra(t, w)) ig.push(t); else if (w.length >= 2 && t.startsWith(w)) pre.push(t); }
      m = { ig, pre };
      if (this._casam.size > 600) this._casam.clear();
      this._casam.set(w, m);
    }
    return m;
  }

  /** Palavras vizinhas que, juntas, são uma palavra de algum nome do estoque ("porta luvas" = "portaluvas", "para
   *  choque" = "parachoque", "semi eixo" = "semieixo", "porta copo" = "portacopos"): quantas palavras e a forma do
   *  estoque. Vale antes de tirar as palavras vazias (o "para" de "para choque" não é a preposição). Com a 1ª parte de
   *  uma composta do estoque ("para", "porta", "quebra"), tolera 1 erro ("para choqe") e a palavra pela metade no fim
   *  da busca ao vivo ("porta luv"). */
  private composta(ws: { w: string; carro: boolean }[], i: number, ultima: string): { n: number; junta: string } | null {
    for (const n of [3, 2]) {
      const partes = ws.slice(i, i + n);
      if (partes.length < n || partes.some((x) => x.carro || /\d/.test(x.w))) continue;
      const j = partes.map((x) => x.w).join('');
      // a última parte com 2 letras só vale pela metade, no fim da busca ao vivo ("porta lu" a caminho de "porta luvas")
      const curta = partes[n - 1].w.length < 3;
      if (curta && !(n === 2 && partes[1].w.length === 2 && partes[1].w === ultima && i + n === ws.length)) continue;
      if (!curta) {
        if (this._nome.has(j)) return { n, junta: j };
        const sing = singulares(j).find((s) => this._nome.has(s));
        if (sing) return { n, junta: sing };
        if (this._nome.has(`${j}s`)) return { n, junta: `${j}s` };
      }
      if (n === 2 && this._prefixos.has(partes[0].w) && j.length >= 7) {
        const k = `+${j}${partes[1].w === ultima && i + n === ws.length ? '*' : ''}`;
        let m = this._casam.get(k);
        if (!m) {
          const meio = k.endsWith('*');
          const t = this._vocab.find((x) => this._nome.has(x) && x.startsWith(partes[0].w) && (umaEdicao(x, j) || (meio && x.startsWith(j))));
          m = { ig: t ? [t] : [], pre: [] };
          this._casam.set(k, m);
        }
        if (m.ig.length) return { n, junta: m.ig[0] };
      }
    }
    return null;
  }

  /** Árvore da busca: cada palavra é um termo; "xc 60", "para-choque" e "8200-328-856" valem junto OU separado; a
   *  composta digitada com espaço também ("porta luvas"). O jeito de falar do cliente (lib/sinonimos.ts, a frase mais
   *  longa primeiro) acrescenta as outras formas: "sinaleira" = sinaleira OU lanterna; "máquina de vidro" = (máquina E
   *  vidro) OU (motor E vidro)...; e o plural, a forma no singular ("faróis" = faróis OU farol, só a palavra inteira).
   *  Carro e marca valem só como palavra inteira ("gol" não é "Golf"); "vw"/"gm" valem pela marca por extenso e o
   *  apelido de carro unido pelo principal ("new fiesta" acha a peça que diz só "Fiesta"). */
  private arvore(texto: string, ent: Entendido): Arvore {
    this.montarVocab();
    const grupos: Query[] = [];
    const formas = new Map<string, string[]>();
    const uns: Unidade[] = [];
    const exatos = new Set<string>();
    const blocos = normal(texto).split(/\s+/).filter(Boolean);
    const ws: { w: string; bloco: number; carro: boolean }[] = [];
    blocos.forEach((bl, b) => bl.split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => ws.push({ w, bloco: b, carro: !!ent.usado[ws.length] })));
    const ultima = ws.length ? ws[ws.length - 1].w : '';
    const E = (qs: Query[]): Query => (qs.length === 1 ? qs[0] : { combineWith: 'AND', queries: qs });
    const juntoOuSeparado = (partes: string[], junta = partes.join('')): Query => ({ combineWith: 'OR', queries: [E(partes), ...new Set([junta, partes.join('')])] });
    // as unidades da busca: carro ou marca, bloco com hífen/ponto/barra, letra + número, composta com espaço e palavra solta
    type U0 = { q: Query; chave: string; solta: boolean; carro: boolean; pal: string[] };
    const u0: U0[] = [];
    const soVazias = ws.every((x) => VAZIAS.has(x.w));
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i], p = ws[i + 1];
      // carro ou marca com outra forma no anúncio ("vw" = Volkswagen; "new fiesta" = Fiesta): a janela inteira
      const jan = ent.janelas.find((j) => j.i === i && j.alt);
      if (jan) {
        const partes = ws.slice(i, i + jan.n).map((x) => x.w);
        for (const w of [...partes, ...jan.alt!]) exatos.add(w);
        u0.push({ q: { combineWith: 'OR', queries: [E(partes), E(jan.alt!)] }, chave: partes.join(''), solta: false, carro: true, pal: [] });
        i += jan.n - 1;
        continue;
      }
      // bloco com hífen, ponto ou barra ("xc-60", "316-63477", "para-choque", "8200-328-856"): o bloco inteiro
      if (p && a.bloco === p.bloco && /[-./]/.test(blocos[a.bloco])) {
        let fim = i + 1;
        while (ws[fim + 1]?.bloco === a.bloco) fim++;
        const partes = ws.slice(i, fim + 1).map((x) => x.w);
        const carro = ws.slice(i, fim + 1).every((x) => x.carro);
        const j = partes.join('');
        if (carro) for (const w of [...partes, j]) exatos.add(w);
        // "para-choque" é uma palavra do estoque; "ar-condicionado" o estoque escreve separado ("ar condicionado")
        u0.push({ q: juntoOuSeparado(partes), chave: j, solta: false, carro, pal: this._nome.has(j) ? [j] : partes });
        i = fim;
        continue;
      }
      if (p && parLetraNumero(a.w, p.w)) { // letra + número ("xc 60")
        const carro = a.carro && p.carro;
        if (carro) for (const w of [a.w, p.w, a.w + p.w]) exatos.add(w);
        u0.push({ q: juntoOuSeparado([a.w, p.w]), chave: a.w + p.w, solta: false, carro, pal: [a.w + p.w] });
        i++;
        continue;
      }
      if (!a.carro) {
        const c = this.composta(ws, i, ultima);
        if (c) {
          u0.push({ q: juntoOuSeparado(ws.slice(i, i + c.n).map((x) => x.w), c.junta), chave: c.junta, solta: false, carro: false, pal: [c.junta] });
          i += c.n - 1;
          continue;
        }
        // duas palavras do estoque digitadas juntas ("arcondicionado")
        const par = !this._nome.has(a.w) && !/\d/.test(a.w) ? this._pares.get(a.w) : undefined;
        if (par) { u0.push({ q: { combineWith: 'OR', queries: [a.w, E(par)] }, chave: a.w, solta: false, carro: false, pal: par }); continue; }
      }
      if (!VAZIAS.has(a.w) || soVazias) {
        if (a.carro) exatos.add(a.w);
        // o plural que não começa pela palavra ("fusível" -> "fusíveis", "coxim" -> "coxins", "botão" -> "botões")
        const pl = !a.carro && a.w.length >= 4 && !/\d/.test(a.w) ? plural(a.w) : '';
        const q: Query = pl && !pl.startsWith(a.w) ? { combineWith: 'OR', queries: [a.w, { combineWith: 'OR', queries: [pl], prefix: false, fuzzy: false }] } : a.w;
        u0.push({ q, chave: a.w, solta: true, carro: a.carro, pal: [a.w] });
      }
    }
    // (nas outras formas também vale o plural que não começa pela palavra: "coxim motor" acha o "Coxins motor")
    const comPlural = (w: string): Query => { const pl = w.length >= 4 && !/\d/.test(w) ? plural(w) : ''; return pl && !pl.startsWith(w) ? { combineWith: 'OR', queries: [w, pl] } : w; };
    const frase = (f: string[]): Query => (f.length === 1 ? comPlural(f[0]) : { combineWith: 'AND', queries: f.map(comPlural) });
    for (let i = 0; i < u0.length;) {
      if (u0[i].carro) { grupos.push(u0[i].q); i++; continue; }
      let n = Math.min(MAIOR_GATILHO, u0.length - i);
      for (; n >= 1; n--) {
        const jan = u0.slice(i, i + n);
        if (jan.every((u) => !u.carro) && MAPA_SINONIMOS.has(jan.map((u) => u.chave).join(' '))) break;
      }
      if (n >= 1) {
        const jan = u0.slice(i, i + n);
        const k = jan.map((u) => u.chave).join(' ');
        const alts = MAPA_SINONIMOS.get(k)!.filter((f) => f.join(' ') !== k);
        const orig: Query = n === 1 ? u0[i].q : { combineWith: 'AND', queries: jan.map((u) => u.q) };
        // as outras formas valem um pouco menos que a digitada (e a soma de 2 formas não passa a frente dela); com o
        // "fora" da tabela, a peça cujo nome ou tipo diz aquela palavra não entra pelo sinônimo ("frente": a grade do
        // alto-falante e a moldura do painel não)
        // (a pessoa que digitou a palavra do "fora" quer aquela peça: "frente painel" continua achando a moldura do painel)
        const fora = MAPA_FORA.get(k)?.filter((w) => !u0.some((u) => u.chave.length >= 3 && (u.chave.startsWith(w) || w.startsWith(u.chave))));
        const comFora = MAPA_FORA.has(k);
        const outras: Query = { combineWith: 'OR', queries: alts.map(frase), boostTerm: () => PESO_SINONIMO, ...(comFora ? { fields: ['n'] } : {}) };
        const semFora: Query = fora?.length
          ? { combineWith: 'AND_NOT', queries: [outras, { combineWith: 'OR', queries: fora.map((w) => w.replace(/-/g, '')), fields: ['n', 's'], prefix: true, fuzzy: false }] }
          : outras;
        grupos.push(alts.length ? { combineWith: 'OR', queries: [orig, semFora] } : orig);
        formas.set(u0[i].chave, [...new Set(alts.map((f) => f[0]))]);
        uns.push({ chave: k, formas: [jan.flatMap((u) => u.pal), ...alts], fora: (fora ?? []).map(cp) });
        i += n;
        continue;
      }
      // plural ("faróis", "lanternas", "retrovisores"): a forma no singular também, só a palavra inteira (sem começo de
      // palavra nem erro de digitação: "mais" nunca vira "mal...")
      const u = u0[i];
      const sing = u.solta ? singulares(u.chave) : [];
      if (sing.length) {
        grupos.push({ combineWith: 'OR', queries: [u.q, { combineWith: 'OR', queries: sing, prefix: false, fuzzy: false }] });
        formas.set(u.chave, sing);
      } else grupos.push(u.q);
      uns.push({ chave: u.chave, formas: [u.pal], fora: [] });
      i++;
    }
    return { grupos, ultima, formas, uns, exatos, n: u0.length };
  }

  /** Algum código gravado do estoque é este ou começa por ele (a busca ao vivo digita o código aos poucos)? */
  private temCodigo(cod: string): boolean {
    this._codigos ??= this.itens.flatMap(codigosDa);
    return this._codigos.some((c) => c.startsWith(cod));
  }

  /** O texto, o ano, o lado e a posição da busca. Código gravado com espaço, traço ou ponto que existe no estoque vira a
   *  forma junta ("8200 328 856" -> "8200328856") ANTES de tudo: nenhum pedaço dele vira ano nem palavra solta. */
  private separar(bruto: string): Separado {
    const q = limpar(bruto);
    const cod = codigoJunto(q);
    if (cod && this.temCodigo(cod)) return { texto: cod, textoCom: cod, palavrasLP: [] };
    const { texto: semAno, ano } = separarAno(q);
    const lp = separarLadoPos(semAno);
    return { texto: lp.texto, ano, lado: lp.lado, pos: lp.pos, textoCom: semAno, palavrasLP: lp.palavras };
  }

  /** A busca sem o ano (as contagens dos anos), com o lado e a posição como estavam. */
  private semAnoQ(bruto: string): string {
    const q = limpar(bruto);
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
      const n = palavraLP(normal(w).replace(/[^a-z0-9]/g, ''));
      return (lado && (!!LADO_Q[n] || n === 'lado')) || (pos && !!POS_Q[n]);
    };
    return q.trim().split(/\s+/).filter((w) => w && !tirar(w)).join(' ');
  }

  /** A busca sem as palavras que são carro ou marca, do jeito que a busca as entendeu ("vw gol lanterna" -> "lanterna";
   *  "lanterna new fiesta" -> "lanterna"): o pedido do pátio diz "Procuro lanterna para Volkswagen Gol". */
  semCarroQ(q: string): string {
    const brutas = limpar(q).split(/\s+/).filter(Boolean);
    const { usado } = this.entender(brutas.join(' '));
    let i = 0;
    return brutas.filter((w) => { const n = palavras(w).length; const carro = n > 0 && usado.slice(i, i + n).every(Boolean); i += n; return !carro; }).join(' ');
  }

  /** Erro de digitação: troca a palavra que o estoque não conhece (nem como começo de palavra) pela palavra do estoque
   *  ou do jeito de falar a 1 letra dela, ou com o mesmo som ("retrovizor", "alternadro", "sinalera", "fexadura",
   *  "amortesedor"). Só palavra de 5+ letras, sem número. '' quando não há o que trocar. */
  private corrigir(texto: string, ent: Entendido): string {
    const ws = palavras(texto);
    let mudou = false;
    const out = ws.map((w, i) => {
      if (ent.usado[i] || w.length < 5 || /\d/.test(w) || VAZIAS.has(w) || this._nome.has(w) || GATILHOS.has(w)) return w;
      if (this.ms.search(w, { prefix: true, fuzzy: false, tokenize: (s) => [s] }).length) return w;
      const sw = som(w);
      const perto = (t: string) => t.length >= 4 && Math.abs(t.length - w.length) <= 2 && (som(t) === sw || umaEdicao(t, w) || (w.length >= 6 && umaEdicao(som(t), sw)));
      // o gatilho do jeito de falar primeiro ("sinalera" = sinaleira); depois a palavra de nome com mais peças
      let melhor = [...GATILHOS].find(perto) ?? '';
      if (!melhor) {
        let n = 0;
        for (const [t, ks] of this._nome) if (ks.length > n && perto(t)) { melhor = t; n = ks.length; }
      }
      if (!melhor) return w;
      mudou = true;
      return melhor;
    });
    return mudou ? out.join(' ') : '';
  }

  /** Para as unidades da busca: a peça É o que foi digitado (a 1ª palavra do nome é a de alguma unidade, com o resto da
   *  forma no nome: "Lanterna…", "Motor vidro", "Módulo ABS"), o nome TEM todas as unidades ("Suporte alternador" tem
   *  "alternador"; não é o alternador), e quantas unidades o nome tem. A última palavra digitada pode estar pela metade
   *  ("retrov"): vale o começo quando nenhuma palavra do estoque é ela inteira. */
  private casador(U: Unidade[], ultima: string) {
    const nt = this._nt!;
    const conj = new Map<string, Set<string>>();
    const de = (w: string) => {
      let s = conj.get(w);
      if (!s) { const c = this.casam(w); s = new Set(c.ig.length || w !== ultima ? c.ig : c.pre); conj.set(w, s); }
      return s;
    };
    const temW = (k: number, w: string) => { const s = de(w); for (const t of nt[k]) if (s.has(t)) return true; return false; };
    // o "fora" tira a peça do caminho do sinônimo (formas 1 em diante): a palavra no nome ou no tipo
    // (nas palavras soltas: o "falante" de "Grade alto-falante", o "tras" de "traseira")
    const soltas = new Map<number, string[]>();
    const foraOk = (k: number, u: Unidade) => {
      if (!u.fora.length) return true;
      let ws = soltas.get(k);
      if (!ws) { ws = palavras(`${this.itens[k].n} ${this.itens[k].s}`); soltas.set(k, ws); }
      return !ws.some((t) => u.fora.some((x) => t.startsWith(x)));
    };
    const vale = (k: number, u: Unidade, i: number) => i === 0 || foraOk(k, u);
    const unNoNome = (k: number, u: Unidade) => u.formas.some((f, i) => vale(k, u, i) && f.every((w) => temW(k, w)));
    const unNaCabeca = (k: number, u: Unidade) => {
      const h = nt[k][0];
      return h !== undefined && u.formas.some((f, i) => f.length > 0 && vale(k, u, i) && de(f[0]).has(h) && f.slice(1).every((w) => temW(k, w)));
    };
    const memoCab = new Map<Unidade, number[]>();
    /** Como o nome começa pela unidade: 0 = pelas palavras digitadas, na ordem ("Coxim motor…" para "coxim motor"); 1 = por
     *  outra forma do jeito de falar, na ordem ("Calço coxim motor", "Tampa traseira" para "tampa do porta-malas"); 2 e 3 =
     *  a 1ª palavra é a da unidade e o resto está espalhado ("Tampa caixa bordo porta-malas"). */
    const comeco = (k: number, u: Unidade) => {
      const ws = nt[k];
      const seguida = u.formas.some((f, i) => vale(k, u, i) && f.every((w, j) => ws[j] !== undefined && de(w).has(ws[j])));
      const digitada = u.formas[0].length > 0 && de(u.formas[0][0]).has(ws[0]);
      return (seguida ? 0 : 2) + (digitada ? 0 : 1);
    };
    return {
      comeco,
      todas: (k: number) => U.every((u) => unNoNome(k, u)),
      quantas: (k: number) => U.reduce((s, u) => s + (unNoNome(k, u) ? 1 : 0), 0),
      unNoNome, unNaCabeca,
      /** as peças do estoque que SÃO a unidade (a 1ª palavra do nome é a 1ª da forma, com o resto da forma no nome) */
      cabecas: (u: Unidade) => {
        let ks = memoCab.get(u);
        if (!ks) {
          const v = new Set<number>();
          for (const f of u.formas) if (f.length) for (const t of de(f[0])) for (const k of this._cab.get(t) ?? []) if (!v.has(k) && unNaCabeca(k, u)) v.add(k);
          ks = [...v]; memoCab.set(u, ks);
        }
        return ks;
      },
      /** as peças com alguma palavra da unidade no nome (o), no tipo "s" (s) ou no bloco "c" (c) */
      cita: (u: Unidade, onde: 'o' | 's' | 'c') => {
        const m = onde === 'o' ? this._nome : onde === 's' ? this._sis : this._bloco;
        const ks: number[] = [];
        u.formas.forEach((f, i) => { if (f.length === 1 || (f.length > 0 && onde === 'o')) for (const t of de(f[0])) for (const k of m.get(t) ?? []) if (vale(k, u, i)) ks.push(k); });
        return ks;
      },
    };
  }

  /** Peças da busca de texto, na ordem de relevância. com = o texto com as palavras de lado e posição que viraram filtro
   *  ("amortecedor traseiro"): a peça cujo nome começa pelo que foi digitado, na ordem, sobe ("Amortecedor traseiro"
   *  antes de "Amortecedor tampa traseira"; "Tampa traseira" antes de "Tampa caixa … porta-malas"). */
  private porTexto(texto: string, com = ''): PorTexto {
    const chave = normal(texto).replace(/\s+/g, ' ').trim();
    const chaveCache = com ? `${chave}|${normal(com).replace(/\s+/g, ' ').trim()}` : chave;
    let m = this._textos.get(chaveCache);
    if (m) return m;
    m = this.calcular(chave, com);
    this._textos.set(chaveCache, m);
    if (this._textos.size > 24) this._textos.delete(this._textos.keys().next().value!);
    return m;
  }

  /** A regra da busca de texto (o resultado é guardado por porTexto):
   *   1. todas as palavras (o MiniSearch, como sempre); sem nada, o erro de digitação corrigido; sem nada, com aproximação;
   *   2. das peças achadas, primeiro as que SÃO o que foi digitado (exatas: o nome começa pela palavra, "Farol direito");
   *      depois as que só citam ("Suporte farol", "Interruptor farol") e as que citam só no anúncio. Nada some;
   *   3. o estoque tem a peça (nome começando pela palavra) mas não para o carro digitado, ou não com as outras palavras
   *      ("alternador gol" com só o "Suporte alternador" do Gol; "caixa de direção" com só o "Motor caixa direção"):
   *      é PARECIDA, com aviso; as do carro primeiro e depois a peça dos outros carros;
   *   4. nenhuma peça com todas as palavras ("forro de teto", "chave reserva xc60", "lanterna led gol"): as parecidas do
   *      TIPO (a 1ª unidade que é nome de peça no estoque), o carro digitado primeiro, com aviso. Nunca outro tipo. */
  private calcular(chave: string, com: string): PorTexto {
    // número do anúncio ("MLB4779038537"): a peça
    if (/^mlb\d{6,}$/.test(chave)) {
      const it = this.itens.find((x) => x.id.toLowerCase() === chave);
      if (it) return { base: [it], aproximado: false, carros: [], exatas: null, citam: false, temTipo: false };
    }
    let ent = this.entender(chave);
    let av = this.arvore(chave, ent);
    const ms = this.ms;
    const comErro = (t: string) => (t.length >= 5 && !/\d/.test(t) ? 0.2 : false);
    const tokenize = (s: string) => [s];
    // a última palavra pode estar pela metade (busca ao vivo): vale o começo dela a partir de 2 letras ("modulo ab" a
    // caminho de "abs"). Quando as 2 letras já são uma palavra de nome do estoque ("ré", "ar"), vale a palavra inteira, e o
    // começo só se ela não achar nada ("sensor de ré" não é "sensor … Renault"). Carro e marca: só a palavra inteira
    // ("gol" não é "Golf")
    const buscar = (a: Arvore, como: 'AND' | 'OR', erro: boolean, curta: boolean) => ms.search(
      { combineWith: como, queries: a.grupos },
      { prefix: (t: string) => !a.exatos.has(t) && (t.length >= 3 || (t === a.ultima && t.length >= 2 && (curta || a.n === 1 || !this._nome.has(t)))), fuzzy: erro ? comErro : false, tokenize, combineWith: 'AND' },
    );
    let r: SearchResult[] = av.grupos.length ? buscar(av, 'AND', false, false) : [];
    if (!r.length && av.grupos.length && av.ultima.length === 2 && av.n > 1) r = buscar(av, 'AND', false, true);
    if (!r.length && av.grupos.length) {
      const certo = this.corrigir(chave, ent);
      if (certo) {
        const e2 = this.entender(certo), a2 = this.arvore(certo, e2);
        const r2 = buscar(a2, 'AND', false, true);
        if (r2.length) { r = r2; ent = e2; av = a2; }
      }
    }
    if (!r.length && av.grupos.length) r = buscar(av, 'AND', true, true);

    const U = av.uns;
    const { formas, ultima } = av;
    const doDig = (it: Item) => ent.carros.some((c) => doCarro(it, c));
    // (apelido de carro unido digitado, "modulo c180": as que dizem C180 antes das outras do Classe C)
    const doApelido = (it: Item) => !ent.apelidos.length || ent.apelidos.some((c) => doCarro(it, c));
    const grupoCarro = (it: Item) => (ent.carros.length && doDig(it) ? (doApelido(it) ? 0 : 1) : ent.marcas.includes(it.b) ? 2 : 3);
    const temCarro = ent.carros.length > 0 || ent.marcas.length > 0;
    // o nome da peça começa pela palavra buscada (ou uma forma dela: "sinaleira" -> "Lanterna"): sobe
    // ("farol" -> "Farol esquerdo" antes de "Interruptor farol")
    const principais = ent.resto.filter((w) => w.length >= 3 || w === ultima).flatMap((w) => [w, ...(formas.get(w) ?? [])]);
    const principaisC = principais.map(cp);
    // só conta quando a busca tem sinônimo ou plural (sem eles, a ordem fica a de antes)
    const digitadas = formas.size ? ent.resto.filter((w) => w.length >= 3 && !/\d/.test(w)) : [];
    // o que foi digitado, na ordem, com o lado e a posição ("tampa traseira", "amortecedor traseiro")
    const usadoCom = com ? this.entender(com).usado : [];
    const seq = com ? palavras(com).filter((w, i) => !VAZIAS.has(w) && w !== 'lado' && !usadoCom[i]).map(palavraLP) : [];
    const nota = new Map<number, number>();
    const pontuar = (x: SearchResult) => {
      const it = this.itens[x.id as number];
      const nome = this._nn[it.k];
      // sem hífen nem espaço: "parachoque e-pace" acha o "Para-choque dianteiro" como começo do nome
      const nomeC = cp(nome);
      const comeca = principaisC.some((w) => nomeC.startsWith(w));
      const nt = this._nt![it.k];
      const naOrdem = seq.length > 1 && seq.every((w, i) => nt[i] !== undefined && mesmaPalavra(nt[i], w));
      // o nome diz o que foi digitado, do jeito que foi digitado (não só um sinônimo): sobe um pouco
      let exato = false;
      if (digitadas.length > 0) { const ws = nome.split(/[^a-z0-9]+/); exato = digitadas.every((d) => ws.some((w) => w.startsWith(d))); }
      // "completo" é a peça inteira ("Para-choque dianteiro completo" antes do "Para-choque traseiro" para o para-choque)
      const inteiro = comeca && /\bcomplet[oa]\b/.test(nome) ? 1.25 : 1;
      nota.set(it.k, x.score * (comeca ? 1.6 : 1) * (naOrdem ? 2 : 1) * (exato ? 1.5 : 1) * inteiro);
    };
    for (const x of r) pontuar(x);
    const pelaNota = (a: Item, b: Item) => nota.get(b.k)! - nota.get(a.k)!;
    let base: Item[];
    let aproximado = false;
    let exatas: Set<number> | null = null;
    let citam = false;

    if (r.length && !U.length) {
      // só carro, marca ou nada que seja peça: a ordem do texto, o carro digitado primeiro
      base = r.map((x) => this.itens[x.id as number]).sort((a, b) => grupoCarro(a) - grupoCarro(b) || pelaNota(a, b));
    } else if (r.length) {
      const c = this.casador(U, ultima);
      const ks = r.map((x) => x.id as number);
      const todas = new Map(ks.map((k) => [k, c.todas(k)]));
      // o TIPO: a 1ª unidade digitada que é nome de peça — o estoque tem peça que começa por ela com as outras palavras no
      // nome ("fechadura tampa": a "Fechadura tampa traseira"), ou alguma das achadas começa por ela ("lanterna led")
      const instancias = (u: Unidade) => c.cabecas(u).filter((k) => c.todas(k));
      const tipo = U.find((u) => instancias(u).length > 0 || ks.some((k) => c.unNaCabeca(k, u)));
      // 0 = é a peça e o nome tem tudo; 1 = é a peça (o resto está no anúncio); 2 = o nome cita tudo; 3 = só o anúncio cita
      const nivel = new Map(ks.map((k) => [k, tipo && c.unNaCabeca(k, tipo) ? (todas.get(k) ? 0 : 1) : todas.get(k) ? 2 : 3]));
      const nExatas = ks.filter((k) => nivel.get(k)! <= 1).length;
      // o estoque tem peça com esse nome (em qualquer carro)? Sem nenhuma, a palavra é o lugar ou o assunto ("teto",
      // "porta-malas", "ar condicionado"): as peças que citam são o resultado, e a tela diz "com … no nome"
      const tipoExiste = () => U.some((u) => c.cabecas(u).length > 0);
      // busca de SISTEMA: a palavra digitada é, letra por letra, o nome de um bloco do estoque ("freios", "suspensão")
      // e de nenhuma peça ("painel" e "motor" são blocos, mas também são peças: sem a peça para o carro, é parecida)
      const sistema = !nExatas && U.length === 1 && U[0].formas[0].length === 1 && this._bloco.has(U[0].formas[0][0]) && !this._cab.has(U[0].formas[0][0]);
      if (nExatas) exatas = new Set(ks.filter((k) => nivel.get(k)! <= 1));
      else if (!sistema && tipoExiste()) aproximado = true;
      else citam = sistema || ks.some((k) => nivel.get(k) === 2);
      base = ks.map((k) => this.itens[k]);
      if (aproximado) {
        // o carro digitado primeiro (o que ele tem de parecido); depois a peça dos outros carros
        const ord = new Map(base.map((it) => [it.k, grupoCarro(it) * 10 + nivel.get(it.k)!]));
        base.sort((a, b) => ord.get(a.k)! - ord.get(b.k)! || pelaNota(a, b));
        if (temCarro && tipo) {
          const ja = new Set(ks);
          const outras = instancias(tipo).filter((k) => !ja.has(k)).map((k) => this.itens[k]);
          outras.sort((a, b) => this._nt![a.k].length - this._nt![b.k].length || a.k - b.k);
          base = [...base, ...outras];
        }
      } else {
        // entre as que são a peça: a que começa pelo que foi digitado antes da que começa por outra forma de dizer
        const ord = new Map(base.map((it) => [it.k, nivel.get(it.k)! * 100 + grupoCarro(it) * 10 + (tipo && nivel.get(it.k)! <= 1 ? c.comeco(it.k, tipo) : 0)]));
        base.sort((a, b) => ord.get(a.k)! - ord.get(b.k)! || pelaNota(a, b));
        // busca de SISTEMA ("suspensão xc60"): a palavra é o nome de um bloco do estoque e de nenhuma peça; o bloco
        // inteiro entra depois das peças que citam a palavra (do carro digitado, quando há)
        if (!nExatas && U.length === 1) {
          const ja = new Set(ks);
          const doBloco = [...new Set(c.cita(U[0], 'c'))].filter((k) => !ja.has(k)).map((k) => this.itens[k])
            .filter((it) => (!ent.carros.length || doDig(it)) && (!ent.marcas.length || ent.carros.length > 0 || ent.marcas.includes(it.b)));
          if (doBloco.length) { base = [...base, ...doBloco]; citam = true; }
        }
      }
    } else {
      const c = U.length ? this.casador(U, ultima) : null;
      // busca de SISTEMA sem nenhuma peça com a palavra para o carro ("suspensão gol"): o bloco do carro
      const doBloco = c && U.length === 1 && !c.cabecas(U[0]).length
        ? [...new Set(c.cita(U[0], 'c'))].map((k) => this.itens[k]).filter((it) => (!ent.carros.length || doDig(it)) && (!ent.marcas.length || ent.carros.length > 0 || ent.marcas.includes(it.b)))
        : [];
      // nada com todas as palavras: as PARECIDAS
      const ror = !doBloco.length && av.grupos.length ? buscar(av, 'OR', true, true) : [];
      // o tipo: a 1ª unidade que é nome de peça no estoque; senão a 1ª que algum nome cita
      const tipo = c && !doBloco.length ? (U.find((u) => c.cabecas(u).length > 0) ?? U.find((u) => c.cita(u, 'o').some((k) => c.unNoNome(k, u)))) : undefined;
      let fam: number[] = [];
      if (c && tipo) {
        // o estoque conhece a peça inteira (todas as palavras no nome), só não para este carro ou com o resto do texto?
        const inteiras = U.length > 1 ? [...new Set(c.cita(U[0], 'o'))].filter((k) => c.todas(k)) : [];
        const instancias = inteiras.filter((k) => c.unNaCabeca(k, tipo));
        if (inteiras.length && !instancias.length) {
          // ...mas nenhuma É a peça ("caixa de direção": só "Motor caixa direção"): as parecidas são as que citam tudo
          fam = inteiras;
        } else if (instancias.length) {
          // ...e é uma peça ("comando do ar condicionado" para um carro sem ele; "retrovisor elétrico" para um carro só
          // com o interno): as do mesmo tipo de peça ("s") e as que começam pela palavra no mesmo bloco ("c": o
          // "Retrovisor interno" é parecido; a "Caixa fusível" não é parecida com a "Caixa filtro ar")
          const tipos = new Set(instancias.map((k) => this.itens[k].s));
          const blocos = new Set(instancias.map((k) => this.itens[k].c));
          fam = [...new Set([...inteiras, ...[...tipos].flatMap((t) => this._porS.get(t) ?? []), ...c.cabecas(tipo).filter((k) => blocos.has(this.itens[k].c))])];
        } else {
          // ...não: a família do tipo (o nome começa pela palavra, cita a palavra, ou o tipo "s" tem a palavra)
          // e, do carro digitado, as do bloco "c" que tem a palavra ("farol compass": as luzes do Compass primeiro)
          const doCarroNoBloco = ent.carros.length ? c.cita(tipo, 'c').filter((k) => doDig(this.itens[k])) : [];
          fam = [...new Set([...c.cabecas(tipo), ...c.cita(tipo, 'o').filter((k) => c.unNoNome(k, tipo)), ...c.cita(tipo, 's'), ...doCarroNoBloco])];
        }
      }
      if (doBloco.length) {
        base = doBloco;
        citam = true;
      } else if (fam.length && c && tipo) {
        const ponto = new Map(ror.map((x) => [x.id as number, x.score]));
        const cab = new Set(c.cabecas(tipo));
        const chaveDe = new Map(fam.map((k) => [k, [grupoCarro(this.itens[k]), -c.quantas(k), cab.has(k) ? 0 : 1, -(ponto.get(k) ?? 0)]]));
        const cmp = (a: number, b: number) => { const x = chaveDe.get(a)!, y = chaveDe.get(b)!; for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i]; return a - b; };
        base = fam.sort(cmp).slice(0, 300).map((k) => this.itens[k]);
        aproximado = true;
      } else {
        // sem tipo que o estoque conheça: as peças com alguma das palavras, como antes
        r = ror.slice(0, 300);
        aproximado = r.length > 0;
        for (const x of r) pontuar(x);
        base = r.map((x) => this.itens[x.id as number]).sort(pelaNota);
        // o NOME da peça é o que diz o que a pessoa procura: as categorias das peças com a palavra no nome passam na frente
        const cats = new Map<string, number>();
        const nomeTem = new Set<number>();
        for (const x of r) if (Object.values(x.match).some((f) => f.includes('n'))) {
          nomeTem.add(x.id as number);
          const cat = this.itens[x.id as number].c;
          if (cat) cats.set(cat, (cats.get(cat) ?? 0) + 1);
        }
        const max = Math.max(0, ...cats.values());
        const fortes = new Set([...cats].filter(([, n]) => n >= max * 0.3).map(([cat]) => cat));
        const daPalavra = (it: Item) => nomeTem.has(it.k) || fortes.has(it.c);
        const frente = (xs: Item[]) => [...xs.filter(daPalavra), ...xs.filter((x) => !daPalavra(x))];
        if (temCarro) base = [...frente(base.filter((it) => grupoCarro(it) === 0)), ...frente(base.filter((it) => grupoCarro(it) === 1)), ...frente(base.filter((it) => grupoCarro(it) === 2)), ...base.filter((it) => grupoCarro(it) === 3)];
        else base = frente(base);
      }
    }
    // código gravado buscado ("8200328856"): a peça com esse código abre a lista, antes das que só o citam
    let codigo: string | undefined;
    if (!aproximado && /^[a-z0-9]{6,20}$/.test(chave) && digitos(chave) >= 5) {
      const tem = (it: Item) => codigosDa(it).includes(chave);
      const comCodigo = base.filter(tem);
      if (comCodigo.length) { base = [...comCodigo, ...base.filter((it) => !tem(it))]; codigo = chave; }
    }
    return { base, aproximado, carros: ent.carros, codigo, exatas, citam, temTipo: U.length > 0 };
  }

  /** Todas as peças, das que chegaram agora para as mais antigas (os ids do ML crescem). */
  private porNovos(): Item[] {
    return (this._novos ??= [...this.itens].sort((a, b) => b.id.length - a.id.length || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0)));
  }

  /** A lista para os filtros, sem mexer no estado público (aproximado, carrosDaBusca).
   *  Lado e posição digitados ("retrovisor direito xc60") filtram como as fichas. Se o estoque tem a peça digitada mas
   *  não desse lado (ou nessa posição), a lista sai VAZIA e faltou diz o que faltou, com as do outro lado à parte (a dica
   *  "tem a esquerda"): nunca troca de lado em silêncio. A posição que o estoque não registra para a peça ("grade
   *  dianteira": nenhuma grade diz a posição) não filtra; o lado é estrito. */
  private filtrar(f: Filtros, como: ComoFiltrar = {}): Filtrado {
    const sep = this.separar((f.q || '').trim());
    const o = f.ordem || 'rel';
    const ano = f.ano || sep.ano;
    const faixa = FAIXAS.find((x) => x[0] === f.preco);
    const tem = sep.palavrasLP.length > 0;
    // apelido de carro unido no filtro (endereço antigo com modelo=New Fiesta): vale o carro principal (Fiesta)
    let modelo = f.modelo;
    if (modelo && f.marca && this.apelidos.has(`${f.marca}|${modelo}`)) { this.montarNomes(); modelo = this._principal.get(`${f.marca}|${modelo}`) ?? modelo; }
    const rodar = (derivado: boolean): Filtrado => {
      const texto = derivado ? sep.texto : sep.textoCom;
      let r: PorTexto;
      if (texto) r = this.porTexto(texto, derivado ? sep.textoCom : '');
      // sem texto, "relevantes" e "chegaram agora" são a mesma ordem: a lista já vem ordenada
      else r = { base: o === 'rel' || o === 'novos' ? this.porNovos() : this.itens, aproximado: false, carros: [], exatas: null, citam: false, temTipo: false };
      let ladoQ = derivado && !f.lado ? sep.lado : undefined;
      let posQ = derivado && !f.pos ? sep.pos : undefined;
      const zonaF = zonaDaChave(f.zona);
      const passa = (it: Item, lado?: Lado, pos?: Posicao) =>
        (!f.marca || it.b === f.marca) &&
        (!modelo || serveNoModelo(it, modelo)) &&
        (!ano || dentro(ano, modelo ? anosNoModelo(it, modelo) : it.y)) &&
        (!f.tipo || it.c === f.tipo) &&
        (!f.sub || it.s === f.sub) &&
        (!faixa || (it.p >= faixa[2] && it.p < faixa[3])) &&
        (!f.frete || it.f) &&
        (!lado || it.l === lado) &&
        (!pos || it.pos === pos || it.pos === 'A') &&
        (!zonaF || pecaNaZona(zonaF, it));
      const outroLado = (l: Lado): Lado => (l === 'E' ? 'D' : 'E');
      const outraPos = (p: Posicao): Posicao => (p === 'D' ? 'T' : 'D');
      // o núcleo: as peças que SÃO o que foi digitado (ou a lista toda, sem elas), antes do lado e da posição digitados
      let nucleo: Item[] = [];
      if (ladoQ || posQ) {
        nucleo = r.base.filter((it) => (!r.exatas || r.exatas.has(it.k)) && passa(it, f.lado, f.pos));
        // o estoque não registra a posição da peça ("grade dianteira": nenhuma grade diz): não filtra
        if (posQ && nucleo.length && !nucleo.some((it) => it.pos === 'D' || it.pos === 'T' || it.pos === 'A')) posQ = undefined;
        // (o lado é estrito: peça que não diz o lado no nome não entra como "a direita"; a tela diz o que faltou)
      }
      const lado = como.semLado ? undefined : f.lado ?? ladoQ;
      const pos = como.semPos ? undefined : f.pos ?? posQ;
      let itens = r.base.filter((it) => passa(it, lado, pos));
      let faltou: Filtrado['faltou'];
      let outros: Item[] = [];
      if ((ladoQ || posQ) && !como.semLado && !como.semPos && (r.exatas ? nucleo.length > 0 && !itens.some((it) => r.exatas!.has(it.k)) : !itens.length)) {
        // as do outro lado na MESMA posição ("lanterna traseira direita": a traseira esquerda); sem lado digitado, a outra posição
        if (ladoQ) outros = nucleo.filter((it) => it.l === outroLado(ladoQ!) && (!pos || it.pos === pos || it.pos === 'A'));
        if (!outros.length && posQ && !ladoQ) outros = nucleo.filter((it) => (!lado || it.l === lado) && it.pos === outraPos(posQ!));
        const nomes = (outros.length ? outros : nucleo).map((it) => normal(it.n)).join(' ');
        const fem = /\b(esquerda|direita|dianteira|traseira)s?\b/.test(nomes) ? true : /\b(esquerdo|direito|dianteiro|traseiro)s?\b/.test(nomes) ? false : undefined;
        faltou = { lado: ladoQ, pos: posQ, fem };
        outros = outros.slice(0, 6);
        itens = [];
      }
      // o carro digitado sem nenhuma peça na lista (ex.: a maçaneta do Gol só existe do lado direito): é parecida, com aviso
      const aprox = r.aproximado || (r.carros.length > 0 && itens.length > 0 && !itens.some((it) => r.carros.some((c) => doCarro(it, c))));
      return { itens, aproximado: aprox, carros: r.carros, comTexto: !!texto, codigo: r.codigo ?? '', derivado, ladoQ, posQ, faltou, outros, exatas: r.exatas, citam: r.citam, temTipo: r.temTipo };
    };
    if (!tem || como.derivado === false) return rodar(false);
    return rodar(true);
  }

  /** A lista na ordem pedida e quantas peças do começo SÃO o que foi digitado (nExatas). O carro salvo ("Meu carro")
   *  sobe dentro de cada parte da lista, sem esconder as outras; o carro digitado ou do filtro manda mais que o salvo. */
  private listar(f: Filtros, meu?: CarroSalvo | null): Filtrado & { nExatas: number } {
    const r = this.filtrar(f);
    let out = r.itens;
    const o = f.ordem || 'rel';
    if (o === 'asc') out.sort((a, b) => a.p - b.p);
    else if (o === 'desc') out.sort((a, b) => b.p - a.p);
    else if (o === 'novos' && r.comTexto) out.sort((a, b) => b.id.length - a.id.length || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
    let nExatas = r.aproximado || r.citam ? 0 : out.length;
    if (o === 'rel' && r.exatas && !r.aproximado) {
      let n = 0;
      while (n < out.length && r.exatas.has(out[n].k)) n++;
      if (n) nExatas = n;
    }
    if (o === 'rel' && meu && r.comTexto && !r.carros.length && !f.marca && !f.modelo && out.length > 1) {
      const peso = (it: Item) => {
        if (it.b !== meu.b || !serveNoModelo(it, meu.m)) return 0;
        const y = anosNoModelo(it, meu.m);
        return !meu.y || !y || dentro(meu.y, y) ? 2 : 1;
      };
      const sobe = (xs: Item[]) => { const p = xs.map(peso); return p.some(Boolean) ? [2, 1, 0].flatMap((n) => xs.filter((_, i) => p[i] === n)) : xs; };
      const corte = nExatas < out.length ? nExatas : 0;
      out = [...sobe(out.slice(0, corte)), ...sobe(out.slice(corte))];
    }
    return { ...r, itens: out, nExatas };
  }

  /** meu = o carro salvo no "Meu carro" (as peças dele sobem; nada some). */
  procurar(f: Filtros, meu?: CarroSalvo | null): Item[] {
    const r = this.listar(f, meu);
    const out = r.itens;
    const o = f.ordem || 'rel';
    this.aproximado = r.aproximado;
    this.carrosDaBusca = r.carros;
    this.ladoDaBusca = r.ladoQ;
    this.posDaBusca = r.posQ;
    this.faltou = r.faltou ?? null;
    this.outrosLados = r.outros;
    this.nExatas = r.nExatas;
    this.citam = r.citam && !r.aproximado;
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
   *  diz os anos) e É o que foi digitado (as exatas da busca: o nome começa pela palavra, "Retrovisor…"; quando o
   *  estoque não tem peça com esse nome, "freio de mão", vale a que cita). Código gravado achado bate; busca só de
   *  carro, marca ou sistema ("xc60", "suspensão") também. Sem carro-alvo, vale qualquer peça da lista. */
  bate(lista: Item[], q: string, alvo?: { b: string; m: string; y?: number | null } | null): boolean {
    if (!lista.length) return false;
    const { texto } = this.separar((q || '').trim());
    if (!texto) return true;
    const r = this.porTexto(texto);
    if (r.codigo) return lista.some((it) => codigosDa(it).includes(r.codigo!));
    if (!r.temTipo || this.entender(texto).familia) return true;
    // só parecidas: a peça digitada não está na lista
    if (r.aproximado) return false;
    return lista.some((it) => {
      if (r.exatas && !r.exatas.has(it.k)) return false;
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
   *  digitados valem igual), com atalhos de carro, marca ou sistema no topo. meu = o carro salvo (sobe). */
  sugestoes(q: string, n = 6, meu?: CarroSalvo | null): Sugestoes {
    const vazio: Sugestoes = { itens: [], total: 0, aproximado: false, atalhos: [], carros: [], nExatas: 0, citam: false, faltou: null };
    if (q.trim().length < 2) return vazio;
    const { texto, ano } = this.separar(q.trim());
    const r = this.listar({ q: q.trim() }, meu);
    return { itens: r.itens.slice(0, n), total: r.itens.length, aproximado: r.aproximado, atalhos: this.atalhos(texto, ano), carros: r.carros, nExatas: r.nExatas, citam: r.citam && !r.aproximado, faltou: r.faltou ?? null };
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
      if (x) out.push({ tipo: 'sistema', rot: fm, sub: `Categoria · ${pecas(x)}`, n: x, href: `/catalogo.html?${new URLSearchParams({ tipo: fm })}` });
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
