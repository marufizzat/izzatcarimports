import { describe, it, expect } from 'vitest';
import { codigoValido, codigoDaPeca } from './dados';

describe('código gravado: só o que parece código de verdade', () => {
  it('aceita letra+número com 5 ou mais, e 6+ dígitos', () => {
    for (const c of ['95992471', '1J0858601', '39100-2B430', 'E0201043', '6940294-01', '2279092-7', '123456'])
      expect(codigoValido(c), c).toBe(true);
  });
  it('recusa palavras, números curtos, anos e lista de anos', () => {
    for (const c of ['Par', 'Fiat', 'Não', 'C390', '60629', '2007', '1998-1999-2000-2001', 'TIPTRONIC-GOLF', '', null, undefined])
      expect(codigoValido(c as string), String(c)).toBe(false);
  });
  it('codigoDaPeca pega o 1º código, em maiúsculas, ou nada', () => {
    expect(codigoDaPeca('1j0858601 1J0858601D')).toBe('1J0858601');
    expect(codigoDaPeca('Par Mola Válvula Rod')).toBe('');
    expect(codigoDaPeca('')).toBe('');
  });
});
