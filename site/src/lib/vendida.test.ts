// Peça vendida (a 404 de /peca/<slug>-<MLB>.html): o nome, o carro e os anos lidos do endereço, a mensagem do
// "Me avise se chegar outra" e as parecidas (o "Ver parecidas" nunca leva a uma lista vazia).
// Os slugs reais são das peças que venderam entre 08 e 10/11/2026 (cliente oculto, atrito 3).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RE_VENDIDA, montarDicionario, lerEndereco, lerSlug, anosDoSlug, nomeDoSlug, mensagemVendida, filtrosIniciais,
  linkFiltros, parecidas, categoriaDoNome, type Dicionario,
  mlbDoEndereco, shardDe, shardDoEstoque, decidirEndereco, SHARDS,
} from './vendida';
import { ABERTURA } from './whats';
import { Busca } from './busca';
import { norm, modelosDa } from './meuCarro';

// um estoque pequeno e fixo (o teste não depende do que vendeu hoje)
const estoque = [
  { b: 'Mercedes-Benz', m: 'C180', n: 'Porta-luvas' },
  { b: 'Honda', m: 'WR-V', n: 'Estepe fino' },
  { b: 'Citroën', m: 'C4', n: 'TBI corpo borboleta' },
  { b: 'Ford', m: 'Fiesta', n: 'Motor vidro dianteiro direito' },
  { b: 'Ford', m: 'Ka', n: 'Fechadura elétrica dianteira esquerda' },
  { b: 'BMW', m: 'Série 5', n: 'Módulo airbag' },
  { b: 'Peugeot', m: '3008', ms: ['3008'], n: 'Lanterna tampa traseira direita' },
  { b: 'Peugeot', m: '208', ms: ['208', '2008'], n: 'Moldura coluna direção' },
  { b: 'Peugeot', m: '307', n: 'Motor atuador ar condicionado' },
  { b: 'Land Rover', m: 'Discovery', n: 'Diferencial traseiro' },
  { b: 'Renault', m: 'Clio', n: 'Painel instrumentos' },
  { b: 'Volvo', m: 'XC60', n: 'Chave limpador para-brisa' },
  { b: 'Volvo', m: 'XC60', n: 'Retrovisor elétrico direito' },
  { b: 'Volkswagen', m: 'Golf', n: 'Módulo relé ventoinha' },
  { b: 'Hyundai', m: 'Genesis', n: 'Bomba combustível' },
];
const dic: Dicionario = montarDicionario(estoque);
const ler = (slug: string) => {
  const m = RE_VENDIDA.exec(`/peca/${slug}.html`);
  if (!m) throw new Error(`não leu ${slug}`);
  return lerSlug(m[1], m[2], dic);
};

describe('endereço da peça vendida', () => {
  it('só /peca/<slug>-MLB<n>.html com letras minúsculas, números e hífen', () => {
    expect(RE_VENDIDA.exec('/peca/airbag-motorista-mercedes-benz-c320-01-07-2034601898-MLB4811340217.html')?.[2]).toBe('MLB4811340217');
    expect(RE_VENDIDA.test('/peca/airbag-motorista-MLB4811340217')).toBe(true);
    for (const u of ['/catalogo.html', '/peca/x.html', '/peca/ABC-MLB4811340217.html', '/peca/a%20b-MLB4811340217.html',
      '/peca/airbag-MLB12.html', '/carros/airbag-MLB4811340217.html', '/peca/airbag-mlb4811340217.html']) {
      expect(lerEndereco(u, dic), u).toBeNull();
    }
  });
  it('texto que não é carro nenhum não aparece (ninguém monta link com frase inventada no site)', () => {
    const v = lerEndereco('/peca/pague-o-pix-para-este-numero-MLB12345678.html', dic)!;
    expect(v).toMatchObject({ nome: '', carro: '', marca: null, modelo: null, mlb: 'MLB12345678' });
    expect(mensagemVendida(v)).toBe(`${ABERTURA} Vi que a peça MLB12345678 já vendeu. Me avisa se chegar outra?`);
  });
});

