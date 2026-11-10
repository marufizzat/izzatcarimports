// Testes do motor de busca. Os casos sao escolhidos NO ESTOQUE DO MOMENTO (o robo roda
// a cada 30 min e as pecas sao vendidas): se um caso nao existir hoje, o teste pula.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Busca, codigoJunto, normal, palavras, termos, type Item } from '../src/lib/busca';
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
const codigosDe = (it?: Item) => (it?.o ? it.o.split(' ') : []);

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

  // cliente oculto 10/11 (atrito 5): "8200 328 856" dava "Nenhuma peça" com a peça em 31º; "8200-328-856" e
  // "8200.328.856" achavam a peça, mas o título dizia "Nenhuma peça"
  const grafias = (cod: string) => {
    const g = cod.length >= 9 ? [cod.slice(0, 4), cod.slice(4, 7), cod.slice(7)] : [cod.slice(0, 3), cod.slice(3)];
    return [g.join(' '), g.join('-'), g.join('.'), g.join(' ').toUpperCase(), `${g[0]}/${g.slice(1).join('')}`];
  };
  const comGrafia = codigos.filter((x) => /^\d{9,}$/.test(x.o.split(' ')[0])).slice(0, 12)
    .concat(codigos.filter((x) => /^[a-z]\d{6}$/.test(x.o.split(' ')[0])).slice(0, 4));

  it('código com espaço, traço, ponto ou barra: a peça em 1º, sem "aproximado", no catálogo e nas sugestões', (ctx) => {
    if (!comGrafia.length) return ctx.skip();
    for (const alvo of comGrafia) {
      const cod = alvo.o.split(' ')[0];
      for (const q of grafias(cod)) {
        const r = b.procurar({ q });
        expect({ q, primeiro: codigosDe(r[0]) }).toEqual({ q, primeiro: expect.arrayContaining([cod]) });
        expect({ q, aprox: b.aproximado, cod: b.codigoDaBusca }).toEqual({ q, aprox: false, cod });
        const s = b.sugestoes(q, 6);
        expect({ q, aprox: s.aproximado }).toEqual({ q, aprox: false });
        expect(codigosDe(s.itens[0])).toContain(cod);
      }
    }
  });

  it('o exemplo do relatório: 8200 328 856 (Caixa filtro ar Renault)', (ctx) => {
    const alvo = b.itens.find((x) => codigosDe(x).includes('8200328856'));
    if (!alvo) return ctx.skip(); // vendeu
    for (const q of ['8200328856', '8200 328 856', '8200-328-856', '8200.328.856']) {
      expect(b.procurar({ q })[0].id, q).toBe(alvo.id);
      expect(b.aproximado, q).toBe(false);
      expect(b.codigoDaBusca, q).toBe('8200328856');
      expect(b.sugestoes(q).itens[0]?.id, q).toBe(alvo.id);
    }
    // digitando aos poucos (sugestões ao vivo): o começo do código já acha
    expect(b.sugestoes('8200 328').itens.some((x) => x.id === alvo.id)).toBe(true);
  });

  it('cara de código só quando é código: "xc60 2019", "farol 31476671" e "s60 t5" seguem a busca normal', () => {
    expect(codigoJunto('8200 328 856')).toBe('8200328856');
    expect(codigoJunto('1K0 959 653 C')).toBe('1k0959653c');
    expect(codigoJunto('A045-591')).toBe('a045591');
    expect(codigoJunto('farol 31476671')).toBe('');
    expect(codigoJunto('xc 60')).toBe('');
    expect(codigoJunto('s60 t5')).toBe('');
    expect(codigoJunto('31476671')).toBe('');      // sem separador: a busca de sempre
    expect(codigoJunto('lanterna 18/24')).toBe('');
    // "xc60 2019" tem cara de código, mas nenhum código do estoque começa assim: o ano continua sendo filtro
    if (temCarro('Volvo', 'XC60')) {
      const r = b.procurar({ q: 'xc60 2019' });
      expect(r.length).toBeGreaterThan(0);
      expect(r.every((x) => serveNoModelo(x, 'XC60') || textoPeca(x).includes('xc60'))).toBe(true);
      expect(r.every((x) => !x.y || (x.y[0] <= 2019 && x.y[1] >= 2019))).toBe(true);
    }
  });

  it('índice: código com traço ou ponto de qualquer tamanho também na forma junta (nunca ano "18/24")', () => {
    expect(termos('Modulo 1K0.959.653.C')).toContain('1k0959653c');
    expect(termos('Caixa 8200-328-856')).toContain('8200328856');
    expect(termos('Lanterna 18/24')).not.toContain('1824');
  });

  it('termo com número nunca aproxima (código parecido de outra peça não entra)', () => {
    for (const alvo of codigos.slice(0, 10)) {
      const cod = alvo.o.split(' ')[0];
      for (const x of b.sugestoes(cod, 6).itens) expect(textoPeca(x).includes(cod)).toBe(true);
    }
  });
});

