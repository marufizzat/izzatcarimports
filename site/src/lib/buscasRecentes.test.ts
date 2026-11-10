import { describe, it, expect, beforeEach } from 'vitest';
import { CHAVE_RECENTES, guardarBusca, lerRecentes, limparRecentes, MAX_RECENTES } from './buscasRecentes';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
});

describe('buscas recentes (só no navegador)', () => {
  it('a mais nova primeiro, sem repetir, no máximo 5', () => {
    for (const q of ['farol xc60', 'lanterna', 'Farol XC60 ', 'retrovisor', 'tbi', 'bobina', 'módulo injeção']) guardarBusca(q);
    const l = lerRecentes();
    expect(l.length).toBe(MAX_RECENTES);
    expect(l[0]).toBe('módulo injeção');
    // "Farol XC60 " é a mesma de "farol xc60": fica uma só, a última escrita
    expect(l.filter((x) => x.toLowerCase().startsWith('farol')).length).toBeLessThanOrEqual(1);
  });

  it('menos de 2 letras não entra; lixo no armazenamento vira lista vazia; limpar apaga', () => {
    guardarBusca('a');
    expect(lerRecentes()).toEqual([]);
    mem.set(CHAVE_RECENTES, '{quebrado');
    expect(lerRecentes()).toEqual([]);
    mem.set(CHAVE_RECENTES, JSON.stringify([1, null, 'farol', ' ']));
    expect(lerRecentes()).toEqual(['farol']);
    limparRecentes();
    expect(mem.has(CHAVE_RECENTES)).toBe(false);
  });
});
