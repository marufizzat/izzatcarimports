// O kit da batida. Regra dos testes com estoque (testes/estoques.ts): nome de bloco/tipo confere no VOCABULÁRIO da loja;
// o que precisa de peça para existir roda só no ESTOQUE FIXO; as regras (lado, posição, nada em dobro, link = catálogo)
// rodam no fixo e no estoque do dia, com o carro que o estoque tiver.
import { describe, it, expect } from 'vitest';
import { PONTOS, LIGADA, FRASE_PATIO, ehDaLinha, itensDaLinha, kitDoPonto, kitsDeTodos, linhasDoPainel, marcadasDeInicio, poucoAnunciado, peDoConserto, opcoesDoPonto, pedidoDe, linkDaLinha, filtrosDaLinha, type Linha } from './batida';
import { mensagemConserto, somaPrecos } from './whats';
import { ARTE } from './raioX';
import { Busca, capaItem } from './busca';
import { estoques, indiceFixo, carroMaisCheio, carrosDoIndice, indiceDoCarro, BLOCOS_DA_LOJA, TIPOS_DA_LOJA } from '../../testes/estoques';

const foto = (it: Parameters<typeof capaItem>[0]) => capaItem(it, 'A');

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

describe('os 8 pontos da batida na arte', () => {
  it('8 pontos, chaves únicas, cada um com linhas, área de toque e realce', () => {
    expect(PONTOS.map((p) => p.nome)).toEqual(['Frente', 'Frente esquerda', 'Frente direita', 'Lateral esquerda', 'Lateral direita', 'Traseira', 'Traseira esquerda', 'Traseira direita']);
    expect(new Set(PONTOS.map((p) => p.k)).size).toBe(8);
    for (const p of PONTOS) {
      expect(p.linhas.length).toBeGreaterThan(5);
      expect(p.toque.length).toBeGreaterThan(0);
      expect(p.realce.length).toBeGreaterThan(0);
      expect(p.em.startsWith('na ')).toBe(true);
    }
  });
  it('o ponto fica na área de toque DELE (e só nela), e tudo cabe na arte', () => {
    for (const p of PONTOS) {
      const donos = PONTOS.filter((q) => q.toque.some((t) => dentro(p.ancora, pontos(t)))).map((q) => q.k);
      expect(donos).toEqual([p.k]);
      for (const poli of [...p.toque, ...p.realce]) for (const [x, y] of pontos(poli)) {
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(ARTE.w);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(ARTE.h);
      }
      const [ex, ey] = p.etiqueta;
      expect(ex).toBeGreaterThan(40); expect(ex).toBeLessThan(ARTE.w - 40);
      expect(ey).toBeGreaterThan(30); expect(ey).toBeLessThan(ARTE.h - 30);
    }
  });
  it('as áreas de toque não se sobrepõem (um toque = um ponto)', () => {
    const dois: string[] = [];
    for (let x = 3; x < ARTE.w; x += 12) for (let y = 3; y < ARTE.h; y += 12) {
      const z = PONTOS.filter((p) => p.toque.some((t) => dentro([x, y], pontos(t))));
      if (z.length > 1) dois.push(`${x},${y}: ${z.map((q) => q.k).join('+')}`);
    }
    expect(dois.slice(0, 10)).toEqual([]);
  });
  it('os pontos não se encostam na arte de 288 px (celular de 320): 30+ px entre dois', () => {
    const escala = 288 / ARTE.w;
    for (const p of PONTOS) for (const q of PONTOS) {
      if (p === q) continue;
      const d = Math.hypot(p.ancora[0] - q.ancora[0], p.ancora[1] - q.ancora[1]) * escala;
      expect(d, `${p.k} × ${q.k}`).toBeGreaterThan(27);
    }
  });
});

