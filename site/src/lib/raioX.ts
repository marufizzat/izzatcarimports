// "Raio-x do carro" (home e página do carro, components/v2/RaioX.astro): quem não sabe o nome da peça aponta ONDE ela
// fica. Cada zona da arte (public/arte/v2/raio-x.webp, 1536×1024, frente para a esquerda, o lado do MOTORISTA = esquerdo
// voltado para quem olha) junta GRUPOS do estoque: um bloco (`c` do busca.json, os 25 de preparar_dados.py) inteiro, um
// bloco sem alguns tipos, ou só alguns tipos (`s`), com lado e posição quando a zona pede (lado/pos, as fichas do catálogo).
// Cada linha do painel é um tipo da zona e o link dela é EXATO no catálogo (tipo + sub + lado/pos + o carro): o número da
// linha é o que o catálogo mostra. A zona inteira não cabe num endereço só (o catálogo entende UM tipo e UM sub), então o
// total da zona é só informação (a soma sem repetir), nunca o número de um botão.
// As contagens saem da MESMA busca do catálogo (`procurar` = Busca.procurar): no build sobre /dados/busca.json, no
// navegador sobre /dados/carro/<k>.json (com marca, modelo e ano: anosNoModelo, peça de 2+ carros e pos 'A' valem igual).
// Sem node:fs e sem valores de lib/busca.ts (só tipos): roda no build, no teste e no navegador sem puxar a busca.
import type { Filtros, Item, Lado, Posicao } from './busca';

/** Um pedaço do estoque: o bloco inteiro, o bloco sem `sem`, ou só os tipos `subs`; com lado/posição se a zona pede. */
export type Grupo = { tipo: string; subs?: string[]; sem?: string[]; lado?: Lado; pos?: Posicao };
export type Zona = {
  k: string;
  /** o nome na arte, nas fichas e no título do painel */
  nome: string;
  /** "da frente": "Ver os 9 tipos da frente", "Agora não há peça da frente…" */
  de: string;
  /** "na frente do carro": a legenda do "Onde fica" da página da peça ("Fica na frente do carro") */
  fica: string;
  /** onde fica o pontinho (e o rótulo flutuante do celular) na arte, em pixels da arte */
  ancora: [number, number];
  /** a etiqueta fixa da arte larga (640+ px): no fundo do estúdio, fora do carro, com uma linha-guia até o ponto.
   *  Duas faixas: em cima (y 62) e embaixo (y 965), espaçadas para não se tocarem a partir de 640 px de arte. */
  etiqueta: [number, number];
  /** a área de toque: polígonos em pixels da arte (as zonas repartem a arte inteira, fundo incluído) */
  poligonos: string[];
  /** o que acende: o contorno da parte de verdade (mais justo que a área de toque, que leva o fundo junto) */
  realce: string[];
  grupos: Grupo[];
};

/** Tamanho da arte (o viewBox do SVG por cima dela). */
export const ARTE = { src: '/arte/v2/raio-x.webp', w: 1536, h: 1024 } as const;

/** Elipse como polígono (as rodas), em pixels da arte. */
export function elipse(cx: number, cy: number, rx: number, ry: number, n = 28): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `${Math.round(cx + rx * Math.cos(a))},${Math.round(cy + ry * Math.sin(a))}`;
  }).join(' ');
}

