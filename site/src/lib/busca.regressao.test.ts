// Tabela de regressão da busca (rodada 14, cliente oculto 10/11, atrito 6), em duas partes:
//
//  1. AS REGRAS NO ESTOQUE DO DIA (public/dados/busca.json, o que o robô acabou de gerar). O gabarito de cada consulta sai,
//     por regra, do próprio estoque testado (lib/busca.regressao.ts): a 1ª peça tem de ser do tipo, do carro e do lado
//     pedidos; quando a peça não existe, nada pode aparecer como achado (zero, ou parecida da família com o aviso). São
//     invariantes: valem com qualquer estoque. NADA nesta parte pode citar uma peça, um carro que "tem" alguma coisa ou
//     uma contagem: o robô roda isto a cada 30 min e uma venda não pode travar a loja (11/11/2026: a última lanterna do
//     XC60 vendeu e a rodada 14 foi recusada). A prova: `node scripts/estoque-perturbado.mjs` (30 estoques mexidos).
//
//  2. OS CASOS ESCRITOS À MÃO (os do cliente oculto e os da revisão), que citam peças: rodam no ESTOQUE CONGELADO de
//     09/11/2026 (testes/fixtures/estoque-busca.json), que não muda. Guardam o motor contra mudança de código.
//
// As mesmas regras da parte 1 com o estoque congelado mexido (as vendas de 11/11, um tipo inteiro vendido, um carro que
// some): lib/busca.vendas.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Busca } from './busca';
import { falhasDe } from './busca.regressao';

/** O estoque do dia (o robô gera antes de testar). */
const dia = JSON.parse(readFileSync('public/dados/busca.json', 'utf8'));
/** O estoque congelado de 09/11/2026: os casos escritos à mão. */
const ix = JSON.parse(readFileSync('testes/fixtures/estoque-busca.json', 'utf8'));
const b = () => new Busca(ix);
const nomes = (q: string) => b().procurar({ q }).map((it) => it.n);


describe('busca: as regras no ESTOQUE DO DIA (valem com qualquer estoque)', () => {
  it('todas as consultas geradas cumprem as regras (tipo, carro, lado e código; nada errado como achado)', () => {
    expect(falhasDe(Busca, dia), 'regra da busca quebrada com o estoque de agora (lib/busca.regressao.ts explica cada motivo)').toEqual([]);
  }, 120000);

  it('o número do anúncio e o código gravado acham a peça (um anúncio e um código quaisquer do estoque)', () => {
    const bb = new Busca(dia);
    // qualquer anúncio do estoque, pelo número dele
    const k = Math.floor(dia.id.length / 2);
    expect(bb.procurar({ q: dia.id[k] }).map((it) => it.id)).toEqual([dia.id[k]]);
    // qualquer código de 8 números do estoque, com "cod" na frente e com espaço no meio
    const kc = dia.o.findIndex((o: string) => /^\d{8}$/.test(o));
    if (kc >= 0) {
      const cod = dia.o[kc];
      expect(bb.procurar({ q: `cod ${cod}` })[0].o.split(' ')).toContain(cod);
      expect(bb.procurar({ q: `${cod.slice(0, 4)} ${cod.slice(4)}` })[0].o.split(' ')).toContain(cod);
    }
  });
});

