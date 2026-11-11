// As vistas "por dentro" do Raio-x (todas: a frente, o piloto, e as 8 zonas que vieram depois):
// a forma de cada ponto quente dentro da arte, o link EXATO do catálogo e o número igual ao que o catálogo mostra.
// Estoque nos testes (testes/estoques.ts): nome de bloco/tipo confere no VOCABULÁRIO da loja; "tem de ter peça" só no
// ESTOQUE FIXO; as regras (número = catálogo, lado, posição, a parte do carro) no fixo e no estoque do dia.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PONTOS_DA_ZONA } from './porDentro/todas';
import { pontosLateral } from './porDentro/lateral';
import { contarPontos, contarComLigadas, ligadasTxt, filtrosDoQuente, ehDoPonto, TIPO_INTEIRO, type PontoQuente } from './porDentro/base';
import { dentroJson } from './porDentro/todas';
import { serveNoModelo } from './meuCarro';
import { VISTAS, ARTE_VISTA, ARQUIVO_DENTRO, arteDaVista } from './raioXVistas';
import { ZONAS, ARTE, linkLinha, filtrosLinha, zonasDaPeca } from './raioX';
import { Busca, capaItem, type Lado, type Posicao } from './busca';
import { estoques, carroMaisCheio, carrosDoIndice, indiceDoCarro, indiceFixo, BLOCOS_DA_LOJA, TIPOS_DA_LOJA } from '../../testes/estoques';

const VISTAS_K = Object.keys(VISTAS);

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
// os filtros que o catálogo lê do endereço (catalogo/Catalogo.tsx: LADOS e POSICOES por extenso)
function filtrosDoLink(href: string) {
  const u = new URL(href, 'https://x').searchParams;
  const lado = ({ esquerdo: 'E', direito: 'D' } as Record<string, Lado>)[u.get('lado') ?? ''];
  const pos = ({ dianteiro: 'D', traseiro: 'T' } as Record<string, Posicao>)[u.get('pos') ?? ''];
  return { marca: u.get('marca') ?? undefined, modelo: u.get('modelo') ?? undefined, ano: u.get('ano') ? Number(u.get('ano')) : undefined,
    tipo: u.get('tipo') ?? undefined, sub: u.get('sub') ?? undefined, lado, pos };
}

describe('vistas por dentro: uma por zona do Raio-x', () => {
  it('toda zona tem a vista dela, a tabela e a arte (com as variantes de 320 e 900)', () => {
    expect(VISTAS_K.sort()).toEqual(ZONAS.map((z) => z.k).sort());
    expect(Object.keys(PONTOS_DA_ZONA).sort()).toEqual([...VISTAS_K].sort());
    expect(ARTE_VISTA).toEqual({ w: ARTE.w, h: ARTE.h });
    for (const k of VISTAS_K) {
      const v = VISTAS[k];
      for (const a of [arteDaVista(v), arteDaVista(v, 320), arteDaVista(v, 900)]) expect(existsSync(`public${a}`), a).toBe(true);
      expect(v.botao, k).toMatch(/^Ver (o|a) /);
      // a linha de apoio cabe numa linha do botão e nunca diz quantas peças a arte tem
      expect(v.resumo, k).not.toMatch(/\d/);
    }
  });
  it('o código da vista sabe baixar a tabela de toda zona (TABELAS de raioXPorDentro.ts)', () => {
    const fonte = readFileSync('src/components/v2/raioXPorDentro.ts', 'utf-8');
    const bloco = /const TABELAS: [^\n]*= \{\n([\s\S]*?)\n\};/.exec(fonte)![1];
    const chaves = [...bloco.matchAll(/^\s+'?([a-z-]+)'?: \(\) => import/gm)].map((m) => m[1]);
    expect(chaves.sort()).toEqual([...VISTAS_K].sort());
  });
  it('as duas laterais usam a mesma arte e as mesmas formas; só o lado dos links muda', () => {
    expect(VISTAS['lateral-esquerda'].arte).toBe(VISTAS['lateral-direita'].arte);
    const e = pontosLateral('E'), d = pontosLateral('D');
    expect(e.map((p) => [p.k, p.nome, p.ancora, p.poligonos, p.tipo, p.sub, p.pos])).toEqual(d.map((p) => [p.k, p.nome, p.ancora, p.poligonos, p.tipo, p.sub, p.pos]));
    for (const p of e) { expect(p.lado, p.k).toBe('E'); expect(p.procuro, p.k).toMatch(/esquerd[oa]$/); }
    for (const p of d) { expect(p.lado, p.k).toBe('D'); expect(p.procuro, p.k).toMatch(/direit[oa]$/); }
  });
  it('lado da arte da traseira: vista por trás, a lanterna à ESQUERDA de quem olha é a ESQUERDA do carro', () => {
    const t = PONTOS_DA_ZONA.traseira;
    const p = (k: string) => t.find((q) => q.k === k)!;
    expect(p('lanterna-esquerda').ancora[0]).toBeLessThan(p('lanterna-direita').ancora[0]);
    expect(p('lanterna-esquerda').lado).toBe('E');
    expect(p('lanterna-direita').lado).toBe('D');
  });
});

