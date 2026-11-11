// "Bati o carro" (Raio-x, modo de batida): o cliente aponta ONDE o carro foi batido (8 pontos) e a lista do painel é o
// ORÇAMENTO DE CONSERTO daquela parte: as peças que costumam quebrar ali, na ordem de quem põe a mão na lataria.
// Cada linha é um filtro EXATO do catálogo (bloco + tipo, lado e posição do estoque: lib/busca.ts `filtrar`), contado
// pela mesma busca. Regra de lado: ponto ESQUERDO nunca lista peça do lado direito (l = 'D'), o DIREITO nunca a do
// esquerdo; ponto de frente nunca lista peça de trás (pos = 'T'). Linha sem tipo no estoque ("Capô": o estoque não tem
// esse tipo) é de PÁTIO: fica na lista, sem número, e vai no pedido como "para procurar no pátio".
// Sem node:fs e sem valores de lib/busca.ts: roda no build (pages/dados/batida.json.ts), no teste e no navegador.
import type { Filtros, Item, Lado, Posicao } from './busca';
import { codigoDaFoto } from './raioX';
import { anosDaPeca } from './nomePeca';
import { nomeModelos } from './meuCarro';

export type Linha = { nome: string; tipo?: string; sub?: string; lado?: Lado; pos?: Posicao };
export type Ponto = {
  k: string;
  /** o nome no painel e nas fichas ("Frente esquerda") */
  nome: string;
  /** onde fica o ponto na arte (pixels de raio-x.webp, 1536×1024) */
  ancora: [number, number];
  /** a área que acende (polígonos em pixels da arte, o mesmo sistema de lib/raioX.ts) */
  poligonos: string[];
  /** o lado do ponto ('E' ou 'D'; sem lado = centro) e a posição ('D' frente, 'T' traseira): guarda do estoque */
  lado?: Lado;
  pos?: Posicao;
  linhas: Linha[];
};

/** A peça como o painel e a mensagem precisam dela (o mínimo, para o JSON pequeno de cada ponto). */
export type Rep = { id: string; n: string; carro: string; anos: string; cod: string; p: number; h: string; f: string };
export type LinhaKit = Linha & { n: number; rep: Rep | null };
export type KitPonto = { k: string; nome: string; n: number; linhas: LinhaKit[] };

/** A lista de um ponto: 8 pontos da arte. As linhas de cada um seguem a ordem de uma oficina (o que sai primeiro, depois
 *  o que vem junto). Sem tipo de estoque = pátio. */
const PARA_CHOQUES = 'Para-choques e Lataria';
const FAROIS = 'Faróis e Lanternas';
const ARREF = 'Arrefecimento';
const ACAB = 'Acabamentos e Forros';
const LAV = 'Limpador e Lavador';
const MAC = 'Maçanetas e Fechaduras';
const ELET = 'Módulos e Elétrica';
const AC = 'Ar-condicionado';
const PATIO = (nome: string): Linha => ({ nome });

/** a frente do carro, do lado (E/D) e a do centro: a mesma lista de peças da frente, com o lado do ponto */
const frenteDoLado = (L: 'E' | 'D'): Linha[] => [
  { nome: 'Farol ' + (L === 'E' ? 'esquerdo' : 'direito'), tipo: FAROIS, sub: 'Faróis', lado: L },
  { nome: 'Para-choque dianteiro', tipo: PARA_CHOQUES, sub: 'Para-choques', pos: 'D' },
  { nome: 'Para-lama ' + (L === 'E' ? 'esquerdo' : 'direito'), tipo: PARA_CHOQUES, sub: 'Para-lamas', lado: L },
  { nome: 'Grade do para-choque', tipo: PARA_CHOQUES, sub: 'Grades do Para-choque', pos: 'D' },
  PATIO('Capô'),
  { nome: 'Suporte do para-choque (alma)', tipo: PARA_CHOQUES, sub: 'Almas do Para-choque', pos: 'D' },
  { nome: 'Painel frontal (suporte do radiador)', tipo: ARREF, sub: 'Suportes do Radiador' },
  { nome: 'Radiador', tipo: ARREF, sub: 'Radiadores' },
  { nome: 'Condensador do ar-condicionado', tipo: AC, sub: 'Condensadores' },
  { nome: 'Eletroventilador', tipo: ARREF, sub: 'Eletroventiladores' },
  { nome: 'Farol de milha ' + (L === 'E' ? 'esquerdo' : 'direito'), tipo: FAROIS, sub: 'Faróis de Milha', lado: L },
  { nome: 'Guia do para-choque', tipo: PARA_CHOQUES, sub: 'Guias e Suportes do Para-choque', lado: L, pos: 'D' },
  { nome: 'Reservatório do limpador', tipo: LAV, sub: 'Reservatórios do Lavador' },
  { nome: 'Forro do para-lama', tipo: ACAB, sub: 'Molduras do Para-lama', lado: L },
];

