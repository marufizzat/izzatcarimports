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

// ---- o NOME da peça: a regra "este nome É a peça" (a lista do conserto, lib/batida.ts; os pontos quentes das vistas
// por dentro, lib/porDentro/base.ts) e as palavras do nome para o "Onde fica" ----
const junto = (w: string) => w.replace(/-/g, '');
/** As palavras do nome: sem acento, minúsculas, a composta inteira e sem o hífen ("Para-choque" e "Parachoque" =
 *  "parachoque"; "porta-malas" nunca é "porta"). */
export const palavrasDoNome = (nome: string): string[] =>
  nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9-]+/).map(junto).filter(Boolean);
const QUANTAS = new Set(['kit', 'par', 'jogo', 'conjunto']);
// a palavra do nome é a da regra, no singular ou no plural ("maçanetas", "motores", "coxins", "faróis", "botões")
const mesma = (t: string, w: string) => t === w || t === `${w}s` || t === `${w}es`
  || (w.endsWith('m') && t === `${w.slice(0, -1)}ns`) || (w.endsWith('l') && t === `${w.slice(0, -1)}is`) || (w.endsWith('ao') && t === `${w.slice(0, -2)}oes`);
const lista = (s?: string) => (s ? s.split(' ').map(junto) : []);
/** Qual nome É a peça: `cab` = as palavras que podem ABRIR o nome ("Kit"/"Par" na frente não contam; o plural vale),
 *  `tem` = o nome diz pelo menos uma destas, `sem` = não diz nenhuma destas. Palavras separadas por espaço, sem acento;
 *  a composta vale inteira ("porta" não é "porta-malas"). Várias formas = basta uma. */
export type Eh = { cab: string; tem?: string; sem?: string };
/** O nome É a peça da regra? A mesma leitura do "tipo" da busca (lib/busca.ts, `unNaCabeca`): a 1ª palavra do nome é a
 *  da peça ("Maçaneta externa dianteira esquerda" é maçaneta; "Suporte maçaneta" é suporte), com o que a regra exige
 *  do resto do nome ("Forro porta…" sim, "Forro porta-malas" não). Sem regra: nunca. */
