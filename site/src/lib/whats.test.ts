import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ABERTURA, mensagem, whatsUrl, linkWhats, mensagemPeca, blocoPeca, WHATS } from './whats';
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
      url: 'https://izzatcarimports.com.br/peca/x-MLB1.html' }, 'Meu carro é Volvo XC60 ano ____. ');
    expect(m).toBe('Olá! Vim pelo site da Izzat Car. Tenho interesse nesta peça:\n\nLanterna esquerda tampa traseira · Volvo XC60 2018 a 2024 · Cód. A045591\n'
      + 'R$ 670,44\nhttps://izzatcarimports.com.br/peca/x-MLB1.html\n\nVi que tem 10% de desconto pedindo por aqui.\nMeu carro é Volvo XC60 ano ____. Serve e ainda tem?');
    expect(blocoPeca({ nome: 'Fechadura', url: 'u' })).toBe('Fechadura\nu');
    expect(blocoPeca({ linha: 'pronta', nome: 'x', url: 'u' })).toBe('pronta\nu');
  });
  it('o cartão manda a MESMA mensagem da peça (nunca o título cru)', () => {
    const m = msgWhats({ n: 'Retrovisor elétrico esquerdo', b: 'Volvo', m: 'XC60', y: [2018, 2024], o: 'a044297', p: 3785.77 }, 'https://izzatcarimports.com.br/peca/y.html');
    expect(m).toContain('Retrovisor elétrico esquerdo · Volvo XC60 2018 a 2024 · Cód. A044297\nR$ 3.785,77\n');
    expect(m.startsWith(ABERTURA)).toBe(true);
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
