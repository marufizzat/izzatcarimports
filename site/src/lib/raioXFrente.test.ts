import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PONTOS_QUENTES, ARTE_FRENTE, ARTE_FRENTE_320, ARTE_FRENTE_900, ZONA_PILOTO } from './raioXFrente';
import { ZONAS, linkLinha, filtrosLinha, zonasDaPeca } from './raioX';
import { Busca, type Indice, type Lado, type Posicao } from './busca';

const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8')) as Indice;
const b = new Busca(ix);
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
// os filtros que o catálogo lê do endereço (catalogo/Catalogo.tsx: LADOS e POSICOES por extenso)
function filtrosDoLink(href: string) {
  const u = new URL(href, 'https://x').searchParams;
  const lado = ({ esquerdo: 'E', direito: 'D' } as Record<string, Lado>)[u.get('lado') ?? ''];
  const pos = ({ dianteiro: 'D', traseiro: 'T' } as Record<string, Posicao>)[u.get('pos') ?? ''];
  return { marca: u.get('marca') ?? undefined, modelo: u.get('modelo') ?? undefined, ano: u.get('ano') ? Number(u.get('ano')) : undefined,
    tipo: u.get('tipo') ?? undefined, sub: u.get('sub') ?? undefined, lado, pos };
}

describe('a frente por dentro: os pontos quentes na arte', () => {
  it('a arte e as variantes existem (a de 320 é a miniatura do botão)', () => {
    for (const a of [ARTE_FRENTE.src, ARTE_FRENTE_320, ARTE_FRENTE_900]) expect(existsSync(`public${a}`), a).toBe(true);
    expect(ZONAS.some((z) => z.k === ZONA_PILOTO)).toBe(true);
  });
  it('chaves e nomes únicos; o ponto do número fica dentro da peça; tudo dentro da arte', () => {
    expect(new Set(PONTOS_QUENTES.map((p) => p.k)).size).toBe(PONTOS_QUENTES.length);
    expect(new Set(PONTOS_QUENTES.map((p) => p.nome)).size).toBe(PONTOS_QUENTES.length);
    for (const p of PONTOS_QUENTES) {
      expect(p.poligonos.some((poli) => dentro(p.ancora, pontos(poli))), p.k).toBe(true);
      for (const poli of p.poligonos) {
        expect(pontos(poli).length, p.k).toBeGreaterThanOrEqual(6);
        for (const [x, y] of pontos(poli)) {
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(ARTE_FRENTE.w);
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(ARTE_FRENTE.h);
        }
      }
    }
  });
  it('o número de uma peça nunca cai em cima da forma de outra desenhada DEPOIS dela (a de cima ganha o toque)', () => {
    PONTOS_QUENTES.forEach((p, i) => {
      const porCima = PONTOS_QUENTES.slice(i + 1).filter((q) => q.poligonos.some((poli) => dentro(p.ancora, pontos(poli)))).map((q) => q.k);
      expect(porCima, p.k).toEqual([]);
    });
  });
  it('os números não se encostam na arte de 288 px (celular de 320)', () => {
    const escala = 288 / ARTE_FRENTE.w;
    for (const p of PONTOS_QUENTES) for (const q of PONTOS_QUENTES) {
      if (p === q) continue;
      expect(Math.hypot(p.ancora[0] - q.ancora[0], p.ancora[1] - q.ancora[1]) * escala, `${p.k} × ${q.k}`).toBeGreaterThan(20);
    }
  });
  it('lado da arte: o farol e o para-lama à DIREITA de quem olha são os ESQUERDOS do carro', () => {
    const x = (k: string) => PONTOS_QUENTES.find((p) => p.k === k)!.ancora[0];
    expect(x('farol-esquerdo')).toBeGreaterThan(x('farol-direito'));
    expect(x('para-lama-esquerdo')).toBeGreaterThan(x('para-lama-direito'));
    expect(PONTOS_QUENTES.find((p) => p.k === 'farol-esquerdo')!.lado).toBe('E');
    expect(PONTOS_QUENTES.find((p) => p.k === 'para-lama-direito')!.lado).toBe('D');
  });
});

describe('a frente por dentro: pontos quentes ↔ links do catálogo', () => {
  it('todo ponto com tipo existe no estoque (bloco e tipo); sem tipo = pátio, com o nome da mensagem', () => {
    const blocos = new Set(ix.familias);
    const tipos = new Set(ix.tipos);
    for (const p of PONTOS_QUENTES) {
      expect(p.procuro, p.k).toMatch(/^(o|a) /);
      if (!p.tipo) continue;
      expect(blocos.has(p.tipo), `${p.k}: ${p.tipo}`).toBe(true);
      expect(p.sub && tipos.has(p.sub), `${p.k}: ${p.sub}`).toBe(true);
    }
  });
  it('o link leva o tipo, o sub, o lado e a posição do ponto, e o carro; o número é o da busca com os filtros DO LINK', () => {
    for (const carro of [{}, XC60, { marca: 'Jaguar', modelo: 'E-Pace' }]) {
      for (const p of PONTOS_QUENTES) {
        if (!p.tipo || !p.sub) continue;
        const l = { tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos };
        const href = linkLinha(l, carro);
        const f = filtrosDoLink(href);
        expect(f).toEqual({ marca: undefined, modelo: undefined, ano: undefined, ...carro, tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos });
        const doPonto = b.procurar(filtrosLinha(l, carro)).map((it) => it.id).sort();
        const doLink = b.procurar({ ...f, ordem: 'novos' }).map((it) => it.id).sort();
        expect(doPonto, `${p.k}`).toEqual(doLink);
        // lado e posição de verdade: nenhuma peça do link diz o outro lado
        for (const it of b.procurar({ ...f, ordem: 'novos' })) {
          if (p.lado) expect(it.l, `${p.k} ${it.id}`).toBe(p.lado);
          if (p.pos) expect(it.pos === p.pos || it.pos === 'A', `${p.k} ${it.id}`).toBe(true);
        }
      }
    }
  });
  it('no estoque inteiro, as peças dos pontos quentes são peças da FRENTE ou do MOTOR do Raio-x (nunca de outra parte)', () => {
    const fora: string[] = [];
    for (const p of PONTOS_QUENTES) {
      if (!p.tipo || !p.sub) continue;
      for (const it of b.procurar({ tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos, ordem: 'novos' })) {
        const zs = zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).map((z) => z.k);
        // para-lama: a tabela das zonas guarda na lateral (o lado dele); o resto, frente ou motor
        // a alma vai sem a posição (o estoque quase nunca a escreve): o link mostra também a traseira, e o nome diz
        if (p.k === 'alma') continue;
        if (!zs.some((k) => k === 'frente' || k === 'motor' || k.startsWith('lateral'))) fora.push(`${p.k}: ${it.n} (${zs.join('+') || 'sem zona'})`);
      }
    }
    expect(fora).toEqual([]);
  });
});
