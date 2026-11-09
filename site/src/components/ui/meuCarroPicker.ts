// Meu carro: seletor marca -> modelo -> ano. Uma única implementação, usada na abertura (aba "Pelo carro")
// e na caixa que abre pelo cabeçalho. Vanilla TS (sem React) para não pesar nas páginas.
//
// Desenho: três campos no topo (Marca | Modelo | Ano, como nas lojas de autopeças) e, embaixo, a escolha do
// campo aberto: discos com o logo da marca, depois os modelos. O Ano é um <select> de verdade dentro do campo
// (lista longa: até 38 anos) e o resultado mostra a contagem real com o botão "Ver as N peças".
//
// Dados: /dados/meu-carro.json (lib/garagem.ts, no build). A abertura já vem com a grade de marcas no HTML,
// gerada por htmlInicial() com os MESMOS dados; o script só redesenha quando o estado muda.
// Estilos: ui/MeuCarroEstilo.astro (globais, sempre dentro de .mc-raiz). Salva só no navegador (lib/meuCarro.ts).
import { lerMeuCarro, salvarMeuCarro, EVENTO, type MeuCarro } from '../../lib/meuCarro';

export type Modelo = { n: string; c: number; ya: [number, number][] };
export type Marca = { n: string; k: string; logo: string | null; lw: number; lh: number; c: number; modelos: Modelo[] };
export type Garagem = { v: number; total: number; marcas: Marca[] };
export type Handle = { recarregar: () => void };

type Etapa = 'marca' | 'modelo' | 'pronto';
type Estado = { etapa: Etapa; marca: Marca | null; modelo: Modelo | null; ano: number | null; todas: boolean; todosModelos: boolean };

/** Marcas de cara (no celular o CSS mostra só as 8 primeiras); o resto fica em "Ver todas". */
export const MARCAS_DE_CARA = 12;
const MODELOS_DE_CARA = 8;

let carregado: Promise<Garagem> | null = null;
export function carregarGaragem(): Promise<Garagem> {
  // ~6 KB comprimido: pedido logo na montagem, para o primeiro toque numa marca já ter os modelos
  carregado ??= fetch('/dados/meu-carro.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Garagem>;
    })
    .catch((e) => {
      carregado = null;
      throw e;
    });
  return carregado;
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

/** Link do catálogo já filtrado pelo carro (mesmos parâmetros que catalogo.astro entende). */
export function linkCatalogo(c: MeuCarro): string {
  const u = new URLSearchParams({ marca: c.b, modelo: c.m });
  if (c.y) u.set('ano', String(c.y));
  return `/catalogo.html?${u.toString()}`;
}

/** Acha marca/modelo do carro salvo dentro dos dados. */
export function achar(g: Garagem, c: MeuCarro | null) {
  if (!c) return null;
  const marca = g.marcas.find((m) => m.n === c.b);
  const modelo = marca?.modelos.find((x) => x.n === c.m);
  return marca && modelo ? { marca, modelo, ano: c.y ?? null } : null;
}

const SETA = '<svg class="mc-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const inicial = (): Estado => ({ etapa: 'marca', marca: null, modelo: null, ano: null, todas: false, todosModelos: false });

// ---- desenho (funções puras: rodam no build para a abertura e no navegador) ----

function disco(m: Marca): string {
  // logo que é só letreiro bem largo (Dodge, Iveco) viraria um fio no disco: vai o nome escrito no lugar
  if (m.logo && m.lh > 0 && m.lw / m.lh < 4.2)
    return `<span class="mc-disco"><img src="${esc(m.logo)}" alt="" width="${m.lw}" height="${m.lh}" loading="lazy" decoding="async" /></span>`;
  return `<span class="mc-disco mc-disco-nome" aria-hidden="true">${esc(m.n)}</span>`;
}

