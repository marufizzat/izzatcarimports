// Tabela de regressão da busca (rodada 14, cliente oculto 10/11 atrito 6): cada consulta tem um GABARITO mecânico, lido do
// próprio estoque (o busca.json que está sendo testado), e não uma lista escrita à mão. O teste (busca.regressao.test.ts)
// roda a busca nova; a comparação com a busca antiga (a rodada 13) roda este mesmo módulo com a classe antiga.
//
// São INVARIANTES: valem em QUALQUER estoque (o robô roda isto a cada 30 min com o estoque do momento; em 11/11/2026 a
// rodada 14 foi recusada porque a última lanterna do XC60 vendeu). Nada aqui pode depender de uma peça existir: o que se
// espera de cada consulta sai, por regra, do estoque que está sendo testado.
//
// Gabarito de cada consulta (tipo T, carro C opcional, lado S opcional):
//  - "existe" = há peça do tipo T, do carro C e do lado S no estoque. O tipo é a 1ª palavra do nome, a palavra mesmo ou o
//    plural dela ("Tampa", "Faróis"). Nome só PARECIDO com o tipo ("Tampão", "Farolete", "Modulador") é dúvida: o
//    gabarito não decide por ele;
//  - existe: a 1ª peça é do tipo (ou de nome parecido), do carro e do lado (acerto);
//  - só existe peça de nome parecido: lista vazia, ou a 1ª é ela ou é da família (a busca pode tratá-la como a peça ou
//    como parecida);
//  - não existe: não há lista (0 peças, o pátio) OU a lista vem com o aviso (parecidas, ou "peças ligadas a…") e a 1ª é
//    do tipo ou da família dele (o nome, o tipo "s" ou o bloco "c" dizem a palavra): nunca como achado, nunca outra coisa.
//    Só quando o estoque INTEIRO não diz a palavra em nenhum nome, tipo ou bloco a 1ª pode ser o que o anúncio cita (com
//    o aviso do mesmo jeito);
//  - a peça que só o TÍTULO do anúncio liga à busca nunca vem antes de uma que o nome, o tipo ou o bloco ligam;
//  - busca sem tipo (só código): a 1ª peça tem o código;
//  - sempre: com aviso, nenhuma peça conta como exata; sem peça repetida; lado que falta = lista vazia.
// O tipo é checado pelo nome da peça (regex no nome normalizado), não pelas regras da busca: o gabarito não copia o motor.

export type Caso = {
  q: string;
  grupo: 'tipo' | 'carro' | 'lado' | 'codigo' | 'familia' | 'relatorio';
  /** o tipo (regex no nome normalizado); função para família (bloco) */
  tipo?: ((n: string) => boolean) | ((it: Item) => boolean);
  /** a palavra do tipo (regex na palavra): a FAMÍLIA dele é a peça com essa palavra no nome, no tipo "s" ou no bloco "c" */
  tk?: RegExp;
  /** o nome é PARECIDO com o tipo (pode ser a peça, pode não ser: "Tampão" para tampa, "Farolete" para farol) */
  quase?: (n: string) => boolean;
  carro?: { b: string; m: string };
  lado?: 'E' | 'D';
  codigo?: string;
};
export type Item = { n: string; s: string; c: string; b: string; ms: string[]; l: string; o: string; t: string };
export type Resultado = {
  q: string; grupo: string; existe: boolean; ok: boolean; motivo: string;
  top1: string; n: number; aprox: boolean;
  /** as peças (índice k) da lista inteira e as 10 primeiras que são do gabarito (para a comparação entre motores) */
  todas: number[]; certos10: number[];
};

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** As peças do estoque como o gabarito as lê (nome, tipo, bloco, marca, carros, lado, códigos). */
export function itensDo(ix: any): Item[] {
  return ix.id.map((_: string, k: number) => ({
    n: norm(ix.n[k]), s: norm(ix.tipos[ix.s[k]] ?? ''), c: norm(ix.familias[ix.c[k]] ?? ''),
    b: norm(ix.marcas[ix.b[k]] ?? ''), ms: ix.ms?.[k] ?? [ix.m[k]], l: ix.l?.[k] ?? '0', o: ix.o[k] ?? '', t: norm(ix.t[k] ?? ''),
  }));
}

