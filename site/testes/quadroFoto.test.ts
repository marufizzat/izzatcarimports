// Enquadramento das fotos do ML na galeria (lib/quadroFoto.ts): a peça nunca é cortada, o quadro nunca amplia além do
// quadrado da própria foto (o lado curto aparece sempre inteiro), a peça fica a 4%+ da borda do quadro, foto pequena
// fica inteira e nítida, caixa incerta mostra a foto inteira, a foto cobre o quadro (ou, com a classe "i", fica no meio
// do lado que sobra) e foto sem medida fica como antes. Confere também TODAS as medidas reais de
// src/data/fotos-ml-caixas.json.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { quadro, atributosQuadro, fotosGaleria, classeFoto, MARGEM, INTEIRA, RESPIRO, NITIDO, INCERTA } from '../src/lib/quadroFoto';

/** lê o style gerado de volta (como o CSS faz: --h cai no --w, --x/--y no 0) */
function ler(style: string) {
  const v: Record<string, number> = {};
  for (const par of style.split(';')) { const [k, n] = par.split(':'); v[k.trim()] = Number(n); }
  return { w: v['--w'], h: v['--h'] ?? v['--w'], x: v['--x'] ?? 0, y: v['--y'] ?? 0 };
}
type E = (number | string)[];
/** a peça e a foto no quadro, depois do arredondamento (unidade = lado do quadro) */
function noQuadro(e: E) {
  const a = atributosQuadro(quadro(e));
  if (!a.style) return null;
  const { w, h, x, y } = ler(a.style);
  const m = e.filter((v): v is number => typeof v === 'number');
  const [W, H, x0, y0, x1, y1] = m;
  const px = (X: number) => (X * w) / W - x, py = (Y: number) => (Y * h) / H - y;
  return { borda: a.cls === 'i', w, h, W, H, foto: [px(0), py(0), px(W), py(H)],
           peca: m.length >= 6 ? [px(x0), py(y0), px(x1), py(y1)] : null, incerta: e.includes(INCERTA) };
}
const TOL = 0.004;   // < 3 px num palco de 620 px (o arredondamento de 3 casas e o encaixe de < 2 px da foto)
const e = 1e-9;      // só o erro da conta em ponto flutuante
/** '' = tudo certo, senão o motivo (sem expect: rápido nas 45 mil fotos reais) */
function problema(m: E): string {
  const r = noQuadro(m);
  if (!r) return '';
  const [fx0, fy0, fx1, fy1] = r.foto;
  for (const [a, b, tam] of [[fx0, fx1, r.w], [fy0, fy1, r.h]]) {
    // em cada eixo: ou a foto cobre o quadro todo (nada de fresta do fundo), ou fica no meio dele (classe "i")
    if (tam >= 1) { if (a > e || b < 1 - e) return 'fresta do fundo'; }
    else if (!r.borda || Math.abs(a + b - 1) >= 0.004) return 'foto fora do meio';
  }
  // nunca amplia além do quadrado da foto: o lado curto aparece inteiro
  const [c0, c1] = r.W <= r.H ? [fx0, fx1] : [fy0, fy1];
  if (c0 < -TOL || c1 > 1 + TOL) return 'lado curto cortado';
  // foto pequena e caixa incerta/sem peça: a foto inteira
  const inteira = Math.max(r.W, r.H) < NITIDO || r.incerta || !r.peca;
  if (inteira && (fx0 < -TOL || fy0 < -TOL || fx1 > 1 + TOL || fy1 > 1 + TOL)) return 'foto que devia estar inteira cortada';
  // (pela conta exata: o style arredondado a 3 casas erra até 0,3% numa foto de 300 px)
  if (Math.max(r.W, r.H) < NITIDO && r.W / quadro(m)!.w < NITIDO - 1) return 'foto pequena ampliada demais';
  if (r.peca && !r.incerta) {
    const [a, b, c, d] = r.peca;
    if (a < -TOL || b < -TOL || c > 1 + TOL || d > 1 + TOL) return 'peça cortada';
    if (Math.min(a, b, 1 - c, 1 - d) < RESPIRO - TOL) return 'peça sem respiro';
  }
  return '';
}
const confere = (m: E) => expect(problema(m), JSON.stringify(m)).toBe('');

