// Regra do "Meu carro" (B1 da auditoria 2): só dizemos "serve" com o ano salvo e dentro da faixa da peça.
import { describe, expect, it } from 'vitest';
import { serveNoMeuCarro, estoqueDoCarro, linkCatalogo, nomeCarro, type MeuCarro, type GaragemMin } from './meuCarro';

const lanterna = { b: 'Volvo', m: 'XC60', y: [2018, 2024] as [number, number] }; // 2ª geração
const semAno = { b: 'Volvo', m: 'XC60', y: null };
const xc60 = (y: number | null): MeuCarro => ({ b: 'Volvo', m: 'XC60', y });

describe('serveNoMeuCarro', () => {
  it('sem carro salvo: nada', () => {
    expect(serveNoMeuCarro(lanterna, null)).toBeNull();
  });
  it('outra marca ou outro modelo: nada (nunca "não serve")', () => {
    expect(serveNoMeuCarro(lanterna, { b: 'Chevrolet', m: 'Cruze', y: 2014 })).toBeNull();
    expect(serveNoMeuCarro(lanterna, { b: 'Volvo', m: 'S60', y: 2019 })).toBeNull();
  });
  it('peça sem marca ou modelo: nada', () => {
    expect(serveNoMeuCarro({ b: 'Volvo', m: null, y: [2018, 2024] }, xc60(2019))).toBeNull();
    expect(serveNoMeuCarro({ b: null, m: 'XC60', y: [2018, 2024] }, xc60(2019))).toBeNull();
  });
  it('carro SEM ano e peça com faixa: falta o ano (nunca "serve")', () => {
    expect(serveNoMeuCarro(lanterna, xc60(null))).toBe('falta-ano');
  });
  it('carro sem ano e peça sem faixa: falta o ano', () => {
    expect(serveNoMeuCarro(semAno, xc60(null))).toBe('falta-ano');
  });
  it('carro com ano e peça sem faixa: não dá para garantir (falta o ano da peça)', () => {
    expect(serveNoMeuCarro(semAno, xc60(2019))).toBe('falta-ano');
  });
  it('ano dentro da faixa (inclusive as pontas): serve', () => {
    expect(serveNoMeuCarro(lanterna, xc60(2019))).toBe('sim');
    expect(serveNoMeuCarro(lanterna, xc60(2018))).toBe('sim');
    expect(serveNoMeuCarro(lanterna, xc60(2024))).toBe('sim');
  });
  it('ano fora da faixa (outra geração): confira o ano', () => {
    expect(serveNoMeuCarro(lanterna, xc60(2012))).toBe('confira-ano');
    expect(serveNoMeuCarro(lanterna, xc60(2025))).toBe('confira-ano');
  });
  it('marca e modelo valem com caixa, espaço e hífen diferentes', () => {
    expect(serveNoMeuCarro({ b: 'VOLVO', m: 'XC 60', y: [2018, 2024] }, xc60(2020))).toBe('sim');
    expect(serveNoMeuCarro({ b: 'Volvo', m: 'xc-60', y: [2018, 2024] }, xc60(null))).toBe('falta-ano');
  });
});

describe('estoqueDoCarro', () => {
  const g: GaragemMin = { marcas: [{ n: 'Volvo', modelos: [{ n: 'XC60', c: 475, ya: [[2019, 461], [2013, 1]] }, { n: 'S90', c: 0, ya: [] }] }] };
  it('ano com peças: ok, com a contagem do ano', () => {
    expect(estoqueDoCarro(g, xc60(2019))).toEqual({ estado: 'ok', pecas: 461, doModelo: 475 });
  });
  it('sem ano: ok, com a contagem do modelo', () => {
    expect(estoqueDoCarro(g, xc60(null))).toEqual({ estado: 'ok', pecas: 475, doModelo: 475 });
  });
  it('ano salvo sem peça agora: sem-ano (a tela mostra o modelo em todos os anos)', () => {
    expect(estoqueDoCarro(g, xc60(1999))).toEqual({ estado: 'sem-ano', pecas: 0, doModelo: 475 });
  });
  it('modelo ou marca que saiu do estoque: sem-modelo', () => {
    expect(estoqueDoCarro(g, { b: 'Volvo', m: 'Amazon', y: 1970 }).estado).toBe('sem-modelo');
    expect(estoqueDoCarro(g, { b: 'Saab', m: '900', y: null }).estado).toBe('sem-modelo');
    expect(estoqueDoCarro(g, { b: 'Volvo', m: 'S90', y: null }).estado).toBe('sem-modelo');
  });
});

describe('links e nomes', () => {
  it('link do catálogo com e sem ano', () => {
    expect(linkCatalogo(xc60(2019))).toBe('/catalogo.html?marca=Volvo&modelo=XC60&ano=2019');
    expect(linkCatalogo(xc60(null))).toBe('/catalogo.html?marca=Volvo&modelo=XC60');
    expect(linkCatalogo({ b: 'Mercedes-Benz', m: 'Classe C', y: 2007 })).toBe('/catalogo.html?marca=Mercedes-Benz&modelo=Classe+C&ano=2007');
  });
  it('nome do carro', () => {
    expect(nomeCarro(xc60(2019))).toBe('Volvo XC60 2019');
    expect(nomeCarro(xc60(null))).toBe('Volvo XC60');
  });
});