describe('nome, carro e anos do slug', () => {
  it('marca de duas palavras e modelo sem peça no site: a palavra do título', () => {
    expect(ler('airbag-motorista-mercedes-benz-c320-01-07-2034601898-MLB4811340217')).toMatchObject({
      nome: 'Airbag motorista', marca: 'Mercedes-Benz', modelo: null, carro: 'Mercedes-Benz C320', anos: [2001, 2007],
    });
  });
  it('modelo com hífen (WR-V), anos 26-27 e a medida 5x114,3 fora do nome', () => {
    expect(ler('roda-aro-17-diamantada-5x114-3-honda-wr-v-26-27-17075a-preto-MLB5336870309')).toMatchObject({
      nome: 'Roda aro 17 diamantada', marca: 'Honda', modelo: 'WR-V', anos: [2026, 2027],
    });
  });
  it('sigla, acento e o motor "2-0" que não é ano', () => {
    expect(ler('tbi-corpo-borboleta-citroen-c4-2-0-07-13-965078738002-MLB7328296554')).toMatchObject({
      nome: 'TBI corpo borboleta', marca: 'Citroën', modelo: 'C4', carro: 'Citroën C4', anos: [2007, 2013],
    });
    expect(ler('bomba-combustivel-hyundai-genesis-3-8-v6-09-14-311103m100-MLB6820219386')).toMatchObject({
      nome: 'Bomba combustível', anos: [2009, 2014],
    });
  });
  it('abreviação por extenso, concordando com a peça', () => {
    expect(ler('motor-vidro-diant-esq-ford-fiesta-07-13-0130821968-MLB5237941567').nome).toBe('Motor vidro dianteiro esquerdo');
    expect(nomeDoSlug(['fechadura', 'eletrica', 'diant', 'esq'], dic.w)).toBe('Fechadura elétrica dianteira esquerda');
    expect(nomeDoSlug(['lanterna', 'tras', 'dir'], dic.w)).toBe('Lanterna traseira direita');
    expect(nomeDoSlug(['chave', 'limpador', 'parabrisa'], dic.w)).toBe('Chave limpador para-brisa');
  });
  it('BMW "S5" é a Série 5; o ano de 4 algarismos com o fim em 2 ("2004-10")', () => {
    expect(ler('modulo-central-airbag-bmw-s5-530i-e60-2004-10-original-MLB4536269285')).toMatchObject({
      nome: 'Módulo central airbag', marca: 'BMW', modelo: 'Série 5', anos: [2004, 2010],
    });
  });
  it('modelo que é número (Peugeot 3008, 2008) nunca vira ano', () => {
    expect(ler('lanterna-traseira-direita-peugeot-3008-11-14-i090098-MLB7722912002')).toMatchObject({ modelo: '3008', anos: [2011, 2014] });
    expect(ler('moldura-coluna-direcao-peugeot-208-2008-13-19-9678635077-preto-MLB6654717788')).toMatchObject({ modelo: '208', anos: [2013, 2019] });
  });
  it('sem a marca no título: o carro pelo modelo ("golf" -> Volkswagen)', () => {
    expect(ler('modulo-rele-ventoinha-golf-sapao-mk4-4-5-1j0919506k-preto-MLB6420771518')).toMatchObject({
      nome: 'Módulo relé ventoinha', marca: 'Volkswagen', modelo: 'Golf',
    });
  });
  it('apelido da marca (gm, vw) e marca sem peça no site (só o nome, nunca o filtro)', () => {
    const d2 = montarDicionario([{ b: 'Chevrolet', m: 'Zafira', n: 'Motor atuador' }]);
    expect(lerSlug('motor-atuador-arcondicionado-gm-zafira-00-11-309368000', 'MLB1', d2)).toMatchObject({
      marca: 'Chevrolet', modelo: 'Zafira', anos: [2000, 2011], nome: 'Motor atuador ar condicionado',
    });
    expect(lerSlug('farol-toyota-corolla-09-14-8117002', 'MLB1', d2)).toMatchObject({ marca: null, carro: 'Toyota Corolla', anos: [2009, 2014] });
  });
  it('slug cortado em 80 letras: lê o que sobrou', () => {
    expect(ler('retrovisor-eletrico-esquerdo-volvo-xc60-t8-18-24-a044297-ori-MLB6769276338')).toMatchObject({
      nome: 'Retrovisor elétrico esquerdo', modelo: 'XC60', anos: [2018, 2024],
    });
  });
  it('anos: só 2 ou 4 algarismos ("1-6", "3-8" e "5x114-3" ficam fora)', () => {
    expect(anosDoSlug('1-6-16v-8200981133-11-19'.split('-'))).toEqual([2011, 2019]);
    expect(anosDoSlug('2015-a-2020'.split('-'))).toEqual([2015, 2020]);
    expect(anosDoSlug('1998-02'.split('-'))).toEqual([1998, 2002]);
    expect(anosDoSlug('megane-1-6-2013-8200455424j'.split('-'))).toEqual([2013, 2013]);
    expect(anosDoSlug('5x114-3-preto'.split('-'))).toBeNull();
  });
});

