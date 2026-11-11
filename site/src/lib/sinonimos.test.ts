import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAPA_SINONIMOS, MAPA_FORA, SINONIMOS, plural, singulares, VAZIAS } from './sinonimos';
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

  it('o "fora" vale para o gatilho e o plural dele ("frente": painel, console…; "frentes" também)', () => {
    expect(MAPA_FORA.get('frente')).toContain('painel');
    expect(MAPA_FORA.get('frentes')).toContain('console');
    expect(MAPA_FORA.get('frente completa')).toContain('falante');
    expect(MAPA_FORA.has('sinaleira')).toBe(false);
    expect(MAPA_SINONIMOS.get('frente')!.map((f) => f.join(' '))).toContain('churrasqueira');
  });

  // No estoque CONGELADO de 09/11 (testes/fixtures): a tabela é escrita olhando os nomes do estoque, mas a última
  // "Fivela cinto" ou o último "Quebra-sol" vender não pode travar a publicação (o robô roda isto a cada 30 min).
  // Linha nova na tabela: conferir no estoque do dia ao escrever.
  it('cada linha da tabela aponta para um nome que existia no estoque de 09/11 (o congelado)', () => {
    const ix = JSON.parse(readFileSync('testes/fixtures/estoque-busca.json', 'utf-8'));
    const b = new Busca(ix);
    const nomes = b.itens.map((it) => new Set([...termos(it.n), ...termos(it.s)]));
    const existe = (frase: string) => {
      const ws = normal(frase).split(/\s+/).filter((w) => !VAZIAS.has(w));
      return nomes.some((t) => ws.every((w) => [...t].some((x) => x.startsWith(w))));
    };
    for (const [gatilhos, alts] of SINONIMOS) expect(alts.some(existe), gatilhos[0]).toBe(true);
  });
});
