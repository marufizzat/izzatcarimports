import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { ZONAS, ARTE, DO_OUTRO_LADO, outroLado } from './raioX';
import { PONTOS, PONTOS_DO_OUTRO_LADO } from './batida';
import { ARTE_TRAS, ZONAS_TRAS, PONTOS_TRAS } from './raioXTras';

// "Girar o carro": a vista de trás. Nada aqui depende do estoque: é a geometria da arte e a regra de quem fica de que lado.
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
const zonasEm = (pt: [number, number]) => ZONAS_TRAS.filter((z) => z.poligonos.some((p) => dentro(pt, pontos(p))));
const naArte = (polis: string[]) => {
  for (const p of polis) for (const [x, y] of pontos(p)) {
    expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(ARTE_TRAS.w);
    expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(ARTE_TRAS.h);
  }
};

describe('a arte da vista de trás', () => {
  it('tem o tamanho da arte da frente (o palco não muda) e as variantes de 320 e 900 em dia', () => {
    expect([ARTE_TRAS.w, ARTE_TRAS.h]).toEqual([ARTE.w, ARTE.h]);
    const nome = ARTE_TRAS.src.split('/').pop()!;
    expect(existsSync(`public${ARTE_TRAS.src}`)).toBe(true);
    const manifesto = JSON.parse(readFileSync('src/data/variantes-arte.json', 'utf-8')) as Record<string, { v: number[] }>;
    expect(manifesto[nome]?.v).toEqual([320, 900]);
    for (const l of [320, 900]) expect(existsSync(`public${ARTE_TRAS.src.replace(/\.webp$/, `-${l}.webp`)}`)).toBe(true);
  });
});

describe('quem fica de que lado', () => {
  const chaves = ZONAS.map((z) => z.k);
  const reais = ZONAS_TRAS.filter((z) => !z.longe).map((z) => z.k);
  it('as zonas de trás são zonas do Raio-x, sem repetir', () => {
    for (const z of ZONAS_TRAS) expect(chaves, z.k).toContain(z.k);
    expect(new Set(ZONAS_TRAS.map((z) => z.k)).size).toBe(ZONAS_TRAS.length);
  });
  it('toda zona aparece de verdade em pelo menos uma vista, e nenhuma fica "do outro lado" nas duas', () => {
    for (const k of chaves) {
      const naFrente = !DO_OUTRO_LADO.frente.includes(k);
      const atras = !DO_OUTRO_LADO.tras.includes(k);
      expect(naFrente || atras, k).toBe(true);
    }
    for (const k of [...DO_OUTRO_LADO.frente, ...DO_OUTRO_LADO.tras]) expect(chaves, k).toContain(k);
  });
  it('na vista de trás: o que é "do outro lado" não tem forma de verdade, e o resto tem (traseira e lateral direita inclusive)', () => {
    expect([...reais].sort()).toEqual(chaves.filter((k) => !DO_OUTRO_LADO.tras.includes(k)).sort());
    // o que a vista da frente manda para trás tem de estar desenhado lá
    for (const k of DO_OUTRO_LADO.frente) expect(reais, k).toContain(k);
    // e a zona "de longe" (um alvo que gira o carro de volta) é sempre uma do outro lado
    for (const z of ZONAS_TRAS.filter((x) => x.longe)) expect(DO_OUTRO_LADO.tras, z.k).toContain(z.k);
  });
  it('girar duas vezes volta à mesma vista', () => {
    expect(outroLado('frente')).toBe('tras');
    expect(outroLado(outroLado('frente'))).toBe('frente');
  });
  it('o HTML da vista da frente marca as mesmas zonas "do outro lado" que o script (a classe sai da MESMA lista)', () => {
    const fonte = readFileSync('src/components/v2/RaioX.astro', 'utf-8');
    expect(fonte).toContain('DO_OUTRO_LADO.frente.includes(k)');
    expect(fonte).toContain('DO_OUTRO_LADO[lado].includes(k)');
  });
});

