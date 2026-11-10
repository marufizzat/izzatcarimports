import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Busca, capaItem, fotoCartao, LARGURAS_CAPA, SIZES_CARTAO, type Indice, type Item } from './busca';
import { cartaoHtml } from './vendidaCartoes';
// o script do build (scripts/capas-cartao.mjs) e o site usam as mesmas larguras
import { capasCartao, LARGURAS } from '../../scripts/capas-cartao.mjs';

const item = (o: Partial<Item>): Item => ({
  k: 0, id: 'MLB1', t: '', n: 'Retrovisor', p: 100, i: '123-MLB1_012026', h: 'retrovisor-MLB1', f: false, b: 'Volvo', m: 'XC60',
  y: [2018, 2024], c: '', s: '', o: '', e: '1', ...o,
});

describe('foto do cartão (capas leves de 400/640 px)', () => {
  it('as larguras do script do build e do site são as mesmas', () => {
    expect([...LARGURAS_CAPA]).toEqual(LARGURAS);
  });
  it('capa com as leves em dia: srcset 400/640/inteira e o sizes do lugar; a inteira fica no src', () => {
    const f = fotoCartao(item({ r: 1 }), SIZES_CARTAO.grade);
    expect(f).toEqual({ src: '/estudio/MLB1.webp', estudio: true, sizes: SIZES_CARTAO.grade,
      srcset: '/estudio-400/MLB1.webp 400w, /estudio-640/MLB1.webp 640w, /estudio/MLB1.webp 1000w' });
    expect(fotoCartao(item({ e: '2', r: 1 }), 'x').srcset).toContain('/estudio-pro/MLB1.webp 1000w');
  });
  it('sem as leves (capa nova ainda não processada): só a capa inteira, sem srcset (nunca imagem quebrada)', () => {
    expect(fotoCartao(item({}), SIZES_CARTAO.grade)).toEqual({ src: '/estudio/MLB1.webp', estudio: true });
    expect(fotoCartao(item({ e: '2' }), 'x')).toEqual({ src: '/estudio-pro/MLB1.webp', estudio: true });
  });
  it('sem capa: a foto do ML em 3 tamanhos', () => {
    const f = fotoCartao(item({ e: '0', r: 1 }), 's');
    expect(f.src).toBe('https://http2.mlstatic.com/D_123-MLB1_012026-O.webp');
    expect(f.srcset).toContain('-V.webp 320w');
    expect(f.estudio).toBe(false);
  });
  it('miniatura das sugestões: a leve de 400 quando está em dia', () => {
    expect(capaItem(item({ r: 1 }), 'E')).toBe('/estudio-400/MLB1.webp');
    expect(capaItem(item({}), 'E')).toBe('/estudio/MLB1.webp');
    expect(capaItem(item({ r: 1 }))).toBe('/estudio/MLB1.webp');
  });
  it('o índice da busca leva o "r" ao item só quando é "1"', () => {
    const ix = { v: 1, updated: '', marcas: ['Volvo'], familias: [''], tipos: [''], id: ['MLB1', 'MLB2', 'MLB3'], t: ['', '', ''], n: ['a', 'b', 'c'],
      p: [1, 2, 3], i: ['x', 'y', 'z'], h: ['a', 'b', 'c'], f: '000', b: [0, 0, 0], m: ['XC60', 'XC60', 'XC60'], y: [0, 0, 0], c: [0, 0, 0], s: [0, 0, 0],
      o: ['', '', ''], e: '120', r: '100' } as unknown as Indice;
    expect(new Busca(ix).itens.map((it) => it.r)).toEqual([1, undefined, undefined]);
  });
  it('cartão do navegador: o sizes do lugar; com o índice do .map (a 404), o das parecidas', () => {
    const html = cartaoHtml(item({ r: 1 }), SIZES_CARTAO.grade);
    expect(html).toContain('srcset="/estudio-400/MLB1.webp 400w');
    expect(html).toContain(`sizes="${SIZES_CARTAO.grade}"`);
    expect([item({ r: 1 })].map(cartaoHtml)[0]).toContain(`sizes="${SIZES_CARTAO.parecidas}"`);
    expect(cartaoHtml(item({}))).not.toContain('srcset');
  });
});

