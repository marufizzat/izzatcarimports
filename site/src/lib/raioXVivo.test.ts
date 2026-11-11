// O Raio-x vivo. Regra dos testes com estoque (testes/estoques.ts): aqui só há REGRAS, que rodam no ESTOQUE FIXO e no
// ESTOQUE DO DIA. O esperado sai sempre dos próprios dados (a lista do selo "Chegou agora" e a busca do catálogo):
// nenhum teste exige uma peça, uma zona, um carro ou uma quantidade. Estoque sem nenhuma peça nova com lugar no carro
// (ou sem peça nenhuma) também passa: aí nada pulsa.
// A lista do selo: no estoque do dia, a de verdade (`resumo().chegou`, gravada pelo preparar_dados.py junto com o
// índice); no estoque fixo (que não tem resumo), os anúncios de maior número do próprio índice (a conta do selo no
// catálogo: `idsMaisNovos`).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pecasVivas, vivoPorZona, serveNoCarro, type PecaViva } from './raioXVivo';
import { ZONAS, zonasDaPeca, pecasDaZona, contarZonas } from './raioX';
import { Busca } from './busca';
import { resumo, pecas } from './dados';
import { QTD_CHEGOU, idsMaisNovos } from '../components/catalogo/etiqueta';
import { estoques } from '../../testes/estoques';

/** Do anúncio mais novo para o mais antigo (o número do anúncio cresce com o tempo), como o preparar_dados.py grava. */
const maisNovosPrimeiro = (ids: Iterable<string>) => [...ids].sort((a, z) => z.length - a.length || (a < z ? 1 : a > z ? -1 : 0));

describe.each(estoques())('o Raio-x vivo ($nome)', ({ ix, fixo }) => {
  const busca = new Busca(ix);
  const procurar = (f: Parameters<Busca['procurar']>[0]) => busca.procurar(f);
  const chegou = fixo ? maisNovosPrimeiro(idsMaisNovos(ix.id)) : resumo().chegou;
  const vivas = pecasVivas(chegou, busca.itens);
  const porId = new Map(busca.itens.map((it) => [it.id, it]));

  describe('o que é "chegou agora"', () => {
    it('é a lista do selo "Chegou agora": toda peça viva está nela, na mesma ordem, sem repetir', () => {
      expect(chegou.length).toBeLessThanOrEqual(QTD_CHEGOU);
      const ids = vivas.map((p) => p.id);
      for (const id of ids) expect(chegou, id).toContain(id);
      expect(ids).toEqual(chegou.filter((id) => ids.includes(id)));
      expect(new Set(ids).size).toBe(ids.length);
    });
    it('nenhuma peça do selo com lugar no carro fica de fora, e nenhuma sem lugar (ou que já saiu do índice) entra', () => {
      for (const id of chegou) {
        const it = porId.get(id);
        const zs = it ? zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).map((z) => z.k) : [];
        const viva = vivas.find((p) => p.id === id);
        if (zs.length) expect(viva?.z, id).toEqual(zs);
        else expect(viva, id).toBeUndefined();
      }
    });
    it('cada peça viva leva o nome, o carro e o endereço da peça do índice', () => {
      for (const p of vivas) {
        const it = porId.get(p.id)!;
        expect([p.n, p.h, p.b, p.m, p.y, p.ms, p.ys]).toEqual([it.n, it.h, it.b, it.m, it.y, it.ms, it.ys]);
        for (const k of p.z) expect(ZONAS.some((z) => z.k === k), `${p.id}: ${k}`).toBe(true);
      }
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
    it('a peça mostrada está na lista da zona (o painel conta ela): a zona que pulsa nunca é a zona cinza', () => {
      const contas = contarZonas(procurar);
      for (const [k, p] of Object.entries(v)) {
        const z = ZONAS.find((x) => x.k === k)!;
        const daZona = pecasDaZona(procurar, {}, z).map((it) => it.id);
        expect(daZona, `${k}: ${p.n}`).toContain(p.id);
        expect(contas.find((c) => c.k === k)!.n, k).toBe(daZona.length);
      }
    });
  });

  describe('com carro: só o que serve no carro (e no ano) da pessoa', () => {
    // os carros que o teste usa saem dos dados: os das peças vivas (com o ano nas pontas da faixa, fora dela e sem ano)
    // e alguns do estoque que podem não ter peça nova nenhuma. Estoque sem carro nenhum: os laços não rodam.
    // O APELIDO de carro unido (C180 = Classe C: `apelidos` do índice) fica de fora, como no site: o Meu carro salvo com
    // o apelido vira o principal na leitura (lerMeuCarro, testado em carrosUnidos.test.ts) e a página do carro é a do
    // principal; o Raio-x nunca pergunta por um apelido. (O filtro do catálogo troca o apelido pelo principal; a conta
    // do navegador recebe o carro já trocado. Com o apelido aqui, o teste dependeria de QUAIS peças chegaram no dia.)
    type Carro = { b: string; m: string; y?: number };
    const carros: Carro[] = [];
    const apelidos = new Set(ix.apelidos ?? []);
    const junta = (b: string, m: string, y: [number, number] | null) => {
      if (apelidos.has(`${b}|${m}`)) return;
      carros.push({ b, m });
      if (y) for (const ano of [y[0], y[1], y[0] - 1, y[1] + 1]) carros.push({ b, m, y: ano });
    };
    for (const p of vivas) (p.ms ?? [p.m]).forEach((m, i) => { if (m) junta(p.b, m, p.ms && p.ys ? p.ys[i] ?? null : p.y); });
    for (const it of busca.itens.filter((_, i) => i % 331 === 0)) if (it.m) junta(it.b, it.m, it.y);

    it('a conta do navegador (serveNoCarro) é a do filtro do catálogo para QUALQUER peça do estoque (não só as que chegaram hoje)', () => {
      // a regra não pode depender de quais peças estão na lista do selo no dia: confere com o estoque inteiro
      for (const c of carros) {
        const doCatalogo = procurar({ marca: c.b, modelo: c.m, ano: c.y }).map((it) => it.id).sort();
        const doNavegador = busca.itens.filter((it) => serveNoCarro(it, c)).map((it) => it.id).sort();
        expect(doNavegador, `${c.b} ${c.m} ${c.y ?? ''}`).toEqual(doCatalogo);
      }
    });
    it('as peças vivas do carro = a lista do selo ∩ a busca do catálogo, na ordem do selo', () => {
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
});

// Só com o estoque do dia (o que o robô acabou de gerar; no computador sem os dados gerados, a lista vem vazia e nada
// roda): o que vai para o site.
describe.each(estoques().filter((e) => !e.fixo))('o Raio-x vivo: o que vai para o site ($nome)', ({ ix }) => {
  const busca = new Busca(ix);
  const vivas = pecasVivas(resumo().chegou, busca.itens);
  it('a lista é a MESMA do selo dos cartões (components/CartaoPeca.astro decide com resumo().chegou)', () => {
    expect(readFileSync('src/components/CartaoPeca.astro', 'utf-8')).toContain('resumo().chegou.includes(p.id)');
  });
  it('o "Chegou agora" de cada peça viva aponta para uma página de peça que EXISTE (/peca/<h>.html)', () => {
    const slugs = new Set(pecas().map((p) => p.slug));
    for (const p of vivas) {
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
