import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Peca } from './dados';
import { limparTexto, descricaoFeed, tituloFeed, itemFeed, xmlItem, escXml } from './feed';

const SITE = 'https://izzatcarimports.com.br';
const base = (o: Partial<Peca>): Peca => ({
  id: 'MLB7124139250', slug: 'biela-x-MLB7124139250', t: 'Biela Motor Gm Captiva 3.6 V6 08/17 12608432', n: 'Biela motor',
  p: 584.64, fotos: ['903529-MLB1', '694091-MLB2', '1-MLB3', '2-MLB4', '3-MLB5', '4-MLB6', '5-MLB7'], ml: '', f: true,
  b: 'Chevrolet', m: 'Captiva', y: [2008, 2017], c: 'Motor', s: 'Bielas', oem: '12608432', o: '', ficha: [], desc: '', rel: [], ...o,
});

describe('feed: limpeza de texto', () => {
  it('tira tags, decodifica entidades e controles', () => {
    expect(limparTexto('<p>Biela &amp; bucha&nbsp;OK</p>\u0001<h3>Título</h3>')).toBe('Biela & bucha OK. Título.');
    expect(limparTexto('a &#233; b &#xE7;')).toBe('a é b ç');
  });
  it('remove frases de contato, parcelamento e retirada no local', () => {
    const d = descricaoFeed(base({ desc: '<p>Biela original do motor 3.6 V6 em ótimo estado para o seu carro.</p><p>Aceitamos 12x sem juros no cartão.</p><p>Retirada no local com horário marcado.</p><p>Chame no whats 53 99117-0950.</p>' }));
    expect(d).toMatch(/Biela original/);
    expect(d).not.toMatch(/12x|retirada no local|whats|53 99117/i);
  });
  it('dimensoes e codigos nao sao cortados como telefone', () => {
    const d = descricaoFeed(base({ desc: '<p>Dimensões aproximadas: 18x12x7cm. Código 12608432 e referência 3B0959833A para o motor do carro.</p>' }));
    expect(d).toMatch(/18x12x7cm/);
    expect(d).toMatch(/12608432/);
  });
  it('sem descricao do vendedor: texto padrao com o codigo', () => {
    const d = descricaoFeed(base({ desc: '' }));
    expect(d).toMatch(/Código original: 12608432/);
    expect(d).toMatch(/Nota fiscal e 90 dias/);
  });
  it('titulo corta em 150 caracteres sem quebrar palavra', () => {
    const t = tituloFeed(base({ n: 'palavra '.repeat(40).trim() }));
    expect(t.length).toBeLessThanOrEqual(150);
    expect(t.endsWith('palavra')).toBe(true);
  });
  it('titulo = nome limpo + carro + anos + codigo, nunca o titulo cru do ML (auditoria 3, 9.2)', () => {
    expect(tituloFeed(base({}))).toBe('Biela motor Chevrolet Captiva 2008–2017 12608432');
    const t = tituloFeed(base({ t: 'Sensor Posicao Nivel Altura Dian Dir Volvo Xc 60 Gm', n: 'Sensor nível altura dianteiro direito',
      b: 'Volvo', m: 'XC60', ms: ['XC60', 'S60'], y: [2018, 2024], oem: '' }));
    expect(t).toBe('Sensor nível altura dianteiro direito Volvo XC60 e S60 2018–2024');
    expect(t).not.toMatch(/Xc 60|Gm|Posicao/);
  });
  it('descricao padrao (sem texto do vendedor) tambem pelo nome limpo', () => {
    expect(descricaoFeed(base({ desc: '' }))).toMatch(/^Biela motor Chevrolet Captiva 2008–2017 12608432\. /);
  });
  it('escapa XML', () => {
    expect(escXml('a & <b> "c" \'d\'')).toBe('a &amp; &lt;b&gt; &quot;c&quot; &apos;d&apos;');
  });
});

describe('feed: item', () => {
  it('capa de estudio como imagem principal, fotos do ML como extras (ate 5)', () => {
    const i = itemFeed(base({}), '/estudio/MLB7124139250.webp', SITE)!;
    expect(i.imagem).toBe(`${SITE}/estudio/MLB7124139250.webp`);
    expect(i.extras.length).toBe(5);
    expect(i.extras[0]).toMatch(/^https:\/\/http2\.mlstatic\.com\/D_903529-MLB1-F\.webp$/);
  });
  it('sem capa: a primeira foto do ML vira a imagem e nao se repete', () => {
    const i = itemFeed(base({}), null, SITE)!;
    expect(i.imagem).toMatch(/D_903529-MLB1-F/);
    expect(i.extras.some((u) => u === i.imagem)).toBe(false);
  });
  it('MPN do primeiro codigo OEM; sem codigo: identifier_exists no', () => {
    const com = xmlItem(itemFeed(base({ oem: '12608432 / 999' }), '/estudio/x.webp', SITE)!);
    expect(com).toContain('<g:mpn>12608432</g:mpn>');
    const sem = xmlItem(itemFeed(base({ oem: '' }), '/estudio/x.webp', SITE)!);
    expect(sem).toContain('<g:identifier_exists>no</g:identifier_exists>');
    expect(sem).not.toContain('<g:mpn>');
  });
  it('preco, condicao, disponibilidade e categoria fixos', () => {
    const x = xmlItem(itemFeed(base({}), '/estudio/x.webp', SITE)!);
    expect(x).toContain('<g:price>584.64 BRL</g:price>');
    expect(x).toContain('<g:condition>used</g:condition>');
    expect(x).toContain('<g:availability>in_stock</g:availability>');
    expect(x).toContain('<g:google_product_category>5613</g:google_product_category>');
    expect(x).toContain('<g:product_type>Motor &gt; Bielas</g:product_type>');
    expect(x).toContain('<g:brand>Chevrolet</g:brand>');
  });
  it('sem marca: nao emite g:brand', () => {
    const x = xmlItem(itemFeed(base({ b: '' }), '/estudio/x.webp', SITE)!);
    expect(x).not.toContain('<g:brand>');
  });
  it('sem preco ou sem imagem: fica de fora', () => {
    expect(itemFeed(base({ p: 0 }), '/estudio/x.webp', SITE)).toBeNull();
    expect(itemFeed(base({ fotos: [] }), null, SITE)).toBeNull();
  });
});

describe('feed: estoque real', () => {
  const pecas: Peca[] = JSON.parse(readFileSync('src/data/pecas.json', 'utf-8'));
  const itens = pecas.map((p) => itemFeed(p, p.estudio ? `/estudio/${p.id}.webp` : null, SITE)).filter((i): i is NonNullable<typeof i> => !!i);
  it('quase todas as pecas entram no feed', () => {
    expect(itens.length).toBeGreaterThan(pecas.length * 0.99);
  });
  it('limites do Google: titulo 150, descricao 5000, ate 10 imagens extras', () => {
    for (const i of itens) {
      expect(i.title.length).toBeLessThanOrEqual(150);
      expect(i.description.length).toBeLessThanOrEqual(5000);
      expect(i.extras.length).toBeLessThanOrEqual(5);
      expect(i.link).toMatch(/^https:\/\/izzatcarimports\.com\.br\/peca\/.+\.html$/);
    }
  });
  it('nenhum caractere de controle nem tag nos textos', () => {
    const xml = itens.map((i) => xmlItem(i)).join('');
    expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml)).toBe(false);
    expect(/<(p|h3|br)[ >/]/.test(xml.replace(/<\/?g:[^>]*>|<\/?(item|title|description|link)>/g, ''))).toBe(false);
  });
});