// O tipo da peça pelo nome (o gabarito): a 1ª palavra do nome. A revisão da rodada 14 (P2-2) derrubou a regra antiga em
// que a 2ª palavra valia sob um cabeçalho genérico: o "Suporte alternador" NÃO é o alternador e o "Acabamento retrovisor
// esquerdo" não é o retrovisor esquerdo (quem procura a peça principal precisa ler que ela não está). Rodada 14b: a
// palavra do tipo é a palavra inteira ou o plural, não o começo dela (a regex "^painel" dizia que o "Painel-forro" era o
// painel, "^farol" que o "Farolete" era o farol e "^motor" que "motorista" era motor: com o estoque de 09/11 não fazia
// diferença, com outro estoque travava o robô).
const palavrasDo = (n: string) => n.split(' ').map((x) => x.replace(/[^a-z0-9]/g, '')).filter(Boolean);
const cabeca = (n: string) => palavrasDo(n)[0] ?? '';
/** a palavra e os plurais dela ("farol": farol, farois; "motor": motores; "painel": paineis) */
const formasDe = (b: string) => [b, `${b}s`, `${b}es`, b.replace(/l$/, 'is'), b.replace(/ao$/, 'oes')];
/** a palavra É uma das bases (ela mesma ou o plural) */
const eh = (w: string, bases: string[]) => bases.some((b) => formasDe(b).includes(w));
/** a palavra PARECE uma das bases: o mesmo começo (4+ letras) e tamanho perto ("tampao"/"tampa", "farolete"/"farol",
 *  "modulador"/"modulo"); "painelforro" e "motorista" não parecem */
const parece = (w: string, bases: string[]) => bases.some((b) => { let n = 0; while (n < w.length && n < b.length && w[n] === b[n]) n++; return n >= 4 && Math.abs(w.length - b.length) <= 3; });

