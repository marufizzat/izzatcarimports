// Peça vendida (cliente oculto, atrito 3): o site só tem as peças ATIVAS, então o link de uma peça que vendeu (no
// Google, no WhatsApp, no Instagram) cai na 404. A 404 lê o nome, o carro e os anos do PRÓPRIO endereço e mostra
// "Essa peça já foi vendida" com as parecidas.
// O slug é o título do anúncio do ML sem acento (slugify de gerar_paginas_individuais.py, cortado em 80 letras):
// "airbag-motorista-mercedes-benz-c320-01-07-2034601898". Marcas, modelos e a grafia das palavras do nome vêm do
// estoque, no build (montarDicionario), e vão dentro da 404. Sem node:fs: roda no build e no navegador.
// A busca das parecidas usa as MESMAS regras do catálogo (lib/busca.ts: procurar), para "Ver parecidas" nunca cair
// numa lista vazia.
import { norm, anosNoModelo } from './meuCarro';
import { mensagem } from './whats';
import type { Busca, Filtros, Item } from './busca';

/** /peca/<slug>-MLB<n>.html. Só letras minúsculas, números e hífen (o slugify não gera outra coisa): qualquer outro
 *  texto colado no endereço fica na 404 comum (o site nunca mostra texto inventado por quem montou o link). */
export const RE_VENDIDA = /^\/peca\/([a-z0-9][a-z0-9-]{1,89})-(MLB\d{6,13})(?:\.html)?$/;

/** O que a 404 recebe do build. b = marcas ([nome, apelidos...]; as `nb` primeiras têm peça no site),
 *  m = modelos com peça ([índice da marca, nome, apelidos...]), w = a grafia das palavras do nome
 *  ("modulo": "módulo", "tbi": "TBI", "para choque": "para-choque"). */
export type Dicionario = { b: [string, ...string[]][]; nb: number; m: [number, string, ...string[]][]; w: Record<string, string> };

export type Vendida = {
  mlb: string;
  /** o nome da peça como o site escreve ("Motor vidro dianteiro esquerdo"); '' quando o carro não foi reconhecido */
  nome: string;
  /** marca e modelo como nos dados (o filtro do catálogo usa assim); null = não reconhecido ou sem peça no site */
  marca: string | null;
  modelo: string | null;
  /** o carro para mostrar: o modelo reconhecido ou, sem ele, a palavra do título ("Mercedes-Benz C320") */
  carro: string;
  anos: [number, number] | null;
};

// ---------------------------------------------------------------- build: o dicionário

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Sigla (ABS, TBI, BSI): fica como está. */
const sigla = (w: string) => w.length >= 2 && w === w.toUpperCase() && /[A-Z]/.test(w);

const APELIDOS: Record<string, string[]> = { Chevrolet: ['gm', 'chevy'], Volkswagen: ['vw'], 'Mercedes-Benz': ['mercedes', 'mb'] };
/** Marcas que podem aparecer no título de uma peça vendida mesmo sem peça no site agora (só para escrever o nome
 *  certo; o link do catálogo nunca leva marca sem peça). Sem "Mini", "RAM" e "Smart": viram palavra do nome. */
const MARCAS_FORA = ['Alfa Romeo', 'Audi', 'BMW', 'BYD', 'Chery', 'Chevrolet', 'Chrysler', 'Citroën', 'Dodge', 'Fiat', 'Ford',
  'Geely', 'Honda', 'Hyundai', 'Iveco', 'JAC', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Lifan', 'Mercedes-Benz',
  'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Renault', 'SsangYong', 'Subaru', 'Suzuki', 'Toyota', 'Troller', 'Volkswagen',
  'Volvo'];

type PecaDic = { b?: string | null; m?: string | null; ms?: string[] | null; n: string };