/** A lateral (porta) do lado: a mesma lista para os dois lados, só o lado muda. */
const lateralDoLado = (L: 'E' | 'D'): Linha[] => [
  { nome: 'Retrovisor externo', tipo: 'Retrovisores', sub: 'Retrovisores Externos', lado: L },
  { nome: 'Maçaneta externa', tipo: MAC, sub: 'Maçanetas das Portas', lado: L },
  { nome: 'Fechadura da porta', tipo: MAC, sub: 'Fechaduras das Portas', lado: L },
  { nome: 'Vidro elétrico', tipo: 'Vidro Elétrico', lado: L },
  { nome: 'Porta', tipo: PARA_CHOQUES, sub: 'Portas', lado: L },
  { nome: 'Dobradiça da porta', tipo: PARA_CHOQUES, sub: 'Dobradiças e Limitadores de Porta', lado: L },
  { nome: 'Moldura da porta', tipo: ACAB, sub: 'Molduras das Portas', lado: L },
  { nome: 'Soleira', tipo: ACAB, sub: 'Soleiras', lado: L },
  { nome: 'Forro da porta', tipo: ACAB, sub: 'Forros', lado: L },
  { nome: 'Molduras laterais', tipo: ACAB, sub: 'Molduras Laterais', lado: L },
  { nome: 'Chicote da porta', tipo: ELET, sub: 'Chicotes Elétricos', lado: L },
  { nome: 'Botão da trava elétrica', tipo: MAC, sub: 'Botões da Trava Elétrica', lado: L },
  { nome: 'Maçaneta interna', tipo: MAC, sub: 'Maçanetas Internas', lado: L },
];

/** A traseira: lanterna, para-choque e a tampa (o porta-malas), do lado (E/D) ou do centro. */
const traseiraDoLado = (L?: 'E' | 'D'): Linha[] => {
  const lado = L ? { lado: L } : {};
  return [
    { nome: 'Lanterna traseira' + (L ? (L === 'E' ? ' esquerda' : ' direita') : ''), tipo: FAROIS, sub: 'Lanternas Traseiras', pos: 'T', ...lado },
    { nome: 'Para-choque traseiro', tipo: PARA_CHOQUES, sub: 'Para-choques', pos: 'T', ...lado },
    { nome: 'Guia do para-choque traseiro', tipo: PARA_CHOQUES, sub: 'Guias e Suportes do Para-choque', pos: 'T', ...lado },
    { nome: 'Amortecedor da tampa', tipo: PARA_CHOQUES, sub: 'Amortecedores da Tampa e do Capô', pos: 'T', ...lado },
    { nome: 'Dobradiça da tampa', tipo: PARA_CHOQUES, sub: 'Dobradiças da Tampa Traseira', pos: 'T', ...lado },
    { nome: 'Acabamento da tampa', tipo: ACAB, sub: 'Acabamentos da Tampa Traseira', pos: 'T', ...lado },
    { nome: 'Refletor', tipo: FAROIS, sub: 'Refletores', ...lado },
    { nome: 'Tampão do porta-malas', tipo: ACAB, sub: 'Tampões do Porta-malas', ...lado },
    ...(L ? [] : [
      { nome: 'Luz da placa', tipo: FAROIS, sub: 'Luzes de Placa', pos: 'T' as Posicao },
      { nome: 'Suporte da placa', tipo: PARA_CHOQUES, sub: 'Suportes da Placa', pos: 'T' as Posicao },
      { nome: 'Limpador traseiro', tipo: LAV, sub: 'Motores do Limpador', pos: 'T' as Posicao },
      { nome: 'Câmera de ré', tipo: ELET, sub: 'Câmeras de Ré' },
      { nome: 'Sensor de estacionamento', tipo: ELET, sub: 'Sensores de Estacionamento', pos: 'T' as Posicao },
      { nome: 'Aerofólio', tipo: PARA_CHOQUES, sub: 'Aerofólios', pos: 'T' as Posicao },
      { nome: 'Fechadura do porta-malas', tipo: MAC, sub: 'Fechaduras do Porta-malas' },
      PATIO('Tampa traseira'),
    ]),
  ];
};

