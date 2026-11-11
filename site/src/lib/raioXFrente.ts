// "A frente por dentro" (o PILOTO do 2º nível do Raio-x: uma zona que se abre). A arte é a vista explodida da frente de
// um SUV (public/arte/v2/raio-x-frente.webp, 1536×1024, aprovada): para-choque, grades, faróis, faróis de milha, alma,
// painel frontal, radiador, condensador, intercooler, eletroventilador, reservatório do limpador, capô e para-lamas.
// Cada peça da arte é um PONTO QUENTE desenhado na forma dela (polígonos medidos sobre a arte e conferidos com a arte
// por baixo: prints/frente-poligonos.png) e leva ao link EXATO do catálogo daquele tipo (tipo + sub + lado/posição +
// o carro: linkLinha de lib/raioX.ts); o número é o do catálogo (Busca.procurar com os mesmos filtros).
// ORIENTAÇÃO da arte: o carro olha para quem vê, para baixo e à esquerda. O para-lama e o farol à DIREITA de quem olha
// (o para-lama com a face pintada de fora à vista) são os do lado ESQUERDO do carro (motorista); os da esquerda de
// quem olha são os DIREITOS (passageiro).
// O estoque não tem o tipo "Capô": o ponto do capô é de pátio (WhatsApp: "a gente procura no pátio").
// Sem node:fs e sem valores de lib/busca.ts: roda no build, no teste e no navegador.
import type { Filtros } from './busca';
import { EH_PAINEL_FRONTAL } from './raioX';

// a arte e a zona do piloto: lib/raioXPiloto.ts (o Raio-x usa só elas, sem puxar esta tabela)
export { ARTE_FRENTE, ARTE_FRENTE_320, ARTE_FRENTE_900, ZONA_PILOTO } from './raioXPiloto';

// o formato de um ponto quente e a conta: lib/porDentro/base.ts (o mesmo de todas as vistas)
export type { PontoQuente } from './porDentro/base';
import { contarPontos, filtrosDoQuente, type CarroDoQuente, type PontoQuente } from './porDentro/base';
export { filtrosDoQuente };

