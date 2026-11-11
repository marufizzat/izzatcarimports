// "O carro por baixo": a vista explodida do que fica embaixo do carro (public/arte/v2/raio-x-embaixo.webp, 1536×1024),
// com a frente do carro à esquerda: o câmbio com o coxim e o módulo, a caixa de transferência, o cardan, o diferencial
// traseiro e os semieixos; no alto, a linha do escapamento (catalisador, tubo flexível, tubo e silencioso); embaixo, o
// protetor de cárter, o tanque e a bomba de combustível.
// O estoque não tem protetor de cárter como tipo: o ponto dele é de pátio.
// Cada peça da arte é um ponto quente com a FORMA dela (contornos tirados da própria arte e conferidos com ela por
// baixo) e leva ao link EXATO do catálogo daquele tipo (lib/porDentro/base.ts). Sem node:fs: roda no build, no teste
// e no navegador (só quando a vista abre: components/v2/raioXPorDentro.ts).
import type { PontoQuente } from './base';

// Na ordem do Tab e da lista: da frente para trás: o câmbio, a transmissão até o diferencial, o escapamento, o tanque.
export const PONTOS: PontoQuente[] = [
  {
    k: 'cambio', nome: 'Câmbio', procuro: 'o câmbio', ancora: [342, 515], tipo: 'Câmbio e Transmissão', sub: 'Câmbios e Peças Internas',
    poligonos: ['188,378 162,440 162,493 189,577 214,601 255,607 291,627 338,640 456,610 491,571 495,555 487,544 501,535 508,513 495,487 504,439 493,429 490,409 466,406 458,397 413,402 336,394 308,375 280,372 272,379 232,360'],
  },
  {
    k: 'coxim-cambio', nome: 'Coxim do câmbio', procuro: 'o coxim do câmbio', ancora: [175, 668], tipo: 'Câmbio e Transmissão', sub: 'Coxins do Câmbio',
    poligonos: ['179,605 174,604 169,611 151,618 151,627 142,635 142,648 132,662 131,673 126,677 114,675 105,683 106,692 128,706 133,720 128,736 136,743 146,743 165,733 186,704 197,705 209,700 247,710 262,707 267,702 264,691 242,685 238,674 218,666 211,655 210,633 202,626 201,617 184,611'],
  },
  {
    k: 'modulo-cambio', nome: 'Módulo do câmbio', procuro: 'o módulo do câmbio', ancora: [415, 334], tipo: 'Câmbio e Transmissão', sub: 'Módulos do Câmbio e da Tração',
    poligonos: ['469,340 468,333 459,329 454,322 418,304 406,308 395,308 361,315 352,319 346,326 340,325 336,331 340,339 350,343 380,363 387,359 401,358 410,364 447,357 451,354 454,345 463,345'],
  },
  {
    k: 'caixa-transferencia', nome: 'Caixa de transferência', procuro: 'a caixa de transferência', ancora: [602, 475], tipo: 'Câmbio e Transmissão', sub: 'Caixas de Transferência',
    poligonos: ['576,402 564,409 561,420 552,428 555,436 552,458 546,463 535,454 525,460 522,484 526,505 534,517 543,517 552,508 561,509 576,525 584,541 615,544 622,536 639,531 643,513 657,505 662,494 675,487 683,490 693,487 695,462 688,448 683,446 671,454 653,454 634,430 635,419 617,414 612,401 599,400 592,410'],
  },
  {
    k: 'cardan', nome: 'Cardan', procuro: 'o cardan', ancora: [915, 438], tipo: 'Câmbio e Transmissão', sub: 'Cardans',
    poligonos: ['1128,403 1101,393 1059,409 948,420 925,400 900,401 881,426 766,441 752,435 712,440 709,475 722,486 735,486 769,470 884,455 888,460 873,466 877,476 918,473 937,487 956,485 959,473 943,465 949,447 1060,434 1120,437 1128,431'],
  },
  {
    k: 'diferencial', nome: 'Diferencial traseiro', procuro: 'o diferencial traseiro', ancora: [1255, 413], tipo: 'Câmbio e Transmissão', sub: 'Diferenciais',
    poligonos: ['1145,381 1140,412 1145,433 1154,445 1167,446 1182,434 1195,452 1222,463 1238,486 1263,491 1272,489 1291,467 1306,462 1324,417 1339,428 1350,428 1359,421 1363,408 1361,383 1348,363 1336,362 1323,379 1314,380 1296,369 1295,360 1269,354 1260,343 1247,351 1228,344 1218,352 1207,344 1190,351 1189,367 1178,389 1160,376'],
  },
  {
    k: 'semieixos', nome: 'Semieixos traseiros', procuro: 'o semieixo traseiro', ancora: [1175, 514], tipo: 'Câmbio e Transmissão', sub: 'Semieixos e Suportes',
    poligonos: [
      '1432,274 1428,270 1414,272 1390,262 1377,262 1358,272 1350,285 1343,290 1322,296 1301,289 1283,290 1259,306 1254,314 1239,318 1238,326 1243,331 1260,328 1279,334 1295,334 1315,322 1322,311 1350,302 1377,309 1396,305 1416,286 1430,282',
      '1236,505 1231,498 1212,501 1185,489 1170,489 1143,502 1129,515 1093,520 1076,511 1057,510 1029,526 1023,534 1005,538 1003,548 1008,553 1026,550 1051,559 1067,559 1082,553 1099,536 1139,530 1157,539 1177,541 1209,525 1215,517 1233,513',
    ],
  },
  {
    k: 'catalisador', nome: 'Catalisador', procuro: 'o catalisador', ancora: [339, 230], tipo: 'Escapamento', sub: 'Catalisadores',
    poligonos: ['428,134 410,126 391,130 377,144 361,180 342,174 303,180 284,189 250,228 239,209 211,219 225,281 256,297 271,279 287,285 321,281 342,285 411,273 432,257 446,259 453,236 447,215 401,186 379,184 387,144 403,133 425,142'],
  },
  {
    k: 'flexivel', nome: 'Tubo flexível do escapamento', procuro: 'o tubo flexível do escapamento', ancora: [561, 228], tipo: 'Escapamento', sub: 'Tubos Flexíveis',
    poligonos: ['621,221 616,207 607,197 601,198 593,207 567,203 520,209 495,221 486,212 477,211 473,216 473,241 484,261 489,266 495,267 500,264 501,256 510,252 528,257 577,250 594,242 612,251 618,247'],
  },
  {
    k: 'escapamento', nome: 'Escapamento (tubo e silencioso)', procuro: 'o escapamento (tubo e silencioso)', ancora: [1160, 180], tipo: 'Escapamento', sub: 'Escapamentos',
    poligonos: ['1400,165 1319,147 1282,115 1167,135 1148,103 1127,112 1153,111 1155,134 1101,147 1084,179 949,174 931,140 911,149 935,149 937,171 891,185 846,225 800,229 733,201 649,195 639,222 654,250 669,235 734,232 767,247 783,277 804,268 783,269 782,257 860,251 918,206 1032,196 1148,229 1299,198 1322,174 1383,188'],
  },
  {
    k: 'tanque', nome: 'Tanque de combustível', procuro: 'o tanque de combustível', ancora: [802, 791], tipo: 'Injeção e Combustível', sub: 'Tanques de Combustível',
    poligonos: ['1253,756 1243,712 1189,674 1076,674 1002,697 971,738 927,744 807,686 731,697 671,737 659,773 683,833 747,869 747,881 785,888 900,877 925,864 914,858 924,847 973,842 1005,847 987,858 1005,867 1126,859 1158,848 1152,834 1229,803'],
  },
  {
    k: 'bomba-combustivel', nome: 'Bomba de combustível', procuro: 'a bomba de combustível', ancora: [907, 637], tipo: 'Injeção e Combustível', sub: 'Bombas de Combustível',
    poligonos: ['865,538 860,555 873,567 876,604 868,616 869,679 883,690 916,693 942,684 945,649 950,644 982,658 1001,656 1012,662 1041,654 1040,640 1026,634 1000,640 998,649 989,654 946,636 940,578 953,554 953,544 946,537 924,533 914,524 885,526 881,534'],
  },
  {
    k: 'protetor-carter', nome: 'Protetor de cárter', procuro: 'o protetor de cárter', ancora: [412, 825],
    poligonos: ['612,862 555,793 566,758 534,729 492,738 458,721 246,768 218,759 162,772 133,791 122,782 100,789 102,804 139,843 255,891 247,900 256,915 312,932 501,905 466,899 529,891 539,880'],
  },
];