describe('o kit da batida: as linhas', () => {
  it('toda linha com tipo/sub usa nomes do vocabulário da loja (linha sem tipo = pátio)', () => {
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      if (!l.tipo) { expect(l.extra, `${l.nome}: pátio nunca é extra`).toBeFalsy(); continue; }
      if (!BLOCOS_DA_LOJA.has(l.tipo) || !l.sub || !TIPOS_DA_LOJA.has(l.sub)) erros.push(`${p.k}: ${l.nome} (${l.tipo} / ${l.sub})`);
    }
    expect(erros).toEqual([]);
  });

  it('nomes de linha únicos em cada ponto', () => {
    for (const p of PONTOS) expect(new Set(p.linhas.map((l) => l.nome)).size, p.k).toBe(p.linhas.length);
  });

  it('toda linha com tipo diz qual nome É a peça dela (eh); a de pátio não', () => {
    for (const p of PONTOS) for (const l of p.linhas) {
      if (!l.tipo) { expect(l.eh, `${p.k}: ${l.nome}`).toBeUndefined(); continue; }
      const formas = Array.isArray(l.eh) ? l.eh : l.eh ? [l.eh] : [];
      expect(formas.length, `${p.k}: ${l.nome}`).toBeGreaterThan(0);
      for (const e of formas) expect(e.cab.trim().length, `${p.k}: ${l.nome}`).toBeGreaterThan(0);
    }
  });
});

