// "A lateral por dentro": a vista explodida das portas (public/arte/v2/raio-x-lateral.webp, 1536×1024): a porta
// dianteira à esquerda e a traseira à direita (a frente do carro para a esquerda, como na arte do Raio-x), cada uma
// com o vidro em cima, a máquina de vidro e a fechadura ao lado, o forro com a maçaneta interna no alto e a maçaneta
// externa embaixo; o retrovisor com a capa, os botões do vidro, as dobradiças com o limitador e a soleira.
// UMA arte para as DUAS laterais: o desenho é o do lado esquerdo e não é espelhado; o que muda é o LADO dos links
// (pontosLateral('E') para a zona "lateral-esquerda", pontosLateral('D') para a "lateral-direita"). O nome de cada
// ponto não repete o lado (o título do painel já diz "A lateral esquerda por dentro"); a mensagem do WhatsApp diz.
// Dianteira/traseira: a máquina de vidro, a fechadura e a porta levam a posição no link (o estoque escreve
// "dianteira"/"traseira" em quase todas); as peças desenhadas nas duas portas com um ponto só (vidros, maçanetas,
// forros) vão sem a posição: o catálogo mostra as das duas portas daquele lado.
// Cada peça da arte é um ponto quente com a FORMA dela (contornos tirados da própria arte e conferidos com ela por
// baixo) e leva ao link EXATO do catálogo daquele tipo (lib/porDentro/base.ts). Sem node:fs: roda no build, no teste
// e no navegador (só quando a vista abre: components/v2/raioXPorDentro.ts).
import type { Lado } from '../busca';
import type { PontoQuente } from './base';

/** Os pontos quentes da lateral, com o lado nos links e nas mensagens. Na ordem do Tab e da lista: o retrovisor, a
 *  porta dianteira e o que vai nela, a porta traseira, as dobradiças e a soleira. */
