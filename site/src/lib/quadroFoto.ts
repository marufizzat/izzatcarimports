// Enquadramento das fotos do Mercado Livre na galeria da página da peça, para ficarem harmônicas com a capa de
// estúdio: o mesmo quadro quadrado, com a peça centrada ocupando ~84%. Só CSS (a foto do ML não é copiada nem
// alterada) e sem script: o quadro sai pronto no HTML (nada pula na tela).
// Medidas: ferramentas/medir_fotos_ml.py -> src/data/fotos-ml-caixas.json, por chave da foto:
//   [W, H, x0, y0, x1, y1, classe, hash] = tamanho da foto grande (-F), a caixa da peça (px), classe e assinatura
//   [..., "incerta"] = a caixa pode não ter pegado a peça toda (teste da faixa de segurança): a foto aparece INTEIRA
//   [W, H, classe, hash] = nenhuma peça achada. Classe: p peça | s sem peça | m marketing do anúncio | c carro inteiro
//   (sem classe = ainda não classificada: conta como peça). fotosGaleria() tira "m" e põe "c" no fim.
//   [..., "#"] = a foto mostra o código gravado que a página mostra (o OCR leu: a etiqueta): o atalho "Ver o código na
//   foto" (fotoDoCodigo). Sempre depois da classe, só em foto p ou s.
// Regras (nenhuma peça pode parecer cortada pelo site):
//   1. nunca amplia além do quadrado da própria foto (lado do quadro >= lado curto da foto): o quadro só pode cortar a
//      foto no eixo longo, e só onde a caixa medida diz que não há peça;
//   2. caixa incerta ou sem peça achada: a foto inteira no meio do quadro (respiro de 6%), como era antes;
//   3. respiro mínimo de 4% entre a peça e a borda do quadro (o canto arredondado do palco não morde a peça): se a peça
//      encosta na borda da foto, a foto fica no meio do quadro, com folga daquele lado;
//   4. foto pequena (lado maior < 1024 px) não passa de 1,25× no palco do computador retina (1280 px de tela): fica
//      inteira, no tamanho dela, no meio do quadro.
// Saída (CSS em PecaTopo.astro): variáveis em lados do quadro: --w/--h (largura/altura da foto), --x/--y (quanto dela
// fica para fora à esquerda/em cima). Onde o quadro passa da foto, ela fica no meio dele e ganha a classe "i" (bordas
// que se desfazem no fundo do estúdio, também nas miniaturas). Foto sem medida (anúncio novo; o robô mede na rodada):
// como antes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** respiro de cada lado quando a foto deixa: a peça ocupa 1 - 2 × 0,08 = 84% do quadro */
export const MARGEM = 0.08;
/** respiro mínimo entre a peça e a borda do quadro (o canto arredondado do palco tem ~3,4% do lado) */
export const RESPIRO = 0.04;
/** foto pequena: o quadro tem pelo menos 1024 px dela (o palco do computador tem ~640 px, 1280 no retina: 1,25×) */
export const NITIDO = 1024;
/** nem foto grande muito estreita (panorama) é esticada além disso no lado curto */
export const LADO_MIN = 560;
/** foto inteira (sem peça medida ou caixa incerta): no máximo 88% do quadro no lado maior (o respiro de 6% de antes) */
export const INTEIRA = 0.88;
/** marca da caixa incerta na entrada (medir_fotos_ml.py) */
export const INCERTA = 'incerta';
/** marca da foto do código (medir_fotos_ml.py: CODIGO_NA_FOTO) */
export const CODIGO_NA_FOTO = '#';

export type Medida = (number | string)[];
/** Em lados do quadro: w/h = tamanho da foto, x/y = deslocamento (negativo = sobra fundo daquele lado).
 *  borda = a foto não cobre o quadro todo (as bordas dela ficam à vista e se desfazem no fundo). */
export type Quadro = { w: number; h: number; x: number; y: number; borda: boolean };

const entre = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** posição do quadrado (lado L) num eixo da foto (tamanho T), centrado em c: dentro da foto se couber; senão centrado */
const eixo = (c: number, L: number, T: number) => (L <= T ? entre(c - L / 2, 0, T - L) : (T - L) / 2);
/** O menor lado de quadro (>= L) que deixa a peça [a, b] a RESPIRO das bordas num eixo de tamanho T. Se o quadro
 *  cabe na foto e a peça fica longe das bordas, L serve; senão a foto vai para o meio do quadro nesse eixo. */
function comRespiro(L: number, T: number, a: number, b: number, c: number): number {
  const r = RESPIRO * L - 1e-9;
  if (L < T) {
    const p = eixo(c, L, T);
    if (a - p >= r && p + L - b >= r) return L;
  }
  return Math.max(L, T, (T - 2 * a) / (1 - 2 * RESPIRO), (2 * b - T) / (1 - 2 * RESPIRO));
}