// O tipo de cada consulta: bases = a palavra do tipo (e as outras formas do jeito de falar que a busca aceita: quem
// digita "sinaleira" acha a "Lanterna…", e se um anúncio vier como "Sinaleira…", também); re = a peça É o tipo (padrão:
// a 1ª palavra do nome é uma base); quase = o nome parece (padrão: a 1ª palavra parece uma base); tk = a família.
type Tipo = { t: string; bases: string[]; typed: string[]; lado?: boolean; tk?: RegExp; re?: (n: string) => boolean; quase?: (n: string) => boolean };
const FRENTE = ['frente', 'grade', 'churrasqueira', 'farol', 'capo', 'parachoque', 'paralama', 'frontal'];
const TIPOS_BASE: Tipo[] = [
  { t: 'lanterna', bases: ['lanterna'], lado: true, typed: ['lanterna'] },
  { t: 'sinaleira', bases: ['lanterna', 'sinaleira'], lado: true, typed: ['sinaleira'] },
  { t: 'farol', bases: ['farol'], tk: /^(farol|farois)/, lado: true, typed: ['farol'] },
  { t: 'paralama', bases: ['paralama'], lado: true, typed: ['paralama'] },
  { t: 'parachoque', bases: ['parachoque'], typed: ['parachoque', 'para-choque'] },
  { t: 'retrovisor', bases: ['retrovisor'], lado: true, typed: ['retrovisor'] },
  { t: 'macaneta', bases: ['macaneta'], lado: true, typed: ['maçaneta'] },
  { t: 'bobina', bases: ['bobina'], typed: ['bobina'] },
  { t: 'sensor', bases: ['sensor'], typed: ['sensor'] },
  { t: 'amortecedor', bases: ['amortecedor'], lado: true, typed: ['amortecedor'] },
  { t: 'tampa', bases: ['tampa'], typed: ['tampa'] },
  { t: 'grade', bases: ['grade'], typed: ['grade'] },
  // a "Grade churrasqueira" é a churrasqueira (só nela a 2ª palavra vale: a "Grade para-choque" não é o para-choque)
  { t: 'churrasqueira', bases: ['churrasqueira'], typed: ['churrasqueira'],
    re: (n) => { const [h = '', d = ''] = palavrasDo(n); return eh(h, ['churrasqueira']) || (eh(h, ['grade']) && eh(d, ['churrasqueira'])); },
    quase: (n) => palavrasDo(n).some((x) => parece(x, ['churrasqueira'])) },
  { t: 'motor', bases: ['motor'], typed: ['motor'] },
  { t: 'modulo', bases: ['modulo'], typed: ['modulo'] },
  // o pisca é a "Chave seta" (lib/sinonimos.ts): o nome começa por seta ou pisca, ou é uma "Chave … seta"; o "Botão
  // pisca-alerta" e o "Conjunto chave seta limpador" são dúvida
  { t: 'pisca', bases: ['seta', 'pisca'], typed: ['pisca'],
    re: (n) => { const w = palavrasDo(n); return eh(w[0] ?? '', ['seta', 'pisca']) || (eh(w[0] ?? '', ['chave']) && w.some((x) => eh(x, ['seta']))); },
    quase: (n) => palavrasDo(n).some((x) => /^(seta|pisca)/.test(x)) },
  // "frente" = a forma do sinônimo no nome de qualquer peça (o "fora" tira a moldura do painel e a chave de farol)
  { t: 'frente', bases: FRENTE, tk: /^(frente|grade|churrasqueira|farol|farois|capo|parachoque|paralama|frontal)/, typed: ['frente'],
    re: (n) => { const w = palavrasDo(n); const frente = w.some((x) => /^(frente|grade|churrasqueira|farol|capo|frontal)/.test(x)) || (w.some((x) => /^(parachoque|paralama)/.test(x)) && w.some((x) => /^dianteir/.test(x))); return frente && !w.some((x) => /^(painel|console|falante|tweeter|difusor|tras|porta|chave|botao|interruptor)/.test(x)); },
    quase: (n) => palavrasDo(n).some((x) => parece(x, FRENTE) || /^farois/.test(x)) },
  { t: 'tapete', bases: ['tapete', 'carpete'], typed: ['tapete'] },
  { t: 'bomba', bases: ['bomba'], typed: ['bomba'] },
  { t: 'painel', bases: ['painel'], typed: ['painel'] },
  { t: 'coluna', bases: ['coluna'], typed: ['coluna'] },
  { t: 'maquina-vidro', bases: ['motor', 'maquina'], typed: ['motor vidro', 'maquina vidro'],
    re: (n) => eh(cabeca(n), ['motor', 'maquina']) && palavrasDo(n).some((x) => eh(x, ['vidro'])),
    quase: (n) => (parece(cabeca(n), ['motor', 'maquina']) || palavrasDo(n).some((x) => parece(x, ['maquina']))) && /vidro/.test(n) },
];
const TIPOS = TIPOS_BASE.map((T) => ({
  ...T,
  tk: T.tk ?? new RegExp(`^(${T.bases.join('|')})`),
  re: T.re ?? ((n: string) => eh(cabeca(n), T.bases)),
  quase: T.quase ?? ((n: string) => parece(cabeca(n), T.bases)),
}));
const LADOS: [string, 'E' | 'D'][] = [['esquerda', 'E'], ['direita', 'D']];
const CARROS: { typed: string[]; b: string; m: string }[] = [
  { typed: ['xc60'], b: 'volvo', m: 'XC60' },
  { typed: ['onix'], b: 'chevrolet', m: 'Onix' },
  { typed: ['gol'], b: 'volkswagen', m: 'Gol' },
  { typed: ['tracker'], b: 'chevrolet', m: 'Tracker' },
  { typed: ['e-pace', 'epace'], b: 'jaguar', m: 'E-Pace' },
  { typed: ['compass'], b: 'jeep', m: 'Compass' },
  { typed: ['hb20'], b: 'hyundai', m: 'HB20' },
  { typed: ['fiesta'], b: 'ford', m: 'Fiesta' },
  { typed: ['toro'], b: 'fiat', m: 'Toro' },
  { typed: ['cruze'], b: 'chevrolet', m: 'Cruze' },
];

