import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { ZONAS, ARTE, NA_GALERIA, contarZonas, pecasDaZona, zonasDaPeca, zonaOndeFica, nomeEh, linkLinha, linkZona, linkDoFiltro, falaDaZona, filtrosLinha, codigoDaFoto, fotoDoCodigo, lerRaioX } from './raioX';
import { Busca, type Indice } from './busca';
import { indiceFixo, estoques, carroMaisCheio, BLOCOS_DA_LOJA, TIPOS_DA_LOJA } from '../../testes/estoques';

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

// Revisão 14, P1-1: sem carro salvo (a maioria dos visitantes) o painel da home quebrava ao montar o "Ver todas no
// catálogo" (lia a marca de um carro que não existe). O link sai do filtro em uso: sem carro, só a zona.
describe('linkZona: "Ver todas no catálogo" do painel', () => {
  it('home SEM carro: /catalogo.html?zona=<k> (nada de marca nem modelo)', () => {
    for (const z of ZONAS) expect(linkZona(z.k)).toBe(`/catalogo.html?zona=${z.k}`);
    expect(linkZona('frente', {})).toBe('/catalogo.html?zona=frente');
    expect(linkDoFiltro()).toBe('/catalogo.html');
  });
  it('com o carro das contagens: o carro antes, a zona no fim (os mesmos parâmetros do catálogo)', () => {
    expect(linkZona('motor', { marca: 'Volvo', modelo: 'XC60', ano: 2019 })).toBe('/catalogo.html?marca=Volvo&modelo=XC60&ano=2019&zona=motor');
    expect(linkZona('teto', { marca: 'Mercedes-Benz', modelo: 'Classe C' })).toBe('/catalogo.html?marca=Mercedes-Benz&modelo=Classe+C&zona=teto');
    expect(linkDoFiltro({ marca: 'Volvo', modelo: 'XC60', ano: 2019 })).toBe('/catalogo.html?marca=Volvo&modelo=XC60&ano=2019');
  });
  it('o que o leitor de tela ouve quando o painel troca', () => {
    expect(falaDaZona('Frente', 119, 19)).toBe('Frente: 119 peças, 19 tipos de peça.');
    expect(falaDaZona('Motor', 1, 1, 'do seu XC60 2019')).toBe('Motor: 1 peça do seu XC60 2019.');
    expect(falaDaZona('Teto', 0, 0, 'do seu XC60 2019')).toBe('Teto: nenhuma peça do seu XC60 2019 agora.');
  });
});

// Os nomes do mapa conferem no VOCABULÁRIO da loja (testes/estoques.ts), nunca no estoque do dia: um tipo some do índice
// quando a última peça dele vende (com 16% do estoque vendido, 5+ nomes do mapa saíam do índice e o robô parava a loja).
describe('o mapa e o vocabulário da loja', () => {
  it('todo bloco e todo tipo do mapa é um nome que a loja sabe escrever (pega acento errado e tipo renomeado)', () => {
    const ruins: string[] = [];
    for (const z of ZONAS) for (const g of z.grupos) {
      if (!BLOCOS_DA_LOJA.has(g.tipo)) ruins.push(`${z.k}: bloco "${g.tipo}"`);
      for (const s of [...(g.subs ?? []), ...(g.sem ?? [])]) if (!TIPOS_DA_LOJA.has(s)) ruins.push(`${z.k}: tipo "${s}" (${g.tipo})`);
    }
    expect(ruins).toEqual([]);
  });
  it('no estoque fixo, toda zona tem peça (o mapa aponta para o que a loja vende)', () => {
    const fixa = new Busca(indiceFixo());
    for (const c of contarZonas(fixa.procurar.bind(fixa))) { expect(c.n, c.k).toBeGreaterThan(0); expect(c.linhas.length, c.k).toBeGreaterThan(0); }
  });
});

