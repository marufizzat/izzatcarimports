import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { sobreposicao, mesmaGeracao, doMesmoCarro, MAX_CARRO, MIN_MESMA } from './relacionadas';
import type { Peca } from './dados';

const peca = (o: Partial<Peca>): Peca => ({
  id: 'MLB0', slug: 's', t: 't', n: 'Peça', p: 100, fotos: ['f'], ml: '', f: false, b: 'Volkswagen', m: 'Golf',
  y: null, c: 'Iluminação', s: 'Faróis Dianteiros', oem: '', o: '', ficha: [], desc: '', rel: [], ...o,
});

describe('relacionadas: geração pelo ano', () => {
  it('sobreposição = parte da faixa menor', () => {
    expect(sobreposicao([2014, 2021], [2013, 2020])).toBeCloseTo(7 / 8);
    expect(sobreposicao([2014, 2021], [1999, 2006])).toBe(0);
    expect(sobreposicao([2005, 2005], [2000, 2013])).toBe(1);
  });
  it('encostar um ano não é a mesma geração (Golf 1999–2014 x 2014–2021)', () => {
    expect(mesmaGeracao([2014, 2021], [1999, 2014])).toBe(false);
    expect(mesmaGeracao([2014, 2021], [2013, 2020])).toBe(true);
    expect(mesmaGeracao([2014, 2021], null)).toBe(false);
  });
});

describe('relacionadas: do mesmo carro', () => {
  const p = peca({ id: 'MLB1', y: [2014, 2021] });
  const novo = (i: number, o: Partial<Peca> = {}) => peca({ id: `MLB${100 + i}`, n: `Peça ${String(i).padStart(2, '0')}`, y: [2013, 2020], ...o });

  it('Golf de 1999 nunca entra no grupo da mesma geração de um Golf 2014', () => {
    const lista = [p, ...Array.from({ length: 9 }, (_, i) => novo(i)), peca({ id: 'MLB9', n: 'Break light', y: [1999, 2006] })];
    const r = doMesmoCarro(p, lista);
    expect(r.mesma).toHaveLength(MAX_CARRO);
    expect(r.mesma.every((x) => x.y && x.y[0] >= 2013)).toBe(true);
    expect(r.outras).toEqual([]);                      // a mesma geração encheu: não completa
    expect(r.mesma.find((x) => x.id === p.id)).toBeUndefined();
  });

  it('com poucas da mesma geração, completa com outros anos à parte (os mais perto primeiro; sem ano não entra)', () => {
    const lista = [p, novo(1), novo(2),
      peca({ id: 'MLB7', n: 'A', y: [1994, 1998] }), peca({ id: 'MLB8', n: 'B', y: [2008, 2013] }), peca({ id: 'MLB6', n: 'C', y: null })];
    const r = doMesmoCarro(p, lista);
    expect(r.mesma.map((x) => x.id)).toEqual(['MLB101', 'MLB102']);
    expect(r.outras.map((x) => x.id)).toEqual(['MLB8', 'MLB7']);   // 2008–2013, 1994–1998
    expect(r.mesma.length + r.outras.length).toBeLessThanOrEqual(MAX_CARRO);
    expect(r.mesma.length).toBeLessThan(MIN_MESMA);
  });

  it('mesma subfamília primeiro, depois mesma família; "Outros" de outra família não conta como subfamília', () => {
    const lista = [p,
      novo(1, { c: 'Motor', s: 'Faróis Dianteiros' }),
      novo(2, { c: 'Iluminação', s: 'Lanternas' }),
      novo(3, { c: 'Iluminação', s: 'Faróis Dianteiros' })];
    expect(doMesmoCarro(p, lista).mesma.map((x) => x.id)).toEqual(['MLB103', 'MLB102', 'MLB101']);
  });

  it('peça sem ano: mostra o modelo inteiro e avisa (semAno)', () => {
    const q = peca({ id: 'MLB2', y: null });
    const r = doMesmoCarro(q, [q, novo(1), peca({ id: 'MLB9', y: [1999, 2006] })]);
    expect(r.semAno).toBe(true);
    expect(r.mesma).toHaveLength(2);
    expect(r.outras).toEqual([]);
  });
});

describe('relacionadas: estoque real', () => {
  const arq = 'src/data/pecas.json';
  it.skipIf(!existsSync(arq))('nenhuma página mistura outra geração no grupo "mesma geração"', () => {
    const pecas: Peca[] = JSON.parse(readFileSync(arq, 'utf-8'));
    const porCarro = new Map<string, Peca[]>();
    for (const x of pecas) if (x.b && x.m) porCarro.set(`${x.b}|${x.m}`, [...(porCarro.get(`${x.b}|${x.m}`) ?? []), x]);
    let completadas = 0;
    for (const x of pecas) {
      if (!x.b || !x.m || !x.y) continue;
      const r = doMesmoCarro(x, porCarro.get(`${x.b}|${x.m}`)!);
      for (const o of r.mesma) expect(mesmaGeracao(x.y, o.y), `${x.id} -> ${o.id}`).toBe(true);
      for (const o of r.outras) expect(!!o.y && !mesmaGeracao(x.y, o.y)).toBe(true);
      if (r.outras.length) completadas++;
    }
    expect(completadas).toBeLessThan(pecas.length / 10);
  });
});