/** O conjunto de consultas: tipo × carro × forma (T C, T do C, C T, T lado C), tipos sem carro, lado, códigos com espaço
 *  e traço, e as consultas do relatório (friction 6, 7 e 5). Determinístico (sem sorteio). Os carros são os da lista que
 *  têm peça no estoque testado (carro sem nenhuma peça não é carro para a busca: as consultas dele não entram). */
export function casos(ix: any): Caso[] {
  const itens = itensDo(ix);
  const out: Caso[] = [];
  const porCarro = (c: { b: string; m: string }) => (it: Item) => it.b === c.b && it.ms.some((m) => norm(m) === norm(c.m));
  const carros = CARROS.filter((C) => itens.some(porCarro(C)));
  for (const T of TIPOS) {
    for (const t of T.typed) {
      out.push({ q: t, grupo: 'tipo', tipo: T.re, tk: T.tk, quase: T.quase });
      for (const C of carros) {
        const c = C.typed[0];
        out.push({ q: `${t} ${c}`, grupo: 'carro', tipo: T.re, tk: T.tk, quase: T.quase, carro: C });
        out.push({ q: `${t} do ${C.typed[C.typed.length - 1]}`, grupo: 'carro', tipo: T.re, tk: T.tk, quase: T.quase, carro: C });
        out.push({ q: `${c} ${t}`, grupo: 'carro', tipo: T.re, tk: T.tk, quase: T.quase, carro: C });
        if (T.lado) for (const [pal, lado] of LADOS) out.push({ q: `${t} ${pal} ${c}`, grupo: 'lado', tipo: T.re, tk: T.tk, quase: T.quase, carro: C, lado });
      }
    }
  }
  // o tipo da lista, sem carro, de cada um dos carros
  for (const C of carros) out.push({ q: `${C.typed[0]}`, grupo: 'familia', tipo: porCarro(C), carro: C });
  // sistema de carro ("suspensão xc60", "motor xc60"): a família, sem a regra de tipo
  for (const C of carros.slice(0, 4)) {
    out.push({ q: `suspensao ${C.typed[0]}`, grupo: 'familia', tipo: (it: Item) => it.c.includes('suspensao'), tk: /^suspens/, carro: C });
  }
  // código gravado com espaço e traço (o código real do estoque, na forma junta que o índice guarda: só letras e
  // números; a forma de mostrar, "17800-T5A-A010", fica de fora: cortada em posição fixa viraria "1780 0-T 5A-A010",
  // que ninguém digita). Com espaço, só quando todo pedaço tem número, que é o que a busca chama de código
  // (codigoJunto: "8200 328 856", "1K0 959 653"); senão, só a forma com traço.
  const codigos = [...new Set(itens.flatMap((it) => it.o.split(' ').filter((x) => /^[a-z0-9]{6,14}$/.test(x) && /\d{5,}/.test(x))))];
  const amostra = codigos.filter((_, i) => i % Math.max(1, Math.floor(codigos.length / 14)) === 0).slice(0, 14);
  for (const cod of amostra) {
    const pedacos = [cod.slice(0, 4), cod.slice(4, 7), cod.slice(7)];
    out.push({ q: cod.length >= 8 && pedacos.every((x) => /\d/.test(x)) ? pedacos.join(' ') : cod, grupo: 'codigo', codigo: cod });
    out.push({ q: cod.slice(0, 4) + '-' + cod.slice(4), grupo: 'codigo', codigo: cod });
  }
  return out;
}

/** O anúncio cita o carro por extenso ("Coluna Direção Jeep Renegade Fiat Toro" para "toro"): a peça serve nele. */
function citaCarro(it: Item, m: string): boolean {
  const ws = it.t.split(/[^a-z0-9]+/).filter(Boolean); const alvo = norm(m).replace(/[^a-z0-9]/g, '');
  return ws.some((_, i) => [1, 2, 3].some((n) => ws.slice(i, i + n).join('') === alvo));
}

