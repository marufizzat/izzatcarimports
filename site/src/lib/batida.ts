// "Bati o carro" (Raio-x, modo de batida): o cliente aponta ONDE o carro foi batido (8 pontos) e a lista do painel é o
// ORÇAMENTO DE CONSERTO daquela parte: as peças que costumam quebrar ali, na ordem de quem põe a mão na lataria.
// Cada linha é um filtro do catálogo (bloco + tipo, e o lado/posição quando a peça só existe com eles: lib/busca.ts
// `filtrar`), contado pela mesma busca. Regras:
// - LADO: peça que vem em par (farol, para-lama, porta, retrovisor, lanterna…) é pedida com o lado do ponto; a que não
//   tem lado (para-choque, radiador, alma) entra sem ele, e a GUARDA do ponto tira só a que DIZ o lado oposto. Ponto
//   esquerdo nunca lista peça direita (l = 'D'), o direito nunca a esquerda.
// - POSIÇÃO: "Para-choques" e "Lanternas" são pedidos com a posição; tipo que o estoque quase nunca escreve com
//   "dianteiro" (grade, alma, guia: "Absorvedor impacto", "Tampa grade churrasqueira") entra sem ela, e a guarda tira o
//   que DIZ a posição oposta. Ponto de frente nunca lista peça de trás, o de trás nunca a da frente.
// - PÁTIO: linha sem tipo no estoque ("Capô", "Tampa traseira": o estoque não tem esse tipo) fica na lista, sem número,
//   e vai no pedido como "para procurar no pátio".
// - EXTRA: a peça pequena que vem junto (dobradiça, emblema, defletor) só aparece quando há no estoque; as PRINCIPAIS
//   aparecem sempre (sem estoque: "a gente procura no pátio").
// O desmanche vende peça pequena muito mais que lataria grande: 8 faróis e 5 para-choques no estoque inteiro (nov/2026).
// Kit curto na frente é o estoque de verdade, não falta de linha.
// Sem node:fs e sem valores de lib/busca.ts: roda no build (pages/dados/batida.json.ts), no teste e no navegador.
import type { Filtros, Item, Lado, Posicao } from './busca';
import { codigoDaFoto, linkLinha } from './raioX';
import { anosTexto } from './whats';
import { nomeModelos } from './meuCarro';
import { codigoPeca } from '../components/catalogo/etiqueta';

export type Linha = {
  /** o nome na lista, do jeito que a oficina fala ("Farol esquerdo", "Alma do para-choque") */
  nome: string;
  tipo?: string; sub?: string; lado?: Lado; pos?: Posicao;
  /** só aparece quando há peça no estoque (sem ela, a lista não ganha uma linha de pátio) */
  extra?: boolean;
};
export type Ponto = {
  k: string;
  /** o nome no painel, nas etiquetas e nas fichas ("Frente esquerda") */
  nome: string;
  /** na frase e na mensagem: "Batida na frente esquerda" */
  em: string;
  /** onde fica o ponto na arte (pixels de raio-x.webp, 1536×1024): no lugar de verdade; o do lado de lá, na borda visível */
  ancora: [number, number];
  /** a etiqueta da arte larga (640+ px), no fundo do estúdio, com a linha-guia até o ponto */
  etiqueta: [number, number];
  /** a área de toque na arte (polígonos em pixels; o resto do toque é o próprio ponto) */
  toque: string[];
  /** o que acende: a parte batida (o mesmo véu laranja das zonas) */
  realce: string[];
  /** o lado do ponto ('E' ou 'D'; sem lado = centro) e a posição ('D' frente, 'T' traseira): a guarda do estoque */
  lado?: Lado;
  pos?: Posicao;
  linhas: Linha[];
};

/** A peça como o painel e a mensagem precisam dela (o mínimo, para o JSON pequeno de cada ponto). */
export type Rep = { id: string; n: string; carro: string; anos: string; cod: string; p: number; h: string; f: string };
export type LinhaKit = Linha & { n: number; rep: Rep | null };
export type KitPonto = { k: string; nome: string; n: number; linhas: LinhaKit[] };

