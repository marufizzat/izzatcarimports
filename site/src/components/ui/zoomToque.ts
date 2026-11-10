// Zoom por toque da galeria em tela cheia (ui/GaleriaTelaCheia.ts): a conta pura, sem DOM (testada em zoomToque.test.ts).
// Coordenadas em px, relativas ao CENTRO do palco (é o transform-origin da foto). A foto é desenhada como
// `translate3d(x, y, 0) scale(s)`: o ponto p da foto (sem zoom) vai parar em t + s·p.
//   - pinça: o ponto da foto que estava entre os dois dedos continua entre eles (o meio dos dedos manda; mexer os dois
//     dedos juntos arrasta a foto ampliada);
//   - limites pela FOTO desenhada (contain + respiro), não pelo palco: ampliada, a borda da foto para na borda da tela
//     (antes dava para arrastar até sobrar só o fundo escuro);
//   - elástico: passar do limite (arrasto, pinça abaixo de 1× ou acima do máximo) resiste e, ao soltar, volta suave.
export type Vista = { s: number; x: number; y: number };
export type Ponto = { x: number; y: number };
/** a foto desenhada com s = 1 (px) */
export type Caixa = { w: number; h: number };

export const MIN = 1;
export const MAX = 4;
/** toque duplo */
export const DUPLO = 2.5;
/** respiro da foto na tela cheia (CSS .gt-foto: padding 5%, que o CSS mede pela LARGURA também em cima e embaixo) */
export const RESPIRO = 0.05;
/** quanto do excesso aparece além do limite (o resto o "elástico" segura) */
export const ELASTICO = 0.3;

export const VISTA_INICIAL: Vista = { s: 1, x: 0, y: 0 };
const entre = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** A foto como o CSS desenha com s = 1: object-fit contain na caixa do palco (W×H) menos o respiro. Sem o tamanho
 *  natural (foto ainda carregando): a caixa inteira. */
export function caixaFoto(nw: number, nh: number, W: number, H: number, respiro = RESPIRO): Caixa {
  const cw = Math.max(1, W - 2 * respiro * W), ch = Math.max(1, H - 2 * respiro * W);
  if (!(nw > 0 && nh > 0)) return { w: cw, h: ch };
  const k = Math.min(cw / nw, ch / nh);
  return { w: nw * k, h: nh * k };
}

/** Quanto a foto ampliada pode andar de cada lado (0 = cabe na tela nesse eixo: fica no meio). */
export function limites(s: number, c: Caixa, W: number, H: number): Ponto {
  return { x: Math.max(0, (s * c.w - W) / 2), y: Math.max(0, (s * c.h - H) / 2) };
}

/** Dentro dos limites (ao soltar). s abaixo de 1,02 = volta à foto inteira. */
export function prender(v: Vista, c: Caixa, W: number, H: number): Vista {
  if (v.s <= 1.02) return VISTA_INICIAL;
  const l = limites(v.s, c, W, H);
  return { s: v.s, x: entre(v.x, -l.x, l.x), y: entre(v.y, -l.y, l.y) };
}

/** O excesso além de ±lim aparece só em parte (o "elástico" do arrasto). */
export function elastico(v: number, lim: number, k = ELASTICO): number {
  if (v > lim) return lim + (v - lim) * k;
  if (v < -lim) return -lim + (v + lim) * k;
  return v;
}
/** Durante o gesto: dentro do limite livre, fora dele com resistência. */
export function soltoComElastico(v: Vista, c: Caixa, W: number, H: number): Vista {
  const l = limites(v.s, c, W, H);
  return { s: v.s, x: elastico(v.x, l.x), y: elastico(v.y, l.y) };
}

/** O zoom da pinça com resistência abaixo de MIN (até ~0,7×) e acima de MAX. */
export function escalaMacia(s: number): number {
  if (s < MIN) return MIN * Math.pow(s / MIN, 0.4);
  if (s > MAX) return MAX * Math.pow(s / MAX, 0.3);
  return s;
}

/** Pinça: v0 = a vista quando o 2º dedo encostou; m0/m = o meio dos dedos no começo/agora; d0/d = a distância entre eles.
 *  O ponto da foto que estava sob m0 fica sob m. Devolve a vista com elástico (o gesto ainda está acontecendo). */
export function pinca(v0: Vista, m0: Ponto, m: Ponto, d0: number, d: number, c: Caixa, W: number, H: number): Vista {
  const s = escalaMacia(v0.s * (d0 > 0 ? d / d0 : 1));
  const px = (m0.x - v0.x) / v0.s, py = (m0.y - v0.y) / v0.s;
  return soltoComElastico({ s, x: m.x - s * px, y: m.y - s * py }, c, W, H);
}

/** Fim do gesto: o zoom volta para dentro de [MIN, MAX] mantendo parado o ponto `foco` (o último meio dos dedos) e a
 *  foto volta para dentro dos limites. */
export function assentar(v: Vista, foco: Ponto, c: Caixa, W: number, H: number): Vista {
  const s = entre(v.s, MIN, MAX);
  if (s <= 1.02) return VISTA_INICIAL;
  const k = s / v.s;
  return prender({ s, x: foco.x - k * (foco.x - v.x), y: foco.y - k * (foco.y - v.y) }, c, W, H);
}

/** Toque duplo: ampliada volta à foto inteira; inteira amplia DUPLO× no ponto tocado (dentro dos limites). */
export function toqueDuplo(v: Vista, p: Ponto, c: Caixa, W: number, H: number): Vista {
  if (v.s > 1.02) return VISTA_INICIAL;
  const px = (p.x - v.x) / v.s, py = (p.y - v.y) / v.s;
  return prender({ s: DUPLO, x: p.x - DUPLO * px, y: p.y - DUPLO * py }, c, W, H);
}
