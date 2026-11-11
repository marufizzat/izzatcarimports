import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { sobreposicao, mesmaGeracao, doMesmoCarro, MAX_CARRO, MIN_MESMA, vaiJunto, grupoDa, ladoDa, zonaDa, GRUPOS, JUNTO, MAX_JUNTO, FORA_DO_MOTOR, codigosDe } from './relacionadas';
import { serveNoModelo, anosNoModelo } from './meuCarro';
import type { Peca } from './dados';

const peca = (o: Partial<Peca>): Peca => ({
  id: 'MLB0', slug: 's', t: 't', n: 'Peça', p: 100, fotos: ['f'], ml: '', f: false, b: 'Volkswagen', m: 'Golf',
  y: null, c: 'Iluminação', s: 'Faróis Dianteiros', oem: '', o: '', ficha: [], desc: '', rel: [], ...o,
});

describe('relacionadas: geração pelo ano', () => {
  it('sobreposição = parte da faixa menor', () => {
    expect(sobreposicao([2014, 2021], [2013, 2020])).toBeCloseTo(7 / 8);
    expect(sobreposicao([2014, 2021], [1999, 2006])).toBe(0);
    expect(sobreposicao([2005, 2005], [2000, 2013])).toBe(1);
  });
  it('encostar um ano não é a mesma geração (Golf 1999–2014 x 2014–2021)', () => {
    expect(mesmaGeracao([2014, 2021], [1999, 2014])).toBe(false);
    expect(mesmaGeracao([2014, 2021], [2013, 2020])).toBe(true);
    expect(mesmaGeracao([2014, 2021], null)).toBe(false);
  });
});

describe('relacionadas: do mesmo carro', () => {
  const p = peca({ id: 'MLB1', y: [2014, 2021] });
  const novo = (i: number, o: Partial<Peca> = {}) => peca({ id: `MLB${100 + i}`, n: `Peça ${String(i).padStart(2, '0')}`, y: [2013, 2020], ...o });

  it('Golf de 1999 nunca entra no grupo da mesma geração de um Golf 2014', () => {
    const lista = [p, ...Array.from({ length: 9 }, (_, i) => novo(i)), peca({ id: 'MLB9', n: 'Break light', y: [1999, 2006] })];
    const r = doMesmoCarro(p, lista);
    expect(r.mesma).toHaveLength(MAX_CARRO);
    expect(r.mesma.every((x) => x.y && x.y[0] >= 2013)).toBe(true);
    expect(r.outras).toEqual([]);                      // a mesma geração encheu: não completa
    expect(r.mesma.find((x) => x.id === p.id)).toBeUndefined();
  });

  it('com poucas da mesma geração, completa com outros anos à parte (os mais perto primeiro; sem ano não entra)', () => {
    const lista = [p, novo(1), novo(2),
      peca({ id: 'MLB7', n: 'A', y: [1994, 1998] }), peca({ id: 'MLB8', n: 'B', y: [2008, 2013] }), peca({ id: 'MLB6', n: 'C', y: null })];
    const r = doMesmoCarro(p, lista);
    expect(r.mesma.map((x) => x.id)).toEqual(['MLB101', 'MLB102']);
    expect(r.outras.map((x) => x.id)).toEqual(['MLB8', 'MLB7']);   // 2008–2013, 1994–1998
    expect(r.mesma.length + r.outras.length).toBeLessThanOrEqual(MAX_CARRO);
    expect(r.mesma.length).toBeLessThan(MIN_MESMA);
  });

  it('mesma subfamília primeiro, depois mesma família; "Outros" de outra família não conta como subfamília', () => {
    const lista = [p,
      novo(1, { c: 'Motor', s: 'Faróis Dianteiros' }),
      novo(2, { c: 'Iluminação', s: 'Lanternas' }),
      novo(3, { c: 'Iluminação', s: 'Faróis Dianteiros' })];
    expect(doMesmoCarro(p, lista).mesma.map((x) => x.id)).toEqual(['MLB103', 'MLB102', 'MLB101']);
  });

  it('peça sem ano: mostra o modelo inteiro e avisa (semAno)', () => {
    const q = peca({ id: 'MLB2', y: null });
    const r = doMesmoCarro(q, [q, novo(1), peca({ id: 'MLB9', y: [1999, 2006] })]);
    expect(r.semAno).toBe(true);
    expect(r.mesma).toHaveLength(2);
    expect(r.outras).toEqual([]);
  });
});

