import { describe, it, expect } from 'vitest';
import { nomeCompleto, nomeMensagem, anosDaPeca } from './nomePeca';

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
