// Página do carro (rodada 15, cliente oculto 2, atrito 8): as peças agrupadas por FAMÍLIA (os blocos da loja: Motor,
// Faróis e Lanternas…), com uma barra de fichas presa sob o cabeçalho que pula para cada grupo, e as fichas de ano no
// topo, que filtram a página e SALVAM o "Meu carro" (com "Desfazer").
//
// O que vem pronto no HTML (pages/carros/[k].astro): os grupos de "Todos os anos", os primeiros com os cartões (o resto
// só com o título e o "Ver as N": o HTML não cresce) e a barra. Aqui, no navegador:
//  - os grupos sem cartão são preenchidos de /dados/carro/<k>.json quando o navegador folga (lugar guardado: nada pula);
//  - escolher um ano monta a vista do ano do mesmo arquivo (só as famílias com peça naquele ano, pela contagem), um grupo
//    por tarefa: nenhum quadro longo;
//  - a ficha ativa da barra acompanha a rolagem.
// As funções puras (chaveGrupo, agrupar, textoSalvo) são usadas também no build e testadas em carroPagina.test.ts.
import { lerMeuCarro, salvarMeuCarro, norm, anosNoModelo, serveNoModelo, lerModelos, EVENTO, type MeuCarro } from './meuCarro';
import { rolarFila } from './anosFila';
import type { Item, Indice } from './busca';

/** Cartões por grupo: 8 no HTML; o CSS mostra 4 no celular (2 fileiras de 2: um grupo por tela), 6 no tablet (2 de 3) e
 *  8 no PC (2 de 4). */
export const POR_GRUPO = 8;
export const POR_GRUPO_ESTREITO = 6;
export const POR_GRUPO_CELULAR = 4;
/** Carro com menos peças que isto não agrupa (a grade simples, como antes): seriam títulos demais para poucas peças. */
export const AGRUPAR_A_PARTIR_DE = 20;
/** Quantos cartões vão prontos no HTML do carro grande (o resto chega do arquivo do carro): o peso da página não sobe. */
export const CARTOES_NO_HTML = 40;
export const OUTROS = 'Outros';