// A regra "o nome É a peça da linha" (revisão 15, P1-2), com nomes escritos aqui (nenhum depende do estoque).
describe('a peça da linha: o nome começa pela peça que a linha promete', () => {
  const linha = (nome: string): Linha => {
    const l = PONTOS.flatMap((p) => p.linhas).find((x) => x.nome === nome);
    if (!l) throw new Error(`linha ${nome}`);
    return l;
  };
  const casos: [string, string, boolean][] = [
    ['Maçaneta externa', 'Maçaneta externa dianteira esquerda', true],
    ['Maçaneta externa', 'Maçaneta dianteira/traseira direita', true],
    ['Maçaneta externa', 'Suporte maçaneta traseira esquerda', false],
    ['Maçaneta externa', 'Suporte base maçaneta dianteira direita', false],
    ['Maçaneta externa', 'Moldura maçaneta traseira direita', false],
    ['Maçaneta externa', 'Cabo bowden fechadura dianteira esquerda', false],
    ['Maçaneta externa', 'Maçaneta interna dianteira esquerda', false],
    ['Forro da porta', 'Forro porta dianteira esquerda', true],
    ['Forro da porta', 'Forro da porta traseira direita', true],
    ['Forro da porta', 'Forro portas traseiras', true],
    ['Forro da porta', 'Forro esquerdo porta-malas', false],
    ['Forro da porta', 'Acabamento forro esquerdo porta-malas', false],
    ['Forro da porta', 'Isopor porta-malas esquerdo', false],
    ['Forro da porta', 'Suporte forro bagagito direito', false],
    ['Condensador do ar-condicionado', 'Condensador ar condicionado', true],
    ['Condensador do ar-condicionado', 'Radiador condensador ar', true],
    ['Condensador do ar-condicionado', 'Caixa ar condicionado', false],
    ['Painel frontal', 'Painel frontal', true],
    ['Painel frontal', 'Suporte radiador', true],
    ['Painel frontal', 'Suporte travessa radiador', true],
    ['Painel frontal', 'Placa suporte esquerdo radiador', false],
    ['Painel frontal', 'Par suportes coxins radiador', false],
    ['Painel frontal', 'Suporte braço direito radiador', false],
    ['Painel frontal', 'Suporte radiador direito', false],
    ['Para-choque traseiro', 'Para-choque traseiro', true],
    ['Para-choque traseiro', 'Parachoque traseiro completo', true],
    ['Para-choque traseiro', 'Polaina para-choque traseiro esquerdo', false],
    ['Lanterna traseira esquerda', 'Lanterna tampa traseira esquerda', true],
    ['Lanterna traseira esquerda', 'Circuito lanterna traseira esquerda', false],
    ['Lanterna traseira esquerda', 'Soquete lanterna traseira esquerda', false],
    ['Fechadura do porta-malas', 'Fechadura tampa traseira', true],
    ['Fechadura do porta-malas', 'Trava elétrica tampa traseira', true],
    ['Fechadura do porta-malas', 'Batente tampa porta-malas', false],
    ['Fechadura do porta-malas', 'Puxador cabo tanque porta-malas', false],
    ['Fechadura do porta-malas', 'Maçanetas elétrica tampa traseira', false],
    ['Máquina do vidro elétrico', 'Motor vidro elétrico dianteiro esquerdo', true],
    ['Máquina do vidro elétrico', 'Máquina vidro traseira direita', true],
    ['Máquina do vidro elétrico', 'Módulo vidro elétrico porta esquerda', false],
    ['Retrovisor externo', 'Retrovisor elétrico esquerdo', true],
    ['Retrovisor externo', 'Motor retrovisor elétrico esquerdo', false],
    ['Porta', 'Porta dianteira esquerda', true],
    ['Grade', 'Grade churrasqueira', true],
    ['Grade', 'Tampa grade churrasqueira', false],
    ['Radiador', 'Kit radiador completo', true],
    ['Alma do para-choque', 'Alma para-choque', true],
    ['Alma do para-choque', 'Absorvedor impacto', false],
    ['Capô', 'Capô', false],   // linha de pátio: sem regra, nunca "certa"
  ];
  it.each(casos)('%s × "%s" = %s', (nome, peca, esperado) => {
    expect(ehDaLinha(linha(nome), peca)).toBe(esperado);
  });

  it('linhasDoPainel: a principal que só tem peça ligada vira o título no pátio + a ligada em "vai junto"; a certa não muda', () => {
    const p = { nome: 'Maçaneta externa', tipo: 'x', sub: 'y' } as Linha;
    const e = { nome: 'Suporte do farol', tipo: 'x', sub: 'z', extra: true } as Linha;
    const vazia = (linha: Linha) => ({ linha, n: 0, certa: false });
    const certa = { linha: p, n: 3, certa: true };
    expect(linhasDoPainel([certa], vazia)).toEqual([certa]);
    const semPeca = { linha: p, n: 0, certa: false };
    expect(linhasDoPainel([semPeca], vazia)).toEqual([semPeca]);
    const so = linhasDoPainel([{ linha: p, n: 2, certa: false }], vazia);
    expect(so.map((x) => [x.linha.nome, x.n, !!x.linha.extra])).toEqual([['Maçaneta externa', 0, false], [`Maçaneta externa${LIGADA}`, 2, true]]);
    const ex = linhasDoPainel([{ linha: e, n: 1, certa: false }], vazia);
    expect(ex.map((x) => [x.linha.nome, x.n, !!x.linha.extra])).toEqual([[`Suporte do farol${LIGADA}`, 1, true]]);
    // marcadas de início: só com carro e só as principais: a com peça CERTA (somada) e as sem peça (pedido de pátio);
    // a ligada e a que "costuma ir junto" nunca; lista de outro ano (pecasValem falso): só o pátio
    const linhas = [certa, semPeca, ...so, { linha: e, n: 1, certa: true }];
    expect([...marcadasDeInicio(linhas, true)]).toEqual([0, 1, 2]);
    expect([...marcadasDeInicio(linhas, true, false)]).toEqual([1, 2]);
    expect([...marcadasDeInicio(linhas, false)]).toEqual([]);
    // o pé: com preço = orçamento; só pátio = pedido de pátio (botão e data-botao próprios); nada = espera
    expect(peDoConserto(2, 3)).toEqual({ estado: 'conserto', botao: 'Pedir o conserto no WhatsApp', dataBotao: 'raiox-conserto' });
    expect(peDoConserto(0, 3)).toEqual({ estado: 'patio', botao: 'Pedir para procurar no pátio', dataBotao: 'raiox-patio' });
    expect(peDoConserto(0, 0).estado).toBe('nada');
    expect(poucoAnunciado([semPeca, semPeca])).toBe(true);
    expect(poucoAnunciado([certa, semPeca])).toBe(true);
    expect(poucoAnunciado([certa, certa, semPeca])).toBe(false);
    expect(poucoAnunciado([certa])).toBe(false);   // nada para procurar
    expect(FRASE_PATIO).toMatch(/^Nem toda peça está anunciada\./);
    expect(FRASE_PATIO).not.toMatch(/tem|garant|certeza/i);
  });
});