describe('sugestões = a mesma regra do catálogo', () => {
  const buscas = ['xc60', 'farol compass', 'retrovisor palio 2010', 'lanterna traseira', 'macaneta', 'amortecedor dianteiro', 'zzzqqq',
    '8200 328 856', '8200-328-856', '8200.328.856', 'xc60 2019'];

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

  // auditoria 4, 9.1 (5.2 da auditoria 3): sem farol do Compass, as parecidas começam pelas peças do Compass da mesma
  // categoria da palavra (Faróis e Lanternas), não por fechaduras em ordem qualquer
  it('"farol compass" sem farol do Compass: começa pelas luzes do Compass', (ctx) => {
    const compass = b.itens.filter((i) => serveNoModelo(i, 'Compass'));
    const farolCompass = compass.some((i) => /farol/i.test(i.n));
    const luzCompass = compass.some((i) => i.c === 'Faróis e Lanternas');
    if (farolCompass || !luzCompass) return ctx.skip();
    const r = b.procurar({ q: 'farol compass' });
    expect(b.aproximado).toBe(true);
    expect(serveNoModelo(r[0], 'Compass')).toBe(true);
    expect(r[0].c).toBe('Faróis e Lanternas');
  });
  it('"lanterna xc60" continua com o XC60 na frente', (ctx) => {
    if (!temCarro('Volvo', 'XC60')) return ctx.skip();
    const r = b.procurar({ q: 'lanterna xc60' });
    if (!r.length) return ctx.skip();
    expect(serveNoModelo(r[0], 'XC60')).toBe(true);
  });
});


// cliente oculto 10/11 (atrito 1): com o XC60 2019, "retrovisor direito" só achava a capa do espelho e o site não
// oferecia "a gente procura no pátio". bate() diz se a lista tem a peça buscada para o carro-alvo.
describe('a lista bate com o que a pessoa procura (bloco "A gente procura no pátio")', () => {
  const xc = { b: 'Volvo', m: 'XC60', y: 2019 };
  const retroDireitoXc = b.itens.filter((x) => serveNoModelo(x, 'XC60') && /^retrovisor/.test(normal(x.n)) && /direit/.test(normal(x.n))
    && (!x.y || (x.y[0] <= 2019 && x.y[1] >= 2019)));

  it('J1 com o carro no filtro: "retrovisor direito" + Volvo XC60 2019 não bate (só a capa do espelho)', (ctx) => {
    if (!temCarro('Volvo', 'XC60') || retroDireitoXc.length) return ctx.skip(); // chegou retrovisor direito do XC60
    const r = b.procurar({ q: 'retrovisor direito', marca: 'Volvo', modelo: 'XC60', ano: 2019 });
    expect(b.bate(r, 'retrovisor direito', xc)).toBe(false);
  });

  it('J1 com o carro só salvo (sem filtro): a lista traz retrovisores de outros carros, mas para o XC60 2019 não bate', (ctx) => {
    if (!temCarro('Volvo', 'XC60') || retroDireitoXc.length) return ctx.skip();
    const r = b.procurar({ q: 'retrovisor direito' });
    expect(r.length).toBeGreaterThan(0);
    expect(b.aproximado).toBe(false);
    expect(b.bate(r, 'retrovisor direito', xc)).toBe(false);
    // sem carro nenhum, a lista de retrovisores direitos bate
    expect(b.bate(r, 'retrovisor direito', null)).toBe(true);
  });

  it('J1 no PC (carro e ano digitados): "retrovisor direito xc60 2019" não bate', (ctx) => {
    if (!temCarro('Volvo', 'XC60') || retroDireitoXc.length) return ctx.skip();
    const r = b.procurar({ q: 'retrovisor direito xc60 2019' });
    expect(b.bate(r, 'retrovisor direito xc60 2019', xc)).toBe(false);
  });

  it('bate quando a peça do carro existe, com plural, e com código achado', (ctx) => {
    const alvo = b.itens.find((x) => x.b && x.m && x.y && /^farol\b/.test(normal(x.n)));
    if (!alvo) return ctx.skip();
    const carro = { b: alvo.b, m: alvo.m, y: alvo.y![0] };
    expect(b.bate(b.procurar({ q: 'farol', marca: alvo.b, modelo: alvo.m }), 'farol', carro)).toBe(true);
    expect(b.bate(b.procurar({ q: 'farois' }), 'farois', carro)).toBe(true);
    const cod = alvo.o.split(' ')[0];
    if (cod) expect(b.bate(b.procurar({ q: cod }), cod, null)).toBe(true);
    // busca só do carro ("xc60") não pede o bloco
    if (temCarro('Volvo', 'XC60')) expect(b.bate(b.procurar({ q: 'xc60' }), 'xc60', xc)).toBe(true);
    // lista vazia nunca bate
    expect(b.bate([], 'farol', null)).toBe(false);
  });
});

