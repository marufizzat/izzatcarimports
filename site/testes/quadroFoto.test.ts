// Enquadramento das fotos do ML na galeria (lib/quadroFoto.ts): a peça nunca é cortada, a foto cobre o quadro (ou,
// com a classe "i", fica no meio do lado que sobra) e foto sem medida fica como antes. Confere também TODAS as medidas
// reais de src/data/fotos-ml-caixas.json.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { quadro, atributosQuadro, fotosGaleria, classeFoto, MARGEM, INTEIRA } from '../src/lib/quadroFoto';

/** lê o style gerado de volta (como o CSS faz: --h cai no --w, --x/--y no 0) */
function ler(style: string) {
  const v: Record<string, number> = {};
  for (const par of style.split(';')) { const [k, n] = par.split(':'); v[k.trim()] = Number(n); }
  return { w: v['--w'], h: v['--h'] ?? v['--w'], x: v['--x'] ?? 0, y: v['--y'] ?? 0 };
}
/** a peça e a foto no quadro, depois do arredondamento (unidade = lado do quadro) */
function noQuadro(m: number[]) {
  const a = atributosQuadro(quadro(m));
  if (!a.style) return null;
  const { w, h, x, y } = ler(a.style);
  const [W, H, x0, y0, x1, y1] = m;
  const px = (X: number) => (X * w) / W - x, py = (Y: number) => (Y * h) / H - y;
  return { borda: a.cls === 'i', w, h, foto: [px(0), py(0), px(W), py(H)], peca: m.length >= 6 ? [px(x0), py(y0), px(x1), py(y1)] : null };
}
const TOL = 0.004;   // < 3 px num palco de 620 px
const e = 1e-9;      // só o erro da conta em ponto flutuante
/** o mesmo que confere(), sem expect: '' = tudo certo, senão o motivo */
function problema(m: number[]): string {
  const r = noQuadro(m);
  if (!r) return '';
  const [fx0, fy0, fx1, fy1] = r.foto;
  for (const [a, b, tam] of [[fx0, fx1, r.w], [fy0, fy1, r.h]]) {
    if (tam >= 1) { if (a > e || b < 1 - e) return 'fresta do fundo'; }
    else if (!r.borda || Math.abs(a + b - 1) >= 0.004) return 'foto fora do meio';
  }
  if (r.peca) {
    const [a, b, c, d] = r.peca;
    if (a < -TOL || b < -TOL || c > 1 + TOL || d > 1 + TOL) return 'peça cortada';
  }
  return '';
}
function confere(m: number[]) {
  const r = noQuadro(m);
  if (!r) return;
  const [fx0, fy0, fx1, fy1] = r.foto;
  // em cada eixo: ou a foto cobre o quadro todo (nada de fresta do fundo), ou fica no meio dele (classe "i")
  for (const [a, b, tam] of [[fx0, fx1, r.w], [fy0, fy1, r.h]]) {
    if (tam >= 1) { expect(a).toBeLessThanOrEqual(e); expect(b).toBeGreaterThanOrEqual(1 - e); }
    else { expect(r.borda).toBe(true); expect(Math.abs(a + b - 1)).toBeLessThan(0.004); }
  }
  if (r.peca) {                              // e a peça fica inteira dentro dele
    const [a, b, c, d] = r.peca;
    expect(a).toBeGreaterThanOrEqual(-TOL);
    expect(b).toBeGreaterThanOrEqual(-TOL);
    expect(c).toBeLessThanOrEqual(1 + TOL);
    expect(d).toBeLessThanOrEqual(1 + TOL);
  }
}