describe('relacionadas: estoque real', () => {
  const arq = 'src/data/pecas.json';
  it.skipIf(!existsSync(arq))('nenhuma página mistura outra geração no grupo "mesma geração" (regra, vale para qualquer estoque)', () => {
    const pecas: Peca[] = JSON.parse(readFileSync(arq, 'utf-8'));
    const porCarro = new Map<string, Peca[]>();
    for (const x of pecas) if (x.b && x.m) porCarro.set(`${x.b}|${x.m}`, [...(porCarro.get(`${x.b}|${x.m}`) ?? []), x]);
    let completadas = 0;
    for (const x of pecas) {
      if (!x.b || !x.m || !x.y) continue;
      const r = doMesmoCarro(x, porCarro.get(`${x.b}|${x.m}`)!);
      for (const o of r.mesma) expect(mesmaGeracao(x.y, o.y), `${x.id} -> ${o.id}`).toBe(true);
      for (const o of r.outras) expect(!!o.y && !mesmaGeracao(x.y, o.y)).toBe(true);
      if (r.outras.length) completadas++;
    }
    // quantas paginas completam com outros anos depende do estoque: so avisa (nao trava a publicacao)
    if (completadas > pecas.length / 10) console.warn(`AVISO: ${completadas} paginas completam "Do mesmo carro" com outros anos`);
  });
});