describe('as zonas na arte de trás', () => {
  it('todo ponto da arte cai em UMA zona só (repartem a arte inteira, sem sobrepor)', () => {
    const fora: string[] = [];
    const dois: string[] = [];
    for (let x = 3; x < ARTE_TRAS.w; x += 12) for (let y = 3; y < ARTE_TRAS.h; y += 12) {
      const z = zonasEm([x, y]);
      if (z.length === 0) fora.push(`${x},${y}`);
      if (z.length > 1) dois.push(`${x},${y}: ${z.map((q) => q.k).join('+')}`);
    }
    expect(dois.slice(0, 10)).toEqual([]);
    expect(fora.slice(0, 10)).toEqual([]);
  });
  it('o ponto de cada zona fica dentro dela; polígonos e realces dentro da arte; cada zona acende alguma coisa', () => {
    for (const z of ZONAS_TRAS) {
      expect(zonasEm(z.ancora).map((q) => q.k), z.k).toEqual([z.k]);
      naArte(z.poligonos);
      naArte(z.realce);
      expect(z.realce.length, z.k).toBeGreaterThan(0);
    }
  });
  it('as etiquetas ficam nas duas faixas do fundo do estúdio e não se encostam com a arte em 640 px', () => {
    // largura da etiqueta em 640 px de arte: letra de 13 px (~7,1 px por letra), 20 px de respiro e a contagem (4 dígitos) ou o sinal de girar
    const escala = ARTE_TRAS.w / 640;
    const largura = (k: string) => {
      const z = ZONAS.find((x) => x.k === k)!;
      return (z.nome.length * 7.1 + 20 + (ZONAS_TRAS.find((x) => x.k === k)!.longe ? 20 : 34)) * escala;
    };
    for (const y of [62, 965]) {
      const fila = ZONAS_TRAS.filter((z) => z.etiqueta[1] === y).sort((a, b) => a.etiqueta[0] - b.etiqueta[0]);
      for (let i = 0; i < fila.length; i++) {
        const [x] = fila[i].etiqueta;
        const meia = largura(fila[i].k) / 2;
        expect(x - meia, fila[i].k).toBeGreaterThanOrEqual(0);
        expect(x + meia, fila[i].k).toBeLessThanOrEqual(ARTE_TRAS.w);
        if (i) expect(x - meia, `${fila[i - 1].k} | ${fila[i].k}`).toBeGreaterThan(fila[i - 1].etiqueta[0] + largura(fila[i - 1].k) / 2);
      }
    }
    expect(ZONAS_TRAS.every((z) => z.etiqueta[1] === 62 || z.etiqueta[1] === 965)).toBe(true);
  });
  it('os pontos não se encostam na arte de 288 px (celular de 320): 30+ px entre dois', () => {
    const escala = 288 / ARTE_TRAS.w;
    for (const a of ZONAS_TRAS) for (const b of ZONAS_TRAS) {
      if (a === b) continue;
      expect(Math.hypot(a.ancora[0] - b.ancora[0], a.ancora[1] - b.ancora[1]) * escala, `${a.k} × ${b.k}`).toBeGreaterThanOrEqual(30);
    }
  });
  it('o botão de girar (canto de cima à esquerda; na arte larga, a borda esquerda) não cobre ponto nem etiqueta em nenhuma das vistas', () => {
    // arte de 288 px: 46 px de botão a 6 px do canto; arte de 640 px: 56 px a 14 px da borda, a 16% do topo
    const caixas = [
      { nome: '288', x0: 0, y0: 0, x1: ((6 + 46 + 6) / 288) * ARTE.w, y1: ((6 + 46 + 6) / 192) * ARTE.h, larga: false },
      { nome: '640', x0: 0, y0: 0.16 * ARTE.h - 12, x1: ((14 + 56 + 6) / 640) * ARTE.w, y1: 0.16 * ARTE.h + (62 / 427) * ARTE.h, larga: true },
    ];
    const marcos = [
      ...ZONAS.map((z) => ({ k: `frente:${z.k}`, a: z.ancora, e: z.etiqueta })),
      ...ZONAS_TRAS.map((z) => ({ k: `tras:${z.k}`, a: z.ancora, e: z.etiqueta })),
      ...PONTOS.map((p) => ({ k: `batida:${p.k}`, a: p.ancora, e: p.etiqueta })),
      ...PONTOS_TRAS.map((p) => ({ k: `batida-tras:${p.k}`, a: p.ancora, e: p.etiqueta })),
    ];
    for (const c of caixas) for (const m of marcos) {
      const fora = (p: [number, number], folga: number) => p[0] - folga > c.x1 || p[1] + folga < c.y0 || p[1] - folga > c.y1;
      // o ponto (11 px de raio na arte estreita) e, na larga, o meio da etiqueta (14 px de meia altura)
      expect(fora(m.a, (11 / (c.larga ? 640 : 288)) * ARTE.w), `${c.nome} ${m.k} ponto`).toBe(true);
      if (c.larga) expect(m.e[1] + (14 / 427) * ARTE.h < c.y0 || m.e[1] - (14 / 427) * ARTE.h > c.y1 || m.e[0] - 60 > c.x1, `${c.nome} ${m.k} etiqueta`).toBe(true);
    }
  });
});