/** "Faróis e Lanternas" -> "g-farois-e-lanternas" (a âncora do grupo; a mesma conta no build e no navegador). */
export function chaveGrupo(nome: string): string {
  return `g-${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
/** O nome do grupo na tela: o bloco; "Outros" vira "Outras peças". */
export const nomeGrupo = (c: string) => (c && c !== OUTROS ? c : 'Outras peças');

export type Grupo<T> = { c: string; itens: T[] };
/** As peças por família: as famílias com mais peças primeiro (empate: a ordem da loja, `ordem`), "Outros" por último;
 *  dentro de cada uma, as mais novas primeiro (o id do anúncio cresce com o tempo). */
export function agrupar<T extends { c: string; id: string }>(itens: readonly T[], ordem: readonly string[] = []): Grupo<T>[] {
  const m = new Map<string, T[]>();
  for (const it of itens) {
    const c = it.c || OUTROS;
    const l = m.get(c);
    if (l) l.push(it); else m.set(c, [it]);
  }
  const pos = (c: string) => { const i = ordem.indexOf(c); return i < 0 ? 999 : i; };
  const novo = (a: T, b: T) => (a.id.length !== b.id.length ? b.id.length - a.id.length : b.id > a.id ? 1 : b.id < a.id ? -1 : 0);
  return [...m].map(([c, l]) => ({ c, itens: [...l].sort(novo) }))
    .sort((a, b) => (a.c === OUTROS ? 1 : 0) - (b.c === OUTROS ? 1 : 0) || b.itens.length - a.itens.length || pos(a.c) - pos(b.c) || a.c.localeCompare(b.c, 'pt-BR'));
}
/** Quantos cartões cada grupo leva no HTML: os grupos inteiros (até POR_GRUPO cada), na ordem, enquanto couber em `teto`
 *  (o 1º sempre entra). 0 = só o título e o "Ver as N" (os cartões chegam no navegador). */
export function cartoesNoHtml(tamanhos: readonly number[], teto: number): number[] {
  let soma = 0;
  return tamanhos.map((n, i) => {
    const q = Math.min(n, POR_GRUPO);
    if (i > 0 && soma + q > teto) { soma = teto; return 0; }
    soma += q;
    return q;
  });
}
/** "Ver as 82 de Motor" / "Ver as 2 de Rodas"; com o ano: "Ver as 14 de Faróis e Lanternas". */
export const textoMais = (n: number, c: string) => `Ver as ${n.toLocaleString('pt-BR')} de ${nomeGrupo(c)}`;
/** O aviso depois de escolher o ano: "Salvo como seu carro" ou, se havia outro carro salvo, "Salvo no lugar do Onix 2015". */
export function textoSalvo(antes: MeuCarro | null, b: string, m: string): string {
  if (!antes || (norm(antes.b) === norm(b) && norm(antes.m) === norm(m))) return 'Salvo como seu carro';
  return `Salvo no lugar do ${antes.m}${antes.y ? ` ${antes.y}` : ''}`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** O "Ver as N" só aparece onde o grupo tem mais peças do que os cartões à vista (classe por largura de tela). */
export const classeMais = (total: number) => (total > POR_GRUPO ? '' : total > POR_GRUPO_ESTREITO ? ' gp-mais-estreito' : ' gp-mais-celular');
/** O HTML de um grupo (o MESMO desenho do que vem pronto do build, em pages/carros/[k].astro). */
export function htmlGrupo(c: string, total: number, cartoes: string, hrefMais: string): string {
  const k = chaveGrupo(c), nome = esc(nomeGrupo(c));
  const mais = total > POR_GRUPO_CELULAR
    ? `<a class="gp-mais${classeMais(total)}" href="${esc(hrefMais)}">${esc(textoMais(total, c))}</a>` : '';
  return `<section class="gp-grupo" id="${k}" data-c="${esc(c)}" aria-labelledby="${k}-t"><h3 class="gp-titulo" id="${k}-t">${nome} <span class="num">${total.toLocaleString('pt-BR')}</span></h3>`
    + `<div class="gp-grade">${cartoes}</div>${mais}</section>`;
}
/** Uma ficha da barra. */
export const htmlFicha = (c: string, n: number) =>
  `<a class="gp-ficha" href="#${chaveGrupo(c)}">${esc(nomeGrupo(c))} <small class="num">${n.toLocaleString('pt-BR')}</small></a>`;

const pausa = () => new Promise<void>((r) => setTimeout(r, 0));
const folga = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(() => fn(), { timeout: 1500 }) : setTimeout(fn, 200));

/** Liga a página do carro. Sem as fichas de ano e sem os grupos (carro pequeno de um ano só), não faz nada. */
export function iniciarPaginaCarro() {
  const raiz = document.querySelector<HTMLElement>('[data-anos-carro]');
  const secao = document.querySelector<HTMLElement>('#pecas');
  if (!secao) return;
  const zona = secao.querySelector<HTMLElement>('[data-gp]');
  const dadosEm = secao.dataset.dados || '';
  const B = secao.dataset.b || '', M = secao.dataset.m || '', base = secao.dataset.base || '/catalogo.html';
  const total = Number(secao.dataset.n || 0);
  const ordem: string[] = (secao.dataset.ordem || '').split('|').filter(Boolean);
  const eh = (c: MeuCarro | null): c is MeuCarro => !!c && norm(c.b) === norm(B) && norm(c.m) === norm(M);
  const nf = new Intl.NumberFormat('pt-BR');
  const pecasTxt = (x: number) => `${nf.format(x)} ${x === 1 ? 'peça' : 'peças'}`;

  // ---------- o que muda de texto com o ano ----------
  const num = secao.querySelector<HTMLElement>('.grade-cabeca .num');
  const numOrig = num?.textContent ?? '';
  const mais = secao.querySelector<HTMLAnchorElement>('.grade-mais a');
  const maisOrig = mais ? { href: mais.getAttribute('href') || base, txt: mais.textContent || '' } : null;
  const verTodas = document.querySelector<HTMLAnchorElement>('[data-ver-todas]');
  const verOrig = verTodas ? { href: verTodas.getAttribute('href') || base, txt: verTodas.textContent || '' } : null;
  const textos = (y: number | null, n: number) => {
    if (num) num.textContent = y == null ? numOrig : `${pecasTxt(n)} para o ${M} ${y}`;
    if (mais && maisOrig) {
      mais.href = y == null ? maisOrig.href : `${base}&ano=${y}`;
      mais.textContent = y == null ? maisOrig.txt : n === 1 ? `Ver a peça do ${M} ${y} no catálogo` : `Ver as ${pecasTxt(n)} do ${M} ${y} no catálogo`;
    }
    if (verTodas && verOrig) {
      // o botão do topo leva o ano (com até 48 peças ele só desce até a grade)
      verTodas.href = y == null || verOrig.href.startsWith('#') ? verOrig.href : `${base}&ano=${y}`;
      verTodas.textContent = y == null ? verOrig.txt : n === 1 ? `Ver a peça de ${y}` : `Ver as ${pecasTxt(n)} de ${y}`;
    }
  };

  // ---------- a lista "Todas as N peças" (em texto, no fim): só as do ano, em fatias de ~6 ms ----------
  const todas = secao.querySelector<HTMLElement>('.todas-pecas');
  const sumario = todas?.querySelector('summary') ?? null;
  const sumarioOrig = sumario?.textContent ?? '';
  let linhasLista: { g: HTMLElement; c: HTMLElement | null; linhas: [HTMLElement, string][] }[] | null = null;
  let vezLista = 0;
  const filtrarLista = (y: number | null, enderecos: Set<string> | null) => {
    if (!todas) return;
    const vez = ++vezLista;
    setTimeout(() => {
      linhasLista ??= [...todas.querySelectorAll<HTMLElement>('.todas-pecas-grupo')].map((g) => ({
        g, c: g.querySelector<HTMLElement>('.todas-pecas-n'),
        linhas: [...g.querySelectorAll<HTMLElement>('li')].map((li) => [li, li.querySelector('a')?.getAttribute('href') || ''] as [HTMLElement, string]),
      }));
      let i = 0, n = 0;
      const fatia = () => {
        if (vez !== vezLista) return;
        const t0 = performance.now();
        for (; i < linhasLista!.length && performance.now() - t0 < 6; i++) {
          const { g, c, linhas } = linhasLista![i];
          let k = 0;
          for (const [li, h] of linhas) {
            const ok = !enderecos || enderecos.has(h);
            if (li.hidden === ok) li.hidden = !ok;
            if (ok) k++;
          }
          if (g.hidden !== (k === 0)) g.hidden = k === 0;
          if (c) c.textContent = `(${nf.format(k)})`;
          n += k;
        }
        if (i < linhasLista!.length) { setTimeout(fatia, 0); return; }
        if (sumario) sumario.textContent = y == null || !enderecos ? sumarioOrig : n === 1 ? `A peça do ${B} ${M} ${y}` : `Todas as ${pecasTxt(n)} do ${B} ${M} ${y}`;
      };
      fatia();
    }, 0);
  };

  // ---------- as peças do carro (o arquivo só dele, o mesmo formato do índice da busca) ----------
  let pedido: Promise<Item[]> | null = null;
  const itensDoCarro = () => (pedido ??= (async () => {
    const [{ Busca }, r] = await Promise.all([import('./busca'), fetch(dadosEm)]);
    if (!r.ok) throw new Error(String(r.status));
    return new Busca((await r.json()) as Indice).itens.filter((it) => norm(it.b) === norm(B) && serveNoModelo(it, M));
  })().catch((e) => { pedido = null; throw e; }));
  const cartoesDe = async () => {
    const [{ cartaoHtml, vigiarFotos }, { SIZES_CARTAO }] = await Promise.all([import('./vendidaCartoes'), import('./busca')]);
    return { cartao: (it: Item) => cartaoHtml(it, SIZES_CARTAO.grade), vigiarFotos };
  };
  const serveNoAno = (it: { y?: [number, number] | null; ms?: string[] | null; ys?: ([number, number] | null)[] | null }, y: number) => {
    const f = anosNoModelo(it, M);
    return !!f && y >= f[0] && y <= f[1];
  };

  // ---------- a barra de fichas: pula para o grupo e acompanha a rolagem ----------
  const barra = secao.querySelector<HTMLElement>('.gp-barra');
  const fila = barra?.querySelector<HTMLElement>('.gp-fila') ?? null;
  const filaOrig = fila?.innerHTML ?? '';
  const estatico = zona?.querySelector<HTMLElement>('.gp-estatico') ?? null;
  let doAno: HTMLElement | null = null;
  const vista = () => (doAno && !doAno.hidden ? doAno : estatico);
  let fichaAtiva: HTMLElement | null = null;
  const ativar = (id: string | null) => {
    const f = id ? fila?.querySelector<HTMLElement>(`a[href="#${id}"]`) ?? null : null;
    if (f === fichaAtiva) return;
    fichaAtiva?.removeAttribute('aria-current');
    fichaAtiva = f;
    if (!f || !fila) return;
    f.setAttribute('aria-current', 'true');
    // a ficha ativa fica à vista na fila (só o scrollLeft da fila; a página não se mexe)
    const a = f.offsetLeft - 16, b = f.offsetLeft + f.offsetWidth + 16 - fila.clientWidth;
    if (fila.scrollLeft > a) fila.scrollLeft = Math.max(0, a);
    else if (fila.scrollLeft < b) fila.scrollLeft = b;
  };
  let quadro = 0;
  const acompanhar = () => {
    quadro = 0;
    const v = vista();
    if (!barra || !v) return;
    const linha = barra.getBoundingClientRect().bottom + 24;
    let atual: string | null = null;
    for (const g of v.children) {
      if ((g as HTMLElement).hidden) continue;
      if (g.getBoundingClientRect().top <= linha) atual = g.id; else break;
    }
    ativar(atual ?? v.firstElementChild?.id ?? null);
  };
  const pedirAcompanhar = () => { if (!quadro) quadro = requestAnimationFrame(acompanhar); };
  if (barra && fila) {
    window.addEventListener('scroll', pedirAcompanhar, { passive: true });
    window.addEventListener('resize', pedirAcompanhar, { passive: true });
    fila.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.gp-ficha');
      // o grupo da vista que está na tela (a de todos os anos e a do ano têm grupos com a mesma âncora)
      const alvo = a ? vista()?.querySelector<HTMLElement>(`#${CSS.escape(a.hash.slice(1))}`) ?? null : null;
      if (!a || !alvo) return;
      e.preventDefault();
      const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
      // o CSS (scroll-margin-top do grupo) já desconta o cabeçalho e a barra
      alvo.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'start' });
      ativar(alvo.id);
      // o foco segue (teclado e leitor de tela), sem rolar de novo
      const t = alvo.querySelector<HTMLElement>('.gp-titulo');
      if (t) { t.tabIndex = -1; t.focus({ preventScroll: true }); }
    });
    acompanhar();
  }

  // ---------- "Todos os anos": os grupos que vieram só com o título ganham os cartões quando o navegador folga ----------
  let preenchido = false;
  async function preencher() {
    if (preenchido || !estatico || !dadosEm) return;
    const vazios = [...estatico.querySelectorAll<HTMLElement>('.gp-grade[data-espera]')];
    if (!vazios.length) { preenchido = true; return; }
    try {
      const [itens, { cartao, vigiarFotos }] = await Promise.all([itensDoCarro(), cartoesDe()]);
      preenchido = true;
      vigiarFotos(estatico);
      const porFam = new Map(agrupar(itens, ordem).map((g) => [g.c, g.itens]));
      for (const grade of vazios) {
        const l = porFam.get(grade.closest<HTMLElement>('.gp-grupo')?.dataset.c || '') ?? [];
        grade.innerHTML = l.slice(0, POR_GRUPO).map(cartao).join('');
        grade.removeAttribute('data-espera');
        await pausa();   // um grupo por tarefa
      }
    } catch { /* sem rede: ficam o título e o "Ver as N" (o catálogo mostra) */ }
  }
  if (estatico?.querySelector('.gp-grade[data-espera]')) {
    const ir = () => folga(() => void preencher());
    if (document.readyState === 'complete') ir(); else window.addEventListener('load', ir, { once: true });
  }

  // ---------- a vista do ano ----------
  let ano: number | null = null;
  /** carro pequeno (grade simples) ou enquanto o arquivo desce: os cartões de outro ano saem da grade que já está na tela */
  const filtrarProntos = (y: number | null) => {
    let n = 0;
    secao.querySelectorAll<HTMLElement>('.gp-estatico a.etiqueta[data-b], .grade-pecas a.etiqueta[data-b]').forEach((a) => {
      const d = a.dataset;
      const ok = y == null || serveNoAno({ y: d.a0 ? [Number(d.a0), Number(d.a1)] : null, ...lerModelos(d.ms, d.ys) }, y);
      if (ok) n++;
      (a.closest<HTMLElement>('.etiqueta-cx') ?? a).classList.toggle('fora-do-ano', !ok);
    });
    return n;
  };
  async function verAno(y: number) {
    if (!zona || !estatico || !dadosEm) { filtrarProntos(y); return; }
    try {
      const [itens, { cartao, vigiarFotos }] = await Promise.all([itensDoCarro(), cartoesDe()]);
      if (ano !== y) return;   // trocou de ano enquanto o arquivo descia
      const grupos = agrupar(itens.filter((it) => serveNoAno(it, y)), ordem);
      const n = grupos.reduce((s, g) => s + g.itens.length, 0);
      if (!doAno) {
        doAno = document.createElement('div');
        doAno.className = 'gp-ano';
        estatico.after(doAno);
        vigiarFotos(doAno);
      }
      const caixa = doAno;
      const grupoHtml = (g: Grupo<Item>) => htmlGrupo(g.c, g.itens.length, g.itens.slice(0, POR_GRUPO).map(cartao).join(''), `${base}&ano=${y}&tipo=${encodeURIComponent(g.c)}`);
      // o 1º grupo e a barra já; o resto, um grupo por tarefa (nenhum quadro passa de 50 ms num celular lento)
      caixa.innerHTML = grupos.length ? grupoHtml(grupos[0]) : '';
      if (fila) fila.innerHTML = grupos.map((g) => htmlFicha(g.c, g.itens.length)).join('');
      fichaAtiva = null;
      estatico.hidden = true;
      caixa.hidden = false;
      filtrarProntos(null);
      textos(y, n);
      for (let i = 1; i < grupos.length; i++) {
        await pausa();
        if (ano !== y) return;
        caixa.insertAdjacentHTML('beforeend', grupoHtml(grupos[i]));
      }
      pedirAcompanhar();
      filtrarLista(y, new Set(itens.filter((it) => serveNoAno(it, y)).map((it) => `/peca/${it.h}.html`)));
    } catch { /* sem rede: fica a vista de todos os anos com os cartões do ano (filtrarProntos) */ }
  }
  function verTodos() {
    if (doAno) doAno.hidden = true;
    if (estatico) estatico.hidden = false;
    if (fila && fila.innerHTML !== filaOrig) { fila.innerHTML = filaOrig; fichaAtiva = null; }
    filtrarProntos(null);
    textos(null, total);
    filtrarLista(null, null);
    pedirAcompanhar();
  }

  if (!raiz) return;
  // ---------- as fichas de ano ----------
  const lista = raiz.querySelector<HTMLElement>('.ac-lista')!;
  const trilho = raiz.querySelector<HTMLElement>('.ac-trilho')!;
  const chips = [...raiz.querySelectorAll<HTMLButtonElement>('.ac-ano')];
  const todosChip = chips.find((c) => !c.dataset.y) ?? null;
  const anosChips = chips.filter((c) => c.dataset.y);
  const aviso = raiz.querySelector<HTMLElement>('[data-ac-salvo]');
  const arte = { a: raiz.dataset.a, as: raiz.dataset.as ? raiz.dataset.as.split(',').map(Number) : undefined };

  function escolher(y: number | null) {
    ano = y;
    const chip = chips.find((c) => (c.dataset.y ? Number(c.dataset.y) : null) === y);
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    if (y == null) { verTodos(); return; }
    // já: os cartões de outro ano saem do que está na tela e os textos mudam; a vista do ano chega em seguida
    filtrarProntos(y);
    textos(y, chip?.dataset.c ? Number(chip.dataset.c) : 0);
    setTimeout(() => { if (ano === y) void verAno(y); }, 0);
  }
  // a ficha escolhida vai para o meio da parte da fila à direita do "Todos" (nunca cortada, nunca atrás dele)
  const centrar = (y: number, suave = false) => {
    const chip = anosChips.find((c) => c.dataset.y === String(y));
    if (chip) rolarFila(lista, todosChip, anosChips, anosChips.map((c) => Number(c.dataset.c)), chip, suave);
  };
  const bordas = () => {
    const fim = lista.scrollWidth - lista.clientWidth;
    trilho.toggleAttribute('data-esq', lista.scrollLeft > 4);
    trilho.toggleAttribute('data-dir', lista.scrollLeft < fim - 4);
  };
  lista.addEventListener('scroll', bordas, { passive: true });
  window.addEventListener('resize', bordas, { passive: true });

  /** "Salvo como seu carro · Desfazer": o desfazer devolve o carro salvo de antes (ou nenhum) e o ano que estava na página. */
  let desfazer: (() => void) | null = null;
  const avisar = (txt: string, comDesfazer: boolean) => {
    if (!aviso) return;
    aviso.textContent = '';
    if (!txt) return;
    aviso.append(Object.assign(document.createElement('span'), { textContent: txt }));
    if (comDesfazer) {
      aviso.append(' · ', Object.assign(document.createElement('button'), { type: 'button', className: 'ac-desfazer', textContent: 'Desfazer' }));
    }
  };
  aviso?.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.ac-desfazer') || !desfazer) return;
    const d = desfazer;
    desfazer = null;
    d();
  });
  function salvar(y: number, anoAntes: number | null) {
    const antes = lerMeuCarro();
    if (eh(antes) && antes.y === y) return;   // já é o carro salvo, com este ano
    // o trabalho do toque primeiro (a ficha acesa e a grade); salvar avisa o cabeçalho e os cartões num quadro próprio
    setTimeout(() => {
      if (ano !== y) return;
      salvarMeuCarro(eh(antes) ? { ...antes, y } : { b: B, m: M, y, ...(arte.a ? { a: arte.a, ...(arte.as ? { as: arte.as } : {}) } : {}) });
      desfazer = () => {
        salvarMeuCarro(antes);
        escolher(anoAntes);
        if (anoAntes != null) centrar(anoAntes, true);
        avisar('Desfeito', false);
        (chips.find((c) => (c.dataset.y ? Number(c.dataset.y) : null) === anoAntes) ?? todosChip)?.focus({ preventScroll: true });
      };
      avisar(textoSalvo(antes, B, M), true);
    }, 60);
  }

  lista.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.ac-ano');
    if (!chip) return;
    const y = chip.dataset.y ? Number(chip.dataset.y) : null;
    const anoAntes = ano;
    if (y === ano) return;
    desfazer = null;
    avisar('', false);
    escolher(y);
    // "Todos" não mexe no carro salvo; o ano salva (com Desfazer)
    if (y != null) {
      salvar(y, anoAntes);
      requestAnimationFrame(() => setTimeout(() => { if (ano === y) centrar(y, true); }, 0));
    }
  });

  // o carro salvo deste modelo, com ano: o ano dele já vem escolhido (e acompanha a troca feita no cabeçalho)
  const doSalvo = (c: MeuCarro | null) => {
    if (eh(c) && c.y && c.y !== ano && chips.some((x) => x.dataset.y === String(c.y))) { centrar(c.y); escolher(c.y); }
  };
  window.addEventListener(EVENTO, (e) => doSalvo((e as CustomEvent<MeuCarro | null>).detail));
  doSalvo(lerMeuCarro());
  bordas();
}
