// Meu carro: seletor marca -> modelo -> ano. Uma única implementação, usada na abertura (aba "Pelo carro")
// e na caixa que abre pelo cabeçalho. Vanilla TS (sem React) para não pesar nas páginas.
//
// Desenho: três campos no topo (Marca | Modelo | Ano, como nas lojas de autopeças) e, embaixo, a escolha do
// campo aberto: discos com o logo da marca, depois os modelos. O Ano é um <select> de verdade dentro do campo
// (lista longa: até 38 anos).
// Com o carro escolhido, os campos saem e fica o "cartão do seu carro": a arte do carro (a mesma do /carros; sem arte,
// o logo grande), o nome, a contagem real, os anos com peça em linha (Todos · 2012 · 2013…, rolável) e "Ver as N peças".
// Trocar o ano só repinta a contagem e o botão (a arte não pisca). O ano é o que decide o encaixe ("serve" só com ano:
// lib/meuCarro.ts). Os dois estados têm a MESMA altura (MeuCarroEstilo.astro: --alt-campos + --alt-corpo): nada pula.
//
// Dados: /dados/meu-carro.json (lib/garagem.ts, no build). A abertura já vem com a grade de marcas no HTML,
// gerada por htmlInicial() com os MESMOS dados; o script só redesenha quando o estado muda.
// Estilos: ui/MeuCarroEstilo.astro (globais, sempre dentro de .mc-raiz). Salva só no navegador (lib/meuCarro.ts).
// Caixa aberta pela faixa da página da peça (raiz com data-origem="peca"): o resultado ganha "Conferir nesta peça"
// e, ao escolher o ano, a raiz avisa (evento ESCOLHIDO) para a caixa fechar e mostrar a resposta na faixa.
import { lerMeuCarro, salvarMeuCarro, lembrarArte, carregarGaragem as baixarGaragem, linkCatalogo, EVENTO, ESCOLHIDO, type MeuCarro } from '../../lib/meuCarro';
import { whatsUrl } from '../../lib/whats';
import { LINHA } from '../../lib/icones';

/** a/as: arte do carro e as larguras do srcset (lib/garagem.ts). */
export type Modelo = { n: string; c: number; ya: [number, number][]; a?: string; as?: number[] };
export type Marca = { n: string; k: string; logo: string | null; lw: number; lh: number; c: number; modelos: Modelo[] };
export type Garagem = { v: number; total: number; marcas: Marca[] };
export type Handle = { recarregar: () => void };
export { linkCatalogo };

type Etapa = 'marca' | 'modelo' | 'pronto';
type Estado = {
  etapa: Etapa; marca: Marca | null; modelo: Modelo | null; ano: number | null; todas: boolean; todosModelos: boolean;
  /** ano salvo que não tem peça agora (o carro salvo continua com ele; aqui mostra todos os anos e avisa) */
  anoSemPeca: number | null;
  /** carro salvo cuja marca ou modelo não tem peça no site agora (volta para as marcas e avisa) */
  carroSemPeca: string | null;
  /** caixa aberta pela faixa da página da peça */
  naPeca: boolean;
};

/** Marcas de cara (onde a grade tem 4 colunas, o CSS mostra só as 8 primeiras); o resto fica em "Ver todas". */
export const MARCAS_DE_CARA = 12;
const MODELOS_DE_CARA = 8;