describe.each(VISTAS_K)('vista por dentro de "%s": os pontos quentes na arte', (zona) => {
  const PONTOS = PONTOS_DA_ZONA[zona];
  it('de 10 a 16 peças; chaves e nomes únicos; o número fica dentro da peça; tudo dentro da arte', () => {
    expect(PONTOS.length).toBeGreaterThanOrEqual(10);
    expect(PONTOS.length).toBeLessThanOrEqual(16);
    expect(new Set(PONTOS.map((p) => p.k)).size).toBe(PONTOS.length);
    expect(new Set(PONTOS.map((p) => p.nome)).size).toBe(PONTOS.length);
    for (const p of PONTOS) {
      expect(p.k, p.k).toMatch(/^[a-z][a-z-]*$/);
      expect(p.poligonos.some((poli) => dentro(p.ancora, pontos(poli))), p.k).toBe(true);
      for (const poli of p.poligonos) {
        expect(pontos(poli).length, p.k).toBeGreaterThanOrEqual(6);
        for (const [x, y] of pontos(poli)) {
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(ARTE_VISTA.w);
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(ARTE_VISTA.h);
        }
      }
    }
  });
  it('o número de uma peça nunca cai em cima da forma de outra desenhada DEPOIS dela (a de cima ganha o toque)', () => {
    PONTOS.forEach((p, i) => {
      const porCima = PONTOS.slice(i + 1).filter((q) => q.poligonos.some((poli) => dentro(p.ancora, pontos(poli)))).map((q) => q.k);
      expect(porCima, p.k).toEqual([]);
    });
  });
  it('os números não se encostam na arte de 288 px (celular de 320)', () => {
    const escala = 288 / ARTE_VISTA.w;
    for (const p of PONTOS) for (const q of PONTOS) {
      if (p === q) continue;
      expect(Math.hypot(p.ancora[0] - q.ancora[0], p.ancora[1] - q.ancora[1]) * escala, `${p.k} × ${q.k}`).toBeGreaterThan(20);
    }
  });
});

// O ponto que mostra uma peça de OUTRA parte do carro, de propósito: na roda a pessoa vê o semieixo (que o painel das
// zonas guarda em "Embaixo") e no teto, o airbag de cortina (o estoque não o separa: o tipo inteiro é do interior).
const DE_OUTRA_ZONA: Record<string, Record<string, string>> = { rodas: { semieixo: 'embaixo' }, teto: { airbags: 'interior' } };

describe.each(VISTAS_K)('vista por dentro de "%s": os nomes dos pontos quentes', (zona) => {
  const PONTOS = PONTOS_DA_ZONA[zona];
  it('todo ponto com tipo usa nomes do vocabulário da loja (bloco e tipo); sem tipo = pátio, com o nome da mensagem', () => {
    const blocos = BLOCOS_DA_LOJA;
    const tipos = TIPOS_DA_LOJA;
    for (const p of PONTOS) {
      expect(p.procuro, p.k).toMatch(/^(o|a) /);
      if (!p.tipo) { expect(p.sub ?? p.lado ?? p.pos, p.k).toBeUndefined(); continue; }
      expect(blocos.has(p.tipo), `${p.k}: ${p.tipo}`).toBe(true);
      expect(p.sub && tipos.has(p.sub), `${p.k}: ${p.sub}`).toBe(true);
    }
  });
  it('todo ponto com tipo diz qual nome É a peça do título (eh), como toda linha da lista do conserto; o de pátio não', () => {
    // revisão 16, P2-1: a regra é uma só (nomeEh) e vale para TODO ponto, não para uma lista de exceções
    for (const p of PONTOS) {
      if (!p.tipo) { expect(p.eh, p.k).toBeUndefined(); continue; }
      expect(p.eh, `${zona} ${p.k}`).toBeDefined();
      if (p.eh === TIPO_INTEIRO) continue;
      for (const e of Array.isArray(p.eh) ? p.eh : [p.eh!]) expect(e.cab.trim().length, p.k).toBeGreaterThan(0);
    }
  });
});