// Polígonos: os da arte (lib/raioX.ts) para as laterais; a frente e a traseira repartidas em 3 partes cada uma (perto,
// longe e o meio), medidas sobre raio-x.webp. Só para o acender e o toque; o ponto (ancora) é o que se vê.
export const PONTOS: Ponto[] = [
  { k: 'frente', nome: 'Frente', ancora: [250, 590], poligonos: ['205,440 300,470 440,430 440,700 300,675 200,650'], linhas: frenteDoLado('E').filter((l) => !l.lado) },
  { k: 'frente-esquerda', nome: 'Frente esquerda', ancora: [330, 745], lado: 'E', pos: 'D', poligonos: ['240,650 440,700 440,720 405,800 360,1024 250,1024 230,820'], linhas: frenteDoLado('E') },
  { k: 'frente-direita', nome: 'Frente direita', ancora: [330, 430], lado: 'D', pos: 'D', poligonos: ['0,0 440,0 440,430 300,470 205,440 170,0'], linhas: frenteDoLado('D') },
  { k: 'lateral-esquerda', nome: 'Lateral esquerda', ancora: [860, 610], lado: 'E', poligonos: ['590,600 680,515 800,500 1210,395 1230,440 1200,480 1150,530 1070,590 900,628 700,660 650,690'], linhas: lateralDoLado('E') },
  { k: 'lateral-direita', nome: 'Lateral direita', ancora: [720, 300], lado: 'D', poligonos: ['440,0 1300,0 1290,140 1235,185 1150,122 700,190 610,282 470,312'], linhas: lateralDoLado('D') },
  { k: 'traseira', nome: 'Traseira', ancora: [1355, 520], pos: 'T', poligonos: ['1330,470 1536,470 1536,640 1340,640 1335,560'], linhas: traseiraDoLado() },
  { k: 'traseira-esquerda', nome: 'Traseira esquerda', ancora: [1262, 610], lado: 'E', pos: 'T', poligonos: ['1340,640 1536,640 1536,1024 1340,1024'], linhas: traseiraDoLado('E') },
  { k: 'traseira-direita', nome: 'Traseira direita', ancora: [1280, 260], lado: 'D', pos: 'T', poligonos: ['1290,0 1536,0 1536,470 1330,470 1235,185 1290,140'], linhas: traseiraDoLado('D') },
];

/** O item do catálogo como a lista precisa: o nome limpo, o carro, os anos, o código, o preço e o endereço. */
export function repDe(it: Item, fotoDe: (it: Item) => string): Rep {
  return {
    id: it.id,
    n: it.n,
    carro: nomeModelos(it),
    anos: anosDaPeca(it.y, ' a '),
    cod: it.i || '',
    p: it.p,
    h: it.h,
    f: codigoDaFoto(fotoDe(it)),
  };
}

/** As peças de UMA linha do ponto, pela busca do catálogo (`procurar` = Busca.procurar). A linha pede o lado e a posição
 *  dela (o catálogo filtra); a guarda do ponto tira a peça do lado ou da posição OPOSTA (a que tem o campo "l" ou "pos"
 *  dizendo o contrário). Linha de pátio (sem tipo no estoque) = nenhuma peça. */
export function itensDaLinha(p: Ponto, l: Linha, procurar: (f: Filtros) => Item[], carro: CarroBatida = {}): Item[] {
  if (!l.tipo) return [];
  return procurar({ ...carro, tipo: l.tipo, sub: l.sub, lado: l.lado, pos: l.pos, ordem: 'novos' })
    .filter((it) => !(p.lado && it.l && it.l !== p.lado))
    .filter((it) => !(p.pos && it.pos === (p.pos === 'D' ? 'T' : 'D')));
}
/** O carro do filtro (marca, modelo e ano opcional): o mesmo do catálogo. */
export type CarroBatida = Partial<Pick<Filtros, 'marca' | 'modelo' | 'ano'>>;

/** Uma linha sem subtipo (o bloco inteiro, ex. "Vidro elétrico") conta o tipo todo do lado. */
/** Um ponto contado: cada linha com o número de peças (sem repetir entre as linhas do ponto, no total) e a mais barata. */
export function kitDoPonto(p: Ponto, procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string, carro: CarroBatida = {}): KitPonto {
  const ids = new Set<string>();
  const linhas: LinhaKit[] = p.linhas.map((l) => {
    const itens = itensDaLinha(p, l, procurar, carro);
    for (const it of itens) ids.add(it.id);
    // a peça mais barata da linha: é a que aparece e a que entra no total (o link leva à linha inteira)
    const rep = itens.reduce<Item | null>((m, it) => (!m || it.p < m.p ? it : m), null);
    return { ...l, n: itens.length, rep: rep ? repDe(rep, fotoDe) : null };
  });
  return { k: p.k, nome: p.nome, n: ids.size, linhas };
}

/** Os 8 pontos de uma vez (o JSON do build e o da página do carro). */
export function kitsDeTodos(procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string, carro: CarroBatida = {}): KitPonto[] {
  return PONTOS.map((p) => kitDoPonto(p, procurar, fotoDe, carro));
}

/** O total do pedido: a soma das peças marcadas (o site e o WhatsApp, com o desconto de lib/whats.ts). As linhas de pátio
 *  e as sem peça no estoque não entram. */
export function pedidoDe(linhas: readonly LinhaKit[], marcadas: ReadonlySet<number>): { itens: { nome: string; rep: Rep }[]; patio: string[] } {
  const itens: { nome: string; rep: Rep }[] = [];
  const patio: string[] = [];
  linhas.forEach((l, i) => {
    if (!marcadas.has(i)) return;
    if (l.rep) itens.push({ nome: l.nome, rep: l.rep });
    else patio.push(l.nome);
  });
  return { itens, patio };
}