/** O que a peça é para o gabarito (tipo, carro e lado do caso). */
function casa(it: Item, c: Caso, parecido = false): boolean {
  if (c.codigo) return it.o.split(' ').includes(c.codigo);
  // parecido: o nome parece o tipo (ou é ele); sem "quase" no caso, é a mesma conta
  const tipo = parecido && c.quase ? (n: string) => c.quase!(n) || (c.tipo as (n: string) => boolean)(n) : c.tipo;
  if (tipo && !(c.grupo === 'familia' ? (tipo as (it: Item) => boolean)(it) : (tipo as (n: string) => boolean)(it.n))) return false;
  if (c.carro && !(it.b === norm(c.carro.b) && it.ms.some((m) => norm(m) === norm(c.carro!.m))) && !citaCarro(it, c.carro.m)) return false;
  if (c.lado && it.l !== c.lado) return false;
  return true;
}

/** A peça é da família do tipo: o nome, o tipo "s" ou o bloco "c" dela têm a palavra. */
const naFamilia = (it: Item, tk?: RegExp) => !!tk && [it.n, it.s, it.c].some((t) => palavrasDo(t).some((x) => tk.test(x)));
/** Só o título do anúncio tem a palavra (o nome, o tipo e o bloco não). */
const soNoTitulo = (it: Item, tk?: RegExp) => !!tk && !naFamilia(it, tk) && palavrasDo(it.t).some((x) => tk.test(x));
/** As duas contas acima para o estoque inteiro, uma vez por palavra de tipo: 1 = família, 2 = só o título, 0 = nada. */
function classes(itens: Item[]) {
  const memo = new Map<string, Uint8Array>();
  return (tk: RegExp) => {
    let v = memo.get(String(tk));
    if (!v) { v = Uint8Array.from(itens, (it) => (naFamilia(it, tk) ? 1 : soNoTitulo(it, tk) ? 2 : 0)); memo.set(String(tk), v); }
    return v;
  };
}

/** Roda a busca (a classe passada) sobre cada consulta e dá o veredito pelo gabarito. O índice k de cada peça é o
 *  mesmo para os dois motores (a comparação antiga x nova usa os k). */