/** Monta o dicionário com o estoque (no build da 404). */
export function montarDicionario(pecas: PecaDic[]): Dicionario {
  const porMarca = new Map<string, Map<string, number>>();
  const formas = new Map<string, Map<string, number>>();
  const conta = (k: string, f: string) => {
    if (k === f) return;
    const m = formas.get(k) ?? new Map<string, number>();
    m.set(f, (m.get(f) ?? 0) + 1);
    formas.set(k, m);
  };
  for (const p of pecas) {
    if (p.b) {
      const mo = porMarca.get(p.b) ?? new Map<string, number>();
      for (const m of p.ms?.length ? p.ms : p.m ? [p.m] : []) mo.set(m, (mo.get(m) ?? 0) + 1);
      porMarca.set(p.b, mo);
    }
    // a grafia de cada palavra do nome limpo (o 1º vem com maiúscula: volta para minúscula, menos sigla)
    p.n.split(/\s+/).forEach((w, i) => {
      if (!w || !/^[\p{L}\d-]+$/u.test(w)) return;
      const f = i === 0 && !sigla(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w;
      const partes = ascii(f).split('-').filter(Boolean);
      if (!partes.length || partes.length > 3) return;
      conta(partes.join(' '), f);
      // "parabrisa" (o título escreve junto) também vira "para-brisa"
      if (partes.length > 1) conta(partes.join(''), f);
    });
  }
  const marcas = [...porMarca.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const b: Dicionario['b'] = marcas.map((n) => [n, ...(APELIDOS[n] ?? [])]);
  const nb = b.length;
  for (const n of MARCAS_FORA) if (!porMarca.has(n)) b.push([n, ...(APELIDOS[n] ?? [])]);
  const m: Dicionario['m'] = [];
  marcas.forEach((marca, i) => {
    for (const mo of [...porMarca.get(marca)!.keys()].sort()) {
      // BMW "Série 5" vem no título como "S5"
      const serie = /^Série (\d)$/.exec(mo);
      m.push(serie ? [i, mo, `s${serie[1]}`] : [i, mo]);
    }
  });
  const w: Record<string, string> = {};
  for (const [k, fs] of [...formas].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    const [f] = [...fs].sort((x, y) => y[1] - x[1])[0];
    w[k] = f;
  }
  return { b, nb, m, w };
}

// ---------------------------------------------------------------- navegador: ler o endereço

// abreviações do título do ML (as mesmas de preparar_dados.py: ABREV_ADJETIVO, ABREV_INVARIAVEL, ABREV_FIXA)
const ADJ: Record<string, string> = {
  tras: 'traseiro', trase: 'traseiro', traseir: 'traseiro', diant: 'dianteiro', dian: 'dianteiro', dianteir: 'dianteiro',
  diante: 'dianteiro', dt: 'dianteiro', esq: 'esquerdo', esque: 'esquerdo', esquer: 'esquerdo', esquerd: 'esquerdo',
  dir: 'direito', dire: 'direito', direit: 'direito', int: 'interno', ext: 'externo', eletr: 'elétrico', elet: 'elétrico',
  compl: 'completo', hidra: 'hidráulico',
};
const INVARIAVEL: Record<string, string> = { sup: 'superior', inf: 'inferior', lat: 'lateral' };
/** Palavra composta que o título escreve separada ou cortada (preparar_dados.py: COMPOSTOS e "ar cond"). */
const COMPOSTOS: Record<string, string> = {
  'semi eixo': 'semieixo', 'ar cond': 'ar condicionado', 'ar condicion': 'ar condicionado', 'ar condicionad': 'ar condicionado',
  arcondicionado: 'ar condicionado', 'guarda po': 'guarda-pó', 'pos catalisador': 'pós-catalisador', 'pre catalisador': 'pré-catalisador',
};
const FIXA: Record<string, string> = {
  acab: 'acabamento', retrov: 'retrovisor', susp: 'suspensão', aquec: 'aquecimento', desembac: 'desembaçador',
  comb: 'combustível', adm: 'admissão', passag: 'passageiro', ld: 'lado direito', le: 'lado esquerdo',
};
// o adjetivo concorda com a palavra mais perto antes dele (sem contar complemento: "Pinça freio diant esq")
const NAO_DECIDE = new Set(('seguranca freio mao ar agua oleo combustivel motor capo teto porta-malas porta-luvas para-brisa ' +
  'superior inferior lateral central frontal original manual digital auxiliar simples universal de do da dos das com sem e').split(' '));
const MASC_A = new Set(['sistema', 'para-brisa', 'clima', 'problema']);
const FEM = new Set(['chave', 'luz', 'grade', 'base', 'lente', 'ponte', 'haste', 'rede', 'fivela']);
const feminina = (w: string) => (/a$/.test(w) && !MASC_A.has(w)) || /(cao|sao|agem)$/.test(w) || FEM.has(w);
const flexionar = (lema: string, fem: boolean) => (fem && lema.endsWith('o') ? lema.slice(0, -1) + 'a' : lema);
// o que não é a peça: "original", "usada", pedaço de medida ("5x114-3"), número solto, código
const RUIDO = new Set(['original', 'originais', 'genuino', 'genuina', 'oem', 'usado', 'usada', 'usados', 'usadas', 'novo', 'nova', 'peca', 'pecas']);
const ruido = (t: string) => RUIDO.has(t) || /^\d$/.test(t) || /^\d+x\d+$/.test(t) || (t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t)) || /^\d{5,}$/.test(t);

/** As palavras do slug viram o nome como o site escreve: acento e sigla do estoque, abreviação por extenso e o
 *  adjetivo concordando ("motor vidro diant esq" -> "Motor vidro dianteiro esquerdo"). */
export function nomeDoSlug(ts: string[], w: Record<string, string>): string {
  const out: string[] = [];
  const genero = () => {
    for (let j = out.length - 1; j >= 0; j--) {
      const k = ascii(out[j]);
      if (!NAO_DECIDE.has(k)) return feminina(k);
    }
    return false;
  };
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    const k2 = i + 1 < ts.length ? `${t} ${ts[i + 1]}` : '';
    const par = k2 ? COMPOSTOS[k2] ?? w[k2] : undefined;
    if (par) { out.push(par); i++; continue; }
    if (i === 0 && t === 'sup') out.push('suporte');
    else if (ADJ[t]) out.push(flexionar(ADJ[t], genero()));
    else if (INVARIAVEL[t]) out.push(INVARIAVEL[t]);
    else if (FIXA[t]) out.push(...FIXA[t].split(' '));
    else out.push(COMPOSTOS[t] ?? w[t] ?? t);
  }
  const s = out.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ANO_MAX = new Date().getFullYear() + 2;
const ano4 = (t?: string) => (t && /^(19[5-9]\d|20[0-4]\d)$/.test(t) && Number(t) <= ANO_MAX ? Number(t) : 0);
const ano2 = (t: string | undefined, seculo?: number) => {
  if (!t || !/^\d{2}$/.test(t)) return 0;
  const x = Number(t);
  if (seculo) return seculo + x;
  return x <= ANO_MAX % 100 ? 2000 + x : 1900 + x;
};
const faixa = (a: number, b: number): [number, number] | null => (a && b && a <= b && b - a <= 30 && a >= 1960 ? [a, b] : null);

/** A faixa de anos do título: "01-07" (2001–2007), "2004-10", "2015-a-2020", "2013" sozinho. Só números de 2 ou 4
 *  algarismos contam: o motor "1-6", "2-0" e "3-8" e a medida "5x114-3" ficam de fora. */
export function anosDoSlug(ts: string[], de = 0, pular: Set<string> = new Set()): [number, number] | null {
  for (let i = de; i < ts.length; i++) {
    if (pular.has(ts[i])) continue;
    const a = ano4(ts[i]);
    if (a) {
      const prox = ts[i + 1] === 'a' || ts[i + 1] === 'ate' ? ts[i + 2] : ts[i + 1];
      const b = ano4(prox) || ano2(prox, a - (a % 100));
      return faixa(a, b >= a ? b : b + 100) ?? [a, a];
    }
    const f = faixa(ano2(ts[i]), ano2(ts[i + 1]));
    if (f) return f;
  }
  return null;
}

type Indice = { marcas: Map<string, number>; modelos: Map<string, [number, string][]> };
const indices = new WeakMap<Dicionario, Indice>();
function indice(dic: Dicionario): Indice {
  let ix = indices.get(dic);
  if (ix) return ix;
  const marcas = new Map<string, number>();
  dic.b.forEach(([n, ...ap], i) => { for (const k of [norm(n), ...ap]) if (!marcas.has(k)) marcas.set(k, i); });
  const modelos = new Map<string, [number, string][]>();
  for (const [bi, n, ...ap] of dic.m) for (const k of [norm(n), ...ap]) modelos.set(k, [...(modelos.get(k) ?? []), [bi, n]]);
  ix = { marcas, modelos };
  indices.set(dic, ix);
  return ix;
}

/** Lê a peça do slug (sem o "-MLB…"). */
export function lerSlug(slug: string, mlb: string, dic: Dicionario): Vendida {
  const ts = slug.split('-').filter(Boolean);
  const { marcas, modelos } = indice(dic);
  // a marca: a 1ª palavra (ou par, "land rover", "mercedes benz") que é marca; com peça no site antes das outras
  let bi = -1, bIni = -1, bFim = -1;
  for (const comPeca of [true, false]) {
    for (let i = 1; i < ts.length && bi < 0; i++) {
      for (const n of [2, 1]) {
        const k = ts.slice(i, i + n).join('');
        const x = i + n <= ts.length ? marcas.get(k) : undefined;
        if (x !== undefined && (x < dic.nb) === comPeca) { bi = x; bIni = i; bFim = i + n; break; }
      }
    }
    if (bi >= 0) break;
  }
  // o modelo: logo depois da marca (até 2 palavras adiante); sem marca, o 1º modelo do estoque que aparecer
  // (modelo que é só número, "3008" ou "307", só colado na marca: senão é ano ou código)
  type Achado = { mo: [number, string]; ini: number; fim: number };
  const achar = (de: number, ate: number, marca: number): Achado | null => {
    for (let i = de; i < Math.min(ate, ts.length); i++) {
      for (let n = 4; n >= 1; n--) {
        if (i + n > ts.length) continue;
        const k = ts.slice(i, i + n).join('');
        if (/^\d+$/.test(k) && !(marca >= 0 && i === bFim)) continue;
        const c = modelos.get(k)?.find(([b]) => marca < 0 || b === marca);
        if (c) return { mo: c, ini: i, fim: i + n };
      }
    }
    return null;
  };
  // por último, o começo da palavra depois da marca ("hb20x" -> HB20, "x3e" -> X3)
  const prefixo = (): Achado | null => {
    const t = ts[bFim];
    if (!t) return null;
    for (let n = t.length - 1; n >= Math.max(2, t.length - 2); n--) {
      const c = modelos.get(t.slice(0, n))?.find(([b]) => b === bi);
      if (c && /\d/.test(t.slice(0, n))) return { mo: c, ini: bFim, fim: bFim + 1 };
    }
    return null;
  };
  const achado = bi >= 0 ? achar(bFim, bFim + 3, bi) ?? achar(1, bIni, bi) ?? prefixo() : achar(1, ts.length, -1);
  const mo = achado?.mo ?? null, mIni = achado?.ini ?? -1, mFim = achado?.fim ?? -1;
  if (!mo && bi < 0) return { mlb, nome: '', marca: null, modelo: null, carro: '', anos: null };
  const marcaI = bi >= 0 ? bi : mo ? mo[0] : 0;
  const marca = dic.b[marcaI][0];
  // sem modelo no estoque: a palavra do título depois da marca ("c320" -> "C320", "fiesta" -> "Fiesta")
  let carroModelo = mo ? mo[1] : '';
  if (!mo && bFim < ts.length && /^[a-z]{1,10}\d{0,4}[a-z]?$|^[a-z]{0,3}\d{1,4}[a-z]{0,2}$/.test(ts[bFim]) && !ano4(ts[bFim]) && !/^\d{2}$/.test(ts[bFim])) {
    const t = ts[bFim];
    carroModelo = /\d/.test(t) ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
  }
  const fimNome = Math.min(...[bIni, mIni].filter((x) => x > 0));
  const palavras = ts.slice(0, fimNome).filter((t, i, a) => !ruido(t) || a.length === 1).slice(0, 7);
  const depois = Math.max(bFim, mFim, fimNome);
  return {
    mlb,
    nome: palavras.length ? nomeDoSlug(palavras, dic.w) : '',
    marca: marcaI < dic.nb ? marca : null,
    modelo: mo ? mo[1] : null,
    carro: [marca, carroModelo].filter(Boolean).join(' '),
    // o modelo que é número ("Peugeot 208 2008 13-19") não é ano
    anos: anosDoSlug(ts, depois, new Set(dic.m.filter(([b, n]) => b === marcaI && /^\d+$/.test(n)).map(([, n]) => n))),
  };
}

/** O endereço da 404 é de uma peça? */
export function lerEndereco(caminho: string, dic: Dicionario): Vendida | null {
  const m = RE_VENDIDA.exec(caminho);
  return m ? lerSlug(m[1], m[2], dic) : null;
}

/** "2001–2007" (ou "2013"). */
export const anosCurto = (y: [number, number] | null, sep = '–') => (y ? (y[0] === y[1] ? String(y[0]) : `${y[0]}${sep}${y[1]}`) : '');

/** "airbag motorista" dentro da frase (sigla e nome próprio ficam: "TBI corpo borboleta"). */
const naFrase = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** "Me avise se chegar outra": a mensagem do WhatsApp (abertura de lib/whats.ts). */
export function mensagemVendida(v: Vendida): string {
  const carro = [v.carro, anosCurto(v.anos, ' a ')].filter(Boolean).join(' ');
  const procuro = v.nome ? `Procuro ${naFrase(v.nome)}${carro ? ` para ${carro}` : ''}. ` : '';
  return mensagem(`${procuro}Vi que a peça ${v.mlb} já vendeu. Me avisa se chegar outra?`);
}

/** Link do catálogo com os filtros (os mesmos parâmetros que o catálogo entende). */
export function linkFiltros(f: Filtros): string {
  const u = new URLSearchParams();
  if (f.q) u.set('q', f.q);
  if (f.marca) u.set('marca', f.marca);
  if (f.modelo) u.set('modelo', f.modelo);
  if (f.tipo) u.set('tipo', f.tipo);
  const s = u.toString();
  return `/catalogo.html${s ? `?${s}` : ''}`;
}

/** "Ver parecidas" antes do índice chegar: o nome e o carro (só marca e modelo com peça no site). */
export function filtrosIniciais(v: Vendida): Filtros {
  return { q: v.nome || undefined, marca: v.marca ?? undefined, modelo: (v.marca && v.modelo) || undefined };
}

// palavra de posição não diz o que a peça é ("direito" está em toda categoria)
const POSICAO = new Set(['direito', 'direita', 'esquerdo', 'esquerda', 'dianteiro', 'dianteira', 'traseiro', 'traseira',
  'interno', 'interna', 'externo', 'externa', 'superior', 'inferior', 'lateral', 'central', 'para', 'com', 'sem']);

/** A categoria da peça pelo nome: cada palavra vota com a divisão das peças que a têm no nome; a palavra rara vale
 *  mais que a comum e a 1ª (a que diz o que é) vale o dobro. "Módulo central airbag" -> Airbag e Segurança (há
 *  "módulo" de tudo; "airbag", não); "Airbag motorista" -> Airbag (e não Vidro Elétrico, do "botão vidro motorista"). */
export function categoriaDoNome(itens: Pick<Item, 'n' | 'c'>[], nome: string): string | undefined {
  const ws = nome.split(/\s+/).map(norm).filter((w) => w.length >= 3 && !POSICAO.has(w));
  if (!ws.length) return undefined;
  const nota = new Map<string, number>();
  ws.forEach((w, i) => {
    const conta = new Map<string, number>();
    let total = 0;
    for (const it of itens) {
      if (!it.c || it.c === 'Outros' || !it.n.split(/\s+/).some((x) => norm(x) === w)) continue;
      conta.set(it.c, (conta.get(it.c) ?? 0) + 1);
      total++;
    }
    const peso = (i === 0 ? 2 : 1) * (total ? Math.log((itens.length + 1) / total) : 0);
    for (const [c, k] of conta) nota.set(c, (nota.get(c) ?? 0) + peso * (k / total));
  });
  return [...nota].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** As parecidas, com o índice do catálogo (a mesma busca de lib/busca.ts). Escada, do mais perto para o mais longe:
 *  o nome no carro; o carro na mesma categoria; o nome em outros carros da marca; o carro inteiro; o nome em outros
 *  carros; a marca. "Ver parecidas" leva ao 1º degrau com peça (nunca a uma lista vazia) e os cartões seguem a escada
 *  até 6; dentro de cada degrau, primeiro as de nome mais parecido e as da mesma geração (nos anos da vendida). `doCarro` = o 1º degrau achado é só o carro (o título da
 *  seção diz "Mais peças do <carro>", não "parecidas"). */
export function parecidas(busca: Busca, v: Vendida, n = 6): { filtros: Filtros; itens: Item[]; doCarro: boolean } {
  const { nome: q, marca, modelo } = v;
  const exato = (f: Filtros) => { const r = busca.procurar(f); return busca.aproximado ? [] : r; };
  const cat = q ? categoriaDoNome(busca.itens, q) : undefined;
  const carro = marca && modelo ? { marca, modelo } : null;
  const degraus: [Filtros, boolean][] = [];
  if (q && carro) degraus.push([{ q, ...carro }, true]);
  if (cat && carro) degraus.push([{ ...carro, tipo: cat }, false]);
  if (q && marca) degraus.push([{ q, marca }, true]);
  if (carro) degraus.push([carro, false]);
  if (q) degraus.push([{ q }, true]);
  if (marca) degraus.push([{ marca }, false]);
  const nosAnos = (it: Item) => {
    if (!v.anos || !modelo || it.b !== marca) return false;
    const y = anosNoModelo(it, modelo);
    return !!y && y[0] <= v.anos[1] && y[1] >= v.anos[0];
  };
  const palavrasQ = new Set(q.split(' ').map(norm).filter((w) => w.length >= 3 && !POSICAO.has(w)));
  const comuns = (it: Item) => it.n.split(' ').reduce((k, w) => k + (palavrasQ.has(norm(w)) ? 1 : 0), 0);
  let filtros: Filtros | null = null;
  const vistos = new Set<string>();
  const itens: Item[] = [];
  for (const [f, soExato] of degraus) {
    // o índice em cache (até 10 min) ainda pode ter a própria peça vendida
    const r = (soExato ? exato(f) : busca.procurar(f)).filter((it) => it.id !== v.mlb);
    if (!r.length) continue;
    filtros ??= f;
    // dentro do degrau: mais palavras do nome em comum primeiro, depois a mesma geração (nos anos da vendida)
    const nota = (it: Item) => comuns(it) * 2 + (nosAnos(it) ? 1 : 0);
    for (const it of r.map((x, i) => [x, nota(x), i] as const).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(([x]) => x)) {
      if (itens.length >= n) break;
      if (!vistos.has(it.id)) { vistos.add(it.id); itens.push(it); }
    }
    if (itens.length >= n) break;
  }
  const f = filtros ?? {};
  return { filtros: f, itens, doCarro: !f.q && !f.tipo };
}
