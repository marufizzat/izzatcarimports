// Auditoria 4, 9.1: a descrição (meta e prévia do link) de toda peça cabe em 160 caracteres e nunca perde o preço.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Peca } from './dados';
import { brl, codigoDaPeca } from './dados';
import { caber, descricaoPeca, descricaoLink, tituloLink, DESCRICAO_MAX } from './descricao';

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
    expect(pecas.length).toBeGreaterThan(0);
    const ruins = pecas.map((p) => descricaoPeca(p, codigoDaPeca(p.oem), brl(p.p))).filter((d) => d.length > DESCRICAO_MAX || !/R\$ [\d.]+,\d\d, nota fiscal e 90 dias de garantia\.$/.test(d));
    expect(ruins.slice(0, 3)).toEqual([]);
  });
});

// Cliente oculto 10/11, atrito 10: o link da peça mandado no WhatsApp mostra 2 linhas; o preço e o código vêm primeiro.
describe('prévia do link da peça (og:title e og:description)', () => {
  const clio = { n: 'Caixa filtro ar', b: 'Renault', m: 'Clio', ms: ['Clio', 'Logan', 'Sandero'], y: [2007, 2014] as [number, number], p: 244.64 };
  it('o exemplo do relatório (MLB7862060624): preço, código, carros e anos, e a garantia', () => {
    expect(descricaoLink(clio, '8200328856', brl(clio.p)))
      .toBe('R$ 244,64 · Cód. 8200328856 · Renault Clio, Logan e Sandero 2007 a 2014 · Peça original usada, com nota fiscal e 90 dias de garantia.');
    expect(tituloLink(clio)).toBe('Caixa filtro ar Renault Clio, Logan e Sandero');
  });
  it('sem código, sem carro ou sem anos: a parte sai; preço sempre com 2 casas', () => {
    expect(descricaoLink({ n: 'Fechadura', p: 90 }, '', brl(90))).toBe('R$ 90,00 · Peça original usada, com nota fiscal e 90 dias de garantia.');
    expect(descricaoLink({ n: 'Farol', b: 'Fiat', m: 'Uno', y: [2010, 2010], p: 1200.5 }, '', brl(1200.5)))
      .toBe('R$ 1.200,50 · Fiat Uno 2010 · Peça original usada, com nota fiscal e 90 dias de garantia.');
    expect(tituloLink({ n: 'Fechadura', p: 90 })).toBe('Fechadura');
  });
  it('todas as peças do estoque: começa pelo preço; o título é o nome (nunca o título cru do anúncio)', () => {
    const pecas: Peca[] = JSON.parse(readFileSync('src/data/pecas.json', 'utf-8'));
    const ruins = pecas.filter((p) => !/^R\$ [\d.]+,\d\d( · |$)/.test(descricaoLink(p, codigoDaPeca(p.oem), brl(p.p))) || !tituloLink(p).startsWith(p.n));
    expect(ruins.slice(0, 3).map((p) => p.id)).toEqual([]);
  });
});
