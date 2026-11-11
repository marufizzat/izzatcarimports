import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Peca, Resumo } from './dados';
import {
  juntar, juntarDe, minuscula, contar, faixaAnos, escolha, textosCategoria, textosCarro, textosMarca,
  tituloCategoria, tituloCarro, tituloMarca, PROIBIDOS, raiz, tiposFrase, temaCategoria,
} from './textos';
import { serveNoModelo } from './meuCarro';

const peca = (o: Partial<Peca>): Peca => ({
  id: 'MLB1', slug: 's', t: 't', n: 'n', p: 100, fotos: [], ml: '', f: false, b: 'Volvo', m: 'XC60',
  y: null, c: 'Motor', s: 'Bielas', oem: '', o: '', ficha: [], desc: '', rel: [], ...o,
});

describe('textos: funcoes basicas', () => {
  it('juntar faz lista em portugues', () => {
    expect(juntar([])).toBe('');
    expect(juntar(['A'])).toBe('A');
    expect(juntar(['A', 'B'])).toBe('A e B');
    expect(juntar(['A', 'B', 'C'])).toBe('A, B e C');
  });
  it('juntarDe: bloco com "e" no nome nao vira lista ambigua', () => {
    expect(juntarDe(['motor', 'faróis e lanternas', 'painel e console'])).toBe('de motor, de faróis e lanternas e de painel e console');
    expect(juntarDe(['freios'])).toBe('de freios');
  });
  it('temaCategoria: "peças de freios", mas "mangueiras do motor" (o nome ja e a peca)', () => {
    expect(temaCategoria({ n: 'Freios', k: 'freios' })).toEqual({ tema: 'freios', ehPeca: false });
    expect(temaCategoria({ n: 'Faróis e Lanternas', k: 'farois-e-lanternas' })).toEqual({ tema: 'faróis e lanternas', ehPeca: false });
    expect(temaCategoria({ n: 'Mangueiras do Motor', k: 'mangueiras-do-motor' })).toEqual({ tema: 'mangueiras do motor', ehPeca: true });
    expect(temaCategoria({ n: 'Módulos e Elétrica', k: 'modulos-e-eletrica' }).tema).toBe('módulos e peças elétricas');
    const t = textosCategoria({ n: 'Mangueiras do Motor', k: 'mangueiras-do-motor' }, [peca({ c: 'Mangueiras do Motor' }), peca({ id: 'MLB2', c: 'Mangueiras do Motor' })]);
    expect(t.paragrafos[0]).toMatch(/2 mangueiras do motor originais/);
    expect(t.meta).toMatch(/^2 mangueiras do motor originais/);
  });
  it('minuscula preserva siglas e codigos', () => {
    expect(minuscula('Bielas')).toBe('bielas');
    expect(minuscula('Módulo ABS')).toBe('módulo ABS');
    expect(minuscula('Sensor XC60')).toBe('sensor XC60');
  });
  it('contar ignora vazios e Outros, ordena por quantidade', () => {
    expect(contar(['A', 'B', 'B', '', null, 'Outros', 'C', 'B', 'A'], 3)).toEqual(['B', 'A', 'C']);
  });
  it('faixaAnos ignora pecas sem ano', () => {
    expect(faixaAnos([peca({ y: [2010, 2015] }), peca({ y: null }), peca({ y: [2008, 2012] })])).toEqual([2008, 2015]);
    expect(faixaAnos([peca({ y: null })])).toBeNull();
  });
  it('escolha e deterministica e usa as opcoes', () => {
    const ops = ['a', 'b', 'c'];
    expect(escolha('x', ops)).toBe(escolha('x', ops));
    expect(ops).toContain(escolha('qualquer', ops));
  });
});

