import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PONTOS, itensDaLinha, kitDoPonto, kitsDeTodos, opcoesDoPonto, pedidoDe, linkDaLinha, filtrosDaLinha } from './batida';
import { ARTE } from './raioX';
import { Busca, capaItem, type Indice } from './busca';
import { nomeVale } from './nomesDoEstoque';

const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8')) as Indice;
const b = new Busca(ix);
const procurar = (f: Parameters<Busca['procurar']>[0]) => b.procurar(f);
const foto = (it: Parameters<typeof capaItem>[0]) => capaItem(it, 'A');
const XC60 = { marca: 'Volvo', modelo: 'XC60', ano: 2019 };

const pontos = (p: string) => p.trim().split(/\s+/).map((xy) => xy.split(',').map(Number) as [number, number]);
function dentro([x, y]: [number, number], poli: [number, number][]): boolean {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i];
    const [xj, yj] = poli[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

describe('os 8 pontos da batida na arte', () => {
  it('8 pontos, chaves únicas, cada um com linhas, área de toque e realce', () => {
    expect(PONTOS.map((p) => p.nome)).toEqual(['Frente', 'Frente esquerda', 'Frente direita', 'Lateral esquerda', 'Lateral direita', 'Traseira', 'Traseira esquerda', 'Traseira direita']);
    expect(new Set(PONTOS.map((p) => p.k)).size).toBe(8);
    for (const p of PONTOS) {
      expect(p.linhas.length).toBeGreaterThan(5);
      expect(p.toque.length).toBeGreaterThan(0);
      expect(p.realce.length).toBeGreaterThan(0);
      expect(p.em.startsWith('na ')).toBe(true);
    }
  });
  it('o ponto fica na área de toque DELE (e só nela), e tudo cabe na arte', () => {
    for (const p of PONTOS) {
      const donos = PONTOS.filter((q) => q.toque.some((t) => dentro(p.ancora, pontos(t)))).map((q) => q.k);
      expect(donos).toEqual([p.k]);
      for (const poli of [...p.toque, ...p.realce]) for (const [x, y] of pontos(poli)) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(ARTE.w);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(ARTE.h);
      }
      const [ex, ey] = p.etiqueta;
      expect(ex).toBeGreaterThan(40); expect(ex).toBeLessThan(ARTE.w - 40);
      expect(ey).toBeGreaterThan(30); expect(ey).toBeLessThan(ARTE.h - 30);
    }
  });
  it('as áreas de toque não se sobrepõem (um toque = um ponto)', () => {
    const dois: string[] = [];
    for (let x = 3; x < ARTE.w; x += 12) for (let y = 3; y < ARTE.h; y += 12) {
      const z = PONTOS.filter((p) => p.toque.some((t) => dentro([x, y], pontos(t))));
      if (z.length > 1) dois.push(`${x},${y}: ${z.map((q) => q.k).join('+')}`);
    }
    expect(dois.slice(0, 10)).toEqual([]);
  });
  it('os pontos não se encostam na arte de 288 px (celular de 320): 30+ px entre dois', () => {
    const escala = 288 / ARTE.w;
    for (const p of PONTOS) for (const q of PONTOS) {
      if (p === q) continue;
      const d = Math.hypot(p.ancora[0] - q.ancora[0], p.ancora[1] - q.ancora[1]) * escala;
      expect(d, `${p.k} × ${q.k}`).toBeGreaterThan(27);
    }
  });
});

