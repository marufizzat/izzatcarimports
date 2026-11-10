import { describe, it, expect } from 'vitest';
import {
  itemDe, normalizar, adicionar, remover, restaurar, tem, cheia, limpar, juntar, atualizar, total, totalWhats, desconto,
  idsDoLink, linkDaLista, pecasTxt, MAX_LISTA, type ItemLista,
} from './lista';
import { precoWhats } from './whats';

const item = (i: number, o: Partial<ItemLista> = {}): ItemLista => ({
  id: `MLB${7000000000 + i}`, slug: `peca-${i}-mlb${7000000000 + i}`, nome: `Peça ${i}`, carro: 'Chevrolet Cruze', anos: '2017 a 2021',
  cod: `E13146430${i % 10}`, preco: 100 + i, capa: `/estudio-400/MLB${7000000000 + i}.webp`, ...o,
});

describe('lista: o que vem do localStorage (JSON velho ou estragado não quebra nada)', () => {
  it('lixo vira lista vazia', () => {
    for (const x of [null, undefined, 1, 'a', {}, { id: 'MLB1' }, true]) expect(normalizar(x)).toEqual([]);
    expect(normalizar([null, 3, 'x', { id: 'nada' }, { nome: 'sem id' }])).toEqual([]);
  });
  it('campo faltando ou de outro tipo: o item fica, com o campo limpo', () => {
    const r = itemDe({ id: 'MLB7862524088', preco: '244.64', nome: 42, capa: 'javascript:alert(1)', slug: '<b>' });
    expect(r).toEqual({ id: 'MLB7862524088', slug: '', nome: 'Peça', carro: '', anos: '', cod: '', preco: 244.64, capa: '' });
    expect(itemDe({ id: 'MLB7862524088', preco: -3 })!.preco).toBe(0);
    expect(itemDe({ id: 'MLB7862524088', capa: 'https://http2.mlstatic.com/D_123-MLB1_012026-V.webp' })!.capa).toContain('mlstatic');
    expect(itemDe({ id: 'MLB7862524088', capa: 'https://outro.site/x.webp' })!.capa).toBe('');
  });
  it('sem repetir a peça e no máximo 30 (as primeiras ficam)', () => {
    const muitas = Array.from({ length: 40 }, (_, i) => item(i));
    const r = normalizar([item(1), item(1), ...muitas]);
    expect(r).toHaveLength(MAX_LISTA);
    expect(r[0].id).toBe(item(1).id);
    expect(new Set(r.map((x) => x.id)).size).toBe(MAX_LISTA);
  });
});

describe('lista: adicionar, tirar, desfazer', () => {
  it('adiciona no fim, sem repetir', () => {
    let l = adicionar([], item(1));
    l = adicionar(l, item(2));
    l = adicionar(l, item(1));
    expect(l.map((x) => x.id)).toEqual([item(1).id, item(2).id]);
    expect(tem(l, item(2).id)).toBe(true);
    expect(tem(l, item(3).id)).toBe(false);
  });
  it('a 31ª não entra (quem chama avisa que a lista está cheia)', () => {
    const l = Array.from({ length: MAX_LISTA }, (_, i) => item(i));
    expect(cheia(l)).toBe(true);
    expect(adicionar(l, item(99))).toHaveLength(MAX_LISTA);
    expect(tem(adicionar(l, item(99)), item(99).id)).toBe(false);
  });
  it('tirar e desfazer: volta para o mesmo lugar', () => {
    const l = [item(1), item(2), item(3)];
    const sem = remover(l, item(2).id);
    expect(sem.map((x) => x.id)).toEqual([item(1).id, item(3).id]);
    expect(restaurar(sem, item(2), 1)).toEqual(l);
    expect(restaurar(l, item(2), 0)).toEqual(l);            // já está: não duplica
    expect(limpar()).toEqual([]);
  });
  it('não muda a lista recebida (funções puras)', () => {
    const l = [item(1)];
    adicionar(l, item(2)); remover(l, item(1).id); restaurar(l, item(3), 0);
    expect(l).toEqual([item(1)]);
  });
  it('"Guardar esta lista": junta sem apagar a de quem abriu, sem repetir, até 30', () => {
    const minha = [item(1), item(2)];
    const r = juntar(minha, [item(2), item(3), item(4)]);
    expect(r.lista.map((x) => x.id)).toEqual([1, 2, 3, 4].map((i) => item(i).id));
    expect(r).toMatchObject({ novas: 2, fora: 0 });
    const quase = Array.from({ length: MAX_LISTA - 1 }, (_, i) => item(i));
    const c = juntar(quase, [item(100), item(101), item(102)]);
    expect(c.lista).toHaveLength(MAX_LISTA);
    expect(c).toMatchObject({ novas: 1, fora: 2 });
  });
  it('atualizar troca o preço sem mexer na ordem', () => {
    const l = atualizar([item(1), item(2)], item(2).id, { preco: 99.9 });
    expect(l.map((x) => x.preco)).toEqual([101, 99.9]);
  });
});

describe('lista: dinheiro em centavos', () => {
  it('subtotal, total no WhatsApp e o desconto', () => {
    const l = [item(0, { preco: 244.64 }), item(1, { preco: 3785.77 }), item(2, { preco: 0.1 }), item(3, { preco: 0.2 })];
    expect(total(l)).toBe(4030.71);
    expect(totalWhats(l)).toBe(3627.64);
    expect(desconto(l)).toBe(403.07);
  });
  it('total no WhatsApp = soma das linhas (nunca o desconto do subtotal, que erra 1 centavo)', () => {
    const l = [item(0, { preco: 244.65 }), item(1, { preco: 244.65 })];
    expect(precoWhats(244.65)).toBe(220.19);
    expect(totalWhats(l)).toBe(440.38);                     // 220,19 + 220,19: o que a pessoa vê em cada linha
    expect(precoWhats(total(l))).toBe(440.37);              // o outro jeito: 1 centavo a menos, não fecha com as linhas
    expect(total([])).toBe(0);
    expect(totalWhats([])).toBe(0);
  });
});

describe('lista: o link (/lista.html?i=MLB1,MLB2)', () => {
  it('lê só anúncio válido, sem repetir, no máximo 30', () => {
    expect(idsDoLink('?i=MLB123456789,mlb123456789,lixo,,MLB1,MLB987654321')).toEqual(['MLB123456789', 'MLB987654321']);
    expect(idsDoLink('?i=MLB123456789%2CMLB987654321')).toEqual(['MLB123456789', 'MLB987654321']);
    expect(idsDoLink('')).toEqual([]);
    expect(idsDoLink('?x=1')).toEqual([]);
    const muitos = Array.from({ length: 40 }, (_, i) => `MLB${7000000000 + i}`).join(',');
    expect(idsDoLink(`?i=${muitos}`)).toHaveLength(MAX_LISTA);
  });
  it('monta o link de volta', () => {
    expect(linkDaLista(['MLB123456789', 'MLB987654321'])).toBe('/lista.html?i=MLB123456789,MLB987654321');
    expect(linkDaLista([])).toBe('/lista.html');
    expect(idsDoLink(linkDaLista([item(1).id, item(2).id]).split('?')[1])).toEqual([item(1).id, item(2).id]);
  });
  it('1 peça / 3 peças', () => {
    expect(pecasTxt(1)).toBe('1 peça');
    expect(pecasTxt(3)).toBe('3 peças');
  });
});