export function nomeEh(eh: Eh | Eh[] | undefined, nome: string): boolean {
  if (!eh) return false;
  const ws = palavrasDoNome(nome);
  let i = 0;
  while (i < ws.length - 1 && QUANTAS.has(ws[i])) i++;
  const cab = ws[i];
  if (!cab) return false;
  const diz = (w: string) => ws.some((t) => mesma(t, w));
  return (Array.isArray(eh) ? eh : [eh]).some((e) =>
    lista(e.cab).some((c) => mesma(cab, c)) && (!e.tem || lista(e.tem).some(diz)) && !lista(e.sem).some(diz));
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

// ---- "Onde fica" (a legenda da página da peça: "Fica na frente do carro") ----
// O painel junta o que o cliente PROCURA apontando ali (a chave de roda na roda, o sensor do freio perto do freio, a luz
// da porta junto das luzes de dentro). A legenda AFIRMA onde a peça está: é mais exigente (revisão 15, P2-1). A peça
// cujo tipo não tem lugar certo, ou cujo nome diz outro lugar, fica sem o bloco (nunca um lugar meio certo); as
// contagens e os links do painel não mudam.
/** Tipos que o painel mostra numa zona mas que não ficam nela (ou mudam de lugar de carro para carro): a chave de roda
 *  e o macaco (porta-malas, ou atrás do banco na picape), o suporte do estepe, o sensor do freio (do pedal, do
 *  hidrovácuo, do ESP), a portinhola do tanque (na lateral), o módulo do câmbio, o triângulo e a sirene. */
const SEM_LUGAR: ReadonlySet<string> = new Set(['Macacos e Chaves de Roda', 'Suportes do Estepe', 'Sensores do Freio', 'Portinholas e Tampas do Tanque',
  'Módulos do Câmbio e da Tração', 'Triângulos de Segurança', 'Alarmes e Sirenes']);
const dizAlguma = (ws: string[], palavras: string) => palavras.split(' ').some((w) => ws.includes(junto(w)));
/** Por zona: o NOME diz outro lugar (as palavras como palavrasDoNome as lê). */
const OUTRO_LUGAR: Record<string, (ws: string[]) => boolean> = {
  // a luz de cortesia da porta, do porta-luvas e do porta-malas e o puxador do porta-malas não ficam no teto; o
  // amplificador da antena fica na coluna ou no vidro
  teto: (ws) => (dizAlguma(ws, 'porta portas porta-malas porta-luvas') && !ws.includes('teto')) || ws.includes('amplificador'),
  // forro, isopor e moldura do PORTA-MALAS (com lado) e o friso da tampa não ficam nas portas
  'lateral-esquerda': (ws) => dizAlguma(ws, 'porta-malas bagagito tampa'),
  'lateral-direita': (ws) => dizAlguma(ws, 'porta-malas bagagito tampa'),
  // do porta-malas, da tampa traseira, de fora do carro ou do cofre do motor ("Caixa fusíveis motor")
  interior: (ws) => dizAlguma(ws, 'porta-malas externa externo') || (ws.includes('tampa') && dizAlguma(ws, 'traseira traseiro')) || (ws.length > 1 && ws[ws.length - 1] === 'motor'),
  // a mangueira e o sensor do hidrovácuo e os canos do ABS ficam no cofre do motor; o módulo do TPMS, dentro do carro
  rodas: (ws) => dizAlguma(ws, 'hidrovacuo vacuo servo modulo') || (dizAlguma(ws, 'mangueira tubo cano') && ws.includes('abs')),
  // o relé e o módulo da bomba ficam com os fusíveis; a portinhola, na lateral; a travessa e a barra da frente, na frente
  embaixo: (ws) => dizAlguma(ws, 'rele modulo portinhola frontal superior churrasqueira'),
  motor: (ws) => ws.includes('tanque'),
};
/** A zona que a página da peça afirma: a do painel (zonasDaPeca), quando é UMA só, o tipo tem lugar certo e nem a
 *  posição nem o nome dizem outro lugar (o braço TRASEIRO do limpador não fica na frente; o sensor de estacionamento
 *  DIANTEIRO não fica na traseira). null = a página não mostra o bloco. */
export function zonaOndeFica(p: PecaZona & { n?: string }, zonas: Zona[] = ZONAS): Zona | null {
  const zs = zonasDaPeca(p, zonas);
  if (zs.length !== 1 || SEM_LUGAR.has(p.s)) return null;
  const z = zs[0];
  if ((z.k === 'frente' && p.pos === 'T') || (z.k === 'traseira' && p.pos === 'D')) return null;
  const fora = OUTRO_LUGAR[z.k];
  return fora && p.n && fora(palavrasDoNome(p.n)) ? null : z;
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

/** "Ver todas no catálogo" do painel: o catálogo na zona inteira (?zona=<k>), com o MESMO carro das contagens do painel
 *  (o filtro em uso). Sem carro (visitante sem carro salvo; ou o carro salvo não tem peça / a rede falhou e as contagens
 *  são do estoque inteiro): só a zona, `/catalogo.html?zona=frente`. Nunca o carro salvo "por fora" do filtro: o painel
 *  dizia "Teto · 97 peças" e o clique abria 0 (revisão 14, P1-1 e item 32). */
export function linkZona(k: string, carro: CarroFiltro = {}): string {
  const u = new URLSearchParams();
  if (carro.marca) u.set('marca', carro.marca);
  if (carro.marca && carro.modelo) u.set('modelo', carro.modelo);
  if (carro.marca && carro.modelo && carro.ano) u.set('ano', String(carro.ano));
  u.set('zona', k);
  return `/catalogo.html?${u.toString()}`;
}

/** "Ver todas as peças do XC60" (zona sem peça): o catálogo do carro das contagens; sem carro, o catálogo inteiro. */
export function linkDoFiltro(carro: CarroFiltro = {}): string {
  const u = new URLSearchParams();
  if (carro.marca) u.set('marca', carro.marca);
  if (carro.marca && carro.modelo) u.set('modelo', carro.modelo);
  if (carro.marca && carro.modelo && carro.ano) u.set('ano', String(carro.ano));
  const q = u.toString();
  return q ? `/catalogo.html?${q}` : '/catalogo.html';
}

/** O que o leitor de tela ouve quando o painel troca sem o foco ir para ele (toque, clique): "Frente: 119 peças do seu
 *  XC60 2019, 19 tipos de peça." / "Teto: nenhuma peça do seu XC60 2019 agora." (`doCarro` = '' no estoque inteiro). */
export function falaDaZona(nome: string, n: number, tipos: number, doCarro = ''): string {
  const dc = doCarro ? ` ${doCarro}` : '';
  if (!n) return `${nome}: nenhuma peça${dc} agora.`;
  return `${nome}: ${qtdPecas(n)}${dc}${tipos > 1 ? `, ${tipos} tipos de peça` : ''}.`;
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

/** A zona pela chave (o endereço ?zona=frente). Sem zona com essa chave, undefined. */
export const zonaDaChave = (k?: string | null): Zona | undefined => (k ? ZONAS.find((z) => z.k === k) : undefined);

/** A peça está na zona? A MESMA regra que o painel conta (contarZonas): algum grupo da zona (tipo, sub, lado e posição;
 *  "sem" tira). A posição 'A' (dianteira e traseira) entra nas duas. Quem filtra o catálogo (busca.ts) usa esta função. */
export function pecaNaZona(z: Zona, it: Pick<Item, 'c' | 's' | 'l' | 'pos'>): boolean {
  return z.grupos.some((g) => it.c === g.tipo && (!g.subs || g.subs.includes(it.s)) && !g.sem?.includes(it.s)
    && (!g.lado || it.l === g.lado) && (!g.pos || it.pos === g.pos || it.pos === 'A'));
}
