import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pecasVivas, vivoPorZona, serveNoCarro, type PecaViva } from './raioXVivo';
import { ZONAS, zonasDaPeca, pecasDaZona, contarZonas } from './raioX';
import { Busca, type Indice } from './busca';
import { resumo, pecas } from './dados';
import { QTD_CHEGOU } from '../components/catalogo/etiqueta';

// O Raio-x vivo contra o estoque DE AGORA (muda a cada rodada). Tudo aqui é invariante: o esperado sai dos próprios
// dados (a lista do selo "Chegou agora" e a busca do catálogo); nenhum teste exige uma peça, uma zona ou uma
// quantidade. Estoque sem nenhuma peça nova com lugar no carro também passa: aí nada pulsa.
const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8')) as Indice;
const busca = new Busca(ix);
const procurar = (f: Parameters<Busca['procurar']>[0]) => busca.procurar(f);
const chegou = resumo().chegou;
const vivas = pecasVivas(chegou, busca.itens);
const porId = new Map(busca.itens.map((it) => [it.id, it]));

describe('o que é "chegou agora" no Raio-x', () => {
  it('é a MESMA lista do selo "Chegou agora" dos cartões (resumo.chegou): toda peça viva está nela, na mesma ordem', () => {
    expect(chegou.length).toBeLessThanOrEqual(QTD_CHEGOU);
    const ids = vivas.map((p) => p.id);
    for (const id of ids) expect(chegou, id).toContain(id);
    expect(ids).toEqual(chegou.filter((id) => ids.includes(id)));
    expect(new Set(ids).size).toBe(ids.length);
    // o cartão decide com `resumo().chegou.includes(p.id)` (components/CartaoPeca.astro): a regra continua lá
    expect(readFileSync('src/components/CartaoPeca.astro', 'utf-8')).toContain('resumo().chegou.includes(p.id)');
  });
  it('nenhuma peça do selo com lugar no carro fica de fora, e nenhuma sem lugar entra', () => {
    for (const id of chegou) {
      const it = porId.get(id);
      const zs = it ? zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).map((z) => z.k) : [];
      const viva = vivas.find((p) => p.id === id);
      if (zs.length) expect(viva?.z, id).toEqual(zs);
      else expect(viva, id).toBeUndefined();
    }
  });
  it('cada peça viva leva o nome, o carro e o endereço de uma página de peça que EXISTE', () => {
    const slugs = new Set(pecas().map((p) => p.slug));
    for (const p of vivas) {
      const it = porId.get(p.id)!;
      expect([p.n, p.h, p.b, p.m, p.y, p.ms, p.ys]).toEqual([it.n, it.h, it.b, it.m, it.y, it.ms, it.ys]);
      expect(p.n.length, p.id).toBeGreaterThan(0);
      expect(slugs.has(p.h), p.h).toBe(true);
      expect(p.h.endsWith(p.id), p.h).toBe(true);
    }
  });
  it('o arquivo /dados/raio-x-vivo.json é essa lista, sem mais nada', async () => {
    const { GET } = await import('../pages/dados/raio-x-vivo.json');
    const j = await (GET as unknown as () => Response)().json();
    expect(j).toEqual(JSON.parse(JSON.stringify({ v: 1, p: vivas })));
  });
});

describe('sem carro: o estoque inteiro ("Chegou no pátio")', () => {
  const v = vivoPorZona(vivas);
  it('pulsa só a zona onde há peça do selo, e a peça mostrada é a mais nova delas naquela zona', () => {
    for (const z of ZONAS) {
      const daZona = vivas.filter((p) => p.z.includes(z.k));
      if (!daZona.length) expect(v[z.k], z.k).toBeUndefined();
      else expect(v[z.k]?.id, z.k).toBe(daZona[0].id);
    }
    expect(Object.keys(v).every((k) => ZONAS.some((z) => z.k === k))).toBe(true);
  });
  it('a peça mostrada está na lista da zona (o painel conta ela) e a zona tem peça', () => {
    const contas = contarZonas(procurar);
    for (const [k, p] of Object.entries(v)) {
      const z = ZONAS.find((x) => x.k === k)!;
      expect(pecasDaZona(procurar, {}, z).map((it) => it.id), `${k}: ${p.n}`).toContain(p.id);
      expect(contas.find((c) => c.k === k)!.n, k).toBeGreaterThan(0);
    }
  });
});

