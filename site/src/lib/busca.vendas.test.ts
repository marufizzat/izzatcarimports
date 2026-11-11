// As regras da busca (lib/busca.regressao.ts) com o ESTOQUE MEXIDO: o que acontece quando uma peça vende.
//
// Em 11/11/2026 o robô recusou a rodada 14: entre o estoque dos testes (09/11) e o daquela manhã venderam 18 peças, entre
// elas a ÚNICA lanterna do XC60. "lanterna xc60" passou a abrir a lista de parecidas com a "Capa antena shark teto" e o
// "Sensor temperatura interna" do XC60 ("antena" e "interna" estão a 2 letras de "lanterna": a busca tratou a palavra
// certa como erro de digitação), e dois testes tinham o estoque de 09/11 no gabarito.
//
// Aqui o estoque congelado de 09/11 (testes/fixtures/estoque-busca.json) perde peças de propósito e as regras têm de
// continuar valendo: as 18 daquele dia, um tipo inteiro de um carro, um tipo do estoque inteiro, um carro inteiro. Não
// depende do estoque do dia (o estoque do dia tem as mesmas regras em busca.regressao.test.ts; 30 estoques sorteados:
// `node scripts/estoque-perturbado.mjs`).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Busca } from './busca';
import { casos, falhasDe, semPecas, itensDo, norm } from './busca.regressao';

const ix = JSON.parse(readFileSync('testes/fixtures/estoque-busca.json', 'utf8'));
const P = itensDo(ix);
/** a 1ª palavra do nome ("Para-choque dianteiro" -> parachoque) */
const cab = (k: number) => P[k].n.split(' ')[0].replace(/[^a-z0-9]/g, '');
const doCarro = (k: number, m: string) => P[k].ms.includes(m);

// As 18 peças que venderam entre o estoque congelado (09/11) e a rodada do robô que recusou a rodada 14 (11/11, 10h41)
const VENDIDAS_1111 = ['MLB4779038537', 'MLB7328296554', 'MLB6297774618', 'MLB4536269285', 'MLB4644227247', 'MLB6820219386', 'MLB6830366880',
  'MLB4779128459', 'MLB4799009991', 'MLB4811340217', 'MLB7439204914', 'MLB5094113379', 'MLB5237941567', 'MLB7658504196', 'MLB5287863373',
  'MLB7722912002', 'MLB5310823745', 'MLB5483856157'];

