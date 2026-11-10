import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAPA_SINONIMOS, SINONIMOS, plural, singulares, VAZIAS } from './sinonimos';
import { Busca, termos, normal } from './busca';

describe('sinônimos: o jeito de falar do cliente', () => {
  it('plural e singular em português', () => {
    expect(plural('farol')).toBe('farois');
    expect(plural('sinaleira')).toBe('sinaleiras');
    expect(plural('motor')).toBe('motores');
    expect(plural('botao')).toBe('botoes');
    expect(singulares('farois')).toContain('farol');
    expect(singulares('lanternas')).toContain('lanterna');
    expect(singulares('retrovisores')).toContain('retrovisor');
    expect(singulares('botoes')).toContain('botao');
    expect(singulares('paineis')).toContain('painel');
    expect(singulares('luzes')).toContain('luz');
    // curta, com número ou sem "s": nada
    expect(singulares('gas')).toEqual([]);
    expect(singulares('xc60s')).toEqual([]);
    expect(singulares('farol')).toEqual([]);
  });

  it('o gatilho vale sem as palavras vazias e no plural', () => {
    expect(MAPA_SINONIMOS.get('sinaleira')).toEqual([['lanterna']]);
    expect(MAPA_SINONIMOS.get('sinaleiras')).toEqual([['lanterna']]);
    // "máquina de vidro" = "maquina vidro"
    expect(MAPA_SINONIMOS.get('maquina vidro')!.map((f) => f.join(' '))).toContain('motor vidro');
    expect(MAPA_SINONIMOS.get('mola gas')!.map((f) => f.join(' '))).toContain('amortecedor tampa');
    for (const k of MAPA_SINONIMOS.keys()) for (const w of k.split(' ')) expect(VAZIAS.has(w), k).toBe(false);
  });

  it('cada linha da tabela aponta para um nome que EXISTE no estoque', (ctx) => {
    let ix;
    try { ix = JSON.parse(readFileSync('public/dados/busca.json', 'utf-8')); } catch { return ctx.skip(); }
    const b = new Busca(ix);
    const nomes = b.itens.map((it) => new Set([...termos(it.n), ...termos(it.s)]));
    const existe = (frase: string) => {
      const ws = normal(frase).split(/\s+/).filter((w) => !VAZIAS.has(w));
      return nomes.some((t) => ws.every((w) => [...t].some((x) => x.startsWith(w))));
    };
    for (const [gatilhos, alts] of SINONIMOS) expect(alts.some(existe), gatilhos[0]).toBe(true);
  });
});
