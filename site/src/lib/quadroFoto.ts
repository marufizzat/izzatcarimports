// Enquadramento das fotos do Mercado Livre na galeria da página da peça, para ficarem harmônicas com a capa de
// estúdio: o mesmo quadro quadrado, cheio, com a peça centrada ocupando ~84%. Só CSS (a foto do ML não é copiada nem
// alterada) e sem script: o quadro sai pronto no HTML (nada pula na tela).
// Medidas: ferramentas/medir_fotos_ml.py -> src/data/fotos-ml-caixas.json, por chave da foto:
//   [W, H, x0, y0, x1, y1] = tamanho da foto grande (-F) e a caixa da peça (px)  |  [W, H] = nenhuma peça achada.
// Saída (CSS em PecaTopo.astro): variáveis em lados do quadro: --w/--h (largura/altura da foto), --x/--y (quanto dela
// fica para fora à esquerda/em cima). Peça mais comprida que o lado menor da foto (não cabe num quadrado dela): o
// quadrado passa da foto só nesse lado, a foto fica centrada nele e ganha a classe "i" (bordas que se desfazem no
// fundo do estúdio). Foto sem medida (anúncio novo; o robô mede na rodada): como antes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** respiro de cada lado: a peça ocupa 1 - 2 × 0,08 = 84% do quadro */
export const MARGEM = 0.08;
/** nunca mostra menos que 55% do lado menor da foto (foto real ampliada demais fica mole) */
export const ZOOM_MIN = 0.55;
/** nem menos que 560 px da foto no quadro (o palco tem ~640 px no computador): foto pequena do ML não é esticada
 *  além de ~1,1× (ficava borrada); fica no meio do quadro, com as bordas se desfazendo no fundo */
export const LADO_MIN = 560;
/** foto inteira (sem peça medida ou peça do comprimento da foto): no máximo 88% do quadro no lado maior (o respiro
 *  de 6% de antes) */
export const INTEIRA = 0.88;
/** foto quase quadrada sem peça medida: enche o quadro (perde no máximo 1,5% de cada lado) */
const QUASE_QUADRADA = 0.03;

export type Medida = number[];
/** Em lados do quadro: w/h = tamanho da foto, x/y = deslocamento (negativo = sobra fundo daquele lado).
 *  borda = a foto não cobre o quadro todo (as bordas dela ficam à vista e se desfazem no fundo). */
export type Quadro = { w: number; h: number; x: number; y: number; borda: boolean };

const entre = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** posição do quadrado (lado L) num eixo da foto (tamanho T), centrado em c: dentro da foto se couber; senão centrado */
const eixo = (c: number, L: number, T: number) => (L <= T ? entre(c - L / 2, 0, T - L) : (T - L) / 2);

/** O quadro de uma foto: um quadrado com a peça inteira, centrada e ocupando ~84% (menos se ampliar demais). */
export function quadro(m?: Medida | null): Quadro | null {
  if (!m || m.length < 2) return null;
  const [W, H] = m;
  if (!(W > 0 && H > 0)) return null;
  const curto = Math.min(W, H), longo = Math.max(W, H);
  let L: number, cx = W / 2, cy = H / 2;
  const maior = m.length >= 6 ? Math.max(m[4] - m[2], m[5] - m[3]) : 0;
  if (maior > 0) {
    cx = (m[2] + m[4]) / 2;
    cy = (m[3] + m[5]) / 2;
    const quer = Math.max(maior / (1 - 2 * MARGEM), curto * ZOOM_MIN, LADO_MIN);
    // cabe num quadrado da foto: ela cobre o quadro todo (peça grande: o respiro diminui, a peça nunca sai)
    if (maior <= curto && curto >= LADO_MIN) L = Math.min(quer, curto);
    // não cabe (ou a foto é pequena): o quadrado passa da foto, nunca com a peça menor que antes
    else L = Math.min(quer, Math.max(longo / INTEIRA, LADO_MIN));
  } else {   // sem peça: quadrada enche o quadro; senão, inteira (como antes)
    L = Math.abs(W / H - 1) <= QUASE_QUADRADA && curto >= LADO_MIN ? curto : Math.max(longo / INTEIRA, LADO_MIN);
  }
  // quadrado a menos de 2 px de um lado da foto (e a peça cabe nele): fica do tamanho dele (sem fresta de 1 px do fundo)
  for (const T of [longo, curto]) if (L > T && L - T < 2 && maior <= T) L = T;
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
