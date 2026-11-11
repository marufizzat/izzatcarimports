import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { garagem, chaveCarro } from './garagem';
import { resumo } from './dados';
import { tamanhoWebp } from './categorias';
import { ehVariante } from '../../scripts/variantes-imagens.mjs';

// Arte do carro (public/arte/v2/carro-<k>.webp): invariantes, sem contar carros nem peças (o estoque muda todo dia).
const DIR = join('public', 'arte', 'v2');
const manifesto: Record<string, { h: string; w: number; v: number[] }> = JSON.parse(readFileSync(join('src', 'data', 'variantes-arte.json'), 'utf-8'));

describe('arte dos carros', () => {
  it('a chave do carro é a mesma do preparar_dados.py (todos os carros do resumo)', () => {
    for (const c of resumo().carros) expect(chaveCarro(c.b, c.m), `${c.b} ${c.m}`).toBe(c.k);
  });

  it('toda arte de carro no ar é 1200×800 e tem as variantes 600 e 900 em dia no manifesto', () => {
    const artes = readdirSync(DIR).filter((f) => /^carro-[a-z0-9-]+\.webp$/.test(f) && !ehVariante(f, DIR));
    expect(artes.length).toBeGreaterThan(0);
    for (const f of artes) {
      expect(tamanhoWebp(readFileSync(join(DIR, f))), f).toEqual({ w: 1200, h: 800 });
      expect(manifesto[f]?.v, `${f}: rode node scripts/variantes-imagens.mjs`).toEqual([600, 900]);
      for (const w of [600, 900]) expect(existsSync(join(DIR, f.replace(/\.webp$/, `-${w}.webp`))), `${f} -${w}`).toBe(true);
    }
  });

  it('todo modelo da garagem que diz ter arte aponta para um arquivo que existe, com o srcset inteiro', () => {
    // modelo sem arte: nada a conferir (a abertura usa o desenho "sem carro"); arte de modelo que saiu do estoque: ignorada
    for (const marca of garagem().marcas) {
      for (const mo of marca.modelos) {
        if (!mo.a) continue;
        const nome = `${marca.n} ${mo.n}`;
        expect(mo.a, nome).toMatch(/^[a-z0-9-]{1,80}$/);
        expect(existsSync(join(DIR, `carro-${mo.a}.webp`)), `${nome}: carro-${mo.a}.webp`).toBe(true);
        expect(mo.as, `${nome}: srcset (rode node scripts/variantes-imagens.mjs)`).toEqual([600, 900, 1200]);
      }
    }
  });

  it('o modelo sem página própria usa a chave que a página teria; o apelido usa a arte do principal', () => {
    const r = resumo();
    const comPagina = new Set(r.carros.map((c) => `${c.b}|${c.m}`));
    for (const marca of garagem().marcas) {
      for (const mo of marca.modelos) {
        if (!mo.a || comPagina.has(`${marca.n}|${mo.n}`)) continue;
        expect(mo.a, `${marca.n} ${mo.n}`).toBe(chaveCarro(marca.n, mo.n));
      }
    }
  });
});
