import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { precoCartao, precoCheioDoTexto, SELO_WHATS, brl } from './etiqueta';
import { cartaoHtml } from '../../lib/vendidaCartoes';
import { precoWhats } from '../../lib/whats';
import type { Item } from '../../lib/busca';

const item = (o: Partial<Item>): Item => ({
  k: 0, id: 'MLB123456789', t: 'Farol', n: 'Farol direito', p: 244.64, i: '', h: 'farol-direito-MLB123456789', f: false,
  b: 'Chevrolet', m: 'Cruze', y: [2017, 2021], c: 'Faróis e Lanternas', s: 'Faróis', o: 'E131464301', e: '1', ...o,
});

describe('preço do cartão: o do WhatsApp em destaque, o do anúncio riscado', () => {
  it('o grande é o preço com 10% (centavos inteiros) e o riscado é o cheio', () => {
    expect(precoCartao(10952)).toEqual({ de: '10.952,00', reais: '9.856', cent: '80', sr: 'de R$ 10.952,00 por R$ 9.856,80 no WhatsApp' });
    expect(precoCartao(7680)).toMatchObject({ de: '7.680,00', reais: '6.912', cent: '00' });
    // 685,55 -> 617,00 (em ponto flutuante dava 616,99); 149,33 -> 134,40 (o zero do centavo fica)
    expect(precoCartao(685.55)).toMatchObject({ reais: '617', cent: '00' });
    expect(precoCartao(149.33)).toMatchObject({ reais: '134', cent: '40' });
    expect(precoCartao(33854.35).sr).toBe('de R$ 33.854,35 por R$ 30.468,92 no WhatsApp');
    expect(SELO_WHATS).toBe('−10% no WhatsApp');
  });
  it('os scripts do cartão leem de volta o preço CHEIO (a lista e a mensagem do WhatsApp partem dele)', () => {
    expect(precoCheioDoTexto(precoCartao(10952).sr)).toBe('10.952,00');
    expect(precoCheioDoTexto(precoCartao(79.77).sr)).toBe('79,77');
    expect(precoCheioDoTexto('R$ 7.680,00')).toBe('7.680,00');   // cartão de antes (HTML em cache)
    expect(precoCheioDoTexto('')).toBe('');
    expect(precoCheioDoTexto(null)).toBe('');
  });
  it('o cartão montado no navegador: riscado, preço do WhatsApp, selo e o texto do leitor de tela', () => {
    const h = cartaoHtml(item({ p: 10952 }), '208px');
    expect(h).toContain('<span class="sr-only">de R$ 10.952,00 por R$ 9.856,80 no WhatsApp</span>');
    expect(h).toContain('<s>R$ 10.952,00</s><span class="etiqueta-preco"><small>R$</small>9.856<small>80</small></span><span class="etiqueta-wa">−10% no WhatsApp</span>');
    expect(h).toContain('90 dias de garantia');
    // a mensagem do "Pedir no WhatsApp" continua com o preço do site e o do WhatsApp
    const msg = decodeURIComponent(/href="https:\/\/wa\.me\/\d+\?text=([^"]+)"/.exec(h)![1]);
    expect(msg).toContain('Preço no site: R$ 10.952,00');
    expect(msg).toContain('No WhatsApp (10% de desconto): R$ 9.856,80');
  });
  it('"Peça única" só com o dado do anúncio (1 em estoque); nada de urgência inventada', () => {
    expect(cartaoHtml(item({ q: 1 }), '208px')).toContain('<b>Peça única</b>');
    expect(cartaoHtml(item({}), '208px')).not.toContain('Peça única');
    for (const proibido of ['últimas', 'Últimas', 'frete grátis', 'Frete grátis', 'mais barato']) expect(cartaoHtml(item({ q: 1 }), '208px')).not.toContain(proibido);
  });

  const arq = 'src/data/pecas.json';
  it.skipIf(!existsSync(arq))('estoque real: todo preço fecha em centavos e o do WhatsApp é sempre menor que o cheio', () => {
    const pecas: { p: number }[] = JSON.parse(readFileSync(arq, 'utf-8'));
    for (const p of pecas) {
      const c = precoCartao(p.p);
      expect(c.cent).toMatch(/^\d{2}$/);
      expect(`${c.reais},${c.cent}`).toBe(brl(precoWhats(p.p)));
      expect(precoWhats(p.p)).toBeLessThan(p.p);
      expect(precoCheioDoTexto(c.sr)).toBe(c.de);
    }
  });
});