export function carregarGaragem(): Promise<Garagem> {
  // ~6 KB comprimido: pedido logo na montagem, para o primeiro toque numa marca já ter os modelos
  return baixarGaragem<Garagem>();
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const fmt = (n: number) => n.toLocaleString('pt-BR');
const pecasTxt = (n: number) => `${fmt(n)} ${n === 1 ? 'peça' : 'peças'}`;

/** Quantas peças o modelo tem no ano (null = qualquer ano). Mesma regra do catálogo ao filtrar por ano. */
export function contagem(mo: Modelo, ano: number | null): number {
  if (ano == null) return mo.c;
  return mo.ya.find(([y]) => y === ano)?.[1] ?? 0;
}

/** Acha marca/modelo do carro salvo dentro dos dados. */
export function achar(g: Garagem, c: MeuCarro | null) {
  if (!c) return null;
  const marca = g.marcas.find((m) => m.n === c.b);
  const modelo = marca?.modelos.find((x) => x.n === c.m);
  return marca && modelo ? { marca, modelo, ano: c.y ?? null } : null;
}

const SETA = '<svg class="mc-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const CHECK = `<svg class="mc-check" viewBox="0 0 24 24" aria-hidden="true">${LINHA.check}</svg>`;
const AVISO = '<svg class="mc-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v6M12 17h.01"/></svg>';
const SETA_LADO = (d: 1 | -1) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d > 0 ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'}"/></svg>`;
/** Nome do carro maior que isto (marca + espaço + modelo) usa a letra menor no cartão (o esqueleto da abertura,
 *  SeletorCarro.astro, usa o mesmo número). */
export const NOME_LONGO = 16;
/** No celular a marca vai numa linha pequena e o modelo em outra, grande: modelo com mais letras que isto ("Discovery",
 *  "Palio Weekend") usa a letra menor (o esqueleto da abertura usa o mesmo número). */
export const MODELO_LONGO = 8;
/** Largura da arte no cartão do carro (MeuCarroEstilo.astro): no celular (seletor até 469 px, tela até ~539) a arte ocupa
 *  até 80% da altura do cartão (~176 px de largura); no resto, ~232 px. O esqueleto da abertura usa o MESMO valor (o
 *  navegador escolhe o mesmo arquivo do srcset e a arte não desce duas vezes). */
export const SIZES_ARTE = '(max-width: 539px) 176px, 232px';
/** src e srcset da arte do carro (a = chave, as = larguras do srcset; a última é a arte inteira). A MESMA conta está no
 *  script do esqueleto (SeletorCarro.astro). */
export function fonteArte(a: string, as: number[] = []): { src: string; srcset: string } {
  const src = `/arte/v2/carro-${a}.webp`;
  const srcset = as.map((w, i) => `${i === as.length - 1 ? src : src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`).join(', ');
  return { src, srcset };
}
const inicial = (): Estado => ({
  etapa: 'marca', marca: null, modelo: null, ano: null, todas: false, todosModelos: false, anoSemPeca: null, carroSemPeca: null, naPeca: false,
});

// Nome da marca: de cara, uma linha (os longos, "Volkswagen", um pouco menores): a grade da abertura nunca muda de altura
// quando a fonte chega. Em "Ver todas" (depois do toque), até 2 linhas, com hífen só se precisar; o nome inteiro fica no aria-label.
const QUEBRA: Record<string, string> = { Volkswagen: 'Volks&shy;wagen', Chevrolet: 'Chevro&shy;let', Mitsubishi: 'Mitsu&shy;bishi' };
const nomeMarca = (n: string) => QUEBRA[n] ?? esc(n);
const whats = (contexto: string) => esc(whatsUrl(contexto));

// ---- desenho (funções puras: rodam no build para a abertura e no navegador) ----

/** logo que é só letreiro bem largo (Dodge, Iveco) viraria um fio no disco: vai o nome escrito no lugar (e não repete embaixo) */
const nomeNoDisco = (m: Marca) => !(m.logo && m.lh > 0 && m.lw / m.lh < 4.2);

function disco(m: Marca): string {
  if (!nomeNoDisco(m))
    return `<span class="mc-disco"><img src="${esc(m.logo!)}" alt="" width="${m.lw}" height="${m.lh}" loading="lazy" decoding="async" /></span>`;
  return `<span class="mc-disco mc-disco-nome" aria-hidden="true">${esc(m.n)}</span>`;
}

function htmlCampos(e: Estado): string {
  const botao = (alvo: Etapa, rot: string, valor: string | null, vazio: string, pode: boolean) => `
    <button type="button" class="mc-campo${valor ? ' mc-campo-cheio' : ''}" data-acao="ir" data-alvo="${alvo}" data-chave="ir:${alvo}"${pode && e.etapa === alvo ? ' aria-current="step"' : ''}${pode ? '' : ' disabled'}>
      <small>${rot}</small><b>${valor ? esc(valor) : vazio}</b>${SETA}</button>`;
  const mo = e.modelo;
  // "Todos" no campo e "Todos os anos" na lista: a mesma palavra para o mesmo estado
  const opcoes = mo
    ? [`<option value=""${e.ano == null ? ' selected' : ''}>Todos os anos · ${pecasTxt(mo.c)}</option>`]
        .concat(mo.ya.map(([y, c]) => `<option value="${y}"${e.ano === y ? ' selected' : ''}>${y} · ${pecasTxt(c)}</option>`))
        .join('')
    : '<option value="">Todos os anos</option>';
  return `
  <div class="mc-campos" role="group" aria-label="Seu carro">
    ${botao('marca', 'Marca', e.marca?.n ?? null, 'Escolher', true)}
    ${botao('modelo', 'Modelo', mo?.n ?? null, e.marca?.modelos.length ? 'Escolher' : '—', !!e.marca?.modelos.length)}
    <label class="mc-campo mc-campo-ano${e.ano != null ? ' mc-campo-cheio' : ''}"${mo ? '' : ' data-off'}>
      <small>Ano</small><b>${e.ano != null ? e.ano : mo ? 'Todos' : '—'}</b>${SETA}
      <select data-campo="ano" data-chave="campo:ano" aria-label="Ano do carro"${mo ? '' : ' disabled'}>${opcoes}</select>
    </label>
  </div>`;
}

/** Carro salvo que saiu do estoque. O esqueleto da abertura (SeletorCarro.astro) usa este HTML com o nome AVISO_CARRO
 *  e troca pelo carro salvo antes de pintar: o aviso já nasce no lugar (a grade de marcas não desce depois). */
export const AVISO_CARRO = '__CARRO__';
export function htmlAvisoSemPeca(carro: string): string {
  return `<p class="mc-aviso-linha" data-mc-aviso>Sem peças do <b>${esc(carro)}</b> no site agora. Escolha outro carro ou <a href="${whats(`Procuro peça para ${carro}. Tem no pátio?`)}">pede no WhatsApp</a>.</p>`;
}

function htmlMarcas(g: Garagem, e: Estado): string {
  const lista = e.todas ? g.marcas : g.marcas.slice(0, MARCAS_DE_CARA);
  const foco = e.marca?.n ?? lista[0]?.n;
  const tiles = lista
    .map((m) => `
      <li><button type="button" class="mc-marca" data-acao="marca" data-n="${esc(m.n)}" data-chave="marca:${esc(m.n)}"${m.n === foco ? ' data-foco' : ''} aria-pressed="${e.marca?.n === m.n}" aria-label="${esc(m.n)}, ${pecasTxt(m.c)}" title="${esc(m.n)}">
        ${disco(m)}${nomeNoDisco(m) ? '' : `<span class="mc-marca-nome${m.n.length >= 9 ? ' mc-longo' : ''}" aria-hidden="true">${nomeMarca(m.n)}</span>`}</button></li>`)
    .join('');
  const aviso = e.carroSemPeca ? htmlAvisoSemPeca(e.carroSemPeca) : '';
  return `${aviso}
    <ul class="mc-marcas"${e.todas ? ' data-todas' : ''} aria-label="Marcas">${tiles}</ul>
    <button type="button" class="mc-mais" data-acao="todas" data-chave="todas" aria-expanded="${e.todas}">${e.todas ? 'Mostrar menos marcas' : `Ver todas as ${g.marcas.length} marcas`}${SETA}</button>`;
}

function htmlModelos(e: Estado): string {
  const m = e.marca!;
  const todas = `/catalogo.html?${new URLSearchParams({ marca: m.n }).toString()}`;
  // links curtos (a marca já está no campo): os dois cabem numa linha, e a grade de modelos tem a altura da de marcas
  const procura = `<a class="mc-link" href="${whats(`Procuro peça para ${m.n} ____ (modelo e ano). Tem no pátio?`)}" aria-label="Não achou? A gente procura o modelo no pátio, pelo WhatsApp">Não achou? A gente procura</a>`;
  if (!m.modelos.length)
    // marca sem modelo lido nos anúncios (ex.: Mini): vai direto para as peças dela
    return `
    <p class="mc-frase"><b class="num">${fmt(m.c)}</b> ${m.c === 1 ? 'peça' : 'peças'} da <b>${esc(m.n)}</b>. Confira o modelo e o ano em cada peça.</p>
    <a class="botao botao-laranja mc-ver" href="${esc(todas)}" data-chave="ver" data-foco>${m.c === 1 ? 'Ver a peça' : `Ver as ${pecasTxt(m.c)} da ${esc(m.n)}`}</a>
    <p class="mc-pe">${procura}</p>`;
  const cortar = !e.todosModelos && m.modelos.length > MODELOS_DE_CARA + 1;
  const lista = cortar ? m.modelos.slice(0, MODELOS_DE_CARA) : m.modelos;
  const foco = e.modelo?.n ?? lista[0]?.n;
  const tiles = lista
    .map((mo) => `
      <li><button type="button" class="mc-modelo" data-acao="modelo" data-n="${esc(mo.n)}" data-chave="modelo:${esc(mo.n)}"${mo.n === foco ? ' data-foco' : ''} aria-pressed="${e.modelo?.n === mo.n}" title="${esc(mo.n)}">
        <b>${esc(mo.n)}</b><small class="num">${pecasTxt(mo.c)}</small></button></li>`)
    .join('');
  const mais = cortar
    ? `<li><button type="button" class="mc-modelo mc-modelo-mais" data-acao="modelos" data-chave="modelos"><b>Mais ${m.modelos.length - lista.length}</b><small>modelos</small></button></li>`
    : '';
  return `
    <ul class="mc-modelos" aria-label="Modelos ${esc(m.n)}">${tiles}${mais}</ul>
    <p class="mc-pe"><a class="mc-link" href="${esc(todas)}" aria-label="${m.c === 1 ? `Ver a peça da ${esc(m.n)}` : `Ver todas as ${pecasTxt(m.c)} da ${esc(m.n)}`}">${m.c === 1 ? 'Ver a peça' : `Ver todas as ${pecasTxt(m.c)}`}</a>${procura}</p>`;
}

/** Linha da contagem no cartão do carro (a mesma no desenho inteiro e no repinte do ano). */
function htmlConta(e: Estado): string {
  const mo = e.modelo!;
  const n = contagem(mo, e.ano);
  return `<b class="num">${fmt(n)}</b> ${n === 1 ? 'peça' : 'peças'} ${e.ano == null ? 'no pátio' : `para o ${e.ano}`}`;
}
const textoVer = (n: number) => (n === 1 ? 'Ver a peça' : `Ver as ${fmt(n)} peças`);
const textoVerNaPeca = (n: number) => (n === 1 ? 'Ver a peça do seu carro' : `Ver as ${fmt(n)} peças do seu carro`);
const carroDe = (e: Estado): MeuCarro => ({ b: e.marca!.n, m: e.modelo!.n, y: e.ano });
/** a/as do carro salvo (lib/meuCarro.ts): a arte do modelo, para o esqueleto da abertura já nascer com ela. */
const arteDo = (mo: Modelo): Pick<MeuCarro, 'a' | 'as'> => (mo.a ? { a: mo.a, ...(mo.as?.length ? { as: mo.as } : {}) } : {});

/** Arte do carro (srcset só com as variantes em dia, lib/garagem.ts); sem arte, o logo grande da marca. */
function htmlArte(m: Marca, mo: Modelo): string {
  if (!mo.a) return `<span class="mc-g-marca" aria-hidden="true">${disco(m)}</span>`;
  const { src, srcset } = fonteArte(mo.a, mo.as);
  // srcset e sizes antes do src: o navegador escolhe o arquivo uma vez só
  return `<img class="mc-g-arte"${srcset ? ` srcset="${esc(srcset)}" sizes="${SIZES_ARTE}"` : ''} src="${esc(src)}" alt="" width="1200" height="800" decoding="async" />`;
}

/** Anos com peça em linha: Todos · 2011 · 2012 … (do mais velho para o mais novo; rolável quando não cabe).
 *  Modelo sem ano nas peças: sem a linha. Um ano só: sem o "Todos" (daria as mesmas peças do ano). */
function htmlAnos(e: Estado): string {
  const mo = e.modelo!;
  if (!mo.ya.length) return '';
  const chip = (y: number | null, c: number) =>
    `<button type="button" class="mc-ano num" data-acao="ano" data-y="${y ?? ''}" data-chave="ano:${y ?? ''}" aria-pressed="${e.ano === y}" aria-label="${y ?? 'Todos os anos'}, ${pecasTxt(c)}">${y ?? 'Todos'}</button>`;
  const anos = [...mo.ya].sort((a, b) => a[0] - b[0]).map(([y, c]) => chip(y, c));
  const chips = (mo.ya.length > 1 ? [chip(null, mo.c)] : []).concat(anos).join('');
  return `
    <div class="mc-anos" role="group" aria-label="Ano do carro">
      <span class="mc-anos-rot" aria-hidden="true">Ano</span>
      <div class="mc-anos-trilho">
        <div class="mc-anos-lista" data-mc-anos>${chips}</div>
        <button type="button" class="mc-anos-seta mc-anos-esq" data-acao="rolar" data-dir="-1" tabindex="-1" aria-hidden="true">${SETA_LADO(-1)}</button>
        <button type="button" class="mc-anos-seta mc-anos-dir" data-acao="rolar" data-dir="1" tabindex="-1" aria-hidden="true">${SETA_LADO(1)}</button>
      </div>
    </div>`;
}

/** Cartão do seu carro: arte, logo pequeno, nome grande e a contagem de apoio. */
function htmlGaragem(e: Estado): string {
  const m = e.marca!;
  const mo = e.modelo!;
  const longo = `${m.n} ${mo.n}`.length > NOME_LONGO;
  const modeloLongo = mo.n.length > MODELO_LONGO;
  // logo pequeno num disco (letreiro largo demais, como Dodge, ou marca sem logo: o desenho do carro no lugar)
  const logo = `<span class="mc-g-logo">${nomeNoDisco(m) ? `<svg viewBox="0 0 24 24" aria-hidden="true">${LINHA.carro}</svg>` : `<img src="${esc(m.logo!)}" alt="" width="${m.lw}" height="${m.lh}" decoding="async" />`}</span>`;
  return `
    <div class="mc-garagem${mo.a ? '' : ' mc-garagem-sem'}">
      ${htmlArte(m, mo)}
      <div class="mc-g-txt">
        <p class="mc-g-olho">${logo}<span>Seu carro</span></p>
        <p class="mc-g-nome${longo ? ' mc-longo' : ''}${modeloLongo ? ' mc-modelo-longo' : ''}"><span>${esc(m.n)}</span> ${esc(mo.n)}</p>
        <p class="mc-g-conta" data-mc-conta>${htmlConta(e)}</p>
      </div>
    </div>`;
}

/** Selo do rodapé: "Salvo neste aparelho"; o ano salvo sem peça agora avisa ali (o cartão mostra todos os anos). */
const htmlSalvo = (e: Estado | null) =>
  e?.anoSemPeca ? `${AVISO}Sem peças do ${e.anoSemPeca}` : `${CHECK}Salvo neste aparelho`;
const htmlNota = (e: Estado | null) => `
    <div class="mc-nota"><span class="mc-salvo${e?.anoSemPeca ? ' mc-salvo-aviso' : ''}" data-mc-salvo>${htmlSalvo(e)}</span>
      <span class="mc-nota-acoes"><button type="button" data-acao="trocar" data-chave="trocar" aria-label="Trocar carro">Trocar<span class="mc-so-largo"> carro</span></button><span aria-hidden="true">·</span><button type="button" data-acao="tirar" data-chave="tirar">Esquecer</button></span></div>`;

function htmlPronto(e: Estado): string {
  const n = contagem(e.modelo!, e.ano);
  const link = esc(linkCatalogo(carroDe(e)));
  const acao = e.naPeca
    ? `<button type="button" class="botao botao-laranja mc-ver" data-acao="conferir" data-chave="ver" data-foco>Conferir nesta peça</button>
    <a class="mc-link mc-link-centro" href="${link}" data-mc-ver>${textoVerNaPeca(n)}</a>`
    : `<a class="botao botao-laranja mc-ver" href="${link}" data-chave="ver" data-foco data-mc-ver>${textoVer(n)}</a>`;
  return `${htmlGaragem(e)}${htmlAnos(e)}
    ${acao}${htmlNota(e)}`;
}

/** Esqueleto do cartão do carro: a abertura de quem já tem carro salvo nasce com ele (SeletorCarro.astro preenche o
 *  nome e o link antes de pintar); o desenho de verdade entra no mesmo lugar, com a mesma altura. */
export function htmlEsqueletoGaragem(): string {
  const chips = '<span class="mc-ano mc-esq"></span>'.repeat(9);
  // a arte (quando o carro salvo traz a chave dela): o script do esqueleto põe srcset e src; sem chave, sai
  return `<div class="mc-corpo" data-etapa="pronto" aria-busy="true">
    <div class="mc-garagem mc-garagem-esq"><img class="mc-g-arte" sizes="${SIZES_ARTE}" alt="" width="1200" height="800" decoding="async" data-esq-arte /><div class="mc-g-txt">
      <p class="mc-g-olho"><span class="mc-g-logo" data-esq-logo></span><span>Seu carro</span></p>
      <p class="mc-g-nome" data-esq-nome><span></span> </p>
      <p class="mc-g-conta"><span class="mc-esq mc-esq-linha"></span></p></div></div>
    <div class="mc-anos" aria-hidden="true"><span class="mc-anos-rot">Ano</span><div class="mc-anos-trilho"><div class="mc-anos-lista">${chips}</div></div></div>
    <a class="botao botao-laranja mc-ver" href="/catalogo.html" data-esq-ver>Ver as peças</a>${htmlNota(null)}</div>`;
}

function htmlCorpo(g: Garagem, e: Estado): string {
  const passo = e.etapa === 'marca' || !e.marca ? htmlMarcas(g, e) : e.etapa === 'modelo' || !e.modelo ? htmlModelos(e) : htmlPronto(e);
  return `<div class="mc-corpo" data-etapa="${e.etapa}">${passo}</div>`;
}

function htmlEsqueleto(): string {
  const li = '<li><span class="mc-marca"><span class="mc-disco"></span><span class="mc-marca-nome">&nbsp;</span></span></li>';
  return `<div class="mc-corpo" data-etapa="marca"><ul class="mc-marcas mc-esqueleto" aria-hidden="true">${li.repeat(MARCAS_DE_CARA)}</ul>
    <span class="mc-mais mc-esqueleto-txt" aria-hidden="true">&nbsp;</span></div>`;
}

function htmlErro(): string {
  return `<div class="mc-corpo" data-etapa="erro"><div class="mc-aviso"><p>Não deu para carregar os carros agora.</p>
    <p class="mc-aviso-acoes"><button type="button" class="botao botao-linha" data-acao="recarregar" data-chave="recarregar" data-foco>Tentar de novo</button>
      <a class="mc-link" href="/catalogo.html">Ver o catálogo</a>
      <a class="mc-link" href="${whats('Estou procurando uma peça.')}">Chamar no WhatsApp</a></p></div></div>`;
}

/** Marcação inicial (campos + grade de marcas), igual à que o script desenha: a abertura já nasce com ela. */
export function htmlInicial(g: Garagem): string {
  const e = inicial();
  return htmlCampos(e) + htmlCorpo(g, e);
}

// ---- comportamento ----

/** Monta o seletor dentro de `raiz`. Se a raiz já veio do build (data-ssr), aproveita a marcação.
 *  Chamar de novo na mesma raiz só atualiza com o carro salvo (e com a origem da caixa, data-origem). */
export function montarPicker(raiz: HTMLElement): Handle {
  const existente = (raiz as HTMLElement & { _meuCarro?: Handle })._meuCarro;
  if (existente) {
    existente.recarregar();
    return existente;
  }

  let g: Garagem | null = null;
  let erro = false;
  let salvando = false;
  let carregando = false;
  let pendente: HTMLElement | null = null; // toque que chegou antes dos dados
  const e = inicial();

  const conteudo =
    raiz.querySelector<HTMLElement>('[data-mc-conteudo]') ??
    raiz.appendChild(Object.assign(document.createElement('div'), { className: 'mc-conteudo' }));
  conteudo.setAttribute('data-mc-conteudo', '');
  const voz =
    raiz.querySelector<HTMLElement>('[data-mc-voz]') ??
    raiz.appendChild(Object.assign(document.createElement('p'), { className: 'mc-sr' }));
  voz.setAttribute('data-mc-voz', '');
  voz.setAttribute('aria-live', 'polite');

  function aplicarSalvo() {
    const salvo = lerMeuCarro();
    const a = g && achar(g, salvo);
    // a arte guardada com o carro (para o esqueleto da próxima visita) fica em dia com a garagem, sem avisar ninguém
    if (a) lembrarArte(a.marca.n, a.modelo.n, a.modelo.a, a.modelo.as);
    e.todas = false;
    e.todosModelos = false;
    e.naPeca = raiz.dataset.origem === 'peca';
    e.anoSemPeca = null;
    e.carroSemPeca = null;
    if (a) {
      e.marca = a.marca;
      e.modelo = a.modelo;
      // ano salvo que não tem peça agora: mostra todos os anos e avisa (o carro salvo continua com o ano dele)
      const temAno = a.ano != null && a.modelo.ya.some(([y]) => y === a.ano);
      e.ano = temAno ? a.ano : null;
      e.anoSemPeca = a.ano != null && !temAno ? a.ano : null;
      e.etapa = 'pronto';
    } else {
      // carro salvo que não está mais no estoque (marca ou modelo sem peça): volta às marcas, com aviso
      e.carroSemPeca = g && salvo ? `${salvo.b} ${salvo.m}` : null;
      e.marca = null;
      e.modelo = null;
      e.ano = null;
      e.etapa = 'marca';
    }
  }

  function anunciar() {
    if (!e.marca || !e.modelo) return;
    const n = contagem(e.modelo, e.ano);
    voz.textContent = `${pecasTxt(n)} para o seu ${e.marca.n} ${e.modelo.n}${e.ano ? ` ${e.ano}` : ''}${e.ano ? '' : '. Escolha o ano para conferir o encaixe'}`;
  }

  function salvar() {
    if (!e.marca || !e.modelo) return;
    salvando = true;
    e.anoSemPeca = null;
    e.carroSemPeca = null;
    salvarMeuCarro({ b: e.marca.n, m: e.modelo.n, y: e.ano, ...arteDo(e.modelo) });
    salvando = false;
    anunciar();
  }

  function corpo(): string {
    if (erro) return htmlCampos(e) + htmlErro();
    if (!g) return htmlCampos(e) + htmlEsqueleto();
    // com o carro escolhido, o cartão do carro toma o lugar dos campos (a mesma altura)
    return (e.etapa === 'pronto' && e.marca && e.modelo ? '' : htmlCampos(e)) + htmlCorpo(g, e);
  }

  function desenhar() {
    const ativo = document.activeElement as HTMLElement | null;
    const dentro = !!ativo && conteudo.contains(ativo);
    const chave = dentro ? ativo!.dataset.chave : undefined;
    // a arte que já está na tela (a do esqueleto ou a do desenho anterior) continua a MESMA: nada de baixar de novo
    // nem de piscar (a nova começaria transparente até carregar)
    const arteVelha = conteudo.querySelector<HTMLImageElement>('img.mc-g-arte');
    conteudo.innerHTML = corpo();
    const arteNova = conteudo.querySelector<HTMLImageElement>('img.mc-g-arte');
    if (arteVelha && arteNova && arteVelha.getAttribute('src') === arteNova.getAttribute('src')
        && (arteVelha.getAttribute('srcset') ?? '') === (arteNova.getAttribute('srcset') ?? '')) {
      arteVelha.removeAttribute('data-esq-arte');
      arteNova.replaceWith(arteVelha);
    }
    raiz.removeAttribute('data-ssr');
    raiz.removeAttribute('data-salvo');
    if (dentro) {
      const alvo =
        (chave && Array.from(conteudo.querySelectorAll<HTMLElement>('[data-chave]')).find((el) => el.dataset.chave === chave)) ||
        conteudo.querySelector<HTMLElement>('[data-foco]');
      alvo?.focus({ preventScroll: true });
    }
    // a arte entra suave quando chega da rede (já no cache: aparece direto, sem piscar)
    const arte = conteudo.querySelector<HTMLImageElement>('img.mc-g-arte');
    if (arte) {
      if (arte.complete && arte.naturalWidth) arte.dataset.ok = '';
      else arte.addEventListener('load', () => (arte.dataset.ok = ''), { once: true });
    }
    arrumarAnos(true);
  }

  /** Linha dos anos: o ano escolhido à vista (pelo scrollLeft da própria linha: a página nunca rola junto) e as
   *  bordas esmaecidas / setas só do lado em que ainda há anos. */
  function arrumarAnos(centrar: boolean) {
    const lista = conteudo.querySelector<HTMLElement>('[data-mc-anos]');
    if (!lista) return;
    const sel = lista.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (sel) {
      const ini = sel.offsetLeft; // a lista é position: relative (offsetParent dos anos): conta sem a rolagem
      const fim = ini + sel.offsetWidth;
      const folga = 28;
      if (centrar) lista.scrollLeft = ini - (lista.clientWidth - sel.offsetWidth) / 2;
      else if (ini - folga < lista.scrollLeft) lista.scrollLeft = ini - folga;
      else if (fim + folga > lista.scrollLeft + lista.clientWidth) lista.scrollLeft = fim + folga - lista.clientWidth;
    }
    bordasAnos(lista);
  }
  function bordasAnos(lista: HTMLElement) {
    const trilho = lista.parentElement!;
    const max = lista.scrollWidth - lista.clientWidth;
    trilho.toggleAttribute('data-esq', lista.scrollLeft > 2);
    trilho.toggleAttribute('data-dir', lista.scrollLeft < max - 2);
  }

  /** Trocou só o ano: repinta a contagem, o botão e os anos marcados (a arte e a linha dos anos ficam onde estão). */
  function pintarAno() {
    if (!e.modelo) return;
    const n = contagem(e.modelo, e.ano);
    const conta = conteudo.querySelector<HTMLElement>('[data-mc-conta]');
    if (conta) conta.innerHTML = htmlConta(e);
    const selo = conteudo.querySelector<HTMLElement>('[data-mc-salvo]');
    if (selo) {
      selo.innerHTML = htmlSalvo(e);
      selo.classList.toggle('mc-salvo-aviso', !!e.anoSemPeca);
    }
    const ver = conteudo.querySelector<HTMLAnchorElement>('[data-mc-ver]');
    if (ver) {
      ver.href = linkCatalogo(carroDe(e));
      ver.textContent = e.naPeca ? textoVerNaPeca(n) : textoVer(n);
    }
    conteudo.querySelectorAll<HTMLElement>('.mc-ano[data-y]').forEach((c) =>
      c.setAttribute('aria-pressed', String((c.dataset.y ? Number(c.dataset.y) : null) === e.ano)),
    );
    arrumarAnos(false);
  }

  /** Vindo da página da peça: avisa a caixa para fechar e mostrar a resposta na faixa. */
  function escolhido() {
    if (e.naPeca) raiz.dispatchEvent(new CustomEvent(ESCOLHIDO, { bubbles: true }));
  }

  function agir(b: HTMLElement) {
    if (!g) return;
    const acao = b.dataset.acao;
    if (acao === 'todas') {
      e.todas = !e.todas;
    } else if (acao === 'modelos') {
      e.todosModelos = true;
    } else if (acao === 'ano') {
      // ano escolhido no cartão do carro: salva (o cabeçalho e o resto do site ficam sabendo) e repinta só o necessário
      if (!e.modelo || !e.marca) return;
      e.ano = b.dataset.y ? Number(b.dataset.y) : null;
      salvar();
      pintarAno();
      if (e.ano != null) escolhido();
      return;
    } else if (acao === 'conferir') {
      escolhido();
      return;
    } else if (acao === 'marca') {
      const m = g.marcas.find((x) => x.n === b.dataset.n);
      if (!m) return;
      if (e.marca?.n !== m.n) {
        e.modelo = null;
        e.ano = null;
        e.todosModelos = false;
      }
      e.marca = m;
      if (m.modelos.length === 1) {
        // marca com um modelo só (ex.: Jaguar E-Pace): já mostra as peças dele
        e.modelo = m.modelos[0];
        e.etapa = 'pronto';
        salvar();
      } else {
        e.etapa = 'modelo';
      }
    } else if (acao === 'modelo') {
      const mo = e.marca?.modelos.find((x) => x.n === b.dataset.n);
      if (!mo) return;
      if (e.modelo?.n !== mo.n) e.ano = null;
      e.modelo = mo;
      e.etapa = 'pronto';
      salvar();
    } else if (acao === 'ir') {
      const alvo = b.dataset.alvo as Etapa;
      if (alvo === 'modelo' && !e.marca) return;
      e.etapa = alvo;
    } else if (acao === 'trocar') {
      e.etapa = 'marca';
    } else if (acao === 'tirar') {
      e.marca = null;
      e.modelo = null;
      e.ano = null;
      e.todas = false;
      e.anoSemPeca = null;
      e.carroSemPeca = null;
      e.etapa = 'marca';
      salvarMeuCarro(null);
      voz.textContent = 'Carro esquecido neste aparelho.';
    } else {
      return;
    }
    desenhar();
  }

  function carregar() {
    erro = false;
    carregando = true;
    if (!raiz.hasAttribute('data-ssr')) desenhar(); // sem marcação do build: mostra o esqueleto
    carregarGaragem()
      .then((d) => {
        carregando = false;
        g = d;
        aplicarSalvo();
        if (pendente) {
          const b = pendente;
          pendente = null;
          b.removeAttribute('data-esperando');
          agir(b);
          return;
        }
        // a marcação do build já é exatamente este estado: não redesenha (nada pisca)
        if (raiz.hasAttribute('data-ssr') && !raiz.hasAttribute('data-salvo') && e.etapa === 'marca' && !e.carroSemPeca) {
          raiz.removeAttribute('data-ssr');
          return;
        }
        desenhar();
      })
      .catch(() => {
        carregando = false;
        erro = true;
        // na abertura a grade do build continua de pé: o aviso só aparece se a pessoa tentou usar
        // (ou se o carro salvo estava esperando o resultado); o próximo toque tenta de novo
        if (pendente || !raiz.hasAttribute('data-ssr') || raiz.hasAttribute('data-salvo')) {
          pendente?.removeAttribute('data-esperando');
          pendente = null;
          desenhar();
        }
      });
  }

  raiz.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-acao]');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.acao === 'rolar') {
      // setas da linha dos anos (só no mouse; no toque a linha corre com o dedo)
      const lista = b.parentElement?.querySelector<HTMLElement>('[data-mc-anos]');
      const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
      lista?.scrollBy({ left: Number(b.dataset.dir) * lista.clientWidth * 0.7, behavior: reduz ? 'auto' : 'smooth' });
      return;
    }
    if (b.dataset.acao === 'recarregar') {
      carregar();
      return;
    }
    if (!g) {
      // tocou antes de os dados chegarem: guarda o toque e faz quando chegar
      pendente = b;
      b.setAttribute('data-esperando', '');
      if (!carregando) carregar();
      return;
    }
    agir(b);
  });

  // a linha dos anos rolou (dedo, trackpad ou seta): acerta as bordas
  raiz.addEventListener(
    'scroll',
    (ev) => {
      const l = ev.target as HTMLElement;
      if (l instanceof HTMLElement && l.hasAttribute('data-mc-anos')) bordasAnos(l);
    },
    { capture: true, passive: true },
  );

  raiz.addEventListener('change', (ev) => {
    const s = ev.target as HTMLElement;
    if (!(s instanceof HTMLSelectElement) || s.dataset.campo !== 'ano' || !e.modelo) return;
    e.ano = s.value ? Number(s.value) : null;
    e.etapa = 'pronto';
    salvar();
    desenhar();
    if (e.ano != null) escolhido();
  });

  // Outra parte do site salvou (ou limpou) o carro: atualiza este seletor também.
  window.addEventListener(EVENTO, () => {
    if (salvando || !g) return;
    aplicarSalvo();
    desenhar();
  });

  const handle: Handle = {
    recarregar() {
      if (g) {
        aplicarSalvo();
        desenhar();
      } else carregar();
    },
  };
  (raiz as HTMLElement & { _meuCarro?: Handle })._meuCarro = handle;
  carregar();
  return handle;
}
