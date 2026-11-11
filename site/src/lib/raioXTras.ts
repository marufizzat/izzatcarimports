// "Girar o carro" (Raio-x, components/v2/raioXGirar.ts): a SEGUNDA vista do mesmo carro, por trás e pelo lado direito
// (public/arte/v2/raio-x-tras.webp, 1536×1024, com as variantes -320 e -900 de scripts/variantes-imagens.mjs). É a
// arte da frente com o carro girado 180° no mesmo estúdio: a traseira fica embaixo à esquerda, o lado do PASSAGEIRO
// (direito) voltado para quem olha, a frente lá no fundo, em cima à direita.
// Aqui a traseira, a lateral direita, o teto, o interior, as rodas (as do lado direito e o eixo de trás) e a parte de
// baixo (o silencioso e a linha do escapamento) são desenhados na forma de verdade. A frente e o motor aparecem só de
// longe (`longe`: tocar neles gira o carro de volta); a lateral esquerda não aparece (só na fila de fichas).
// Contornos medidos sobre a arte e conferidos com ela por baixo (a prova fica fora do repositório). Só descem quando a
// pessoa gira o carro: nada disto está no script que toda visita à home carrega.
import { elipse } from './raioX';
import { ARTE_TRAS_SRC } from './raioX';

/** A arte da vista de trás (o mesmo tamanho da arte da frente: o palco não muda). */
export const ARTE_TRAS = { src: ARTE_TRAS_SRC, w: 1536, h: 1024 } as const;

/** Uma zona do Raio-x na vista de trás (a chave é a de ZONAS, lib/raioX.ts: o nome, os grupos e as contas são os dela). */
export type ZonaTras = {
  k: string;
  /** a parte fica do outro lado do carro: aqui é só um alvo que gira o carro de volta */
  longe?: true;
  /** o ponto (e o número) na arte */
  ancora: [number, number];
  /** a etiqueta da arte larga (640+ px), nas faixas de cima (y 62) e de baixo (y 965) */
  etiqueta: [number, number];
  /** a área de toque (as zonas repartem a arte inteira, fundo incluído) */
  poligonos: string[];
  /** o que acende: o contorno da parte de verdade */
  realce: string[];
};

// Ordem = ordem do Tab nesta vista (de trás para a frente, como se lê a arte).
export const ZONAS_TRAS: ZonaTras[] = [
  {
    k: 'traseira', ancora: [300, 548], etiqueta: [193, 965],
    // a tampa, as lanternas e o para-choque; o silencioso (visto através do para-choque) é da parte de baixo
    poligonos: ['0,0 250,0 250,290 512,432 535,570 548,600 548,715 480,738 262,640 212,668 240,722 380,790 452,806 548,792 548,1024 0,1024'],
    realce: ['252,294 512,434 537,570 548,620 545,850 430,852 380,838 200,740 138,640 136,540 152,440 200,362'],
  },
  {
    k: 'lateral-direita', ancora: [1030, 500], etiqueta: [1229, 965],
    // as duas portas (da linha da cintura até a linha do escapamento), o retrovisor e o para-lama dianteiro
    poligonos: ['600,562 760,513 1105,409 1100,330 1165,362 1220,372 1300,347 1340,314 1345,400 1392,480 1345,425 1280,405 1215,425 1185,500 1080,545 960,585 778,650 745,675 680,640 612,640'],
    realce: ['540,598 604,564 760,515 1105,411 1112,368 1150,362 1165,362 1220,372 1300,347 1338,318 1352,400 1392,480 1345,425 1280,405 1215,425 1185,500 1195,585 950,688 780,748 770,690 745,675 680,640 612,640 560,655'],
  },
  {
    k: 'interior', ancora: [850, 430], etiqueta: [830, 62],
    // o que se vê pelos vidros do lado direito e pelo para-brisa (bancos, painel, console)
    poligonos: ['512,432 640,380 800,338 1000,282 960,188 880,140 880,0 1010,0 1010,160 1100,330 1105,409 760,513 600,562 548,600 535,570'],
    realce: ['516,434 640,382 800,340 1000,284 1092,332 1103,408 760,511 602,560 548,598 537,570'],
  },
  {
    k: 'teto', ancora: [690, 255], etiqueta: [500, 62],
    poligonos: ['250,0 880,0 880,140 960,188 1000,282 800,338 640,380 512,432 250,290'],
    realce: ['254,290 330,240 640,152 780,130 880,142 958,188 998,280 800,336 640,378 512,430'],
  },
  {
    k: 'rodas', ancora: [652, 785], etiqueta: [550, 965],
    poligonos: [
      '548,600 600,562 612,640 680,640 745,675 778,745 800,1024 548,1024',
      '1185,500 1215,425 1280,405 1345,425 1392,480 1400,700 1536,700 1536,1024 1150,1024 1190,605',
    ],
    // as duas rodas do lado direito (com disco e pinça) e a mola/amortecedor acima de cada uma
    realce: [elipse(652, 785, 108, 114), elipse(1278, 518, 92, 102), '568,575 612,575 612,690 568,690', '1262,305 1302,305 1302,402 1262,402'],
  },
  {
    k: 'embaixo', ancora: [880, 650], etiqueta: [898, 965],
    // a linha do escapamento ao longo da soleira (com o catalisador) e o silencioso traseiro
    poligonos: [
      '745,675 778,650 960,585 1080,545 1185,500 1190,605 1150,1024 800,1024 778,745',
      '212,668 262,640 480,738 548,715 548,792 452,806 380,790 240,722',
    ],
    realce: [
      '775,668 840,630 980,578 1075,535 1130,500 1140,440 1185,440 1190,500 1195,585 950,690 780,750',
      '238,668 262,646 400,700 470,735 560,700 600,730 560,790 452,800 380,790 250,722',
    ],
  },
  {
    k: 'motor', longe: true, ancora: [1190, 272], etiqueta: [1150, 62],
    poligonos: ['1010,0 1536,0 1536,314 1340,314 1300,347 1220,372 1165,362 1100,330 1010,160'],
    realce: ['1010,172 1060,160 1180,162 1290,220 1340,300 1340,314 1300,347 1220,372 1165,362 1100,330'],
  },
  {
    k: 'frente', longe: true, ancora: [1368, 352], etiqueta: [1400, 62],
    // o farol direito e o canto do para-choque: o que dá para ver da frente daqui
    poligonos: ['1536,314 1536,700 1400,700 1392,480 1345,400 1340,314'],
    realce: ['1338,318 1375,326 1392,352 1398,470 1390,520 1362,440 1345,400'],
  },
];

