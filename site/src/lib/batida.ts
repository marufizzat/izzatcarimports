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
// - A PEÇA DA LINHA (revisão 15, P1-2): o tipo do estoque junta a peça e os acessórios dela ("Maçanetas das Portas" tem
//   maçaneta, suporte, moldura e cabo; "Forros" tem forro de porta e de porta-malas). A linha diz qual nome É a peça
//   (`eh`: a 1ª palavra do nome, como o "tipo" da busca) e a ordem é: primeiro as que SÃO a peça da linha, depois as
//   outras do tipo, a mais barata na frente em cada grupo. Linha cuja 1ª peça não é a do título nunca nasce marcada: o
//   título vai para o pátio e a peça ligada fica em "Também costuma ir junto" (`linhasDoPainel`, `marcadasDeInicio`).
// O desmanche vende peça pequena muito mais que lataria grande: 8 faróis e 5 para-choques no estoque inteiro (nov/2026).
// Kit curto na frente é o estoque de verdade, não falta de linha.
// Sem node:fs e sem valores de lib/busca.ts: roda no build (pages/dados/batida.json.ts), no teste e no navegador.
import type { Filtros, Item, Lado, Posicao } from './busca';
import { codigoDaFoto, linkLinha, nomeEh, type Eh } from './raioX';
import { anosTexto } from './whats';
import { nomeModelos } from './meuCarro';
import { codigoPeca } from '../components/catalogo/etiqueta';

export type { Eh };
export type Linha = {
  /** o nome na lista, do jeito que a oficina fala ("Farol esquerdo", "Alma do para-choque") */
  nome: string;
  tipo?: string; sub?: string; lado?: Lado; pos?: Posicao;
  /** o nome da peça que a linha promete (toda linha com tipo tem; linha de pátio não) */
  eh?: Eh | Eh[];
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
/** `certa`: a peça que a linha mostra (a 1ª) É a do título da linha (`ehDaLinha`); sem peça = false. */
export type LinhaKit = Linha & { n: number; rep: Rep | null; certa: boolean };
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
  { nome: 'Para-choque dianteiro', tipo: LATARIA, sub: 'Para-choques', pos: 'D', eh: { cab: 'para-choque' } },
  { nome: 'Grade', tipo: LATARIA, sub: 'Grades do Para-choque', eh: { cab: 'grade churrasqueira' } },
  { nome: 'Grade do capô', tipo: LATARIA, sub: 'Grades', ...X, eh: { cab: 'grade' } },
  { nome: 'Emblema da grade', tipo: LATARIA, sub: 'Emblemas', ...X, eh: { cab: 'emblema' } },
  ...(L ? [L] : (['E', 'D'] as Lado[])).map((l): Linha => ({ nome: `Farol ${lado(l)}`, tipo: FAROIS, sub: 'Faróis', lado: l, eh: { cab: 'farol', sem: 'milha neblina' } })),
  { nome: 'Suporte do farol', tipo: FAROIS, sub: 'Suportes do Farol', lado: L, ...X, eh: { cab: 'suporte', tem: 'farol' } },
  { nome: 'Farol de milha', tipo: FAROIS, sub: 'Faróis de Milha', eh: { cab: 'farol milha', tem: 'milha neblina' } },
  PATIO('Capô'),
  { nome: 'Dobradiça do capô', tipo: LATARIA, sub: 'Dobradiças do Capô', lado: L, ...X, eh: { cab: 'dobradica' } },
  { nome: 'Fechadura do capô', tipo: MAC, sub: 'Fechaduras do Capô', ...X, eh: { cab: 'fechadura trava' } },
  ...(L ? [
    { nome: `Para-lama ${lado(L)}`, tipo: LATARIA, sub: 'Para-lamas', lado: L, eh: { cab: 'para-lama' } },
    { nome: 'Suporte do para-lama', tipo: LATARIA, sub: 'Suportes da Carroceria', lado: L, ...X, eh: { cab: 'suporte', tem: 'para-lama' } },
    { nome: 'Moldura do para-lama', tipo: ACAB, sub: 'Molduras do Para-lama', lado: L, ...X, eh: { cab: 'moldura', tem: 'para-lama' } },
    { nome: 'Para-barro', tipo: LATARIA, sub: 'Para-barros', lado: L, ...X, eh: { cab: 'para-barro' } },
  ] as Linha[] : []),
  { nome: 'Guia do para-choque', tipo: LATARIA, sub: 'Guias e Suportes do Para-choque', lado: L, ...X, eh: { cab: 'guia suporte', tem: 'para-choque' } },
  { nome: 'Alma do para-choque', tipo: LATARIA, sub: 'Almas do Para-choque', eh: { cab: 'alma', tem: 'para-choque' } },
  { nome: 'Travessa de reforço', tipo: LATARIA, sub: 'Vigas de Reforço', pos: 'D', ...X, eh: { cab: 'travessa barra viga reforco' } },
  // o painel frontal é a peça inteira (sem lado): o suporte de um lado, o coxim e a plaquinha são peça ligada
  { nome: 'Painel frontal', tipo: ARREF, sub: 'Suportes do Radiador', eh: [{ cab: 'painel', tem: 'frontal dianteiro radiador' },
    { cab: 'suporte travessa', tem: 'radiador travessa', sem: 'esquerdo direito esquerda direita coxim braco placa inferior superior lateral' }] },
  { nome: 'Radiador', tipo: ARREF, sub: 'Radiadores', eh: { cab: 'radiador' } },
  { nome: 'Condensador do ar-condicionado', tipo: 'Ar-condicionado', sub: 'Condensadores', eh: { cab: 'condensador radiador', tem: 'condensador' } },
  { nome: 'Intercooler', tipo: 'Filtro de Ar e Turbo', sub: 'Intercoolers', ...X, eh: { cab: 'intercooler' } },
  { nome: 'Eletroventilador', tipo: ARREF, sub: 'Eletroventiladores', eh: { cab: 'eletroventilador ventoinha' } },
  { nome: 'Defletor do radiador', tipo: ARREF, sub: 'Defletores', ...X, eh: { cab: 'defletor' } },
  { nome: 'Reservatório do limpador', tipo: LAV, sub: 'Reservatórios do Lavador', ...X, eh: { cab: 'reservatorio' } },
  { nome: 'Isolamento do capô', tipo: LATARIA, sub: 'Isolamentos do Capô', ...X, eh: { cab: 'isolamento manta forro', tem: 'capo' } },
];

