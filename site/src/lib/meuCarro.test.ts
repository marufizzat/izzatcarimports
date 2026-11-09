import { describe, it, expect } from 'vitest';
import {
  serveNoMeuCarro, modelosDa, serveNoModelo, anosNoModelo, nomeModelos, atributosModelos, lerModelos,
} from './meuCarro';

// Auditoria 2, L5: "Conversor Tensao Bateria Volvo S60 Xc60 T8 18/24" serve nos dois carros.
const s60xc60 = { b: 'Volvo', m: 'S60', y: [2018, 2024] as [number, number], ms: ['S60', 'XC60'] };
// "Difusor Ar Esquerdo Honda Fit Wr-v 15/21": o WR-V só existe a partir de 2017.
const fitWrv = {
  b: 'Honda', m: 'Fit', y: [2015, 2021] as [number, number], ms: ['Fit', 'WR-V'],
  ys: [[2015, 2021], [2017, 2021]] as [number, number][],
};

describe('Meu carro: peça que serve em 2+ carros', () => {
  it('vale para cada carro do ms, nunca para outro', () => {
    expect(serveNoMeuCarro(s60xc60, { b: 'Volvo', m: 'XC60', y: 2019 })).toBe('sim');
    expect(serveNoMeuCarro(s60xc60, { b: 'Volvo', m: 'S60', y: 2019 })).toBe('sim');
    expect(serveNoMeuCarro(s60xc60, { b: 'Volvo', m: 'XC60', y: 2012 })).toBe('confira-ano');
    expect(serveNoMeuCarro(s60xc60, { b: 'Volvo', m: 'XC90', y: 2019 })).toBeNull();
    expect(serveNoMeuCarro(s60xc60, { b: 'Jaguar', m: 'XC60', y: null })).toBeNull();
    expect(serveNoMeuCarro(s60xc60, { b: 'Volvo', m: 'xc 60', y: null })).toBe('sim');   // "XC 60" = "XC60"
  });
  it('usa a faixa de anos daquele carro (ys)', () => {
    expect(serveNoMeuCarro(fitWrv, { b: 'Honda', m: 'Fit', y: 2016 })).toBe('sim');
    expect(serveNoMeuCarro(fitWrv, { b: 'Honda', m: 'WR-V', y: 2016 })).toBe('confira-ano');
    expect(serveNoMeuCarro(fitWrv, { b: 'Honda', m: 'WR-V', y: 2018 })).toBe('sim');
    expect(anosNoModelo(fitWrv, 'WR-V')).toEqual([2017, 2021]);
    expect(anosNoModelo(fitWrv, 'Fit')).toEqual([2015, 2021]);
    expect(anosNoModelo(s60xc60, 'XC60')).toEqual([2018, 2024]);    // sem ys: a faixa da peça
  });
  it('peça de um carro só continua igual', () => {
    const p = { b: 'Volvo', m: 'XC60', y: [2018, 2024] as [number, number] };
    expect(modelosDa(p)).toEqual(['XC60']);
    expect(serveNoModelo(p, 'XC60')).toBe(true);
    expect(serveNoModelo(p, 'S60')).toBe(false);
    expect(serveNoMeuCarro(p, { b: 'Volvo', m: 'XC60', y: 2020 })).toBe('sim');
    expect(modelosDa({ b: 'Mini', m: '' })).toEqual([]);
  });
  it('nome para "Serve em" e atributos do cartão (ida e volta)', () => {
    expect(nomeModelos(s60xc60)).toBe('Volvo S60 e XC60');
    expect(nomeModelos({ b: 'Fiat', m: 'Palio', ms: ['Palio', 'Siena', 'Strada'] })).toBe('Fiat Palio, Siena e Strada');
    expect(nomeModelos({ b: 'Volvo', m: 'XC60' })).toBe('Volvo XC60');
    const a = atributosModelos(fitWrv.ms, fitWrv.ys);
    expect(a).toEqual({ 'data-ms': 'Fit|WR-V', 'data-ys': '2015-2021|2017-2021' });
    expect(lerModelos(a['data-ms'], a['data-ys'])).toEqual({ ms: ['Fit', 'WR-V'], ys: [[2015, 2021], [2017, 2021]] });
    expect(atributosModelos(['XC60'], null)).toEqual({ 'data-ms': undefined, 'data-ys': undefined });
    expect(lerModelos(undefined, undefined)).toEqual({});
  });
});
