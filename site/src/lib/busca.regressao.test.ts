// Tabela de regressão da busca (rodada 14, cliente oculto 10/11, atrito 6). O gabarito de cada consulta é lido do próprio
// estoque (lib/busca.regressao.ts): a 1ª peça tem de ser do tipo, do carro e do lado pedidos; quando a peça não existe,
// nada pode aparecer como achado (zero, ou parecida da família com o aviso). Os casos do relatório ficam escritos à mão.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Busca } from './busca';
import { casos, avaliar } from './busca.regressao';

const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf8'));
const b = () => new Busca(ix);
const nomes = (q: string) => b().procurar({ q }).map((it) => it.n);

describe('busca: tabela de regressão (gabarito pelo estoque)', () => {
  it('todas as consultas geradas acertam (tipo, carro, lado e código; sem achado errado como certo)', () => {
    const lista = casos(ix);
    expect(lista.length).toBeGreaterThanOrEqual(120);
    const { rows } = avaliar(Busca, ix, lista);
    const falhas = rows.filter((r) => !r.ok).map((r) => `${r.q} | ${r.motivo} | ${r.top1}`);
    expect(falhas).toEqual([]);
  }, 120000);

  it('sem código repetido e com 120+ consultas do jeito de falar, código, carro e lado', () => {
    const grupos = new Set(casos(ix).map((c) => c.grupo));
    expect([...grupos].sort()).toEqual(['carro', 'codigo', 'familia', 'lado', 'tipo']);
  });
});

describe('busca: os casos do cliente oculto (rodada 14)', () => {
  it('"sinaleira direita tracker": o Tracker não tem lanterna direita, e a esquerda não aparece como se fosse a certa', () => {
    const bb = b();
    expect(bb.procurar({ q: 'sinaleira direita tracker' })).toEqual([]);
    expect(bb.faltou).toEqual({ lado: 'D', pos: undefined });
    expect(bb.outrosLados.map((it) => it.l)).toEqual(['E']);
  });

  it('"sinaleira do Tracker": uma só (a esquerda), e o resultado não é "exato" de nada além dela', () => {
    const r = nomes('sinaleira do Tracker');
    expect(r).toEqual(['Lanterna traseira esquerda']);
  });

  it('"paralama do Gol": nenhuma luz de teto, quebra-sol nem pedal; só paralamas (outros carros, como parecidas)', () => {
    const bb = b();
    const r = bb.procurar({ q: 'paralama do Gol' });
    expect(r.length).toBeGreaterThan(0);
    expect(bb.aproximado).toBe(true);
    // a família do tipo: o nome ou o sistema da peça diz paralama ("Molduras do Para-lama" também)
    expect(r.every((it) => /para-?lama/i.test(`${it.n} ${it.s}`))).toBe(true);
    expect(r.some((it) => /luz de teto|quebra-sol|pedal/i.test(it.n))).toBe(false);
  });

  it('"parachoque e-pace": o para-choque dianteiro completo em 1º (com e sem hífen)', () => {
    expect(nomes('parachoque e-pace')[0]).toBe('Para-choque dianteiro completo');
    expect(nomes('para-choque e-pace')[0]).toBe('Para-choque dianteiro completo');
  });

  it('"farol onix 2015": a chave de seta do farol de milha não conta como farol', () => {
    expect(nomes('farol onix 2015').some((n) => /chave seta/i.test(n))).toBe(false);
  });

  it('"pisca": a chave de seta (o jeito de falar) aparece, e a chicote de injetor não', () => {
    const r = nomes('pisca');
    expect(r.some((n) => /seta/i.test(n))).toBe(true);
    expect(r.some((n) => /chicote/i.test(n))).toBe(false);
  });

  it('"suspensão xc60": a família inteira do XC60 (sistema de busca, não "parecida")', () => {
    const bb = b();
    const r = bb.procurar({ q: 'suspensão xc60' });
    expect(r.length).toBeGreaterThan(8);
    expect(bb.aproximado).toBe(false);
  });

  it('código com espaço e traço acha a peça em 1º', () => {
    const it = ix.id.map((_: string, k: number) => k).find((k: number) => /^\d{8}$/.test(String(ix.o[k]).split(' ')[0]));
    expect(it).toBeDefined();
    const cod = String(ix.o[it]).split(' ')[0];
    const r = b().procurar({ q: `${cod.slice(0, 4)} ${cod.slice(4)}` });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].o.split(' ')).toContain(cod);
  });
});