/** A lateral (as portas) de um lado: tudo com o lado do ponto. */
const lateral = (L: Lado): Linha[] => [
  { nome: 'Porta', tipo: LATARIA, sub: 'Portas', lado: L, eh: { cab: 'porta' } },
  { nome: 'Retrovisor externo', tipo: 'Retrovisores', sub: 'Retrovisores Externos', lado: L, eh: { cab: 'retrovisor', sem: 'interno' } },
  { nome: 'Capa do retrovisor', tipo: 'Retrovisores', sub: 'Capas e Molduras do Retrovisor', lado: L, ...X, eh: { cab: 'capa', tem: 'retrovisor espelho', sem: 'interno interna' } },
  { nome: 'Maçaneta externa', tipo: MAC, sub: 'Maçanetas das Portas', lado: L, eh: { cab: 'macaneta', sem: 'interna interno tampa porta-malas camera' } },
  { nome: 'Fechadura da porta', tipo: MAC, sub: 'Fechaduras das Portas', lado: L, eh: { cab: 'fechadura trava', sem: 'tampa porta-malas capo banco' } },
  { nome: 'Máquina do vidro elétrico', tipo: VIDRO, sub: 'Máquinas e Motores de Vidro Elétrico', lado: L, eh: { cab: 'maquina motor' } },
  { nome: 'Vidro lateral', tipo: VIDRO, sub: 'Vidros Laterais', lado: L, ...X, eh: { cab: 'vidro' } },
  { nome: 'Canaleta do vidro', tipo: VIDRO, sub: 'Guias e Canaletas do Vidro', lado: L, ...X, eh: { cab: 'canaleta guia' } },
  { nome: 'Forro da porta', tipo: ACAB, sub: 'Forros', lado: L, eh: { cab: 'forro', tem: 'porta', sem: 'porta-malas bagagito tampa' } },
  { nome: 'Dobradiça da porta', tipo: LATARIA, sub: 'Dobradiças e Limitadores de Porta', lado: L, ...X, eh: { cab: 'dobradica' } },
  { nome: 'Moldura da porta', tipo: ACAB, sub: 'Molduras das Portas', lado: L, ...X, eh: { cab: 'moldura', tem: 'porta', sem: 'coluna' } },
  { nome: 'Friso da porta', tipo: ACAB, sub: 'Frisos das Portas', lado: L, ...X, eh: { cab: 'friso' } },
  { nome: 'Soleira', tipo: ACAB, sub: 'Soleiras', lado: L, ...X, eh: { cab: 'soleira', sem: 'porta-malas tampa' } },
  { nome: 'Moldura lateral', tipo: ACAB, sub: 'Molduras Laterais', lado: L, ...X, eh: { cab: 'moldura friso', tem: 'lateral', sem: 'porta-malas painel' } },
  { nome: 'Spoiler lateral', tipo: LATARIA, sub: 'Spoilers', lado: L, ...X, eh: { cab: 'spoiler' } },
  { nome: 'Chicote da porta', tipo: ELET, sub: 'Chicotes Elétricos', lado: L, ...X, eh: { cab: 'chicote', tem: 'porta' } },
  { nome: 'Botão do vidro', tipo: VIDRO, sub: 'Botões do Vidro Elétrico', lado: L, ...X, eh: { cab: 'botao botoneira comando interruptor', tem: 'vidro' } },
  { nome: 'Maçaneta interna', tipo: MAC, sub: 'Maçanetas Internas', lado: L, ...X, eh: { cab: 'macaneta', sem: 'tampa porta-malas' } },
];