describe('os pontos da batida na vista de trás', () => {
  const chaves = PONTOS.map((p) => p.k);
  it('são pontos do "Bati o carro"; os que faltam são exatamente os "do outro lado" desta vista', () => {
    for (const p of PONTOS_TRAS) expect(chaves, p.k).toContain(p.k);
    expect(new Set(PONTOS_TRAS.map((p) => p.k)).size).toBe(PONTOS_TRAS.length);
    expect(chaves.filter((k) => !PONTOS_TRAS.some((p) => p.k === k)).sort()).toEqual([...PONTOS_DO_OUTRO_LADO.tras].sort());
    // o que a vista da frente manda girar tem de existir na de trás (e nunca dos dois lados ao mesmo tempo)
    for (const k of PONTOS_DO_OUTRO_LADO.frente) expect(PONTOS_TRAS.map((p) => p.k), k).toContain(k);
    for (const k of PONTOS_DO_OUTRO_LADO.frente) expect(PONTOS_DO_OUTRO_LADO.tras, k).not.toContain(k);
  });
  it('a vista de trás mostra a traseira e o lado direito: nenhum ponto dela é só da frente esquerda', () => {
    for (const t of PONTOS_TRAS) {
      const p = PONTOS.find((x) => x.k === t.k)!;
      expect(p.pos === 'T' || p.lado === 'D', p.k).toBe(true);
    }
    for (const k of PONTOS_DO_OUTRO_LADO.tras) {
      const p = PONTOS.find((x) => x.k === k)!;
      expect(p.pos !== 'T' && p.lado !== 'D', k).toBe(true);
    }
    // e, na da frente, o que gira é da traseira ou do lado direito
    for (const k of PONTOS_DO_OUTRO_LADO.frente) {
      const p = PONTOS.find((x) => x.k === k)!;
      expect(p.pos === 'T' || p.lado === 'D', k).toBe(true);
    }
  });
  it('o ponto fica na área de toque DELE (e só nela), as áreas não se sobrepõem e tudo cabe na arte', () => {
    for (const p of PONTOS_TRAS) {
      const donos = PONTOS_TRAS.filter((q) => q.toque.some((t) => dentro(p.ancora, pontos(t)))).map((q) => q.k);
      expect(donos, p.k).toEqual([p.k]);
      naArte(p.toque);
      naArte(p.realce);
      const [ex, ey] = p.etiqueta;
      expect(ex).toBeGreaterThan(40); expect(ex).toBeLessThan(ARTE_TRAS.w - 40);
      expect(ey).toBeGreaterThan(30); expect(ey).toBeLessThan(ARTE_TRAS.h - 30);
    }
    const dois: string[] = [];
    for (let x = 3; x < ARTE_TRAS.w; x += 12) for (let y = 3; y < ARTE_TRAS.h; y += 12) {
      const z = PONTOS_TRAS.filter((p) => p.toque.some((t) => dentro([x, y], pontos(t))));
      if (z.length > 1) dois.push(`${x},${y}: ${z.map((q) => q.k).join('+')}`);
    }
    expect(dois.slice(0, 10)).toEqual([]);
  });
  it('os pontos não se encostam na arte de 288 px: 30+ px entre dois', () => {
    const escala = 288 / ARTE_TRAS.w;
    for (const a of PONTOS_TRAS) for (const b of PONTOS_TRAS) {
      if (a === b) continue;
      expect(Math.hypot(a.ancora[0] - b.ancora[0], a.ancora[1] - b.ancora[1]) * escala, `${a.k} × ${b.k}`).toBeGreaterThanOrEqual(30);
    }
  });
});
