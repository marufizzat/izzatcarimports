import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PONTOS, itensDaLinha, kitDoPonto, kitsDeTodos, pedidoDe } from './batida';
import { Busca, capaItem, type Indice } from './busca';

const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8')) as Indice;
const b = new Busca(ix);
const procurar = (f: Parameters<Busca['procurar']>[0]) => b.procurar(f);
const foto = (it: Parameters<typeof capaItem>[0]) => capaItem(it, 'A');
const XC60 = { marca: 'Volvo', modelo: 'XC60', ano: 2019 };

describe('o kit da batida no estoque real', () => {
  it('8 pontos, chaves únicas, cada um com linhas e polígonos', () => {
    expect(PONTOS).toHaveLength(8);
    expect(new Set(PONTOS.map((p) => p.k)).size).toBe(8);
    for (const p of PONTOS) {
      expect(p.linhas.length).toBeGreaterThan(5);
      expect(p.poligonos.length).toBeGreaterThan(0);
    }
  });

  it('toda linha com tipo/sub existe no estoque (linha sem tipo = pátio; sem subtipo = o bloco inteiro)', () => {
    const tipos = new Set(ix.familias);
    const subs = new Set(ix.tipos);
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      if (!l.tipo) continue;
      if (!tipos.has(l.tipo) || (l.sub && !subs.has(l.sub))) erros.push(`${p.k}: ${l.nome} (${l.tipo} / ${l.sub})`);
    }
    expect(erros).toEqual([]);
  });

  it('o lado do ponto: nenhuma peça do lado oposto entra (esquerdo nunca o direito, e o contrário)', () => {
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      for (const it of itensDaLinha(p, l, procurar)) {
        if (p.lado && it.l && it.l !== p.lado) erros.push(`${p.k} ${l.nome}: ${it.id} é ${it.l}`);
        if (l.lado && it.l !== l.lado && it.l) erros.push(`${p.k} ${l.nome}: linha ${l.lado}, peça ${it.l}`);
      }
    }
    expect(erros.slice(0, 10)).toEqual([]);
  });

  it('a posição: ponto de frente nunca lista peça de trás, ponto de trás nunca a da frente', () => {
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      for (const it of itensDaLinha(p, l, procurar)) {
        if (p.pos === 'D' && it.pos === 'T') erros.push(`${p.k} ${l.nome}: ${it.id} é traseira`);
        if (p.pos === 'T' && it.pos === 'D') erros.push(`${p.k} ${l.nome}: ${it.id} é dianteira`);
        if (l.pos && it.pos !== l.pos && it.pos !== 'A') erros.push(`${p.k} ${l.nome}: linha ${l.pos}, peça ${it.pos}`);
      }
    }
    expect(erros.slice(0, 10)).toEqual([]);
  });

  it('a frente esquerda pede os faróis e para-lamas ESQUERDOS e nunca os direitos (pelo estoque)', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const farol = p.linhas.find((l) => l.nome === 'Farol esquerdo')!;
    const itens = itensDaLinha(p, farol, procurar);
    expect(itens.every((it) => it.l === 'E')).toBe(true);
  });

  it('o XC60 2019: as contas de cada ponto saem sem erro e a soma por ponto bate com as linhas', () => {
    const kits = kitsDeTodos(procurar, foto, XC60);
    expect(kits).toHaveLength(8);
    for (const k of kits) {
      expect(k.n).toBeLessThanOrEqual(k.linhas.reduce((s, l) => s + l.n, 0));
      for (const l of k.linhas) {
        expect(l.n === 0).toBe(l.rep === null);
        if (l.rep) expect(l.rep.p).toBeGreaterThan(0);
      }
    }
  });

  it('o pedido: só o que está marcado; peça sem estoque vai como pátio, não como item', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const k = kitDoPonto(p, procurar, foto, XC60);
    const marcadas = new Set(k.linhas.map((_, i) => i));
    const { itens, patio } = pedidoDe(k.linhas, marcadas);
    expect(itens.length + patio.length).toBe(k.linhas.filter((l) => true).length);
    expect(patio).toContain('Capô');
    expect(itens.every((x) => x.rep.id.startsWith('MLB'))).toBe(true);
  });
});