const LATARIA = 'Para-choques e Lataria';
const FAROIS = 'Faróis e Lanternas';
const ARREF = 'Arrefecimento';
const ACAB = 'Acabamentos e Forros';
const LAV = 'Limpador e Lavador';
const MAC = 'Maçanetas e Fechaduras';
const ELET = 'Módulos e Elétrica';
const VIDRO = 'Vidro Elétrico';
const PATIO = (nome: string): Linha => ({ nome });
const X = { extra: true } as const;
const lado = (L: Lado) => (L === 'E' ? 'esquerdo' : 'direito');
const ladoA = (L: Lado) => (L === 'E' ? 'esquerda' : 'direita');

/** A frente: do centro (sem lado: os dois faróis, sem para-lama) ou de um canto (o farol e o para-lama do lado). Na
 *  ordem da oficina: o que sai primeiro (para-choque, grade, farol), a lataria, e o que fica atrás (radiadores). */
const frente = (L?: Lado): Linha[] => [
  { nome: 'Para-choque dianteiro', tipo: LATARIA, sub: 'Para-choques', pos: 'D' },
  { nome: 'Grade', tipo: LATARIA, sub: 'Grades do Para-choque' },
  { nome: 'Grade do capô', tipo: LATARIA, sub: 'Grades', ...X },
  { nome: 'Emblema da grade', tipo: LATARIA, sub: 'Emblemas', ...X },
  ...(L ? [L] : (['E', 'D'] as Lado[])).map((l): Linha => ({ nome: `Farol ${lado(l)}`, tipo: FAROIS, sub: 'Faróis', lado: l })),
  { nome: 'Suporte do farol', tipo: FAROIS, sub: 'Suportes do Farol', lado: L, ...X },
  { nome: 'Farol de milha', tipo: FAROIS, sub: 'Faróis de Milha' },
  PATIO('Capô'),
  { nome: 'Dobradiça do capô', tipo: LATARIA, sub: 'Dobradiças do Capô', lado: L, ...X },
  { nome: 'Fechadura do capô', tipo: MAC, sub: 'Fechaduras do Capô', ...X },
  ...(L ? [
    { nome: `Para-lama ${lado(L)}`, tipo: LATARIA, sub: 'Para-lamas', lado: L },
    { nome: 'Suporte do para-lama', tipo: LATARIA, sub: 'Suportes da Carroceria', lado: L, ...X },
    { nome: 'Moldura do para-lama', tipo: ACAB, sub: 'Molduras do Para-lama', lado: L, ...X },
    { nome: 'Para-barro', tipo: LATARIA, sub: 'Para-barros', lado: L, ...X },
  ] as Linha[] : []),
  { nome: 'Guia do para-choque', tipo: LATARIA, sub: 'Guias e Suportes do Para-choque', lado: L, ...X },
  { nome: 'Alma do para-choque', tipo: LATARIA, sub: 'Almas do Para-choque' },
  { nome: 'Travessa de reforço', tipo: LATARIA, sub: 'Vigas de Reforço', pos: 'D', ...X },
  { nome: 'Painel frontal', tipo: ARREF, sub: 'Suportes do Radiador' },
  { nome: 'Radiador', tipo: ARREF, sub: 'Radiadores' },
  { nome: 'Condensador do ar-condicionado', tipo: 'Ar-condicionado', sub: 'Condensadores' },
  { nome: 'Intercooler', tipo: 'Filtro de Ar e Turbo', sub: 'Intercoolers', ...X },
  { nome: 'Eletroventilador', tipo: ARREF, sub: 'Eletroventiladores' },
  { nome: 'Defletor do radiador', tipo: ARREF, sub: 'Defletores', ...X },
  { nome: 'Reservatório do limpador', tipo: LAV, sub: 'Reservatórios do Lavador', ...X },
  { nome: 'Isolamento do capô', tipo: LATARIA, sub: 'Isolamentos do Capô', ...X },
];