describe('busca: os casos do cliente oculto (rodada 14), no estoque congelado de 09/11', () => {
  it('"sinaleira direita tracker": o Tracker não tem lanterna direita, e a esquerda não aparece como se fosse a certa', () => {
    const bb = b();
    expect(bb.procurar({ q: 'sinaleira direita tracker' })).toEqual([]);
    // (fem: a peça é feminina, "lanterna": a tela escreve "Nenhuma lanterna direita")
    expect(bb.faltou).toEqual({ lado: 'D', pos: undefined, fem: true });
    expect(bb.outrosLados.map((it) => it.l)).toEqual(['E']);
  });

  it('"retrovisor direito xc60": o XC60 só tem o esquerdo; a lista sai vazia, diz o que faltou e dá o esquerdo de dica', () => {
    const bb = b();
    expect(bb.procurar({ q: 'retrovisor direito xc60' })).toEqual([]);
    expect(bb.ladoDaBusca).toBe('D');
    expect(bb.faltou?.lado).toBe('D');
    expect(bb.outrosLados.length).toBeGreaterThan(0);
    expect(bb.outrosLados.every((x) => x.l === 'E')).toBe(true);
  });

  it('"sinaleira do Tracker": uma só exata (a esquerda)', () => {
    const bb = b();
    const r = bb.procurar({ q: 'sinaleira do Tracker' });
    expect(r.slice(0, bb.nExatas).map((it) => it.n)).toEqual(['Lanterna traseira esquerda']);
    expect(bb.aproximado).toBe(false);
  });

  it('"paralama do Gol": nenhuma luz de teto, quebra-sol nem pedal; só paralamas (outros carros, como parecidas)', () => {
    const bb = b();
    const r = bb.procurar({ q: 'paralama do Gol' });
    expect(r.length).toBeGreaterThan(0);
    expect(bb.aproximado).toBe(true);
    // a família do tipo: o nome ou o sistema da peça diz paralama ("Molduras do Para-lama" também)
    expect(r.every((it) => /para-?lama/i.test(`${it.n} ${it.s}`))).toBe(true);
    expect(r.some((it) => /luz de teto|quebra-sol|pedal/i.test(it.n))).toBe(false);
  });

  it('"parachoque e-pace": o para-choque dianteiro completo em 1º (com e sem hífen)', () => {
    expect(nomes('parachoque e-pace')[0]).toBe('Para-choque dianteiro completo');
    expect(nomes('para-choque e-pace')[0]).toBe('Para-choque dianteiro completo');
  });

  it('"farol onix 2015": a chave de seta do farol de milha não conta como farol (aparece só como parecida, com aviso)', () => {
    const bb = b();
    const r = bb.procurar({ q: 'farol onix 2015' });
    const comoFarol = bb.aproximado ? [] : r.slice(0, bb.nExatas);
    expect(comoFarol.some((it) => /chave seta/i.test(it.n))).toBe(false);
  });

  it('"pisca": a chave de seta (o jeito de falar) abre a lista, e o chicote de injetor não é a peça', () => {
    const bb = b();
    const r = bb.procurar({ q: 'pisca' });
    expect(r[0].n).toMatch(/^chave seta/i);
    expect(bb.nExatas).toBeGreaterThan(20);
    // o "Chicote pisca bico injetor" cita a palavra: fica depois, em "Outras peças ligadas a…", nunca entre as exatas
    expect(r.slice(0, bb.nExatas).some((it) => /chicote/i.test(it.n))).toBe(false);
  });

  it('"suspensão xc60": a família inteira do XC60 (sistema de busca, não "parecida")', () => {
    const bb = b();
    const r = bb.procurar({ q: 'suspensão xc60' });
    expect(r.length).toBeGreaterThan(8);
    expect(bb.aproximado).toBe(false);
    // nenhuma peça se chama "suspensão": a tela diz "peças ligadas a", e não "peças para"
    expect(bb.citam).toBe(true);
    expect(r.every((it) => it.b === 'Volvo')).toBe(true);
  });

  it('código com espaço e traço acha a peça em 1º', () => {
    const it = ix.id.map((_: string, k: number) => k).find((k: number) => /^\d{8}$/.test(String(ix.o[k]).split(' ')[0]));
    expect(it).toBeDefined();
    const cod = String(ix.o[it]).split(' ')[0];
    const r = b().procurar({ q: `${cod.slice(0, 4)} ${cod.slice(4)}` });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].o.split(' ')).toContain(cod);
  });
});

