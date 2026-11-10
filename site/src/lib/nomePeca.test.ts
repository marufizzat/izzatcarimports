import { describe, it, expect } from 'vitest';
import { nomeCompleto, nomeMensagem, anosDaPeca, tituloPeca, titulosPecas, TITULO_MAX } from './nomePeca';

// auditoria 3, itens 4.2 e 9.2: fora da página, a peça vai pelo nome limpo, nunca pelo título cru do ML
const p = { n: 'Módulo sensor combustível', b: 'Volkswagen', m: 'Virtus', ms: ['Virtus', 'Polo', 'Up'], y: [2018, 2024] as [number, number], oem: '06k907811' };

describe('nome da peça fora da página', () => {
  it('título/schema/feed: nome + carros + anos + código (o código em maiúsculas)', () => {
    expect(nomeCompleto(p)).toBe('Módulo sensor combustível Volkswagen Virtus, Polo e Up 2018–2024 06K907811');
  });
  it('mensagem do WhatsApp: partes separadas, "a" nos anos e "Cód."', () => {
    expect(nomeMensagem(p)).toBe('Módulo sensor combustível · Volkswagen Virtus, Polo e Up 2018 a 2024 · Cód. 06K907811');
  });
  it('sem carro, sem ano e sem código válido: só o nome', () => {
    const s = { n: 'Fechadura', b: '', m: '', y: null, oem: 'Par' };
    expect(nomeCompleto(s)).toBe('Fechadura');
    expect(nomeMensagem(s)).toBe('Fechadura');
  });
  it('anos: um ano só quando a faixa é de um ano', () => {
    expect(anosDaPeca([2026, 2026])).toBe('2026');
    expect(anosDaPeca([2018, 2024], ' a ')).toBe('2018 a 2024');
    expect(anosDaPeca(null)).toBe('');
  });
});

// revisão 7, P3.8: o <title> da peça em até 65 caracteres, cortado em partes inteiras
describe('título da aba (<title>) da peça', () => {
  const curto = { n: 'Farol direito', b: 'Chevrolet', m: 'Cruze', y: [2017, 2021] as [number, number], oem: 'E131464301' };
  it('cabe tudo: nome + carro + anos + código + sufixo', () => {
    expect(tituloPeca(curto)).toBe('Farol direito Chevrolet Cruze 2017–2021 E131464301 | Izzat Car');
  });
  it('sai primeiro o código, depois os anos, depois o sufixo; o nome sempre inteiro', () => {
    const q = { n: 'Botão vidro elétrico traseiro esquerdo', b: 'Nissan', m: 'Kicks', y: [2021, 2025] as [number, number], oem: '254115RA5A' };
    expect(tituloPeca(q)).toBe('Botão vidro elétrico traseiro esquerdo Nissan Kicks | Izzat Car');
    const r = { ...q, n: 'Acabamento interno coluna traseira esquerda', b: 'Volkswagen', m: 'Polo' };
    expect(tituloPeca(r)).toBe('Acabamento interno coluna traseira esquerda Volkswagen Polo');
    const so = { ...q, n: 'Moldura acabamento painel central do console com saída de ar e botões' };
    expect(tituloPeca(so)).toBe(so.n);                       // nunca corta o nome, mesmo passando de 65
  });
  it('2+ carros: os carros saem um a um do fim (nunca no meio da palavra)', () => {
    expect(tituloPeca(p)).toBe('Módulo sensor combustível Volkswagen Virtus, Polo e Up');
    const longo = { ...p, n: 'Módulo sensor nível combustível tanque' };
    expect(tituloPeca(longo)).toBe('Módulo sensor nível combustível tanque Volkswagen Virtus e Polo');
  });
  it('desempate: os anos de volta, depois o código, por fim o MLB; nada passa de 65 nem repete', () => {
    const base = { n: 'Botão vidro elétrico traseiro esquerdo', b: 'Nissan', m: 'Kicks', oem: '' };
    const lista = [
      { ...base, id: 'MLB1', y: [2017, 2020] as [number, number], oem: '254115RA5A' },
      { ...base, id: 'MLB2', y: [2021, 2025] as [number, number], oem: '254115RA5A' },
      { ...base, id: 'MLB3', y: [2021, 2025] as [number, number], oem: '254115RA9B' },
      { ...base, id: 'MLB4', y: [2021, 2025] as [number, number], oem: '254115RA9B' },
      { n: 'Fechadura', b: '', m: '', y: null, oem: '', id: 'MLB5' },
    ];
    const t = titulosPecas(lista);
    expect(t.get('MLB1')).toBe('Botão vidro elétrico traseiro esquerdo Nissan Kicks 2017–2020');
    expect(t.get('MLB2')).toBe('Botão vidro elétrico traseiro esquerdo Nissan Kicks 254115RA5A');
    expect(t.get('MLB3')).toBe('Botão vidro elétrico traseiro esquerdo Nissan Kicks MLB3');
    expect(t.get('MLB5')).toBe('Fechadura | Izzat Car');
    expect(new Set(t.values()).size).toBe(lista.length);
    for (const v of t.values()) expect(v.length).toBeLessThanOrEqual(TITULO_MAX);
  });
  it('desempate nunca tira o carro: o código só com o carro inteiro; o MLB passa de 65 antes de o carro sair', () => {
    // rodada 8: as 2 fechaduras gêmeas do Up perdiam o carro inteiro ("Fechadura ... direita MLB7076694904")
    const f = { n: 'Fechadura trava elétrica traseira direita', b: 'Volkswagen', m: 'Up', y: [2014, 2021] as [number, number], oem: '1sb839016f' };
    // e a maçaneta do Xsara Picasso perdia o modelo para o código caber ("... Citroën 9631487677 | Izzat Car")
    const m = { n: 'Maçaneta interna dianteira direita', b: 'Citroën', m: 'Xsara Picasso', y: [2000, 2004] as [number, number] };
    const t = titulosPecas([
      { ...f, id: 'MLB7076694904' }, { ...f, id: 'MLB7085082218' },
      { ...m, id: 'MLB6909000856', oem: '9631487677' }, { ...m, id: 'MLB4741914939', oem: '303966' },
    ]);
    expect(t.get('MLB7076694904')).toBe('Fechadura trava elétrica traseira direita Volkswagen Up MLB7076694904');
    expect(t.get('MLB6909000856')).toBe('Maçaneta interna dianteira direita Citroën Xsara Picasso');
    expect(t.get('MLB4741914939')).toBe('Maçaneta interna dianteira direita Citroën Xsara Picasso 303966');
    expect(new Set(t.values()).size).toBe(4);
    // 2+ carros com o MLB: os outros carros saem, a marca e o 1º modelo ficam
    const v = tituloPeca({ n: 'Módulo sensor nível combustível tanque', b: 'Volkswagen', m: 'Virtus', ms: ['Virtus', 'Polo'], y: null, oem: '' }, { extra: 'MLB7085082218' });
    expect(v).toBe('Módulo sensor nível combustível tanque Volkswagen Virtus MLB7085082218');
  });
});
