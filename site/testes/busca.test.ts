// Testes do motor de busca. Os casos sao escolhidos NO ESTOQUE DO MOMENTO (o robo roda
// a cada 30 min e as pecas sao vendidas): se um caso nao existir hoje, o teste pula.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Busca, normal } from '../src/lib/busca';

const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8'));
const b = new Busca(ix);

describe('busca do catalogo', () => {
  it('codigo de carro separado por espaco ("Xc 60") acha pela forma junta ("xc60")', (ctx) => {
    const alvo = b.itens.find((i) => /\b[a-z]{1,3} \d{2,3}\b/i.test(i.t) && /\b([a-z]{1,3}) (\d{2,3})\b/i.test(i.t));
    if (!alvo) return ctx.skip();
    const [, l, n] = alvo.t.match(/\b([a-z]{1,3}) (\d{2,3})\b/i)!;
    const r = b.procurar({ q: `${l}${n}` });
    expect(r.some((x) => x.id === alvo.id)).toBe(true);
  });

  it('acha pelo codigo gravado (OEM) sem hifen', (ctx) => {
    const alvo = b.itens.find((x) => x.o && x.o.split(' ')[0].length >= 7);
    if (!alvo) return ctx.skip();
    expect(b.procurar({ q: alvo.o.split(' ')[0] }).some((x) => x.id === alvo.id)).toBe(true);
  });

  it('tolera erro de digitacao', (ctx) => {
    const conta = new Map<string, number>();
    for (const i of b.itens) for (const w of normal(i.n).split(/\s+/)) if (/^[a-z]{8,}$/.test(w)) conta.set(w, (conta.get(w) || 0) + 1);
    const palavra = [...conta.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
    if (!palavra) return ctx.skip();
    const errada = palavra.slice(0, 4) + palavra.slice(5); // tira uma letra do meio
    expect(b.procurar({ q: errada }).length).toBeGreaterThan(0);
  });

  it('filtro de marca, modelo e ano', (ctx) => {
    const alvo = b.itens.find((i) => i.b && i.m && i.y);
    if (!alvo) return ctx.skip();
    const ano = alvo.y![0];
    const r = b.procurar({ marca: alvo.b, modelo: alvo.m, ano });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.b === alvo.b && x.m === alvo.m && x.y && x.y[0] <= ano && x.y[1] >= ano)).toBe(true);
  });

  it('ano solto na busca vira filtro', (ctx) => {
    const alvo = b.itens.find((i) => i.m && /^[A-Za-z]{4,}$/.test(i.m) && i.y);
    if (!alvo) return ctx.skip();
    const ano = alvo.y![0];
    const r = b.procurar({ q: `${alvo.m} ${ano}` });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => !x.y || (x.y[0] <= ano && x.y[1] >= ano))).toBe(true);
  });

  it('ordem por preco', () => {
    const marca = b.itens.find((i) => i.b)?.b;
    const r = b.procurar({ marca, ordem: 'asc' });
    for (let i = 1; i < r.length; i++) expect(r[i].p).toBeGreaterThanOrEqual(r[i - 1].p);
  });
});