// Revisão independente da rodada 14 (o que barrou a publicação). O juiz completo está em busca.diferencial.test.ts; aqui
// ficam os casos da revisão escritos um a um, para quem ler saber o que cada regra protege.
describe('busca: a revisão da rodada 14, no estoque congelado de 09/11', () => {
  const xc60 = { b: 'Volvo', m: 'XC60', y: 2019 };
  const nome1 = (q: string) => b().procurar({ q })[0]?.n ?? '';

  it('P1-3: composta digitada com espaço acha o mesmo que com hífen (porta luvas, para choque, semi eixo…)', () => {
    const pares: [string, string, RegExp][] = [
      ['porta luvas', 'porta-luvas', /^porta-luvas/i], ['para choque', 'para-choque', /^para-choque/i], ['para lama', 'para-lama', /^para-lama/i],
      ['quebra sol', 'quebra-sol', /^quebra-sol/i], ['porta copos', 'porta-copos', /^porta-copos/i], ['semi eixo', 'semieixo', /^semieixo/i],
      ['alto falante', 'alto-falante', /alto-falante/i], ['pisca alerta', 'pisca-alerta', /^bot[aã]o (pisca-)?alerta/i],
    ];
    for (const [espaco, hifen, re] of pares) {
      const bb = b();
      const a = bb.procurar({ q: espaco });
      expect(a.length, espaco).toBeGreaterThan(0);
      expect(bb.aproximado, espaco).toBe(false);
      expect(a[0].n, espaco).toMatch(re);
      expect(a.map((it) => it.id).sort(), espaco).toEqual(b().procurar({ q: hifen }).map((it) => it.id).sort());
    }
    // o lugar (porta-malas, para-brisa, ar condicionado): nenhuma peça tem esse nome; a lista é das ligadas, sem "nada exato"
    for (const q of ['porta malas', 'para brisa', 'ar condicionado']) {
      const bb = b();
      expect(bb.procurar({ q }).length, q).toBeGreaterThan(60);
      expect(bb.aproximado, q).toBe(false);
      expect(bb.citam, q).toBe(true);
    }
    expect(nome1('porta luvas gol')).toMatch(/^porta-luvas/i);
    expect(b().procurar({ q: 'para choque traseiro' })[0].n).toBe('Para-choque traseiro');
  });

  it('P1-4: gatilho e destino do sinônimo são um tipo só ("espelho retrovisor esquerdo kicks")', () => {
    const r = b().procurar({ q: 'espelho retrovisor esquerdo kicks' });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].n).toMatch(/^retrovisor/i);
    expect(r[0].l).toBe('E');
    expect(b().procurar({ q: 'espelho retrovisor' }).length).toBeGreaterThan(60);
  });

  it('P1-4: a 2ª palavra que não está no nome não zera a lista nem traz outro tipo como exato', () => {
    expect(b().procurar({ q: 'freio de mão' }).filter((it) => /alavanca freio/i.test(it.n)).length).toBeGreaterThan(15);
    expect(b().procurar({ q: 'luz de freio' }).filter((it) => /brake light/i.test(it.n)).length).toBeGreaterThan(5);
    expect(b().procurar({ q: 'bomba de gasolina' }).filter((it) => /^bomba combust/i.test(it.n)).length).toBeGreaterThan(8);
    expect(b().procurar({ q: 'filtro de ar' }).slice(0, 5).every((it) => /^caixa filtro/i.test(it.n))).toBe(true);
    // "forro de teto": o estoque não tem; as parecidas são forros, com aviso (nunca a "Luz teto" como resultado exato)
    const bb = b();
    const forro = bb.procurar({ q: 'forro de teto' });
    expect(bb.aproximado).toBe(true);
    expect(forro.slice(0, 5).every((it) => /forro/i.test(it.n))).toBe(true);
    // com o carro digitado, a peça dele primeiro
    expect(b().procurar({ q: 'motor completo xc60' })[0]).toMatchObject({ n: 'Motor parcial', m: 'XC60' });
    expect(b().procurar({ q: 'lanterna led gol' }).slice(0, 2).every((it) => /^lanterna/i.test(it.n) && (it.ms ?? [it.m]).includes('Gol'))).toBe(true);
    expect(b().procurar({ q: 'chave reserva xc60' }).slice(0, 2).every((it) => /^chave (canivete|presen)/i.test(it.n))).toBe(true);
  });

  it('P1-5: "bomba d\'água", "bomba dagua" e "bomba de agua" acham as mesmas bombas; o carro salvo sobe', () => {
    const ids = (q: string) => b().procurar({ q }).map((it) => it.id).sort();
    const base = ids('bomba agua');
    expect(base.length).toBeGreaterThan(12);
    for (const q of ["bomba d'água", 'bomba dagua', 'bomba de agua', 'bomba d agua', 'bomba d’água']) expect(ids(q), q).toEqual(base);
    const r = b().procurar({ q: "bomba d'água" }, xc60);
    expect(r[0].b).toBe('Volvo');
    expect((r[0].ms ?? [r[0].m])).toContain('XC60');
    expect(r.map((it) => it.id).sort()).toEqual(base);
  });

  it('P2-2: só o suporte para o carro não é o alternador ("alternador gol" é parecida, com o do Gol primeiro)', () => {
    const bb = b();
    const r = bb.procurar({ q: 'alternador gol' });
    expect(bb.aproximado).toBe(true);
    expect(r[0].n).toMatch(/^suporte alternador/i);
    expect(bb.nDoCarro).toBeGreaterThan(0);
    expect(r.slice(bb.nDoCarro).some((it) => /^alternador/i.test(it.n))).toBe(true);
    expect(bb.bate(r, 'alternador gol', { b: 'Volkswagen', m: 'Gol' })).toBe(false);
  });

  it('P2-3 e P2-4: "gol" não é "Golf"; "vw" e "gm" valem pela marca', () => {
    expect(b().procurar({ q: 'lanterna gol' }).some((it) => (it.ms ?? [it.m]).includes('Golf') && !(it.ms ?? [it.m]).includes('Gol'))).toBe(false);
    expect(b().procurar({ q: 'vw gol lanterna' }).map((it) => it.id).sort()).toEqual(b().procurar({ q: 'lanterna gol' }).map((it) => it.id).sort());
    expect(b().procurar({ q: 'gm onix modulo' }).length).toBe(b().procurar({ q: 'chevrolet onix modulo' }).length);
  });

  it('P2-5: "sensor de ré" traz os sensores de estacionamento e nenhum sensor de Renault por causa do "re"', () => {
    const bb = b();
    const r = bb.procurar({ q: 'sensor de ré' });
    expect(r.filter((it) => /^sensor (ré )?estacionamento/i.test(it.n)).length).toBeGreaterThan(8);
    expect(r.slice(0, bb.nExatas).some((it) => /^sensor (map|hidrov)/i.test(it.n))).toBe(false);
  });

  it('P2-6: lado + posição juntos: a dica é o outro lado na MESMA posição', () => {
    const bb = b();
    expect(bb.procurar({ q: 'lanterna traseira direita tracker' })).toEqual([]);
    expect(bb.faltou).toMatchObject({ lado: 'D', pos: 'T', fem: true });
    expect(bb.outrosLados.map((it) => `${it.l}${it.pos}`)).toEqual(['ET']);
  });

  it('P2-8: o carro salvo sobe sem esconder as outras', () => {
    for (const q of ['alternador', 'modulo abs', 'retrovisor']) {
      const sem = b().procurar({ q });
      const com = b().procurar({ q }, xc60);
      expect(com[0].b, q).toBe('Volvo');
      expect((com[0].ms ?? [com[0].m]), q).toContain('XC60');
      expect(com.map((it) => it.id).sort(), q).toEqual(sem.map((it) => it.id).sort());
    }
    // o carro digitado manda mais que o salvo
    expect((b().procurar({ q: 'alternador onix' }, xc60)[0].ms ?? []).concat(b().procurar({ q: 'alternador onix' }, xc60)[0].m)).not.toContain('XC60');
  });

  it('P2-10: "new fiesta" é o Fiesta (carro unido), na busca e no filtro de modelo', () => {
    const r = b().procurar({ q: 'lanterna new fiesta' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((it) => (it.ms ?? [it.m]).includes('Fiesta'))).toBe(true);
    expect(b().procurar({ marca: 'Ford', modelo: 'New Fiesta' }).length).toBe(b().procurar({ marca: 'Ford', modelo: 'Fiesta' }).length);
  });

  it('P2-1: o erro de digitação segue a regra do tipo ("retrovizor" abre com retrovisor, "sinalera" é sinaleira)', () => {
    expect(nome1('retrovizor')).toMatch(/^retrovisor/i);
    expect(nome1('alternadro')).toMatch(/^alternador/i);
    expect(nome1('radiadro')).toMatch(/^radiador/i);
    expect(nome1('sinalera')).toMatch(/^lanterna/i);
    expect(nome1('fexadura')).toMatch(/^fechadura/i);
  });

  it('P2-11: a palavra que é o LUGAR não corta a lista ("teto", "banco", "porta-malas")', () => {
    for (const [q, n] of [['teto', 60], ['banco', 15], ['porta-malas', 60]] as const) {
      const bb = b();
      expect(bb.procurar({ q }).length, q).toBeGreaterThan(n);
      expect(bb.aproximado, q).toBe(false);
    }
  });

  it('uma palavra: as que SÃO a peça primeiro, e as ligadas depois (nada some)', () => {
    const bb = b();
    const r = bb.procurar({ q: 'farol' });
    expect(bb.nExatas).toBeGreaterThan(5);
    expect(bb.nExatas).toBeLessThan(r.length);
    expect(r.slice(0, bb.nExatas).every((it) => /^far[oó]/i.test(it.n))).toBe(true);
    expect(r.slice(bb.nExatas).some((it) => /^suporte farol/i.test(it.n))).toBe(true);
  });

  it('número do anúncio e "cod" antes do código acham a peça', () => {
    const id = ix.id[1];
    expect(b().procurar({ q: id }).map((it) => it.id)).toEqual([id]);
    const k = ix.o.findIndex((o: string) => /^\d{8}$/.test(o));
    expect(b().procurar({ q: `cod ${ix.o[k]}` })[0].o.split(' ')).toContain(ix.o[k]);
  });
});