describe('mensagem e link', () => {
  it('"Me avise se chegar outra": a abertura do site, a peça, o carro e o MLB', () => {
    const v = ler('airbag-motorista-mercedes-benz-c320-01-07-2034601898-MLB4811340217');
    expect(mensagemVendida(v)).toBe(`${ABERTURA} Procuro airbag motorista para Mercedes-Benz C320 2001 a 2007. `
      + 'Vi que a peça MLB4811340217 já vendeu. Me avisa se chegar outra?');
    // sigla fica em maiúscula dentro da frase
    expect(mensagemVendida(ler('tbi-corpo-borboleta-citroen-c4-2-0-07-13-965078738002-MLB7328296554'))).toContain('Procuro TBI corpo borboleta para Citroën C4 2007 a 2013.');
  });
  it('o link do catálogo só leva marca e modelo que têm peça no site', () => {
    const v = ler('airbag-motorista-mercedes-benz-c320-01-07-2034601898-MLB4811340217');
    expect(linkFiltros(filtrosIniciais(v))).toBe('/catalogo.html?q=Airbag+motorista&marca=Mercedes-Benz');
    expect(linkFiltros({})).toBe('/catalogo.html');
  });
});

// ---- com o estoque de verdade (o que estiver no ar no momento do teste)
const pecas: { id: string; slug: string; n: string; b: string; m: string; ms?: string[]; y: [number, number] | null; c: string }[] =
  JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'pecas.json'), 'utf-8'));
const ix = JSON.parse(readFileSync(join(process.cwd(), 'public', 'dados', 'busca.json'), 'utf-8'));
const busca = new Busca(ix);

describe('com o estoque do momento', () => {
  const dicReal = montarDicionario(pecas);
  it('lê marca, modelo, anos e nome de quase todo slug do estoque', () => {
    let marca = 0, modelo = 0, anos = 0, nome = 0;
    for (const p of pecas) {
      const v = lerEndereco(`/peca/${p.slug}.html`, dicReal)!;
      if ((v.marca ?? '') === (p.b ?? '')) marca++;
      if ((!p.m && !v.modelo) || modelosDa(p).some((x) => norm(x) === norm(v.modelo))) modelo++;
      if (String(v.anos) === String(p.y)) anos++;
      if (p.n.toLowerCase().startsWith(v.nome.toLowerCase()) || v.nome.toLowerCase().startsWith(p.n.toLowerCase())) nome++;
    }
    const n = pecas.length;
    // hoje: 99,98% / 99,5% / 92% / 97,7%; a folga é para o estoque que muda (o robô roda estes testes antes de publicar)
    expect(marca / n).toBeGreaterThan(0.98);
    expect(modelo / n).toBeGreaterThan(0.97);
    expect(anos / n).toBeGreaterThan(0.8);
    expect(nome / n).toBeGreaterThan(0.9);
  });
  it('o dicionário vai dentro da 404: pequeno', () => {
    expect(JSON.stringify(dicReal).length).toBeLessThan(16_000);
  });
  it('"Ver parecidas" nunca leva a uma lista vazia; até 6 cartões, nunca a própria peça (índice em cache)', () => {
    const amostra = pecas.filter((_, i) => i % 97 === 0);
    for (const p of amostra) {
      const v = lerEndereco(`/peca/${p.slug}.html`, montarDicionario(pecas.filter((x) => x.id !== p.id)))!;
      const r = parecidas(busca, v);
      if (Object.keys(r.filtros).length) expect(busca.procurar(r.filtros).length, p.slug).toBeGreaterThan(0);
      expect(r.itens.length).toBeLessThanOrEqual(6);
      expect(r.itens.some((it) => it.id === p.id)).toBe(false);
    }
  });
  it('"Ver parecidas"/"Ver todas" levam à MESMA lista dos cartões: todo cartão está nela e ela nunca é menor (revisão 10, P3)', () => {
    const amostra = pecas.filter((_, i) => i % 41 === 0);
    let cheias = 0;
    for (const p of amostra) {
      const v = lerEndereco(`/peca/${p.slug}.html`, montarDicionario(pecas.filter((x) => x.id !== p.id)))!;
      const r = parecidas(busca, v);
      if (!r.itens.length) continue;
      const lista = busca.procurar(r.filtros);
      expect(busca.aproximado, p.slug).toBe(false);
      const ids = new Set(lista.filter((it) => it.id !== p.id).map((it) => it.id));
      expect(r.itens.filter((it) => !ids.has(it.id)).map((it) => it.id), p.slug).toEqual([]);
      expect(ids.size, p.slug).toBeGreaterThanOrEqual(r.itens.length);
      if (r.itens.length === 6) cheias++;
    }
    expect(cheias / amostra.length).toBeGreaterThan(0.9);
  });
  it('o 1º degrau abre a fila: "airbag motorista" do C320 vendido mostra antes os airbags do C320', () => {
    const c320 = pecas.filter((x) => x.b === 'Mercedes-Benz' && x.m === 'C320');
    if (!c320.length) return;
    const v = lerEndereco('/peca/airbag-motorista-mercedes-benz-c320-2001-2007-MLB4811340217.html', montarDicionario(pecas))!;
    const r = parecidas(busca, v);
    const lista = busca.procurar(r.filtros);
    expect(lista.length).toBeGreaterThanOrEqual(r.itens.length);
    expect(r.itens.every((it) => lista.some((x) => x.id === it.id))).toBe(true);
  });
  it('a categoria pelo nome acerta a maioria', () => {
    const amostra = pecas.filter((p, i) => i % 23 === 0 && p.c && p.c !== 'Outros');
    const certas = amostra.filter((p) => categoriaDoNome(pecas.filter((x) => x.id !== p.id), p.n) === p.c).length;
    expect(certas / amostra.length).toBeGreaterThan(0.7);   // hoje ~88%
  });
});