/** A lateral (as portas) de um lado: tudo com o lado do ponto. */
const lateral = (L: Lado): Linha[] => [
  { nome: 'Porta', tipo: LATARIA, sub: 'Portas', lado: L },
  { nome: 'Retrovisor externo', tipo: 'Retrovisores', sub: 'Retrovisores Externos', lado: L },
  { nome: 'Capa do retrovisor', tipo: 'Retrovisores', sub: 'Capas e Molduras do Retrovisor', lado: L, ...X },
  { nome: 'Maçaneta externa', tipo: MAC, sub: 'Maçanetas das Portas', lado: L },
  { nome: 'Fechadura da porta', tipo: MAC, sub: 'Fechaduras das Portas', lado: L },
  { nome: 'Máquina do vidro elétrico', tipo: VIDRO, sub: 'Máquinas e Motores de Vidro Elétrico', lado: L },
  { nome: 'Vidro lateral', tipo: VIDRO, sub: 'Vidros Laterais', lado: L, ...X },
  { nome: 'Canaleta do vidro', tipo: VIDRO, sub: 'Guias e Canaletas do Vidro', lado: L, ...X },
  { nome: 'Forro da porta', tipo: ACAB, sub: 'Forros', lado: L },
  { nome: 'Dobradiça da porta', tipo: LATARIA, sub: 'Dobradiças e Limitadores de Porta', lado: L, ...X },
  { nome: 'Moldura da porta', tipo: ACAB, sub: 'Molduras das Portas', lado: L, ...X },
  { nome: 'Friso da porta', tipo: ACAB, sub: 'Frisos das Portas', lado: L, ...X },
  { nome: 'Soleira', tipo: ACAB, sub: 'Soleiras', lado: L, ...X },
  { nome: 'Moldura lateral', tipo: ACAB, sub: 'Molduras Laterais', lado: L, ...X },
  { nome: 'Spoiler lateral', tipo: LATARIA, sub: 'Spoilers', lado: L, ...X },
  { nome: 'Chicote da porta', tipo: ELET, sub: 'Chicotes Elétricos', lado: L, ...X },
  { nome: 'Botão do vidro', tipo: VIDRO, sub: 'Botões do Vidro Elétrico', lado: L, ...X },
  { nome: 'Maçaneta interna', tipo: MAC, sub: 'Maçanetas Internas', lado: L, ...X },
];

