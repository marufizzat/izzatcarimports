// "A frente por dentro": o PILOTO do 2º nível do Raio-x (uma zona que se abre). Do painel da zona Frente, o botão
// "Ver a frente por dentro" troca a arte do carro pela vista explodida (lib/raioXFrente.ts), no MESMO palco (a mesma
// proporção: nada muda de tamanho). Baixado só no clique do botão (aquecido quando o dedo/mouse encosta nele).
// - Cada peça da arte é um link de verdade, desenhado na forma dela: passar o mouse ou focar acende a forma e mostra o
//   nome e quantas há (do carro salvo, do carro da página ou do estoque); o clique leva ao catálogo filtrado naquele
//   tipo/lado. No toque: o 1º toque acende e mostra o rótulo (que é o link); o 2º vai.
// - Peça sem anúncio (ou o capô, que o estoque não tem como tipo): cinza, e o link é o WhatsApp "a gente procura no
//   pátio" (data-botao="raio-x", o mesmo do painel das zonas).
// - Os números da arte são os da lista do painel (os mesmos links, um alvo fácil para o dedo).
// - "Voltar ao carro" (na arte e no painel) e Esc devolvem a arte do carro e o foco ao botão que abriu.
// A troca usa a View Transition do navegador quando existe (zoom a partir da frente do carro); sem ela, ou com
// "reduzir movimento"/aparelho fraco, troca na hora.
import css from './raioXPorDentro.css?inline';
import { PONTOS_QUENTES, ARTE_FRENTE, ARTE_FRENTE_900, contarQuentes, type PontoQuente } from '../../lib/raioXFrente';
import { linkLinha, qtdPecas, type CarroFiltro } from '../../lib/raioX';
import { linkProcuraPeca } from '../../lib/aviso';
import type { Filtros, Item } from '../../lib/busca';

