import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { chaveCarro, chegouParaOCarro, chegouAntes, linkChegou, NO_TRILHO } from './chegouCarro';
import { Busca, type Indice } from './busca';

const resumoArq = 'src/data/resumo.json';
const buscaArq = 'public/dados/busca.json';

describe('chaveCarro: a mesma chave das páginas /carros/<k>.html', () => {
  it('acento, hífen e espaço como o slugify do Python', () => {
    expect(chaveCarro('Volvo', 'XC60')).toBe('volvo-xc60');
    expect(chaveCarro('Mercedes-Benz', 'C180')).toBe('mercedes-benz-c180');
    expect(chaveCarro('Citroën', 'C4 Cactus')).toBe('citroen-c4-cactus');
    expect(chaveCarro('BMW', 'Série 3')).toBe('bmw-serie-3');
    expect(chaveCarro('Land Rover', 'Range Rover Evoque')).toBe('land-rover-range-rover-evoque');
  });
  it.skipIf(!existsSync(resumoArq))('bate com o k de todo carro do resumo (preparar_dados.py: chave_url)', () => {
    const r = JSON.parse(readFileSync(resumoArq, 'utf-8')) as { carros: { k: string; b: string; m: string }[] };
    const ruins = r.carros.filter((c) => chaveCarro(c.b, c.m) !== c.k).map((c) => `${c.b} ${c.m}: ${chaveCarro(c.b, c.m)} != ${c.k}`);
    expect(ruins).toEqual([]);
  });
});

describe.skipIf(!existsSync(buscaArq))('chegouParaOCarro com o estoque de agora', () => {
  const ix = JSON.parse(readFileSync(buscaArq, 'utf-8')) as Indice;
  const toda = new Busca(ix);
  const procurar = toda.procurar.bind(toda);
  // o carro com mais peças no estoque de agora (hoje, o Volvo XC60): nenhum carro escrito aqui (o estoque muda)
  const conta = new Map<string, number>();
  for (const it of toda.itens) if (it.b && it.m) conta.set(`${it.b}|${it.m}`, (conta.get(`${it.b}|${it.m}`) ?? 0) + 1);
  const [marca, modelo] = [...conta].sort((x, y) => y[1] - x[1])[0][0].split('|');
  const carro = { b: marca, m: modelo };

  it('o "Ver todas as N" é o número do catálogo filtrado (marca, modelo, ano); os cartões, as mais novas', () => {
    const anos = toda.procurar({ marca: carro.b, modelo: carro.m }).map((it) => it.y?.[1]).filter((y): y is number => !!y);
    const y = anos.sort((a, b) => b - a)[0] ?? null;
    const r = chegouParaOCarro(procurar, { ...carro, y });
    expect(r.estado).toBe('ok');
    expect(r.total).toBe(toda.procurar({ marca: carro.b, modelo: carro.m, ano: y ?? undefined }).length);
    expect(r.itens.length).toBe(Math.min(NO_TRILHO, r.total));
    const novos = toda.procurar({ marca: carro.b, modelo: carro.m, ano: y ?? undefined, ordem: 'novos' }).slice(0, NO_TRILHO).map((it) => it.id);
    expect(r.itens.map((it) => it.id)).toEqual(novos);
  });
  it('o arquivo só do carro (/dados/carro/<k>.json) dá a MESMA lista que o índice inteiro', async () => {
    const { GET } = await import('../pages/dados/carro/[k].json');
    const sub = await (GET as unknown as (c: { props: { b: string; m: string } }) => Response)({ props: carro }).json();
    const r1 = chegouParaOCarro(procurar, { ...carro, y: null });
    const r2 = chegouParaOCarro((f) => new Busca(sub).procurar(f), { ...carro, y: null });
    expect(r2.total).toBe(r1.total);
    expect(r2.itens.map((it) => it.id)).toEqual(r1.itens.map((it) => it.id));
  });
  it('ano sem peça: sem-ano (com quantas o modelo tem); modelo sem peça: sem-modelo', () => {
    const r = chegouParaOCarro(procurar, { ...carro, y: 1901 });
    expect(r.estado).toBe('sem-ano');
    expect(r.doModelo).toBeGreaterThan(0);
    expect(chegouParaOCarro(procurar, { b: carro.b, m: 'Modelo Que Não Existe', y: null }).estado).toBe('sem-modelo');
  });
});

describe('chegouAntes (antes da 1ª pintura)', () => {
  const modelos = JSON.stringify({ Volvo: ['XC60', 'S60'], Fiat: ['Uno'] });
  it('sem carro salvo (ou lixo): nada', () => {
    expect(chegouAntes(null, modelos)).toBeNull();
    expect(chegouAntes('lixo', modelos)).toBeNull();
    expect(chegouAntes('{"b":"Volvo"}', modelos)).toBeNull();
  });
  it('carro com peça: o trilho, com o nome e o link do catálogo (o mesmo de linkChegou)', () => {
    const r = chegouAntes('{"b":"Volvo","m":"XC60","y":2019}', modelos)!;
    expect(r).toEqual({ estado: 'trilho', nome: 'Volvo XC60 2019', link: linkChegou({ b: 'Volvo', m: 'XC60', y: 2019 }) });
    expect(chegouAntes('{"b":"Fiat","m":"Uno","y":null}', modelos)!.link).toBe(linkChegou({ b: 'Fiat', m: 'Uno' }));
  });
  it('modelo que saiu do estoque: o convite', () => {
    expect(chegouAntes('{"b":"Volvo","m":"C30","y":2010}', modelos)!.estado).toBe('convite');
    // sem a lista da abertura: o trilho (os dados decidem depois)
    expect(chegouAntes('{"b":"Volvo","m":"C30","y":2010}', null)!.estado).toBe('trilho');
  });
  it('funciona copiado para dentro do HTML (toString)', () => {
    const f = new Function(`return (${chegouAntes.toString()})(arguments[0], arguments[1])`);
    expect(f('{"b":"Volvo","m":"S60","y":2015}', modelos).nome).toBe('Volvo S60 2015');
  });
});