describe.each(estoques())('o kit da batida no $nome', ({ ix, fixo }) => {
  const b = new Busca(ix);
  const procurar = (f: Parameters<Busca['procurar']>[0]) => b.procurar(f);
  // o carro do exemplo: no estoque fixo, o XC60 2019 (tem peça em quase todo ponto); no do dia, o carro com mais peças
  const cheio = carroMaisCheio(ix);
  const CARRO = fixo || !cheio ? { marca: 'Volvo', modelo: 'XC60', ano: 2019 } : cheio;

  it('o lado do ponto: nenhuma peça do lado oposto entra (esquerdo nunca o direito, e o contrário)', () => {
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      for (const it of itensDaLinha(p, l, procurar)) {
        if (p.lado && it.l && it.l !== p.lado) erros.push(`${p.k} ${l.nome}: ${it.id} é ${it.l}`);
        if (l.lado && it.l !== l.lado) erros.push(`${p.k} ${l.nome}: linha ${l.lado}, peça ${it.l}`);
      }
    }
    expect(erros.slice(0, 10)).toEqual([]);
  });

  it('a posição: ponto de frente nunca lista peça de trás, ponto de trás nunca a da frente', () => {
    const erros: string[] = [];
    for (const p of PONTOS) for (const l of p.linhas) {
      for (const it of itensDaLinha(p, l, procurar)) {
        if (p.pos === 'D' && it.pos === 'T') erros.push(`${p.k} ${l.nome}: ${it.id} é traseira`);
        if (p.pos === 'T' && it.pos === 'D') erros.push(`${p.k} ${l.nome}: ${it.id} é dianteira`);
        if (l.pos && it.pos !== l.pos && it.pos !== 'A') erros.push(`${p.k} ${l.nome}: linha ${l.pos}, peça ${it.pos}`);
      }
    }
    expect(erros.slice(0, 10)).toEqual([]);
  });

  it('a mesma peça nunca aparece em duas linhas do mesmo ponto (o total não conta nada em dobro)', () => {
    for (const p of PONTOS) {
      const vistas = new Map<string, string>();
      for (const l of p.linhas) for (const it of itensDaLinha(p, l, procurar)) {
        expect(vistas.get(it.id), `${p.k}: ${it.id} em "${vistas.get(it.id)}" e "${l.nome}"`).toBeUndefined();
        vistas.set(it.id, l.nome);
      }
    }
  });

  it('a frente esquerda pede os faróis e para-lamas ESQUERDOS e nunca os direitos (pelo estoque)', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const farol = p.linhas.find((l) => l.nome === 'Farol esquerdo')!;
    const itens = itensDaLinha(p, farol, procurar);
    if (fixo) expect(itens.length).toBeGreaterThan(0);   // o estoque do dia pode estar sem farol esquerdo
    expect(itens.every((it) => it.l === 'E')).toBe(true);
    expect(p.linhas.some((l) => l.nome === 'Farol direito' || l.nome === 'Para-lama direito')).toBe(false);
  });

  it('a ordem de cada linha: primeiro as que SÃO a peça da linha, depois as outras; a mais barata na frente em cada grupo; a 1ª é a do kit', () => {
    for (const carro of [undefined, CARRO]) for (const p of PONTOS) {
      const kit = kitDoPonto(p, procurar, foto, carro);
      for (const { linha, itens, certa } of opcoesDoPonto(p, procurar, carro)) {
        const grupo = itens.map((it) => (ehDaLinha(linha, it.n) ? 0 : 1));
        for (let i = 1; i < itens.length; i++) {
          expect(grupo[i], `${p.k} ${linha.nome}: ${itens[i].n} depois de ${itens[i - 1].n}`).toBeGreaterThanOrEqual(grupo[i - 1]);
          if (grupo[i] === grupo[i - 1]) expect(itens[i].p).toBeGreaterThanOrEqual(itens[i - 1].p);
        }
        expect(certa).toBe(itens.length > 0 && grupo[0] === 0);
        const lk = kit.linhas.find((x) => x.nome === linha.nome)!;
        expect(lk.n).toBe(itens.length);
        expect(lk.rep?.id).toBe(itens[0]?.id);
        expect(lk.certa).toBe(certa);
      }
    }
  });

  // A INVARIANTE da revisão 15 (P1-2): em TODO carro do estoque e em todo ponto, a peça que nasce marcada (e somada no
  // total) É a peça do título da linha. Conta como o navegador: no índice só do carro (/dados/carro/<k>.json), com as
  // funções que o painel usa (opcoesDoPonto -> linhasDoPainel -> marcadasDeInicio). A regra é lida aqui de novo, sem
  // o ehDaLinha: a 1ª palavra do nome (sem "Kit"/"Par") é uma das que a linha aceita para abrir o nome.
  it('em todo carro e em todo ponto, toda linha que nasce marcada mostra a peça do título da linha', () => {
    const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-/g, '');
    const cabeca = (nome: string) => plano(nome).split(/[^a-z0-9]+/).filter((w) => w && !['kit', 'par', 'jogo', 'conjunto'].includes(w))[0] ?? '';
    const abre = (l: Linha, nome: string) => (Array.isArray(l.eh) ? l.eh : l.eh ? [l.eh] : [])
      .some((e) => e.cab.split(' ').map(plano).some((c) => [c, `${c}s`, `${c}es`, c.replace(/m$/, 'ns'), c.replace(/l$/, 'is'), c.replace(/ao$/, 'oes')].includes(cabeca(nome))));
    const erros: string[] = [];
    let marcadas = 0;
    const carros = carrosDoIndice(ix);
    for (const c of carros) {
      const bc = new Busca(indiceDoCarro(ix, c.marca, c.modelo));
      const memo = new Map<string, ReturnType<Busca['procurar']>>();
      const doCarro = (f: Parameters<Busca['procurar']>[0]) => {
        const k = JSON.stringify(f);
        let r = memo.get(k);
        if (!r) { r = bc.procurar(f); memo.set(k, r); }
        return r;
      };
      for (const p of PONTOS) {
        const linhas = linhasDoPainel(opcoesDoPonto(p, doCarro, c).map((o) => ({ ...o, n: o.itens.length })), (linha) => ({ linha, itens: [], certa: false, n: 0 }));
        const marc = marcadasDeInicio(linhas, true);
        linhas.forEach((l, i) => {
          const onde = `${c.marca} ${c.modelo} [${p.k}] ${l.linha.nome}`;
          // toda principal nasce marcada: a com peça (a que só tinha peça ligada virou pátio + "vai junto") e a de pátio
          if (!l.linha.extra && !marc.has(i)) erros.push(`${onde}: principal sem marcar`);
          if (!marc.has(i)) return;
          if (l.linha.extra) erros.push(`${onde}: marcada sem ser principal`);
          if (l.linha.nome.endsWith(LIGADA)) erros.push(`${onde}: peça ligada marcada`);
          const peca = l.itens[0];
          if (!peca) return;   // pedido de pátio: sem peça e sem preço
          marcadas++;
          if (!ehDaLinha(l.linha, peca.n) || !abre(l.linha, peca.n)) erros.push(`${onde}: marcada «${peca.n}»`);
        });
        // o título que foi para o pátio e a peça ligada dele: nunca os dois com peça, nunca a ligada como principal
        for (const l of linhas) if (l.linha.nome.endsWith(LIGADA)) {
          if (!l.linha.extra || l.certa || !l.n) erros.push(`${c.marca} ${c.modelo} [${p.k}] ${l.linha.nome}: ligada mal formada`);
        }
      }
    }
    expect(erros.slice(0, 12)).toEqual([]);
    expect(carros.length).toBeGreaterThan(0);
    if (fixo) expect(marcadas).toBeGreaterThan(500);   // o estoque congelado tem as linhas; o do dia, o que tiver
  });

  // O ponto sem (ou quase sem) peça anunciada para o carro não termina num vazio (pedido do coordenador, 11/11): a lista
  // do conserto vira o PEDIDO de pátio. Em todo carro e em todo ponto: o painel nunca abre com o botão morto, nunca
  // mostra total sem peça com preço, e sem peça nenhuma o botão é o de pátio, com a mensagem certa.
  it('em todo carro e em todo ponto: sem peça anunciada, a lista é o pedido de pátio (botão vivo, mensagem certa, nunca R$ 0,00)', () => {
    const erros: string[] = [];
    let semPeca = 0;
    for (const c of carrosDoIndice(ix)) {
      const bc = new Busca(indiceDoCarro(ix, c.marca, c.modelo));
      const memo = new Map<string, ReturnType<Busca['procurar']>>();
      const doCarro = (f: Parameters<Busca['procurar']>[0]) => {
        const k = JSON.stringify(f);
        let r = memo.get(k);
        if (!r) { r = bc.procurar(f); memo.set(k, r); }
        return r;
      };
      const meuCarro = `${c.marca} ${c.modelo}, ano ____`;
      for (const p of PONTOS) {
        const onde = `${c.marca} ${c.modelo} [${p.k}]`;
        const linhas = linhasDoPainel(opcoesDoPonto(p, doCarro, c).map((o) => ({ ...o, n: o.itens.length })), (linha) => ({ linha, itens: [], certa: false, n: 0 }));
        const marc = marcadasDeInicio(linhas, true);
        const itens = linhas.filter((l, i) => marc.has(i) && l.n > 0).map((l) => l.itens[0]);
        const patio = linhas.filter((l, i) => marc.has(i) && !l.n).map((l) => l.linha.nome);
        const pe = peDoConserto(itens.length, patio.length);
        // o painel nunca abre com o botão morto: todo ponto tem linhas principais, com peça ou para procurar
        if (pe.estado === 'nada') erros.push(`${onde}: botão morto`);
        const msg = mensagemConserto({ ponto: p.em, meuCarro, itens: itens.map((it) => ({ nome: it.n, id: it.id, preco: it.p })), patio });
        if (!msg.includes(`batida ${p.em}`) || !msg.includes(`Meu carro: ${meuCarro}`)) erros.push(`${onde}: mensagem sem o ponto ou sem o carro`);
        for (const nome of patio) if (!msg.includes(nome)) erros.push(`${onde}: pátio sem "${nome}" na mensagem`);
        if (/R\$ 0,00/.test(msg)) erros.push(`${onde}: R$ 0,00 na mensagem`);
        if (itens.length) {
          // com preço: o total existe e é maior que zero
          if (pe.dataBotao !== 'raiox-conserto' || !(somaPrecos(itens.map((it) => ({ preco: it.p }))).whats > 0)) erros.push(`${onde}: orçamento sem total`);
        } else {
          semPeca++;
          // sem nenhuma peça com preço: o pedido de pátio, sem total em dinheiro
          if (pe.estado !== 'patio' || pe.botao !== 'Pedir para procurar no pátio' || pe.dataBotao !== 'raiox-patio') erros.push(`${onde}: sem peça e o botão não é o de pátio`);
          if (!patio.length || !msg.includes('Para procurar no pátio: ')) erros.push(`${onde}: sem a lista de pátio`);
          if (/R\$|Total/.test(msg)) erros.push(`${onde}: pedido de pátio com dinheiro na mensagem`);
          if (!poucoAnunciado(linhas)) erros.push(`${onde}: sem peça e a lista de pátio não abre o painel`);
        }
      }
    }
    expect(erros.slice(0, 12)).toEqual([]);
    if (fixo) expect(semPeca).toBeGreaterThan(0);   // no estoque congelado há ponto sem peça (a frente do Onix, por exemplo)
    // sem carro, nada nasce marcado (as peças são de carros diferentes)
    for (const p of PONTOS) {
      const linhas = linhasDoPainel(opcoesDoPonto(p, procurar).map((o) => ({ ...o, n: o.itens.length })), (linha) => ({ linha, itens: [], certa: false, n: 0 }));
      expect(marcadasDeInicio(linhas, false).size, p.k).toBe(0);
    }
  });

  it('linha extra sem peça sai da lista; a principal sem peça fica (pátio)', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const k = kitDoPonto(p, procurar, foto, CARRO);
    for (const l of k.linhas) if (l.extra) expect(l.n, l.nome).toBeGreaterThan(0);
    expect(k.linhas.find((l) => l.nome === 'Capô')?.rep).toBeNull();
    expect(k.linhas.find((l) => l.nome === 'Farol esquerdo')).toBeTruthy();
  });

  it('o código da peça é o gravado nela (campo "o"), nunca a chave da foto do anúncio', () => {
    for (const k of kitsDeTodos(procurar, foto)) for (const l of k.linhas) {
      if (!l.rep) continue;
      expect(l.rep.cod).not.toMatch(/MLB\d+_/);
      if (!fixo) expect(l.rep.h).toContain(l.rep.id);   // o estoque congelado não guarda o endereço nem as fotos
    }
  });

  it('com o carro: as contas de cada ponto saem sem erro e a soma por ponto bate com as linhas', () => {
    const kits = kitsDeTodos(procurar, foto, CARRO);
    expect(kits).toHaveLength(8);
    for (const k of kits) {
      expect(k.n).toBe(k.linhas.reduce((s, l) => s + l.n, 0));
      for (const l of k.linhas) {
        expect(l.n === 0).toBe(l.rep === null);
        if (l.rep) expect(l.rep.p).toBeGreaterThan(0);
      }
    }
  });

  it('o link da linha é o do catálogo (tipo + sub + lado/posição + o carro) e a busca dele contém as peças da linha', () => {
    for (const p of PONTOS) for (const l of p.linhas) {
      if (!l.tipo) continue;
      const u = new URL(linkDaLinha(l, CARRO), 'https://x');
      expect(u.pathname).toBe('/catalogo.html');
      expect(u.searchParams.get('tipo')).toBe(l.tipo);
      expect(u.searchParams.get('sub')).toBe(l.sub);
      expect(u.searchParams.get('lado')).toBe(l.lado ? (l.lado === 'E' ? 'esquerdo' : 'direito') : null);
      expect(u.searchParams.get('pos')).toBe(l.pos ? (l.pos === 'D' ? 'dianteiro' : 'traseiro') : null);
      const doCatalogo = new Set(procurar(filtrosDaLinha(l, CARRO)).map((it) => it.id));
      for (const it of itensDaLinha(p, l, procurar, CARRO)) expect(doCatalogo.has(it.id)).toBe(true);
    }
  });

  it('o pedido: só o que está marcado; peça sem estoque vai como pátio, não como item', () => {
    const p = PONTOS.find((x) => x.k === 'frente-esquerda')!;
    const k = kitDoPonto(p, procurar, foto, CARRO);
    const todas = new Set(k.linhas.map((_, i) => i));
    const { itens, patio } = pedidoDe(k.linhas, todas);
    expect(itens.length + patio.length).toBe(k.linhas.length);
    expect(itens.length).toBe(k.linhas.filter((l) => l.rep).length);
    expect(patio).toContain('Capô');
    expect(pedidoDe(k.linhas, new Set())).toEqual({ itens: [], patio: [] });
    const comPeca = k.linhas.findIndex((l) => l.rep);
    if (fixo) expect(comPeca).toBeGreaterThanOrEqual(0);
    if (comPeca >= 0) {
      const so = pedidoDe(k.linhas, new Set([comPeca]));
      expect(so.itens).toHaveLength(1);
      expect(so.patio).toEqual([]);
    }
  });
});

