import { describe, it, expect } from 'vitest';
import { mensagemConserto, ABERTURA, precoWhats, LIMITE_MSG_CONSERTO } from './whats';

const it1 = (i: number, preco = 244.64) => ({ nome: `Peça ${i}`, id: `MLB${100000 + i}`, cod: `COD${i}`, preco });
const dec = (s: string) => decodeURIComponent(s);

describe('mensagem do orçamento de conserto (Raio-x: Bati o carro)', () => {
  it('começa pela abertura (uma vez) e tem o título do ponto e o carro', () => {
    const m = mensagemConserto({ ponto: 'na frente esquerda', meuCarro: 'Volvo XC60 2019', itens: [it1(1)] });
    expect(m.startsWith(ABERTURA)).toBe(true);
    expect(m.split(ABERTURA).length).toBe(2);
    expect(m).toContain('*ORÇAMENTO DE CONSERTO — batida na frente esquerda*');
    expect(m).toContain('Meu carro: Volvo XC60 2019');
  });
  it('sem carro salvo: o convite do modelo e do ano', () => {
    const m = mensagemConserto({ ponto: 'na frente', itens: [it1(1)] });
    expect(m).toContain('Meu carro: ____ (modelo), ano ____');
  });
  it('cada peça com o código, o anúncio e os dois preços (o WhatsApp com 10% de desconto, de precoWhats)', () => {
    const m = mensagemConserto({ ponto: 'na frente esquerda', itens: [it1(1, 244.64)] });
    expect(precoWhats(244.64)).toBe(220.18);
    expect(m).toContain('1. *Peça 1* — Código: COD1 — Anúncio: MLB100001');
    expect(m).toContain('R$ 244,64 (no WhatsApp R$ 220,18)');
  });
  it('totais: o site e o WhatsApp são a SOMA das linhas, ao centavo', () => {
    const itens = [it1(1, 685.55), it1(2, 10.01), it1(3, 99.99)];
    const m = mensagemConserto({ ponto: 'na traseira', itens });
    const soma = (685.55 - 0) + 10.01 + 99.99;
    expect(m).toContain(`Total no site: R$ ${soma.toFixed(2).replace('.', ',')}`);
    const whats = precoWhats(685.55) + precoWhats(10.01) + precoWhats(99.99);
    expect(m).toContain(`*Total no WhatsApp (10% de desconto): R$ ${whats.toFixed(2).replace('.', ',')}*`);
  });
  it('o pátio entra como lista, sem preço e sem entrar no total', () => {
    const m = mensagemConserto({ ponto: 'na frente', itens: [it1(1)], patio: ['Capô', 'Suporte do para-choque (alma)'] });
    expect(m).toContain('Para procurar no pátio: Capô; Suporte do para-choque (alma)');
    expect(m).toContain('Total no site: R$ 244,64');
  });
  it('só pátio (nenhuma peça no estoque): sem total e sem "servem"', () => {
    const m = mensagemConserto({ ponto: 'na frente', itens: [], patio: ['Capô'] });
    expect(m).toContain('Para procurar no pátio: Capô');
    expect(m).not.toContain('Total no');
  });
  it('lista do maior kit (12 peças com nomes longos) cabe no limite e os totais são de todas', () => {
    const longo = (i: number) => ({ ...it1(i, 1234.5), nome: `Suporte da carroceria lado do motorista número ${i} e outras palavras`, cod: `ABCDEFGHIJ${i}KLMNOP` });
    const itens = Array.from({ length: 30 }, (_, i) => longo(i + 1));
    const m = mensagemConserto({ ponto: 'na lateral esquerda', meuCarro: 'Volvo XC60 2019', itens });
    expect(m.length).toBeLessThanOrEqual(LIMITE_MSG_CONSERTO);
    const soma = itens.reduce((s, x) => s + x.preco, 0);
    expect(m).toContain(`Total no site: R$ ${soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    expect(m).toContain('e mais');
  });
  it('o link do WhatsApp decodifica para a mesma mensagem (acentos, travessão e quebras de linha)', () => {
    const m = mensagemConserto({ ponto: 'na frente esquerda', meuCarro: 'Volvo XC60 2019', itens: [it1(1)], patio: ['Capô'] });
    expect(dec(encodeURIComponent(m))).toBe(m);
    expect(m).toContain('—');
  });
});
