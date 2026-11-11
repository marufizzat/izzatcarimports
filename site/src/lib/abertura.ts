// Abertura da home (rodada 15, components/v2/AberturaV2.astro): "o estúdio vira o seu carro".
// O palco à direita (no celular, embaixo do cartão) tem peças recortadas em camadas; cada peça é um LINK de verdade para
// um bloco do site. Quando a pessoa escolhe o carro no seletor (lib/meuCarro.ts), o título passa a dizer o carro, a arte
// do carro entra no palco e as peças viram os atalhos DELE, com a contagem real (a do catálogo com tipo + carro + ano).
// Aqui só o que é função pura (testada em abertura.test.ts); o comportamento está em components/v2/aberturaPalco.ts.
// Sem node:fs e sem lib/dados.ts: roda no build e no navegador.
import { serveNoModelo, anosNoModelo } from './meuCarro';

/** Uma camada do palco: k = arquivo (/arte/v2/abertura/<k>-<largura>.webp); bloco = o nome do bloco nos dados (p.c);
 *  rot = o rótulo curto na cena; cena = lugar na cena de abertura, sem carro ([x, y] do centro em % do palco, largura em
 *  % do lado menor do palco, d = profundidade do paralaxe em px); sem cena, a peça só aparece como atalho de um carro. */
export type PecaPalco = { k: string; bloco: string; rot: string; curto: string; cena?: { x: number; y: number; w: number; d: number } };

/** As peças na ordem de desempate dos atalhos. A 1ª (farol) é a peça-herói: fica no piso, com reflexo e o DRL.
 *  rot = o rótulo na cena de abertura; curto = o rótulo em volta do carro (cabe ao lado do número). */
export const PECAS_PALCO: PecaPalco[] = [
  { k: 'farol', bloco: 'Faróis e Lanternas', rot: 'Faróis e lanternas', curto: 'Faróis', cena: { x: 51, y: 69, w: 88, d: 6 } },
  { k: 'retrovisor', bloco: 'Retrovisores', rot: 'Retrovisores', curto: 'Retrovisores', cena: { x: 20, y: 17, w: 25, d: 22 } },
  { k: 'pinca', bloco: 'Freios', rot: 'Freios', curto: 'Freios', cena: { x: 21, y: 45, w: 26, d: 14 } },
  { k: 'borboleta', bloco: 'Injeção e Combustível', rot: 'Injeção', curto: 'Injeção' },
  { k: 'turbo', bloco: 'Filtro de Ar e Turbo', rot: 'Turbo e filtro de ar', curto: 'Turbo', cena: { x: 79, y: 15, w: 30, d: 26 } },
  { k: 'amortecedor', bloco: 'Suspensão e Direção', rot: 'Suspensão', curto: 'Suspensão', cena: { x: 51, y: 32, w: 27, d: 16 } },
  { k: 'modulo', bloco: 'Módulos e Elétrica', rot: 'Módulos e elétrica', curto: 'Módulos' },
  { k: 'motor', bloco: 'Motor', rot: 'Motor', curto: 'Motor' },
  { k: 'difusor', bloco: 'Painel e Console', rot: 'Painel e console', curto: 'Painel' },
  { k: 'macaneta', bloco: 'Maçanetas e Fechaduras', rot: 'Maçanetas e fechaduras', curto: 'Maçanetas' },
  { k: 'alternador', bloco: 'Ignição e Partida', rot: 'Ignição e partida', curto: 'Ignição' },
];

/** Lugar dos atalhos no palco estreito (celular): fileiras desencontradas, [x, y] do centro em % do palco.
 *  Até 3 numa fileira; 4 = 2 + 2; 5 = 3 + 2 (os rótulos de uma fileira nunca encostam nos da outra). */
export function lugaresEstreitos(n: number): [number, number][] {
  const fila = (q: number, y: number): [number, number][] => Array.from({ length: q }, (_, i) => [50 + (i - (q - 1) / 2) * 32, y]);
  if (n <= 3) return fila(n, 19);
  const cima = Math.ceil(n / 2);
  return [...fila(cima, 13), ...fila(n - cima, 33)];
}

/** `sizes` da arte do carro e do farol-herói no palco: os MESMOS no <img> (AberturaV2.astro) e na pré-carga do <head>
 *  (index.astro), para o navegador escolher o mesmo arquivo e baixar uma vez só. */
