import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { palavraViva, contarBlocos, escolherAtalhos, linkAtalho, lugaresEstreitos, PECAS_PALCO, ATALHOS_MAX, type IndiceCarro } from './abertura';
import { Busca, type Indice } from './busca';
import { serveNoModelo } from './meuCarro';

const buscaArq = 'public/dados/busca.json';
const resumoArq = 'src/data/resumo.json';
const pecasArq = 'src/data/abertura-pecas.json';

describe('palavraViva: a palavra do título e a largura da 2ª linha', () => {
  it('sem carro, só a marca, modelo, modelo + ano', () => {
    expect(palavraViva()).toEqual({ t: 'carro', l: 5.77 });
    expect(palavraViva(null, null, 'Chevrolet').t).toBe('Chevrolet');
    expect(palavraViva('Onix', null, 'Chevrolet').t).toBe('Onix');
    expect(palavraViva('Onix', 2019, 'Chevrolet')).toEqual({ t: 'Onix 2019', l: 7.64 });
  });
  it('nome longo: o ano sai (ele continua no cartão) e a linha fica mais larga, nunca passa de 9,6 com o ano', () => {
    expect(palavraViva('Palio Weekend', 2012).t).toBe('Palio Weekend');
    expect(palavraViva('Range Rover Evoque', 2015).t).toBe('Range Rover Evoque');
    expect(palavraViva('Tracker', 2020).t).toBe('Tracker 2020');
    expect(palavraViva('Compass', 2019).l).toBeLessThanOrEqual(9.6);
    expect(palavraViva('Palio Weekend', 2012).l).toBeGreaterThan(9);
  });
  it('lixo no armazenamento não quebra o título', () => {
    expect(palavraViva(undefined, NaN as unknown as number, 42 as unknown as string).t).toBe('carro');
    expect(palavraViva('  XC60  ', 99999).t).toBe('XC60');
    expect(palavraViva('x'.repeat(200)).t.length).toBe(28);
  });
  it('é sozinha (vai para dentro do HTML por toString)', () => {
    const copia = new Function(`return (${palavraViva.toString()})`)() as typeof palavraViva;
    expect(copia('Onix', 2019, 'Chevrolet')).toEqual({ t: 'Onix 2019', l: 7.64 });
  });
});

describe('atalhos do carro', () => {
  const d: IndiceCarro = {
    familias: ['Freios', 'Motor', 'Faróis e Lanternas', 'Escapamento'],
    c: [0, 0, 1, 2, 3, 3, 3, 2],
    m: ['Onix', 'Onix', 'Onix', 'Onix', 'Onix', 'Onix', 'Onix', 'Prisma'],
    y: [[2013, 2019], [2020, 2024], 0, [2017, 2019], 0, 0, 0, [2013, 2019]],
    ms: { 7: ['Prisma', 'Onix'] },
    ys: { 7: [[2013, 2019], [2013, 2016]] },
  };
  it('conta por bloco; a peça de 2 carros conta no Onix com a faixa do Onix', () => {
    const todos = contarBlocos(d, 'Onix', null);
    expect(todos.total).toBe(8);
    expect(Object.fromEntries(todos.por)).toEqual({ Freios: 2, Motor: 1, 'Faróis e Lanternas': 2, Escapamento: 3 });
    const de2019 = contarBlocos(d, 'Onix', 2019);
    expect(Object.fromEntries(de2019.por)).toEqual({ Freios: 1, 'Faróis e Lanternas': 1 });
    expect(contarBlocos(d, 'Onix', 2015).por.get('Faróis e Lanternas')).toBe(1); // a do Prisma/Onix (2013 a 2016 no Onix)
  });
  it('só bloco com peça e com camada no palco, o de mais peças primeiro', () => {
    const a = escolherAtalhos(contarBlocos(d, 'Onix', null).por);
    expect(a.map((x) => [x.k, x.n])).toEqual([['farol', 2], ['pinca', 2], ['motor', 1]]);
    expect(escolherAtalhos(new Map())).toEqual([]);
    expect(escolherAtalhos(new Map(PECAS_PALCO.map((p) => [p.bloco, 3]))).length).toBe(ATALHOS_MAX);
  });
  it('celular: os lugares cabem no palco e nenhum fica em cima do outro', () => {
    for (let n = 0; n <= ATALHOS_MAX; n++) {
      const l = lugaresEstreitos(n);
      expect(l.length).toBe(n);
      for (const [x, y] of l) { expect(x).toBeGreaterThanOrEqual(14); expect(x).toBeLessThanOrEqual(86); expect(y).toBeLessThan(40); }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(Math.abs(l[i][0] - l[j][0]) >= 30 || Math.abs(l[i][1] - l[j][1]) >= 15).toBe(true);
    }
  });
  it('o link é o do catálogo com tipo, marca, modelo e ano', () => {
    expect(linkAtalho('Faróis e Lanternas', { b: 'Chevrolet', m: 'Onix', y: 2019 })).toBe('/catalogo.html?tipo=Far%C3%B3is+e+Lanternas&marca=Chevrolet&modelo=Onix&ano=2019');
    expect(linkAtalho('Freios', { b: 'Volvo', m: 'XC60', y: null })).toBe('/catalogo.html?tipo=Freios&marca=Volvo&modelo=XC60');
  });
});