// O mapa contra o estoque do dia: muda a cada rodada (30 min). Só REGRAS: nunca exige peça numa zona nem num tipo (zona
// sem peça fica cinza no site), só que o número de cada linha seja o do catálogo.
describe.skipIf(!existsSync(buscaArq))('o mapa contra o estoque de agora', () => {
  const ix = JSON.parse(readFileSync(buscaArq, 'utf-8')) as Indice;
  const toda = new Busca(ix);
  const procurar = toda.procurar.bind(toda);
  const contas = contarZonas(procurar);

  it('toda linha leva ao catálogo com o MESMO número (e as peças são do bloco e do tipo); zona com peça tem linha', () => {
    const resumo: string[] = [];
    for (const c of contas) {
      const z = ZONAS.find((x) => x.k === c.k)!;
      expect(c.linhas.length > 0, z.nome).toBe(c.n > 0);
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

  it('home sem carro: o catálogo aberto por ?zona=<k> mostra o MESMO número que o painel conta, nas 9 zonas', () => {
    for (const c of contas) {
      const u = new URL(linkZona(c.k), 'https://x');
      expect([...u.searchParams.keys()]).toEqual(['zona']);
      expect(toda.procurar({ zona: u.searchParams.get('zona')! }).length, c.k).toBe(c.n);
    }
  });

  it('carro salvo sem peça ou sem rede (as contagens caem para o estoque inteiro, filtro vazio): o link também é do estoque inteiro', () => {
    // o painel usa o MESMO filtro para as contagens e para o link: com filtro vazio, nunca o carro salvo por fora
    const filtro = {};
    for (const c of contas) expect(toda.procurar({ zona: new URL(linkZona(c.k, filtro), 'https://x').searchParams.get('zona')! }).length).toBe(c.n);
  });

  it('as laterais só têm peças do lado delas', () => {
    const esq = contas.find((c) => c.k === 'lateral-esquerda')!;
    const dir = contas.find((c) => c.k === 'lateral-direita')!;
    expect(esq.linhas.every((l) => l.lado === 'E')).toBe(true);
    expect(dir.linhas.every((l) => l.lado === 'D')).toBe(true);
  });

  it('com o carro: o arquivo só do carro dá as MESMAS contas que o índice inteiro filtrado (marca, modelo, ano)', async () => {
    // o carro com mais peças do estoque do dia (nunca um carro escrito aqui: ele pode ficar sem peça)
    const cheio = carroMaisCheio(ix);
    if (!cheio) return;
    const carro = { b: cheio.marca, m: cheio.modelo };
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
    // nenhuma zona conta mais peças do que o carro tem
    const doCarroN = toda.procurar(f).length;
    for (const c of a) expect(c.n, c.k).toBeLessThanOrEqual(doCarroN);
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
  it('só a peça que serve na frente e atrás tem duas zonas; no estoque fixo, quase todo o estoque tem zona (94%+)', () => {
    const medir = (itens: Busca['itens']) => {
      let com = 0, duas = 0;
      for (const it of itens) {
        const zs = zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos });
        if (zs.length) com++;
        if (zs.length > 1) {
          duas++;
          expect(it.pos, it.n).toBe('A');
          expect(zs.map((z) => z.k)).toEqual(['frente', 'traseira']);
        }
      }
      return { com, duas };
    };
    medir(b.itens);   // a regra, no estoque do dia
    // as proporções, só no estoque fixo (no do dia elas mudam com o que vendeu)
    const fixa = new Busca(indiceFixo()).itens;
    const m = medir(fixa);
    expect(m.com / fixa.length).toBeGreaterThan(0.94);
    expect(m.duas).toBeLessThan(10);
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

// Revisão 15, P2-1: a legenda "Fica na frente do carro" AFIRMA onde a peça está; o painel só junta o que a pessoa
// procura ali. A legenda é mais exigente: tipo sem lugar certo, posição oposta ou nome de outro lugar = sem o bloco.
describe('o "Onde fica" afirma o lugar: mais exigente que o painel', () => {
  const k = (p: Parameters<typeof zonaOndeFica>[0]) => zonaOndeFica(p)?.k ?? null;
  // [bloco, tipo, nome, lado, posição] -> a zona (null = sem o bloco); nomes escritos aqui, nenhum depende do estoque
  const casos: [string, string, string, string, string, string | null][] = [
    ['Rodas', 'Macacos e Chaves de Roda', 'Chave roda', '', '', null],
    ['Rodas', 'Macacos e Chaves de Roda', 'Kit macaco chave roda triângulo', '', '', null],
    ['Rodas', 'Suportes do Estepe', 'Suporte estepe', '', '', null],
    ['Rodas', 'Rodas', 'Roda aro 17', '', '', 'rodas'],
    ['Freios', 'Sensores do Freio', 'Sensor pedal freio', '', '', null],
    ['Freios', 'Sensores ABS', 'Sensor ABS dianteiro', '', 'D', 'rodas'],
    ['Freios', 'Mangueiras e Flexíveis do Freio', 'Mangueira do hidrovácuo', '', '', null],
    ['Freios', 'Mangueiras e Flexíveis do Freio', 'Flexível freio traseiro', '', 'T', 'rodas'],
    ['Limpador e Lavador', 'Braços do Limpador', 'Braço traseiro do limpador', '', 'T', null],
    ['Limpador e Lavador', 'Braços do Limpador', 'Braço limpador para-brisa', '', '', 'frente'],
    ['Módulos e Elétrica', 'Sensores de Estacionamento', 'Sensor estacionamento dianteiro', '', 'D', null],
    ['Módulos e Elétrica', 'Sensores de Estacionamento', 'Sensor estacionamento traseiro', '', 'T', 'traseira'],
    ['Para-choques e Lataria', 'Suportes da Placa', 'Suporte placa dianteiro', '', 'D', null],
    ['Acabamentos e Forros', 'Luzes Internas', 'Luz cortesia porta dianteira', '', 'D', null],
    ['Acabamentos e Forros', 'Luzes Internas', 'Luz teto cortesia', '', '', 'teto'],
    ['Acabamentos e Forros', 'Luzes Internas', 'Luz cortesia teto porta óculos', '', '', 'teto'],
    ['Acabamentos e Forros', 'Alças e Puxadores', 'Puxador interno porta-malas', '', '', null],
    ['Acabamentos e Forros', 'Alças e Puxadores', 'Alça teto dianteiro', '', 'D', 'teto'],
    ['Injeção e Combustível', 'Portinholas e Tampas do Tanque', 'Portinhola tanque combustível', '', '', null],
    ['Injeção e Combustível', 'Tanques de Combustível', 'Tanque combustível', '', '', 'embaixo'],
    ['Injeção e Combustível', 'Bombas de Combustível', 'Relé bomba combustível', '', '', null],
    ['Acabamentos e Forros', 'Forros', 'Forro esquerdo porta-malas', 'E', '', null],
    ['Acabamentos e Forros', 'Forros', 'Forro porta dianteira esquerda', 'E', 'D', 'lateral-esquerda'],
    ['Airbag e Segurança', 'Triângulos de Segurança', 'Triângulo segurança', '', '', null],
    ['Câmbio e Transmissão', 'Módulos do Câmbio e da Tração', 'Módulo câmbio automático', '', '', null],
    ['Câmbio e Transmissão', 'Coxins do Câmbio', 'Coxim câmbio', '', '', 'embaixo'],
    ['Para-choques e Lataria', 'Vigas de Reforço', 'Barra reforco frontal superior', '', 'D', null],
    ['Módulos e Elétrica', 'Caixas de Fusíveis', 'Caixa fusíveis motor', '', '', null],
    ['Módulos e Elétrica', 'Caixas de Fusíveis', 'Caixa fusíveis', '', '', 'interior'],
    ['Faróis e Lanternas', 'Faróis', 'Farol esquerdo', 'E', '', 'frente'],
    ['Retrovisores', 'Retrovisores Externos', 'Retrovisor elétrico direito', 'D', '', 'lateral-direita'],
  ];
  it.each(casos)('%s > %s: "%s" (%s%s) fica em %s', (c, s, n, l, pos, esperado) => {
    expect(k({ c, s, n, l: l as 'E' | 'D' | '', pos: pos as 'D' | 'T' | '' })).toBe(esperado);
  });

  const SEM_LUGAR = ['Macacos e Chaves de Roda', 'Suportes do Estepe', 'Sensores do Freio', 'Portinholas e Tampas do Tanque', 'Módulos do Câmbio e da Tração', 'Triângulos de Segurança', 'Alarmes e Sirenes'];
  it('os tipos sem lugar certo são nomes que a loja sabe escrever', () => {
    for (const t of SEM_LUGAR) expect(TIPOS_DA_LOJA.has(t), t).toBe(true);
  });
  it.each(estoques())('no $nome: a zona afirmada é sempre UMA zona do painel; a frente nunca diz traseira, a traseira nunca dianteira, a lateral é a do lado da peça', ({ ix }) => {
    const b = new Busca(ix);
    const erros: string[] = [];
    let com = 0;
    for (const it of b.itens) {
      const z = zonaOndeFica({ c: it.c, s: it.s, l: it.l, pos: it.pos, n: it.n });
      if (!z) continue;
      com++;
      const doPainel = zonasDaPeca({ c: it.c, s: it.s, l: it.l, pos: it.pos }).map((q) => q.k);
      if (doPainel.length !== 1 || doPainel[0] !== z.k) erros.push(`${it.id} ${it.n}: ${z.k} fora do painel (${doPainel.join('+')})`);
      if (z.k === 'frente' && it.pos === 'T') erros.push(`${it.id} ${it.n}: traseira na frente`);
      if (z.k === 'traseira' && it.pos === 'D') erros.push(`${it.id} ${it.n}: dianteira na traseira`);
      if (z.k === 'lateral-esquerda' && it.l !== 'E') erros.push(`${it.id} ${it.n}: lateral esquerda sem ser esquerda`);
      if (z.k === 'lateral-direita' && it.l !== 'D') erros.push(`${it.id} ${it.n}: lateral direita sem ser direita`);
      // tipo sem lugar certo (a chave de roda, o macaco, o sensor do freio, a portinhola, o módulo do câmbio…): sem legenda
      if (SEM_LUGAR.includes(it.s) || /^(chave (de )?roda|macaco|kit macaco|portinhola)\b/i.test(it.n)) erros.push(`${it.id} ${it.n}: ${z.k}`);
      if (z.k === 'teto' && /\bporta\b/i.test(it.n) && !/\bteto\b/i.test(it.n)) erros.push(`${it.id} ${it.n}: luz/peça de porta no teto`);
    }
    expect(erros.slice(0, 12)).toEqual([]);
    // a legenda nunca afirma mais que o painel
    expect(com).toBeLessThanOrEqual(b.itens.length);
  });

  it('a regra do nome (nomeEh): a 1ª palavra é a da peça; "Kit"/"Par" na frente não contam; a composta vale inteira', () => {
    expect(nomeEh({ cab: 'macaneta' }, 'Maçaneta externa dianteira esquerda')).toBe(true);
    expect(nomeEh({ cab: 'macaneta' }, 'Suporte maçaneta traseira')).toBe(false);
    expect(nomeEh({ cab: 'radiador' }, 'Kit radiador completo')).toBe(true);
    expect(nomeEh({ cab: 'forro', tem: 'porta' }, 'Forro porta-malas')).toBe(false);
    expect(nomeEh({ cab: 'para-choque' }, 'Parachoque traseiro')).toBe(true);
    expect(nomeEh({ cab: 'farol' }, 'Faróis dianteiros')).toBe(true);
    expect(nomeEh(undefined, 'Farol')).toBe(false);
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