describe('"Vai junto": o que costuma ser trocado junto, só do mesmo carro', () => {
  const cruze = (id: number, n: string, s: string, o: Partial<Peca> = {}) =>
    peca({ id: `MLB${id}`, n, s, b: 'Chevrolet', m: 'Cruze', y: [2017, 2021], ...o });
  const farol = cruze(1, 'Farol direito', 'Faróis', { o: 'E131464301' });
  const estoque = [
    farol,
    cruze(2, 'Para-choque dianteiro', 'Para-choques'),
    cruze(3, 'Para-choque traseiro', 'Para-choques'),
    cruze(4, 'Grade superior dianteira', 'Grades do Para-choque', { y: [2017, 2023] }),
    cruze(5, 'Suporte farol direito', 'Suportes do Farol'),
    cruze(6, 'Suporte farol esquerdo', 'Suportes do Farol'),
    cruze(7, 'Farol esquerdo', 'Faróis'),
    cruze(8, 'Compressor ar condicionado', 'Compressores'),
    cruze(9, 'Grade para-choque antigo', 'Grades do Para-choque', { y: [2011, 2016] }),
    peca({ id: 'MLB10', n: 'Para-choque dianteiro', s: 'Para-choques', b: 'Chevrolet', m: 'Onix', y: [2017, 2021] }),
    cruze(11, 'Farol direito', 'Faróis', { o: 'E131464301', p: 900 }),
    cruze(12, 'Esguicho farol direito', 'Bombas e Esguichos do Lavador'),
  ];
  it('farol direito: para-choque dianteiro, grade, suporte direito e o esguicho (nunca traseiro, esquerdo, outro carro ou outra geração)', () => {
    const r = vaiJunto(farol, estoque);
    expect(r.pecas.map((x) => x.id)).toEqual(['MLB2', 'MLB4', 'MLB5', 'MLB12']);
    expect(r.com).toBe('o farol');
  });
  it('lanterna chama o para-choque traseiro; sem peça que combine, nada', () => {
    const lant = cruze(20, 'Lanterna traseira esquerda', 'Lanternas Traseiras');
    expect(vaiJunto(lant, [...estoque, lant]).pecas.map((x) => x.id)).toEqual(['MLB3']);
    const comp = estoque[7];
    expect(vaiJunto(comp, estoque)).toEqual({ pecas: [], com: '' });
    expect(vaiJunto(cruze(21, 'Farol', 'Faróis', { y: null }), estoque).pecas).toEqual([]);   // sem ano: não dá para garantir
  });
  it('maçaneta traseira direita: a fechadura e a máquina de vidro da MESMA porta (ou sem porta dita)', () => {
    const toro = (id: number, n: string, s: string) => peca({ id: `MLB${id}`, n, s, b: 'Fiat', m: 'Toro', y: [2016, 2022] });
    const mac = toro(1, 'Maçaneta externa traseira direita', 'Maçanetas das Portas');
    const r = vaiJunto(mac, [mac,
      toro(2, 'Fechadura porta dianteira direita', 'Fechaduras das Portas'),
      toro(3, 'Fechadura porta traseira direita', 'Fechaduras das Portas'),
      toro(4, 'Máquina vidro elétrico traseiro esquerdo', 'Máquinas e Motores de Vidro Elétrico'),
      toro(5, 'Máquina vidro elétrico traseira direita', 'Máquinas e Motores de Vidro Elétrico'),
      toro(6, 'Maçaneta puxador externo traseiro direito', 'Maçanetas das Portas'),
      toro(7, 'Maçaneta interna traseira direita', 'Maçanetas Internas'),
    ]);
    expect(r.pecas.map((x) => x.id)).toEqual(['MLB3', 'MLB7', 'MLB5']);
  });
  it('peça de 2+ carros entra no carro em que serve, com os anos daquele carro', () => {
    const p = peca({ id: 'MLB1', n: 'Retrovisor elétrico esquerdo', s: 'Retrovisores Externos', b: 'Volvo', m: 'XC60', y: [2018, 2024] });
    const capa = peca({ id: 'MLB2', n: 'Capa retrovisor esquerdo', s: 'Capas e Molduras do Retrovisor', b: 'Volvo', m: 'S60', ms: ['S60', 'XC60'], y: [2018, 2024] });
    const velha = peca({ id: 'MLB3', n: 'Capa retrovisor', s: 'Capas e Molduras do Retrovisor', b: 'Volvo', m: 'S60', ms: ['S60', 'XC60'], y: [2018, 2024], ys: [[2018, 2024], [2009, 2017]] });
    expect(vaiJunto(p, [p, capa, velha]).pecas.map((x) => x.id)).toEqual(['MLB2']);
  });
  it('lado e frente/trás pelo nome', () => {
    expect(ladoDa('Retrovisor elétrico esquerdo')).toBe('E');
    expect(ladoDa('Maçaneta porta motorista')).toBe('E');
    expect(ladoDa('Macaneta externa tras dir')).toBe('D');
    expect(ladoDa('Caixa direção')).toBe(null);
    expect(ladoDa('Par de faróis esquerdo e direito')).toBe(null);
    expect(zonaDa('Farol direito', 'farol')).toBe('frente');
    expect(zonaDa('Guia para-choque traseiro', 'parachoque')).toBe('tras');
    expect(zonaDa('Para-choque', 'parachoque')).toBe(null);
    expect(grupoDa({ s: 'Amortecedores da Tampa e do Capô', n: 'Amortecedor capô' })).toBe('capo-mola');
    expect(grupoDa({ s: 'Amortecedores da Tampa e do Capô', n: 'Amortecedor tampa traseira' })).toBe('tampa-mola');
  });
  it('motor nunca chama peça de tampa, porta-malas, banco ou porta, nem com o tipo errado no estoque (revisão 12, P2.2)', () => {
    const xc = (id: number, n: string, s: string) => peca({ id: `MLB${id}`, n, s, b: 'Volvo', m: 'XC60', y: [2018, 2024] });
    const turbo = xc(1, 'Válvula solenoide pressão turbina', 'Válvulas Solenoides');
    const pcv = xc(2, 'Válvula PCV', 'Válvulas Solenoides');
    const estoque = [turbo, pcv,
      xc(3, 'Comando rebatimento tampa', 'Comandos de Válvulas'),   // o tipo errado de antes
      xc(4, 'Solenoide comando válvulas', 'Válvulas Solenoides'),
      xc(5, 'Mangueira turbo intercooler', 'Mangueiras do Turbo e Intercooler'),
      xc(6, 'Coletor admissão', 'Coletores de Admissão'),
      xc(7, 'Tampa válvulas', 'Tampas de Válvulas'),
      xc(8, 'Sonda lambda banco 1', 'Sondas Lambda'),
    ];
    // a válvula do turbo é do turbo (o subtítulo diz "a válvula do turbo", nunca "peça do cabeçote")
    expect(grupoDa(turbo)).toBe('turbo-valvula');
    const r = vaiJunto(turbo, estoque);
    expect(r.com).toBe('a válvula do turbo');
    expect(r.pecas.map((x) => x.id)).toEqual(['MLB5', 'MLB6']);
    // no cabeçote: a tampa de válvulas fica (é do motor); o comando da tampa traseira, não
    const c = vaiJunto(pcv, estoque).pecas.map((x) => x.n);
    expect(c).toContain('Tampa válvulas');
    expect(c).not.toContain('Comando rebatimento tampa');
    // "banco 1" do motor não é banco do carro
    expect(FORA_DO_MOTOR.test('sonda lambda banco 1')).toBe(false);
    expect(FORA_DO_MOTOR.test('comando rebatimento tampa')).toBe(true);
    expect(FORA_DO_MOTOR.test('tampa valvulas')).toBe(false);
  });
  it('botão da tampa traseira vai com a tampa, não com os botões do painel', () => {
    expect(grupoDa({ s: 'Outros Botões', n: 'Comando rebatimento tampa' })).toBe('tampa-botao');
    expect(grupoDa({ s: 'Outros Botões', n: 'Botão abertura porta-malas' })).toBe('tampa-botao');
    expect(grupoDa({ s: 'Outros Botões', n: 'Botão ESP' })).toBe('botoes-painel');
    const xc = (id: number, n: string, s: string) => peca({ id: `MLB${id}`, n, s, b: 'Volvo', m: 'XC60', y: [2018, 2024] });
    const botao = xc(1, 'Comando rebatimento tampa', 'Outros Botões');
    const r = vaiJunto(botao, [botao, xc(2, 'Botão ESP', 'Outros Botões'), xc(3, 'Dobradiça tampa traseira', 'Dobradiças da Tampa Traseira'),
      xc(4, 'Lanterna tampa traseira esquerda', 'Lanternas Traseiras'), xc(5, 'Farol direito', 'Faróis')]);
    expect(r.pecas.map((x) => x.id)).toEqual(['MLB3', 'MLB4']);
    expect(r.com).toBe('o botão da tampa traseira');
  });
  it('todo grupo citado em JUNTO existe', () => {
    for (const [k, v] of Object.entries(JUNTO)) {
      expect(GRUPOS[k], k).toBeTruthy();
      for (const x of v) expect(GRUPOS[x], `${k} -> ${x}`).toBeTruthy();
    }
  });

  const arq = 'src/data/pecas.json';
  it.skipIf(!existsSync(arq))('estoque real: só o mesmo carro e a mesma geração, nunca o outro lado nem a outra ponta, no máximo 4', () => {
    const pecas: Peca[] = JSON.parse(readFileSync(arq, 'utf-8'));
    const porModelo = new Map<string, Peca[]>();
    for (const x of pecas) for (const m of x.ms && x.ms.length ? x.ms : x.m ? [x.m] : []) {
      const k = `${x.b}|${m}`; porModelo.set(k, [...(porModelo.get(k) ?? []), x]);
    }
    let com = 0, cartoes = 0;
    for (const p of pecas) {
      const r = vaiJunto(p, porModelo.get(`${p.b}|${p.m}`) ?? []);
      expect(r.pecas.length).toBeLessThanOrEqual(MAX_JUNTO);
      if (!r.pecas.length) continue;
      com++; cartoes += r.pecas.length;
      const lado = ladoDa(p.n), zona = zonaDa(p.n, grupoDa(p));
      for (const x of r.pecas) {
        expect(x.id).not.toBe(p.id);
        expect(x.b).toBe(p.b);
        expect(serveNoModelo(x, p.m), `${p.id} -> ${x.id}`).toBe(true);
        expect(mesmaGeracao(anosNoModelo(p, p.m), anosNoModelo(x, p.m)), `${p.id} -> ${x.id}`).toBe(true);
        const lx = ladoDa(x.n), zx = zonaDa(x.n, grupoDa(x));
        if (lado && lx) expect(lx, `${p.n} -> ${x.n}`).toBe(lado);
        if (zona && zx) expect(zx, `${p.n} -> ${x.n}`).toBe(zona);
      }
      expect(new Set(r.pecas.map((x) => x.id)).size).toBe(r.pecas.length);
      // rodada 14 (cliente oculto, atrito 9): nunca o mesmo código (o da própria peça ou de outro cartão), nem o mesmo nome
      const usados = new Set<string>(codigosDe(p));
      const nomes = new Set<string>([p.n.toLowerCase()]);
      for (const x of r.pecas) {
        for (const c of codigosDe(x)) { expect(usados.has(c), `${p.id} -> ${x.id} código ${c}`).toBe(false); usados.add(c); }
        expect(nomes.has(x.n.toLowerCase()), `${p.id} -> ${x.id} nome repetido`).toBe(false);
        nomes.add(x.n.toLowerCase());
      }
    }
    console.log(`"Vai junto": ${com} de ${pecas.length} peças com o bloco (${cartoes} cartões)`);
  });
});