function htmlCampos(e: Estado): string {
  const botao = (alvo: Etapa, rot: string, valor: string | null, vazio: string, pode: boolean) => `
    <button type="button" class="mc-campo${valor ? ' mc-campo-cheio' : ''}" data-acao="ir" data-alvo="${alvo}" data-chave="ir:${alvo}"${pode && e.etapa === alvo ? ' aria-current="step"' : ''}${pode ? '' : ' disabled'}>
      <small>${rot}</small><b>${valor ? esc(valor) : vazio}</b>${SETA}</button>`;
  const mo = e.modelo;
  const opcoes = mo
    ? [`<option value=""${e.ano == null ? ' selected' : ''}>Qualquer ano · ${pecasTxt(mo.c)}</option>`]
        .concat(mo.ya.map(([y, c]) => `<option value="${y}"${e.ano === y ? ' selected' : ''}>${y} · ${pecasTxt(c)}</option>`))
        .join('')
    : '<option value="">Qualquer ano</option>';
  const convite = e.etapa === 'pronto' && mo && e.ano == null;
  return `
  <div class="mc-campos" role="group" aria-label="Seu carro">
    ${botao('marca', 'Marca', e.marca?.n ?? null, 'Escolha', true)}
    ${botao('modelo', 'Modelo', mo?.n ?? null, e.marca?.modelos.length ? 'Escolha' : '—', !!e.marca?.modelos.length)}
    <label class="mc-campo mc-campo-ano${e.ano != null ? ' mc-campo-cheio' : ''}${convite ? ' mc-convite' : ''}"${mo ? '' : ' data-off'}>
      <small>Ano</small><b>${e.ano != null ? e.ano : mo ? 'Todos' : '—'}</b>${SETA}
      <select data-campo="ano" data-chave="campo:ano" aria-label="Ano do carro (opcional)"${mo ? '' : ' disabled'}>${opcoes}</select>
    </label>
  </div>`;
}

function htmlMarcas(g: Garagem, e: Estado): string {
  const lista = e.todas ? g.marcas : g.marcas.slice(0, MARCAS_DE_CARA);
  const foco = e.marca?.n ?? lista[0]?.n;
  const tiles = lista
    .map((m) => `
      <li><button type="button" class="mc-marca" data-acao="marca" data-n="${esc(m.n)}" data-chave="marca:${esc(m.n)}"${m.n === foco ? ' data-foco' : ''} aria-pressed="${e.marca?.n === m.n}" aria-label="${esc(m.n)}, ${pecasTxt(m.c)}" title="${esc(m.n)}">
        ${disco(m)}<span class="mc-marca-nome" aria-hidden="true">${esc(m.n)}</span></button></li>`)
    .join('');
  return `
    <ul class="mc-marcas"${e.todas ? ' data-todas' : ''} aria-label="Marcas">${tiles}</ul>
    <button type="button" class="mc-mais" data-acao="todas" data-chave="todas" aria-expanded="${e.todas}">${e.todas ? 'Mostrar menos marcas' : `Ver todas as ${g.marcas.length} marcas`}${SETA}</button>`;
}