describe('textos: categoria, carro e marca (fixtures)', () => {
  const lista = [
    peca({ id: 'MLB1', b: 'Volvo', m: 'XC60', s: 'Bielas', y: [2014, 2018] }),
    peca({ id: 'MLB2', b: 'Volvo', m: 'S60', s: 'Bielas', y: [2011, 2014] }),
    peca({ id: 'MLB3', b: 'Chevrolet', m: 'Onix', s: 'Cabeçote', y: null }),
  ];

  it('categoria: traz quantidade, subtipos e marcas', () => {
    const t = textosCategoria({ n: 'Motor', k: 'motor' }, lista);
    expect(t.paragrafos[0]).toMatch(/3 peças/);
    expect(t.paragrafos.join(' ')).toMatch(/bielas/);
    expect(t.meta).toMatch(/^3 peças originais de motor/);
    expect(t.meta.length).toBeLessThanOrEqual(160);
  });
  it('categoria "Peças de X": nao duplica o "peças de"', () => {
    const t = textosCategoria({ n: 'Peças de Interior', k: 'pecas-de-interior' }, [peca({ c: 'Peças de Interior' })]);
    expect(t.paragrafos[0]).toMatch(/1 peça de interior original/);
    expect(t.paragrafos.join(' ')).not.toMatch(/peças de peças/);
  });
  it('carro: singular, ano unico e sem invencao', () => {
    const t = textosCarro({ k: 'x', b: 'Volvo', m: 'XC60', c: 1, anos: [2015, 2015], fams: [['Motor', 1]] }, [peca({ y: [2015, 2015] })]);
    expect(t.paragrafos[0]).toMatch(/1 peça original para Volvo XC60 \(2015\)/);
    expect(t.paragrafos.join(' ')).not.toMatch(/undefined|NaN/);
  });
  it('marca: plural de modelos e faixa de anos', () => {
    const t = textosMarca({ n: 'Volvo', c: 3, m: [{ n: 'XC60', c: 2 }, { n: 'S60', c: 1 }] }, lista.slice(0, 2));
    expect(t.paragrafos[0]).toMatch(/3 peças originais de Volvo/);
    expect(t.paragrafos.join(' ')).toMatch(/com carros de 2011 a 2018/);
  });
  it('lista vazia nao quebra', () => {
    expect(textosCategoria({ n: 'Motor', k: 'motor' }, []).paragrafos).toEqual([]);
    expect(textosCarro({ k: 'x', b: 'A', m: 'B', c: 0, anos: null, fams: [] }, []).paragrafos).toEqual([]);
  });
  it('tipos na frase: sem repetir singular e plural, no maximo 2, sem "Outros"', () => {
    expect(raiz('Catalisador')).toBe(raiz('Catalisadores'));
    expect(raiz('Mangueira Radiador')).not.toBe(raiz('Mangueiras de Arrefecimento'));
    expect(tiposFrase(['Catalisadores', 'Catalisador', 'Catalisadores', 'Tubos Flexíveis', 'Outros', 'Outros', 'Outros'], 3))
      .toEqual(['catalisadores', 'tubos flexíveis']);
    expect(tiposFrase(['Outros Botões', 'Outros Botões', 'Botões do Vidro Elétrico'])).toEqual(['botões do vidro elétrico']);
    expect(tiposFrase(['A', 'B', 'C', 'C', 'B', 'B'])).toEqual(['b', 'c']);
  });
  it('marca sem modelo lido (Mini): nunca "para 0 modelos"', () => {
    const t = textosMarca({ n: 'Mini', c: 34, m: [] }, [peca({ b: 'Mini', m: '', c: 'Motor' })]);
    expect([...t.paragrafos, t.meta].join(' ')).not.toMatch(/(^|[^\d])0 modelos?/);
    expect(t.paragrafos[0]).toBe('São 34 peças originais de Mini no pátio.');
  });
  it('poucas peças: nada de "A maioria" (auditoria 4, 7.2: a Lifan tinha 1 peça)', () => {
    const uma = textosMarca({ n: 'Lifan', c: 1, m: [] }, [peca({ b: 'Lifan', m: '', c: 'Faróis e Lanternas', y: [2015, 2018] })]);
    expect(uma.paragrafos.join(' ')).not.toMatch(/maioria/i);
    expect(uma.paragrafos.join(' ')).toMatch(/A peça é de faróis e lanternas, para carros de 2015 a 2018\./);
    const tres = textosMarca({ n: 'Lifan', c: 3, m: [] }, [1, 2, 3].map((i) => peca({ id: `MLB${i}`, b: 'Lifan', m: '', c: 'Motor' })));
    expect(tres.paragrafos.join(' ')).toMatch(/São peças de motor/);
    const carro = textosCarro({ k: 'x', b: 'Lifan', m: 'X60', c: 2, anos: null, fams: [['Motor', 2]] }, [peca({ b: 'Lifan', m: 'X60' }), peca({ id: 'MLB2', b: 'Lifan', m: 'X60' })]);
    expect(carro.paragrafos.join(' ')).not.toMatch(/maioria/i);
  });
  it('categoria nao repete a instrucao do topo ("Escolha a marca do seu carro")', () => {
    for (const k of ['motor', 'farois-e-lanternas', 'freios', 'injecao-e-combustivel', 'painel-e-console']) {
      const t = textosCategoria({ n: 'Motor', k }, [peca({}), peca({ id: 'MLB2', b: 'Fiat', m: 'Toro' })]);
      expect(t.paragrafos.join(' ')).not.toMatch(/Escolha a marca/);
    }
  });
  it('titulos saem no formato', () => {
    expect(tituloCategoria('Motor')).toBe('Motor: peças originais | Izzat Car Imports');
    expect(tituloCarro('Volvo', 'XC60', [2014, 2026])).toBe('Peças Volvo XC60 2014 a 2026 originais | Izzat Car Imports');
    expect(tituloMarca('Volvo')).toBe('Peças Volvo originais | Izzat Car Imports');
  });
  it('titulo do carro em ate 65 caracteres: sai "originais", depois os anos (SEO, 10/11)', () => {
    expect(tituloCarro('Mitsubishi', 'Pajero Full', [2008, 2014])).toBe('Peças Mitsubishi Pajero Full 2008 a 2014 | Izzat Car Imports');
    expect(tituloCarro('Mercedes-Benz', 'Classe GLA 200', [2015, 2020]).length).toBeLessThanOrEqual(65);
    expect(tituloCarro('Mercedes-Benz', 'Classe GLA 200', [2015, 2020])).not.toMatch(/2015/);
  });
  it('meta da marca: com mais modelos que os citados, "como X e Y" (nao lia como se fossem so esses)', () => {
    const lista = [peca({ b: 'Chevrolet', m: 'Tracker' }), peca({ id: 'MLB2', b: 'Chevrolet', m: 'Cruze' })];
    const m = { n: 'Chevrolet', c: 552, m: Array.from({ length: 15 }, (_, i) => ({ n: ['Tracker', 'Cruze'][i] ?? `M${i}`, c: 1 })) };
    expect(textosMarca(m as never, lista).meta).toMatch(/15 modelos, como Tracker e Cruze\./);
    const dois = { n: 'Volvo', c: 10, m: [{ n: 'XC60', c: 6 }, { n: 'S60', c: 4 }] };
    expect(textosMarca(dois as never, lista).meta).toMatch(/2 modelos: XC60 e S60\./);
  });
});