/** A traseira: do centro (as duas lanternas, a tampa e o que vai nela) ou de um canto (a lanterna e o canto do lado). */
const traseira = (L?: Lado): Linha[] => [
  { nome: 'Para-choque traseiro', tipo: LATARIA, sub: 'Para-choques', pos: 'T' },
  ...(L ? [L] : (['E', 'D'] as Lado[])).map((l): Linha => ({ nome: `Lanterna traseira ${ladoA(l)}`, tipo: FAROIS, sub: 'Lanternas Traseiras', lado: l, pos: 'T' })),
  PATIO('Tampa traseira'),
  { nome: 'Alma do para-choque traseiro', tipo: LATARIA, sub: 'Almas do Para-choque', pos: 'T' },
  { nome: 'Guia do para-choque traseiro', tipo: LATARIA, sub: 'Guias e Suportes do Para-choque', lado: L, pos: 'T' },
  { nome: 'Moldura do para-choque', tipo: LATARIA, sub: 'Molduras do Para-choque', pos: 'T', ...X },
  { nome: 'Refletor', tipo: FAROIS, sub: 'Refletores', lado: L, ...X },
  ...(L ? [
    { nome: 'Moldura do para-lama traseiro', tipo: ACAB, sub: 'Molduras do Para-lama', lado: L, pos: 'T', ...X },
    { nome: 'Para-barro traseiro', tipo: LATARIA, sub: 'Para-barros', lado: L, pos: 'T', ...X },
  ] as Linha[] : []),
  { nome: 'Amortecedor da tampa', tipo: LATARIA, sub: 'Amortecedores da Tampa e do Capô', pos: 'T', ...X },
  { nome: 'Dobradiça da tampa', tipo: LATARIA, sub: 'Dobradiças da Tampa Traseira', ...X },
  { nome: 'Fechadura do porta-malas', tipo: MAC, sub: 'Fechaduras do Porta-malas', ...(L ? X : {}) },
  { nome: 'Acabamento da tampa', tipo: ACAB, sub: 'Acabamentos da Tampa Traseira', ...X },
  ...(L ? [] : [
    { nome: 'Luz da placa', tipo: FAROIS, sub: 'Luzes de Placa', ...X },
    { nome: 'Luz de freio (brake light)', tipo: FAROIS, sub: 'Brake Light', ...X },
    { nome: 'Suporte da placa', tipo: LATARIA, sub: 'Suportes da Placa', pos: 'T', ...X },
    { nome: 'Aerofólio', tipo: LATARIA, sub: 'Aerofólios', ...X },
    { nome: 'Motor do limpador traseiro', tipo: LAV, sub: 'Motores do Limpador', pos: 'T', ...X },
    { nome: 'Câmera de ré', tipo: ELET, sub: 'Câmeras de Ré', ...X },
    { nome: 'Sensor de estacionamento', tipo: ELET, sub: 'Sensores de Estacionamento', pos: 'T', ...X },
  ] as Linha[]),
  { nome: 'Tampão do porta-malas', tipo: ACAB, sub: 'Tampões do Porta-malas', ...X },
];

// A arte (raio-x.webp, 1536×1024): o carro olha para a esquerda e é visto de cima, pelo lado do MOTORISTA. A frente
// aparece de frente (x 180–440); o lado esquerdo é a borda de baixo do carro; o direito, a de cima (a linha do teto e o
// retrovisor de lá); a traseira é a borda direita (x 1290–1392). Pontos e polígonos medidos sobre a arte e conferidos
// com a arte por baixo (prints/batida-poligonos.png). Etiquetas: a faixa de cima (y 62) para o lado de lá, a de baixo
// (y 965) para o lado de cá, "Frente" e "Traseira" ao lado do ponto, no fundo do estúdio.
export const PONTOS: Ponto[] = [
  {
    k: 'frente', nome: 'Frente', em: 'na frente', ancora: [238, 628], etiqueta: [84, 628], pos: 'D',
    toque: ['0,545 235,545 300,500 300,675 285,715 0,715'],
    realce: ['184,522 232,486 300,512 304,676 288,716 262,812 204,748 180,622'],
    linhas: frente(),
  },
  {
    k: 'frente-esquerda', nome: 'Frente esquerda', em: 'na frente esquerda', ancora: [346, 772], etiqueta: [300, 965], lado: 'E', pos: 'D',
    toque: ['0,715 285,715 300,675 440,700 480,640 560,620 600,640 640,700 660,820 640,1024 0,1024'],
    realce: ['288,690 440,696 470,640 520,648 506,700 436,744 406,798 372,838 300,838 262,812'],
    linhas: frente('E'),
  },
  {
    k: 'frente-direita', nome: 'Frente direita', em: 'na frente direita', ancora: [206, 458], etiqueta: [196, 62], lado: 'D', pos: 'D',
    toque: ['0,0 430,0 430,330 300,400 300,500 235,545 0,545'],
    realce: ['186,516 198,440 252,398 330,368 384,356 372,398 300,430 236,486'],
    linhas: frente('D'),
  },
  {
    k: 'lateral-esquerda', nome: 'Lateral esquerda', em: 'na lateral esquerda', ancora: [880, 676], etiqueta: [860, 965], lado: 'E',
    toque: ['600,640 690,520 800,500 1210,395 1235,440 1150,548 1085,600 1075,770 1060,1024 640,1024 660,820 640,700'],
    realce: ['606,602 690,524 792,516 1204,404 1226,446 1112,560 1104,700 664,780 650,690'],
    linhas: lateral('E'),
  },
  {
    k: 'lateral-direita', nome: 'Lateral direita', em: 'na lateral direita', ancora: [800, 190], etiqueta: [760, 62], lado: 'D',
    toque: ['430,0 1150,0 1150,140 700,208 610,300 430,345'],
    realce: ['472,314 536,252 544,206 590,198 602,262 700,186 1150,118 1292,168 1302,204 1150,152 702,216 612,292'],
    linhas: lateral('D'),
  },
  {
    k: 'traseira', nome: 'Traseira', em: 'na traseira', ancora: [1388, 452], etiqueta: [1442, 770], pos: 'T',
    toque: ['1300,470 1235,440 1250,330 1330,300 1536,300 1536,560 1340,520'],
    realce: ['1300,300 1372,300 1392,420 1386,548 1352,580 1322,470'],
    linhas: traseira(),
  },
  {
    k: 'traseira-esquerda', nome: 'Traseira esquerda', em: 'na traseira esquerda', ancora: [1336, 604], etiqueta: [1296, 965], lado: 'E', pos: 'T',
    toque: ['1085,600 1150,548 1235,440 1300,470 1340,520 1536,560 1536,1024 1060,1024 1075,770'],
    realce: ['1212,402 1322,372 1352,470 1352,600 1310,614 1296,560 1210,470'],
    linhas: traseira('E'),
  },
  {
    k: 'traseira-direita', nome: 'Traseira direita', em: 'na traseira direita', ancora: [1318, 232], etiqueta: [1290, 62], lado: 'D', pos: 'T',
    toque: ['1150,0 1536,0 1536,300 1330,300 1250,330 1235,185 1150,122'],
    realce: ['1236,188 1296,176 1340,226 1372,300 1318,300 1280,246 1232,262'],
    linhas: traseira('D'),
  },
];