const CASOS = estoques().flatMap((e) => VISTAS_K.map((zona) => ({ ...e, zona })));
describe.each(CASOS)('vista por dentro de "$zona": pontos quentes ↔ links do catálogo ($nome)', ({ zona, ix, fixo }) => {
  const PONTOS = PONTOS_DA_ZONA[zona];
  const b = new Busca(ix);
  const cheio = carroMaisCheio(ix);
  // os carros do exemplo: no estoque fixo, o XC60 2019 e o E-Pace; no do dia, o carro com mais peças
  const carros = fixo || !cheio ? [{}, { marca: 'Volvo', modelo: 'XC60', ano: 2019 }, { marca: 'Jaguar', modelo: 'E-Pace' }] : [{}, cheio];
  it('o link leva o tipo, o sub, o lado e a posição do ponto, e o carro; o número é o da busca com os filtros DO LINK', () => {
    for (const carro of carros) {
      const contas = contarPontos((f) => b.procurar(f), carro, PONTOS);
      for (const p of PONTOS) {
        if (!p.tipo || !p.sub) { expect(contas[p.k], p.k).toBe(0); continue; }
        const l = { tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos };
        const href = linkLinha(l, carro);
        const f = filtrosDoLink(href);
        expect(f).toEqual({ marca: undefined, modelo: undefined, ano: undefined, ...carro, tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos });
        const doPonto = b.procurar(filtrosLinha(l, carro)).map((it) => it.id).sort();
        const doLink = b.procurar({ ...f, ordem: 'novos' }).map((it) => it.id).sort();
        expect(doPonto, p.k).toEqual(doLink);
        // o número que a vista mostra é o do catálogo naquele link; o ponto com regra de nome ou de posição cujo link
        // não tem NENHUMA peça que seja a do desenho mostra 0 (cinza: "a gente procura no pátio"), nunca outra coisa
        const doDesenho = b.procurar({ ...f, ordem: 'novos' }).filter((it) => ehDoPonto(p, it));
        expect(contas[p.k], p.k).toBe(doDesenho.length ? doLink.length : 0);
        // lado e posição de verdade: nenhuma peça do link diz o outro lado
        for (const it of b.procurar({ ...f, ordem: 'novos' })) {
          if (p.lado) expect(it.l, `${p.k} ${it.id}`).toBe(p.lado);
          if (p.pos) expect(it.pos === p.pos || it.pos === 'A', `${p.k} ${it.id}`).toBe(true);
        }
      }
    }
  });
  it('em todo carro: o ponto que mostra um número tem, no link, pelo menos uma peça cujo nome ABRE com a peça do título', () => {
    // a conta do teste é outra (a 1ª palavra do nome, sem "kit/par/jogo", contra as palavras da regra do ponto), não a
    // função do site: só o acessório no link ("Mangueira drenagem teto solar" no "Motor do teto solar") = 0, pátio
    const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-/g, '');
    const cabeca = (nome: string) => plano(nome).split(/[^a-z0-9]+/).filter((w) => w && !['kit', 'par', 'jogo', 'conjunto'].includes(w))[0] ?? '';
    const abre = (p: PontoQuente, nome: string) => p.eh === TIPO_INTEIRO || (Array.isArray(p.eh) ? p.eh : p.eh ? [p.eh] : [])
      .some((e) => e.cab.split(' ').map(plano).some((c) => [c, `${c}s`, `${c}es`, c.replace(/m$/, 'ns'), c.replace(/l$/, 'is'), c.replace(/ao$/, 'oes')].includes(cabeca(nome))));
    const erros: string[] = [];
    for (const c of [null, ...carrosDoIndice(ix)]) {
      const bc = c ? new Busca(indiceDoCarro(ix, c.marca, c.modelo)) : b;
      const carro = c ?? {};
      const contas = contarPontos((f) => bc.procurar(f), carro, PONTOS);
      for (const p of PONTOS) {
        if (!contas[p.k]) continue;
        const doLink = bc.procurar(filtrosDoQuente(p, carro));
        if (contas[p.k] !== doLink.length) erros.push(`${c ? `${c.marca} ${c.modelo}` : 'sem carro'} ${p.k}: mostra ${contas[p.k]}, o link tem ${doLink.length}`);
        if (!doLink.some((it) => abre(p, it.n) && !(p.fora && it.pos === p.fora))) erros.push(`${c ? `${c.marca} ${c.modelo}` : 'sem carro'} ${p.k} (${p.nome}): ${contas[p.k]} no link e nenhuma é a peça do título: ${doLink.slice(0, 3).map((it) => it.n).join('; ')}`);
      }
    }
    expect(erros.slice(0, 10)).toEqual([]);
  });
  it('3º estado, em todo carro: a peça ligada serve no carro, é desta parte, NÃO é a peça do título, e título + ligadas = o link (nada some)', () => {
    // a conta do "é a peça do título" é refeita aqui (a 1ª palavra do nome, o que a regra exige e o que ela proíbe no
    // resto do nome), sem chamar a função do site
    const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-/g, '');
    const palavras = (nome: string) => plano(nome).split(/[^a-z0-9]+/).filter(Boolean);
    const formas = (c: string) => [c, `${c}s`, `${c}es`, c.replace(/m$/, 'ns'), c.replace(/l$/, 'is'), c.replace(/ao$/, 'oes')];
    const diz = (ws: string[], lista: string) => lista.split(' ').map(plano).some((c) => formas(c).some((f) => ws.includes(f)));
    const abre = (p: PontoQuente, nome: string) => {
      if (p.eh === TIPO_INTEIRO) return true;
      const ws = palavras(nome);
      const cab = ws.filter((w) => !['kit', 'par', 'jogo', 'conjunto'].includes(w))[0] ?? '';
      return (Array.isArray(p.eh) ? p.eh : p.eh ? [p.eh] : []).some((e) => diz([cab], e.cab) && (!e.tem || diz(ws, e.tem)) && !(e.sem && diz(ws, e.sem)));
    };
    const erros: string[] = [];
    for (const c of [null, ...carrosDoIndice(ix)]) {
      const bc = c ? new Busca(indiceDoCarro(ix, c.marca, c.modelo)) : b;
      const carro = c ?? {};
      const quem = c ? `${c.marca} ${c.modelo}` : 'sem carro';
      const r = contarComLigadas((f) => bc.procurar(f), carro, PONTOS);
      for (const p of PONTOS) {
        const { n, ligadas } = r[p.k];
        if (!p.tipo) { if (n || ligadas.length) erros.push(`${quem} ${p.k}: ponto de pátio com peça`); continue; }
        const doLink = bc.procurar(filtrosDoQuente(p, carro));
        const daOutraPonta = (it: { pos?: string }) => !!p.fora && it.pos === p.fora;
        // com número: o link inteiro, sem ligadas (o catálogo mostra tudo)
        if (n) { if (n !== doLink.length || ligadas.length) erros.push(`${quem} ${p.k}: ${n} no número, ${doLink.length} no link, ${ligadas.length} ligadas`); continue; }
        // sem número: nada some do Raio-x (as ligadas são o link, menos a peça que DIZ a posição da outra ponta)
        const esperadas = doLink.filter((it) => !daOutraPonta(it)).map((it) => it.id).sort();
        if (JSON.stringify(ligadas.map((it) => it.id).sort()) !== JSON.stringify(esperadas)) erros.push(`${quem} ${p.k}: ligadas ${ligadas.length}, o link tem ${esperadas.length}`);
        const zonaEsperada = DE_OUTRA_ZONA[zona]?.[p.k] ?? zona;
        for (const it of ligadas) {
          if (abre(p, it.n) && !daOutraPonta(it)) erros.push(`${quem} ${p.k}: "${it.n}" é a peça do título e está nas ligadas`);
          if (c && !(it.b === c.marca && serveNoModelo(it, c.modelo))) erros.push(`${quem} ${p.k}: "${it.n}" é de ${it.b} ${it.m}`);
          // a parte do carro: a mesma conta do painel das zonas (a frente tem a regra dela em raioXFrente.test.ts)
          if (zona !== 'frente' && !zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).some((z) => z.k === zonaEsperada)) erros.push(`${quem} ${p.k}: "${it.n}" não é da zona ${zonaEsperada}`);
          if (p.lado && it.l !== p.lado) erros.push(`${quem} ${p.k}: "${it.n}" é do outro lado`);
        }
      }
    }
    expect(erros.slice(0, 10)).toEqual([]);
  });
  // a frente (o piloto) tem a regra dela em raioXFrente.test.ts (o para-lama fica na lateral, a alma vai sem posição)
  it.skipIf(zona === 'frente')('no estoque inteiro, as peças de cada ponto são peças DESTA parte do carro no painel do Raio-x', () => {
    const fora: string[] = [];
    for (const p of PONTOS) {
      if (!p.tipo || !p.sub) continue;
      const esperada = DE_OUTRA_ZONA[zona]?.[p.k] ?? zona;
      for (const it of b.procurar(filtrosDoQuente(p))) {
        const zs = zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).map((z) => z.k);
        if (!zs.includes(esperada)) fora.push(`${p.k}: ${it.n} (${zs.join('+') || 'sem zona'})`);
      }
    }
    expect(fora).toEqual([]);
  });
});

