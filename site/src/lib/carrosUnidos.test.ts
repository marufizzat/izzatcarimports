// Carros unidos (decisão do dono, 10/11: C180/C200/C320 = Classe C, 320i/330i = Série 3, 530i = Série 5, GLA200 = GLA,
// New Fiesta = Fiesta, New Civic = Civic). Revisão 14:
//  - P1-6: o "Meu carro" salvo com o apelido vira o principal NA LEITURA (mesmo ano) e todo lugar que decide "tem peça?"
//    passa a concordar (abertura, "Chegou para o seu carro", seletor, faixa do catálogo, Raio-x);
//  - itens 12 e 27: a tela e o WhatsApp mostram o carro UMA vez, pelo principal;
//  - item 19: <title>, description e JSON-LD guardam as versões do anúncio e o código.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import {
  UNIDOS, principalDe, carroDe, lerMeuCarro, migrarAntes, gruposModelos, nomeModelos, nomeModelosVersoes, nomeSoVersoes,
  estoqueDoCarro, CHAVE, type Unidos,
} from './meuCarro';
import { chegouAntes, chegouParaOCarro } from './chegouCarro';
import { conviteCarro, comCarroNaFrase, carroSalvoTxt } from './whats';
import { linhaCarro } from '../components/catalogo/etiqueta';
import { nomeCompleto, nomeMensagem, tituloPeca, titulosPecas, TITULO_MAX } from './nomePeca';
import { descricaoPeca, descricaoLink, tituloLink, DESCRICAO_MAX } from './descricao';
import { Busca, type Indice } from './busca';

const MAPA: Unidos = {
  'BMW|320i': 'Série 3', 'BMW|330i': 'Série 3', 'BMW|530i': 'Série 5', 'Ford|New Fiesta': 'Fiesta', 'Honda|New Civic': 'Civic',
  'Mercedes-Benz|C180': 'Classe C', 'Mercedes-Benz|C200': 'Classe C', 'Mercedes-Benz|C320': 'Classe C', 'Mercedes-Benz|GLA200': 'GLA',
};
const temDados = existsSync('src/data/unidos.json') && existsSync('src/data/resumo.json') && existsSync('src/data/pecas.json') && existsSync('public/dados/busca.json');

describe('o Meu carro salvo com um apelido vira o principal na leitura', () => {
  it('os 8 apelidos do site no ar (e o 330i): o modelo troca, o ano fica, a arte do apelido sai', () => {
    for (const [k, principal] of Object.entries(MAPA)) {
      const [b, m] = k.split('|');
      expect(principalDe(b, m, MAPA)).toBe(principal);
      expect(carroDe({ b, m, y: 2012, a: 'arte-do-apelido', as: [600, 900, 1200] }, MAPA)).toEqual({ b, m: principal, y: 2012 });
      expect(carroDe({ b, m, y: null }, MAPA)).toEqual({ b, m: principal, y: null });
    }
  });
  it('quem não é apelido fica igual (com a arte); o principal também', () => {
    expect(carroDe({ b: 'Volvo', m: 'XC60', y: 2019, a: 'volvo-xc60', as: [600, 1200] }, MAPA)).toEqual({ b: 'Volvo', m: 'XC60', y: 2019, a: 'volvo-xc60', as: [600, 1200] });
    expect(carroDe({ b: 'Mercedes-Benz', m: 'Classe C', y: 2012 }, MAPA)).toEqual({ b: 'Mercedes-Benz', m: 'Classe C', y: 2012 });
    // o mesmo nome noutra marca não é apelido
    expect(carroDe({ b: 'Fiat', m: 'C180', y: null }, MAPA)).toEqual({ b: 'Fiat', m: 'C180', y: null });
    expect(principalDe('Mercedes-Benz', 'c 180', MAPA)).toBe('Classe C');
  });

  it('antes da pintura (migrarAntes, copiado por toString): regrava o localStorage UMA vez e troca o ?modelo= do catálogo', () => {
    const mem = new Map<string, string>();
    let gravou = 0;
    const local = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { gravou++; mem.set(k, v); } };
    const estado = { url: '' };
    const f = new Function('localStorage', 'location', 'history', 'chave', 'mapa', 'url', `return (${migrarAntes.toString()})(chave, mapa, url)`);
    const rodar = (search: string, url = true) => f(local, { search, pathname: '/catalogo.html', hash: '' },
      { state: null, replaceState: (_s: unknown, _t: string, u: string) => { estado.url = u; } }, CHAVE, MAPA, url);
    mem.set(CHAVE, JSON.stringify({ b: 'Mercedes-Benz', m: 'C180', y: 2012, a: 'mercedes-benz-c180', as: [600] }));
    rodar('?marca=Mercedes-Benz&modelo=C180&ano=2012');
    expect(JSON.parse(mem.get(CHAVE)!)).toEqual({ b: 'Mercedes-Benz', m: 'Classe C', y: 2012 });
    expect(estado.url).toBe('/catalogo.html?marca=Mercedes-Benz&modelo=Classe+C&ano=2012');
    expect(gravou).toBe(1);
    // de novo: já é o principal, nada regrava nem troca
    estado.url = '';
    rodar('?marca=Mercedes-Benz&modelo=Classe+C&ano=2012');
    expect(gravou).toBe(1);
    expect(estado.url).toBe('');
    // sem `url` (home, página do carro): o endereço nunca muda; carro que não é apelido fica como está
    mem.set(CHAVE, JSON.stringify({ b: 'Volvo', m: 'XC60', y: 2019 }));
    rodar('?marca=Ford&modelo=New+Fiesta', false);
    expect(estado.url).toBe('');
    expect(gravou).toBe(1);
    // lixo no armazenamento: não quebra
    mem.set(CHAVE, 'lixo');
    expect(() => rodar('')).not.toThrow();
  });
});