describe('quadro das fotos do ML na galeria', () => {
  it('sem medida: nada (a foto aparece como antes)', () => {
    expect(quadro(undefined)).toBeNull();
    expect(atributosQuadro(quadro(undefined))).toEqual({});
    expect(atributosQuadro(quadro([0, 0]))).toEqual({});
  });

  it('peça no meio de uma foto quadrada: a foto inteira (nunca amplia além do quadrado dela)', () => {
    const r = noQuadro([1200, 1200, 400, 400, 800, 800])!;
    expect(r.w).toBe(1);
    expect(r.borda).toBe(false);
    expect(Math.abs((r.peca![0] + r.peca![2]) / 2 - 0.5)).toBeLessThan(0.01);
    confere([1200, 1200, 400, 400, 800, 800]);
  });

  it('foto deitada: o quadro corta só o lado longo, centrado na peça, e a peça ocupa ~84% quando dá', () => {
    const r = noQuadro([1200, 900, 300, 100, 700, 800])!;   // peça alta numa foto deitada: 700/0,84 = 833 < 900
    expect(r.h).toBe(1);                                    // a altura inteira da foto
    expect(r.borda).toBe(false);
    expect(Math.abs((r.peca![0] + r.peca![2]) / 2 - 0.5)).toBeLessThan(0.01);
    confere([1200, 900, 300, 100, 700, 800]);
    const pe = noQuadro([900, 1200, 100, 260, 800, 1000])!;  // em pé: corta em cima e embaixo, a largura inteira
    expect(pe.w).toBe(1);
    expect(pe.peca![3] - pe.peca![1]).toBeLessThanOrEqual(1 - 2 * MARGEM + TOL);
    confere([900, 1200, 100, 260, 800, 1000]);
  });

  it('foto em pé com a peça pequena no canto: a peça vem para o centro, inteira, sem borda', () => {
    confere([900, 1200, 60, 900, 300, 1140]);
    expect(noQuadro([900, 1200, 60, 900, 300, 1140])!.borda).toBe(false);
  });

  it('peça mais comprida que o lado curto da foto: classe i, foto no meio, peça a 84% (nunca menor que antes)', () => {
    const r = noQuadro([900, 1200, 300, 100, 600, 1100])!;   // peça alta numa foto em pé
    expect(r.borda).toBe(true);
    expect(r.peca![3] - r.peca![1]).toBeCloseTo(1 - 2 * MARGEM, 2);
    confere([900, 1200, 300, 100, 600, 1100]);
  });

  it('respiro mínimo: peça encostada na borda da foto fica a 4% da borda do quadro (o canto não morde)', () => {
    for (const m of [[1200, 1200, 0, 0, 1200, 1198], [1200, 900, 0, 100, 1200, 700], [900, 1200, 0, 0, 500, 600],
                     [900, 1200, 200, 300, 900, 900], [1200, 1200, 300, 0, 900, 700]]) {
      const r = noQuadro(m)!;
      expect(r.borda).toBe(true);
      expect(Math.min(r.peca![0], r.peca![1], 1 - r.peca![2], 1 - r.peca![3])).toBeGreaterThanOrEqual(RESPIRO - TOL);
      confere(m);
    }
    // peça pequena encostada em cima: a foto só diminui o necessário (92% do quadro, 4% de cada lado)
    expect(noQuadro([1200, 1200, 300, 0, 900, 700])!.w).toBeCloseTo(1 - 2 * RESPIRO, 2);
    // peça de ponta a ponta: a foto inteira com o respiro de antes (88%), nunca menor
    expect(noQuadro([1200, 800, 0, 100, 1200, 700])!.w).toBeCloseTo(INTEIRA, 2);
  });

  it('quadrado a um fio do lado da foto: sem fresta de 1 px do fundo (caso real 862606-MLB112506866525)', () => {
    confere([656, 827, 28, 36, 616, 731]);
  });

  it('sem peça achada ou caixa incerta: a foto inteira no meio (88% no lado maior), mesmo quadrada', () => {
    for (const m of [[1200, 1200], [1200, 900], [900, 1200, 's', '0123456789abcdef'],
                     [1108, 646, 479, 31, 915, 285, 'p', '03034745f1e1510f', INCERTA],     // montagem: a caixa pegou o carro
                     [1200, 900, 500, 300, 700, 500, 'p', '0123456789abcdef', INCERTA]]) {
      const a = atributosQuadro(quadro(m));
      expect(a.cls).toBe('i');
      const r = noQuadro(m)!;
      expect(Math.max(r.w, r.h)).toBeCloseTo(INTEIRA, 2);
      confere(m);
    }
  });

  it('foto pequena: inteira e no máximo 1,25× no palco retina (NITIDO px da foto no quadro)', () => {
    for (const m of [[500, 500, 50, 60, 450, 470], [426, 499, 18, 0, 408, 478], [478, 145, 21, 6, 457, 139], [480, 360],
                     [563, 385, 26, 17, 538, 366], [1000, 1000, 100, 100, 900, 900]]) {
      const r = noQuadro(m)!;
      expect(r.borda).toBe(true);
      expect(Math.max(m[0] as number / r.w, m[1] as number / r.h)).toBeGreaterThanOrEqual(NITIDO - 2);
      confere(m);
    }
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
    expect(atributosQuadro(quadro([1200, 1200, 200, 200, 1000, 1000])).style).toBe('--w:1');
    const s = atributosQuadro(quadro([900, 1200, 100, 300, 800, 1000])).style!;
    expect(s).not.toMatch(/:-?0\./);
    expect(s.length).toBeLessThan(40);
  });

  it('casos aleatórios: a peça nunca é cortada e a foto cobre o quadro ou fica no meio', () => {
    let semente = 7;
    const r = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 4000; i++) {
      const W = 300 + Math.round(r() * 900), H = r() < 0.2 ? W : 300 + Math.round(r() * 900);
      const x0 = Math.round(r() * W * 0.9), y0 = Math.round(r() * H * 0.9);
      const x1 = x0 + 1 + Math.round(r() * (W - x0 - 1)), y1 = y0 + 1 + Math.round(r() * (H - y0 - 1));
      confere([W, H, x0, y0, x1, y1]);
      confere([W, H, x0, y0, x1, y1, 'p', '0123456789abcdef', INCERTA]);
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
      const outras = e.filter((v) => typeof v === 'string' && v.length !== 1 && v.length !== 16 && v !== INCERTA);
      const inc = e.includes(INCERTA) && (m.length !== 6 || m[0] === m[1]);   // incerta só com caixa e foto não quadrada
      if (!(m.length === 2 || m.length === 6) || (c !== null && !'psmc'.includes(c)) || outras.length || inc || problema(e))
        ruins.push(`${k} ${JSON.stringify(e)} ${problema(e)}`);
    }
    expect(ruins.slice(0, 5)).toEqual([]);
  }, 30000);
});
