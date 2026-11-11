// "Não achou? A gente procura no pátio": a mesma mensagem no bloco do catálogo e nas sugestões da busca do cabeçalho.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pedidoPatio, semCarro, mensagemPatioVendida } from './patio';
import { ABERTURA } from './whats';

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

describe('peça vendida que chegou pela lista (sem nome): a mensagem do pátio', () => {
  it('leva o número do anúncio e pergunta se tem no pátio (sem virar pedido de quem se oferece para procurar)', () => {
    expect(mensagemPatioVendida('MLB4779038537')).toBe(`${ABERTURA} Quero uma peça parecida com a do anúncio MLB4779038537, `
      + 'da minha lista de orçamento, que já vendeu. Tem no pátio?');
  });
});

// Revisão 14, item 21: com 1 a 3 resultados (ou o código digitado achando a peça exata) a mensagem não pode dizer
// "Não achei no site". A variante é chamada pelo catálogo quando a lista tem peça.
import { pedidoPatioAchou } from './patio';
describe('pedido ao pátio quando a busca ACHOU peça (pedidoPatioAchou)', () => {
  it('o código digitado é o de uma peça da lista: achou e quer confirmar / outra unidade', () => {
    expect(pedidoPatioAchou({ q: '31476671', meuCarro: xc60, achadas: 1, exata: true }).texto)
      .toBe('Procuro a peça com o código 31476671 para Volvo XC60 2019. Achei no site e quero confirmar se é a certa. Tem outra no pátio?');
    expect(pedidoPatioAchou({ q: '31476671', achadas: 1, exata: true }).texto)
      .toBe('Procuro a peça com o código 31476671. Achei no site e quero confirmar se é a certa. Tem outra no pátio?');
  });
  it('1 a 3 resultados pelo nome: diz quantas achou', () => {
    expect(pedidoPatioAchou({ q: 'retrovisor direito', meuCarro: xc60, achadas: 2 }).texto)
      .toBe('Procuro retrovisor direito para Volvo XC60 2019. Achei só 2 no site. Tem outra no pátio?');
    expect(pedidoPatioAchou({ q: 'bomba dagua', achadas: 1 }).texto).toBe('Procuro bomba dagua. Achei só 1 no site. Tem outra no pátio?');
  });
  it('nunca "Não achei no site" com peça na tela; sem peça, o pedido de sempre (os outros campos são os mesmos)', () => {
    for (const achadas of [1, 2, 3]) expect(pedidoPatioAchou({ q: 'farol', achadas }).texto).not.toContain('Não achei');
    expect(pedidoPatioAchou({ q: 'farol', achadas: 0 })).toEqual(pedidoPatio({ q: 'farol' }));
    const a = pedidoPatioAchou({ q: 'farol compass 2018', carroDaBusca: { b: 'Jeep', m: 'Compass' }, achadas: 3 });
    const b = pedidoPatio({ q: 'farol compass 2018', carroDaBusca: { b: 'Jeep', m: 'Compass' } });
    expect({ ...a, texto: '' }).toEqual({ ...b, texto: '' });
  });
});