// ---- endereço antigo de peça que segue à venda (friction 4): o MLB do endereço, o arquivo do estoque e a decisão
describe('endereço antigo: o MLB, o arquivo do estoque e o que a 404 faz', () => {
  it('mlbDoEndereco: acha o MLB com qualquer slug, sem diferenciar maiúsculas, com ou sem .html', () => {
    expect(mlbDoEndereco('/peca/para-choque-MLB7684800042.html')).toBe('MLB7684800042');
    expect(mlbDoEndereco('/peca/Para-choque-Dianteiro-E-Pace-mlb7684800042')).toBe('MLB7684800042');
    expect(mlbDoEndereco('/peca/MLB7684800042.html')).toBe('MLB7684800042');
    expect(mlbDoEndereco('/peca/a%20b-MLB7684800042.html')).toBe('MLB7684800042');
    expect(mlbDoEndereco('/peca/modulo-abs-xc60-MLB4524344387.html')).toBe('MLB4524344387');
  });
  it('mlbDoEndereco: nada que não é endereço de peça com MLB de 6 a 14 números', () => {
    for (const u of ['/catalogo.html', '/peca/x.html', '/peca/airbag-MLB12.html', '/carros/airbag-MLB4811340217.html',
      '/peca/airbag-MLB4811340217/extra.html', '/peca/airbag-MLBX123456.html', '/', '/peca/']) {
      expect(mlbDoEndereco(u), u).toBeNull();
    }
  });
  it('shardDe: o mesmo MLB cai no mesmo arquivo, em maiúsculas ou minúsculas, dentro de 0..SHARDS-1', () => {
    expect(shardDe('MLB4518662815')).toBe(shardDe('mlb4518662815'));
    for (const m of ['MLB4518662815', 'MLB7684800042', 'MLB123456', 'MLB99999999999999']) {
      expect(shardDe(m)).toBeGreaterThanOrEqual(0);
      expect(shardDe(m)).toBeLessThan(SHARDS);
    }
  });
  it('shardDoEstoque: cada peça ativa sai em UM só arquivo (o do seu resto) e com o endereço de hoje', () => {
    const pares: [string, string][] = [['MLB4518662815', 'sensor-x-MLB4518662815'], ['MLB7684800042', 'para-choque-MLB7684800042'],
      ['MLB123456', 'bobina-MLB123456']];
    const arquivos = Array.from({ length: SHARDS }, (_, k) => shardDoEstoque(pares, k));
    for (const [id, h] of pares) {
      const achou = arquivos.filter((a) => a[id] !== undefined);
      expect(achou).toHaveLength(1);
      expect(achou[0][id]).toBe(h);
      expect(arquivos[shardDe(id)][id]).toBe(h);
    }
    expect(Object.keys(arquivos.reduce((a, b) => ({ ...a, ...b }), {})).sort()).toEqual(pares.map(([id]) => id).sort());
  });
  it('decidirEndereco: peça à venda com outro endereço vai para o de hoje, com a busca e a âncora', () => {
    expect(decidirEndereco('/peca/para-choque-MLB7684800042.html', '?x=1', '#fotos', 'para-choque-dianteiro-e-pace-MLB7684800042'))
      .toEqual({ acao: 'ir', destino: '/peca/para-choque-dianteiro-e-pace-MLB7684800042.html?x=1#fotos' });
    expect(decidirEndereco('/peca/Para-choque-MLB7684800042.html', '', '', 'para-choque-MLB7684800042'))
      .toEqual({ acao: 'ir', destino: '/peca/para-choque-MLB7684800042.html' });
  });
  it('decidirEndereco: mesmo endereço de hoje não redireciona (nada de laço)', () => {
    expect(decidirEndereco('/peca/para-choque-MLB7684800042.html', '', '', 'para-choque-MLB7684800042'))
      .toEqual({ acao: 'geral' });
  });
  it('decidirEndereco: MLB que sumiu do estoque com endereço de peça = vendida; sem o formato certo = 404 comum', () => {
    expect(decidirEndereco('/peca/airbag-motorista-mercedes-benz-c320-01-07-2034601898-MLB4811340217.html', '', '', null))
      .toEqual({ acao: 'vendida' });
    // maiúsculas no slug: a peça não é mostrada como vendida (só a 404 comum), mas se a peça segue à venda vai para o certo
    expect(decidirEndereco('/peca/Airbag-MLB4811340217.html', '', '', null)).toEqual({ acao: 'geral' });
    expect(decidirEndereco('/peca/Airbag-MLB4811340217.html', '', '', 'airbag-MLB4811340217')).toEqual({ acao: 'ir', destino: '/peca/airbag-MLB4811340217.html' });
    expect(decidirEndereco('/catalogo.html', '', '', null)).toEqual({ acao: 'geral' });
    expect(decidirEndereco('/peca/x-MLB12.html', '', '', null)).toEqual({ acao: 'geral' });
  });
});

