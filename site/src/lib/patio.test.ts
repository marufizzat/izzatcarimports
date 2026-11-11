// "Não achou? A gente procura no pátio": a mesma mensagem no bloco do catálogo e nas sugestões da busca do cabeçalho.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pedidoPatio, semCarro } from './patio';

const xc60 = { b: 'Volvo', m: 'XC60', y: 2019 };
describe('pedido para procurar no pátio', () => {
  it('o digitado + o carro salvo (com o ano dele)', () => {
    expect(pedidoPatio({ q: 'retrovisor direito', meuCarro: xc60 }).texto)
      .toBe('Procuro retrovisor direito para Volvo XC60 2019. Não achei no site, tem no pátio?');
  });
  it('o carro digitado sai do texto e vale mais que o salvo; o ano digitado vale mais que o salvo', () => {
    const jeep = { b: 'Jeep', m: 'Compass' };
    expect(pedidoPatio({ q: 'farol compass', carroDaBusca: jeep, meuCarro: xc60 }).procuro).toBe('farol para Jeep Compass');
    expect(pedidoPatio({ q: 'farol compass 2018', carroDaBusca: jeep }).procuro).toBe('farol para Jeep Compass 2018');
    expect(pedidoPatio({ q: 'lanterna xc60', carroDaBusca: { b: 'Volvo', m: 'XC60' }, meuCarro: xc60 }).procuro).toBe('lanterna para Volvo XC60 2019');
    expect(pedidoPatio({ q: 'xc60', carroDaBusca: { b: 'Volvo', m: 'XC60' }, meuCarro: xc60 }).procuro).toBe('peça para Volvo XC60 2019');
  });
  it('filtros do catálogo: a marca, o modelo e o ano do filtro', () => {
    expect(pedidoPatio({ q: 'lanterna', marca: 'Volvo', modelo: 'XC60', ano: 2015, meuCarro: xc60 }).procuro).toBe('lanterna para Volvo XC60 2015');
    expect(pedidoPatio({ marca: 'Volvo', tipo: 'Faróis e Lanternas' }).procuro).toBe('peça de faróis e lanternas para Volvo');
  });
  it('código digitado (com espaço) e ano sozinho (nunca "Procuro: 1981")', () => {
    expect(pedidoPatio({ q: '8200 328 856' }).procuro).toBe('a peça com o código 8200328856');
    expect(pedidoPatio({ q: 'a044297' }).procuro).toBe('a peça com o código A044297');
    expect(pedidoPatio({ q: '1981' }).procuro).toBe('peça para carro ano 1981');
  });
  it('semCarro tira o modelo e a marca escritos de qualquer jeito', () => {
    expect(semCarro('farol xc 60 volvo', { b: 'Volvo', m: 'XC60' })).toBe('farol');
    expect(semCarro('farol', null)).toBe('farol');
  });
  it('o catálogo ainda escreve o mesmo texto (quem mudar um, muda os dois: Catalogo.tsx deve passar a usar pedidoPatio)', () => {
    const cat = readFileSync('src/components/catalogo/Catalogo.tsx', 'utf-8');
    expect(cat).toContain('whatsUrl(`Procuro ${procuro}. Não achei no site, tem no pátio?`)');
  });
});
