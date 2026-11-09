// Testes do motor de busca. Os casos sao escolhidos NO ESTOQUE DO MOMENTO (o robo roda
// a cada 30 min e as pecas sao vendidas): se um caso nao existir hoje, o teste pula.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Busca, normal, palavras, termos, type Item } from '../src/lib/busca';
import { serveNoModelo, anosNoModelo, modelosDa } from '../src/lib/meuCarro';

const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8'));
const b = new Busca(ix);

// carro com mais peças no estoque (hoje, Volvo XC60)
const porCarro = new Map<string, Item[]>();
for (const it of b.itens) for (const m of modelosDa(it)) if (it.b) porCarro.set(`${it.b}|${m}`, [...(porCarro.get(`${it.b}|${m}`) || []), it]);
const carrosOrdem = [...porCarro.entries()].sort((a, c) => c[1].length - a[1].length);
const temCarro = (marca: string, modelo: string) => porCarro.has(`${marca}|${modelo}`);
const junto = (s: string) => palavras(s).join('');
/** o texto da peça (carro, título e código), sem espaço nem pontuação */
const textoPeca = (it: Item) => junto(`${it.b} ${it.m} ${it.t} ${it.o}`);

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
    // a peça de 2+ carros entra pelo ms, com a faixa de anos daquele carro
    expect(r.every((x) => {
      const y = anosNoModelo(x, alvo.m);
      return x.b === alvo.b && serveNoModelo(x, alvo.m) && !!y && y[0] <= ano && y[1] >= ano;
    })).toBe(true);
  });

  it('peça de 2 carros ("Volvo S60 Xc60") aparece no filtro de cada um e conta nos dois modelos', (ctx) => {
    const alvo = b.itens.find((i) => i.ms && i.ms.length > 1);
    if (!alvo) return ctx.skip();
    for (const m of alvo.ms!) {
      expect(b.procurar({ marca: alvo.b, modelo: m }).some((x) => x.id === alvo.id), m).toBe(true);
    }
    const modelos = new Map(b.facetas({ marca: alvo.b }).modelos);
    const sozinhos = (m: string) => b.itens.filter((x) => x.b === alvo.b && (x.ms ?? [x.m]).includes(m)).length;
    for (const m of alvo.ms!) expect(modelos.get(m), m).toBe(sozinhos(m));
    // nunca dois do mesmo carro na lista
    expect(new Set(alvo.ms).size).toBe(alvo.ms!.length);
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

describe('relevancia: o modelo exato vem primeiro', () => {
  it('"xc60": 1º lugar é Volvo XC60, nas sugestões e no catálogo, e nada de peça de outro carro por aproximação', (ctx) => {
    if (!temCarro('Volvo', 'XC60')) return ctx.skip();
    const cat = b.procurar({ q: 'xc60' });
    const sug = b.sugestoes('xc60', 6);
    expect(cat[0].b).toBe('Volvo'); expect(serveNoModelo(cat[0], 'XC60')).toBe(true);
    expect(sug.itens.every((x) => x.b === 'Volvo' && serveNoModelo(x, 'XC60'))).toBe(true);
    // termo com número nunca é aproximado: toda peça achada tem "xc60" de verdade (carro, título ou código)
    expect(cat.every((x) => textoPeca(x).includes('xc60'))).toBe(true);
    // as do carro (também as de 2 carros, "S60 XC60") abrem a lista, sem nenhuma de outro modelo no meio
    const nXc = cat.findIndex((x) => !serveNoModelo(x, 'XC60'));
    expect(cat.slice(nXc === -1 ? cat.length : nXc).every((x) => !serveNoModelo(x, 'XC60'))).toBe(true);
    expect(nXc === -1 ? cat.length : nXc).toBe(porCarro.get('Volvo|XC60')!.length);
  });

  it('"xc 60", "XC-60" e "xc60" dão a mesma lista', (ctx) => {
    if (!temCarro('Volvo', 'XC60')) return ctx.skip();
    const a = b.procurar({ q: 'xc60' }).map((x) => x.id).sort();
    expect(b.procurar({ q: 'xc 60' }).map((x) => x.id).sort()).toEqual(a);
    expect(b.procurar({ q: 'XC-60' }).map((x) => x.id).sort()).toEqual(a);
  });

  it('o carro com mais peças vem primeiro quando se digita só o modelo (e as sugestões oferecem o carro)', (ctx) => {
    const [chave, lista] = carrosOrdem[0] ?? [];
    if (!chave) return ctx.skip();
    const [marca, modelo] = chave.split('|');
    const r = b.procurar({ q: modelo });
    expect(r.slice(0, Math.min(20, lista.length)).every((x) => x.b === marca && serveNoModelo(x, modelo))).toBe(true);
    const s = b.sugestoes(modelo, 6);
    expect(s.atalhos[0]?.tipo).toBe('carro');
    expect(s.atalhos[0]?.n).toBe(lista.length);
    expect(s.atalhos[0]?.href).toBe(`/catalogo.html?${new URLSearchParams({ marca, modelo })}`);
    // o número do atalho é o mesmo que o catálogo mostra com o filtro do carro
    expect(b.procurar({ marca, modelo }).length).toBe(lista.length);
  });

  it('"compass": só Jeep Compass no topo e o atalho do carro', (ctx) => {
    if (!temCarro('Jeep', 'Compass')) return ctx.skip();
    const r = b.procurar({ q: 'compass' });
    const n = porCarro.get('Jeep|Compass')!.length;
    expect(r.slice(0, n).every((x) => x.b === 'Jeep' && serveNoModelo(x, 'Compass'))).toBe(true);
    expect(b.sugestoes('compass').atalhos[0]?.rot).toBe('Jeep Compass');
  });

  it('"farol compass" sem farol do Compass: aproximado, com as do Jeep Compass primeiro (catálogo e sugestões iguais)', (ctx) => {
    if (!temCarro('Jeep', 'Compass')) return ctx.skip();
    const r = b.procurar({ q: 'farol compass' });
    const exatas = r.filter((x) => serveNoModelo(x, 'Compass') && /farol/.test(normal(x.t)));
    if (exatas.length) return ctx.skip(); // chegou farol do Compass: o caso não vale hoje
    expect(b.aproximado).toBe(true);
    const n = porCarro.get('Jeep|Compass')!.length;
    expect(b.nDoCarro).toBe(n);
    expect(r.slice(0, n).every((x) => serveNoModelo(x, 'Compass'))).toBe(true);
    const s = b.sugestoes('farol compass');
    expect(s.aproximado).toBe(true);
    expect(s.total).toBe(r.length);
    expect(s.itens.length).toBeGreaterThan(0);
    expect(serveNoModelo(s.itens[0], 'Compass')).toBe(true);
  });

  it('o nome da peça que começa pela palavra buscada vem antes ("farol": Farol… antes de Interruptor farol)', (ctx) => {
    const r = b.procurar({ q: 'farol' });
    const comeca = r.filter((x) => normal(x.n).startsWith('farol'));
    if (!comeca.length || comeca.length === r.length) return ctx.skip();
    expect(normal(r[0].n).startsWith('farol')).toBe(true);
  });
});

describe('relevancia: códigos gravados', () => {
  const codigos = b.itens.filter((x) => /^[a-z0-9]{7,}$/.test(x.o.split(' ')[0] || '') && /\d/.test(x.o)).slice(0, 40);

  it('o código exato traz a peça em 1º lugar (catálogo e sugestões)', (ctx) => {
    if (!codigos.length) return ctx.skip();
    for (const alvo of codigos) {
      const cod = alvo.o.split(' ')[0];
      const r = b.procurar({ q: cod });
      const s = b.sugestoes(cod, 6);
      expect(r.findIndex((x) => x.o.split(' ').includes(cod))).toBe(0);
      expect(s.itens[0] && s.itens[0].o.split(' ').includes(cod)).toBe(true);
    }
  });

  it('código com hífen ou espaço ("A045-591", "a045 591") acha a mesma peça', (ctx) => {
    const alvo = b.itens.find((x) => x.o === 'a045591') ?? codigos.find((x) => /^[a-z]\d{6,}$/.test(x.o.split(' ')[0]));
    if (!alvo) return ctx.skip();
    const cod = alvo.o.split(' ')[0];
    const comHifen = `${cod.slice(0, 4)}-${cod.slice(4)}`.toUpperCase();
    expect(b.procurar({ q: comHifen }).some((x) => x.id === alvo.id)).toBe(true);
  });

  it('termo com número nunca aproxima (código parecido de outra peça não entra)', () => {
    for (const alvo of codigos.slice(0, 10)) {
      const cod = alvo.o.split(' ')[0];
      for (const x of b.sugestoes(cod, 6).itens) expect(textoPeca(x).includes(cod)).toBe(true);
    }
  });
});

describe('sugestões = a mesma regra do catálogo', () => {
  const buscas = ['xc60', 'farol compass', 'retrovisor palio 2010', 'lanterna traseira', 'macaneta', 'amortecedor dianteiro', 'zzzqqq'];

  it('mesmo total e mesma ordem do catálogo', () => {
    for (const q of buscas) {
      const cat = b.procurar({ q });
      const aprox = b.aproximado;
      const s = b.sugestoes(q, 6);
      expect({ q, total: s.total, aprox: s.aproximado }).toEqual({ q, total: cat.length, aprox });
      expect(s.itens.map((x) => x.id)).toEqual(cat.slice(0, 6).map((x) => x.id));
    }
  });

  it('ano solto também filtra nas sugestões ("retrovisor palio 2010")', (ctx) => {
    const s = b.sugestoes('retrovisor palio 2010');
    if (!s.total) return ctx.skip();
    expect(s.itens.every((x) => x.y && x.y[0] <= 2010 && x.y[1] >= 2010)).toBe(true);
  });

  it('busca sem nada parecido: zero, sem atalho', () => {
    const s = b.sugestoes('zzzqqq');
    expect(s.total).toBe(0);
    expect(s.atalhos).toEqual([]);
  });

  it('a palavra pela metade já sugere (busca ao vivo: "lantern")', (ctx) => {
    if (!b.itens.some((x) => normal(x.n).startsWith('lanterna'))) return ctx.skip();
    expect(b.sugestoes('lantern').itens.length).toBeGreaterThan(0);
  });
});

describe('facetas', () => {
  it('anos só com peça, do mais novo ao mais velho, e a contagem bate com o filtro de ano', () => {
    const fa = b.facetas({});
    expect(fa.anos.length).toBeGreaterThan(0);
    for (let i = 1; i < fa.anos.length; i++) expect(fa.anos[i][0]).toBeLessThan(fa.anos[i - 1][0]);
    expect(fa.anos.every(([, n]) => n > 0)).toBe(true);
    const [ano, n] = fa.anos[Math.floor(fa.anos.length / 2)];
    expect(b.procurar({ ano }).length).toBe(n);
  });
});

describe('subtipo (sub=): o atalho "Por tipo" da categoria abre o mesmo número', () => {
  it('tipo + sub conta o mesmo que o cartão da página da categoria (campo s), e a faceta mostra os subtipos', (ctx) => {
    const familia = b.itens.find((i) => i.c && i.s)?.c;
    if (!familia) return ctx.skip();
    const daFamilia = b.itens.filter((i) => i.c === familia);
    const subs = new Map<string, number>();
    for (const it of daFamilia) if (it.s) subs.set(it.s, (subs.get(it.s) || 0) + 1);
    for (const [sub, n] of subs) expect(b.procurar({ tipo: familia, sub }).length, sub).toBe(n);
    expect(new Map(b.facetas({ tipo: familia }).subs)).toEqual(subs);
    // sem o sistema, não há lista de subtipos
    expect(b.facetas({}).subs).toEqual([]);
  });

  it('o exemplo da auditoria: Iluminação + Lanternas Traseiras', (ctx) => {
    const n = b.itens.filter((i) => i.c === 'Iluminação' && i.s === 'Lanternas Traseiras').length;
    if (!n) return ctx.skip();
    expect(b.procurar({ tipo: 'Iluminação', sub: 'Lanternas Traseiras' }).length).toBe(n);
  });
});

describe('termos do índice', () => {
  it('forma junta de "xc 60", "XC-60" e "Para-choque"', () => {
    expect(termos('Volvo Xc 60')).toContain('xc60');
    expect(termos('XC-60')).toContain('xc60');
    expect(termos('Para-choque dianteiro')).toContain('parachoque');
    expect(termos('Lanterna 18/24')).not.toContain('1824');
  });
});