// Revisão 14, item 25 e P3: "mlb" minúsculo e a barra no fim valem como os outros endereços.
import { caminhoLimpo, conferirAntes as conferir, RE_MLB_PECA } from './vendida';
describe('caminhoLimpo: o endereço como a 404 o confere', () => {
  it('barra no fim, MLB minúsculo e texto em maiúsculas viram o endereço normal', () => {
    expect(caminhoLimpo('/peca/farol-direito-gm-cruze-MLB4687584199.html/')).toBe('/peca/farol-direito-gm-cruze-MLB4687584199.html');
    expect(caminhoLimpo('/peca/farol-direito-gm-cruze-mlb4687584199.html')).toBe('/peca/farol-direito-gm-cruze-MLB4687584199.html');
    expect(caminhoLimpo('/PECA/Farol-Direito-MLB4687584199.HTML')).toBe('/peca/farol-direito-MLB4687584199.html');
    expect(caminhoLimpo('/peca/farol-MLB4687584199')).toBe('/peca/farol-MLB4687584199');
  });
  it('a vendida com "mlb" minúsculo ou com a barra passa a ser lida como vendida', () => {
    for (const p of ['/peca/bomba-alta-volvo-xc60-mlb4687584199.html', '/peca/bomba-alta-volvo-xc60-MLB4687584199.html/']) {
      expect(decidirEndereco(caminhoLimpo(p), '', '', null)).toEqual({ acao: 'vendida' });
    }
  });
  it('o que não é peça só perde a barra', () => {
    expect(caminhoLimpo('/qualquer/coisa/')).toBe('/qualquer/coisa');
    expect(caminhoLimpo('/')).toBe('/');
  });
});