const lateral = (lado: Lado): Grupo[] => [
  { tipo: 'Retrovisores', subs: ['Retrovisores Externos', 'Capas e Molduras do Retrovisor'], lado },
  { tipo: 'Maçanetas e Fechaduras', subs: ['Fechaduras das Portas', 'Maçanetas das Portas', 'Maçanetas Internas', 'Botões da Trava Elétrica'], lado },
  // o bloco inteiro: o teto solar não tem lado e fica de fora sozinho
  { tipo: 'Vidro Elétrico', lado },
  { tipo: 'Acabamentos e Forros', subs: ['Forros', 'Soleiras', 'Molduras das Portas', 'Frisos das Portas', 'Puxadores das Portas', 'Molduras do Para-lama', 'Molduras Laterais', 'Molduras Externas'], lado },
  { tipo: 'Para-choques e Lataria', subs: ['Dobradiças e Limitadores de Porta', 'Para-lamas', 'Portas', 'Suportes da Carroceria', 'Spoilers', 'Para-barros'], lado },
  // o chicote com lado é o da porta ("Chicote porta dianteira esquerda")
  { tipo: 'Módulos e Elétrica', subs: ['Chicotes Elétricos'], lado },
];

// Ordem = ordem do Tab e das fichas (da frente para trás, como se lê a arte).
// Polígonos: medidos sobre a arte (frente x 175–440, cofre 250–560, porta do motorista entre a linha da cintura
// (590,600)→(1210,395) e o escapamento, teto solar 725–1100 × 155–370, lanterna 1310–1385 × 360–440, rodas
// 420–620 × 700–890 e 1100–1300 × 560–730). A lateral DIREITA fica do outro lado do carro (no alto, em escorço): a
// área dela é o retrovisor de lá e o fundo acima do carro.
export const ZONAS: Zona[] = [
  {
    k: 'frente', nome: 'Frente', de: 'da frente', fica: 'na frente do carro', ancora: [238, 598], etiqueta: [178, 965],
    poligonos: ['0,0 170,0 205,440 300,500 300,675 440,705 405,790 360,1024 0,1024'],
    realce: ['192,468 300,505 304,672 440,700 432,742 372,790 336,846 262,826 200,748 180,612'],
    grupos: [
      { tipo: 'Faróis e Lanternas', subs: ['Faróis', 'Suportes do Farol', 'Módulos e Reatores do Farol', 'Frisos dos Faróis', 'Faróis de Milha'] },
      { tipo: 'Para-choques e Lataria', subs: ['Grades do Para-choque', 'Dobradiças do Capô', 'Isolamentos do Capô', 'Grades', 'Tomadas de Ar', 'Grades do Para-brisa'] },
      { tipo: 'Para-choques e Lataria', subs: ['Para-choques', 'Guias e Suportes do Para-choque', 'Almas do Para-choque', 'Molduras do Para-choque', 'Emblemas'], pos: 'D' },
      { tipo: 'Maçanetas e Fechaduras', subs: ['Fechaduras do Capô'] },
      { tipo: 'Limpador e Lavador', subs: ['Braços do Limpador', 'Sensores de Chuva'] },
      { tipo: 'Limpador e Lavador', subs: ['Motores do Limpador'], pos: 'D' },
    ],
  },
  {
    k: 'motor', nome: 'Motor', de: 'do motor', fica: 'no motor, debaixo do capô', ancora: [405, 528], etiqueta: [232, 62],
    poligonos: ['170,0 440,0 470,312 530,450 590,600 560,615 470,640 440,705 300,675 300,500 205,440'],
    realce: ['206,452 300,388 392,350 468,318 520,446 566,584 512,640 440,690 304,668 300,505'],
    grupos: [
      { tipo: 'Motor' },
      { tipo: 'Mangueiras do Motor' },
      { tipo: 'Injeção e Combustível', sem: ['Tanques de Combustível', 'Bombas de Combustível', 'Boias de Combustível', 'Portinholas e Tampas do Tanque'] },
      { tipo: 'Ignição e Partida' },
      { tipo: 'Arrefecimento' },
      { tipo: 'Filtro de Ar e Turbo' },
      { tipo: 'Ar-condicionado', subs: ['Mangueiras de Ar Condicionado', 'Suportes do Compressor', 'Compressores', 'Condensadores', 'Válvulas de Expansão', 'Kits de Ar Condicionado'] },
      { tipo: 'Freios', subs: ['Hidrovácuos', 'Módulos ABS', 'Cilindros Mestres', 'Reservatórios de Fluido'] },
      { tipo: 'Suspensão e Direção', subs: ['Bombas de Direção e Suportes', 'Mangueiras da Direção'] },
      { tipo: 'Limpador e Lavador', subs: ['Reservatórios do Lavador', 'Bombas e Esguichos do Lavador'] },
      { tipo: 'Módulos e Elétrica', subs: ['Cabos e Terminais de Bateria', 'Caixas e Suportes da Bateria', 'Relés de Partida', 'Buzinas'] },
    ],
  },
  {
    k: 'lateral-esquerda', nome: 'Lateral esquerda', de: 'da lateral esquerda', fica: 'na lateral esquerda, o lado do motorista', ancora: [935, 556], etiqueta: [1112, 965],
    poligonos: ['590,600 680,515 800,500 1210,395 1230,440 1200,480 1150,530 1070,590 900,628 700,660 650,690'],
    realce: ['606,602 690,524 792,516 1204,404 1226,446 1112,560 1104,700 664,780 650,690'],
    grupos: lateral('E'),
  },
  {
    k: 'lateral-direita', nome: 'Lateral direita', de: 'da lateral direita', fica: 'na lateral direita, o lado do passageiro', ancora: [572, 236], etiqueta: [522, 62],
    poligonos: ['440,0 1300,0 1290,140 1235,185 1150,122 700,190 610,282 470,312'],
    realce: ['472,314 536,252 544,206 590,198 602,262 700,186 1150,118 1292,168 1302,204 1150,152 702,216 612,292'],
    grupos: lateral('D'),
  },
  {
    k: 'interior', nome: 'Interior e painel', de: 'do interior e do painel', fica: 'dentro do carro, no interior ou no painel', ancora: [842, 438], etiqueta: [852, 62],
    poligonos: ['470,312 610,282 700,190 690,330 760,385 1110,320 1230,265 1210,395 800,500 680,515 590,600 530,450'],
    realce: ['484,322 612,290 700,214 690,330 760,385 1110,320 1222,276 1204,400 800,504 690,520 602,598 540,470'],
    grupos: [
      { tipo: 'Painel e Console' },
      { tipo: 'Botões e Chaves de Seta' },
      { tipo: 'Pedais e Volante' },
      { tipo: 'Airbag e Segurança' },
      { tipo: 'Som e Multimídia', sem: ['Antenas'] },
      { tipo: 'Ar-condicionado', subs: ['Comandos de Ar Condicionado', 'Atuadores e Motores do Ar', 'Resistências e Relés do Ar', 'Evaporadores', 'Radiadores do Ar Quente', 'Sensores do Ar-condicionado', 'Válvulas da Calefação'] },
      { tipo: 'Acabamentos e Forros', subs: ['Acabamentos de Coluna', 'Grades de Alto-falante', 'Peças de Banco', 'Apoios de Braço', 'Encostos de Cabeça', 'Tapetes e Protetores'] },
      { tipo: 'Retrovisores', subs: ['Retrovisores Internos', 'Botões do Retrovisor'] },
      { tipo: 'Freios', subs: ['Alavancas do Freio de Mão', 'Botões do Freio de Mão', 'Cabo do Freio de Mão'] },
      { tipo: 'Câmbio e Transmissão', subs: ['Alavancas e Manoplas de Câmbio', 'Trambuladores e Seletores'] },
      { tipo: 'Suspensão e Direção', subs: ['Colunas de Direção'] },
      { tipo: 'Módulos e Elétrica', subs: ['Módulos de Conforto (BCM)', 'Caixas de Fusíveis', 'Módulos Eletrônicos', 'Módulos de Ignição e Imobilizador', 'Antenas e Módulos Keyless', 'Alarmes e Sirenes', 'Relés', 'Tomadas Elétricas'] },
      { tipo: 'Maçanetas e Fechaduras', subs: ['Cilindros e Comutadores de Ignição', 'Chaves do Carro', 'Cabos e Alavancas de Abertura'] },
    ],
  },
  {
    k: 'teto', nome: 'Teto', de: 'do teto', fica: 'no teto', ancora: [915, 252], etiqueta: [1112, 62],
    poligonos: ['700,190 1150,122 1235,185 1230,265 1110,320 760,385 690,330'],
    realce: ['704,196 1150,128 1230,188 1226,262 1108,316 762,380 694,330'],
    grupos: [
      { tipo: 'Vidro Elétrico', subs: ['Motores do Teto Solar', 'Botões do Teto Solar'] },
      { tipo: 'Acabamentos e Forros', subs: ['Luzes Internas', 'Quebra-sóis', 'Alças e Puxadores'] },
      { tipo: 'Som e Multimídia', subs: ['Antenas'] },
    ],
  },
  {
    k: 'traseira', nome: 'Traseira', de: 'da traseira', fica: 'na traseira do carro', ancora: [1352, 402], etiqueta: [1384, 62],
    poligonos: ['1300,0 1536,0 1536,1024 1340,1024 1335,560 1330,470 1200,480 1230,440 1210,395 1230,265 1235,185 1290,140'],
    realce: ['1240,192 1300,204 1366,296 1390,420 1382,556 1338,600 1300,560 1240,470 1212,398 1230,268'],
    grupos: [
      { tipo: 'Faróis e Lanternas', subs: ['Lanternas Traseiras', 'Brake Light', 'Refletores', 'Luzes de Placa'] },
      { tipo: 'Maçanetas e Fechaduras', subs: ['Fechaduras do Porta-malas'] },
      { tipo: 'Para-choques e Lataria', subs: ['Dobradiças da Tampa Traseira', 'Aerofólios', 'Suportes da Placa'] },
      { tipo: 'Para-choques e Lataria', subs: ['Amortecedores da Tampa e do Capô', 'Para-choques', 'Guias e Suportes do Para-choque', 'Almas do Para-choque', 'Molduras do Para-choque', 'Emblemas'], pos: 'T' },
      { tipo: 'Acabamentos e Forros', subs: ['Acabamentos da Tampa Traseira', 'Tampões do Porta-malas'] },
      { tipo: 'Limpador e Lavador', subs: ['Motores do Limpador'], pos: 'T' },
      { tipo: 'Módulos e Elétrica', subs: ['Câmeras de Ré', 'Sensores de Estacionamento'] },
    ],
  },
  {
    k: 'rodas', nome: 'Rodas e suspensão', de: 'das rodas e da suspensão', fica: 'nas rodas e na suspensão', ancora: [520, 796], etiqueta: [508, 965],
    poligonos: [
      '440,705 470,640 560,615 590,600 650,690 660,820 640,1024 360,1024 405,790',
      '1080,600 1150,548 1335,560 1340,1024 1060,1024 1075,770',
    ],
    // as duas rodas (com disco e pinça) e as molas/amortecedores logo acima delas
    realce: [elipse(520, 796, 102, 98), elipse(1200, 646, 102, 90), '494,616 536,610 542,702 498,708', '1158,456 1202,450 1208,556 1162,562'],
    grupos: [
      { tipo: 'Rodas' },
      { tipo: 'Suspensão e Direção', sem: ['Colunas de Direção', 'Bombas de Direção e Suportes', 'Mangueiras da Direção'] },
      { tipo: 'Freios', subs: ['Pinças de Freio', 'Espelhos e Defletores do Disco', 'Sensores ABS', 'Mangueiras e Flexíveis do Freio', 'Sensores do Freio'] },
    ],
  },
  {
    k: 'embaixo', nome: 'Embaixo', de: 'da parte de baixo', fica: 'embaixo do carro', ancora: [758, 690], etiqueta: [826, 965],
    poligonos: ['650,690 700,660 900,628 1070,590 1150,530 1200,480 1330,470 1335,560 1150,548 1080,600 1075,770 1060,1024 640,1024 660,820'],
    realce: ['580,658 700,662 800,664 1000,634 1080,596 1150,536 1204,488 1328,478 1334,562 1204,562 1150,584 1084,640 1000,688 800,722 700,728 596,716'],
    grupos: [
      { tipo: 'Escapamento' },
      { tipo: 'Injeção e Combustível', subs: ['Tanques de Combustível', 'Bombas de Combustível', 'Boias de Combustível', 'Portinholas e Tampas do Tanque'] },
      { tipo: 'Câmbio e Transmissão', sem: ['Alavancas e Manoplas de Câmbio', 'Trambuladores e Seletores'] },
      { tipo: 'Para-choques e Lataria', subs: ['Assoalhos', 'Vigas de Reforço'] },
    ],
  },
];