describe.skipIf(!temDados)('com os dados de agora: os apelidos e o principal dão as MESMAS contas', () => {
  const resumo = JSON.parse(readFileSync('src/data/resumo.json', 'utf-8')) as { aliases: { b: string; de: string; m: string }[]; marcas: { n: string; m: { n: string }[] }[] };
  const ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8')) as Indice;
  const toda = new Busca(ix);

  it('o mapa do build (src/data/unidos.json) tem todo apelido do resumo, e é o que o site usa', () => {
    expect(resumo.aliases.length).toBeGreaterThanOrEqual(8);
    for (const a of resumo.aliases) expect(UNIDOS[`${a.b}|${a.de}`], `${a.b} ${a.de}`).toBe(a.m);
    expect(Object.keys(UNIDOS)).toEqual(Object.keys(JSON.parse(readFileSync('src/data/unidos.json', 'utf-8'))));
  });

  it('cada apelido salvo: o carro lido é o principal e a garagem, a abertura e o "Chegou" dizem que TEM peça, com a conta do principal', async () => {
    const { garagem } = await import('./garagem');
    const g = garagem();
    const modelos = JSON.stringify(Object.fromEntries(g.marcas.map((m) => [m.n, m.modelos.map((x) => x.n)])));
    const mem = new Map<string, string>();
    const gl = globalThis as any;
    const antigo = gl.localStorage;
    gl.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    try {
      for (const [k, principal] of Object.entries(UNIDOS)) {
        const [b, apelido] = k.split('|');
        // o que o site no ar gravou
        mem.set(CHAVE, JSON.stringify({ b, m: apelido, y: null }));
        const lido = lerMeuCarro()!;
        expect(lido, k).toEqual({ b, m: principal, y: null });
        // regravado uma vez: a leitura seguinte (e os scripts de antes da pintura) já acham o principal
        expect(JSON.parse(mem.get(CHAVE)!), k).toEqual({ b, m: principal, y: null });
        // a garagem não lista o apelido, lista o principal
        const marca = g.marcas.find((x) => x.n === b)!;
        expect(marca.modelos.some((x) => x.n === apelido), `${k} fora do seletor`).toBe(false);
        const doPrincipal = estoqueDoCarro(g, { b, m: principal, y: null });
        expect(doPrincipal.estado, k).toBe('ok');
        // seletor/faixa do catálogo (estoqueDoCarro), abertura e "Chegou" (chegouAntes) e o catálogo: as mesmas contas
        expect(estoqueDoCarro(g, lido), k).toEqual(doPrincipal);
        expect(chegouAntes(mem.get(CHAVE)!, modelos)!.estado, k).toBe('trilho');
        const nPrincipal = toda.procurar({ marca: b, modelo: principal }).length;
        expect(chegouParaOCarro((f) => toda.procurar(f), lido).total, k).toBe(nPrincipal);
        expect(doPrincipal.pecas, k).toBe(nPrincipal);
        // e nunca menos peças que o apelido tinha (C180 2012: 39 × 46 no Classe C)
        expect(nPrincipal, k).toBeGreaterThanOrEqual(toda.procurar({ marca: b, modelo: apelido }).length);
      }
    } finally { gl.localStorage = antigo; }
  });

  it('nenhum modelo das listas do site é apelido (resumo das marcas e garagem)', async () => {
    const { garagem } = await import('./garagem');
    const ruins = garagem().marcas.flatMap((m) => m.modelos.filter((x) => principalDe(m.n, x.n)).map((x) => `${m.n} ${x.n}`));
    expect(ruins).toEqual([]);
  });
});

