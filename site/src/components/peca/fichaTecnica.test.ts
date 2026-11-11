import { describe, it, expect } from 'vitest';
import { lerDescricao, montarFicha, iconeDoRotulo } from './fichaTecnica';

const desc = `<p>Peça original Volkswagen Gol Voyage G5 2008 a 2012. Código OEM 5U0199555.</p>
<h3>Identificação da peça</h3>
<ul><li>Peça: Coxim</li><li>Código OEM: 5U0199555</li><li>Material: Borracha + Metal</li><li>Cor predominante: Preto</li><li>Posição: Esquerdo</li><li>Condição: Em excelente estado de conservação</li></ul>
<h3>Aplicação e compatibilidade</h3><p>Removida de um Gol.</p>
<h3>Especificações técnicas</h3><ul><li>Comprimento da peça: 15 cm</li><li>Largura da peça: 12 cm</li><li>Altura da peça: 10 cm</li><li>Peso aproximado embalagem: 0.6 g</li></ul>
<h3>Condição real da peça</h3><p>Sem trincas.</p>`;

describe('ficha técnica e descrição em blocos', () => {
  const d = lerDescricao(desc);
  it('dados "Rótulo: valor" sobem para a ficha, sem o que já está no topo', () => {
    expect(d.extras.map((e) => e.rotulo)).toEqual(['Material', 'Cor predominante', 'Posição']);
  });
  it('medidas só reais; peso absurdo (0,6 g) fica de fora', () => {
    expect(d.medidas).toEqual({ c: '15', l: '12', a: '10', un: 'cm' });
  });
  it('condição vira o chip do Estado da peça', () => {
    expect(d.estado?.chip).toBe('Em excelente estado de conservação');
    expect(d.secoes.map((s) => s.titulo)).toEqual(['Compatibilidade']);
  });
  it('ficha não repete a cor que o ML já deu', () => {
    const f = montarFicha([['Código original (OEM)', '5U0199555'], ['Cor', 'Preto']], 'Volkswagen Gol e Voyage, 2008 a 2012', 'Serve em', d.extras, () => false);
    expect(f.map((l) => l.rotulo)).toEqual(['Código original', 'Serve em', 'Cor', 'Material', 'Posição']);
  });
  it('descrição vazia: nada quebra', () => {
    const v = lerDescricao('');
    expect(v).toEqual({ abertura: [], secoes: [], extras: [], medidas: null, estado: null });
  });
  it('peso em faixa fica faixa; códigos alternativos sobem para a ficha', () => {
    const x = lerDescricao('<h3>Especificações técnicas</h3><ul><li>Peso: 600-800g</li><li>Códigos Alternativos: J9C3-16C826-AA</li><li>Código OEM: J9C316C826AB</li></ul>');
    expect(x.medidas).toEqual({ peso: '600 a 800 g' });
    expect(x.extras.map((e) => e.rotulo)).toEqual(['Códigos Alternativos']);
  });
  it('ícone pelo rótulo', () => {
    expect(iconeDoRotulo('Modelos e versões')).toBe('veiculo');
    expect(iconeDoRotulo('Fabricante da peça')).toBe('fabrica');
    expect(iconeDoRotulo('Qualquer coisa')).toBe('info');
  });
});
