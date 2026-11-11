// "A traseira por dentro": a vista explodida da traseira (public/arte/v2/raio-x-traseira.webp, 1536×1024), vista de
// trás: a tampa no meio, com o vidro, o brake light, as dobradiças, o motor do limpador e o acabamento em cima; os
// amortecedores e as lanternas dos lados; embaixo, a fechadura, a câmera de ré, a alma, os sensores e o para-choque.
// ORIENTAÇÃO da arte: o carro é visto por trás, então a lanterna à ESQUERDA de quem olha é a ESQUERDA do carro
// (motorista) e a da direita é a DIREITA (o contrário da vista da frente).
// O estoque não tem como tipo a tampa traseira e o vidro traseiro: esses pontos são de pátio.
// Cada peça da arte é um ponto quente com a FORMA dela (contornos tirados da própria arte e conferidos com ela por
// baixo) e leva ao link EXATO do catálogo daquele tipo (lib/porDentro/base.ts). Sem node:fs: roda no build, no teste
// e no navegador (só quando a vista abre: components/v2/raioXPorDentro.ts).
import type { PontoQuente } from './base';

// Na ordem do Tab e da lista: de cima para baixo: o porta-malas, a tampa e o que vai nela, as lanternas, a fechadura, a alma e o para-choque.
export const PONTOS: PontoQuente[] = [
  {
    k: 'tampao', nome: 'Tampão do porta-malas', procuro: 'o tampão do porta-malas', ancora: [554, 72], tipo: 'Acabamentos e Forros', sub: 'Tampões do Porta-malas', eh: { cab: 'tampao bagagito cortina' },
    poligonos: ['729,38 723,28 286,55 277,77 288,95 328,96 359,113 551,106 713,85 724,76 718,61 729,51'],
  },
  {
    k: 'brake-light', nome: 'Brake light', procuro: 'o brake light', ancora: [715, 121], tipo: 'Faróis e Lanternas', sub: 'Brake Light', eh: { cab: 'brake luz' },
    poligonos: ['750,113 712,112 550,128 546,131 546,136 556,141 580,140 589,144 598,138 705,128 719,132 727,126 747,122'],
  },
  {
    k: 'dobradicas', nome: 'Dobradiças da tampa', procuro: 'a dobradiça da tampa traseira', ancora: [362, 175], tipo: 'Para-choques e Lataria', sub: 'Dobradiças da Tampa Traseira', eh: { cab: 'dobradica', tem: 'tampa porta-malas' },
    poligonos: [
      '313,164 311,173 316,182 331,187 341,187 353,198 354,202 351,205 338,211 339,219 346,225 364,225 374,222 400,220 411,217 416,212 416,207 411,201 397,200 392,196 384,180 391,175 393,163 390,158 376,151 329,154',
      '843,112 842,120 846,128 859,132 870,131 879,139 877,144 864,148 865,156 871,160 918,160 931,157 935,153 935,149 931,144 926,142 919,143 915,140 912,131 907,126 912,118 912,109 909,104 903,102 898,97 876,100 855,100',
    ],
  },
  {
    k: 'vidro', nome: 'Vidro traseiro (vigia)', procuro: 'o vidro traseiro (vigia)', ancora: [627, 215],
    poligonos: ['883,236 854,187 825,155 797,144 750,143 576,156 475,172 454,191 442,254 452,271 478,279 626,278 850,259 876,252'],
  },
  {
    k: 'motor-limpador', nome: 'Motor do limpador traseiro', procuro: 'o motor do limpador traseiro', ancora: [965, 260], tipo: 'Limpador e Lavador', sub: 'Motores do Limpador', eh: { cab: 'motor', tem: 'limpador' }, pos: 'T',
    poligonos: ['917,267 925,274 937,275 941,280 942,290 948,294 975,292 986,287 991,277 1011,271 1015,264 1037,260 1046,248 1048,240 1044,234 1030,224 1007,227 990,225 975,231 970,228 959,229 947,219 937,216 930,223 930,229 936,239 935,251 930,255 920,257'],
  },
  {
    k: 'acabamento-tampa', nome: 'Acabamento da tampa', procuro: 'o acabamento interno da tampa traseira', ancora: [1204, 259], tipo: 'Acabamentos e Forros', sub: 'Acabamentos da Tampa Traseira', eh: { cab: 'acabamento moldura', tem: 'tampa' },
    poligonos: ['1356,144 1330,130 1081,148 1057,156 1045,185 1087,283 1100,384 1126,390 1399,354 1407,341 1410,298'],
  },
  {
    k: 'tampa', nome: 'Tampa traseira', procuro: 'a tampa traseira', ancora: [624, 457],
    poligonos: ['995,437 906,302 869,275 574,285 430,303 393,289 377,304 432,421 473,622 498,645 982,593 996,578 1005,510 993,487'],
  },
  {
    k: 'amortecedores', nome: 'Amortecedores da tampa', procuro: 'o amortecedor da tampa traseira', ancora: [365, 477], tipo: 'Para-choques e Lataria', sub: 'Amortecedores da Tampa e do Capô', eh: { cab: 'amortecedor' }, pos: 'T',
    poligonos: [
      '341,336 334,340 333,350 342,368 357,455 354,473 382,625 392,627 399,615 374,470 366,456 350,363 352,345',
      '1052,308 1040,314 1044,332 1044,414 1039,425 1037,582 1043,588 1053,586 1056,580 1057,425 1053,421 1053,334 1058,316',
    ],
  },
  {
    k: 'lanterna-esquerda', nome: 'Lanterna esquerda', procuro: 'a lanterna traseira esquerda', ancora: [231, 532], tipo: 'Faróis e Lanternas', sub: 'Lanternas Traseiras', eh: { cab: 'lanterna' }, lado: 'E',
    poligonos: ['138,485 137,493 142,498 145,513 152,524 166,533 176,545 188,571 229,581 314,582 320,579 320,555 327,548 327,508 315,502 311,495 295,489 255,489 238,478 224,479 215,487 159,483'],
  },
  {
    k: 'lanterna-direita', nome: 'Lanterna direita', procuro: 'a lanterna traseira direita', ancora: [1175, 502], tipo: 'Faróis e Lanternas', sub: 'Lanternas Traseiras', eh: { cab: 'lanterna' }, lado: 'D',
    poligonos: ['1247,453 1242,448 1233,448 1187,460 1177,456 1162,456 1151,465 1113,469 1111,479 1101,486 1101,503 1115,517 1115,525 1105,531 1105,542 1138,552 1205,541 1226,534 1237,524 1251,487 1253,470'],
  },
  {
    k: 'fechadura', nome: 'Fechadura da tampa', procuro: 'a fechadura da tampa traseira', ancora: [712, 651], tipo: 'Maçanetas e Fechaduras', sub: 'Fechaduras do Porta-malas', eh: { cab: 'fechadura trava', sem: 'bagagito' },
    poligonos: ['848,633 844,628 835,626 825,618 780,622 764,620 752,626 727,623 720,626 718,638 715,641 702,643 697,647 696,658 702,664 717,665 721,670 745,684 754,683 761,678 776,680 783,678 788,668 798,665 806,657 828,656 835,650 844,647 848,642'],
  },
  {
    k: 'camera', nome: 'Câmera de ré', procuro: 'a câmera de ré', ancora: [832, 696], tipo: 'Módulos e Elétrica', sub: 'Câmeras de Ré', eh: { cab: 'camera' },
    poligonos: ['848,691 843,688 825,688 813,694 803,694 778,699 772,698 757,689 747,689 744,691 738,691 735,694 735,715 739,719 766,719 771,710 793,703 817,701 825,705 844,704 848,702'],
  },
  {
    k: 'alma', nome: 'Alma do para-choque traseiro', procuro: 'a alma do para-choque traseiro', ancora: [535, 744], tipo: 'Para-choques e Lataria', sub: 'Almas do Para-choque', eh: { cab: 'alma', tem: 'para-choque' }, pos: 'T',
    poligonos: ['1079,685 1027,668 996,670 988,688 956,703 805,724 596,730 545,704 517,705 502,720 468,719 466,763 483,775 548,785 575,774 787,767 1002,739 1045,744 1077,726'],
  },
  {
    k: 'sensores', nome: 'Sensores de estacionamento', procuro: 'o sensor de estacionamento', ancora: [1000, 788], tipo: 'Módulos e Elétrica', sub: 'Sensores de Estacionamento', eh: { cab: 'sensor' }, fora: 'D',
    poligonos: [
      '618,808 605,801 595,801 589,803 571,802 566,804 560,813 561,825 563,829 571,835 579,835 597,827 613,827 619,820',
      '762,805 760,802 746,796 731,799 713,798 707,803 704,809 704,818 707,825 711,829 722,831 736,824 754,823 759,821 762,817',
      '901,795 898,791 887,786 874,788 854,788 845,796 844,807 851,818 855,820 863,820 877,813 890,813 899,810 901,806',
      '1033,779 1019,772 1002,774 988,773 979,779 976,786 976,792 979,799 984,804 994,806 1011,798 1022,799 1030,796 1033,792',
    ],
  },
  {
    k: 'para-choque', nome: 'Para-choque traseiro', procuro: 'o para-choque traseiro', ancora: [474, 922], tipo: 'Para-choques e Lataria', sub: 'Para-choques', eh: { cab: 'para-choque' }, pos: 'T',
    poligonos: ['1172,773 1158,746 1140,742 1121,757 1123,801 1044,824 588,863 477,854 396,796 380,807 373,856 414,965 407,979 425,988 600,994 1043,957 1131,931 1163,880'],
  },
];
