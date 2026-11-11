// "O interior por dentro": a vista explodida da cabine (public/arte/v2/raio-x-interior.webp, 1536×1024), vista de trás:
// o painel no alto com as peças dele soltas na frente (instrumentos, difusores, multimídia, comando do ar,
// porta-luvas), o volante com o airbag e a chave de seta à esquerda, os pedais, a alavanca, o console, os bancos, o
// cinto e a caixa de fusíveis.
// O estoque não tem banco inteiro como tipo: o ponto dos bancos é de pátio (WhatsApp: "a gente procura no pátio").
// Cada peça da arte é um ponto quente com a FORMA dela (contornos tirados da própria arte e conferidos com ela por
// baixo) e leva ao link EXATO do catálogo daquele tipo (lib/porDentro/base.ts). Sem node:fs: roda no build, no teste
// e no navegador (só quando a vista abre: components/v2/raioXPorDentro.ts).
import { TIPO_INTEIRO, type PontoQuente } from './base';

// Na ordem do Tab e da lista: do painel para trás: o painel e as peças dele, o volante, os pedais, a alavanca, o console, os bancos.
export const PONTOS: PontoQuente[] = [
  {
    k: 'painel', nome: 'Painel (acabamentos)', procuro: 'o acabamento do painel', ancora: [1184, 193], tipo: 'Painel e Console', sub: 'Acabamentos do Painel', eh: TIPO_INTEIRO,
    poligonos: ['547,158 566,198 701,222 739,202 798,212 902,180 946,202 960,189 984,207 1008,193 1048,200 1036,314 1055,327 1275,334 1323,358 1363,337 1351,310 1371,247 1411,251 1438,199 1403,142 1415,123 1385,98 1210,58 1013,38 661,52 567,98'],
  },
  {
    k: 'instrumentos', nome: 'Painel de instrumentos', procuro: 'o painel de instrumentos', ancora: [574, 267], tipo: 'Painel e Console', sub: 'Painéis de Instrumentos', eh: { cab: 'painel velocimetro', tem: 'instrumento velocimetro' },
    poligonos: ['477,236 479,250 468,269 468,280 480,306 495,320 499,333 515,335 524,326 580,330 623,339 629,349 648,352 660,335 683,324 689,303 699,296 700,285 690,276 683,246 671,242 649,217 632,217 578,204 542,204 502,214'],
  },
  {
    k: 'difusores', nome: 'Difusores de ar', procuro: 'o difusor de ar', ancora: [1444, 292], tipo: 'Painel e Console', sub: 'Difusores de Ar', eh: { cab: 'difusor' },
    poligonos: [
      '530,127 522,124 510,126 497,121 478,120 467,127 457,127 441,134 435,139 429,152 425,171 426,180 431,185 437,187 484,193 497,193 505,189 525,173 526,154 531,148 532,140',
      '898,202 890,200 846,199 809,210 797,220 792,240 792,251 797,257 803,259 854,266 871,265 893,249 895,227 900,219',
      '1040,227 1033,221 1032,217 1027,215 1007,216 1001,212 979,213 971,218 966,218 951,225 937,237 932,260 933,268 937,273 942,275 1001,283 1009,282 1033,265 1035,259 1034,247 1040,236',
      '1490,268 1476,259 1476,253 1458,249 1442,248 1421,259 1410,257 1391,265 1382,275 1377,291 1374,314 1377,319 1384,323 1444,332 1457,332 1483,312 1485,306 1484,293 1489,282',
    ],
  },
  {
    k: 'multimidia', nome: 'Central multimídia', procuro: 'a central multimídia', ancora: [843, 336], tipo: 'Som e Multimídia', sub: 'Centrais Multimídia', eh: [{ cab: 'central radio multimidia tela display' }, { cab: 'modulo', tem: 'multimidia' }],
    poligonos: ['761,301 760,313 771,320 769,346 757,352 756,363 782,385 797,388 803,396 815,397 822,390 879,397 885,406 899,407 906,401 920,400 933,388 946,383 946,370 935,365 937,339 951,336 955,322 941,314 943,295 939,291 789,273 776,280 774,295'],
  },
  {
    k: 'comando-ar', nome: 'Comando do ar-condicionado', procuro: 'o comando do ar-condicionado', ancora: [904, 454], tipo: 'Ar-condicionado', sub: 'Comandos de Ar Condicionado', eh: { cab: 'comando modulo painel', tem: 'ar ac ventilacao temperatura climatizador' },
    poligonos: ['768,416 767,427 772,433 769,461 780,470 922,488 934,481 937,455 947,449 949,442 948,432 938,426 781,409'],
  },
  {
    k: 'porta-luvas', nome: 'Porta-luvas', procuro: 'o porta-luvas', ancora: [1181, 404], tipo: 'Painel e Console', sub: 'Porta-luvas', eh: { cab: 'porta-luvas caixa', tem: 'porta-luvas' },
    poligonos: ['1038,365 1039,392 1051,399 1067,447 1078,452 1284,472 1294,461 1307,407 1318,398 1318,382 1304,377 1304,360 1285,355 1099,339 1078,351 1053,350'],
  },
  {
    k: 'volante', nome: 'Volante', procuro: 'o volante', ancora: [335, 369], tipo: 'Pedais e Volante', sub: 'Volantes', eh: { cab: 'volante' },
    poligonos: ['346,238 300,247 258,280 235,321 225,368 230,416 247,456 274,485 315,502 356,499 397,476 428,437 446,380 444,334 421,280 389,251'],
  },
  {
    k: 'airbag', nome: 'Airbag e módulos', procuro: 'o airbag', ancora: [135, 389], tipo: 'Airbag e Segurança', sub: 'Airbags, Módulos e Sensores', eh: { cab: 'airbag cortina bolsa modulo', tem: 'airbag' },
    poligonos: ['85,350 75,367 76,389 90,429 107,442 149,447 158,439 172,441 179,436 212,393 214,369 209,355 203,352 195,341 129,334 106,338'],
  },
  {
    k: 'chave-seta', nome: 'Chave de seta', procuro: 'a chave de seta', ancora: [588, 412], tipo: 'Botões e Chaves de Seta', sub: 'Chaves de Seta e Luz', eh: { cab: 'chave alavanca', tem: 'seta luz farol limpador pisca' },
    poligonos: ['461,366 464,377 506,390 538,411 538,430 546,438 547,449 567,456 582,454 593,466 603,466 609,457 622,453 635,419 663,407 700,405 711,395 705,381 676,380 638,399 626,378 614,376 605,368 586,369 573,363 548,368 547,378 535,386 508,365 471,355'],
  },
  {
    k: 'pedais', nome: 'Pedais', procuro: 'o pedal', ancora: [134, 528], tipo: 'Pedais e Volante', sub: 'Pedais', eh: { cab: 'pedal pedaleira' },
    poligonos: [
      '165,498 144,492 119,495 117,505 107,517 105,531 107,543 116,549 109,592 103,601 80,602 68,631 68,643 72,647 137,657 143,652 155,625 156,613 150,608 128,605 124,600 131,578 142,572 147,562 161,557 161,520 168,512',
      '237,502 208,503 201,522 201,534 190,538 183,549 184,562 195,569 197,599 186,613 164,676 163,686 171,694 205,694 197,684 218,620 218,612 213,607 216,583 220,580 235,581 240,575 240,532 247,512 244,505',
    ],
  },
  {
    k: 'alavanca', nome: 'Alavanca de câmbio', procuro: 'a alavanca de câmbio', ancora: [714, 562], tipo: 'Câmbio e Transmissão', sub: 'Alavancas e Manoplas de Câmbio', eh: { cab: 'alavanca manopla' },
    poligonos: ['735,458 715,457 705,462 695,473 693,491 699,512 700,532 666,562 660,575 660,585 672,591 677,604 694,606 700,602 710,603 733,588 752,583 750,570 756,559 756,552 748,538 725,531 732,500 745,473 744,465'],
  },
  {
    k: 'console', nome: 'Console central', procuro: 'o console central', ancora: [687, 695], tipo: 'Painel e Console', sub: 'Consoles', eh: { cab: 'console' },
    poligonos: ['959,544 869,527 821,549 789,591 733,623 665,614 622,633 571,672 569,744 639,760 690,786 921,659 961,561'],
  },
  {
    k: 'bancos', nome: 'Bancos', procuro: 'o banco', ancora: [1174, 678],
    poligonos: [
      '376,513 349,578 357,610 324,632 317,655 345,869 366,904 348,928 353,946 378,959 382,933 430,919 483,935 454,951 531,983 626,926 673,926 665,885 682,788 604,756 538,751 505,663 447,629 472,598 462,530 417,512',
      '1478,507 1450,487 1437,453 1406,442 1349,465 1328,504 1288,486 1232,505 1207,557 1168,528 1090,550 1072,601 1035,636 785,748 801,897 806,879 830,889 838,862 1016,918 1029,877 1400,726',
    ],
  },
  {
    k: 'cinto', nome: 'Cinto de segurança', procuro: 'o cinto de segurança', ancora: [220, 865], tipo: 'Airbag e Segurança', sub: 'Cintos de Segurança', eh: { cab: 'cinto' },
    poligonos: [
      '294,541 267,565 245,658 232,676 239,693 210,817 193,824 183,843 180,868 188,896 219,914 247,904 260,872 254,832 247,827 252,778 271,700 284,681 277,667 298,592 312,571 304,547',
      '309,806 294,804 285,809 281,814 280,850 285,860 286,877 282,898 270,912 270,925 273,928 279,923 284,923 293,928 301,921 297,914 303,907 301,898 302,877 306,862 313,850 317,823 317,810',
    ],
  },
  {
    k: 'caixa-fusiveis', nome: 'Caixa de fusíveis', procuro: 'a caixa de fusíveis', ancora: [1201, 911], tipo: 'Módulos e Elétrica', sub: 'Caixas de Fusíveis', eh: { cab: 'caixa', tem: 'fusivel' },
    poligonos: [
      '1309,843 1303,837 1282,831 1256,829 1228,821 1205,823 1182,838 1176,850 1148,877 1139,880 1120,905 1119,923 1127,933 1129,950 1124,961 1223,975 1240,971 1250,962 1246,955 1254,942 1302,890 1304,871 1310,863',
      '1348,857 1330,875 1330,885 1314,905 1304,910 1301,922 1296,927 1296,941 1314,956 1321,954 1328,959 1341,956 1376,963 1383,970 1391,969 1397,973 1421,970 1434,958 1462,911 1472,907 1476,901 1475,877 1459,864 1439,866 1398,858 1387,850 1359,852',
    ],
  },
];
