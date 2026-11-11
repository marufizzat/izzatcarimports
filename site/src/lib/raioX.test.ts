import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { ZONAS, ARTE, NA_GALERIA, contarZonas, pecasDaZona, zonasDaPeca, linkLinha, filtrosLinha, codigoDaFoto, fotoDoCodigo, lerRaioX } from './raioX';
import { Busca, type Indice } from './busca';

const buscaArq = 'public/dados/busca.json';

// ponto dentro de polígono (par-ímpar), em pixels da arte
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
const daZona = (pt: [number, number]) => ZONAS.filter((z) => z.poligonos.some((p) => dentro(pt, pontos(p))));

describe('as zonas na arte', () => {
  it('9 zonas, chaves únicas, na ordem da frente para trás', () => {
    expect(ZONAS.map((z) => z.nome)).toEqual(['Frente', 'Motor', 'Lateral esquerda', 'Lateral direita', 'Interior e painel', 'Teto', 'Traseira', 'Rodas e suspensão', 'Embaixo']);
    expect(new Set(ZONAS.map((z) => z.k)).size).toBe(ZONAS.length);
  });
  it('todo ponto da arte cai em UMA zona só (repartem a arte inteira, sem sobrepor)', () => {
    const fora: string[] = [];
    const dois: string[] = [];
    // grade de 12 px, longe das bordas comuns (o par-ímpar decide a borda de um jeito ou de outro)
    for (let x = 3; x < ARTE.w; x += 12) {
      for (let y = 3; y < ARTE.h; y += 12) {
        const z = daZona([x, y]);
        if (z.length === 0) fora.push(`${x},${y}`);
        if (z.length > 1) dois.push(`${x},${y}: ${z.map((q) => q.k).join('+')}`);
      }
    }
    expect(dois.slice(0, 10)).toEqual([]);
    expect(fora.slice(0, 10)).toEqual([]);
  });
  it('o rótulo de cada zona fica dentro dela, e os polígonos dentro da arte', () => {
    for (const z of ZONAS) {
      expect(daZona(z.ancora).map((q) => q.k)).toEqual([z.k]);
      for (const p of z.poligonos) for (const [x, y] of pontos(p)) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(ARTE.w);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(ARTE.h);
      }
    }
  });
});

describe('linkLinha: o endereço que o catálogo entende', () => {
  it('tipo + sub sempre juntos; lado e posição por extenso; o carro antes', () => {
    expect(linkLinha({ tipo: 'Retrovisores', sub: 'Retrovisores Externos', lado: 'E' }, { marca: 'Volvo', modelo: 'XC60', ano: 2019 }))
      .toBe('/catalogo.html?marca=Volvo&modelo=XC60&ano=2019&tipo=Retrovisores&sub=Retrovisores+Externos&lado=esquerdo');
    expect(linkLinha({ tipo: 'Limpador e Lavador', sub: 'Motores do Limpador', pos: 'T' }))
      .toBe('/catalogo.html?tipo=Limpador+e+Lavador&sub=Motores+do+Limpador&pos=traseiro');
    expect(linkLinha({ tipo: 'Motor', sub: 'Coxins do Motor' }, { marca: 'Jeep', modelo: 'Compass' }))
      .toBe('/catalogo.html?marca=Jeep&modelo=Compass&tipo=Motor&sub=Coxins+do+Motor');
  });
});

