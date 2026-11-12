import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { montarSrcset, srcsetArte, sizesCategoria, SIZES, type Entrada } from './variantes';
import { tamanhoWebp } from './categorias';
// o script do terminal (.mjs) e o teste usam a mesma regra
import { ehVariante } from '../../scripts/variantes-imagens.mjs';

const hash = (b: Buffer) => createHash('sha1').update(b).digest('hex').slice(0, 12);

describe('variantes das artes (srcset)', () => {
  it('a variante só entra se foi feita da arte atual; senão só o src', () => {
    const pub = mkdtempSync(join(tmpdir(), 'variantes-'));
    mkdirSync(join(pub, 'arte', 'v2'), { recursive: true });
    const arte = Buffer.from('arte de hoje');
    writeFileSync(join(pub, 'arte/v2/carro-x.webp'), arte);
    writeFileSync(join(pub, 'arte/v2/carro-x-600.webp'), 'v600');
    writeFileSync(join(pub, 'arte/v2/carro-x-900.webp'), 'v900');
    const em = (e: Entrada) => montarSrcset('/arte/v2/carro-x.webp', pub, { 'carro-x.webp': e });
    expect(em({ h: hash(arte), w: 1200, v: [600, 900] }))
      .toBe('/arte/v2/carro-x-600.webp 600w, /arte/v2/carro-x-900.webp 900w, /arte/v2/carro-x.webp 1200w');
    // arte trocada e o script não rodou: o hash não bate
    expect(em({ h: 'velho0000000', w: 1200, v: [600, 900] })).toBeUndefined();
    // variante que falta
    expect(em({ h: hash(arte), w: 1200, v: [600, 700] })).toBeUndefined();
    // fora do manifesto
    expect(montarSrcset('/arte/v2/carro-x.webp', pub, {})).toBeUndefined();
  });

  it('variante de verdade x carro com número no nome', () => {
    const dir = mkdtempSync(join(tmpdir(), 'variantes-'));
    for (const f of ['carro-peugeot-208.webp', 'carro-x.webp', 'cat-motor.webp', 'topo-cat-motor.webp']) writeFileSync(join(dir, f), '');
    expect(ehVariante('carro-x-600.webp', dir)).toBe(true);
    expect(ehVariante('carro-x-900.webp', dir)).toBe(true);
    expect(ehVariante('carro-peugeot-208.webp', dir)).toBe(false);   // 208 não é largura de variante
    expect(ehVariante('carro-y-600.webp', dir)).toBe(false);         // sem a arte carro-y.webp
    expect(ehVariante('cat-motor-600.webp', dir)).toBe(true);
    expect(ehVariante('cat-motor-900.webp', dir)).toBe(false);       // a categoria só tem 600
    expect(ehVariante('topo-cat-motor-640.webp', dir)).toBe(true);
  });

  it('as variantes no ar têm a largura que o srcset diz', () => {
    const artes = readdirSync('public/arte/v2').filter((f) => /^(carro|cat|topo-cat)-[a-z0-9-]+\.webp$/.test(f) && !ehVariante(f, 'public/arte/v2'));
    let com = 0;
    for (const f of artes) {
      const s = srcsetArte(`/arte/v2/${f}`);
      if (!s) continue;   // arte nova sem variante: fica só com o src (o build não quebra)
      com++;
      for (const item of s.split(', ')) {
        const [url, w] = item.split(' ');
        expect(existsSync(join('public', url)), url).toBe(true);
        expect(tamanhoWebp(readFileSync(join('public', url)))?.w, url).toBe(Number(w.slice(0, -1)));
      }
    }
    expect(com).toBeGreaterThan(0);
  });

  it('sizes sem erro de digitação (cada parte é "(max-width: Npx) calc(...)" ou um tamanho)', () => {
    const todos = [...Object.values(SIZES), sizesCategoria(false, false), sizesCategoria(true, true)];
    for (const s of todos) {
      const partes = s.split(/,\s(?![^()]*\))/);
      partes.slice(0, -1).forEach((p) => expect(p).toMatch(/^\(max-width: \d+px\) (calc\([^()]+\)|\d+(px|vw))$/));
      // o último valor é a medida do PC: larga(N) = "max(Npx,N/17 vw)" (a tela larga cresce com o zoom da raiz)
      expect(partes[partes.length - 1]).toMatch(/^max\(\d+px,\d+(\.\d)?vw\)$/);
    }
  });
});
