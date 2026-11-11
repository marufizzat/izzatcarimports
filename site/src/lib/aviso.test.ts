import { describe, expect, it } from 'vitest';
import { linkAviso, mensagemAviso } from './aviso';

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