describe('conferirAntes: o script do <head> da 404 (copiado por toString)', () => {
  type Doc = { classes: Set<string> };
  function rodar(caminho: string, estoque: Record<string, string> | 'falha', gemeas: Record<string, string> = {}) {
    const doc: Doc = { classes: new Set() };
    const fila: [number, () => void][] = [];
    const amb = {
      document: { documentElement: { classList: { add: (...c: string[]) => c.forEach((x) => doc.classes.add(x)), remove: (...c: string[]) => c.forEach((x) => doc.classes.delete(x)) } } },
      location: { pathname: caminho, search: '?utm=1', hash: '#foto', replace: (u: string) => { foi = u; } },
      window: {} as { __nf?: { id: string; alvo: string; tarde: () => boolean; estoque: Promise<string | null | undefined> } },
      setTimeout: (f: () => void, ms: number) => { fila.push([ms, f]); return fila.length; },
      clearTimeout: (n: number) => { if (n) fila[n - 1] = [0, () => {}]; },
      fetch: (u: string) => { pedido = u; return estoque === 'falha' ? Promise.reject(new Error('rede')) : Promise.resolve({ ok: true, json: () => Promise.resolve(estoque) }); },
    };
    let foi = '';
    let pedido = '';
    const f = new Function(...Object.keys(amb), `return (${conferir.toString()})(${JSON.stringify(RE_MLB_PECA.source)}, 64, ${JSON.stringify(gemeas)}, 400, 2500)`);
    f(...Object.values(amb));
    return { doc, amb, passar: (ms: number) => fila.filter(([t]) => t === ms).forEach(([, g]) => g()), foi: () => foi, pedido: () => pedido };
  }
  it('endereço que não é de peça: não esconde nada nem pede nada', () => {
    const r = rodar('/pagina-que-nao-existe.html', {});
    expect([...r.doc.classes]).toEqual([]);
    expect(r.amb.window.__nf).toBeUndefined();
    expect(r.pedido()).toBe('');
  });
  it('peça à venda com outro endereço: pede o arquivo do MLB no <head> e vai para o endereço de hoje (com a busca e a âncora)', async () => {
    const r = rodar('/peca/slug-velho-mlb7406476550.html/', { MLB7406476550: 'slug-de-hoje-MLB7406476550' });
    expect(r.doc.classes.has('nf-conferindo')).toBe(true);
    expect(r.pedido()).toBe(`/dados/peca/${7406476550 % 64}.json`);
    await new Promise((ok) => setTimeout(ok, 0));
    expect(r.foi()).toBe('/peca/slug-de-hoje-MLB7406476550.html?utm=1#foto');
  });
  it('400 ms sem resposta: "Abrindo a peça…"; 2,5 s: a página aparece conferindo e nada mais navega sozinho', async () => {
    const r = rodar('/peca/slug-velho-MLB7406476550.html', { MLB7406476550: 'slug-de-hoje-MLB7406476550' });
    r.passar(400);
    expect(r.doc.classes.has('nf-abrindo')).toBe(true);
    r.passar(2500);
    expect([...r.doc.classes]).toEqual(['nf-lenta']);
    expect(r.amb.window.__nf!.tarde()).toBe(true);
    // a resposta chega depois do teto: o endereço de hoje vai para o script da página (botão "Abrir a peça"), sem navegar
    expect(await r.amb.window.__nf!.estoque).toBe('slug-de-hoje-MLB7406476550');
    expect(r.foi()).toBe('');
  });
  it('fim(): quando a página mostra o resultado, os relógios param (a "vendida" não volta para "Conferindo…" aos 2,5 s)', async () => {
    const r = rodar('/peca/x-MLB7406476550.html', {});
    expect(await r.amb.window.__nf!.estoque).toBeNull();
    (r.amb.window.__nf as unknown as { fim: () => void }).fim();
    r.doc.classes.clear();
    r.passar(400); r.passar(2500);
    expect([...r.doc.classes]).toEqual([]);
    expect(r.amb.window.__nf!.tarde()).toBe(false);
  });
  it('fora do estoque: null (a página decide "vendida"); a conferência falhou: undefined (a 404 de sempre)', async () => {
    expect(await rodar('/peca/x-MLB7406476550.html', {}).amb.window.__nf!.estoque).toBeNull();
    expect(await rodar('/peca/x-MLB7406476550.html', 'falha').amb.window.__nf!.estoque).toBeUndefined();
  });
  it('anúncio tirado do site com um igual à venda: confere e abre o igual', async () => {
    const r = rodar('/peca/slug-MLB6818584120.html', { MLB6540744984: 'slug-da-gemea-MLB6540744984' }, { MLB6818584120: 'MLB6540744984' });
    expect(r.pedido()).toBe(`/dados/peca/${6540744984 % 64}.json`);
    await new Promise((ok) => setTimeout(ok, 0));
    expect(r.foi()).toBe('/peca/slug-da-gemea-MLB6540744984.html?utm=1#foto');
  });
});