/** Um ponto do "Bati o carro" na vista de trás (a chave é a de PONTOS, lib/batida.ts: o nome e as linhas são os dele). */
export type PontoTras = { k: string; ancora: [number, number]; etiqueta: [number, number]; toque: string[]; realce: string[] };

// Na vista de trás a traseira, os dois cantos de trás e a lateral direita caem no lugar de verdade; o canto da frente
// do lado direito aparece no para-lama, lá no fundo. A frente, a frente esquerda e a lateral esquerda ficam do outro
// lado (PONTOS_DO_OUTRO_LADO em lib/batida.ts): só nas fichas, e escolher uma gira o carro de volta.
export const PONTOS_TRAS: PontoTras[] = [
  {
    k: 'traseira-esquerda', ancora: [168, 500], etiqueta: [180, 965],
    toque: ['0,0 250,0 250,290 205,365 215,440 205,640 240,760 240,1024 0,1024'],
    realce: ['136,640 136,540 152,440 205,365 250,292 268,332 218,440 208,640 240,742 200,740'],
  },
  {
    k: 'traseira', ancora: [300, 640], etiqueta: [450, 965],
    toque: ['250,290 440,393 425,655 440,1024 240,1024 240,760 205,640 215,440 205,365'],
    realce: ['252,294 512,434 537,570 548,620 545,850 430,852 380,838 200,740 138,640 136,540 152,440 200,362'],
  },
  {
    k: 'traseira-direita', ancora: [520, 625], etiqueta: [720, 965],
    toque: ['440,393 512,432 600,562 612,640 680,640 745,675 778,745 800,1024 440,1024 425,655'],
    realce: ['430,600 455,575 512,434 600,562 612,640 565,700 548,850 420,850 400,790 420,680'],
  },
  {
    k: 'lateral-direita', ancora: [880, 560], etiqueta: [1030, 965],
    toque: ['600,562 760,513 1105,409 1165,362 1185,500 1190,605 1150,1024 800,1024 778,745 745,675 680,640 612,640'],
    realce: ['604,564 760,515 1105,411 1112,368 1150,362 1168,420 1185,500 1195,585 950,688 780,748 770,690 745,675 712,642 690,548'],
  },
  {
    k: 'frente-direita', ancora: [1362, 400], etiqueta: [1390, 62],
    toque: ['1165,362 1220,372 1300,347 1340,314 1340,250 1536,250 1536,1024 1150,1024 1190,605 1185,500'],
    realce: ['1165,362 1220,372 1300,347 1338,318 1375,326 1392,352 1398,470 1390,520 1345,425 1280,405 1215,425 1185,500'],
  },
];