// O mapa contra o estoque: muda a cada rodada (30 min). Nunca exige um tipo com peça (os de 1 peça zeram), só que o
// nome exista no índice, que toda zona tenha peça e que o número de cada linha seja o do catálogo.
describe.skipIf(!existsSync(buscaArq))('o mapa contra o estoque de agora', () => {
  const ix = JSON.parse(readFileSync(buscaArq, 'utf-8')) as Indice;
  const toda = new Busca(ix);
  const procurar = toda.procurar.bind(toda);
  const contas = contarZonas(procurar);

  it('todo bloco e todo tipo do mapa existe no índice (pega acento errado e tipo renomeado)', () => {
    const blocos = new Set(ix.familias);
    const tipos = new Set(ix.tipos);
    const ruins: string[] = [];
    for (const z of ZONAS) for (const g of z.grupos) {
      if (!blocos.has(g.tipo)) ruins.push(`${z.k}: bloco "${g.tipo}"`);
      for (const s of [...(g.subs ?? []), ...(g.sem ?? [])]) if (!tipos.has(s)) ruins.push(`${z.k}: tipo "${s}" (${g.tipo})`);
    }
    // um tipo some do estoque quando a última peça dele vende: aceita até 4 nomes fora do índice, avisando
    if (ruins.length) console.warn('raio-x: nomes fora do índice agora:', ruins);
    expect(ruins.length).toBeLessThanOrEqual(4);
  });

  it('toda zona tem peça e toda linha leva ao catálogo com o MESMO número (e as peças são do bloco e do tipo)', () => {
    const resumo: string[] = [];
    for (const c of contas) {
      const z = ZONAS.find((x) => x.k === c.k)!;
      expect(c.n, z.nome).toBeGreaterThan(0);
      expect(c.linhas.length, z.nome).toBeGreaterThan(0);
      for (const l of c.linhas) {
        const lista = toda.procurar(filtrosLinha(l));
        expect(lista.length, `${z.nome} · ${l.sub}`).toBe(l.n);
        expect(lista.every((it) => it.c === l.tipo && it.s === l.sub)).toBe(true);
        if (l.lado) expect(lista.every((it) => it.l === l.lado)).toBe(true);
      }
      // a soma das linhas = a zona (uma peça não entra em duas linhas da mesma zona)
      expect(c.linhas.reduce((s, l) => s + l.n, 0), z.nome).toBe(c.n);
      resumo.push(`${z.nome} ${c.n}: ${c.linhas.slice(0, 4).map((l) => `${l.sub} ${l.n}`).join(', ')}`);
    }
    console.info(`raio-x, estoque inteiro:\n  ${resumo.join('\n  ')}`);
  });

  it('as laterais só têm peças do lado delas', () => {
    const esq = contas.find((c) => c.k === 'lateral-esquerda')!;
    const dir = contas.find((c) => c.k === 'lateral-direita')!;
    expect(esq.linhas.every((l) => l.lado === 'E')).toBe(true);
    expect(dir.linhas.every((l) => l.lado === 'D')).toBe(true);
  });

  it('com o carro: o arquivo só do carro dá as MESMAS contas que o índice inteiro filtrado (marca, modelo, ano)', async () => {
    const carro = ix.marcas.includes('Volvo') ? { b: 'Volvo', m: 'XC60' } : { b: ix.marcas[ix.b[0]], m: ix.m[0] };
    const { GET } = await import('../pages/dados/carro/[k].json');
    const sub = await (GET as unknown as (c: { props: { b: string; m: string } }) => Response)({ props: carro }).json();
    const doCarro = new Busca(sub);
    const anos = toda.procurar({ marca: carro.b, modelo: carro.m }).map((it) => it.y?.[1]).filter((y): y is number => !!y);
    const ano = anos.sort((a, b) => b - a)[0];
    const f = { marca: carro.b, modelo: carro.m, ano };
    const a = contarZonas(procurar, f);
    const b = contarZonas(doCarro.procurar.bind(doCarro), f);
    expect(b.map((c) => [c.k, c.n, c.linhas.map((l) => `${l.sub}:${l.n}`).join('|')]))
      .toEqual(a.map((c) => [c.k, c.n, c.linhas.map((l) => `${l.sub}:${l.n}`).join('|')]));
    for (const c of b) for (const l of c.linhas) expect(doCarro.procurar(filtrosLinha(l, f)).length).toBe(l.n);
    expect(a.some((c) => c.n > 0)).toBe(true);
  });
});

describe('o JSON curto da página', () => {
  it('a foto vai e volta pelo código curto', () => {
    for (const f of ['/estudio-400/MLB123.webp', '/estudio-pro/MLB9.webp', '/estudio/MLB77.webp', 'https://http2.mlstatic.com/D_123-MLA456_789-A.webp', '/outra/coisa.webp', '']) {
      expect(fotoDoCodigo(codigoDaFoto(f))).toBe(f);
    }
    expect(codigoDaFoto('/estudio-400/MLB123.webp')).toBe('4MLB123');
  });
  it('lado e posição voltam certos', () => {
    const j = { b: ['Retrovisores', 'Limpador e Lavador'], z: [{ k: 'x', n: 3, l: [[0, 'Retrovisores Externos', 'E', 2, '4MLB1'], [1, 'Motores do Limpador', '-T', 1], [0, 'Capas', 'DT', 1]] as [number, string, string, number, string?][] }] };
    const [z] = lerRaioX(j);
    expect(z.l.map((l) => [l.tipo, l.lado, l.pos, l.foto])).toEqual([
      ['Retrovisores', 'E', undefined, '/estudio-400/MLB1.webp'], ['Limpador e Lavador', undefined, 'T', ''], ['Retrovisores', 'D', 'T', '']]);
  });
});

