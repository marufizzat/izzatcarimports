// Tabela de regressão da busca (rodada 14, cliente oculto 10/11 atrito 6): cada consulta tem um GABARITO mecânico, lido do
// próprio estoque (busca.json), e não uma lista escrita à mão. O teste (busca.regressao.test.ts) roda a busca nova; a
// comparação com a busca antiga (a rodada 13) roda este mesmo módulo com a classe antiga.
//
// Gabarito de cada consulta (tipo T, carro C opcional, lado S opcional):
//  - "existe" = há peça do tipo T, do carro C e do lado S no estoque;
//  - existe: a 1ª peça é do tipo, do carro e do lado (acerto);
//  - não existe: não há lista (0 peças, o pátio) OU a 1ª é do tipo como PARECIDA (aproximado): nunca como achado exato;
//  - busca sem tipo (só código): a 1ª peça tem o código.
// O tipo é checado pelo nome da peça (regex no nome normalizado), não pelas regras da busca: o gabarito não copia o motor.

export type Caso = {
  q: string;
  grupo: 'tipo' | 'carro' | 'lado' | 'codigo' | 'familia' | 'relatorio';
  /** o tipo (regex no nome normalizado); função para família (bloco) */
  tipo?: ((n: string) => boolean) | ((it: Item) => boolean);
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
// esquerdo" não é o retrovisor esquerdo (quem procura a peça principal precisa ler que ela não está). Fica só a "Grade
// churrasqueira", que é a churrasqueira. Para o jeito de falar (pisca = seta), a 2ª vale sob botão/chave/interruptor.
const GEN = new Set(['grade']);
const palavrasDo = (n: string) => n.split(' ').map((x) => x.replace(/[^a-z0-9]/g, '')).filter(Boolean);
const CONTROLE = new Set(['botao', 'chave', 'interruptor', 'alavanca']);
const cab = (re: RegExp, sinonimo = false) => (n: string) => {
  const [h = '', d = ''] = palavrasDo(n);
  return re.test(h) || ((GEN.has(h) || (sinonimo && CONTROLE.has(h))) && re.test(d));
};
// tk = o tipo como palavra (regex na palavra); cab = o tipo como 1ª palavra (ou 2ª, sob cabeçalho genérico)
const TIPOS: { t: string; tk: RegExp; re: (n: string) => boolean; lado?: boolean; typed: string[] }[] = [
  { t: 'lanterna', tk: /^lanterna/, re: cab(/^lanterna/), lado: true, typed: ['lanterna', 'sinaleira'] },
  { t: 'farol', tk: /^(farol|farois)/, re: cab(/^(farol|farois)/), lado: true, typed: ['farol'] },
  { t: 'paralama', tk: /^paralama/, re: cab(/^paralama/), lado: true, typed: ['paralama'] },
  { t: 'parachoque', tk: /^parachoque/, re: cab(/^parachoque/), typed: ['parachoque', 'para-choque'] },
  { t: 'retrovisor', tk: /^retrovisor/, re: cab(/^retrovisor/), lado: true, typed: ['retrovisor'] },
  { t: 'macaneta', tk: /^macaneta/, re: cab(/^macaneta/), lado: true, typed: ['maçaneta'] },
  { t: 'bobina', tk: /^bobina/, re: cab(/^bobina/), typed: ['bobina'] },
  { t: 'sensor', tk: /^sensor/, re: cab(/^sensor/), typed: ['sensor'] },
  { t: 'amortecedor', tk: /^amortecedor/, re: cab(/^amortecedor/), lado: true, typed: ['amortecedor'] },
  { t: 'tampa', tk: /^tampa/, re: cab(/^tampa/), typed: ['tampa'] },
  { t: 'grade', tk: /^grade/, re: cab(/^grade/), typed: ['grade'] },
  { t: 'churrasqueira', tk: /^churrasqueira/, re: cab(/^churrasqueira/), typed: ['churrasqueira'] },
  { t: 'motor', tk: /^motor/, re: cab(/^motor/), typed: ['motor'] },
  { t: 'modulo', tk: /^modulo/, re: cab(/^modulo/), typed: ['modulo'] },
  { t: 'pisca', tk: /^(seta|pisca)/, re: cab(/^(seta|pisca)/, true), typed: ['pisca'] },
  // "frente" = a forma do sinônimo no nome de qualquer peça (o "fora" tira a moldura do painel e a chave de farol)
  { t: 'frente', tk: /^(grade|churrasqueira|farol|capo|parachoque|paralama|frontal)/, re: (n) => { const w = palavrasDo(n); const frente = w.some((x) => /^(grade|churrasqueira|farol|capo|frontal)/.test(x)) || (w.some((x) => /^(parachoque|paralama)/.test(x)) && w.some((x) => /^dianteir/.test(x))); return frente && !w.some((x) => /^(painel|console|falante|tweeter|difusor|tras|porta|chave|botao|interruptor)/.test(x)); }, typed: ['frente'] },
  { t: 'tapete', tk: /^(tapete|carpete)/, re: cab(/^(tapete|carpete)/), typed: ['tapete'] },
  { t: 'bomba', tk: /^bomba/, re: cab(/^bomba/), typed: ['bomba'] },
  { t: 'painel', tk: /^painel/, re: cab(/^painel/), typed: ['painel'] },
  { t: 'coluna', tk: /^coluna/, re: cab(/^coluna/), typed: ['coluna'] },
  { t: 'maquina-vidro', tk: /^(motor|maquina)/, re: (n) => (/^(motor|maquina)/.test(palavrasDo(n)[0] ?? '') || /^maquina/.test(palavrasDo(n)[1] ?? '')) && /vidro/.test(n), typed: ['motor vidro', 'maquina vidro'] },
];
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
 *  e traço, e as consultas do relatório (friction 6, 7 e 5). Determinístico (sem sorteio). */
export function casos(ix: any): Caso[] {
  const itens = itensDo(ix);
  const out: Caso[] = [];
  const porCarro = (c: { b: string; m: string }) => (it: Item) => it.b === c.b && it.ms.some((m) => norm(m) === norm(c.m));
  for (const T of TIPOS) {
    for (const t of T.typed) {
      out.push({ q: t, grupo: 'tipo', tipo: T.re });
      for (const C of CARROS) {
        const c = C.typed[0];
        out.push({ q: `${t} ${c}`, grupo: 'carro', tipo: T.re, carro: C });
        out.push({ q: `${t} do ${C.typed[C.typed.length - 1]}`, grupo: 'carro', tipo: T.re, carro: C });
        out.push({ q: `${c} ${t}`, grupo: 'carro', tipo: T.re, carro: C });
        if (T.lado) for (const [pal, lado] of LADOS) out.push({ q: `${t} ${pal} ${c}`, grupo: 'lado', tipo: T.re, carro: C, lado });
      }
    }
  }
  // o tipo da lista, sem carro, de cada um dos carros
  for (const C of CARROS) out.push({ q: `${C.typed[0]}`, grupo: 'familia', tipo: porCarro(C), carro: C });
  // sistema de carro ("suspensão xc60", "motor xc60"): a família, sem a regra de tipo
  for (const C of CARROS.slice(0, 4)) {
    out.push({ q: `suspensao ${C.typed[0]}`, grupo: 'familia', tipo: (it: Item) => it.c.includes('suspensao'), carro: C });
  }
  // código gravado com espaço e traço (o código real do estoque)
  const codigos = [...new Set(itens.flatMap((it) => it.o.split(' ').filter((x) => /\d{5,}/.test(x) && x.length >= 6 && x.length <= 14)))];
  const amostra = codigos.filter((_, i) => i % Math.max(1, Math.floor(codigos.length / 14)) === 0).slice(0, 14);
  for (const cod of amostra) {
    const f = cod.length >= 8 ? `${cod.slice(0, 4)} ${cod.slice(4, 7)} ${cod.slice(7)}` : cod;
    out.push({ q: f, grupo: 'codigo', codigo: cod });
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
function casa(it: Item, c: Caso): boolean {
  if (c.codigo) return it.o.split(' ').includes(c.codigo);
  if (c.tipo && !(c.grupo === 'familia' ? (c.tipo as (it: Item) => boolean)(it) : (c.tipo as (n: string) => boolean)(it.n))) return false;
  if (c.carro && !(it.b === norm(c.carro.b) && it.ms.some((m) => norm(m) === norm(c.carro!.m))) && !citaCarro(it, c.carro.m)) return false;
  if (c.lado && it.l !== c.lado) return false;
  return true;
}

/** Roda a busca (a classe passada) sobre cada consulta e dá o veredito pelo gabarito. O índice k de cada peça é o
 *  mesmo para os dois motores (a comparação antiga x nova usa os k). */
export function avaliar(Busca: new (ix: any) => any, ix: any, lista: Caso[]): { rows: Resultado[]; itens: Item[] } {
  const itens = itensDo(ix);
  const b = new Busca(ix);
  const rows: Resultado[] = [];
  for (const c of lista) {
    const existe = itens.some((it) => casa(it, c));
    const res: any[] = b.procurar({ q: c.q });
    const top = res[0];
    const top1 = top ? `${top.n} | ${top.b} ${top.m}` : '';
    const topItem = top ? itens[top.k] : undefined;
    let ok: boolean; let motivo: string;
    if (c.codigo) {
      ok = !!top && itens[top.k].o.split(' ').includes(c.codigo);
      motivo = ok ? 'acerto' : (res.length ? 'código não é o 1º' : 'sem resultado');
    } else if (existe) {
      ok = !!top && casa(topItem!, c);
      motivo = ok ? 'acerto' : (!res.length ? 'vazio, mas a peça existe' : 'a 1ª não é a peça pedida');
    } else {
      // não há a peça: não pode aparecer como achado; a parecida do tipo é aceita, com o aviso (aproximado)
      const tipoSo = { ...c, carro: undefined, lado: undefined };
      // parecida: o tipo no nome, ou a família do tipo (o sistema "s" ou o bloco "c" da peça tem a palavra)
      const tk = TIPOS.find((T) => T.re === c.tipo)?.tk;
      const naFamilia = !!topItem && !!tk && [topItem.n, topItem.s, topItem.c].some((t) => palavrasDo(t).some((x) => tk.test(x)));
      ok = !res.length || (!!topItem && (casa(topItem, tipoSo) || naFamilia) && !!b.aproximado);
      motivo = ok ? (res.length ? 'parecida (aviso)' : 'zero + pátio') : 'achado errado como certo';
    }
    const todas = res.map((r: any) => r.k as number);
    const certos10 = c.codigo || !existe ? [] : todas.slice(0, 10).filter((k) => casa(itens[k], c));
    rows.push({ q: c.q, grupo: c.grupo, existe, ok, motivo, top1, n: res.length, aprox: !!b.aproximado, todas, certos10 });
  }
  return { rows, itens };
}