describe('quadro das fotos do ML na galeria', () => {
  it('sem medida: nada (a foto aparece como antes)', () => {
    expect(quadro(undefined)).toBeNull();
    expect(atributosQuadro(quadro(undefined))).toEqual({});
    expect(atributosQuadro(quadro([0, 0]))).toEqual({});
  });

  it('peça no meio de uma foto quadrada: centrada ocupando ~84%', () => {
    const r = noQuadro([1200, 1200, 400, 400, 800, 800])!;
    // 400 px de peça: ampliar a 84% exigiria um corte de 476 px, abaixo do mínimo (800 px): fica 800 e a peça no centro
    expect(Math.abs((r.peca![0] + r.peca![2]) / 2 - 0.5)).toBeLessThan(0.01);
    const grande = noQuadro([1200, 1200, 100, 150, 1100, 1050])!;
    expect(grande.peca![2] - grande.peca![0]).toBeCloseTo(1 - 2 * MARGEM, 2);
    expect(grande.borda).toBe(false);
  });

  it('foto em pé com a peça pequena no canto: a peça vem para o centro, inteira, sem borda', () => {
    confere([900, 1200, 20, 900, 260, 1180]);
    expect(noQuadro([900, 1200, 20, 900, 260, 1180])!.borda).toBe(false);
  });

  it('peça mais comprida que o lado curto da foto: classe i, foto no meio, peça a 84% (nunca menor que antes)', () => {
    const r = noQuadro([900, 1200, 300, 100, 600, 1100])!;   // peça alta numa foto em pé
    expect(r.borda).toBe(true);
    expect(r.peca![3] - r.peca![1]).toBeCloseTo(1 - 2 * MARGEM, 2);
    const cheia = noQuadro([1200, 800, 0, 100, 1200, 700])!; // peça de ponta a ponta: a foto inteira a 88%
    expect(cheia.w).toBeCloseTo(INTEIRA, 2);
    confere([1200, 800, 0, 100, 1200, 700]);
  });

  it('quadrado a um fio do lado da foto: sem fresta de 1 px do fundo (caso real 862606-MLB112506866525)', () => {
    confere([656, 827, 28, 36, 616, 731]);
    expect(problema([656, 827, 28, 36, 616, 731])).toBe('');
  });

  it('sem peça achada: foto quadrada enche o quadro; deitada fica inteira a 88%', () => {
    expect(atributosQuadro(quadro([1200, 1200]))).toEqual({ style: '--w:1' });
    const a = atributosQuadro(quadro([1200, 900]));
    expect(a.cls).toBe('i');
    expect(ler(a.style!).w).toBeCloseTo(INTEIRA, 2);
  });

  it('foto pequena do ML não é esticada (no máximo 640/560 do tamanho real no palco do computador)', () => {
    for (const m of [[500, 500, 50, 60, 450, 470], [426, 499, 18, 0, 408, 478], [480, 360], [500, 500]]) {
      const r = noQuadro(m)!;
      expect(r.borda).toBe(true);
      expect(r.w).toBeLessThanOrEqual(m[0] / 560 + 0.001);       // largura da foto em lados do quadro (+ arredondamento)
      confere(m);
    }
  });

  it('foto grande nunca ampliada além de 800 px no quadro (nitidez no retina)', () => {
    for (const m of [[1200, 1200, 500, 500, 700, 700], [1200, 900, 30, 600, 230, 880], [900, 1200, 400, 50, 600, 300]]) {
      const r = noQuadro(m)!;
      expect(m[0] / r.w).toBeGreaterThanOrEqual(800 - 2);   // px da foto num lado do quadro
      confere(m);
    }
    const baixa = noQuadro([1200, 700, 500, 300, 700, 500])!;   // lado curto < 800: a altura inteira da foto, sem borda
    expect(baixa.borda).toBe(false);
    expect(1200 / baixa.w).toBeCloseTo(700, -1);
  });

  it('classe no fim da entrada não muda o quadro', () => {
    expect(quadro([900, 1200, 100, 300, 800, 1000, 'p', '0123456789abcdef'])).toEqual(quadro([900, 1200, 100, 300, 800, 1000]));
    expect(quadro([1200, 900, 's', '0123456789abcdef'])).toEqual(quadro([1200, 900]));
  });

  it('galeria: tira o marketing, põe o carro no fim, mantém a ordem e nunca fica sem foto', () => {
    const t = { a: [1, 1, 'p'], b: [1, 1, 'm'], c: [1, 1, 'c'], d: [1, 1], e: [1, 1, 's'], f: [1, 1, 'm'] };
    expect(fotosGaleria(['c', 'a', 'b', 'd', 'e'], t)).toEqual(['a', 'd', 'e', 'c']);
    expect(fotosGaleria(['b', 'f'], t)).toEqual(['b', 'f']);            // tudo marketing: fica como veio
    expect(fotosGaleria(['x', '', 'a'], t)).toEqual(['x', 'a']);         // sem medida conta como peça
    expect(classeFoto('d', t)).toBeNull();
  });

  it('style curto: sem zeros nem valores repetidos', () => {
    expect(atributosQuadro(quadro([1200, 1200, 0, 0, 1200, 1200])).style).toBe('--w:1');
    const s = atributosQuadro(quadro([900, 1200, 100, 300, 800, 1000])).style!;
    expect(s).not.toMatch(/:-?0\./);
    expect(s.length).toBeLessThan(40);
  });

  it('casos aleatórios: a peça nunca é cortada e a foto cobre o quadro ou fica no meio', () => {
    let semente = 7;
    const r = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4000; i++) {
      const W = 300 + Math.round(r() * 900), H = 300 + Math.round(r() * 900);
      const x0 = Math.round(r() * W * 0.9), y0 = Math.round(r() * H * 0.9);
      const x1 = x0 + 1 + Math.round(r() * (W - x0 - 1)), y1 = y0 + 1 + Math.round(r() * (H - y0 - 1));
      confere([W, H, x0, y0, x1, y1]);
      confere([W, H]);
    }
  }, 30000);

  // 45 mil fotos: conta sem expect (rápido mesmo no robô) e só falha no fim, mostrando as primeiras chaves com problema
  it('todas as medidas reais (src/data/fotos-ml-caixas.json)', (ctx) => {
    const arq = 'src/data/fotos-ml-caixas.json';
    if (!existsSync(arq)) return ctx.skip();
    const medidas: Record<string, (number | string)[]> = JSON.parse(readFileSync(arq, 'utf-8'));
    const ruins: string[] = [];
    for (const [k, e] of Object.entries(medidas)) {
      const m = e.filter((v): v is number => typeof v === 'number');
      const c = classeFoto(k, medidas);
      if (!(m.length === 2 || m.length === 6) || (c !== null && !'psmc'.includes(c)) || problema(m)) ruins.push(`${k} ${JSON.stringify(e)} ${problema(m)}`);
    }
    expect(ruins.slice(0, 5)).toEqual([]);
  }, 30000);
});