describe.skipIf(!existsSync(resumoArq))('as peças do palco existem no site', () => {
  const r = JSON.parse(readFileSync(resumoArq, 'utf-8')) as { familias: { n: string; k: string }[] };
  it('cada bloco do palco é um bloco do estoque (nome exato)', () => {
    const nomes = new Set(r.familias.map((f) => f.n));
    expect(PECAS_PALCO.filter((p) => !nomes.has(p.bloco)).map((p) => p.bloco)).toEqual([]);
    expect(new Set(PECAS_PALCO.map((p) => p.bloco)).size).toBe(PECAS_PALCO.length);
  });
  it.skipIf(!existsSync(pecasArq))('cada peça tem a camada recortada com as medidas (o palco reserva o lugar)', () => {
    const m = JSON.parse(readFileSync(pecasArq, 'utf-8')) as Record<string, { w: number; h: number; v: number[] }>;
    for (const p of PECAS_PALCO) {
      expect(m[p.k], p.k).toBeTruthy();
      for (const w of m[p.k].v) expect(existsSync(`public/arte/v2/abertura/${p.k}-${w}.webp`), `${p.k}-${w}`).toBe(true);
    }
  });
});

describe.skipIf(!existsSync(buscaArq))('contarBlocos com o estoque de agora', () => {
  const ix = JSON.parse(readFileSync(buscaArq, 'utf-8')) as Indice;
  const toda = new Busca(ix);
  // o /dados/carro/<k>.json (pages/dados/carro/[k].json.ts): as colunas só das peças do carro
  const doCarro = (b: string, m: string): IndiceCarro => {
    const ks = ix.id.map((_, k) => k).filter((k) => ix.marcas[ix.b[k]] === b && serveNoModelo({ m: ix.m[k], ms: ix.ms?.[k] }, m));
    const novo = new Map(ks.map((k, i) => [String(k), String(i)]));
    const mapa = <T,>(o?: Record<string, T>) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => novo.has(k)).map(([k, v]) => [novo.get(k)!, v]));
    return { familias: ix.familias, c: ks.map((k) => ix.c[k]), m: ks.map((k) => ix.m[k]), y: ks.map((k) => ix.y[k]), ms: mapa(ix.ms), ys: mapa(ix.ys) } as IndiceCarro;
  };
  const carros: [string, string][] = [];
  for (let k = 0; k < ix.id.length && carros.length < 400; k++) {
    const b = ix.marcas[ix.b[k]], m = ix.m[k];
    if (b && m && !carros.some((c) => c[0] === b && c[1] === m)) carros.push([b, m]);
  }
  it('o número de cada atalho é o do catálogo (tipo + marca + modelo, com e sem ano)', () => {
    const ruins: string[] = [];
    let conferidos = 0;
    for (const [b, m] of carros) {
      const d = doCarro(b, m);
      const anos = [...new Set(d.y.flatMap((y) => (y ? [y[0], y[1]] : [])))].slice(0, 3);
      for (const ano of [null, ...anos]) {
        const { total, por } = contarBlocos(d, m, ano);
        if (total !== toda.procurar({ marca: b, modelo: m, ano: ano ?? undefined }).length) ruins.push(`${b} ${m} ${ano ?? ''}: total ${total}`);
        for (const a of escolherAtalhos(por)) {
          const n = toda.procurar({ marca: b, modelo: m, ano: ano ?? undefined, tipo: a.bloco }).length;
          conferidos++;
          if (n !== a.n) ruins.push(`${b} ${m} ${ano ?? ''} ${a.bloco}: ${a.n} != ${n}`);
        }
      }
    }
    expect(ruins.slice(0, 12)).toEqual([]);
    expect(conferidos).toBeGreaterThan(200);
  });
  it('a maioria dos carros tem pelo menos 3 atalhos', () => {
    const n = carros.map(([b, m]) => escolherAtalhos(contarBlocos(doCarro(b, m), m, null).por).length);
    const com3 = n.filter((x) => x >= 3).length;
    expect(com3 / n.length).toBeGreaterThan(0.6);
  });
});