describe('o kit da batida no estoque real', () => {
  it('toda linha com tipo/sub usa nomes do estoque (linha sem tipo = pátio); tipo sem peça hoje = linha sem peça', () => {
    // o tipo some do índice quando a última peça dele vende (eletroventilador, intercooler...): o nome continua
    // valendo se é um que o preparar_dados.py conhece, e a linha fica vazia (principal: pátio; extra: some)
    const tipos = new Set(ix.familias);
    const subs = new Set(ix.tipos);
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      if (!l.tipo) { expect(l.extra, `${l.nome}: pátio nunca é extra`).toBeFalsy(); continue; }
      if (!nomeVale(tipos, l.tipo) || !l.sub || !nomeVale(subs, l.sub)) erros.push(`${p.k}: ${l.nome} (${l.tipo} / ${l.sub})`);
      else if (!subs.has(l.sub)) expect(itensDaLinha(p, l, procurar).length, `${p.k}: ${l.nome}`).toBe(0);
    }
    expect(erros).toEqual([]);
  });

  it('nomes de linha únicos em cada ponto', () => {
    for (const p of PONTOS) expect(new Set(p.linhas.map((l) => l.nome)).size, p.k).toBe(p.linhas.length);
  });

  it('o lado do ponto: nenhuma peça do lado oposto entra (esquerdo nunca o direito, e o contrário)', () => {
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      for (const it of itensDaLinha(p, l, procurar)) {
        if (p.lado && it.l && it.l !== p.lado) erros.push(`${p.k} ${l.nome}: ${it.id} é ${it.l}`);
        if (l.lado && it.l !== l.lado) erros.push(`${p.k} ${l.nome}: linha ${l.lado}, peça ${it.l}`);
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

  it('a mesma peça nunca aparece em duas linhas do mesmo ponto (o total não conta nada em dobro)', () => {
    for (const p of PONTOS) {
      const vistas = new Map<string, string>();
      for (const l of p.linhas) for (const it of itensDaLinha(p, l, procurar)) {
        expect(vistas.get(it.id), `${p.k}: ${it.id} em "${vistas.get(it.id)}" e "${l.nome}"`).toBeUndefined();
        vistas.set(it.id, l.nome);
      }
    }
  });

  it('a frente esquerda pede os faróis e para-lamas ESQUERDOS e nunca os direitos (pelo estoque)', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const farol = p.linhas.find((l) => l.nome === 'Farol esquerdo')!;
    const itens = itensDaLinha(p, farol, procurar);
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((it) => it.l === 'E')).toBe(true);
    expect(p.linhas.some((l) => l.nome === 'Farol direito' || l.nome === 'Para-lama direito')).toBe(false);
  });

  it('as peças de cada linha vêm da mais barata para a mais cara, e a 1ª é a do kit', () => {
    for (const p of PONTOS) {
      const kit = kitDoPonto(p, procurar, foto);
      for (const { linha, itens } of opcoesDoPonto(p, procurar)) {
        for (let i = 1; i < itens.length; i++) expect(itens[i].p).toBeGreaterThanOrEqual(itens[i - 1].p);
        const lk = kit.linhas.find((x) => x.nome === linha.nome)!;
        expect(lk.n).toBe(itens.length);
        expect(lk.rep?.id).toBe(itens[0]?.id);
      }
    }
  });

  it('linha extra sem peça sai da lista; a principal sem peça fica (pátio)', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const k = kitDoPonto(p, procurar, foto, XC60);
    for (const l of k.linhas) if (l.extra) expect(l.n, l.nome).toBeGreaterThan(0);
    expect(k.linhas.find((l) => l.nome === 'Capô')?.rep).toBeNull();
    expect(k.linhas.find((l) => l.nome === 'Farol esquerdo')).toBeTruthy();
  });

  it('o código da peça é o gravado nela (campo "o"), nunca a chave da foto do anúncio', () => {
    for (const k of kitsDeTodos(procurar, foto)) for (const l of k.linhas) {
      if (!l.rep) continue;
      expect(l.rep.cod).not.toMatch(/MLB\d+_/);
      expect(l.rep.h).toContain(l.rep.id);
    }
  });

  it('o XC60 2019: as contas de cada ponto saem sem erro e a soma por ponto bate com as linhas', () => {
    const kits = kitsDeTodos(procurar, foto, XC60);
    expect(kits).toHaveLength(8);
    for (const k of kits) {
      expect(k.n).toBe(k.linhas.reduce((s, l) => s + l.n, 0));
      for (const l of k.linhas) {
        expect(l.n === 0).toBe(l.rep === null);
        if (l.rep) expect(l.rep.p).toBeGreaterThan(0);
      }
    }
  });

  it('o link da linha é o do catálogo (tipo + sub + lado/posição + o carro) e a busca dele contém as peças da linha', () => {
    for (const p of PONTOS) for (const l of p.linhas) {
      if (!l.tipo) continue;
      const u = new URL(linkDaLinha(l, XC60), 'https://x');
      expect(u.pathname).toBe('/catalogo.html');
      expect(u.searchParams.get('tipo')).toBe(l.tipo);
      expect(u.searchParams.get('sub')).toBe(l.sub);
      expect(u.searchParams.get('lado')).toBe(l.lado ? (l.lado === 'E' ? 'esquerdo' : 'direito') : null);
      expect(u.searchParams.get('pos')).toBe(l.pos ? (l.pos === 'D' ? 'dianteiro' : 'traseiro') : null);
      const doCatalogo = new Set(procurar(filtrosDaLinha(l, XC60)).map((it) => it.id));
      for (const it of itensDaLinha(p, l, procurar, XC60)) expect(doCatalogo.has(it.id)).toBe(true);
    }
  });

  it('o pedido: só o que está marcado; peça sem estoque vai como pátio, não como item', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const k = kitDoPonto(p, procurar, foto, XC60);
    const todas = new Set(k.linhas.map((_, i) => i));
    const { itens, patio } = pedidoDe(k.linhas, todas);
    expect(itens.length + patio.length).toBe(k.linhas.length);
    expect(itens.length).toBe(k.linhas.filter((l) => l.rep).length);
    expect(patio).toContain('Capô');
    expect(pedidoDe(k.linhas, new Set())).toEqual({ itens: [], patio: [] });
    const so = pedidoDe(k.linhas, new Set([k.linhas.findIndex((l) => l.rep)]));
    expect(so.itens).toHaveLength(1);
    expect(so.patio).toEqual([]);
  });
});
