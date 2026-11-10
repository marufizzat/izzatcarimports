import { describe, it, expect } from 'vitest';
import { caixaFoto, limites, prender, pinca, assentar, toqueDuplo, escalaMacia, elastico, MAX, DUPLO, VISTA_INICIAL } from './zoomToque';

// palco do iPhone 13 na tela cheia: 390 × 514
const W = 390, H = 514;

describe('caixaFoto: a foto como o CSS desenha (contain + respiro de 5% medido pela largura)', () => {
  it('foto quadrada: cabe na largura (390 - 2×19,5 = 351)', () => {
    expect(caixaFoto(1200, 1200, W, H)).toEqual({ w: 351, h: 351 });
  });
  it('foto em pé: cabe na altura (514 - 39 = 475)', () => {
    const c = caixaFoto(900, 1600, W, H);
    expect(c.h).toBeCloseTo(475, 5);
    expect(c.w).toBeCloseTo(475 * 900 / 1600, 5);
  });
  it('sem o tamanho natural (carregando): a caixa inteira', () => {
    expect(caixaFoto(0, 0, W, H)).toEqual({ w: 351, h: 475 });
  });
});

describe('limites e prender', () => {
  const c = caixaFoto(1200, 1200, W, H);
  it('ampliada 2,5×: anda só até a borda da FOTO (não até sobrar fundo)', () => {
    const l = limites(2.5, c, W, H);
    expect(l.x).toBeCloseTo((2.5 * 351 - 390) / 2, 5);   // 243,75 (o limite pelo palco dava 292,5)
    expect(l.y).toBeCloseTo((2.5 * 351 - 514) / 2, 5);   // 181,75 (pelo palco: 385,5)
    const v = prender({ s: 2.5, x: 900, y: -900 }, c, W, H);
    expect(v.x).toBeCloseTo(l.x, 5);
    expect(v.y).toBeCloseTo(-l.y, 5);
  });
  it('num eixo em que a foto ampliada ainda cabe, ela fica no meio', () => {
    expect(limites(1.3, c, W, H).y).toBe(0);
    expect(prender({ s: 1.3, x: 0, y: 80 }, c, W, H).y).toBe(0);
  });
  it('abaixo de 1,02: volta à foto inteira', () => {
    expect(prender({ s: 1.01, x: 30, y: 30 }, c, W, H)).toEqual(VISTA_INICIAL);
  });
});

describe('elástico', () => {
  it('dentro do limite, livre; fora, só 30% do excesso', () => {
    expect(elastico(50, 100)).toBe(50);
    expect(elastico(200, 100)).toBeCloseTo(130, 5);
    expect(elastico(-200, 100)).toBeCloseTo(-130, 5);
  });
  it('zoom com resistência fora de 1–4×, contínuo nas pontas', () => {
    expect(escalaMacia(2)).toBe(2);
    expect(escalaMacia(1)).toBe(1);
    expect(escalaMacia(0.5)).toBeGreaterThan(0.7);
    expect(escalaMacia(0.5)).toBeLessThan(1);
    expect(escalaMacia(MAX)).toBe(MAX);
    expect(escalaMacia(8)).toBeLessThan(5);
  });
});

describe('pinça: o ponto entre os dedos fica entre os dedos', () => {
  const c = caixaFoto(1200, 1200, W, H);
  it('abrir os dedos em volta de (+80, +60): aquele ponto da foto não sai de baixo deles', () => {
    const m = { x: 80, y: 60 };
    const v = pinca(VISTA_INICIAL, m, m, 60, 180, c, W, H);   // 3×
    expect(v.s).toBeCloseTo(3, 5);
    // ponto da foto sob os dedos: (m - t) / s = (80, 60) / 1 no começo
    expect((m.x - v.x) / v.s).toBeCloseTo(80, 5);
    expect((m.y - v.y) / v.s).toBeCloseTo(60, 5);
  });
  it('dois dedos andando juntos arrastam a foto ampliada', () => {
    const v0 = { s: 2, x: 0, y: 0 };
    const v = pinca(v0, { x: 0, y: 0 }, { x: 40, y: -30 }, 100, 100, c, W, H);
    expect(v).toEqual({ s: 2, x: 40, y: -30 });
  });
  it('fechar os dedos abaixo de 1×: resiste e, ao soltar, volta à foto inteira', () => {
    const v = pinca(VISTA_INICIAL, { x: 0, y: 0 }, { x: 0, y: 0 }, 200, 60, c, W, H);
    expect(v.s).toBeLessThan(1);
    expect(v.s).toBeGreaterThan(0.6);
    expect(assentar(v, { x: 0, y: 0 }, c, W, H)).toEqual(VISTA_INICIAL);
  });
  it('passou do máximo: ao soltar volta a 4× sem o ponto sair do lugar (dentro dos limites)', () => {
    const v = pinca({ s: 3, x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 100, 200, c, W, H);
    expect(v.s).toBeGreaterThan(MAX);
    const a = assentar(v, { x: 0, y: 0 }, c, W, H);
    expect(a.s).toBe(MAX);
    expect(a.x).toBeCloseTo(0, 5);
  });
});

describe('toque duplo', () => {
  const c = caixaFoto(1200, 1200, W, H);
  it('amplia 2,5× no ponto tocado; de novo, volta', () => {
    const v = toqueDuplo(VISTA_INICIAL, { x: 60, y: -40 }, c, W, H);
    expect(v.s).toBe(DUPLO);
    expect(v.x).toBeCloseTo(60 - 2.5 * 60, 5);
    expect(v.y).toBeCloseTo(-40 + 2.5 * 40, 5);
    expect(toqueDuplo(v, { x: 0, y: 0 }, c, W, H)).toEqual(VISTA_INICIAL);
  });
  it('toque na beirada: amplia sem passar da borda da foto', () => {
    const v = toqueDuplo(VISTA_INICIAL, { x: 190, y: 250 }, c, W, H);
    const l = limites(DUPLO, c, W, H);
    expect(Math.abs(v.x)).toBeLessThanOrEqual(l.x + 1e-9);
    expect(Math.abs(v.y)).toBeLessThanOrEqual(l.y + 1e-9);
  });
});