describe.skipIf(!existsSync(buscaArq))('"Ver as peças da frente": as peças da zona', () => {
  const ix = JSON.parse(readFileSync(buscaArq, 'utf-8')) as Indice;
  const b = new Busca(ix);
  const procurar = b.procurar.bind(b);
  it('a lista da zona tem o mesmo tamanho da conta, sem repetir, das mais novas para as mais antigas', () => {
    const contas = contarZonas(procurar);
    for (const z of ZONAS) {
      const l = pecasDaZona(procurar, {}, z);
      expect(l.length, z.nome).toBe(contas.find((c) => c.k === z.k)!.n);
      expect(new Set(l.map((it) => it.id)).size).toBe(l.length);
      for (let i = 1; i < l.length; i++) expect(l[i - 1].id.length > l[i].id.length || (l[i - 1].id.length === l[i].id.length && l[i - 1].id >= l[i].id)).toBe(true);
    }
  });
  it('o arquivo das mais novas (/dados/raio-x.json) tem as 12 primeiras de cada zona, na ordem', async () => {
    const { GET } = await import('../pages/dados/raio-x.json');
    const sub = await (GET as unknown as () => Response)().json();
    const itens = new Busca(sub).itens;
    for (const z of ZONAS) {
      const ids = (sub.zonas[z.k] as number[]).map((i) => itens[i].id);
      expect(ids, z.nome).toEqual(pecasDaZona(procurar, {}, z).slice(0, NA_GALERIA).map((it) => it.id));
    }
  });
});

describe('a zona de cada peça (o "Onde fica" da página da peça)', () => {
  const ix = JSON.parse(readFileSync(buscaArq, 'utf-8')) as Indice;
  const b = new Busca(ix);
  it('é a MESMA conta do painel: as peças de cada zona pela busca do catálogo = as peças cuja zona é ela (estoque inteiro)', () => {
    const daPeca = new Map<string, string[]>();
    for (const it of b.itens) daPeca.set(it.id, zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).map((z) => z.k));
    for (const z of ZONAS) {
      const pelaBusca = pecasDaZona((f) => b.procurar(f), {}, z).map((it) => it.id).sort();
      const pelaPeca = b.itens.filter((it) => daPeca.get(it.id)!.includes(z.k)).map((it) => it.id).sort();
      expect(pelaPeca, z.k).toEqual(pelaBusca);
    }
  });
  it('quase todo o estoque tem zona (94%+), e só a peça que serve na frente e atrás tem duas', () => {
    let com = 0;
    const duas: string[] = [];
    for (const it of b.itens) {
      const zs = zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos });
      if (zs.length) com++;
      if (zs.length > 1) {
        duas.push(`${it.n}: ${zs.map((z) => z.k).join('+')}`);
        expect(it.pos, it.n).toBe('A');
        expect(zs.map((z) => z.k)).toEqual(['frente', 'traseira']);
      }
    }
    expect(com / b.itens.length).toBeGreaterThan(0.94);
    expect(duas.length).toBeLessThan(10);
  });
  it('exemplos: farol na frente, lanterna na traseira, retrovisor esquerdo na lateral esquerda, sem lado = sem zona', () => {
    const k = (p: Parameters<typeof zonasDaPeca>[0]) => zonasDaPeca(p).map((z) => z.k);
    expect(k({ c: 'Faróis e Lanternas', s: 'Faróis', l: 'E' })).toEqual(['frente']);
    expect(k({ c: 'Faróis e Lanternas', s: 'Lanternas Traseiras', l: 'D', pos: 'T' })).toEqual(['traseira']);
    expect(k({ c: 'Retrovisores', s: 'Retrovisores Externos', l: 'E' })).toEqual(['lateral-esquerda']);
    expect(k({ c: 'Retrovisores', s: 'Retrovisores Externos', l: 'D' })).toEqual(['lateral-direita']);
    expect(k({ c: 'Retrovisores', s: 'Retrovisores Externos' })).toEqual([]);
    expect(k({ c: 'Motor', s: 'Coxins do Motor' })).toEqual(['motor']);
    expect(k({ c: 'Outros', s: 'Outros' })).toEqual([]);
    for (const z of ZONAS) expect(z.fica.length).toBeGreaterThan(5);
  });
});

describe('o "Onde fica" e a página do carro', () => {
  it('o link só aponta para o Raio-x do carro quando a página dele tem o Raio-x (o MESMO limite nos dois arquivos)', () => {
    const limite = (arq: string) => Number(/RAIO_X_A_PARTIR_DE = (\d+)/.exec(readFileSync(arq, 'utf-8'))?.[1]);
    expect(limite('src/components/peca/OndeFica.astro')).toBeGreaterThan(0);
    expect(limite('src/components/peca/OndeFica.astro')).toBe(limite('src/pages/carros/[k].astro'));
  });
  it('o endereço #raio-x=<zona> usa as chaves das zonas (só letras minúsculas e hífen)', () => {
    for (const z of ZONAS) expect(z.k).toMatch(/^[a-z-]+$/);
  });
});
