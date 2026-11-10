import { describe, it, expect } from 'vitest';
import { faixaAntes, buscaDe, buscaDoEndereco, VALIDADE_BUSCA } from './continuar';
import { normalizar, totalWhats } from './lista';
import { DESCONTO_WHATS } from './whats';

const agora = 1762800000000;
const item = (i: number, preco: number) => ({ id: `MLB${7000000000 + i}`, slug: `p-${i}-MLB${7000000000 + i}`, nome: `Peça ${i}`, carro: '', anos: '', cod: '', preco, capa: '' });
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const busca = (q: string, t = agora - 3600e3, u = `/catalogo.html?q=${encodeURIComponent(q)}`) => JSON.stringify({ q, u, t });

describe('faixaAntes: a lista vem antes da busca', () => {
  it('lista com peças: o número e o total no WhatsApp (a soma das linhas com 10%, como /lista.html)', () => {
    const l = [item(1, 244.64), item(2, 685.55), item(3, 0.1), item(3, 99)];   // a repetida não conta
    const f = faixaAntes(JSON.stringify(l), busca('farol xc60'), null, agora, DESCONTO_WHATS)!;
    expect(f.tipo).toBe('lista');
    expect(f).toMatchObject({ n: 3, href: '/lista.html', total: brl(totalWhats(normalizar(l))) });
  });
  it('o total bate com totalWhats em centavos para muitas listas ao acaso', () => {
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 300; k++) {
      const l = Array.from({ length: 1 + Math.floor(r() * 30) }, (_, i) => item(i, Math.round(r() * 900000) / 100 + 0.01));
      const f = faixaAntes(JSON.stringify(l), null, null, agora, DESCONTO_WHATS);
      expect(f && f.tipo === 'lista' && f.total).toBe(brl(totalWhats(normalizar(l))));
    }
  });
  it('sem lista: a última busca (até 14 dias, só o endereço do catálogo)', () => {
    expect(faixaAntes('[]', busca('farol xc60'), null, agora, 10)).toEqual({ tipo: 'busca', q: 'farol xc60', href: '/catalogo.html?q=farol%20xc60', assinatura: 'b:farol xc60' });
    expect(faixaAntes(null, busca('farol', agora - VALIDADE_BUSCA - 1), null, agora, 10)).toBeNull();
    expect(faixaAntes(null, busca('farol', agora, 'https://outro.site/x'), null, agora, 10)).toBeNull();
    expect(faixaAntes(null, busca('farol', agora, '/catalogo.html?q=a"><script>'), null, agora, 10)).toMatchObject({ tipo: 'busca' });
    expect(faixaAntes(null, busca('x'), null, agora, 10)).toBeNull();
  });
  it('dispensada fica dispensada até mudar (outra peça na lista, outra busca)', () => {
    const l = JSON.stringify([item(1, 100), item(2, 200)]);
    const f = faixaAntes(l, null, null, agora, 10)!;
    expect(faixaAntes(l, null, f.assinatura, agora, 10)).toBeNull();
    expect(faixaAntes(JSON.stringify([item(1, 100), item(2, 200), item(3, 5)]), null, f.assinatura, agora, 10)).not.toBeNull();
    // lista dispensada não traz a busca no lugar (a faixa dispensada some, não vira outra)
    expect(faixaAntes(l, busca('farol'), f.assinatura, agora, 10)).toBeNull();
    expect(faixaAntes(null, busca('farol'), 'b:farol', agora, 10)).toBeNull();
    expect(faixaAntes(null, busca('Farol XC60'), 'b:farol', agora, 10)).not.toBeNull();
  });
  it('nada guardado, ou lixo: nada (e nunca quebra)', () => {
    for (const x of [null, '', 'lixo', '{}', '[1,2]', '[{"id":"x"}]']) expect(faixaAntes(x, x, null, agora, 10)).toBeNull();
  });
  it('funciona copiado para dentro do HTML (toString)', () => {
    const f = new Function(`return (${faixaAntes.toString()})(arguments[0], arguments[1], null, arguments[2], 10)`);
    expect(f(JSON.stringify([item(1, 1000)]), null, agora)).toMatchObject({ tipo: 'lista', n: 1, total: '900,00' });
  });
});

describe('a última busca (gravada pelo catálogo)', () => {
  it('só a busca com texto; o endereço inteiro (com os filtros) para voltar ao mesmo lugar', () => {
    expect(buscaDoEndereco('?q=farol+xc60&ano=2019', agora)).toEqual({ q: 'farol xc60', u: '/catalogo.html?q=farol+xc60&ano=2019', t: agora });
    expect(buscaDoEndereco('?marca=Volvo', agora)).toBeNull();
    expect(buscaDoEndereco('', agora)).toBeNull();
  });
  it('buscaDe confere o que voltou do armazenamento', () => {
    expect(buscaDe({ q: '  farol  ', u: '/catalogo.html?q=farol', t: agora }, agora)).toEqual({ q: 'farol', u: '/catalogo.html?q=farol', t: agora });
    expect(buscaDe({ q: 'farol', u: '/peca/x.html', t: agora }, agora)).toBeNull();
    expect(buscaDe('lixo', agora)).toBeNull();
  });
});
