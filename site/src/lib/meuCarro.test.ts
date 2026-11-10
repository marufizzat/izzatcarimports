// Regras do "Meu carro":
// - B1 da auditoria 2: só dizemos "serve" com o ano salvo e dentro da faixa da peça (sem ano: 'falta-ano', neutro);
// - L5 da auditoria 2: a peça que serve em 2+ carros (ms, ys) vale para cada um deles, com a faixa daquele carro.
import { describe, expect, it } from 'vitest';
import {
  serveNoMeuCarro, estoqueDoCarro, linkCatalogo, nomeCarro, modelosDa, serveNoModelo, anosNoModelo, nomeModelos,
  atributosModelos, lerModelos, carroDe, lerMeuCarro, lembrarArte, salvarMeuCarro, CHAVE, type MeuCarro, type GaragemMin,
} from './meuCarro';

const lanterna = { b: 'Volvo', m: 'XC60', y: [2018, 2024] as [number, number] }; // 2ª geração
const semAno = { b: 'Volvo', m: 'XC60', y: null };
const xc60 = (y: number | null): MeuCarro => ({ b: 'Volvo', m: 'XC60', y });

describe('serveNoMeuCarro: "serve" só com o ano', () => {
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
    // "XC 60" = "XC60"; sem o ano salvo, a regra B1 vale também aqui: falta o ano, nunca "serve"
    expect(serveNoMeuCarro(s60xc60, { b: 'Volvo', m: 'xc 60', y: null })).toBe('falta-ano');
  });
  it('usa a faixa de anos daquele carro (ys)', () => {
    expect(serveNoMeuCarro(fitWrv, { b: 'Honda', m: 'Fit', y: 2016 })).toBe('sim');
    expect(serveNoMeuCarro(fitWrv, { b: 'Honda', m: 'WR-V', y: 2016 })).toBe('confira-ano');
    expect(serveNoMeuCarro(fitWrv, { b: 'Honda', m: 'WR-V', y: 2018 })).toBe('sim');
    expect(serveNoMeuCarro(fitWrv, { b: 'Honda', m: 'WR-V', y: null })).toBe('falta-ano');
    expect(anosNoModelo(fitWrv, 'WR-V')).toEqual([2017, 2021]);
    expect(anosNoModelo(fitWrv, 'Fit')).toEqual([2015, 2021]);
    expect(anosNoModelo(s60xc60, 'XC60')).toEqual([2018, 2024]);    // sem ys: a faixa da peça
  });
  it('carro de 2+ cuja faixa daquele carro não veio: falta o ano', () => {
    const semFaixa = { b: 'Fiat', m: 'Palio', y: [2004, 2012] as [number, number], ms: ['Palio', 'Siena'], ys: [[2004, 2012], null] as ([number, number] | null)[] };
    expect(serveNoMeuCarro(semFaixa, { b: 'Fiat', m: 'Siena', y: 2008 })).toBe('falta-ano');
    expect(serveNoMeuCarro(semFaixa, { b: 'Fiat', m: 'Palio', y: 2008 })).toBe('sim');
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

describe('estoqueDoCarro (B2: ano salvo sem estoque não zera nada)', () => {
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

// auditoria 4, 2.2: a arte do carro (a/as) vai junto do carro salvo, opcional; valor antigo continua valendo
describe('carro salvo com a arte', () => {
  const mem = new Map<string, string>();
  const g = globalThis as any;
  g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  g.window = g.window ?? { dispatchEvent: () => true };
  g.CustomEvent = g.CustomEvent ?? class { constructor(public type: string, public init?: unknown) {} };

  it('valor antigo, sem a/as: lido como antes', () => {
    mem.set(CHAVE, JSON.stringify({ b: 'Volvo', m: 'XC60', y: 2019 }));
    expect(lerMeuCarro()).toEqual({ b: 'Volvo', m: 'XC60', y: 2019 });
  });
  it('a/as válidos ficam; inválidos saem (nunca vira caminho estranho)', () => {
    expect(carroDe({ b: 'Volvo', m: 'XC60', y: null, a: 'volvo-xc60', as: [600, 900, 1200] }))
      .toEqual({ b: 'Volvo', m: 'XC60', y: null, a: 'volvo-xc60', as: [600, 900, 1200] });
    expect(carroDe({ b: 'Volvo', m: 'XC60', y: null, a: '../x"><img', as: [600] })).toEqual({ b: 'Volvo', m: 'XC60', y: null });
    expect(carroDe({ b: 'Volvo', m: 'XC60', y: null, a: 'volvo-xc60', as: ['600'] })).toEqual({ b: 'Volvo', m: 'XC60', y: null, a: 'volvo-xc60' });
    expect(carroDe({ b: 1, m: 'XC60' })).toBeNull();
  });
  it('lembrarArte completa o carro salvo sem mudar o resto; outro carro: não mexe', () => {
    mem.set(CHAVE, JSON.stringify({ b: 'Volvo', m: 'XC60', y: 2019 }));
    lembrarArte('Volvo', 'XC60', 'volvo-xc60', [600, 900, 1200]);
    expect(lerMeuCarro()).toEqual({ b: 'Volvo', m: 'XC60', y: 2019, a: 'volvo-xc60', as: [600, 900, 1200] });
    lembrarArte('Fiat', 'Toro', 'fiat-toro', [600]);
    expect(lerMeuCarro()?.a).toBe('volvo-xc60');
    // a arte saiu do site: a chave sai também
    lembrarArte('Volvo', 'XC60', undefined, undefined);
    expect(lerMeuCarro()).toEqual({ b: 'Volvo', m: 'XC60', y: 2019 });
  });
  it('a faixa da peça salva o ano sem perder a arte ({...c, y})', () => {
    mem.set(CHAVE, JSON.stringify({ b: 'Volvo', m: 'XC60', y: null, a: 'volvo-xc60', as: [600, 1200] }));
    const c = lerMeuCarro()!;
    salvarMeuCarro({ ...c, y: 2020 });
    expect(JSON.parse(mem.get(CHAVE)!)).toEqual({ b: 'Volvo', m: 'XC60', y: 2020, a: 'volvo-xc60', as: [600, 1200] });
  });
});