/** As duas vistas do carro ("Girar o carro"): a da frente (pelo lado esquerdo, a arte de sempre) e a de trás (pelo lado
 *  direito: lib/raioXTras.ts, que só desce quando a pessoa gira). */
export type LadoArte = 'frente' | 'tras';
/** As zonas que, em cada vista, ficam do OUTRO lado do carro: escolher uma delas gira o carro sozinho. As que não estão
 *  em nenhuma das duas listas (interior, teto, rodas, embaixo) aparecem de verdade nas duas vistas. */
export const DO_OUTRO_LADO: Record<LadoArte, readonly string[]> = {
  frente: ['lateral-direita', 'traseira'],
  tras: ['frente', 'motor', 'lateral-esquerda'],
};
/** A outra vista. */
export const outroLado = (l: LadoArte): LadoArte => (l === 'frente' ? 'tras' : 'frente');

/** O carro das contagens (as do catálogo: marca, modelo e, se houver, o ano). */
export type CarroFiltro = { marca?: string; modelo?: string; ano?: number };
/** Uma linha do painel: um tipo da zona, com o filtro exato do catálogo e a peça mais nova dele (a foto). */
export type Linha = { tipo: string; sub: string; lado?: Lado; pos?: Posicao; n: number; it: Item };
export type ContaZona = { k: string; n: number; linhas: Linha[] };