describe('busca: o que a pessoa digitou, sem o carro (o pedido do pátio)', () => {
  it('tira o carro e a marca do jeito que a busca os entendeu', () => {
    const bb = b();
    expect(bb.semCarroQ('vw gol lanterna')).toBe('lanterna');
    expect(bb.semCarroQ('lanterna new fiesta')).toBe('lanterna');
    expect(bb.semCarroQ('retrovisor direito xc 60')).toBe('retrovisor direito');
    expect(bb.semCarroQ("bomba d'água xc60")).toBe('bomba água');
    expect(bb.semCarroQ('farol')).toBe('farol');
  });
});

describe('busca: apelido de carro unido digitado, no estoque congelado de 09/11', () => {
  it('"modulo c180": os módulos do Classe C, com os que dizem C180 primeiro', () => {
    const r = b().procurar({ q: 'modulo c180' });
    const diz = r.map((it) => (it.ms ?? [it.m]).includes('C180'));
    expect(r.length).toBeGreaterThan(diz.filter(Boolean).length);
    expect(r.every((it) => (it.ms ?? [it.m]).includes('Classe C'))).toBe(true);
    // dentro das exatas, nenhuma sem "C180" antes de uma com
    const bb = b(); const ex = bb.procurar({ q: 'modulo c180' }).slice(0, bb.nExatas).map((it) => (it.ms ?? [it.m]).includes('C180'));
    expect(ex.lastIndexOf(true)).toBeLessThan(ex.indexOf(false) === -1 ? ex.length : ex.indexOf(false));
  });
});