// Os exemplos da revisão 15, no estoque CONGELADO (não muda nunca; o do dia não entra aqui).
describe('a lista do conserto nos exemplos da revisão 15 (estoque fixo)', () => {
  it('XC60 2019 na lateral esquerda marca o forro DA PORTA e a maçaneta; o WR-V na frente não marca a caixa do ar', () => {
    const b = new Busca(indiceFixo());
    const procurar = (f: Parameters<Busca['procurar']>[0]) => b.procurar(f);
    const painel = (carro: { marca: string; modelo: string; ano?: number }, k: string) => {
      const p = PONTOS.find((x) => x.k === k)!;
      const linhas = linhasDoPainel(opcoesDoPonto(p, procurar, carro).map((o) => ({ ...o, n: o.itens.length })), (linha) => ({ linha, itens: [], certa: false, n: 0 }));
      const marc = marcadasDeInicio(linhas, true);
      return linhas.map((l, i) => ({ nome: l.linha.nome, peca: l.itens[0]?.n ?? '', marcada: marc.has(i) }));
    };
    const xc60 = painel({ marca: 'Volvo', modelo: 'XC60', ano: 2019 }, 'lateral-esquerda');
    const forro = xc60.find((l) => l.nome === 'Forro da porta')!;
    expect(forro.marcada).toBe(true);
    expect(forro.peca).toMatch(/^Forro (da )?portas? /);
    const mac = xc60.find((l) => l.nome === 'Maçaneta externa')!;
    expect(mac.marcada).toBe(true);
    expect(mac.peca).toMatch(/^Maçaneta /);
    // o WR-V do estoque congelado só tem a "Caixa ar condicionado" no tipo dos condensadores: nada marcado com ela
    const wrv = painel({ marca: 'Honda', modelo: 'WR-V' }, 'frente');
    expect(wrv.filter((l) => l.marcada && /^Caixa/.test(l.peca))).toEqual([]);
    // o título da linha vai como pedido de pátio (marcado, sem peça e sem preço); a caixa fica em "vai junto", sem marcar
    expect(wrv.find((l) => l.nome === 'Condensador do ar-condicionado')).toMatchObject({ peca: '', marcada: true });
    expect(wrv.find((l) => l.nome === `Condensador do ar-condicionado${LIGADA}`)).toMatchObject({ marcada: false });
  });
});