/** Os filtros do catálogo de uma linha (os mesmos do link). */
export const filtrosLinha = (l: Pick<Linha, 'tipo' | 'sub' | 'lado' | 'pos'>, carro: CarroFiltro = {}): Filtros =>
  ({ ...carro, tipo: l.tipo, sub: l.sub, lado: l.lado, pos: l.pos, ordem: 'novos' });

/** Conta as zonas com a busca do catálogo (`procurar` = Busca.procurar, sobre o índice inteiro ou o do carro).
 *  A linha é (bloco, tipo, lado, posição); a zona soma as peças sem repetir. Linhas e zonas com 0 ficam de fora das
 *  linhas (a zona continua, com n = 0). Ordem: mais peças primeiro, depois o nome. */
export function contarZonas(procurar: (f: Filtros) => Item[], carro: CarroFiltro = {}, zonas: Zona[] = ZONAS): ContaZona[] {
  return zonas.map((z) => {
    const ids = new Set<string>();
    const linhas = new Map<string, Linha>();
    for (const g of z.grupos) {
      const pedidos: Filtros[] = g.subs
        ? g.subs.map((sub) => ({ ...carro, tipo: g.tipo, sub, lado: g.lado, pos: g.pos, ordem: 'novos' }))
        : [{ ...carro, tipo: g.tipo, lado: g.lado, pos: g.pos, ordem: 'novos' }];
      for (const f of pedidos) {
        for (const it of procurar(f)) {
          if (g.sem?.includes(it.s)) continue;
          ids.add(it.id);
          const chave = `${it.c}|${it.s}|${g.lado ?? ''}|${g.pos ?? ''}`;
          const l = linhas.get(chave);
          // a lista vem das mais novas para as mais antigas: a 1ª é a foto da linha (a com capa de estúdio, se houver)
          if (!l) linhas.set(chave, { tipo: it.c, sub: it.s, lado: g.lado, pos: g.pos, n: 1, it });
          else {
            l.n++;
            if (l.it.e === '0' && it.e !== '0') l.it = it;
          }
        }
      }
    }
    return { k: z.k, n: ids.size, linhas: [...linhas.values()].sort((a, b) => b.n - a.n || a.sub.localeCompare(b.sub, 'pt-BR')) };
  });
}