/** O quadro de uma foto: um quadrado com a peça inteira, centrada e ocupando ~84% (menos quando a foto não deixa). */
export function quadro(e?: Medida | null): Quadro | null {
  const m = (e || []).filter((v): v is number => typeof v === 'number');   // a classe e a assinatura vêm no fim
  if (m.length < 2) return null;
  const [W, H] = m;
  if (!(W > 0 && H > 0)) return null;
  const curto = Math.min(W, H), longo = Math.max(W, H);
  // o menor quadro: o quadrado da própria foto (regra 1); foto pequena, NITIDO px (regra 4)
  const base = longo < NITIDO ? NITIDO : Math.max(curto, LADO_MIN);
  // o maior: a foto inteira com 6% de respiro (passar disso só diminuiria a foto)
  const inteira = Math.max(longo / INTEIRA, base);
  const caixa = m.length >= 6 && !(e || []).includes(INCERTA) && m[4] > m[2] && m[5] > m[3];
  let L = inteira, cx = W / 2, cy = H / 2;
  if (caixa) {
    const [, , x0, y0, x1, y1] = m;
    cx = (x0 + x1) / 2;
    cy = (y0 + y1) / 2;
    L = Math.max(base, Math.min(Math.max(x1 - x0, y1 - y0) / (1 - 2 * MARGEM), inteira));
    for (let i = 0; i < 3; i++) {             // regra 3 (no máximo 2 voltas: cada eixo vai uma vez para o meio)
      const precisa = Math.max(comRespiro(L, W, x0, x1, cx), comRespiro(L, H, y0, y1, cy));
      if (precisa <= L) break;
      L = precisa;
    }
  }
  // quadrado a menos de 2 px de um lado da foto: fica do tamanho dele (sem fresta de 1 px do fundo; o respiro perde < 1 px)
  for (const T of [longo, curto]) if (L > T && L - T < 2) L = T;
  // onde o quadrado passa da foto, ela fica no meio dele (o mesmo fundo dos dois lados)
  const x = eixo(cx, L, W), y = eixo(cy, L, H);
  return { w: W / L, h: H / L, x: x / L, y: y / L, borda: L > curto + 0.5 };
}

// 3 casas: o erro do arredondamento fica abaixo de 1 px no palco. Tamanho para cima e deslocamento para baixo: onde a
// foto cobre o quadro, ela sempre cobre (nunca aparece uma fresta do fundo na borda).
const acima = (v: number) => Math.ceil(v * 1000 - 1e-6) / 1000;
const abaixo = (v: number) => Math.floor(v * 1000 + 1e-6) / 1000 || 0;
const num = (v: number) => String(v).replace(/^(-?)0\./, '$1.');

/** Atributos da <img>: o mesmo style no palco e na miniatura; classe "i" = foto com as bordas à vista. */
export function atributosQuadro(q: Quadro | null): { cls?: string; style?: string } {
  if (!q) return {};
  const w = acima(q.w), h = acima(q.h), x = abaixo(q.x), y = abaixo(q.y);
  const partes = [`--w:${num(w)}`];       // --w sempre: é ele que marca a foto enquadrada no CSS
  if (h !== w) partes.push(`--h:${num(h)}`);
  if (x) partes.push(`--x:${num(x)}`);
  if (y) partes.push(`--y:${num(y)}`);
  return q.borda ? { cls: 'i', style: partes.join(';') } : { style: partes.join(';') };
}

let _medidas: Record<string, Medida> | null = null;
function medidas(): Record<string, Medida> {
  if (!_medidas) {
    try {
      _medidas = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'fotos-ml-caixas.json'), 'utf-8'));
    } catch {
      _medidas = {};   // sem o arquivo: todas as fotos como antes
    }
  }
  return _medidas!;
}

/** Atributos de quadro da foto do ML pela chave (vazio = foto sem medida, mostrada como antes). */
export function quadroFoto(chave: string): { cls?: string; style?: string } {
  return chave ? atributosQuadro(quadro(medidas()[chave])) : {};
}

/** Classe da foto: p peça | s sem peça achada | m marketing do anúncio | c carro inteiro | null sem classe. */
export function classeFoto(chave: string, tabela: Record<string, Medida> = medidas()): string | null {
  const e = tabela[chave];
  const c = e && e.find((v) => typeof v === 'string' && /^[psmc]$/.test(v));
  return typeof c === 'string' ? c : null;
}

/** A foto mostra o código gravado da peça (a etiqueta, lida pelo OCR no medir_fotos_ml.py)? */
export function temCodigo(chave: string, tabela: Record<string, Medida> = medidas()): boolean {
  return !!chave && !!tabela[chave]?.includes(CODIGO_NA_FOTO);
}

/** "Ver o código na foto": a posição da 1ª foto com o código em `galeria` (as fotos do anúncio na ordem da galeria,
 *  fotosGaleria); -1 = nenhuma (o atalho não aparece). Na página, some 1 quando a capa de estúdio vem antes. */
export function fotoDoCodigo(galeria: string[], tabela: Record<string, Medida> = medidas()): number {
  return galeria.findIndex((k) => temCodigo(k, tabela));
}

/** As fotos do anúncio que vão para a galeria, o JSON-LD e o feed: sem o marketing do vendedor (banner de entrega,
 *  garantia, dicas, cartão repetido em vários anúncios) e com a foto do carro inteiro no fim. Se tudo fosse marketing,
 *  fica a lista como veio (nunca uma peça sem foto). */
export function fotosGaleria(fotos: string[], tabela: Record<string, Medida> = medidas()): string[] {
  const boas = fotos.filter((k) => k && classeFoto(k, tabela) !== 'm');
  if (!boas.length) return fotos.filter(Boolean);
  return [...boas.filter((k) => classeFoto(k, tabela) !== 'c'), ...boas.filter((k) => classeFoto(k, tabela) === 'c')];
}