describe('busca: as regras com o estoque mexido (o que travou o robô em 11/11/2026)', () => {
  it('o estoque congelado é o de 09/11 e cumpre todas as regras (se isto falhar, o arquivo foi trocado)', () => {
    expect(ix.id.length).toBe(5311);
    expect(VENDIDAS_1111.every((id) => ix.id.includes(id))).toBe(true);
    expect([...new Set(casos(ix).map((c) => c.grupo))].sort()).toEqual(['carro', 'codigo', 'familia', 'lado', 'tipo']);
    expect(casos(ix).length).toBeGreaterThanOrEqual(900);
    expect(falhasDe(Busca, ix)).toEqual([]);
  }, 120000);

  it('11/11: vendidas as 18 peças daquele dia (a única lanterna do XC60 entre elas), todas as regras continuam valendo', () => {
    const hoje = semPecas(ix, (k) => !VENDIDAS_1111.includes(ix.id[k]));
    expect(hoje.id.length).toBe(5311 - 18);
    expect(falhasDe(Busca, hoje)).toEqual([]);
    // o caso que travou: o XC60 ficou sem lanterna. A lista vem com o aviso de parecidas, abre com as luzes do XC60
    // (o bloco "Faróis e Lanternas") e segue com as lanternas dos outros carros; nada de antena nem de sensor
    for (const q of ['lanterna xc60', 'lanterna do xc60', 'xc60 lanterna', 'sinaleira xc60', 'sinaleira do xc60', 'xc60 sinaleira']) {
      const bb = new Busca(hoje);
      const r = bb.procurar({ q });
      expect(bb.aproximado, q).toBe(true);
      expect(bb.nExatas, q).toBe(0);
      expect(r.length, q).toBeGreaterThan(0);
      expect(r.filter((it) => !/lanterna|farol|farois/.test(norm(`${it.n} ${it.s} ${it.c}`))).map((it) => it.n), q).toEqual([]);
      expect(r.some((it) => /antena|interna/.test(norm(it.n))), q).toBe(false);
      const doXc60 = r.filter((it) => (it.ms ?? [it.m]).includes('XC60'));
      expect(r.slice(0, doXc60.length), q).toEqual(doXc60);
      expect(bb.nDoCarro, q).toBe(doXc60.length);
      expect(r.slice(doXc60.length).some((it) => /^lanterna/.test(norm(it.n))), q).toBe(true);
      expect(bb.bate(r, q, { b: 'Volvo', m: 'XC60' }), q).toBe(false);
    }
  }, 120000);

  it('a palavra que o estoque conhece nunca é lida como erro de digitação de outra (lanterna ≠ antena, módulo ≠ modelo)', () => {
    // sem nenhuma lanterna no estoque inteiro, "lanterna" ainda é o bloco "Faróis e Lanternas": nada de "antena"/"interna"
    const sem = semPecas(ix, (k) => !/lanterna/.test(P[k].n));
    for (const q of ['lanterna', 'lanterna xc60', 'lanterna gol', 'sinaleira tracker']) {
      const bb = new Busca(sem);
      const r = bb.procurar({ q });
      expect(bb.nExatas, q).toBe(0);
      expect(r.some((it) => /antena|interna/.test(norm(it.n)) && !/lanterna|farol|farois/.test(norm(`${it.s} ${it.c}`))), q).toBe(false);
    }
    // o erro de verdade continua corrigido (a palavra que o estoque NÃO conhece)
    for (const [errada, certa] of [['lanterrna', /^lanterna/], ['retrovizor', /^retrovisor/], ['modullo', /^modulo/]] as const) {
      expect(norm(new Busca(ix).procurar({ q: errada })[0]?.n ?? ''), errada).toMatch(certa);
    }
  });

  it('tipo inteiro de um carro vendido (lanterna do XC60, módulo do Gol, chave do Onix, motor do Tracker…): regras valem', () => {
    const eventos: [string, string, RegExp][] = [
      ['lanterna', 'XC60', /lanterna|sinaleira|xc60|frente/], ['modulo', 'Gol', /modulo|gol/], ['chave', 'Onix', /pisca|onix/],
      ['motor', 'Tracker', /motor|maquina|tracker/], ['farol', 'HB20', /farol|frente|hb20/], ['parachoque', 'E-Pace', /choque|frente|pace/],
      ['retrovisor', 'HB20', /retrovisor|hb20/], ['sensor', 'Compass', /sensor|compass/], ['tampa', 'XC60', /tampa/], ['macaneta', 'Toro', /maçaneta|toro/],
      ['bomba', 'XC60', /bomba/], ['painel', 'Gol', /painel/], ['botao', 'Cruze', /pisca|cruze/], ['maquina', 'Tracker', /vidro/],
    ];
    for (const [tipo, carro, so] of eventos) {
      const menos = semPecas(ix, (k) => !(cab(k) === tipo && doCarro(k, carro)));
      expect(menos.id.length, `${tipo} de ${carro}`).toBeLessThan(ix.id.length);
      expect(falhasDe(Busca, menos, so), `sem ${tipo} de ${carro}`).toEqual([]);
    }
  }, 120000);

  it('tipo que some do estoque INTEIRO (nenhuma lanterna, nenhum para-lama, nenhuma churrasqueira…): regras valem', () => {
    const tipos: [RegExp, string, RegExp][] = [
      [/^lanterna/, 'lanterna', /lanterna|sinaleira/], [/^(paralama|churrasqueira|tapete|carpete)/, 'para-lama, churrasqueira, tapete e carpete', /lama|churrasqueira|tapete|frente/],
      [/^(bobina|coluna|painel)/, 'bobina, coluna e painel', /bobina|coluna|painel/], [/^(seta|pisca)/, 'seta e pisca', /pisca/],
      [/^(farol|farois|grade|capo)/, 'farol, grade e capô', /farol|grade|frente/], [/^(retrovisor|macaneta|amortecedor)/, 'retrovisor, maçaneta e amortecedor', /retrovisor|maçaneta|amortecedor/],
      [/^(parachoque|maquina)/, 'para-choque e máquina', /choque|vidro|frente/],
    ];
    for (const [re, rotulo, so] of tipos) {
      // some a palavra de todo nome (não só do começo): o estoque deixa de conhecer a peça
      const menos = semPecas(ix, (k) => !P[k].n.split(' ').some((w) => re.test(w.replace(/[^a-z0-9]/g, ''))));
      expect(menos.id.length, rotulo).toBeLessThan(ix.id.length);
      expect(falhasDe(Busca, menos, so), `sem ${rotulo}`).toEqual([]);
    }
  }, 120000);

  it('carro que some do estoque inteiro (Gol, XC60): as consultas dele saem da tabela e as outras regras valem', () => {
    for (const carro of ['Gol', 'XC60']) {
      const menos = semPecas(ix, (k) => !doCarro(k, carro));
      expect(casos(menos).some((c) => c.carro?.m === carro), carro).toBe(false);
      expect(falhasDe(Busca, menos, /lanterna|modulo|motor|frente/), `sem ${carro}`).toEqual([]);
    }
  }, 120000);
});