export const ARQUIVO_FRENTE = '/dados/raio-x-frente.json';
type Procurar = (f: Filtros) => Item[];
export type CtxDentro = {
  raiz: HTMLElement; palco: HTMLElement; painel: HTMLElement; conteudo: HTMLElement; dica: HTMLElement; fichas: HTMLElement;
  home: boolean;
  carro(): Promise<{ procurar: Procurar | null; filtro: CarroFiltro; aviso: string }>;
  /** o carro na mensagem ("Volvo XC60 2019"; página do carro sem carro salvo: "Volvo XC60"; '' = sem carro) e se é o salvo */
  carroMsg(ano?: number): { nome: string; meu: boolean };
  doCarro(f: CarroFiltro): string;
  /** o sizes da arte no palco (o mesmo da arte do carro) */
  sizes: string;
  /** depois de voltar ao carro: o Raio-x repõe o painel da zona */
  aoVoltar(): void;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pct = (v: number, t: number) => `${((v / t) * 100).toFixed(2)}%`;
const SETA = '<svg class="rxf-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const VOLTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const pausa = () => (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield?.() ?? new Promise<void>((ok) => setTimeout(ok, 0));
const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('leve');

let estilo = false;
function porEstilo() {
  if (estilo) return;
  estilo = true;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
}

/** A arte, baixada e decodificada antes da troca (a transição nunca mostra a imagem pela metade). */
let arte: Promise<HTMLImageElement> | null = null;
export function aquecerArte(sizes: string): Promise<HTMLImageElement> {
  arte ??= new Promise<HTMLImageElement>((ok, falha) => {
    const img = new Image();
    img.className = 'rxf-img';
    img.alt = '';
    img.width = ARTE_FRENTE.w;
    img.height = ARTE_FRENTE.h;
    img.decoding = 'async';
    img.sizes = sizes;
    img.srcset = `${ARTE_FRENTE_900} 900w, ${ARTE_FRENTE.src} ${ARTE_FRENTE.w}w`;
    img.src = ARTE_FRENTE.src;
    const pronto = () => (img.decode ? img.decode().then(() => ok(img), () => ok(img)) : ok(img));
    if (img.complete && img.naturalWidth) pronto();
    else { img.onload = pronto; img.onerror = () => { arte = null; falha(new Error('arte')); }; }
  });
  return arte;
}

export function ligarPorDentro(ctx: CtxDentro) {
  porEstilo();
  const { raiz, palco, painel, conteudo, dica, fichas } = ctx;
  let camada: HTMLElement | null = null;
  let rotulo: HTMLAnchorElement | null = null;
  let ligado = false;
  let escolhido: string | null = null;
  let passando: string | null = null;
  let ultimoPonteiro = 'mouse';
  let quemAbriu: HTMLElement | null = null;
  let vez = 0;
  // o que vale agora: quantas de cada ponto (null = contando), o filtro do carro e o nome dele nas frases
  let contas: Record<string, number> | null = null;
  let filtro: CarroFiltro = {};
  let aviso = '';
  let doCarro = '';
  const quente = (k: string) => PONTOS_QUENTES.find((p) => p.k === k)!;

  // ---- o link e o texto de cada ponto ----
  function destino(p: PontoQuente): { href: string; fora: boolean } {
    const n = contas?.[p.k];
    // sem tipo (o capô) ou sem peça: o WhatsApp "a gente procura no pátio"; contando ainda: o catálogo (sempre vale)
    if (!p.tipo || !p.sub || n === 0) {
      const c = ctx.carroMsg(filtro.ano);
      return { href: linkProcuraPeca(p.procuro, c.nome, c.meu), fora: true };
    }
    return { href: linkLinha({ tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos }, filtro), fora: false };
  }
  const quantas = (p: PontoQuente) => {
    const n = contas?.[p.k];
    return n === undefined ? '' : n > 0 ? qtdPecas(n) : 'a gente procura no pátio';
  };
  const rotuloAria = (p: PontoQuente) => {
    const n = contas?.[p.k];
    if (n === undefined) return p.nome;
    return n > 0 ? `${p.nome}: ${qtdPecas(n)}${doCarro ? ` ${doCarro}` : ' no estoque'}` : `${p.nome}: sem anúncio agora, a gente procura no pátio (WhatsApp)`;
  };
  function atributos(a: Element, p: PontoQuente) {
    const d = destino(p);
    a.setAttribute('href', d.href);
    if (d.fora) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); a.setAttribute('data-botao', 'raio-x'); }
    else { a.removeAttribute('target'); a.removeAttribute('rel'); a.removeAttribute('data-botao'); }
    a.classList.toggle('vazio', contas?.[p.k] === 0 || !p.tipo);
  }

  function montarCamada(img: HTMLImageElement) {
    camada = document.createElement('div');
    camada.className = 'rxf';
    camada.setAttribute('role', 'group');
    camada.setAttribute('aria-label', 'A frente por dentro: toque numa peça');
    camada.innerHTML = `<button type="button" class="rxf-voltar" data-voltar>${VOLTA}Voltar ao carro</button>`
      + `<svg class="rxf-mapa" viewBox="0 0 ${ARTE_FRENTE.w} ${ARTE_FRENTE.h}">`
      + PONTOS_QUENTES.map((p) => `<a data-q="${p.k}" aria-label="${esc(p.nome)}">${p.poligonos.map((f) => `<polygon class="rxf-forma" points="${f}"/>`).join('')}</a>`).join('')
      + '</svg>'
      + PONTOS_QUENTES.map((p, i) => `<span class="rxf-num num" data-q="${p.k}" aria-hidden="true" style="left:${pct(p.ancora[0], ARTE_FRENTE.w)};top:${pct(p.ancora[1], ARTE_FRENTE.h)}">${i + 1}</span>`).join('')
      + '<a class="rxf-rotulo" tabindex="-1" aria-hidden="true" hidden></a>';
    camada.prepend(img);
    palco.appendChild(camada);
    rotulo = camada.querySelector<HTMLAnchorElement>('.rxf-rotulo');
    // no lugar das fichas: a instrução e, na arte estreita (onde o botão por cima da arte taparia peças), o "Voltar"
    const fila = document.createElement('div');
    fila.className = 'rxf-fila';
    fila.innerHTML = `<button type="button" class="rxf-voltar rxf-voltar-fila" data-voltar>${VOLTA}Voltar ao carro</button>`
      + '<p class="rxf-legenda">Toque numa peça<span>, na imagem ou na lista: o catálogo abre só com aquele tipo</span>.</p>';
    fichas.appendChild(fila);
    fila.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-voltar]')) sair(true); });

    camada.addEventListener('pointerdown', (e) => { ultimoPonteiro = e.pointerType || 'mouse'; }, true);
    camada.addEventListener('click', (e) => {
      const alvo = e.target as Element;
      if (alvo.closest('[data-voltar]')) { sair(true); return; }
      const a = alvo.closest<SVGAElement>('a[data-q]');
      if (!a) { if (!alvo.closest('.rxf-rotulo')) escolher(null); return; }
      const k = a.dataset.q!;
      // dedo: o 1º toque acende a peça e mostra o rótulo (o link); o 2º vai. Mouse e teclado vão direto.
      if ((ultimoPonteiro === 'touch' || ultimoPonteiro === 'pen') && (e as MouseEvent).detail !== 0 && escolhido !== k) {
        e.preventDefault();
        escolher(k);
      }
    });
    camada.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const a = (e.target as Element).closest<HTMLElement>('a[data-q]');
      passar(a ? a.dataset.q! : null);
    });
    camada.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') passar(null); });
    camada.addEventListener('focusin', (e) => {
      const a = (e.target as Element).closest<HTMLElement>('a[data-q]');
      if (a) passar(a.dataset.q!);
    });
    camada.addEventListener('focusout', () => passar(null));
  }

  // ---- a peça acesa (mouse em cima, foco, ou a escolhida no toque): a forma, o número, a linha da lista e o rótulo ----
  function acender() {
    const luz = passando ?? escolhido;
    for (const el of raiz.querySelectorAll<HTMLElement>('.rxf [data-q], .rxf-lista [data-q]')) el.classList.toggle('aceso', el.dataset.q === luz);
    if (!rotulo || !camada) return;
    if (!luz) { rotulo.hidden = true; return; }
    const p = quente(luz);
    const q = quantas(p);
    rotulo.innerHTML = `<b>${esc(p.nome)}</b>${q ? `<span class="num">${esc(q)}</span>` : ''}${SETA}`;
    atributos(rotulo, p);
    rotulo.hidden = false;
    // em cima do número; perto da borda de cima, embaixo; sem sair pelos lados (medido depois de escrito, num quadro só)
    const W = camada.clientWidth, H = camada.clientHeight;
    const x = (p.ancora[0] / ARTE_FRENTE.w) * W, y = (p.ancora[1] / ARTE_FRENTE.h) * H;
    const w = rotulo.offsetWidth, h = rotulo.offsetHeight;
    const esq = Math.max(6, Math.min(W - w - 6, x - w / 2));
    const emCima = y - h - 18 >= 6;
    rotulo.style.left = `${esq}px`;
    rotulo.style.top = `${emCima ? y - h - 18 : Math.min(H - h - 6, y + 18)}px`;
  }
  function escolher(k: string | null) { escolhido = k; acender(); }
  function passar(k: string | null) { if (passando !== k) { passando = k; acender(); } }

  // ---- as contas: do carro (o salvo ou o da página) ou do estoque inteiro ----
  async function contar() {
    const minha = ++vez;
    contas = null;
    try {
      const c = await ctx.carro();
      if (minha !== vez) return;
      aviso = c.aviso;
      if (c.procurar && c.filtro.modelo) {
        filtro = c.filtro;
        doCarro = ctx.doCarro(filtro);
        // uma peça por vez, devolvendo a vez ao navegador (15 buscas de uma vez davam uma tarefa de ~60 ms com CPU 6×)
        const n: Record<string, number> = {};
        for (const p of PONTOS_QUENTES) {
          Object.assign(n, contarQuentes(c.procurar, filtro, [p]));
          await pausa();
          if (minha !== vez) return;
        }
        contas = n;
      } else {
        filtro = {};
        doCarro = '';
        const r = await fetch(ARQUIVO_FRENTE);
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json() as { n: Record<string, number> };
        if (minha !== vez) return;
        contas = j.n;
      }
    } catch {
      if (minha !== vez) return;
      // sem conexão: os links do catálogo continuam valendo, só sem o número
      contas = null;
      aviso = 'Sem conexão para contar as peças agora: os links abrem o catálogo de cada tipo.';
    }
    if (ligado) { pintarLinks(); pintarPainel(false); acender(); }
  }

  function pintarLinks() {
    if (!camada) return;
    for (const a of camada.querySelectorAll<SVGAElement>('a[data-q]')) {
      const p = quente(a.dataset.q!);
      atributos(a, p);
      a.setAttribute('aria-label', rotuloAria(p));
    }
    for (const n of camada.querySelectorAll<HTMLElement>('.rxf-num')) n.classList.toggle('vazio', contas?.[n.dataset.q!] === 0 || !quente(n.dataset.q!).tipo);
  }

  function pintarPainel(focar: boolean) {
    const tem = contas ? PONTOS_QUENTES.filter((p) => (contas![p.k] ?? 0) > 0).length : 0;
    const sub = !contas ? (aviso ? '' : 'Contando as peças…')
      : `${doCarro ? `${esc(doCarro)}` : 'no estoque inteiro'} · ${tem} de ${PONTOS_QUENTES.length} peças com anúncio agora`;
    const itens = PONTOS_QUENTES.map((p, i) => {
      const d = destino(p);
      const n = contas?.[p.k];
      const vazio = n === 0 || !p.tipo;
      const fim = n === undefined && p.tipo ? '' : vazio ? '<span class="rxf-i-patio">a gente procura</span>' : `<span class="rxf-i-n num">${n}<span class="sr-only"> ${n === 1 ? 'peça' : 'peças'}</span></span>`;
      return `<li><a class="rxf-item${vazio ? ' vazio' : ''}" data-q="${p.k}" href="${esc(d.href)}"${d.fora ? ' target="_blank" rel="noopener" data-botao="raio-x"' : ''}>`
        + `<i class="num" aria-hidden="true">${i + 1}</i><span class="rxf-i-nome">${esc(p.nome)}</span>${fim}${SETA}</a></li>`;
    }).join('');
    // as contas chegam e a lista é refeita: o foco fica onde estava (o título, a mesma linha ou o "Voltar")
    const ativo = !focar && document.activeElement instanceof HTMLElement && conteudo.contains(document.activeElement) ? document.activeElement : null;
    const foco = ativo ? (ativo.dataset.q ? `[data-q="${ativo.dataset.q}"]` : ativo.matches('.rx-p-titulo') ? '.rx-p-titulo' : '.rxf-voltar2') : '';
    conteudo.innerHTML = `<div class="rxf-painel"><div class="rx-p-cabeca"><h3 class="rx-p-titulo" tabindex="-1">A frente por dentro</h3><p class="rx-p-sub">${sub || '&nbsp;'}</p></div>`
      + (aviso ? `<p class="rx-p-aviso">${esc(aviso)}</p>` : '')
      + `<ol class="rxf-lista">${itens}</ol>`
      + `<div class="rxf-pe"><button type="button" class="botao botao-linha rxf-voltar2" data-voltar>${VOLTA}Voltar ao carro</button>`
      + '<p class="rxf-nota">Arte ilustrativa de um SUV: a forma de cada peça muda de carro para carro.</p></div></div>';
    dica.hidden = true;
    conteudo.hidden = false;
    painel.classList.add('aberto');
    if (focar) conteudo.querySelector<HTMLElement>('.rx-p-titulo')?.focus({ preventScroll: true });
    else if (foco) conteudo.querySelector<HTMLElement>(foco)?.focus({ preventScroll: true });
  }

  const noPainel = (e: Event) => {
    if (!ligado) return;
    if ((e.target as Element).closest('[data-voltar]')) sair(true);
  };
  const sobreLista = (e: Event) => {
    if (!ligado) return;
    const a = (e.target as Element).closest<HTMLElement>('.rxf-item');
    passar(e.type === 'pointerover' || e.type === 'focusin' ? a?.dataset.q ?? null : null);
  };
  conteudo.addEventListener('click', noPainel);
  for (const t of ['pointerover', 'focusin', 'pointerleave', 'focusout']) conteudo.addEventListener(t, sobreLista);

  // ---- a troca de arte ----
  function trocar(entrando: boolean, muda: () => void) {
    type Doc = Document & { startViewTransition?: (f: () => void) => { finished: Promise<void> } };
    const doc = document as Doc;
    if (calmo() || !doc.startViewTransition) { muda(); return; }
    const html = document.documentElement;
    palco.style.setProperty('view-transition-name', 'rx-palco');
    html.classList.add('rxf-troca');
    html.classList.toggle('rxf-volta', !entrando);
    const fim = () => { palco.style.removeProperty('view-transition-name'); html.classList.remove('rxf-troca', 'rxf-volta'); };
    try { doc.startViewTransition(muda).finished.then(fim, fim); } catch { fim(); muda(); }
  }

  async function abrir(botao: HTMLElement | null) {
    if (ligado) return;
    quemAbriu = botao;
    botao?.setAttribute('aria-busy', 'true');
    let img: HTMLImageElement;
    try { img = await aquecerArte(ctx.sizes); } catch { botao?.removeAttribute('aria-busy'); return false; }
    botao?.removeAttribute('aria-busy');
    if (!camada) montarCamada(img);
    ligado = true;
    escolhido = null;
    passando = null;
    trocar(true, () => {
      raiz.dataset.vista = 'frente';
      pintarLinks();
      pintarPainel(true);
      acender();
    });
    void contar();
    return true;
  }

  /** Volta à arte do carro. `naHora`: sem a animação (a pessoa trocou de modo com a vista aberta). */
  function sair(focar: boolean, naHora = false) {
    if (!ligado) return;
    ligado = false;
    vez++;
    escolhido = null;
    passando = null;
    (naHora ? (_e: boolean, f: () => void) => f() : trocar)(false, () => {
      raiz.dataset.vista = 'achar';
      acender();
      ctx.aoVoltar();
      if (focar) {
        // o botão que abriu foi refeito com o painel da zona: o foco volta ao novo
        const b = raiz.querySelector<HTMLElement>('[data-rx-dentro]') ?? quemAbriu;
        b?.focus({ preventScroll: true });
      }
    });
  }

  return {
    abrir, sair,
    get ligado() { return ligado; },
    /** o carro mudou com a vista aberta: as contas e os links acompanham */
    trocouCarro: () => { if (ligado) { pintarPainel(false); void contar(); } },
  };
}
export type PorDentro = ReturnType<typeof ligarPorDentro>;
