import { describe, it, expect } from 'vitest';
import { vistoDe, normalizarVistos, registrar, paraMostrar, lerAtivas, itemDoVisto, contarVistos, MAX_VISTOS, type Visto } from './vistos';
import { cartaoHtml } from './vendidaCartoes';

const v = (i: number, o: Partial<Visto> = {}): Visto => ({
  id: `MLB${7000000000 + i}`, slug: `farol-${i}-MLB${7000000000 + i}`, nome: `Farol ${i}`, carro: 'Volvo XC60', anos: '2018 a 2024',
  preco: 1000 + i, capa: `/estudio-400/MLB${7000000000 + i}.webp`, cod: `3144683${i % 10}`, b: 'Volvo', m: 'XC60', y: [2018, 2024],
  e: '1', t: 1762800000000 - i, ...o,
});

describe('vistos: o que vem do localStorage (JSON velho ou estragado não quebra nada)', () => {
  it('lixo vira lista vazia', () => {
    for (const x of [null, undefined, 1, 'a', {}, true]) expect(normalizarVistos(x)).toEqual([]);
    expect(normalizarVistos([null, 3, 'x', { id: 'nada' }, { id: 'MLB7000000001' }])).toEqual([]);   // sem endereço: fora
  });
  it('campo faltando ou de outro tipo: a entrada fica, com o campo limpo', () => {
    const r = vistoDe({ id: 'MLB7862524088', slug: 'farol-MLB7862524088', preco: '244.64', nome: 42, capa: 'javascript:alert(1)', y: [2025, 2010], e: 'x', t: 'ontem' });
    expect(r).toEqual({ id: 'MLB7862524088', slug: 'farol-MLB7862524088', nome: 'Peça', carro: '', anos: '', preco: 244.64, capa: '', cod: '', t: 0 });
  });
  it('o endereço tem de ser o da própria peça (nada de link montado por outro)', () => {
    expect(vistoDe({ id: 'MLB7862524088', slug: 'outra-peca-MLB1234567' })).toBeNull();
    expect(vistoDe({ id: 'MLB7862524088', slug: '../x-MLB7862524088' })).toBeNull();
  });
  it('modelo só com marca; 2+ carros com os anos de cada um', () => {
    expect(vistoDe({ id: 'MLB7862524088', slug: 'a-MLB7862524088', m: 'XC60' })!.m).toBeUndefined();
    const r = vistoDe({ id: 'MLB7862524088', slug: 'a-MLB7862524088', b: 'Volvo', m: 'S60', ms: ['S60', 'XC60'], ys: [[2018, 2024], null] })!;
    expect(r.ms).toEqual(['S60', 'XC60']);
    expect(r.ys).toEqual([[2018, 2024], null]);
  });
  it('sem repetir a peça e no máximo 12 (as primeiras = as mais recentes)', () => {
    const r = normalizarVistos([v(1), v(1, { nome: 'outra' }), ...Array.from({ length: 20 }, (_, i) => v(i + 2))]);
    expect(r).toHaveLength(MAX_VISTOS);
    expect(r[0]).toEqual(v(1));
  });
});

describe('vistos: registrar', () => {
  it('a aberta agora vai para o começo; se já estava, sai de onde estava', () => {
    let l: Visto[] = [];
    l = registrar(l, v(1));
    l = registrar(l, v(2));
    l = registrar(l, v(1, { preco: 5 }));
    expect(l.map((x) => x.id)).toEqual([v(1).id, v(2).id]);
    expect(l[0].preco).toBe(5);
  });
  it('nunca passa de 12: a mais antiga sai', () => {
    let l: Visto[] = [];
    for (let i = 0; i < 15; i++) l = registrar(l, v(i));
    expect(l).toHaveLength(MAX_VISTOS);
    expect(l[0].id).toBe(v(14).id);
    expect(l.some((x) => x.id === v(0).id)).toBe(false);
  });
  it('entrada ruim não entra (e não apaga nada)', () => {
    const l = [v(1)];
    expect(registrar(l, { id: 'xx' } as Visto)).toEqual(l);
  });
});

describe('vistos: o estoque de agora (/dados/ativas.json)', () => {
  const ativas = lerAtivas({ id: [7000000001, 7000000003], p: [999.9, 50], e: '20', r: '10' });
  it('peça que vendeu some; preço e capa são os de agora; a da página não entra', () => {
    const l = [v(1), v(2), v(3)];
    const r = paraMostrar(l, ativas);
    expect(r.map((x) => x.id)).toEqual([v(1).id, v(3).id]);
    expect(r[0].preco).toBe(999.9);
    expect(r[0].e).toBe('2');
    expect(r[1].e).toBe('0');
    expect(paraMostrar(l, ativas, v(1).id).map((x) => x.id)).toEqual([v(3).id]);
  });
  it('sem o estoque (rede caiu): as guardadas, como estão', () => {
    expect(paraMostrar([v(1), v(2)], null)).toEqual([v(1), v(2)]);
  });
  it('JSON estragado: estoque vazio (nada é mostrado como à venda por engano)', () => {
    expect(lerAtivas({} as never).size).toBe(0);
  });
});

describe('vistos: o cartão é o MESMO do catálogo', () => {
  it('com marca/modelo/anos: os data-* do "Serve no seu…", a capa leve e o preço', () => {
    const h = cartaoHtml(itemDoVisto(v(1)), '208px');
    expect(h).toContain('href="/peca/farol-1-MLB7000000001.html"');
    expect(h).toContain('data-b="Volvo"');
    expect(h).toContain('data-m="XC60"');
    expect(h).toContain('data-a0="2018"');
    expect(h).toContain('/estudio-400/MLB7000000001.webp 400w');
    expect(h).toContain('1.001');
    expect(h).toContain('Cód. <span class="oem">31446831</span>');
  });
  it('sem marca/modelo: o carro em texto; sem capa: a foto do ML', () => {
    const it = itemDoVisto(v(2, { b: undefined, m: undefined, carro: 'Volvo', e: '0', i: '600000-MLB112454278568_062026', capa: '' }));
    const h = cartaoHtml(it, '208px');
    expect(h).toContain('<span class="etiqueta-modelo">Volvo</span>');
    expect(h).toContain('http2.mlstatic.com/D_600000-MLB112454278568_062026-O.webp');
    expect(h).not.toContain('class="estudio"');
    expect(h).not.toContain('/estudio');
  });
});

describe('contarVistos (antes da 1ª pintura: o lugar do "Você viu" só com 2+)', () => {
  it('conta só as entradas com id e endereço, sem repetir', () => {
    expect(contarVistos(null)).toBe(0);
    expect(contarVistos('lixo')).toBe(0);
    expect(contarVistos('{"a":1}')).toBe(0);
    expect(contarVistos(JSON.stringify([v(1), v(1), { id: 'MLB7000000009' }, v(2)]))).toBe(2);
  });
  it('o mesmo número que a lista limpa dá (quando o slug é bom)', () => {
    const l = Array.from({ length: 15 }, (_, i) => v(i));
    expect(contarVistos(JSON.stringify(l))).toBe(normalizarVistos(l).length);
  });
  it('funciona copiado para dentro do HTML (toString, sem nada de fora)', () => {
    const f = new Function(`return (${contarVistos.toString()})(arguments[0])`);
    expect(f(JSON.stringify([v(1), v(2), v(3)]))).toBe(3);
  });
});
