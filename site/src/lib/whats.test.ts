import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ABERTURA, mensagem, whatsUrl, linkWhats, mensagemPeca, blocoPeca, cabecaPeca, blocoDaCabeca, mensagemFrete, WHATS } from './whats';
import { formatarCep, cepCompleto, digitosCep } from './cep';
import { msgWhats } from '../components/catalogo/etiqueta';

const texto = (u: string) => decodeURIComponent(u.split('?text=')[1]);

describe('WhatsApp: uma abertura só ("Olá! Vim pelo site da Izzat Car.")', () => {
  it('abertura + contexto, sem contexto só a abertura', () => {
    expect(mensagem()).toBe(ABERTURA);
    expect(mensagem('Estou procurando uma peça.')).toBe('Olá! Vim pelo site da Izzat Car. Estou procurando uma peça.');
    expect(mensagem('\nCarro: Gol')).toBe('Olá! Vim pelo site da Izzat Car.\nCarro: Gol');
  });
  it('link com o número da loja e a mensagem codificada', () => {
    const u = whatsUrl('Tenho uma dúvida:');
    expect(u.startsWith(`https://wa.me/${WHATS}?text=`)).toBe(true);
    expect(texto(u)).toBe(`${ABERTURA} Tenho uma dúvida:`);
    expect(texto(linkWhats('x'))).toBe('x');
  });
  it('a peça vai pelo nome limpo, carro, anos, código, preço e link', () => {
    const m = mensagemPeca({ nome: 'Lanterna esquerda tampa traseira', carro: 'Volvo XC60', anos: '2018 a 2024', cod: 'A045591', preco: '670,44',
      url: 'https://izzatcarimports.com.br/peca/x-MLB1.html' }, 'Meu carro é Volvo XC60 ano ____. ', { desconto: true });
    expect(m).toBe('Olá! Vim pelo site da Izzat Car. Tenho interesse nesta peça:\n\nLanterna esquerda tampa traseira · Volvo XC60 2018 a 2024 · Cód. A045591\n'
      + 'R$ 670,44\nhttps://izzatcarimports.com.br/peca/x-MLB1.html\n\nVi que tem 10% de desconto pedindo por aqui.\nMeu carro é Volvo XC60 ano ____. Serve e ainda tem?');
    expect(blocoPeca({ nome: 'Fechadura', url: 'u' })).toBe('Fechadura\nu');
    expect(blocoPeca({ linha: 'pronta', nome: 'x', url: 'u' })).toBe('pronta\nu');
  });
  it('o cartão manda a MESMA mensagem da peça (nunca o título cru)', () => {
    const m = msgWhats({ n: 'Retrovisor elétrico esquerdo', b: 'Volvo', m: 'XC60', y: [2018, 2024], o: 'a044297', p: 3785.77 }, 'https://izzatcarimports.com.br/peca/y.html');
    expect(m).toContain('Retrovisor elétrico esquerdo · Volvo XC60 2018 a 2024 · Cód. A044297\nR$ 3.785,77\n');
    expect(m.startsWith(ABERTURA)).toBe(true);
    expect(m).not.toContain('desconto');   // o cartão não mostra o selo do desconto
  });
  it('nenhum arquivo do site escreve a abertura à mão (todos passam pelo lib/whats.ts)', () => {
    const raiz = join(process.cwd(), 'src');
    const achados: string[] = [];
    const andar = (d: string) => {
      for (const f of readdirSync(d)) {
        const c = join(d, f);
        if (statSync(c).isDirectory()) { if (f !== 'data') andar(c); continue; }
        if (!/\.(astro|ts|tsx)$/.test(f) || /\.test\.ts$/.test(f) || c.endsWith(join('lib', 'whats.ts'))) continue;
        const s = readFileSync(c, 'utf-8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
        if (/Olá!/.test(s)) achados.push(c);
        if (/wa\.me\/\$\{|wa\.me\/55/.test(s)) achados.push(`${c} (link à mão)`);
      }
    };
    andar(raiz);
    expect(achados).toEqual([]);
  });
});

describe('frete pelo CEP (envios e "Como é o envio?" da peça)', () => {
  const x = { linha: 'Caixa filtro ar · Renault Clio, Logan e Sandero 2007 a 2014 · Cód. 8200328856', preco: '244,64',
    url: 'https://izzatcarimports.com.br/peca/caixa-filtro-ar-renault-clio-logan-sandero-07-14-8200328856-MLB7862060624.html' };
  it('o bloco da peça sai da cabeça do botão (com e sem a frase do desconto)', () => {
    expect(blocoDaCabeca(cabecaPeca(x, { desconto: true }))).toBe(blocoPeca(x));
    expect(blocoDaCabeca(cabecaPeca(x))).toBe(blocoPeca(x));
    expect(blocoDaCabeca('qualquer coisa')).toBe('');
  });
  it('a mensagem: o CEP e a peça (sem prazo nem valor)', () => {
    expect(mensagemFrete('96445-000', { bloco: blocoPeca(x) })).toBe(`${ABERTURA} Quero saber o frete desta peça para o CEP 96445-000:\n\n`
      + 'Caixa filtro ar · Renault Clio, Logan e Sandero 2007 a 2014 · Cód. 8200328856\nR$ 244,64\n' + x.url);
    expect(mensagemFrete('96445-000', { peca: 'farol do Cruze' })).toBe(`${ABERTURA} Quero saber o frete para o CEP 96445-000. A peça é: farol do Cruze`);
    expect(mensagemFrete('96445-000')).toBe(`${ABERTURA} Quero saber o frete para o CEP 96445-000. A peça é: ____`);
  });
  it('máscara 00000-000 e os 8 números', () => {
    expect(formatarCep('96445000')).toBe('96445-000');
    expect(formatarCep('96445-0')).toBe('96445-0');
    expect(formatarCep('9644')).toBe('9644');
    expect(formatarCep('96.445-0001')).toBe('96445-000');
    expect(digitosCep('abc96445')).toBe('96445');
    expect(cepCompleto('96445-000')).toBe(true);
    expect(cepCompleto('96445-00')).toBe(false);
    expect(cepCompleto('96445-0001')).toBe(false);
  });
});