export function pontosLateral(lado: Lado): PontoQuente[] {
  const o = lado === 'E' ? 'esquerdo' : 'direito';
  const a = lado === 'E' ? 'esquerda' : 'direita';
  return [
    {
      k: 'retrovisor', nome: 'Retrovisor', procuro: `o retrovisor ${o}`, ancora: [211, 385], tipo: 'Retrovisores', sub: 'Retrovisores Externos', eh: { cab: 'retrovisor', sem: 'interno' }, lado,
      poligonos: ['287,356 266,339 220,331 190,335 164,350 160,347 163,316 157,313 124,348 94,390 78,420 71,444 81,456 154,437 194,441 261,429 272,423 280,410 287,380'],
    },
    {
      k: 'capa-retrovisor', nome: 'Capa do retrovisor', procuro: `a capa do retrovisor ${o}`, ancora: [376, 384], tipo: 'Retrovisores', sub: 'Capas e Molduras do Retrovisor', eh: { cab: 'capa', tem: 'retrovisor espelho', sem: 'interno interna' }, lado,
      poligonos: ['434,380 423,366 415,362 387,356 368,358 348,365 322,380 312,391 303,417 310,423 335,430 346,420 360,416 368,418 374,413 398,406 407,409 415,403 429,406 434,398'],
    },
    {
      k: 'porta-dianteira', nome: 'Porta dianteira', procuro: `a porta dianteira ${a}`, ancora: [610, 695], tipo: 'Para-choques e Lataria', sub: 'Portas', eh: { cab: 'porta' }, lado, pos: 'D',
      poligonos: ['809,442 683,451 589,476 508,524 420,602 390,641 375,882 382,904 373,912 785,874 811,628'],
    },
    {
      k: 'vidros', nome: 'Vidros das portas', procuro: `o vidro da porta ${a}`, ancora: [738, 350], tipo: 'Vidro Elétrico', sub: 'Vidros Laterais', eh: { cab: 'vidro' }, lado,
      poligonos: [
        '836,277 788,272 721,279 589,314 478,396 460,448 479,452 558,444 568,455 581,456 598,439 707,426 732,439 748,421 795,415',
        '1335,316 1330,312 1233,315 1107,336 1093,350 1066,412 1064,426 1070,441 1078,448 1119,448 1133,460 1145,458 1153,445 1265,434 1274,445 1287,446 1301,431 1331,427 1351,382',
      ],
    },
    {
      k: 'maquina-dianteira', nome: 'Máquina de vidro dianteira', procuro: `a máquina de vidro dianteira ${a}`, ancora: [326, 605], tipo: 'Vidro Elétrico', sub: 'Máquinas e Motores de Vidro Elétrico', eh: { cab: 'maquina motor' }, lado, pos: 'D',
      poligonos: ['241,480 230,486 222,595 209,607 208,618 218,623 210,694 195,708 206,721 204,743 225,746 245,737 289,652 350,660 343,719 330,725 328,736 340,754 357,758 378,733 364,714 383,556 400,544 386,525 398,505 382,498 354,503 286,571 269,525 269,506 282,491'],
    },
    {
      k: 'fechadura-dianteira', nome: 'Fechadura dianteira', procuro: `a fechadura da porta dianteira ${a}`, ancora: [870, 659], tipo: 'Maçanetas e Fechaduras', sub: 'Fechaduras das Portas', eh: { cab: 'fechadura trava', sem: 'tampa porta-malas capo banco' }, lado, pos: 'D',
      poligonos: ['902,531 875,547 866,590 860,596 859,607 841,616 840,640 832,646 831,690 832,700 846,715 874,718 890,709 893,704 891,689 904,676 907,629 897,616 874,606 871,596 878,555 886,547 903,540 905,533'],
    },
    {
      k: 'macanetas', nome: 'Maçanetas externas', procuro: `a maçaneta externa ${a}`, ancora: [966, 917], tipo: 'Maçanetas e Fechaduras', sub: 'Maçanetas das Portas', lado, eh: { cab: 'macaneta', sem: 'interna interno tampa porta-malas camera' },
      poligonos: [
        '1010,894 1000,887 972,890 965,886 954,890 944,885 891,891 830,910 819,921 815,935 826,944 821,949 823,952 860,954 869,948 885,947 870,941 879,931 938,926 944,934 929,940 930,943 942,941 950,950 960,948 966,952 985,938 993,939 1009,923',
        '1357,893 1347,886 1303,888 1286,882 1242,889 1184,908 1173,922 1172,935 1180,942 1177,948 1190,953 1251,955 1255,951 1226,950 1225,936 1238,928 1288,924 1294,932 1283,936 1284,940 1291,939 1298,946 1322,941 1332,945 1345,937 1342,931 1356,919',
      ],
    },
    {
      k: 'forros', nome: 'Forros de porta', procuro: `o forro de porta ${o}`, ancora: [488, 175], tipo: 'Acabamentos e Forros', sub: 'Forros', lado, eh: { cab: 'forro', tem: 'porta', sem: 'porta-malas bagagito tampa' },
      poligonos: [
        '642,56 340,76 286,236 284,261 302,287 293,295 571,279 599,238',
        '1390,56 1113,75 1086,247 1088,262 1103,282 1099,292 1243,287 1281,280 1330,196 1357,170 1389,81',
      ],
    },
    {
      k: 'macanetas-internas', nome: 'Maçanetas internas', procuro: `a maçaneta interna ${a}`, ancora: [723, 129], tipo: 'Maçanetas e Fechaduras', sub: 'Maçanetas Internas', eh: { cab: 'macaneta', sem: 'tampa porta-malas' }, lado,
      poligonos: [
        '771,102 763,95 741,95 670,103 660,110 647,143 646,156 654,163 726,161 743,158 756,146 768,119',
        '1080,108 1072,103 1053,103 979,112 968,120 957,147 955,162 963,169 1006,168 1054,162 1063,155 1073,136 1080,118',
      ],
    },
    {
      k: 'botoes-vidro', nome: 'Botões do vidro elétrico', procuro: `o comando dos vidros ${o}`, ancora: [817, 204], tipo: 'Vidro Elétrico', sub: 'Botões do Vidro Elétrico', eh: { cab: 'botao botoneira comando interruptor', tem: 'vidro' }, lado,
      poligonos: ['902,152 893,146 869,148 754,181 743,191 740,210 746,220 746,229 753,236 760,254 768,257 792,255 813,244 832,242 850,232 879,226 904,213 917,191 919,177'],
    },
    {
      k: 'porta-traseira', nome: 'Porta traseira', procuro: `a porta traseira ${a}`, ancora: [1232, 624], tipo: 'Para-choques e Lataria', sub: 'Portas', eh: { cab: 'porta' }, lado, pos: 'T',
      poligonos: ['1347,449 1095,477 1043,774 1039,883 1278,855 1321,760 1383,713 1409,606'],
    },
    {
      k: 'maquina-traseira', nome: 'Máquina de vidro traseira', procuro: `a máquina de vidro traseira ${a}`, ancora: [993, 613], tipo: 'Vidro Elétrico', sub: 'Máquinas e Motores de Vidro Elétrico', eh: { cab: 'maquina motor' }, lado, pos: 'T',
      poligonos: ['981,490 957,498 956,513 965,519 953,615 942,621 941,638 950,642 947,726 936,733 935,743 946,753 946,772 972,771 967,764 979,755 980,747 968,738 968,732 1002,695 1024,638 1049,635 1057,624 1053,605 1029,600 1037,585 1025,534 1003,510 1003,498'],
    },
    {
      k: 'fechadura-traseira', nome: 'Fechadura traseira', procuro: `a fechadura da porta traseira ${a}`, ancora: [1451, 702], tipo: 'Maçanetas e Fechaduras', sub: 'Fechaduras das Portas', eh: { cab: 'fechadura trava', sem: 'tampa porta-malas capo banco' }, lado, pos: 'T',
      poligonos: ['1481,589 1458,601 1445,647 1426,655 1429,667 1425,672 1425,680 1417,688 1417,736 1429,748 1448,756 1460,755 1475,746 1474,728 1483,719 1484,710 1490,703 1490,682 1482,675 1481,659 1457,646 1459,613 1484,597 1485,593'],
    },
    {
      k: 'dobradicas', nome: 'Dobradiças e limitador de porta', procuro: `a dobradiça ou o limitador de porta ${o}`, ancora: [108, 807], tipo: 'Para-choques e Lataria', sub: 'Dobradiças e Limitadores de Porta', eh: { cab: 'dobradica limitador' }, lado,
      poligonos: [
        '163,560 151,557 145,550 136,547 122,550 120,561 111,566 100,566 82,558 70,560 65,565 62,573 62,612 64,617 72,622 82,622 98,613 115,615 125,622 132,623 143,622 156,617 164,609 165,565',
        '162,667 136,653 122,656 119,667 111,672 98,671 82,664 68,667 64,671 61,681 61,718 63,723 72,728 79,728 98,718 104,718 114,721 124,728 141,728 156,722 162,714',
        '74,778 73,843 78,851 90,854 93,862 113,861 127,867 115,854 126,846 129,835 142,827 177,823 237,826 256,836 271,831 279,818 279,798 258,792 247,793 236,801 178,802 144,795 133,783 133,764 126,757 101,759 83,767',
      ],
    },
    {
      k: 'soleira', nome: 'Soleira', procuro: `a soleira ${a}`, ancora: [248, 952], tipo: 'Acabamentos e Forros', sub: 'Soleiras', eh: { cab: 'soleira', sem: 'porta-malas tampa' }, lado,
      poligonos: ['722,918 362,934 218,931 209,937 203,966 246,972 708,956 705,949'],
    },
  ];
}