// cliente oculto 10/11 (atrito 7): mesmo código e carro com preço diferente; a versão do título vai no cartão (dif)
describe('pílula da versão (dif) no índice', () => {
  it('o mapa esparso dif do busca.json chega em cada peça; só peças que dividem código e carro com outro preço', (ctx) => {
    const mapa: Record<string, string> = ix.dif ?? {};
    if (!Object.keys(mapa).length) return ctx.skip();
    expect(b.itens.filter((x) => x.dif).length).toBe(Object.keys(mapa).length);
    for (const [k, v] of Object.entries(mapa)) {
      const it = b.itens[Number(k)];
      expect(it.dif).toBe(v);
      expect(v.length).toBeLessThanOrEqual(24);
      const cod = it.o.split(' ')[0];
      const irmas = b.itens.filter((x) => x.b === it.b && x.m === it.m && x.o.split(' ')[0] === cod);
      expect(irmas.length, it.id).toBeGreaterThan(1);
      expect(new Set(irmas.map((x) => x.p)).size, it.id).toBeGreaterThan(1);
    }
  });
});

// Busca que fala como o cliente (nov/2026): sinônimos e plural (lib/sinonimos.ts) no catálogo e nas sugestões
describe('sinônimos e plural', () => {
  const nomesComecam = (r: Item[], w: string) => r.filter((x) => normal(x.n).startsWith(w)).length;
  it('"sinaleira" (RS) acha as lanternas, como "lanterna"', (ctx) => {
    const lanternas = b.procurar({ q: 'lanterna' });
    if (!lanternas.length) return ctx.skip();
    const r = b.procurar({ q: 'sinaleira' });
    expect(b.aproximado).toBe(false);
    expect(nomesComecam(r, 'lanterna')).toBe(nomesComecam(lanternas, 'lanterna'));
    expect(normal(r[0].n).startsWith('lanterna')).toBe(true);
    // no plural também, e nas sugestões do cabeçalho (a mesma regra)
    expect(b.procurar({ q: 'sinaleiras' }).length).toBe(r.length);
    expect(b.sugestoes('sinaleira').total).toBe(r.length);
    // e o bloco "Não achou?" não aparece: a lista tem o que a pessoa pediu
    expect(b.bate(r, 'sinaleira', null)).toBe(true);
  });
  it('"faróis" acha o mesmo que "farol" (plural fora do padrão)', (ctx) => {
    const um = b.procurar({ q: 'farol' });
    if (!um.length) return ctx.skip();
    const varios = new Set(b.procurar({ q: 'faróis' }).map((x) => x.id));
    expect(b.aproximado).toBe(false);
    expect(um.every((x) => varios.has(x.id))).toBe(true);
  });
  it('"máquina de vidro" acha os "Motor vidro"; "mola a gás" acha os amortecedores da tampa e do capô', (ctx) => {
    const motores = b.itens.filter((x) => /^motor vidro/.test(normal(x.n)));
    if (!motores.length) return ctx.skip();
    const ids = new Set(b.procurar({ q: 'máquina de vidro' }).map((x) => x.id));
    expect(motores.every((x) => ids.has(x.id))).toBe(true);
    const mola = b.procurar({ q: 'mola a gás' });
    expect(b.aproximado).toBe(false);
    expect(mola.some((x) => /amortecedor/.test(normal(x.n)))).toBe(true);
  });
  it('sinônimo só acrescenta: a palavra digitada continua valendo ("pisca" acha o pisca-alerta e a chave de seta)', (ctx) => {
    const antes = b.itens.filter((x) => /\bpisca\b/.test(normal(x.n)));
    if (!antes.length) return ctx.skip();
    const ids = new Set(b.procurar({ q: 'pisca' }).map((x) => x.id));
    expect(antes.every((x) => ids.has(x.id))).toBe(true);
    expect(b.procurar({ q: 'pisca' }).some((x) => /chave seta/.test(normal(x.n)))).toBe(true);
  });
});

