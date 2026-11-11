// "O teto por dentro": a vista explodida do teto (public/arte/v2/raio-x-teto.webp, 1536×1024), em 3 camadas: o vidro
// do teto solar com as longarinas e a antena no alto, o quadro (a máquina) do teto solar com o motor no meio, e o
// forro embaixo, com as alças, os quebra-sóis, a luz de teto e os airbags de cortina em volta.
// O estoque não tem como tipo o vidro e o quadro do teto solar, o forro do teto e as longarinas: esses pontos são de
// pátio (WhatsApp: "a gente procura no pátio").
// Cada peça da arte é um ponto quente com a FORMA dela (contornos tirados da própria arte e conferidos com ela por
// baixo) e leva ao link EXATO do catálogo daquele tipo (lib/porDentro/base.ts). Sem node:fs: roda no build, no teste
// e no navegador (só quando a vista abre: components/v2/raioXPorDentro.ts).
import type { PontoQuente } from './base';

// Na ordem do Tab e da lista: de fora para dentro: as longarinas, a antena, o vidro, o quadro e o motor do teto solar, os airbags, o forro e o que se prende nele.
export const PONTOS: PontoQuente[] = [
  {
    k: 'longarinas', nome: 'Longarinas de teto (rack)', procuro: 'a longarina de teto (rack)', ancora: [1246, 259],
    poligonos: [
      '962,63 935,53 880,55 455,117 334,149 264,196 286,197 375,164 390,172 435,165 450,141 835,79 853,97 898,92 907,75',
      '1342,251 1310,236 1270,234 933,279 722,319 632,365 710,351 732,360 769,355 801,325 1210,262 1226,283 1263,279 1281,260',
    ],
  },
  {
    k: 'antena', nome: 'Antena', procuro: 'a antena', ancora: [1349, 144], tipo: 'Som e Multimídia', sub: 'Antenas', eh: { cab: 'antena' },
    poligonos: ['1387,98 1380,94 1346,108 1279,157 1269,170 1270,176 1289,185 1307,185 1324,201 1339,207 1386,205 1402,200 1404,191 1398,185 1356,198 1335,197 1326,190 1332,181 1388,164 1390,157 1380,141'],
  },
  {
    k: 'vidro-teto', nome: 'Vidro do teto solar', procuro: 'o vidro do teto solar', ancora: [503, 260],
    poligonos: ['1235,204 1089,111 996,99 436,188 347,212 326,239 406,326 471,348 1216,221'],
  },
  {
    k: 'quadro-teto', nome: 'Quadro do teto solar', procuro: 'o quadro (a máquina) do teto solar', ancora: [459, 490],
    poligonos: ['1269,480 1263,457 1241,454 1174,393 1147,392 1083,353 354,407 324,430 375,539 415,575 450,582 1033,510 1193,504'],
  },
  {
    k: 'motor-teto', nome: 'Motor do teto solar', procuro: 'o motor do teto solar', ancora: [190, 519], tipo: 'Vidro Elétrico', sub: 'Motores do Teto Solar', eh: { cab: 'motor', tem: 'teto' },
    poligonos: ['134,511 135,520 145,528 143,544 148,548 162,548 171,568 180,560 208,561 216,548 230,542 268,565 285,564 289,559 285,548 260,552 227,531 232,524 269,520 274,516 282,496 265,477 225,481 218,477 208,478 199,468 190,467 181,482 166,484 155,501 141,503'],
  },
  // o estoque não separa o airbag de cortina: o link é o tipo inteiro (airbags, módulos e sensores) e o nome diz isso
  {
    k: 'airbags', nome: 'Airbags (o de cortina e os outros)', procuro: 'o airbag de cortina', ancora: [1379, 850], tipo: 'Airbag e Segurança', sub: 'Airbags, Módulos e Sensores', eh: { cab: 'airbag cortina bolsa' },
    poligonos: [
      '1442,560 1427,547 1395,552 1387,561 1368,541 1340,570 1313,561 1212,567 1212,580 1197,568 1111,574 1088,560 1080,574 1085,582 1066,597 1051,584 1052,576 991,581 971,595 970,608 1294,592 1438,575',
      '1466,842 1453,827 1393,837 1379,823 1359,843 1266,848 1177,864 1141,863 1133,849 1122,848 1111,869 1016,877 998,893 996,908 1315,879 1460,856',
    ],
  },
  {
    k: 'forro', nome: 'Forro do teto', procuro: 'o forro do teto', ancora: [1250, 725],
    poligonos: ['330,691 367,668 400,661 602,646 801,635 899,633 1000,622 1078,621 1190,633 1223,654 1363,736 1389,750 1389,764 1363,772 1218,780 1139,797 921,814 703,831 647,845 540,860 468,876 451,873 442,853 333,705'],
  },
  {
    k: 'alcas', nome: 'Alças de teto', procuro: 'a alça de teto', ancora: [939, 885], tipo: 'Acabamentos e Forros', sub: 'Alças e Puxadores', eh: { cab: 'alca pega' },
    poligonos: [
      '665,622 660,608 645,595 630,592 584,595 557,599 541,605 528,619 523,637 529,643 550,641 555,636 554,624 558,620 607,612 631,612 633,626 640,632 659,631 663,629',
      '924,593 917,578 904,568 889,565 851,567 812,573 800,578 786,594 782,610 790,617 808,615 814,610 814,598 819,592 847,587 888,584 892,587 893,601 902,606 921,603 924,600',
      '959,888 952,872 942,862 930,857 902,856 853,861 827,867 815,874 806,885 800,900 800,908 808,916 831,913 836,906 835,895 841,888 872,883 918,880 922,883 923,896 931,903 956,900 959,896',
      '703,918 699,903 690,892 679,886 665,883 631,885 587,891 569,897 557,906 551,915 547,935 554,943 577,941 582,937 583,921 587,917 635,909 665,908 668,924 675,930 698,928',
    ],
  },
  {
    k: 'quebra-sois', nome: 'Quebra-sóis', procuro: 'o quebra-sol', ancora: [140, 866], tipo: 'Acabamentos e Forros', sub: 'Quebra-sóis', eh: { cab: 'quebra-sol' },
    poligonos: [
      '75,650 76,660 99,703 105,706 126,704 137,710 279,710 288,702 281,671 297,663 289,641 269,638 261,641 262,655 258,658 108,634 83,638',
      '352,836 341,816 317,817 316,834 297,839 265,833 143,829 122,835 115,854 135,894 146,904 161,901 184,907 266,902 340,893 345,878 336,850 350,843',
    ],
  },
  {
    k: 'luz-teto', nome: 'Luz de teto', procuro: 'a luz de teto', ancora: [213, 769], tipo: 'Acabamentos e Forros', sub: 'Luzes Internas', eh: { cab: 'luz', tem: 'teto' },
    poligonos: ['107,748 111,764 128,795 160,813 176,813 190,807 201,811 229,810 236,806 251,809 273,807 295,796 302,784 301,763 295,741 288,734 273,730 231,727 149,729 120,734 111,740'],
  },
];