/** As peças da zona (sem repetir), das que chegaram agora para as mais antigas (os ids do ML crescem): "Ver as peças
 *  da frente" do painel. */
export function pecasDaZona(procurar: (f: Filtros) => Item[], carro: CarroFiltro, z: Zona): Item[] {
  const vistas = new Map<string, Item>();
  for (const g of z.grupos) {
    const pedidos: Filtros[] = g.subs
      ? g.subs.map((sub) => ({ ...carro, tipo: g.tipo, sub, lado: g.lado, pos: g.pos, ordem: 'novos' }))
      : [{ ...carro, tipo: g.tipo, lado: g.lado, pos: g.pos, ordem: 'novos' }];
    for (const f of pedidos) for (const it of procurar(f)) if (!g.sem?.includes(it.s)) vistas.set(it.id, it);
  }
  return [...vistas.values()].sort((a, b) => b.id.length - a.id.length || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
}

/** A peça como a zona precisa dela: o bloco, o tipo e o lado/posição que o nome diz (os campos c, s, l, pos do índice). */
export type PecaZona = { c: string; s: string; l?: Lado | '' | '0'; pos?: Posicao | 'A' | '' | '0' };
/** A peça cabe no grupo? A MESMA regra da busca do catálogo (lib/busca.ts): bloco e tipo iguais, o lado igual, e a
 *  posição igual ou "A" (serve nas duas). */
function noGrupo(p: PecaZona, g: Grupo): boolean {
  if (p.c !== g.tipo) return false;
  if (g.subs ? !g.subs.includes(p.s) : !!g.sem?.includes(p.s)) return false;
  if (g.lado && p.l !== g.lado) return false;
  if (g.pos && p.pos !== g.pos && p.pos !== 'A') return false;
  return true;
}
/** As zonas da peça, na ordem do carro (ZONAS). Quase toda peça tem UMA; a que serve na frente e atrás ("motor do
 *  limpador dianteiro/traseiro", pos "A") tem duas; a que a tabela não alcança (um tipo sem lugar certo, a peça de
 *  porta sem lado no nome), nenhuma. O "Onde fica" da página da peça usa a 1ª (components/peca/OndeFica.astro). */
export function zonasDaPeca(p: PecaZona, zonas: Zona[] = ZONAS): Zona[] {
  return zonas.filter((z) => z.grupos.some((g) => noGrupo(p, g)));
}

// lado e posição no endereço do catálogo, por extenso (os mesmos de catalogo/Catalogo.tsx: LADOS e POSICOES)
const LADO_URL: Record<Lado, string> = { E: 'esquerdo', D: 'direito' };
const POS_URL: Record<Posicao, string> = { D: 'dianteiro', T: 'traseiro' };

/** O catálogo filtrado na linha (e no carro, quando há): os parâmetros na ordem que o catálogo escreve. */
export function linkLinha(l: Pick<Linha, 'tipo' | 'sub' | 'lado' | 'pos'>, carro: CarroFiltro = {}): string {
  const u = new URLSearchParams();
  if (carro.marca) u.set('marca', carro.marca);
  if (carro.modelo) u.set('modelo', carro.modelo);
  if (carro.ano) u.set('ano', String(carro.ano));
  u.set('tipo', l.tipo);
  u.set('sub', l.sub);
  if (l.lado) u.set('lado', LADO_URL[l.lado]);
  if (l.pos) u.set('pos', POS_URL[l.pos]);
  return `/catalogo.html?${u.toString()}`;
}

/** "Retrovisores Externos" na lateral esquerda: o lado já está na zona, o nome fica o do catálogo (é o da ficha que a
 *  pessoa vai ver lá). Na frente/traseira com posição, idem. */
export const nomeLinha = (l: Pick<Linha, 'sub'>) => l.sub;

// ---- o JSON curto da página (lib/raioXDados.ts no build; o navegador lê com lerRaioX) ----

/** Quantas linhas de cada zona aparecem com foto (as outras ficam atrás do "Ver os N tipos", em fichas). */
export const NA_FRENTE = 6;
/** Quantas peças o "Ver as peças da frente" mostra no trilho do painel (as mais novas da zona). */
export const NA_GALERIA = 12;
/** O arquivo das peças mais novas de cada zona (quem não tem carro salvo): pages/dados/raio-x.json.ts. */
export const ARQUIVO_GALERIA = '/dados/raio-x.json';
/** Na página: os blocos uma vez só e, por zona, as linhas [bloco (índice), tipo, lado+posição, n, foto?].
 *  lado+posição: '' nenhum, 'E'/'D' o lado, '-D'/'-T' só a posição, 'ED'… os dois. */
export type RaioXJson = { b: string[]; z: { k: string; n: number; l: [number, string, string, number, string?][] }[] };
/** Uma linha pronta para o painel. */
export type LinhaPainel = { tipo: string; sub: string; lado?: Lado; pos?: Posicao; n: number; foto: string };
export type ZonaPainel = { k: string; n: number; l: LinhaPainel[] };

/** A foto da linha num código curto: '4'+id (capa leve de 400 px), 'p'+id (maquiada), 'e'+id (automática), 'm'+chave
 *  (a foto -A do ML), 'u'+endereço (o resto). */
export function codigoDaFoto(src: string): string {
  let m = /^\/estudio-400\/(MLB\d+)\.webp$/.exec(src);
  if (m) return `4${m[1]}`;
  if ((m = /^\/estudio-pro\/(MLB\d+)\.webp$/.exec(src))) return `p${m[1]}`;
  if ((m = /^\/estudio\/(MLB\d+)\.webp$/.exec(src))) return `e${m[1]}`;
  if ((m = /^https:\/\/http2\.mlstatic\.com\/D_(.+)-A\.webp$/.exec(src))) return `m${m[1]}`;
  return src ? `u${src}` : '';
}
/** O contrário de codigoDaFoto. */
export function fotoDoCodigo(c: string | undefined): string {
  if (!c) return '';
  const r = c.slice(1);
  switch (c[0]) {
    case '4': return `/estudio-400/${r}.webp`;
    case 'p': return `/estudio-pro/${r}.webp`;
    case 'e': return `/estudio/${r}.webp`;
    case 'm': return `https://http2.mlstatic.com/D_${r}-A.webp`;
    default: return r;
  }
}

/** O JSON da página para o painel. */
export function lerRaioX(j: RaioXJson): ZonaPainel[] {
  return j.z.map((z) => ({
    k: z.k,
    n: z.n,
    l: z.l.map(([b, sub, lp, n, f]) => {
      const lado = (lp[0] === 'E' || lp[0] === 'D' ? lp[0] : undefined) as Lado | undefined;
      const p = lp.replace(/^[ED]?-?/, '');
      return { tipo: j.b[b], sub, lado, pos: (p === 'D' || p === 'T' ? p : undefined) as Posicao | undefined, n, foto: fotoDoCodigo(f) };
    }),
  }));
}

/** "1 peça" / "1.234 peças" */
export const qtdPecas = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'peça' : 'peças'}`;