function htmlModelos(e: Estado): string {
  const m = e.marca!;
  const todas = `/catalogo.html?${new URLSearchParams({ marca: m.n }).toString()}`;
  if (!m.modelos.length)
    // marca sem modelo lido nos anúncios (ex.: Mini): vai direto para as peças dela
    return `
    <p class="mc-frase">As peças da <b>${esc(m.n)}</b> ainda não estão separadas por modelo.</p>
    <a class="botao botao-laranja mc-ver" href="${esc(todas)}" data-chave="ver" data-foco>${m.c === 1 ? 'Ver a peça' : `Ver as ${pecasTxt(m.c)} da ${esc(m.n)}`}</a>`;
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
    <a class="mc-link" href="${esc(todas)}">${m.c === 1 ? `Ver a peça da ${esc(m.n)}` : `Ver todas as ${pecasTxt(m.c)} da ${esc(m.n)}`}</a>`;
}

function htmlPronto(e: Estado): string {
  const mo = e.modelo!;
  const n = contagem(mo, e.ano);
  const carro: MeuCarro = { b: e.marca!.n, m: mo.n, y: e.ano };
  const nome = `${carro.b} ${carro.m}${carro.y ? ` ${carro.y}` : ''}`;
  return `
    <div class="mc-resumo">${disco(e.marca!)}
      <p class="mc-frase"><b class="num">${fmt(n)}</b> ${n === 1 ? 'peça' : 'peças'} para o seu <b>${esc(nome)}</b></p></div>
    <a class="botao botao-laranja mc-ver" href="${esc(linkCatalogo(carro))}" data-chave="ver" data-foco>${n === 1 ? 'Ver a peça' : `Ver as ${fmt(n)} peças`}</a>
    <p class="mc-nota"><span>Salvo neste aparelho.</span>
      <button type="button" data-acao="trocar" data-chave="trocar">Trocar carro</button>
      <button type="button" data-acao="tirar" data-chave="tirar">Esquecer</button></p>`;
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

/** Marcação inicial (campos + grade de marcas), igual à que o script desenha: a abertura já nasce com ela. */
export function htmlInicial(g: Garagem): string {
  const e = inicial();
  return htmlCampos(e) + htmlCorpo(g, e);
}

// ---- comportamento ----

/** Monta o seletor dentro de `raiz`. Se a raiz já veio do build (data-ssr), aproveita a marcação.
 *  Chamar de novo na mesma raiz só atualiza com o carro salvo. */
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
    const a = g && achar(g, lerMeuCarro());
    e.todas = false;
    e.todosModelos = false;
    if (a) {
      e.marca = a.marca;
      e.modelo = a.modelo;
      // ano salvo que não tem mais peça no estoque: mostra "qualquer ano" (sem mexer no que está salvo)
      e.ano = a.ano != null && a.modelo.ya.some(([y]) => y === a.ano) ? a.ano : null;
      e.etapa = 'pronto';
    } else {
      e.marca = null;
      e.modelo = null;
      e.ano = null;
      e.etapa = 'marca';
    }
  }

  function anunciar() {
    if (!e.marca || !e.modelo) return;
    const n = contagem(e.modelo, e.ano);
    voz.textContent = `${pecasTxt(n)} para o seu ${e.marca.n} ${e.modelo.n}${e.ano ? ` ${e.ano}` : ''}`;
  }

  function salvar() {
    if (!e.marca || !e.modelo) return;
    salvando = true;
    salvarMeuCarro({ b: e.marca.n, m: e.modelo.n, y: e.ano });
    salvando = false;
    anunciar();
  }

  function corpo(): string {
    if (erro)
      return `${htmlCampos(e)}<div class="mc-corpo"><p class="mc-aviso">Não deu para carregar os carros agora.
        <button type="button" data-acao="recarregar" data-chave="recarregar">Tentar de novo</button></p></div>`;
    if (!g) return htmlCampos(e) + htmlEsqueleto();
    return htmlCampos(e) + htmlCorpo(g, e);
  }

  function desenhar() {
    const ativo = document.activeElement as HTMLElement | null;
    const dentro = !!ativo && conteudo.contains(ativo);
    const chave = dentro ? ativo!.dataset.chave : undefined;
    conteudo.innerHTML = corpo();
    raiz.removeAttribute('data-ssr');
    raiz.removeAttribute('data-salvo');
    if (dentro) {
      const alvo =
        (chave && Array.from(conteudo.querySelectorAll<HTMLElement>('[data-chave]')).find((el) => el.dataset.chave === chave)) ||
        conteudo.querySelector<HTMLElement>('[data-foco]');
      alvo?.focus({ preventScroll: true });
    }
  }

  function abrirAno() {
    const s = conteudo.querySelector<HTMLSelectElement>('select[data-campo="ano"]');
    if (!s || s.disabled) return;
    s.focus({ preventScroll: true });
    try {
      (s as HTMLSelectElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      /* navegador sem showPicker no select: fica o foco */
    }
  }

  function agir(b: HTMLElement) {
    if (!g) return;
    const acao = b.dataset.acao;
    if (acao === 'todas') {
      e.todas = !e.todas;
    } else if (acao === 'modelos') {
      e.todosModelos = true;
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
        if (raiz.hasAttribute('data-ssr') && !raiz.hasAttribute('data-salvo') && e.etapa === 'marca') {
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

  raiz.addEventListener('change', (ev) => {
    const s = ev.target as HTMLElement;
    if (!(s instanceof HTMLSelectElement) || s.dataset.campo !== 'ano' || !e.modelo) return;
    e.ano = s.value ? Number(s.value) : null;
    e.etapa = 'pronto';
    salvar();
    desenhar();
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