/** "Girar o carro": os pontos que, em cada vista da arte, ficam do OUTRO lado (escolher um deles gira o carro sozinho).
 *  Na vista de trás (lib/raioXTras.ts: PONTOS_TRAS) a traseira, a traseira direita e a lateral direita caem no lugar de
 *  verdade; a frente direita e a traseira esquerda aparecem nas duas vistas. */
export const PONTOS_DO_OUTRO_LADO: Record<'frente' | 'tras', readonly string[]> = {
  frente: ['lateral-direita', 'traseira', 'traseira-direita'],
  tras: ['frente', 'frente-esquerda', 'lateral-esquerda'],
};

/** O item do catálogo como a lista precisa: o nome limpo, o carro, os anos, o código, o preço e o endereço. */
export function repDe(it: Item, fotoDe: (it: Item) => string): Rep {
  return {
    id: it.id,
    n: it.n,
    carro: nomeModelos(it),
    // "2018 a 2024" (anosTexto de lib/whats.ts; lib/nomePeca.ts puxa o node:fs e não roda no navegador)
    anos: anosTexto(it.y),
    // o código gravado na peça (campo "o"); o "i" é a chave da FOTO do anúncio (ia parar na mensagem como código)
    cod: codigoPeca(it.o),
    p: it.p,
    h: it.h,
    f: codigoDaFoto(fotoDe(it)),
  };
}

/** O carro do filtro (marca, modelo e ano opcional): o mesmo do catálogo. */
export type CarroBatida = Partial<Pick<Filtros, 'marca' | 'modelo' | 'ano'>>;

/** Os filtros do catálogo de uma linha (os do link "ver no catálogo"). */
export const filtrosDaLinha = (l: Linha, carro: CarroBatida = {}): Filtros =>
  ({ ...carro, tipo: l.tipo, sub: l.sub, lado: l.lado, pos: l.pos, ordem: 'asc' });

