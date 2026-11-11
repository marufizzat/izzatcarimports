import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { sobreposicao, mesmaGeracao, doMesmoCarro, MAX_CARRO, MIN_MESMA, vaiJunto, papelDa, ladoDa, zonaDa, esqueleto, PAPEIS, MAX_JUNTO, codigosDe } from './relacionadas';
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

describe('"Vai junto": só o que entra no MESMO serviço, do mesmo carro (rodada 15)', () => {
  const carro = (b: string, m: string, y: [number, number] = [2017, 2021]) => {
    let n = 0;
    return (nome: string, s: string, o: Partial<Peca> = {}) => peca({ id: `MLB${b.length}${m.length}${++n}`, n: nome, s, b, m, y, ...o });
  };
  const nomes = (p: Peca, estoque: Peca[]) => vaiJunto(p, estoque).pecas.map((x) => x.n);

  it('farol direito: suporte e friso do MESMO lado, depois o para-choque dianteiro e a grade (nunca traseiro, esquerdo, outro carro ou outra geração)', () => {
    const c = carro('Chevrolet', 'Cruze');
    const farol = c('Farol direito', 'Faróis', { o: 'E131464301' });
    const estoque = [farol,
      c('Para-choque dianteiro', 'Para-choques'), c('Para-choque traseiro', 'Para-choques'),
      c('Grade superior dianteira', 'Grades do Para-choque', { y: [2017, 2023] }),
      c('Suporte farol direito', 'Suportes do Farol'), c('Suporte farol esquerdo', 'Suportes do Farol'),
      c('Farol esquerdo', 'Faróis'), c('Compressor ar condicionado', 'Compressores'),
      c('Grade para-choque antigo', 'Grades do Para-choque', { y: [2011, 2016] }),
      peca({ id: 'MLB10', n: 'Suporte farol direito', s: 'Suportes do Farol', b: 'Chevrolet', m: 'Onix', y: [2017, 2021] }),
      c('Farol direito', 'Faróis', { o: 'E131464301', p: 900 }),
      c('Guia para-choque dianteiro direito', 'Guias e Suportes do Para-choque'),
      c('Guia para-choque dianteiro', 'Guias e Suportes do Para-choque'),   // sem o lado: não dá para dizer que é a do mesmo lado
    ];
    const r = vaiJunto(farol, estoque);
    expect(r.pecas.map((x) => x.n)).toEqual(['Suporte farol direito', 'Guia para-choque dianteiro direito', 'Para-choque dianteiro']);
    expect(r.com).toBe('o farol');
    expect(vaiJunto(c('Farol', 'Faróis', { y: null }), estoque).pecas).toEqual([]);   // sem ano: não dá para garantir a geração
    expect(vaiJunto(estoque[7], estoque)).toEqual({ pecas: [], com: '' });            // sem companheira no estoque: sem bloco
  });

  it('lanterna: a outra lanterna do mesmo lado, o soquete e a guia do para-choque traseiro do mesmo lado', () => {
    const c = carro('Citroën', 'C4 Cactus', [2018, 2024]);
    const lant = c('Lanterna traseira esquerda', 'Lanternas Traseiras');
    expect(nomes(lant, [lant,
      c('Lanterna tampa traseira esquerda', 'Lanternas Traseiras'), c('Lanterna tampa traseira direita', 'Lanternas Traseiras'),
      c('Lanterna traseira direita', 'Lanternas Traseiras'), c('Soquete lanterna traseira esquerda', 'Lanternas Traseiras'),
      c('Guia para-choque traseiro esquerdo', 'Guias e Suportes do Para-choque'), c('Guia para-choque dianteiro esquerdo', 'Guias e Suportes do Para-choque'),
      c('Para-choque traseiro', 'Para-choques'), c('Farol esquerdo', 'Faróis'),
    ])).toEqual(['Lanterna tampa traseira esquerda', 'Soquete lanterna traseira esquerda', 'Guia para-choque traseiro esquerdo']);
  });

  it('porta: só peças da MESMA porta (lado e dianteira/traseira); "motorista" = dianteira esquerda', () => {
    const c = carro('Fiat', 'Toro', [2016, 2022]);
    const mac = c('Maçaneta externa traseira direita', 'Maçanetas das Portas');
    const estoque = [mac,
      c('Fechadura porta dianteira direita', 'Fechaduras das Portas'), c('Fechadura porta traseira direita', 'Fechaduras das Portas'),
      c('Fechadura elétrica', 'Fechaduras das Portas'),   // sem dizer a porta: não entra na de uma porta dita
      c('Suporte maçaneta traseira direita', 'Maçanetas das Portas'), c('Suporte maçaneta traseira esquerda', 'Maçanetas das Portas'),
      c('Máquina vidro elétrico traseira direita', 'Máquinas e Motores de Vidro Elétrico'),   // outro serviço
    ];
    expect(nomes(mac, estoque)).toEqual(['Suporte maçaneta traseira direita', 'Fechadura porta traseira direita']);
    const maq = c('Motor vidro elétrico dianteiro esquerdo', 'Máquinas e Motores de Vidro Elétrico');
    expect(nomes(maq, [maq,
      c('Botão vidro elétrico motorista', 'Botões do Vidro Elétrico'), c('Botão vidro elétrico passageiro', 'Botões do Vidro Elétrico'),
      c('Botão vidro traseiro esquerdo', 'Botões do Vidro Elétrico'), c('Forro porta dianteira esquerda', 'Forros'),
      c('Forro porta-malas esquerdo', 'Forros'),
    ])).toEqual(['Botão vidro elétrico motorista', 'Forro porta dianteira esquerda']);
    // nenhuma das duas diz a porta: vale ("Fechadura" e "Maçaneta externa")
    const fech = c('Fechadura elétrica', 'Fechaduras das Portas');
    expect(nomes(fech, [fech, c('Maçaneta externa', 'Maçanetas das Portas'), mac])).toEqual(['Maçaneta externa']);
  });

  it('arrefecimento, turbo e suspensão: o conjunto do serviço', () => {
    const c = carro('Volvo', 'XC60', [2018, 2024]);
    const bomba = c("Bomba d'água", 'Bombas de Água');
    expect(nomes(bomba, [bomba, c('Válvula termostática', 'Válvulas Termostáticas'), c('Tensor correia', 'Tensores de Correia'),
      c('Bomba água auxiliar', 'Bombas de Água'), c('Mangueira bomba água', 'Mangueiras de Arrefecimento'), c('Guia corrente distribuição', 'Peças da Distribuição'),
    ])).toEqual(['Válvula termostática', 'Mangueira bomba água', 'Tensor correia']);
    const turbo = c('Turbina completa', 'Turbinas');
    expect(nomes(turbo, [turbo, c('Mangueira intercooler', 'Mangueiras do Turbo e Intercooler'), c('Intercooler radiador', 'Intercoolers'),
      c('Válvula solenoide pressão turbina', 'Válvulas Solenoides'), c('Comando rebatimento tampa', 'Outros Botões'),
    ])).toEqual(['Mangueira intercooler', 'Intercooler radiador', 'Válvula solenoide pressão turbina']);
    const amort = c('Amortecedor dianteiro esquerdo', 'Amortecedores');
    expect(nomes(amort, [amort, c('Coxim amortecedor dianteiro esquerdo', 'Coxins do Amortecedor'), c('Coxim amortecedor traseiro esquerdo', 'Coxins do Amortecedor'),
      c('Mola suspensão dianteira', 'Molas'), c('Mola suspensão traseira', 'Molas'), c('Mola', 'Molas'), c('Bieleta dianteira direita', 'Bieletas e Barras Estabilizadoras'),
    ])).toEqual(['Coxim amortecedor dianteiro esquerdo', 'Mola suspensão dianteira']);
  });

  it('os casos sem sentido de antes não voltam (cliente oculto 2 e revisão 14)', () => {
    const c = carro('Hyundai', 'Genesis', [2009, 2014]);
    const tudo = [
      c('Botão ESP eco reostato', 'Outros Botões'), c('Botão desembaçador', 'Botões do Desembaçador'), c('Botão pisca-alerta', 'Botões do Pisca-alerta'),
      c('Volante direção', 'Volantes'), c('Bomba direção hidráulica', 'Bombas de Direção e Suportes'),
      c('Luva eixo mancal motor', 'Bronzinas'), c('Cabeçote', 'Cabeçotes'), c('Biela motor', 'Bielas'),
      c('Chave seta', 'Chaves de Seta e Luz'), c('Botão farol milha', 'Chaves de Seta e Luz'),
      c('Bobina ignição', 'Bobinas de Ignição'), c('Tampa válvula', 'Tampas de Válvulas'),
      c('Sensor rotação', 'Sensores de Rotação'), c('Sensor fase comando válvulas', 'Sensores de Posição'), c('Chicote pisca bico injetor', 'Módulos de Injeção'),
      c('Mangueira arrefecimento', 'Mangueiras de Arrefecimento'), c('Guia corrente distribuição', 'Peças da Distribuição'),
      c('Tampa caixa filtro ar', 'Caixas do Filtro de Ar'), c('Bomba alta pressão', 'Bombas de Alta Pressão'),
      c('Absorvedor impacto', 'Almas do Para-choque'), c('Lanterna traseira esquerda', 'Lanternas Traseiras'), c('Grade churrasqueira', 'Grades do Para-choque'),
    ];
    const de = (n: string) => nomes(tudo.find((x) => x.n === n)!, tudo);
    for (const sem of ['Botão ESP eco reostato', 'Botão desembaçador', 'Botão pisca-alerta', 'Luva eixo mancal motor', 'Chave seta', 'Botão farol milha',
      'Bobina ignição', 'Sensor rotação', 'Mangueira arrefecimento', 'Tampa caixa filtro ar', 'Absorvedor impacto']) expect(de(sem), sem).toEqual([]);
    expect(de('Cabeçote')).toEqual(['Tampa válvula']);
    expect(de('Biela motor')).toEqual([]);              // a "Luva eixo mancal" não é bronzina pelo nome: não entra
  });

  it('nunca a mesma peça de novo: mesmo código, mesmo nome, o mesmo nome noutro canto ou com palavras a mais', () => {
    const c = carro('Volvo', 'XC60', [2018, 2024]);
    const mang = c('Mangueira superior radiador', 'Mangueiras de Arrefecimento', { o: 'A1' });
    expect(nomes(mang, [mang,
      c('Mangueira superior radiador', 'Mangueiras de Arrefecimento', { o: 'B2' }),   // o mesmo nome
      c('Mangueira radiador', 'Mangueiras de Arrefecimento', { o: 'C3' }),            // o mesmo nome com menos palavras
      c('Mangueira inferior radiador', 'Mangueiras de Arrefecimento', { o: 'A1' }),   // o mesmo código
      c('Mangueira retorno radiador', 'Mangueiras de Arrefecimento', { o: 'D4' }),
      c('Mangueira água radiador', 'Mangueiras de Arrefecimento', { o: 'D4' }),       // o código de outro cartão
    ])).toEqual(['Mangueira água radiador']);
    const motor = c('Motor limpador para-brisa', 'Motores do Limpador');
    expect(nomes(motor, [motor, c('Motor limpador galhada para-brisa', 'Motores do Limpador'), c('Braço limpador para-brisa esquerdo', 'Braços do Limpador'),
      c('Braço limpador para-brisa direito', 'Braços do Limpador')])).toEqual(['Braço limpador para-brisa direito']);
    expect(esqueleto('Suporte coxins câmbio traseiro esquerdo')).toBe(esqueleto('Suporte coxim câmbio'));
  });

  it('peça de 2+ carros entra no carro em que serve, com os anos daquele carro', () => {
    const p = peca({ id: 'MLB1', n: 'Retrovisor elétrico esquerdo', s: 'Retrovisores Externos', b: 'Volvo', m: 'XC60', y: [2018, 2024] });
    const capa = peca({ id: 'MLB2', n: 'Capa retrovisor esquerdo', s: 'Capas e Molduras do Retrovisor', b: 'Volvo', m: 'S60', ms: ['S60', 'XC60'], y: [2018, 2024] });
    const velha = peca({ id: 'MLB3', n: 'Moldura retrovisor esquerdo', s: 'Capas e Molduras do Retrovisor', b: 'Volvo', m: 'S60', ms: ['S60', 'XC60'], y: [2018, 2024], ys: [[2018, 2024], [2009, 2017]] });
    const interna = peca({ id: 'MLB4', n: 'Capa retrovisor interno', s: 'Capas e Molduras do Retrovisor', b: 'Volvo', m: 'XC60', y: [2018, 2024] });
    const direita = peca({ id: 'MLB5', n: 'Capa retrovisor direito', s: 'Capas e Molduras do Retrovisor', b: 'Volvo', m: 'XC60', y: [2018, 2024] });
    expect(vaiJunto(p, [p, capa, velha, interna, direita]).pecas.map((x) => x.id)).toEqual(['MLB2']);
  });

  it('lado, posição e papel pelo nome', () => {
    expect(ladoDa('Retrovisor elétrico esquerdo')).toBe('E');
    expect(ladoDa('Maçaneta porta motorista')).toBe('E');
    expect(ladoDa('Macaneta externa tras dir')).toBe('D');
    expect(ladoDa('Braço direto para-brisa')).toBe('D');   // "direto" = direito (erro de digitação do anúncio)
    expect(ladoDa('Caixa direção')).toBe(null);
    expect(ladoDa('Par de faróis esquerdo e direito')).toBe(null);
    expect(zonaDa('Farol direito', 'farol')).toBe('frente');
    expect(zonaDa('Guia para-choque traseiro', 'guia-parachoque')).toBe('tras');
    expect(zonaDa('Para-choque', 'parachoque')).toBe(null);
    expect(zonaDa('Botão vidro elétrico motorista', 'botao-vidro')).toBe('frente');
    expect(papelDa({ s: 'Amortecedores da Tampa e do Capô', n: 'Amortecedor capô' })).toBe('capo-mola');
    expect(papelDa({ s: 'Amortecedores da Tampa e do Capô', n: 'Amortecedor tampa traseira' })).toBe('tampa-mola');
    expect(papelDa({ s: 'Válvulas Solenoides', n: 'Válvula solenoide pressão turbina' })).toBe('turbo-valvula');
    expect(papelDa({ s: 'Outros Botões', n: 'Botão abertura porta-malas' })).toBe('tampa-botao');
    expect(papelDa({ s: 'Outros Botões', n: 'Botão ESP' })).toBe(null);
    expect(papelDa({ s: 'Capas e Molduras do Retrovisor', n: 'Acabamento interno retrovisor esquerdo' })).toBe('retrovisor-capa');
    expect(papelDa({ s: 'Capas e Molduras do Retrovisor', n: 'Capa retrovisor interno' })).toBe('retrovisor-interno-capa');
  });

  it('todo papel citado existe', () => {
    for (const [k, g] of Object.entries(PAPEIS)) for (const x of g.j) expect(PAPEIS[x], `${k} -> ${x}`).toBeTruthy();
  });

  const arq = 'src/data/pecas.json';
  it.skipIf(!existsSync(arq))('estoque real: mesmo carro e geração, lado e posição iguais quando as duas dizem, nunca o mesmo código nem o mesmo nome, no máximo 3', () => {
    const pecas: Peca[] = JSON.parse(readFileSync(arq, 'utf-8'));
    const porModelo = new Map<string, Peca[]>();
    for (const x of pecas) for (const m of x.ms && x.ms.length ? x.ms : x.m ? [x.m] : []) {
      const k = `${x.b}|${m}`; porModelo.set(k, [...(porModelo.get(k) ?? []), x]);
    }
    const tipos = new Set(pecas.map((x) => x.s));
    const semTipo = Object.entries(PAPEIS).filter(([, g]) => !g.t.some((t) => tipos.has(t))).map(([k]) => k);
    if (semTipo.length) console.warn(`AVISO: papéis do "Vai junto" sem nenhum tipo no estoque: ${semTipo.join(', ')}`);
    let com = 0, cartoes = 0;
    for (const p of pecas) {
      const r = vaiJunto(p, porModelo.get(`${p.b}|${p.m}`) ?? []);
      expect(r.pecas.length).toBeLessThanOrEqual(MAX_JUNTO);
      if (!r.pecas.length) continue;
      com++; cartoes += r.pecas.length;
      const papel = papelDa(p)!;
      const lado = ladoDa(p.n), zona = zonaDa(p.n, papel);
      const usados = new Set<string>(codigosDe(p));
      const nomesVistos = new Set<string>([esqueleto(p.n)]);
      for (const x of r.pecas) {
        expect(x.id).not.toBe(p.id);
        expect(x.b).toBe(p.b);
        expect(serveNoModelo(x, p.m), `${p.id} -> ${x.id}`).toBe(true);
        expect(mesmaGeracao(anosNoModelo(p, p.m), anosNoModelo(x, p.m)), `${p.id} -> ${x.id}`).toBe(true);
        const px = papelDa(x)!;
        expect(PAPEIS[papel].j, `${p.n} -> ${x.n}`).toContain(px);
        const lx = ladoDa(x.n), zx = zonaDa(x.n, px);
        if (lado && lx) expect(lx, `${p.n} -> ${x.n}`).toBe(lado);
        if (zona && zx) expect(zx, `${p.n} -> ${x.n}`).toBe(zona);
        // porta: a mesma porta, também quando só uma das duas diz
        if (PAPEIS[papel].porta || PAPEIS[px].porta) { expect(lx, `${p.n} -> ${x.n}`).toBe(lado); expect(zx, `${p.n} -> ${x.n}`).toBe(zona); }
        for (const c of codigosDe(x)) { expect(usados.has(c), `${p.id} -> ${x.id} código ${c}`).toBe(false); usados.add(c); }
        expect(nomesVistos.has(esqueleto(x.n)), `${p.id} -> ${x.id} nome repetido`).toBe(false);
        nomesVistos.add(esqueleto(x.n));
      }
    }
    console.log(`"Vai junto": ${com} de ${pecas.length} peças com o bloco (${cartoes} cartões)`);
    expect(com).toBeGreaterThan(pecas.length / 10);   // a regra não pode sumir com o bloco do site
  });
});