describe('textos: todas as paginas de lista do estoque real', () => {
  const pecas: Peca[] = JSON.parse(readFileSync('src/data/pecas.json', 'utf-8'));
  const r: Resumo = JSON.parse(readFileSync('src/data/resumo.json', 'utf-8'));
  const paginas: { tipo: string; titulo: string; t: ReturnType<typeof textosMarca>; primeiro: string }[] = [];

  for (const f of r.familias.filter((x) => x.n !== 'Outros')) {
    const t = textosCategoria(f, pecas.filter((p) => p.c === f.n));
    paginas.push({ tipo: 'categoria', titulo: tituloCategoria(f.n), t, primeiro: t.paragrafos[0] ?? '' });
  }
  for (const c of r.carros) {
    // a mesma lista da pagina do carro: a peca de 2+ carros (ms) entra em cada um
    const t = textosCarro(c, pecas.filter((p) => p.b === c.b && serveNoModelo(p, c.m)));
    paginas.push({ tipo: 'carro', titulo: tituloCarro(c.b, c.m, c.anos), t, primeiro: t.paragrafos[0] ?? '' });
  }
  for (const m of r.marcas) {
    const t = textosMarca(m, pecas.filter((p) => p.b === m.n));
    paginas.push({ tipo: 'marca', titulo: tituloMarca(m.n), t, primeiro: t.paragrafos[0] ?? '' });
  }

  it('cada pagina tem texto e meta', () => {
    expect(paginas.length).toBeGreaterThan(0);
    for (const p of paginas) {
      expect(p.t.paragrafos.length).toBeGreaterThanOrEqual(2);
      expect(p.t.meta.length).toBeGreaterThan(20);
    }
  });
  it('meta description unica e com no maximo 160 caracteres', () => {
    const metas = paginas.map((p) => p.t.meta);
    expect(new Set(metas).size).toBe(metas.length);
    for (const m of metas) expect(m.length).toBeLessThanOrEqual(160);
  });
  it('titulos das paginas de carro com ate 65 caracteres', () => {
    for (const c of r.carros) expect(tituloCarro(c.b, c.m, c.anos).length, `${c.b} ${c.m}`).toBeLessThanOrEqual(65);
  });
  it('titulos unicos', () => {
    const tits = paginas.map((p) => p.titulo);
    expect(new Set(tits).size).toBe(tits.length);
  });
  it('paragrafos unicos entre as paginas', () => {
    const todos = paginas.flatMap((p) => p.t.paragrafos);
    expect(new Set(todos).size).toBe(todos.length);
  });
  it('nenhuma frase com "peças de peças", "0 modelos" ou a instrução do topo repetida', () => {
    for (const p of paginas) {
      for (const f of p.t.paragrafos) {
        expect(f, p.titulo).not.toMatch(/peças de peças|(^|[^\d])0 modelos|Escolha a marca do seu carro no atalho/);
      }
    }
  });
  it('nenhum termo proibido nos textos', () => {
    const todos = paginas.flatMap((p) => [p.titulo, p.t.meta, ...p.t.paragrafos]).join('\n').toLowerCase();
    for (const termo of PROIBIDOS) expect(todos.includes(termo.toLowerCase()), termo).toBe(false);
  });
  it('abertura variada: nenhuma primeira frase domina a lista', () => {
    for (const tipo of ['categoria', 'carro', 'marca']) {
      const grupo = paginas.filter((p) => p.tipo === tipo);
      const cont = new Map<string, number>();
      for (const p of grupo) {
        const abre = p.primeiro.replace(/\d[\d.]*/g, '#').split(' ').slice(0, 3).join(' ');
        cont.set(abre, (cont.get(abre) ?? 0) + 1);
      }
      const maior = Math.max(...cont.values()) / grupo.length;
      expect(maior, tipo).toBeLessThan(0.6);
    }
  });
});
