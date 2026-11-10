// Auditoria 4, 9.1: a descrição (meta e prévia do link) de toda peça cabe em 160 caracteres e nunca perde o preço.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Peca } from './dados';
import { brl, codigoDaPeca } from './dados';
import { caber, descricaoPeca, DESCRICAO_MAX } from './descricao';

describe('descrição com até 160 caracteres', () => {
  it('caber: a 1ª que cabe; nenhuma: a última cortada no fim de uma palavra', () => {
    expect(caber(['a'.repeat(170), 'curta'])).toBe('curta');
    const c = caber(['palavra '.repeat(30)], 40);
    expect(c.length).toBeLessThanOrEqual(40);
    expect(c.endsWith('…')).toBe(true);
    expect(c).not.toMatch(/ …$/);
  });
  it('a peça completa quando cabe (nome, carro, anos, preço); longa: encurta o resto e nunca o preço', () => {
    expect(descricaoPeca({ n: 'Farol', b: 'Fiat', m: 'Uno', y: [2010, 2014], p: 300 }, '', '300,00'))
      .toBe('Farol original do Fiat Uno, 2010 a 2014. Peça usada, de carro com baixa legal no Detran-RS. R$ 300,00, nota fiscal e 90 dias de garantia.');
    const longa = descricaoPeca({ n: 'Farol direito', b: 'Chevrolet', m: 'Cruze', y: [2017, 2021], p: 1200 }, 'E131464301', '1.200,00');
    expect(longa.length).toBeLessThanOrEqual(160);
    expect(longa).toMatch(/^Farol direito original do Chevrolet Cruze, 2017 a 2021, código E131464301\. .*R\$ 1\.200,00, nota fiscal e 90 dias de garantia\.$/);
  });
  it('todas as peças do estoque: até 160, com o preço e a garantia', () => {
    const pecas: Peca[] = JSON.parse(readFileSync('src/data/pecas.json', 'utf-8'));
    expect(pecas.length).toBeGreaterThan(1000);
    const ruins = pecas.map((p) => descricaoPeca(p, codigoDaPeca(p.oem), brl(p.p))).filter((d) => d.length > DESCRICAO_MAX || !/R\$ [\d.]+,\d\d, nota fiscal e 90 dias de garantia\.$/.test(d));
    expect(ruins.slice(0, 3)).toEqual([]);
  });
});