export const SIZES_AUTO = '(max-width: 1023px) 108vw, min(62vw, 1100px)';
export const SIZES_HEROI = '(max-width: 1023px) 94vw, min(52vw, 800px)';

/** Quantos atalhos cabem em volta do carro. */
export const ATALHOS_MAX = 5;

/** A palavra viva do título ("De qual peça o seu ___ precisa?") e o fator da letra para ela caber na linha.
 *  Sem nada: "carro"; só a marca (passo 1 do seletor): a marca; com o modelo: o modelo, e o ano junto quando cabe
 *  ("Onix 2019"; "Palio Weekend" fica sem o ano: ele continua no cartão). f = 1 até 9 letras; depois a letra do título
 *  diminui para a 2ª linha nunca quebrar (a linha tem lugar para 18 letras: a palavra + " precisa?").
 *  SEM nada de fora: vai copiada para dentro do HTML por toString() (o título de quem volta nasce pronto). */
export function palavraViva(m?: string | null, y?: number | null, b?: string | null): { t: string; f: number } {
  var limpo = function (s: unknown) { return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 28) : ''; };
  var mo = limpo(m), ma = limpo(b);
  var ano = typeof y === 'number' && y > 1900 && y < 2100 ? String(y) : '';
  var t = mo ? (ano && (mo + ' ' + ano).length <= 14 ? mo + ' ' + ano : mo) : ma || 'carro';
  var f = Math.min(1, Math.round((18 / (t.length + 9)) * 1000) / 1000);
  return { t: t, f: f };
}

/** O que a conta precisa do /dados/carro/<k>.json (o mesmo formato do busca.json, só as peças do carro). */
export type IndiceCarro = {
  familias: string[]; c: number[]; m: string[]; y: ([number, number] | 0 | null)[];
  ms?: Record<string, string[]>; ys?: Record<string, ([number, number] | null)[]>;
};

/** Peças do carro por bloco, com a regra do catálogo (a mesma da grade de categorias): a peça de 2+ carros conta em
 *  cada um, com a faixa de anos daquele carro; com ano, só as que dizem os anos e o ano está dentro. */
export function contarBlocos(d: IndiceCarro, modelo: string, ano: number | null): { total: number; por: Map<string, number> } {
  const por = new Map<string, number>();
  let total = 0;
  for (let k = 0; k < d.c.length; k++) {
    const p = { m: d.m[k], y: d.y[k] || null, ms: d.ms?.[k], ys: d.ys?.[k] };
    if (!serveNoModelo(p, modelo)) continue;
    if (ano != null) { const y = anosNoModelo(p, modelo); if (!y || ano < y[0] || ano > y[1]) continue; }
    const bloco = d.familias[d.c[k]];
    por.set(bloco, (por.get(bloco) ?? 0) + 1);
    total++;
  }
  return { total, por };
}

export type Atalho = { k: string; bloco: string; rot: string; curto: string; n: number };

/** Os atalhos do carro: as peças do palco cujo bloco tem peça DELE, as de mais peças primeiro (empate: a ordem do
 *  palco), até `max`. Bloco sem peça não aparece (nunca um atalho que dá em lista vazia). */
export function escolherAtalhos(por: Map<string, number>, max = ATALHOS_MAX, pecas: readonly PecaPalco[] = PECAS_PALCO): Atalho[] {
  return pecas
    .map((p, i) => ({ k: p.k, bloco: p.bloco, rot: p.rot, curto: p.curto, n: por.get(p.bloco) ?? 0, i }))
    .filter((a) => a.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, max)
    .map(({ k, bloco, rot, curto, n }) => ({ k, bloco, rot, curto, n }));
}

/** O endereço do catálogo já no bloco e no carro (os mesmos parâmetros da grade de categorias). */
export function linkAtalho(bloco: string, c: { b: string; m: string; y?: number | null }): string {
  const u = new URLSearchParams({ tipo: bloco, marca: c.b, modelo: c.m });
  if (c.y) u.set('ano', String(c.y));
  return `/catalogo.html?${u.toString()}`;
}

/** Texto do número no atalho: "4 peças" / "1 peça". */
export const pecasTxt = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'peça' : 'peças'}`;