describe('o carro unido aparece UMA vez na tela e no WhatsApp', () => {
  const classeC = { n: 'Luz teto cortesia', b: 'Mercedes-Benz', m: 'Classe C', ms: ['Classe C', 'C180', 'C200'], y: [2001, 2011] as [number, number], oem: 'A2038200000', p: 100 };
  const fiesta = { b: 'Ford', m: 'Fiesta', ms: ['Fiesta', 'New Fiesta'] };
  const bmw = { b: 'BMW', m: 'Série 3', ms: ['Série 3', 'Série 5', '330i', '530i', 'X3', 'X5'] };
  it('nomeModelos: só os principais; as versões entre parênteses em nomeModelosVersoes', () => {
    expect(nomeModelos(classeC, MAPA)).toBe('Mercedes-Benz Classe C');
    expect(nomeModelos(fiesta, MAPA)).toBe('Ford Fiesta');
    expect(nomeModelos(bmw, MAPA)).toBe('BMW Série 3, Série 5, X3 e X5');
    expect(nomeModelosVersoes(classeC, MAPA)).toBe('Mercedes-Benz Classe C (C180, C200)');
    expect(nomeModelosVersoes(bmw, MAPA)).toBe('BMW Série 3 (330i), Série 5 (530i), X3 e X5');
    expect(nomeSoVersoes(classeC, MAPA)).toBe('Mercedes-Benz C180 e C200');
    expect(gruposModelos({ b: 'Mercedes-Benz', m: 'Classe C', ms: ['Classe C', 'C180', 'C200', 'C250', 'C320'] }, MAPA))
      .toEqual([{ m: 'Classe C', v: ['C180', 'C200', 'C320'] }, { m: 'C250', v: [] }]);
  });
  it('peça sem carro unido: igual a antes', () => {
    const p = { b: 'Volkswagen', m: 'Virtus', ms: ['Virtus', 'Polo', 'Up'] };
    expect(nomeModelos(p, MAPA)).toBe('Volkswagen Virtus, Polo e Up');
    expect(nomeModelosVersoes(p, MAPA)).toBe('Volkswagen Virtus, Polo e Up');
    expect(nomeSoVersoes(p, MAPA)).toBe('');
    expect(nomeModelos({ b: 'Volvo', m: 'XC60' }, MAPA)).toBe('Volvo XC60');
    // apelido sem o principal na peça (não acontece nos dados): fica o nome que a peça tem
    expect(nomeModelos({ b: 'Mercedes-Benz', m: 'C180', ms: ['C180', 'GLA'] }, MAPA)).toBe('Mercedes-Benz C180 e GLA');
  });
});