// Na ordem de quem desmonta a frente (e a do Tab): o para-choque, as grades, os faróis, a alma, o painel, os
// radiadores, o capô e os para-lamas.
export const PONTOS_QUENTES: PontoQuente[] = [
  {
    k: 'para-choque', nome: 'Para-choque dianteiro', procuro: 'o para-choque dianteiro', ancora: [420, 846], tipo: 'Para-choques e Lataria', sub: 'Para-choques', eh: { cab: 'para-choque' }, pos: 'D',
    poligonos: ['95,640 110,560 150,516 158,530 150,572 176,586 190,580 196,700 240,732 560,802 640,702 662,684 692,680 702,702 800,706 850,660 882,664 910,700 880,762 856,884 824,916 640,944 400,900 172,826 112,772 98,706'],
  },
  {
    k: 'grade', nome: 'Grade', procuro: 'a grade', ancora: [430, 622], tipo: 'Para-choques e Lataria', sub: 'Grades do Para-choque', eh: { cab: 'grade churrasqueira' },
    poligonos: [
      '220,540 232,528 345,590 450,612 600,612 640,622 632,650 590,702 560,700 240,628 218,600',
      '218,662 232,650 580,728 590,740 548,780 520,776 240,706 220,690',
    ],
  },
  {
    k: 'farol-direito', nome: 'Farol direito', procuro: 'o farol direito', ancora: [236, 452], tipo: 'Faróis e Lanternas', sub: 'Faróis', eh: { cab: 'farol', sem: 'milha neblina' }, lado: 'D',
    poligonos: ['160,470 175,425 210,398 262,396 290,405 300,430 322,445 318,465 300,480 285,490 262,500 215,512 178,512 162,495'],
  },
  {
    k: 'farol-esquerdo', nome: 'Farol esquerdo', procuro: 'o farol esquerdo', ancora: [1000, 612], tipo: 'Faróis e Lanternas', sub: 'Faróis', eh: { cab: 'farol', sem: 'milha neblina' }, lado: 'E',
    poligonos: ['868,600 885,585 990,560 1000,545 1075,545 1085,528 1130,548 1135,565 1100,640 1085,665 1030,690 1000,665 960,650 905,640 880,620'],
  },
  {
    k: 'milha', nome: 'Faróis de milha', procuro: 'o farol de milha', ancora: [920, 852], tipo: 'Faróis e Lanternas', sub: 'Faróis de Milha', eh: { cab: 'farol milha', tem: 'milha neblina' },
    poligonos: ['878,838 900,822 955,822 962,835 950,880 915,890 885,880', '35,715 55,702 80,712 85,745 75,780 55,780 38,762'],
  },
  // a alma sem a posição: o estoque quase nunca escreve "dianteiro" nela ("Absorvedor impacto", "Alma para-choque");
  // o catálogo mostra todas e o nome de cada uma diz quando é a traseira
  {
    k: 'alma', nome: 'Alma do para-choque', procuro: 'a alma do para-choque', ancora: [560, 566], tipo: 'Para-choques e Lataria', sub: 'Almas do Para-choque', eh: { cab: 'alma', tem: 'para-choque' }, fora: 'T',
    poligonos: ['322,492 350,486 380,498 400,520 700,572 740,562 792,590 795,610 770,640 720,645 700,615 400,560 330,530'],
  },
  {
    k: 'painel-frontal', nome: 'Painel frontal (suporte do radiador)', procuro: 'o painel frontal (suporte do radiador)', ancora: [690, 480], tipo: 'Arrefecimento', sub: 'Suportes do Radiador', eh: EH_PAINEL_FRONTAL,
    poligonos: ['385,362 440,342 455,350 470,372 520,378 560,372 610,390 700,410 800,430 975,438 978,490 940,500 945,540 900,548 890,570 842,605 800,600 795,572 760,560 700,548 600,530 520,524 470,506 420,490 400,440'],
  },
  {
    k: 'radiador', nome: 'Radiador', procuro: 'o radiador', ancora: [720, 352], tipo: 'Arrefecimento', sub: 'Radiadores', eh: { cab: 'radiador' },
    poligonos: ['606,308 642,292 884,320 892,335 890,438 800,428 700,408 612,390'],
  },
  {
    k: 'condensador', nome: 'Condensador do ar-condicionado', procuro: 'o condensador do ar-condicionado', ancora: [926, 418], tipo: 'Ar-condicionado', sub: 'Condensadores', eh: { cab: 'condensador radiador', tem: 'condensador' },
    poligonos: ['716,268 742,262 742,280 938,300 950,310 958,400 962,432 940,440 894,438 892,332 884,318 720,300'],
  },
  {
    k: 'intercooler', nome: 'Intercooler', procuro: 'o intercooler', ancora: [880, 264], tipo: 'Filtro de Ar e Turbo', sub: 'Intercoolers', eh: [{ cab: 'intercooler' }, { cab: 'radiador', tem: 'intercooler' }],
    poligonos: ['766,240 790,236 996,266 1002,280 1002,428 962,430 958,310 940,298 770,278'],
  },
  {
    k: 'eletroventilador', nome: 'Eletroventilador', procuro: 'o eletroventilador', ancora: [1066, 322], tipo: 'Arrefecimento', sub: 'Eletroventiladores', eh: { cab: 'eletroventilador ventoinha' },
    poligonos: ['903,212 928,204 1136,238 1140,300 1132,412 1100,430 1004,402 1002,268 906,256'],
  },
  {
    k: 'reservatorio', nome: 'Reservatório do limpador', procuro: 'o reservatório do limpador', ancora: [1188, 372], tipo: 'Limpador e Lavador', sub: 'Reservatórios do Lavador', eh: { cab: 'reservatorio' },
    poligonos: ['1150,340 1180,322 1182,298 1200,296 1205,322 1225,330 1222,400 1215,435 1175,442 1152,410'],
  },
  {
    k: 'capo', nome: 'Capô', procuro: 'o capô', ancora: [1090, 118],
    poligonos: ['762,160 800,115 880,70 980,35 1010,28 1425,68 1428,82 1390,150 1340,185 1250,216 1170,216 1100,192 980,176 880,170 800,185 770,185'],
  },
  {
    k: 'para-lama-direito', nome: 'Para-lama direito', procuro: 'o para-lama direito', ancora: [600, 196], tipo: 'Para-choques e Lataria', sub: 'Para-lamas', eh: { cab: 'para-lama' }, lado: 'D',
    poligonos: ['472,310 500,232 560,180 640,138 716,110 722,128 692,170 684,236 668,300 652,342 630,330 624,290 596,252 556,250 520,280 504,345 480,340'],
  },
  {
    k: 'para-lama-esquerdo', nome: 'Para-lama esquerdo', procuro: 'o para-lama esquerdo', ancora: [1340, 300], tipo: 'Para-choques e Lataria', sub: 'Para-lamas', eh: { cab: 'para-lama' }, lado: 'E',
    poligonos: ['1262,318 1300,290 1400,232 1478,184 1492,210 1474,330 1478,500 1442,510 1432,432 1400,382 1352,370 1302,400 1272,470 1280,600 1262,606 1232,470'],
  },
];

/** Quantas peças cada ponto quente tem, pela busca do catálogo (`procurar` = Busca.procurar): { 'farol-esquerdo': 4 }.
 *  Ponto de pátio (sem tipo): 0. */
export const contarQuentes = (procurar: (f: Filtros) => { id: string }[], carro: CarroDoQuente = {}, pontos: PontoQuente[] = PONTOS_QUENTES): Record<string, number> =>
  contarPontos(procurar, carro, pontos);
