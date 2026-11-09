import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bento, tamanhoWebp } from './categorias';

describe('categorias', () => {
  it('bento fecha a grade sem buraco (2 grandes quando dá)', () => {
    expect(bento(19, 5)).toEqual({ grandes: 2, todas: false });   // a grade antiga: 2 grandes + 17
    expect(bento(25, 5)).toEqual({ grandes: 3, todas: true });    // 3×4 + 22 + o cartão final = 35
    expect(bento(25, 4)).toEqual({ grandes: 2, todas: true });    // 2×4 + 23 + 1 = 32
    for (const n of [5, 12, 19, 24, 25, 26, 31]) for (const c of [4, 5]) {
      const b = bento(n, c);
      expect((n + 3 * b.grandes + (b.todas ? 1 : 0)) % c).toBe(0);
    }
  });
  it('tamanhoWebp lê o cabeçalho (VP8, VP8L, VP8X)', () => {
    const cab = (tipo: string, f: (b: Uint8Array) => void) => {
      const b = new Uint8Array(40);
      b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0); b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
      b.set([...tipo].map((c) => c.charCodeAt(0)), 12); f(b); return b;
    };
    // VP8 (com perda): largura e altura de 14 bits em 26 e 28
    expect(tamanhoWebp(cab('VP8 ', (b) => { b[26] = 1254 & 255; b[27] = 1254 >> 8; b[28] = 991 & 255; b[29] = 991 >> 8; }))).toEqual({ w: 1254, h: 991 });
    // VP8X: largura-1 e altura-1 em 24 bits, em 24 e 27
    expect(tamanhoWebp(cab('VP8X', (b) => { b[24] = 799 & 255; b[25] = 799 >> 8; b[27] = 631 & 255; b[28] = 631 >> 8; }))).toEqual({ w: 800, h: 632 });
    // VP8L (sem perda): 14 bits de largura-1 e 14 de altura-1 a partir do byte 21
    const v = (799) | (631 << 14);
    expect(tamanhoWebp(cab('VP8L', (b) => { b[21] = v & 255; b[22] = (v >> 8) & 255; b[23] = (v >> 16) & 255; b[24] = (v >>> 24) & 255; }))).toEqual({ w: 800, h: 632 });
    expect(tamanhoWebp(readFileSync('public/arte/v2/cat-motor.webp'))).toEqual({ w: 800, h: 800 });
    expect(tamanhoWebp(new Uint8Array(10))).toBeNull();
  });
});