export function avaliar(Busca: new (ix: any) => any, ix: any, lista: Caso[]): { rows: Resultado[]; itens: Item[] } {
  const itens = itensDo(ix);
  const b = new Busca(ix);
  const rows: Resultado[] = [];
  const classe = classes(itens);
  // o estoque inteiro tem alguma peça da família?
  const familiaNoEstoque = (tk: RegExp) => classe(tk).includes(1);
  for (const c of lista) {
    const existe = itens.some((it) => casa(it, c));
    // só há peça de nome PARECIDO com o tipo (para o carro e o lado pedidos)
    const talvez = !existe && !c.codigo && !!c.quase && itens.some((it) => casa(it, c, true));
    const res: any[] = b.procurar({ q: c.q });
    const top = res[0];
    const top1 = top ? `${top.n} | ${top.b} ${top.m}` : '';
    const topItem = top ? itens[top.k] : undefined;
    const aviso = !!b.aproximado || !!b.citam;
    let ok: boolean; let motivo: string;
    if (c.codigo) {
      ok = !!top && itens[top.k].o.split(' ').includes(c.codigo);
      motivo = ok ? 'acerto' : (res.length ? 'código não é o 1º' : 'sem resultado');
    } else if (existe) {
      // (a 1ª é a peça, ou uma de nome parecido com o tipo, do carro e do lado: "Tampão" ao lado de "Tampa")
      ok = !!top && casa(topItem!, c, true);
      motivo = ok ? 'acerto' : (!res.length ? 'vazio, mas a peça existe' : 'a 1ª não é a peça pedida');
    } else if (talvez) {
      // o gabarito não decide se "Farolete" é o farol: a busca pode mostrá-lo como a peça ou como parecida; a 1ª é ele
      // (ou outro de nome parecido) ou é da família do tipo, nunca outra coisa
      const tipoSo = { ...c, carro: undefined, lado: undefined };
      ok = !res.length || casa(topItem!, tipoSo, true) || (!!c.tk && classe(c.tk)[top.k] === 1);
      motivo = ok ? 'só nome parecido (aceito)' : 'a 1ª não é do tipo nem da família';
    } else {
      // não há a peça: não pode aparecer como achado; a parecida do tipo é aceita, com o aviso (aproximado ou citam: a
      // tela diz "parecidas" ou "peças ligadas a…", nunca "peças para…")
      const tipoSo = { ...c, carro: undefined, lado: undefined };
      // parecida: o tipo no nome, ou a família do tipo (o sistema "s" ou o bloco "c" da peça tem a palavra); só quando o
      // estoque inteiro não tem ninguém da família, a 1ª pode ser o que o anúncio cita
      const daFamilia = !!topItem && (casa(topItem, tipoSo) || (!!c.tk && (classe(c.tk)[top.k] === 1 || !familiaNoEstoque(c.tk))));
      ok = !res.length || (daFamilia && aviso);
      motivo = ok ? (res.length ? 'parecida (aviso)' : 'zero + pátio') : aviso ? 'parecida que não é da família' : 'achado errado como certo';
    }
    const todas = res.map((r: any) => r.k as number);
    // as regras que valem para toda consulta
    if (ok && !c.codigo && c.tk) {
      // o que só o título do anúncio liga à busca nunca vem antes do que o nome, o tipo ou o bloco ligam
      const cl = classe(c.tk);
      const i = todas.findIndex((k) => cl[k] === 2);
      if (i >= 0 && todas.slice(i + 1).some((k) => cl[k] === 1)) { ok = false; motivo = `só o anúncio cita (${itens[todas[i]].n}) e vem antes de peça do tipo`; }
    }
    if (ok && aviso && typeof b.nExatas === 'number' && b.nExatas !== 0) { ok = false; motivo = 'com aviso e contando peça como exata'; }
    if (ok && typeof b.nExatas === 'number' && b.nExatas > res.length) { ok = false; motivo = 'mais exatas que peças'; }
    if (ok && new Set(todas).size !== todas.length) { ok = false; motivo = 'peça repetida na lista'; }
    if (ok && b.faltou && res.length) { ok = false; motivo = 'diz que falta o lado e mostra lista'; }
    const certos10 = c.codigo || !existe ? [] : todas.slice(0, 10).filter((k) => casa(itens[k], c));
    rows.push({ q: c.q, grupo: c.grupo, existe, ok, motivo, top1, n: res.length, aprox: !!b.aproximado, todas, certos10 });
  }
  return { rows, itens };
}

/** O mesmo índice sem algumas peças (fica(k) = a peça continua): para provar as regras com o estoque mexido (uma venda
 *  é exatamente isto: a peça some do busca.json). */
export function semPecas(ix: any, fica: (k: number) => boolean): any {
  const ks: number[] = ix.id.map((_: string, k: number) => k).filter(fica);
  const out: any = { ...ix };
  for (const c of Object.keys(ix)) {
    const v = ix[c];
    if (Array.isArray(v) && v.length === ix.id.length) out[c] = ks.map((k) => v[k]);
    else if (typeof v === 'string' && v.length === ix.id.length) out[c] = ks.map((k) => v[k]).join('');
  }
  for (const c of ['ms', 'ys', 'dif']) if (ix[c]) { out[c] = {}; ks.forEach((k, i) => { if (ix[c][k] !== undefined) out[c][i] = ix[c][k]; }); }
  return out;
}

/** As consultas geradas para o estoque (so = só as que têm esse texto; carro = só as sem carro e as desse carro), julgadas
 *  pelas regras: as linhas que falham (vazio = tudo certo). */
export function falhasDe(Busca: new (ix: any) => any, estoque: any, so?: RegExp, carro?: string): string[] {
  const lista = casos(estoque).filter((c) => (!so || so.test(c.q)) && (!carro || !c.carro || c.carro.m === carro));
  return avaliar(Busca, estoque, lista).rows.filter((r) => !r.ok).map((r) => `${r.q} | ${r.motivo} | ${r.top1}`);
}