/** As peças de UMA linha do ponto, pela busca do catálogo (`procurar` = Busca.procurar), da mais barata para a mais
 *  cara (a 1ª é a que a lista mostra; o "trocar" passa pelas outras). A linha pede o lado e a posição dela (o catálogo
 *  filtra); a guarda do ponto tira a peça que DIZ o lado ou a posição oposta. Linha de pátio (sem tipo) = nenhuma peça. */
export function itensDaLinha(p: Ponto, l: Linha, procurar: (f: Filtros) => Item[], carro: CarroBatida = {}): Item[] {
  if (!l.tipo) return [];
  return procurar(filtrosDaLinha(l, carro))
    .filter((it) => !(p.lado && it.l && it.l !== p.lado))
    .filter((it) => !(p.pos && it.pos === (p.pos === 'D' ? 'T' : 'D')))
    .sort((a, b) => a.p - b.p || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Um ponto com as peças de cada linha (no navegador, com o carro: a lista e o "trocar"). As linhas EXTRA sem peça
 *  ficam de fora; as principais sem peça ficam (pátio). */
export function opcoesDoPonto(p: Ponto, procurar: (f: Filtros) => Item[], carro: CarroBatida = {}): { linha: Linha; itens: Item[] }[] {
  return p.linhas.map((linha) => ({ linha, itens: itensDaLinha(p, linha, procurar, carro) })).filter((x) => x.itens.length > 0 || !x.linha.extra);
}

/** Um ponto contado: cada linha com o número de peças e a mais barata (a que aparece e entra no total); o total do ponto
 *  é sem repetir. As linhas EXTRA sem peça ficam de fora. */
export function kitDoPonto(p: Ponto, procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string, carro: CarroBatida = {}): KitPonto {
  const ids = new Set<string>();
  const linhas: LinhaKit[] = opcoesDoPonto(p, procurar, carro).map(({ linha, itens }) => {
    for (const it of itens) ids.add(it.id);
    return { ...linha, n: itens.length, rep: itens.length ? repDe(itens[0], fotoDe) : null };
  });
  return { k: p.k, nome: p.nome, n: ids.size, linhas };
}

/** Os 8 pontos de uma vez (o JSON do build). */
export function kitsDeTodos(procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string, carro: CarroBatida = {}): KitPonto[] {
  return PONTOS.map((p) => kitDoPonto(p, procurar, fotoDe, carro));
}

/** O pedido: das linhas MARCADAS, as que têm peça viram itens (a peça que a linha mostra); as sem peça (pátio) viram a
 *  lista "para procurar no pátio". Linha não marcada não entra em nada. */
export function pedidoDe<T extends { nome: string; rep: Rep | null }>(linhas: readonly T[], marcadas: ReadonlySet<number>): { itens: { nome: string; rep: Rep }[]; patio: string[] } {
  const itens: { nome: string; rep: Rep }[] = [];
  const patio: string[] = [];
  linhas.forEach((l, i) => {
    if (!marcadas.has(i)) return;
    if (l.rep) itens.push({ nome: l.nome, rep: l.rep });
    else patio.push(l.nome);
  });
  return { itens, patio };
}

/** O catálogo filtrado na linha (tipo + sub + lado/posição da LINHA + o carro: linkLinha de lib/raioX.ts). A guarda do
 *  ponto não cabe no endereço: numa linha sem lado, o catálogo pode mostrar também a peça do outro lado. Linha de pátio
 *  (sem tipo): o catálogo do carro. */
export function linkDaLinha(l: Linha, carro: CarroBatida = {}): string {
  if (l.tipo && l.sub) return linkLinha({ tipo: l.tipo, sub: l.sub, lado: l.lado, pos: l.pos }, carro);
  const u = new URLSearchParams();
  if (carro.marca) u.set('marca', carro.marca);
  if (carro.modelo) u.set('modelo', carro.modelo);
  if (carro.ano) u.set('ano', String(carro.ano));
  return `/catalogo.html?${u.toString()}`;
}
