// Meu carro: seletor marca -> modelo -> ano. Uma única implementação, usada na abertura (aba "Pelo carro")
// e na caixa que abre pelo cabeçalho. Vanilla TS (sem React) para não pesar nas páginas.
//
// Desenho: três campos no topo (Marca | Modelo | Ano, como nas lojas de autopeças) e, embaixo, a escolha do
// campo aberto: discos com o logo da marca, depois os modelos. O Ano é um <select> de verdade dentro do campo
// (lista longa: até 38 anos) e o resultado mostra a contagem real com o botão "Ver as N peças".
// O ano é o que decide o encaixe ("serve" só com ano: lib/meuCarro.ts): sem ano, o resultado convida a escolher.
//
// Dados: /dados/meu-carro.json (lib/garagem.ts, no build). A abertura já vem com a grade de marcas no HTML,
// gerada por htmlInicial() com os MESMOS dados; o script só redesenha quando o estado muda.
// Estilos: ui/MeuCarroEstilo.astro (globais, sempre dentro de .mc-raiz). Salva só no navegador (lib/meuCarro.ts).
// Caixa aberta pela faixa da página da peça (raiz com data-origem="peca"): o resultado ganha "Conferir nesta peça"
// e, ao escolher o ano, a raiz avisa (evento ESCOLHIDO) para a caixa fechar e mostrar a resposta na faixa.
import { lerMeuCarro, salvarMeuCarro, carregarGaragem as baixarGaragem, linkCatalogo, EVENTO, ESCOLHIDO, type MeuCarro } from '../../lib/meuCarro';
import { whatsUrl } from '../../lib/whats';

export type Modelo = { n: string; c: number; ya: [number, number][] };
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
  const convite = e.etapa === 'pronto' && mo && e.ano == null;
  return `
  <div class="mc-campos" role="group" aria-label="Seu carro">
    ${botao('marca', 'Marca', e.marca?.n ?? null, 'Escolha', true)}
    ${botao('modelo', 'Modelo', mo?.n ?? null, e.marca?.modelos.length ? 'Escolha' : '—', !!e.marca?.modelos.length)}
    <label class="mc-campo mc-campo-ano${e.ano != null ? ' mc-campo-cheio' : ''}${convite ? ' mc-convite' : ''}"${mo ? '' : ' data-off'}>
      <small>Ano</small><b>${e.ano != null ? e.ano : mo ? 'Todos' : '—'}</b>${SETA}
      <select data-campo="ano" data-chave="campo:ano" aria-label="Ano do carro"${mo ? '' : ' disabled'}>${opcoes}</select>
    </label>
  </div>`;
}

function htmlMarcas(g: Garagem, e: Estado): string {
  const lista = e.todas ? g.marcas : g.marcas.slice(0, MARCAS_DE_CARA);
  const foco = e.marca?.n ?? lista[0]?.n;
  const tiles = lista
    .map((m) => `
      <li><button type="button" class="mc-marca" data-acao="marca" data-n="${esc(m.n)}" data-chave="marca:${esc(m.n)}"${m.n === foco ? ' data-foco' : ''} aria-pressed="${e.marca?.n === m.n}" aria-label="${esc(m.n)}, ${pecasTxt(m.c)}" title="${esc(m.n)}">
        ${disco(m)}${nomeNoDisco(m) ? '' : `<span class="mc-marca-nome${m.n.length >= 9 ? ' mc-longo' : ''}" aria-hidden="true">${nomeMarca(m.n)}</span>`}</button></li>`)
    .join('');
  const aviso = e.carroSemPeca
    ? `<p class="mc-aviso-linha">Sem peças do <b>${esc(e.carroSemPeca)}</b> no site agora. Escolha outro carro ou <a href="${whats(`Procuro peça para ${e.carroSemPeca}. Tem no pátio?`)}">peça no WhatsApp</a>.</p>`
    : '';
  return `${aviso}
    <ul class="mc-marcas"${e.todas ? ' data-todas' : ''} aria-label="Marcas">${tiles}</ul>
    <button type="button" class="mc-mais" data-acao="todas" data-chave="todas" aria-expanded="${e.todas}">${e.todas ? 'Mostrar menos marcas' : `Ver todas as ${g.marcas.length} marcas`}${SETA}</button>`;
}

function htmlModelos(e: Estado): string {
  const m = e.marca!;
  const todas = `/catalogo.html?${new URLSearchParams({ marca: m.n }).toString()}`;
  const procura = `<a class="mc-link" href="${whats(`Procuro peça para ${m.n} ____ (modelo e ano). Tem no pátio?`)}">Não achou o modelo? A gente procura no pátio</a>`;
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
    <p class="mc-pe"><a class="mc-link" href="${esc(todas)}">${m.c === 1 ? `Ver a peça da ${esc(m.n)}` : `Ver todas as ${pecasTxt(m.c)} da ${esc(m.n)}`}</a>${procura}</p>`;
}

function htmlPronto(e: Estado): string {
  const mo = e.modelo!;
  const n = contagem(mo, e.ano);
  const carro: MeuCarro = { b: e.marca!.n, m: mo.n, y: e.ano };
  const nome = `${carro.b} ${carro.m}${carro.y ? ` ${carro.y}` : ''}`;
  const ver = n === 1 ? 'Ver a peça' : `Ver as ${fmt(n)} peças`;
  // sem ano: o encaixe ainda não foi conferido (o ano é o que decide); o ano salvo sem peça agora ganha o aviso
  const linha = e.anoSemPeca
    ? `<p class="mc-aviso-linha">Sem peças do <b>${esc(mo.n)} ${e.anoSemPeca}</b> agora. Mostrando todos os anos.</p>`
    : e.ano == null
      ? `<p class="mc-dica"><span>Qual o ano? Assim a gente confere o encaixe.</span> <button type="button" data-acao="ano" data-chave="ano">Escolher o ano</button></p>`
      : '';
  const acao = e.naPeca
    ? `<button type="button" class="botao botao-laranja mc-ver" data-acao="conferir" data-chave="ver" data-foco>Conferir nesta peça</button>
    <a class="mc-link mc-link-centro" href="${esc(linkCatalogo(carro))}">${n === 1 ? 'Ver a peça do seu carro' : `Ver as ${fmt(n)} peças do seu carro`}</a>`
    : `<a class="botao botao-laranja mc-ver" href="${esc(linkCatalogo(carro))}" data-chave="ver" data-foco>${ver}</a>`;
  return `
    <div class="mc-resumo">${disco(e.marca!)}
      <p class="mc-frase"><b class="num">${fmt(n)}</b> ${n === 1 ? 'peça' : 'peças'} para o seu <b>${esc(nome)}</b></p></div>
    ${linha}
    ${acao}
    <p class="mc-nota"><span>Salvo neste aparelho.</span>
      <span class="mc-nota-acoes"><button type="button" data-acao="trocar" data-chave="trocar">Trocar carro</button>
      <button type="button" data-acao="tirar" data-chave="tirar">Esquecer</button></span></p>`;
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
    salvarMeuCarro({ b: e.marca.n, m: e.modelo.n, y: e.ano });
    salvando = false;
    anunciar();
  }

  function corpo(): string {
    if (erro) return htmlCampos(e) + htmlErro();
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
      abrirAno();
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