let sharp: unknown = null;
try { sharp = (await import('sharp')).default; } catch { /* sem o sharp, só as regras acima */ }

describe.skipIf(!sharp)('scripts/capas-cartao.mjs (o build)', () => {
  it('faz as leves da capa atual (a maquiada manda), refaz a trocada, apaga a de peça sem capa e grava o "r"', async () => {
    const s = sharp as typeof import('sharp');
    const raiz = mkdtempSync(join(tmpdir(), 'capas-cartao-'));
    const pub = join(raiz, 'public');
    for (const p of ['estudio', 'estudio-pro', 'dados']) mkdirSync(join(pub, p), { recursive: true });
    const capa = (cor: string, w = 1000) => s({ create: { width: w, height: w, channels: 3, background: cor } }).webp().toBuffer();
    writeFileSync(join(pub, 'estudio', 'MLB1.webp'), await capa('#808080'));
    writeFileSync(join(pub, 'estudio', 'MLB2.webp'), await capa('#808080'));
    writeFileSync(join(pub, 'estudio-pro', 'MLB2.webp'), await capa('#ff0000'));
    writeFileSync(join(pub, 'estudio', 'MLB3.webp'), await capa('#00ff00', 500)); // pequena: sem leve
    writeFileSync(join(pub, 'dados', 'busca.json'), JSON.stringify({ id: ['MLB1', 'MLB2', 'MLB3', 'MLB4'], e: '1210' }));
    const log = () => {};
    let r = await capasCartao({ raiz, log });
    expect(r.feitas).toBe(2);
    const leve = (w: number, id: string) => join(pub, `estudio-${w}`, `${id}.webp`);
    expect(LARGURAS.every((w) => existsSync(leve(w, 'MLB1')) && existsSync(leve(w, 'MLB2')))).toBe(true);
    expect(existsSync(leve(400, 'MLB3'))).toBe(false);
    expect((await s(readFileSync(leve(640, 'MLB2'))).metadata()).width).toBe(640);
    // a da maquiada (vermelha), não a da automática
    const { data } = await s(readFileSync(leve(400, 'MLB2'))).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(200);
    expect(JSON.parse(readFileSync(join(pub, 'dados', 'busca.json'), 'utf-8')).r).toBe('1100');
    // nada mudou: nada refeito
    r = await capasCartao({ raiz, log });
    expect([r.feitas, r.iguais]).toEqual([0, 2]);
    // capa trocada: a leve é refeita; peça sem capa: a leve sai
    writeFileSync(join(pub, 'estudio', 'MLB1.webp'), await capa('#0000ff'));
    unlinkSync(join(pub, 'estudio-pro', 'MLB2.webp'));
    unlinkSync(join(pub, 'estudio', 'MLB2.webp'));
    writeFileSync(join(pub, 'dados', 'busca.json'), JSON.stringify({ id: ['MLB1', 'MLB2'], e: '10' }));
    r = await capasCartao({ raiz, log });
    expect(r.feitas).toBe(1);
    expect(existsSync(leve(400, 'MLB2'))).toBe(false);
    const azul = await s(readFileSync(leve(400, 'MLB1'))).raw().toBuffer();
    expect(azul[2]).toBeGreaterThan(200);
    // o "e" diz maquiada mas a leve é da automática: sem "r" (o cartão usa a capa inteira)
    writeFileSync(join(pub, 'dados', 'busca.json'), JSON.stringify({ id: ['MLB1'], e: '2' }));
    await capasCartao({ raiz, log });
    expect(JSON.parse(readFileSync(join(pub, 'dados', 'busca.json'), 'utf-8')).r).toBe('0');
    rmSync(raiz, { recursive: true, force: true });
  });
});