// Revisão 15, P2-2: o ponto cujo tipo do estoque junta a peça e os acessórios dela. Nomes escritos aqui (não dependem
// do estoque): só o acessório = ponto de pátio; a peça de verdade = o número do catálogo.
describe('vistas por dentro: a peça do link é a do desenho', () => {
  const ponto = (zona: string, k: string): PontoQuente => PONTOS_DA_ZONA[zona].find((p) => p.k === k)!;
  const casos: [string, string, { n: string; pos?: string }, boolean][] = [
    ['embaixo', 'escapamento', { n: 'Defletor escapamento' }, false],
    ['embaixo', 'escapamento', { n: 'Atuador válvula escape' }, false],
    ['embaixo', 'escapamento', { n: 'Escapamento traseiro silencioso', pos: 'T' }, true],
    ['embaixo', 'cardan', { n: 'Suporte cardan' }, false],
    ['embaixo', 'cardan', { n: 'Cardan' }, true],
    ['embaixo', 'diferencial', { n: 'Diferencial dianteiro', pos: 'D' }, false],
    ['embaixo', 'diferencial', { n: 'Diferencial traseiro', pos: 'T' }, true],
    ['teto', 'airbags', { n: 'Cortina airbag teto' }, true],
    ['teto', 'airbags', { n: 'Módulo airbag deflagrado' }, false],
    ['teto', 'airbags', { n: 'Sensor impacto airbag' }, false],
    ['traseira', 'sensores', { n: 'Sensor estacionamento traseiro', pos: 'T' }, true],
    ['traseira', 'sensores', { n: 'Sensor estacionamento dianteiro', pos: 'D' }, false],
    ['traseira', 'sensores', { n: 'Módulo sensor estacionamento' }, false],
    ['frente', 'alma', { n: 'Alma para-choque' }, true],
    // revisão 16, P2-1: a MESMA regra da lista do conserto (a alma é "Alma…"; o absorvedor e a espuma são peça ligada)
    ['frente', 'alma', { n: 'Absorvedor impacto' }, false],
    ['frente', 'painel-frontal', { n: 'Suporte radiador direito' }, false],
    ['frente', 'painel-frontal', { n: 'Suporte radiador' }, false],
    ['frente', 'painel-frontal', { n: 'Suporte braço direito radiador' }, false],
    ['frente', 'painel-frontal', { n: 'Suporte travessa radiador' }, true],
    ['frente', 'painel-frontal', { n: 'Painel frontal' }, true],
    ['teto', 'motor-teto', { n: 'Mangueira drenagem teto solar' }, false],
    ['teto', 'motor-teto', { n: 'Motor teto solar' }, true],
    ['traseira', 'fechadura', { n: 'Sensor tampa traseira' }, false],
    ['traseira', 'fechadura', { n: 'Batente tampa traseira' }, false],
    ['traseira', 'fechadura', { n: 'Maçaneta tampa traseira' }, false],
    ['traseira', 'fechadura', { n: 'Acabamento trava porta-malas' }, false],
    ['traseira', 'fechadura', { n: 'Fechadura tampa traseira' }, true],
    ['traseira', 'tampao', { n: 'Suporte direito bagagito' }, false],
    ['traseira', 'tampao', { n: 'Acabamento bagagito traseiro' }, false],
    ['traseira', 'tampao', { n: 'Tampão bagagito porta-malas' }, true],
    ['motor', 'caixa-filtro', { n: 'Ressonador filtro ar' }, false],
    ['motor', 'caixa-filtro', { n: 'Caixa filtro ar' }, true],
    ['frente', 'alma', { n: 'Alma para-choque traseiro', pos: 'T' }, false],
    ['frente', 'intercooler', { n: 'Chicote radiador intercooler' }, false],
    ['frente', 'intercooler', { n: 'Intercooler radiador' }, true],
    ['lateral-esquerda', 'forros', { n: 'Forro porta dianteira esquerda', pos: 'D' }, true],
    ['lateral-esquerda', 'forros', { n: 'Forro esquerdo porta-malas' }, false],
    ['lateral-direita', 'macanetas', { n: 'Suporte maçaneta traseira direita', pos: 'T' }, false],
  ];
  it.each(casos)('%s / %s × %o = %s', (zona, k, peca, esperado) => {
    expect(ehDoPonto(ponto(zona, k), peca)).toBe(esperado);
  });
  it('só com o acessório no link, o ponto conta 0 (pátio); com a peça, o número do link inteiro', () => {
    const p = ponto('embaixo', 'escapamento');
    const so = [{ id: 'a', n: 'Defletor escapamento' }, { id: 'b', n: 'Atuador válvula escape' }];
    expect(contarPontos(() => so, {}, [p])).toEqual({ escapamento: 0 });
    expect(contarPontos(() => [...so, { id: 'c', n: 'Escapamento silencioso traseiro' }], {}, [p])).toEqual({ escapamento: 3 });
    // o ponto que é o tipo inteiro (um grupo de acabamentos): toda peça do link vale
    const inteiro = ponto('interior', 'painel');
    expect(inteiro.eh).toBe(TIPO_INTEIRO);
    expect(contarPontos(() => so, {}, [inteiro])).toEqual({ painel: 2 });
  });
});

