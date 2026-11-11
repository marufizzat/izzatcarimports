import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { agrupar, cartoesNoHtml, chaveGrupo, nomeGrupo, textoMais, textoSalvo, htmlGrupo, htmlFicha, classeMais, POR_GRUPO, CARTOES_NO_HTML } from './carroPagina';

const p = (id: number, c: string) => ({ id: `MLB${id}`, c });

describe('página do carro: peças por família', () => {
  it('as famílias com mais peças primeiro (empate: a ordem da loja), "Outros" por último; dentro, as mais novas primeiro', () => {
    const g = agrupar([p(1, 'Motor'), p(5, 'Freios'), p(3, 'Motor'), p(2, 'Rodas'), p(9, 'Outros'), p(8, 'Outros'), p(7, 'Outros'), p(4, 'Freios'), p(10000000000, 'Motor')], ['Rodas', 'Freios', 'Motor']);
    expect(g.map((x) => [x.c, x.itens.length])).toEqual([['Motor', 3], ['Freios', 2], ['Rodas', 1], ['Outros', 3]]);
    expect(g[0].itens.map((x) => x.id)).toEqual(['MLB10000000000', 'MLB3', 'MLB1']);   // o id mais comprido é o mais novo
    expect(agrupar([p(1, 'Freios'), p(2, 'Rodas')], ['Rodas', 'Freios']).map((x) => x.c)).toEqual(['Rodas', 'Freios']);
  });
  it('carro grande: só os primeiros grupos levam os cartões no HTML (o peso da página não sobe)', () => {
    expect(cartoesNoHtml([65, 61, 43, 36, 35, 33, 5, 1], CARTOES_NO_HTML)).toEqual([8, 8, 8, 8, 8, 0, 0, 0]);
    expect(cartoesNoHtml([3, 2], 40)).toEqual([3, 2]);
    expect(cartoesNoHtml([100], 4)).toEqual([POR_GRUPO]);   // o 1º grupo sempre entra
    expect(cartoesNoHtml([8, 8, 8, 8, 8, 3, 2], 40).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(40);
  });
  it('âncora, nome e textos', () => {
    expect(chaveGrupo('Faróis e Lanternas')).toBe('g-farois-e-lanternas');
    expect(chaveGrupo('Câmbio e Transmissão')).toBe('g-cambio-e-transmissao');
    expect(nomeGrupo('Outros')).toBe('Outras peças');
    expect(textoMais(1082, 'Motor')).toBe('Ver as 1.082 de Motor');
    expect(classeMais(9)).toBe('');
    expect(classeMais(7)).toBe(' gp-mais-estreito');
    expect(classeMais(5)).toBe(' gp-mais-celular');
    const h = htmlGrupo('Faróis e Lanternas', 14, '<i></i>', '/catalogo.html?marca=Volvo&modelo=XC60&ano=2019&tipo=Far%C3%B3is%20e%20Lanternas');
    expect(h).toContain('id="g-farois-e-lanternas"');
    expect(h).toContain('href="/catalogo.html?marca=Volvo&amp;modelo=XC60&amp;ano=2019&amp;tipo=Far%C3%B3is%20e%20Lanternas">Ver as 14 de Faróis e Lanternas</a>');
    expect(htmlGrupo('Rodas', 3, '', '/x')).not.toContain('gp-mais');   // grupo curto: sem "Ver as N"
    expect(htmlFicha('Motor', 82)).toBe('<a class="gp-ficha" href="#g-motor">Motor <small class="num">82</small></a>');
  });
  it('o aviso de salvar diz o que aconteceu com o carro de antes', () => {
    expect(textoSalvo(null, 'Volvo', 'XC60')).toBe('Salvo como seu carro');
    expect(textoSalvo({ b: 'Volvo', m: 'XC60', y: 2018 }, 'Volvo', 'XC60')).toBe('Salvo como seu carro');
    expect(textoSalvo({ b: 'Chevrolet', m: 'Onix', y: 2015 }, 'Volvo', 'XC60')).toBe('Salvo no lugar do Onix 2015');
    expect(textoSalvo({ b: 'Chevrolet', m: 'Onix', y: null }, 'Volvo', 'XC60')).toBe('Salvo no lugar do Onix');
  });

  const arq = 'src/data/pecas.json';
  it.skipIf(!existsSync(arq))('estoque real: todo bloco tem âncora própria e nenhuma peça fica fora dos grupos', () => {
    const pecas: { id: string; c: string; b: string; m: string }[] = JSON.parse(readFileSync(arq, 'utf-8'));
    const blocos = [...new Set(pecas.map((x) => x.c))];
    expect(new Set(blocos.map(chaveGrupo)).size).toBe(blocos.length);
    const xc = pecas.filter((x) => x.b === 'Volvo' && x.m === 'XC60');
    expect(agrupar(xc).reduce((s, g) => s + g.itens.length, 0)).toBe(xc.length);
  });
});