describe('com carro: só o que serve no carro (e no ano) da pessoa', () => {
  // os carros que o teste usa saem dos dados: os das peças vivas (com o ano nas pontas da faixa, fora dela e sem ano)
  // e alguns do estoque que podem não ter peça nova nenhuma
  type Carro = { b: string; m: string; y?: number };
  const carros: Carro[] = [];
  const junta = (b: string, m: string, y: [number, number] | null) => {
    carros.push({ b, m });
    if (y) for (const ano of [y[0], y[1], y[0] - 1, y[1] + 1]) carros.push({ b, m, y: ano });
  };
  for (const p of vivas) (p.ms ?? [p.m]).forEach((m, i) => { if (m) junta(p.b, m, p.ms && p.ys ? p.ys[i] ?? null : p.y); });
  for (const it of busca.itens.filter((_, i) => i % 331 === 0)) if (it.m) junta(it.b, it.m, it.y);

  it('a conta do navegador (serveNoCarro) é a do filtro do catálogo: as peças vivas do carro = a lista do selo ∩ a busca do catálogo', () => {
    expect(carros.length).toBeGreaterThan(0);
    for (const c of carros) {
      const doCatalogo = new Set(procurar({ marca: c.b, modelo: c.m, ano: c.y }).map((it) => it.id));
      const esperado = vivas.filter((p) => doCatalogo.has(p.id)).map((p) => p.id);
      const obtido = vivas.filter((p) => serveNoCarro(p, c)).map((p) => p.id);
      expect(obtido, `${c.b} ${c.m} ${c.y ?? ''}`).toEqual(esperado);
    }
  });
  it('cada zona que pulsa mostra a peça nova mais recente DAQUELE carro naquela zona, e ela está na lista da zona do carro', () => {
    for (const c of carros) {
      const f = { marca: c.b, modelo: c.m, ano: c.y };
      const v = vivoPorZona(vivas, c);
      const doCatalogo = new Set(procurar(f).map((it) => it.id));
      for (const z of ZONAS) {
        const esperada = vivas.find((p) => p.z.includes(z.k) && doCatalogo.has(p.id));
        expect(v[z.k]?.id, `${c.b} ${c.m} ${c.y ?? ''} · ${z.k}`).toBe(esperada?.id);
        // a zona que pulsa: a peça está na lista que o painel dela mostra para este carro
        if (v[z.k]) expect(pecasDaZona(procurar, f, z).map((it) => it.id), `${c.b} ${c.m} ${c.y ?? ''} · ${z.k}`).toContain(v[z.k].id);
      }
    }
  });
  it('carro que não existe no estoque: nada pulsa', () => {
    expect(vivoPorZona(vivas, { b: 'Marca que não existe', m: 'Modelo', y: 2019 })).toEqual({});
  });
});

describe('a conta, com peças de exemplo', () => {
  const base = { id: 'MLB1', n: 'Lanterna', h: 'lanterna-MLB1', z: ['traseira'] };
  const xc60: PecaViva = { ...base, b: 'Volvo', m: 'XC60', y: [2018, 2024] };
  const dois: PecaViva = { ...base, id: 'MLB2', h: 'x-MLB2', z: ['motor'], b: 'Volvo', m: 'S60', y: [2011, 2018], ms: ['S60', 'XC60'], ys: [[2011, 2018], [2009, 2017]] };
  const semFaixa: PecaViva = { ...base, id: 'MLB3', h: 'y-MLB3', b: 'Volvo', m: 'XC60', y: null };
  it('marca, modelo e ano; a peça de 2 carros vale no ano de CADA carro; sem faixa de anos não passa pelo ano', () => {
    expect(serveNoCarro(xc60, { b: 'Volvo', m: 'XC60', y: 2019 })).toBe(true);
    expect(serveNoCarro(xc60, { b: 'Volvo', m: 'XC60', y: 2017 })).toBe(false);
    expect(serveNoCarro(xc60, { b: 'Volvo', m: 'XC60' })).toBe(true);
    expect(serveNoCarro(xc60, { b: 'Volvo', m: 'XC90', y: 2019 })).toBe(false);
    expect(serveNoCarro(xc60, { b: 'Jeep', m: 'XC60', y: 2019 })).toBe(false);
    expect(serveNoCarro(dois, { b: 'Volvo', m: 'XC60', y: 2015 })).toBe(true);
    expect(serveNoCarro(dois, { b: 'Volvo', m: 'XC60', y: 2018 })).toBe(false);
    expect(serveNoCarro(dois, { b: 'Volvo', m: 'S60', y: 2018 })).toBe(true);
    expect(serveNoCarro(semFaixa, { b: 'Volvo', m: 'XC60' })).toBe(true);
    expect(serveNoCarro(semFaixa, { b: 'Volvo', m: 'XC60', y: 2019 })).toBe(false);
  });
  it('a 1ª da lista (a mais nova) é a da zona; nada novo = nada pulsa', () => {
    const outra: PecaViva = { ...xc60, id: 'MLB9', h: 'z-MLB9' };
    expect(vivoPorZona([xc60, outra]).traseira.id).toBe('MLB1');
    expect(vivoPorZona([xc60, dois], { b: 'Volvo', m: 'XC60', y: 2015 })).toEqual({ motor: dois });
    expect(vivoPorZona([])).toEqual({});
    expect(pecasVivas([], [])).toEqual([]);
    expect(pecasVivas(['MLB-que-vendeu'], [])).toEqual([]);
  });
});