describe.skipIf(!temDados)('com as peças de agora: tela, WhatsApp e o que o Google lê', () => {
  type P = { id: string; n: string; b: string; m: string; ms?: string[]; y: [number, number] | null; oem: string; p: number; t: string };
  const pecas = JSON.parse(readFileSync('src/data/pecas.json', 'utf-8')) as P[];
  const unidas = pecas.filter((p) => gruposModelos(p).some((g) => g.v.length));
  const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cod = (p: P) => { const c = (p.oem || '').trim().split(/[\s,;/|]+/)[0] || ''; return c; };

  it('há peças de carro unido, e nenhuma escreve o apelido ao lado do principal (cartão, h1, mensagem, prévia do link)', () => {
    expect(unidas.length).toBeGreaterThan(100);
    const ruins: string[] = [];
    for (const p of unidas) {
      const apelidos = gruposModelos(p).flatMap((g) => g.v);
      const telas = [nomeModelos(p), linhaCarro(p.b, p.m, p.y, p.ms).carro, nomeMensagem(p), tituloLink(p), descricaoLink(p, '', brl(p.p))];
      // "C180" como palavra inteira (o "Série 3" não contém "330i"; "New Fiesta" contém "Fiesta", não o contrário)
      for (const a of apelidos) for (const t of telas) if (new RegExp(`(^|[^\\p{L}\\p{N}])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u').test(t.replace(p.n, ''))) ruins.push(`${p.id}: "${t}" diz ${a}`);
    }
    expect(ruins.slice(0, 5)).toEqual([]);
  });

  it('a mensagem do cartão sem carro salvo já leva o modelo quando a peça é de UM carro unido ("Classe C|C180|C200")', () => {
    expect(conviteCarro('Mercedes-Benz', 'Classe C', 'Classe C|C180|C200')).toBe('Mercedes-Benz Classe C, ano ____');
    expect(conviteCarro('Volvo', 'S60', 'S60|XC60')).toBe('Volvo ____, ano ____');
    expect(conviteCarro('Volvo', 'S60', '|')).toBe('Volvo ____, ano ____');
    expect(conviteCarro('Volvo', 'XC60', '')).toBe('Volvo XC60, ano ____');
  });

  it('a peça que saía da 1ª tela (MLB7658370388, "Classe C, C180, C200, C250 e C320" em 2 linhas): o carro cabe numa linha', () => {
    const p = pecas.find((x) => x.id === 'MLB7658370388');
    if (!p) return;
    expect(nomeModelos(p)).toBe('Mercedes-Benz Classe C e C250');
    // nenhuma peça de carro unido ficou com o carro mais comprido do que tinha (a linha só encurta)
    for (const x of unidas) expect(nomeModelos(x).length, x.id).toBeLessThan([x.b, ...(x.ms ?? [x.m])].join(', ').length);
  });

  it('o Google continua lendo as versões: o nome do JSON-LD e do feed leva todas; o <title> nunca perde a versão para ficar só com o principal', () => {
    const titulos = titulosPecas(pecas);
    const semVersao: string[] = [];
    for (const p of unidas) {
      const versoes = gruposModelos(p).flatMap((g) => g.v);
      for (const v of versoes) expect(nomeCompleto(p), p.id).toContain(v);
      const t = titulos.get(p.id)!;
      expect(t.length, `${p.id} ${t}`).toBeLessThanOrEqual(Math.max(TITULO_MAX, tituloPeca(p, { extra: p.id }).length));
      // o título leva alguma versão do 1º carro sempre que ele tem versão (é o que o cliente digita: "módulo vidro c320")
      const doPrimeiro = gruposModelos(p)[0].v;
      if (doPrimeiro.length && !doPrimeiro.some((v) => t.includes(v))) semVersao.push(`${p.id}: ${t}`);
    }
    if (semVersao.length) console.info(`títulos de carro unido sem versão (nome longo demais): ${semVersao.length}\n  ${semVersao.slice(0, 8).join('\n  ')}`);
    expect(semVersao.length).toBeLessThanOrEqual(Math.ceil(unidas.length * 0.03));
    const c320 = pecas.find((x) => x.id === 'MLB4799046007');
    if (c320) expect(titulos.get(c320.id)).toContain('C320');
  });

  it('a description (Google e JSON-LD) não perde mais o código nos carros unidos, e cabe em 160', async () => {
    const { codigoDaPeca } = await import('./dados');
    const sem: string[] = [];
    let comCodigo = 0;
    for (const p of unidas) {
      const c = codigoDaPeca(p.oem);
      const d = descricaoPeca(p, c, brl(p.p));
      expect(d.length, p.id).toBeLessThanOrEqual(DESCRICAO_MAX);
      if (!c) continue;
      comCodigo++;
      if (!d.includes(`código ${c}`)) sem.push(`${p.id}: ${d}`);
    }
    if (sem.length) console.info(`descriptions de carro unido sem o código (nome longo demais): ${sem.length} de ${comCodigo}\n  ${sem.slice(0, 6).join('\n  ')}`);
    expect(comCodigo).toBeGreaterThan(50);
    expect(sem.length).toBeLessThanOrEqual(Math.ceil(comCodigo * 0.05));
    void cod;
  });
});

describe('a lacuna do carro nas mensagens de dúvida vira o carro salvo (revisão 14, item 20)', () => {
  const xc60 = carroSalvoTxt({ b: 'Volvo', m: 'XC60', y: 2019 });
  it('"Quero confirmar se esta peça serve no meu carro": nunca "Meu carro é Renault ____" para quem tem um XC60', () => {
    const msg = 'Olá! Vim pelo site da Izzat Car. Quero confirmar se esta peça serve no meu carro:\n\nMaçaneta interna esquerda · Renault Sandero e Duster 2008 a 2022 · Cód. 8200733848\nhttps://izzatcarimports.com.br/peca/x-MLB1.html\n\nMeu carro é Renault ____, ano ____.';
    expect(comCarroNaFrase(msg, xc60)).toBe(msg.replace('Meu carro é Renault ____, ano ____.', 'Meu carro é Volvo XC60 2019.'));
    expect(comCarroNaFrase('x\n\nMeu carro é Volvo XC60, ano ____.', xc60)).toBe('x\n\nMeu carro é Volvo XC60 2019.');
    expect(comCarroNaFrase('x\n\nMeu carro é ____ (modelo) ____ (ano).', xc60)).toBe('x\n\nMeu carro é Volvo XC60 2019.');
  });
  it('as outras chamadas do site: o resto da frase fica', () => {
    expect(comCarroNaFrase('Quero saber se uma peça serve no meu carro. Meu carro é: ____ (modelo) ____ (ano). A peça é: ____', xc60))
      .toBe('Quero saber se uma peça serve no meu carro. Meu carro é Volvo XC60 2019. A peça é: ____');
    expect(comCarroNaFrase('Não achei a peça no site. Meu carro é ____ (modelo e ano) e procuro: ____', xc60))
      .toBe('Não achei a peça no site. Meu carro é Volvo XC60 2019 e procuro: ____');
    expect(comCarroNaFrase('Quero que vocês confiram uma peça. Meu carro é ____ (modelo) ____ (ano) e a peça é: ____', xc60))
      .toBe('Quero que vocês confiram uma peça. Meu carro é Volvo XC60 2019 e a peça é: ____');
    expect(comCarroNaFrase('Antes de comprar, quero confirmar se uma peça serve no meu carro. Meu carro é: ____', xc60))
      .toBe('Antes de comprar, quero confirmar se uma peça serve no meu carro. Meu carro é Volvo XC60 2019');
  });
  it('salvo sem ano: o ano continua em branco; sem carro ou sem a lacuna: igual', () => {
    expect(comCarroNaFrase('Meu carro é Renault ____, ano ____.', carroSalvoTxt({ b: 'Volvo', m: 'XC60', y: null }))).toBe('Meu carro é Volvo XC60, ano ____.');
    expect(comCarroNaFrase('Meu carro é Renault ____, ano ____.', '')).toBe('Meu carro é Renault ____, ano ____.');
    expect(comCarroNaFrase('Procuro uma peça para Volvo XC60 2019.', xc60)).toBe('Procuro uma peça para Volvo XC60 2019.');
  });
});
