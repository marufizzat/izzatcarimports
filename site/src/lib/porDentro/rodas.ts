// "A suspensão por dentro": a vista explodida de um canto dianteiro do carro (public/arte/v2/raio-x-rodas.webp,
// 1536×1024): a roda, a pinça, o disco, o defletor, o cubo, a manga de eixo e o semieixo em fila, no eixo da roda; o
// amortecedor com a mola e o coxim em pé; a bandeja e o braço embaixo; a barra estabilizadora com a bieleta, a caixa de
// direção e o agregado atrás; e o sensor ABS.
// O estoque não tem disco de freio como tipo: o ponto dele é de pátio. O semieixo é do bloco Câmbio e Transmissão
// (no painel das zonas ele fica em "Embaixo"): aqui ele aparece porque é na roda que a pessoa o vê.
// Cada peça da arte é um ponto quente com a FORMA dela (contornos tirados da própria arte e conferidos com ela por
// baixo) e leva ao link EXATO do catálogo daquele tipo (lib/porDentro/base.ts). Sem node:fs: roda no build, no teste
// e no navegador (só quando a vista abre: components/v2/raioXPorDentro.ts).
import type { PontoQuente } from './base';

// Na ordem do Tab e da lista: da roda para dentro do carro, depois o amortecedor de cima para baixo, os braços e o que fica atrás.
export const PONTOS: PontoQuente[] = [
  {
    k: 'roda', nome: 'Roda', procuro: 'a roda', ancora: [191, 790], tipo: 'Rodas', sub: 'Rodas',
    poligonos: ['137,626 86,659 58,716 52,790 70,868 105,931 129,955 127,962 208,983 273,977 257,957 293,932 324,869 329,796 322,741 290,674 249,632 208,617'],
  },
  {
    k: 'pinca', nome: 'Pinça de freio', procuro: 'a pinça de freio', ancora: [367, 731], tipo: 'Freios', sub: 'Pinças de Freio',
    poligonos: ['379,659 353,665 346,672 338,675 326,704 329,754 337,781 346,798 356,800 370,809 389,807 400,801 399,786 404,779 407,721 404,719 401,698 392,685 397,677 397,671 393,664'],
  },
  {
    k: 'disco', nome: 'Disco de freio', procuro: 'o disco de freio', ancora: [482, 746],
    poligonos: ['458,645 438,652 422,672 415,695 412,740 421,778 437,809 458,829 480,833 501,828 514,817 524,800 532,769 531,737 523,703 507,670 487,651 471,645'],
  },
  {
    k: 'defletor', nome: 'Defletor do disco', procuro: 'o defletor (espelho) do disco de freio', ancora: [556, 655], tipo: 'Freios', sub: 'Espelhos e Defletores do Disco',
    poligonos: ['535,622 522,643 522,650 533,668 531,681 535,686 546,679 559,682 572,706 572,731 568,740 560,747 544,746 544,755 550,763 547,787 552,796 551,803 569,805 587,795 605,769 611,743 609,702 599,668 582,641 559,625'],
  },
  {
    k: 'cubo', nome: 'Cubo de roda', procuro: 'o cubo de roda', ancora: [664, 685], tipo: 'Suspensão e Direção', sub: 'Cubos de Roda',
    poligonos: ['648,639 639,644 632,655 623,657 619,661 621,668 631,672 630,680 633,699 624,704 623,711 626,714 639,713 644,720 645,727 649,729 653,728 660,731 672,730 679,727 686,719 689,708 694,704 700,692 702,676 696,664 689,658 682,656 670,642 659,638'],
  },
  {
    k: 'manga', nome: 'Manga de eixo', procuro: 'a manga de eixo', ancora: [776, 550], tipo: 'Suspensão e Direção', sub: 'Mangas de Eixo',
    poligonos: ['793,522 759,523 746,530 748,562 734,588 720,578 701,584 701,596 716,616 716,630 708,648 715,660 724,724 715,755 729,768 756,761 760,736 781,710 796,705 819,710 832,701 828,685 810,679 797,667 786,630 786,572 801,552 801,527'],
  },
  {
    k: 'semieixo', nome: 'Semieixo', procuro: 'o semieixo', ancora: [1045, 629], tipo: 'Câmbio e Transmissão', sub: 'Semieixos', eh: { cab: 'semieixo' },
    poligonos: ['1111,618 1107,610 1093,609 1079,599 1043,595 1022,602 1003,623 943,634 914,621 890,619 863,629 846,649 823,653 820,665 826,672 849,669 874,684 899,685 925,675 949,655 998,647 1030,662 1053,662 1087,647 1095,635 1110,628'],
  },
  {
    k: 'coxim-amortecedor', nome: 'Coxim do amortecedor', procuro: 'o coxim do amortecedor', ancora: [659, 82], tipo: 'Suspensão e Direção', sub: 'Coxins do Amortecedor',
    poligonos: ['614,68 614,80 618,87 629,96 629,101 633,106 643,111 687,111 697,106 702,101 702,96 718,81 718,70 706,61 706,50 701,46 696,48 696,55 692,58 675,52 651,53 641,57 637,54 637,46 629,44 627,45 626,59'],
  },
  {
    k: 'mola', nome: 'Mola', procuro: 'a mola', ancora: [662, 232], tipo: 'Suspensão e Direção', sub: 'Molas',
    poligonos: ['624,121 613,145 642,158 615,165 610,171 615,181 643,186 693,181 707,192 693,200 666,195 615,200 612,213 632,223 615,235 615,245 620,249 657,249 663,254 670,247 689,244 695,254 710,253 709,237 718,224 711,207 721,195 720,184 711,175 721,162 721,154 712,143 716,126 695,117'],
  },
  {
    k: 'amortecedor', nome: 'Amortecedor', procuro: 'o amortecedor', ancora: [664, 374], tipo: 'Suspensão e Direção', sub: 'Amortecedores',
    poligonos: ['660,260 656,343 611,357 603,368 610,381 645,401 645,467 627,478 627,495 634,503 627,548 666,564 691,556 687,446 714,439 714,421 690,415 686,401 690,393 717,379 723,366 710,355 673,343 671,261'],
  },
  {
    k: 'barra', nome: 'Barra estabilizadora e bieleta', procuro: 'a barra estabilizadora ou a bieleta', ancora: [1233, 585], tipo: 'Suspensão e Direção', sub: 'Bieletas e Barras Estabilizadoras',
    poligonos: [
      '842,542 850,569 878,572 886,558 938,559 946,581 969,589 976,580 985,590 989,566 1202,598 1212,622 1246,622 1253,634 1255,609 1278,609 1339,637 1368,615 1389,559 1371,550 1351,606 1327,615 1259,586 1249,569 1180,576 992,548 982,532 959,527 939,540 894,536 864,547 888,511 881,497 862,507',
      '750,299 744,304 740,318 742,324 752,332 753,430 746,436 742,451 747,460 767,465 778,458 787,459 792,453 790,448 780,445 765,426 765,334 777,324 789,323 790,315 779,311 768,300',
    ],
  },
  {
    k: 'bandeja', nome: 'Bandeja da suspensão', procuro: 'a bandeja da suspensão', ancora: [831, 829], tipo: 'Suspensão e Direção', sub: 'Bandejas da Suspensão',
    poligonos: ['958,829 935,816 905,823 877,817 886,799 886,769 869,756 849,754 831,762 818,782 753,805 708,836 694,824 694,800 681,798 677,825 663,848 669,877 663,886 673,893 699,894 810,877 950,881 958,864'],
  },
  {
    k: 'braco', nome: 'Braço da suspensão', procuro: 'o braço da suspensão', ancora: [1055, 807], tipo: 'Suspensão e Direção', sub: 'Braços da Suspensão',
    poligonos: ['1259,765 1252,754 1226,747 1200,766 1076,786 1053,777 1041,778 1030,787 1025,800 1027,815 1034,824 1028,832 1053,834 1122,822 1130,815 1208,800 1216,804 1254,800 1259,796 1255,791'],
  },
  {
    k: 'caixa-direcao', nome: 'Caixa de direção', procuro: 'a caixa de direção', ancora: [1156, 189], tipo: 'Suspensão e Direção', sub: 'Caixas de Direção',
    poligonos: ['831,173 837,195 922,201 960,223 1014,229 1025,252 1084,236 1199,256 1214,280 1260,266 1312,275 1368,267 1452,288 1471,279 1459,233 1435,266 1365,254 1325,228 1261,220 1250,204 1200,216 1216,156 1198,141 1155,136 1100,154 1107,197 1094,201 1060,175 1025,190 970,178 925,190 863,183 848,145'],
  },
  {
    k: 'agregado', nome: 'Agregado (quadro da suspensão)', procuro: 'o agregado (quadro da suspensão)', ancora: [1089, 397], tipo: 'Suspensão e Direção', sub: 'Quadros da Suspensão',
    poligonos: ['818,374 819,392 872,424 879,462 1232,518 1251,488 1283,491 1344,468 1347,453 1474,394 1477,369 1446,363 1413,374 1408,339 1386,333 1309,358 1176,340 1102,283 1007,324 972,303 965,277 935,272 885,290 885,314 913,319 917,353 871,348'],
  },
  {
    k: 'sensor-abs', nome: 'Sensor ABS', procuro: 'o sensor ABS', ancora: [389, 502], tipo: 'Freios', sub: 'Sensores ABS',
    poligonos: ['549,435 519,423 476,422 461,435 446,465 436,476 410,480 387,474 380,482 380,490 369,494 364,506 368,512 382,515 385,536 397,539 401,535 401,514 405,509 405,497 400,489 428,486 443,479 474,431 486,426 503,428 523,447 535,453 550,448'],
  },
];