/** A traseira: do centro (as duas lanternas, a tampa e o que vai nela) ou de um canto (a lanterna e o canto do lado). */
const traseira = (L?: Lado): Linha[] => [
  { nome: 'Para-choque traseiro', tipo: LATARIA, sub: 'Para-choques', pos: 'T', eh: { cab: 'para-choque' } },
  ...(L ? [L] : (['E', 'D'] as Lado[])).map((l): Linha => ({ nome: `Lanterna traseira ${ladoA(l)}`, tipo: FAROIS, sub: 'Lanternas Traseiras', lado: l, pos: 'T', eh: { cab: 'lanterna' } })),
  PATIO('Tampa traseira'),
  { nome: 'Alma do para-choque traseiro', tipo: LATARIA, sub: 'Almas do Para-choque', pos: 'T', eh: { cab: 'alma', tem: 'para-choque' } },
  { nome: 'Guia do para-choque traseiro', tipo: LATARIA, sub: 'Guias e Suportes do Para-choque', lado: L, pos: 'T', eh: { cab: 'guia suporte', tem: 'para-choque' } },
  { nome: 'Moldura do para-choque', tipo: LATARIA, sub: 'Molduras do Para-choque', pos: 'T', ...X, eh: { cab: 'moldura', tem: 'para-choque' } },
  { nome: 'Refletor', tipo: FAROIS, sub: 'Refletores', lado: L, ...X, eh: { cab: 'refletor' } },
  ...(L ? [
    { nome: 'Moldura do para-lama traseiro', tipo: ACAB, sub: 'Molduras do Para-lama', lado: L, pos: 'T', ...X, eh: { cab: 'moldura', tem: 'para-lama' } },
    { nome: 'Para-barro traseiro', tipo: LATARIA, sub: 'Para-barros', lado: L, pos: 'T', ...X, eh: { cab: 'para-barro' } },
  ] as Linha[] : []),
  { nome: 'Amortecedor da tampa', tipo: LATARIA, sub: 'Amortecedores da Tampa e do Capô', pos: 'T', ...X, eh: { cab: 'amortecedor' } },
  { nome: 'Dobradiça da tampa', tipo: LATARIA, sub: 'Dobradiças da Tampa Traseira', ...X, eh: { cab: 'dobradica', tem: 'tampa porta-malas' } },
  { nome: 'Fechadura do porta-malas', tipo: MAC, sub: 'Fechaduras do Porta-malas', ...(L ? X : {}), eh: { cab: 'fechadura trava', sem: 'bagagito' } },
  { nome: 'Acabamento da tampa', tipo: ACAB, sub: 'Acabamentos da Tampa Traseira', ...X, eh: { cab: 'acabamento moldura', tem: 'tampa' } },
  ...(L ? [] : [
    { nome: 'Luz da placa', tipo: FAROIS, sub: 'Luzes de Placa', ...X, eh: { cab: 'luz lanterna', tem: 'placa' } },
    { nome: 'Luz de freio (brake light)', tipo: FAROIS, sub: 'Brake Light', ...X, eh: { cab: 'brake luz' } },
    { nome: 'Suporte da placa', tipo: LATARIA, sub: 'Suportes da Placa', pos: 'T', ...X, eh: { cab: 'suporte', tem: 'placa' } },
    { nome: 'Aerofólio', tipo: LATARIA, sub: 'Aerofólios', ...X, eh: { cab: 'aerofolio' } },
    { nome: 'Motor do limpador traseiro', tipo: LAV, sub: 'Motores do Limpador', pos: 'T', ...X, eh: { cab: 'motor', tem: 'limpador' } },
    { nome: 'Câmera de ré', tipo: ELET, sub: 'Câmeras de Ré', ...X, eh: { cab: 'camera' } },
    { nome: 'Sensor de estacionamento', tipo: ELET, sub: 'Sensores de Estacionamento', pos: 'T', ...X, eh: { cab: 'sensor' } },
  ] as Linha[]),
  { nome: 'Tampão do porta-malas', tipo: ACAB, sub: 'Tampões do Porta-malas', ...X, eh: { cab: 'tampao bagagito cortina' } },
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

/** O nome É a peça que a linha promete? A regra do nome é a de lib/raioX.ts (`nomeEh`: a 1ª palavra do nome é a da peça,
 *  como o "tipo" da busca; "Suporte maçaneta" é suporte, "Forro porta-malas" não é forro de porta). Linha sem regra
 *  (pátio): nunca. */
export const ehDaLinha = (l: Linha, nome: string): boolean => nomeEh(l.eh, nome);

/** As peças de UMA linha do ponto, pela busca do catálogo (`procurar` = Busca.procurar): primeiro as que SÃO a peça da
 *  linha (`ehDaLinha`), depois as outras do tipo; dentro de cada grupo, da mais barata para a mais cara (a 1ª é a que a
 *  lista mostra; o "Outra opção" passa pelas outras). A linha pede o lado e a posição dela (o catálogo filtra); a guarda
 *  do ponto tira a peça que DIZ o lado ou a posição oposta. Linha de pátio (sem tipo) = nenhuma peça. */
export function itensDaLinha(p: Ponto, l: Linha, procurar: (f: Filtros) => Item[], carro: CarroBatida = {}): Item[] {
  return listaDaLinha(p, l, procurar, carro).itens;
}

/** A lista de UMA linha (a de `itensDaLinha`) e se o link do catálogo dela mostra EXATAMENTE essa lista.
 *  O endereço do catálogo só sabe pedir tipo + sub + o lado/posição da LINHA; a guarda do ponto ("tira a que DIZ o lado
 *  ou a posição oposta") não cabe nele: na "Alma do para-choque" da batida da frente o link abria 7 peças e 3 diziam
 *  "traseiro" (rodada 16). `noCatalogo` = a guarda não tirou nada, o link e a lista são a mesma coisa. Quando é falso, a
 *  linha NÃO manda ao catálogo: as peças dela aparecem no próprio painel ("Outra opção", como já era com o carro
 *  salvo). Uma regra só de lado e posição para a contagem e para a lista, com ou sem carro. */
export function listaDaLinha(p: Ponto, l: Linha, procurar: (f: Filtros) => Item[], carro: CarroBatida = {}): { itens: Item[]; noCatalogo: boolean } {
  if (!l.tipo) return { itens: [], noCatalogo: true };
  const grupo = new Map<Item, number>();
  const g = (it: Item) => { let v = grupo.get(it); if (v === undefined) { v = ehDaLinha(l, it.n) ? 0 : 1; grupo.set(it, v); } return v; };
  const doLink = procurar(filtrosDaLinha(l, carro));
  const itens = doLink
    .filter((it) => !(p.lado && it.l && it.l !== p.lado))
    .filter((it) => !(p.pos && it.pos === (p.pos === 'D' ? 'T' : 'D')))
    .sort((a, b) => g(a) - g(b) || a.p - b.p || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { itens, noCatalogo: itens.length === doLink.length };
}

/** Um ponto com as peças de cada linha (no navegador, com o carro: a lista e o "Outra opção"). As linhas EXTRA sem peça
 *  ficam de fora; as principais sem peça ficam (pátio). `certa` = a 1ª peça é a do título da linha. */
export function opcoesDoPonto(p: Ponto, procurar: (f: Filtros) => Item[], carro: CarroBatida = {}): { linha: Linha; itens: Item[]; certa: boolean }[] {
  return p.linhas.map((linha) => {
    const itens = itensDaLinha(p, linha, procurar, carro);
    return { linha, itens, certa: itens.length > 0 && ehDaLinha(linha, itens[0].n) };
  }).filter((x) => x.itens.length > 0 || !x.linha.extra);
}

/** O que o nome da linha ganha quando a peça à mostra não é a do título (fica à vista, com o nome de verdade embaixo). */
export const LIGADA = ' (peça ligada)';

/** As linhas como o PAINEL mostra. A linha cuja 1ª peça é a do título segue igual. A que só tem peça LIGADA (o suporte
 *  na linha da maçaneta, o forro do porta-malas na do forro da porta) nunca passa por ela: a principal vira DUAS, o
 *  título no pátio ("a gente procura", `vazia(linha)`) e a peça ligada em "Também costuma ir junto", com o nome dito; a
 *  extra só ganha o nome dito. `n` = quantas peças a linha tem. */
export function linhasDoPainel<T extends { linha: Linha; n: number; certa: boolean }>(ops: readonly T[], vazia: (linha: Linha) => T): T[] {
  return ops.flatMap((o) => {
    if (!o.n || o.certa) return [o];
    const ligada = { ...o, linha: { ...o.linha, nome: o.linha.nome + LIGADA, extra: true } };
    return o.linha.extra ? [ligada] : [vazia(o.linha), ligada];
  });
}

/** As linhas que nascem marcadas: só com o carro dito e só as PRINCIPAIS (a lista do conserto daquele ponto).
 *  - com peça: marcada e somada, e só quando a peça à mostra É a do título da linha (`pecasValem` = falso quando a lista
 *    é de outro ano do carro: aí nenhuma peça com preço nasce marcada);
 *  - sem peça (pátio): marcada como "a gente procura no pátio". O desmanche anuncia muito mais peça pequena que
 *    lataria: nos 40 carros com mais peças, 35% dos pontos não têm NENHUMA linha principal com peça e 31% têm uma só
 *    (medido em 11/11/2026), e o que falta é justamente o que define o conserto (para-choque, farol, capô, porta,
 *    tampa). Com as linhas de pátio já marcadas o pedido sai com o conserto inteiro e a pessoa desmarca o que não
 *    precisa; o total em dinheiro não muda (pátio não tem preço).
 *  Sem carro, nada (as peças são de carros diferentes). As que "costumam ir junto" nunca nascem marcadas. */
export function marcadasDeInicio(linhas: readonly { linha: Linha; n: number; certa: boolean }[], comCarro: boolean, pecasValem = true): Set<number> {
  return new Set(comCarro ? linhas.flatMap((l, i) => (l.linha.extra ? [] : l.n > 0 ? (l.certa && pecasValem ? [i] : []) : [i])) : []);
}

/** Pouca peça anunciada para o carro neste ponto: 0 ou 1 linha principal com peça (e alguma para procurar). O painel
 *  abre pela lista de pátio, com a frase "Nem toda peça está anunciada…", em vez de "nenhuma peça deste conserto". */
export function poucoAnunciado(linhas: readonly { linha: Linha; n: number }[]): boolean {
  const principais = linhas.filter((l) => !l.linha.extra);
  return principais.filter((l) => l.n > 0).length <= 1 && principais.some((l) => !l.n);
}

/** O pé da lista, pelo que está marcado: peça com preço = o orçamento (total e "Pedir o conserto no WhatsApp"); só
 *  pedido de pátio = sem total em dinheiro e "Pedir para procurar no pátio" (data-botao próprio); nada = o botão espera. */
export type PeConserto = { estado: 'conserto' | 'patio' | 'nada'; botao: string; dataBotao: 'raiox-conserto' | 'raiox-patio' };
export function peDoConserto(comPreco: number, dePatio: number): PeConserto {
  if (comPreco > 0) return { estado: 'conserto', botao: 'Pedir o conserto no WhatsApp', dataBotao: 'raiox-conserto' };
  if (dePatio > 0) return { estado: 'patio', botao: 'Pedir para procurar no pátio', dataBotao: 'raiox-patio' };
  return { estado: 'nada', botao: 'Pedir o conserto no WhatsApp', dataBotao: 'raiox-conserto' };
}
/** A frase honesta da lista de pátio (nunca prometer que tem). */
export const FRASE_PATIO = 'Nem toda peça está anunciada. Marque o que você precisa e a gente procura no pátio.';

/** Um ponto contado: cada linha com o número de peças e a 1ª delas (a que aparece: a mais barata das que são a peça da
 *  linha); o total do ponto é sem repetir. As linhas EXTRA sem peça ficam de fora. */
export function kitDoPonto(p: Ponto, procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string, carro: CarroBatida = {}): KitPonto {
  const ids = new Set<string>();
  const linhas: LinhaKit[] = opcoesDoPonto(p, procurar, carro).map(({ linha, itens, certa }) => {
    for (const it of itens) ids.add(it.id);
    return { ...linha, n: itens.length, rep: itens.length ? repDe(itens[0], fotoDe) : null, certa };
  });
  return { k: p.k, nome: p.nome, n: ids.size, linhas };
}

/** Os 8 pontos de uma vez (o JSON do build). */
export function kitsDeTodos(procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string, carro: CarroBatida = {}): KitPonto[] {
  return PONTOS.map((p) => kitDoPonto(p, procurar, fotoDe, carro));
}

/** O arquivo do estoque inteiro (sem carro salvo: pages/dados/batida.json.ts → /dados/batida.json). Curto: as peças UMA
 *  vez só (a mesma aparece em 2 ou 3 pontos) e, por ponto, uma entrada por linha, na ordem de PONTOS[k].linhas:
 *  [quantas, qual peça] (linha sem peça: [0, -1]); um 3º número 0 quando a peça à mostra NÃO é a do título (só há peça
 *  ligada); e, quando o link do catálogo mostraria peça que a guarda do ponto tira (`listaDaLinha().noCatalogo` falso),
 *  um 4º item com as OUTRAS peças da linha, na ordem: a lista aparece no painel e o link do catálogo não é oferecido. */
export type EntradaBatida = [number, number] | [number, number, 0 | 1] | [number, number, 0 | 1, number[]];
export type BatidaJson = { v: number; pecas: Rep[]; pontos: Record<string, EntradaBatida[]> };

export function batidaJson(procurar: (f: Filtros) => Item[], fotoDe: (it: Item) => string): BatidaJson {
  const pecas: Rep[] = [];
  const lugar = new Map<string, number>();
  const idx = (it: Item) => { let i = lugar.get(it.id); if (i === undefined) { i = pecas.push(repDe(it, fotoDe)) - 1; lugar.set(it.id, i); } return i; };
  const pontos: BatidaJson['pontos'] = {};
  for (const p of PONTOS) {
    pontos[p.k] = p.linhas.map((l): EntradaBatida => {
      const { itens, noCatalogo } = listaDaLinha(p, l, procurar);
      if (!itens.length) return [0, -1];
      const certa = ehDaLinha(l, itens[0].n) ? 1 : 0;
      const i0 = idx(itens[0]);
      if (!noCatalogo && itens.length > 1) return [itens.length, i0, certa, itens.slice(1).map(idx)];
      return certa ? [itens.length, i0] : [itens.length, i0, 0];
    });
  }
  return { v: 3, pecas, pontos };
}

/** Uma linha do arquivo como o painel precisa: quantas peças, as que o painel tem para mostrar (a 1ª; todas, quando o
 *  link do catálogo não serve) e se a 1ª é a do título. Com 2+ peças e só uma em `ops`, a linha oferece o link do
 *  catálogo, que nesse caso mostra exatamente as `n` (é o que `batidaJson` garante e o teste confere). */
export function linhaDoJson(j: BatidaJson, k: string, i: number): { n: number; ops: Rep[]; certa: boolean } {
  const e = j.pontos[k]?.[i];
  if (!e?.[0]) return { n: 0, ops: [], certa: false };
  return { n: e[0], ops: [e[1], ...(e[3] ?? [])].map((x) => j.pecas[x]), certa: e[2] !== 0 };
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