describe('vistas por dentro: o arquivo das contas do estoque inteiro', () => {
  it('o endereço é o que a página gera (pages/dados/raio-x-dentro.json.ts)', () => {
    expect(ARQUIVO_DENTRO).toBe('/dados/raio-x-dentro.json');
    expect(existsSync('src/pages/dados/raio-x-dentro.json.ts')).toBe(true);
  });
  it('no estoque fixo, toda vista tem pelo menos 6 pontos com peça (as tabelas apontam para tipos que a loja vende)', () => {
    // só no estoque fixo: no do dia um tipo pode zerar (a última peça vendeu) e a vista mostra o ponto cinza, sem erro
    const b = new Busca(indiceFixo());
    for (const k of VISTAS_K) {
      const n = contarPontos((f) => b.procurar(f), {}, PONTOS_DA_ZONA[k]);
      expect(Object.values(n).filter((x) => x > 0).length, k).toBeGreaterThanOrEqual(6);
    }
  });
  it.each(estoques())('no $nome, o arquivo de quem não tem carro: os números são os da conta e só o ponto SEM número leva peças ligadas', ({ ix }) => {
    const b = new Busca(ix);
    const j = dentroJson((f) => b.procurar(f), (it) => capaItem(it, 'A'));
    for (const k of VISTAS_K) {
      const c = contarComLigadas((f) => b.procurar(f), {}, PONTOS_DA_ZONA[k]);
      expect(j.z[k], k).toEqual(contarPontos((f) => b.procurar(f), {}, PONTOS_DA_ZONA[k]));
      for (const p of PONTOS_DA_ZONA[k]) {
        const l = j.l[k]?.[p.k] ?? [];
        expect(l.map((x) => x.id), `${k} ${p.k}`).toEqual(c[p.k].ligadas.map((it) => it.id));
        if (l.length) expect(j.z[k][p.k], `${k} ${p.k}`).toBe(0);
        // (o endereço `h` não é conferido aqui: o estoque fixo não guarda essa coluna)
        for (const x of l) { expect(x.n.length).toBeGreaterThan(0); expect(x.p).toBeGreaterThan(0); }
      }
    }
  });
  it('"1 ligada", "3 ligadas"', () => { expect(ligadasTxt(1)).toBe('1 ligada'); expect(ligadasTxt(3)).toBe('3 ligadas'); });
  it.each(estoques())('no $nome, a conta de todo ponto é um número (0 = cinza, pedido de pátio) e nunca passa do estoque', ({ ix }) => {
    const b = new Busca(ix);
    for (const k of VISTAS_K) {
      const n = contarPontos((f) => b.procurar(f), {}, PONTOS_DA_ZONA[k]);
      for (const p of PONTOS_DA_ZONA[k]) { expect(Number.isInteger(n[p.k]), `${k} ${p.k}`).toBe(true); expect(n[p.k]).toBeGreaterThanOrEqual(0); expect(n[p.k]).toBeLessThanOrEqual(ix.id.length); }
    }
  });
});
