// Meu carro: seletor marca -> modelo -> ano. Uma única implementação, usada na abertura (cartão)
// e na caixa que abre pelo cabeçalho. Vanilla TS (sem React) para não pesar nas páginas.
// Dados: /dados/meu-carro.json (gerado no build). Salva só no navegador via lib/meuCarro.ts.
import { lerMeuCarro, salvarMeuCarro, EVENTO, type MeuCarro } from '../../lib/meuCarro';

export type Modelo = { n: string; c: number; ya: [number, number][] };
export type Marca = { n: string; k: string; logo: string | null; c: number; modelos: Modelo[] };
export type Garagem = { v: number; total: number; marcas: Marca[]; populares: { q: string; n: string; c: number }[] };
export type Handle = { recarregar: () => void };

const MARCAS_DE_CARA = 12;

let carregado: Promise<Garagem> | null = null;
export function carregarGaragem(): Promise<Garagem> {
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

const pecasTxt = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'peça' : 'peças'}`;

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

/** Monta o seletor dentro de `raiz`. Chamar de novo na mesma raiz só atualiza com o carro salvo. */
export function montarPicker(raiz: HTMLElement): Handle {
  const existente = (raiz as HTMLElement & { _meuCarro?: Handle })._meuCarro;
  if (existente) {
    existente.recarregar();
    return existente;
  }

  let g: Garagem | null = null;
  let erro = false;
  let marca: Marca | null = null;
  let modelo: Modelo | null = null;
  let ano: number | null = null;
  let etapa: 'marca' | 'modelo' | 'pronto' = 'marca';
  let todas = false;
  let salvando = false;

  function aplicarSalvo() {
    const a = g && achar(g, lerMeuCarro());
    if (a) {
      marca = a.marca;
      modelo = a.modelo;
      ano = a.ano;
      etapa = 'pronto';
    } else {
      marca = null;
      modelo = null;
      ano = null;
      etapa = 'marca';
    }
  }

  function salvar() {
    if (!marca || !modelo) return;
    salvando = true;
    salvarMeuCarro({ b: marca.n, m: modelo.n, y: ano });
    salvando = false;
  }

  function pilulas(): string {
    const itens: string[] = [];
    if (marca) itens.push(`<button type="button" class="mc-pilula" data-acao="ir" data-alvo="marca" aria-pressed="${etapa === 'marca'}">${esc(marca.n)}</button>`);
    if (modelo) itens.push(`<button type="button" class="mc-pilula" data-acao="ir" data-alvo="modelo" aria-pressed="${etapa === 'modelo'}">${esc(modelo.n)}</button>`);
    if (modelo) itens.push(`<button type="button" class="mc-pilula" data-acao="ir" data-alvo="pronto" aria-pressed="${etapa === 'pronto' && ano != null}">${ano ?? 'Qualquer ano'}</button>`);
    return itens.length ? `<div class="mc-pilulas" role="group" aria-label="Seu carro">${itens.join('')}</div>` : '';
  }

  function passoMarca(): string {
    const lista = g!.marcas.slice(0, todas ? undefined : MARCAS_DE_CARA);
    const tiles = lista.map((m) => `
      <li><button type="button" class="mc-marca" data-acao="marca" data-n="${esc(m.n)}" data-chave="marca:${esc(m.n)}" aria-pressed="${marca?.n === m.n}">
        <span class="mc-logo">${m.logo ? `<img src="${m.logo}" alt="" loading="lazy" decoding="async" />` : `<b>${esc(m.n.slice(0, 3))}</b>`}</span>
        <span class="mc-marca-nome">${esc(m.n)}</span>
      </button></li>`).join('');
    return `
      <p class="mc-pergunta">Qual é a marca do carro?</p>
      <ul class="mc-marcas">${tiles}</ul>
      <button type="button" class="mc-mais" data-acao="todas" data-chave="todas">${todas ? 'Mostrar menos marcas' : `Ver todas as ${g!.marcas.length} marcas`}</button>`;
  }

  function passoModelo(): string {
    const chips = marca!.modelos.map((mo) => `
      <li><button type="button" class="mc-chip" data-acao="modelo" data-n="${esc(mo.n)}" data-chave="modelo:${esc(mo.n)}" aria-pressed="${modelo?.n === mo.n}">
        <b>${esc(mo.n)}</b><small class="num">${pecasTxt(mo.c)}</small></button></li>`).join('');
    return `
      <p class="mc-pergunta">Qual é o modelo do ${esc(marca!.n)}?</p>
      <ul class="mc-chips">${chips}</ul>`;
  }

  function passoPronto(): string {
    const m = modelo!;
    const n = contagem(m, ano);
    const carro: MeuCarro = { b: marca!.n, m: m.n, y: ano };
    const nome = `${carro.b} ${carro.m}${carro.y ? ` ${carro.y}` : ''}`;
    const anos = m.ya.map(([y, c]) => `
      <li><button type="button" class="mc-chip mc-chip-ano" data-acao="ano" data-ano="${y}" data-chave="ano:${y}" aria-pressed="${ano === y}">
        <b class="num">${y}</b><small class="num">${c}</small></button></li>`).join('');
    return `
      <div class="mc-anos">
        <p class="mc-pergunta">Qual é o ano? <span class="mc-opc">(opcional)</span></p>
        <ul class="mc-chips">
          <li><button type="button" class="mc-chip" data-acao="ano" data-ano="" data-chave="ano:nao" aria-pressed="${ano == null}">
            <b>Não sei o ano</b><small class="num">${pecasTxt(m.c)}</small></button></li>
          ${anos}
        </ul>
      </div>
      <div class="mc-resultado" aria-live="polite">
        <p class="mc-frase"><b class="num">${n.toLocaleString('pt-BR')}</b> ${n === 1 ? 'peça' : 'peças'} para o seu <b>${esc(nome)}</b></p>
        <div class="mc-acoes">
          <a class="botao botao-laranja" href="${esc(linkCatalogo(carro))}">${n === 1 ? 'Ver a peça' : `Ver as ${n.toLocaleString('pt-BR')} peças`}</a>
          <button type="button" class="botao botao-linha" data-acao="trocar" data-chave="trocar">Trocar carro</button>
        </div>
        <p class="mc-nota">Fica salvo só neste aparelho. <button type="button" class="mc-link" data-acao="tirar" data-chave="tirar">Tirar do meu carro</button></p>
      </div>`;
  }

  function corpo(): string {
    if (erro) return `<p class="mc-aviso">Não deu para carregar os carros agora. Tente de novo em instantes ou fale com a gente no WhatsApp.</p>`;
    if (!g) return `<p class="mc-aviso">Carregando os carros…</p>`;
    const passo = etapa === 'marca' || !marca ? passoMarca() : etapa === 'modelo' || !modelo ? passoModelo() : passoPronto();
    return pilulas() + passo;
  }

  function desenhar() {
    const ativo = document.activeElement as HTMLElement | null;
    const chave = ativo && raiz.contains(ativo) ? ativo.dataset.chave : undefined;
    raiz.innerHTML = corpo();
    if (chave) {
      const alvo = Array.from(raiz.querySelectorAll<HTMLElement>('[data-chave]')).find((el) => el.dataset.chave === chave);
      alvo?.focus({ preventScroll: true });
    }
  }

  function carregar() {
    erro = false;
    desenhar();
    carregarGaragem()
      .then((d) => {
        g = d;
        aplicarSalvo();
        desenhar();
      })
      .catch(() => {
        erro = true;
        desenhar();
      });
  }

  raiz.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-acao]');
    if (!b || !g) return;
    const acao = b.dataset.acao;
    if (acao === 'todas') {
      todas = !todas;
    } else if (acao === 'marca') {
      const m = g.marcas.find((x) => x.n === b.dataset.n);
      if (!m) return;
      if (marca?.n !== m.n) { modelo = null; ano = null; }
      marca = m;
      etapa = 'modelo';
    } else if (acao === 'modelo') {
      const mo = marca?.modelos.find((x) => x.n === b.dataset.n);
      if (!mo) return;
      if (modelo?.n !== mo.n) ano = null;
      modelo = mo;
      etapa = 'pronto';
      salvar();
    } else if (acao === 'ano') {
      ano = b.dataset.ano ? Number(b.dataset.ano) : null;
      etapa = 'pronto';
      salvar();
    } else if (acao === 'ir') {
      const alvo = b.dataset.alvo;
      etapa = alvo === 'marca' ? 'marca' : alvo === 'modelo' ? 'modelo' : 'pronto';
    } else if (acao === 'trocar') {
      etapa = 'marca';
    } else if (acao === 'tirar') {
      marca = null; modelo = null; ano = null; etapa = 'marca';
      salvarMeuCarro(null);
    } else {
      return;
    }
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
      if (g) { aplicarSalvo(); desenhar(); } else carregar();
    },
  };
  (raiz as HTMLElement & { _meuCarro?: Handle })._meuCarro = handle;
  carregar();
  return handle;
}
