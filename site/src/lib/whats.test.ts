import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ABERTURA, mensagem, whatsUrl, linkWhats, mensagemPeca, blocoPeca, cabecaPeca, caudaPeca, fichaPeca, blocoDaCabeca, urlDaCauda, linhaMeuCarro, precoWhats, precoWhatsTxt, mensagemFrete, WHATS } from './whats';
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
  it('a peça vai em forma de pedido: nome, carro, anos, código, anúncio, preço de/por e o link por último', () => {
    const m = mensagemPeca({ nome: 'Lanterna esquerda tampa traseira', carro: 'Volvo XC60', anos: '2018 a 2024', cod: 'A045591', preco: '670,44',
      url: 'https://izzatcarimports.com.br/peca/x-MLB1.html' }, linhaMeuCarro('Volvo XC60, ano ____'));
    expect(m).toBe('Olá! Vim pelo site da Izzat Car.\n\n*PEDIDO DE PEÇA*\n*Lanterna esquerda tampa traseira*\nVolvo XC60 · 2018 a 2024\nCódigo: A045591\nAnúncio: MLB1\n\n'
      + 'Preço no site: R$ 670,44\n*No WhatsApp (10% de desconto): R$ 603,40*\n\nMeu carro: Volvo XC60, ano ____\nServe e ainda tem?\n\nhttps://izzatcarimports.com.br/peca/x-MLB1.html');
    // sem carro salvo e sem código: as linhas somem, sem buraco
    expect(mensagemPeca({ nome: 'Fechadura', preco: '89,90', url: 'https://izzatcarimports.com.br/peca/f-MLB2.html' }))
      .toBe('Olá! Vim pelo site da Izzat Car.\n\n*PEDIDO DE PEÇA*\n*Fechadura*\nAnúncio: MLB2\n\nPreço no site: R$ 89,90\n*No WhatsApp (10% de desconto): R$ 80,91*\n\nServe e ainda tem?\n\nhttps://izzatcarimports.com.br/peca/f-MLB2.html');
    expect(blocoPeca({ nome: 'Fechadura', url: 'u' })).toBe('Fechadura\nu');
    expect(blocoPeca({ linha: 'pronta', nome: 'x', url: 'u' })).toBe('pronta\nu');
  });
  it('10% no WhatsApp em toda peça: centavos inteiros, milhar com ponto', () => {
    expect(precoWhats(244.64)).toBe(220.18);
    expect(precoWhats(149.33)).toBe(134.4);
    expect(precoWhats(3785.77)).toBe(3407.19);
    expect(precoWhatsTxt('244,64')).toBe('220,18');
    expect(precoWhatsTxt('3.785,77')).toBe('3.407,19');
    expect(precoWhatsTxt('149,33')).toBe('134,40');
    expect(precoWhatsTxt('x')).toBe('');
  });
  it('o cartão manda a MESMA mensagem da peça (nunca o título cru), com o de/por', () => {
    const m = msgWhats({ n: 'Retrovisor elétrico esquerdo', b: 'Volvo', m: 'XC60', y: [2018, 2024], o: 'a044297', p: 3785.77 }, 'https://izzatcarimports.com.br/peca/y-MLB3.html');
    expect(m).toContain('*Retrovisor elétrico esquerdo*\nVolvo XC60 · 2018 a 2024\nCódigo: A044297\nAnúncio: MLB3\n\nPreço no site: R$ 3.785,77\n*No WhatsApp (10% de desconto): R$ 3.407,19*\n');
    expect(m.startsWith(ABERTURA)).toBe(true);
    expect(m.endsWith('Serve e ainda tem?\n\nhttps://izzatcarimports.com.br/peca/y-MLB3.html')).toBe(true);
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
  const x = { nome: 'Caixa filtro ar', carro: 'Renault Clio, Logan e Sandero', anos: '2007 a 2014', cod: '8200328856', preco: '244,64',
    url: 'https://izzatcarimports.com.br/peca/caixa-filtro-ar-renault-clio-logan-sandero-07-14-8200328856-MLB7862060624.html' };
  it('a ficha da peça e o link saem do botão "Pedir no WhatsApp" (data-cabeca e data-cauda)', () => {
    expect(blocoDaCabeca(cabecaPeca(x))).toBe(fichaPeca(x));
    expect(fichaPeca(x)).toBe('*Caixa filtro ar*\nRenault Clio, Logan e Sandero · 2007 a 2014\nCódigo: 8200328856\nAnúncio: MLB7862060624');
    expect(urlDaCauda(caudaPeca(x.url))).toBe(x.url);
    expect(blocoDaCabeca('qualquer coisa')).toBe('');
    expect(urlDaCauda('sem link')).toBe('');
  });
  it('a mensagem: o CEP e a peça (sem prazo nem valor)', () => {
    expect(mensagemFrete('96445-000', { bloco: fichaPeca(x), url: x.url })).toBe(`${ABERTURA}\n\n*COTAÇÃO DE FRETE*\nCEP: 96445-000\n\n`
      + '*Caixa filtro ar*\nRenault Clio, Logan e Sandero · 2007 a 2014\nCódigo: 8200328856\nAnúncio: MLB7862060624\n\n' + x.url);
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