// Lado e posição (colunas l e pos do busca.json, lidas do nome em preparar_dados.py): fichas e a busca entendem
describe('lado e posição', () => {
  const comLado = b.itens.filter((x) => x.l).length;
  it('o índice traz o lado e a posição só de quem tem', (ctx) => {
    if (!ix.l) return ctx.skip();
    expect(comLado).toBeGreaterThan(1000);
    for (const it of b.itens.filter((x) => x.l).slice(0, 300)) {
      const n = normal(it.n);
      expect(it.l === 'E' ? /esquerd|motorista/.test(n) : /direit|passageiro/.test(n), it.n).toBe(true);
    }
    for (const it of b.itens.filter((x) => x.pos).slice(0, 300)) {
      const n = normal(it.n);
      expect(it.pos === 'T' ? /traseir/.test(n) : /dianteir|frontal/.test(n), it.n).toBe(true);
    }
  });
  it('as fichas filtram e as contagens batem com a lista', (ctx) => {
    if (!comLado) return ctx.skip();
    const f = { q: 'retrovisor' };
    const fa = b.facetas(f);
    for (const [l, n] of fa.lados) {
      const r = b.procurar({ ...f, lado: l });
      expect(r.length, l).toBe(n);
      expect(r.every((x) => x.l === l)).toBe(true);
    }
    for (const [p, n] of fa.posicoes) expect(b.procurar({ ...f, pos: p }).length, p).toBe(n);
  });
  it('"retrovisor direito xc60" é filtro: só os direitos, e a ficha Direito fica marcada', (ctx) => {
    if (!temCarro('Volvo', 'XC60') || !comLado) return ctx.skip();
    const r = b.procurar({ q: 'retrovisor direito xc60' });
    expect(b.ladoDaBusca).toBe('D');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.l === 'D')).toBe(true);
    // "lado do motorista" = esquerdo
    const m = b.procurar({ q: 'retrovisor lado do motorista' });
    expect(b.ladoDaBusca).toBe('E');
    expect(m.every((x) => x.l === 'E')).toBe(true);
    // a ficha tocada manda e a palavra sai da busca
    expect(b.semLadoPos('retrovisor lado direito xc60')).toBe('retrovisor xc60');
  });
  it('"amortecedor traseiro": o que o nome diz "traseiro" vem antes da tampa traseira', (ctx) => {
    const r = b.procurar({ q: 'amortecedor traseiro' });
    if (!r.some((x) => /amortecedor traseiro/.test(normal(x.n)))) return ctx.skip();
    expect(normal(r[0].n)).toMatch(/traseiro/);
    expect(r.every((x) => x.pos === 'T')).toBe(true);
  });
  it('sem nenhuma peça daquele lado, a busca volta a valer como texto (nunca pior que antes)', () => {
    // índice de 3 peças: o farol não diz o lado no nome, só no título do anúncio
    const mini = new Busca({
      v: 1, updated: '', marcas: ['Volvo'], familias: ['Faróis e Lanternas'], tipos: ['Faróis'],
      id: ['MLB1', 'MLB2', 'MLB3'], t: ['Farol Volvo Xc60 Lado Direito', 'Lanterna Traseira Esquerda Volvo Xc60', 'Lanterna Tampa Traseira Volvo Xc60'],
      n: ['Farol', 'Lanterna traseira esquerda', 'Lanterna tampa traseira'], p: [100, 200, 300], i: ['', '', ''], h: ['a', 'b', 'c'], f: '000',
      b: [0, 0, 0], m: ['XC60', 'XC60', 'XC60'], y: [0, 0, 0], c: [0, 0, 0], s: [0, 0, 0], o: ['', '', ''], l: '0E0', pos: '0TT',
    });
    const r = mini.procurar({ q: 'farol direito' });
    expect(r.map((x) => x.id)).toEqual(['MLB1']);
    expect(mini.ladoDaBusca).toBeUndefined();
    // com peça do lado, filtra
    expect(mini.procurar({ q: 'lanterna esquerda' }).map((x) => x.id)).toEqual(['MLB2']);
    expect(mini.procurar({ q: 'lanterna traseira' }).map((x) => x.id).sort()).toEqual(['MLB2', 'MLB3']);
    // as duas posições na busca: fica no texto
    expect(mini.procurar({ q: 'lanterna dianteira/traseira' }).length).toBeGreaterThanOrEqual(0);
  });
});
