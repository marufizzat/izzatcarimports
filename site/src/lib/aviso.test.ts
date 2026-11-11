import { describe, expect, it } from 'vitest';
import { linkAviso, mensagemAviso, mensagemAvisoParte, linkAvisoParte, mensagemProcuraParte, linkProcuraParte } from './aviso';

describe('aviso: "Avise-me quando chegar peça"', () => {
  it('sem ano: só o carro', () => {
    expect(mensagemAviso('Volvo XC60')).toBe('Olá! Vim pelo site da Izzat Car. Tenho um Volvo XC60. Quero ser avisado quando chegar peça dele no pátio.');
    expect(mensagemAviso('Volvo XC60', null)).toBe(mensagemAviso('Volvo XC60'));
    expect(mensagemAviso('Volvo XC60', '  ')).toBe(mensagemAviso('Volvo XC60'));
  });
  it('com ano: o ano logo depois do carro', () => {
    expect(mensagemAviso('Volvo XC60', 2019)).toBe('Olá! Vim pelo site da Izzat Car. Tenho um Volvo XC60 2019. Quero ser avisado quando chegar peça dele no pátio.');
    expect(mensagemAviso(' Volkswagen Gol ', '2015/2018')).toContain('Tenho um Volkswagen Gol 2015/2018.');
  });
  it('não promete prazo', () => {
    expect(mensagemAviso('Fiat Palio', 2010)).not.toMatch(/\b(dias?|horas?|semanas?|prazo|garant)/i);
  });
  it('link do WhatsApp com a mensagem codificada', () => {
    const u = linkAviso('5553991170950', 'Jeep Compass', 2020);
    expect(u.startsWith('https://wa.me/5553991170950?text=')).toBe(true);
    expect(decodeURIComponent(u.split('text=')[1])).toBe(mensagemAviso('Jeep Compass', 2020));
  });
});

describe('Raio-x do carro: aviso e "a gente procura" de uma parte do carro', () => {
  it('aviso com a parte, o carro e o ano (sem prazo)', () => {
    expect(mensagemAvisoParte('Volvo XC60', 2019, 'do teto')).toBe('Olá! Vim pelo site da Izzat Car. Tenho um Volvo XC60 2019. Quero ser avisado quando chegar peça do teto dele no pátio.');
    expect(mensagemAvisoParte('Volvo XC60', null, 'da frente')).toContain('Tenho um Volvo XC60. Quero ser avisado quando chegar peça da frente dele');
    expect(mensagemAvisoParte('Fiat Palio', 2010, 'do motor')).not.toMatch(/\b(dias?|horas?|semanas?|prazo|garant)/i);
    expect(decodeURIComponent(linkAvisoParte('Jeep Compass', 2020, 'do motor').split('text=')[1])).toBe(mensagemAvisoParte('Jeep Compass', 2020, 'do motor'));
  });
  it('"Não achou?": o carro salvo, o da página ou o convite para dizer o carro', () => {
    expect(mensagemProcuraParte('Volvo XC60 2019', 'da frente')).toBe('Olá! Vim pelo site da Izzat Car. Procuro uma peça da frente do meu Volvo XC60 2019: ____');
    expect(mensagemProcuraParte('', 'do motor')).toBe('Olá! Vim pelo site da Izzat Car. Procuro uma peça do motor do meu carro. Meu carro é ____ (modelo e ano) e a peça é: ____');
    expect(mensagemProcuraParte('Volvo XC60', 'da traseira', false)).toBe('Olá! Vim pelo site da Izzat Car. Procuro uma peça da traseira para Volvo XC60 ano ____: ____');
    expect(linkProcuraParte('Volvo XC60', 'do teto').startsWith('https://wa.me/')).toBe(true);
  });
});
