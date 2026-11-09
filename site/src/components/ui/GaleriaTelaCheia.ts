// Visualizador de fotos em tela cheia da página da peça, SEM React (antes eram ~210 KB de React só para ele).
// Inspirado no "Thumbnail image viewer" do 21st.dev (autor: ibrandify): faixa de miniaturas com setas do teclado e
// foco visível, com zoom e gestos (deslizar, pinça, toque duplo, roda do mouse).
// O HTML é montado na 1ª abertura e reaproveitado. Durante o gesto, o desenho vai direto no estilo (um por quadro),
// sem recriar nada: fluido mesmo em celular fraco. Quem abre: PecaTopo.astro (abrirGaleria).

type Vista = { s: number; x: number; y: number };
type Gesto = {
  modo: 'arrastar' | 'pinca';
  x: number; y: number;       // ponto inicial do dedo/mouse
  vx: number; vy: number;     // pan inicial
  s0: number;                 // zoom inicial
  d0: number;                 // distância inicial entre dedos
  mov: number;                // quanto mexeu (para separar toque de arrasto)
  t: number;                  // hora do início
};
export type Abrir = {
  /** fotos grandes (as do trilho da página, na mesma ordem) */
  fotos: string[];
  /** miniaturas (as pequenas da página); vazia = usa a foto grande */
  minis?: string[];
  titulo: string;
  indice?: number;
  /** quem recebe o foco de volta ao fechar */
  foco?: Element | null;
  /** chamada ao fechar, com a foto em que a pessoa parou */
  aoFechar?: (indice: number) => void;
};

const MIN = 1;
const MAX = 4;
const DUPLO = 2.5;
const FOCAVEIS = 'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const CSS = `
.gt{position:fixed;inset:0;z-index:1100;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--plate);color:#1d1d1f;
  opacity:0;transition:opacity .22s ease;user-select:none;-webkit-user-select:none}
.gt[hidden]{display:none}
.gt.on{opacity:1}
.gt.mexendo .gt-trilho,.gt.mexendo .gt-foto{transition:none}
.gt-topo{display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 12px 10px 16px;min-width:0}
.gt-titulo{flex:1;min-width:0;margin:0;font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gt-contador{flex:none;padding:6px 11px;border-radius:999px;background:#1d1d1f;color:#fff;font-size:13px;font-weight:650;font-variant-numeric:tabular-nums}
.gt-botao{flex:none;width:44px;height:44px;border:0;border-radius:12px;display:grid;place-items:center;padding:0;background:#ececf0;color:#1d1d1f;cursor:pointer}
.gt-botao:hover{background:#e2e2e7}
.gt-botao svg{width:20px;height:20px}
.gt-meio{position:relative;min-height:0;overflow:hidden}
.gt-palco{position:absolute;inset:0;overflow:hidden;touch-action:none;cursor:zoom-in}
.gt-palco.amplo{cursor:grab}
.gt-palco.amplo:active{cursor:grabbing}
.gt-trilho{display:flex;height:100%;width:100%;transition:transform .34s cubic-bezier(.2,.8,.2,1);will-change:transform}
/* flex, nao grid: no grid a altura 100% da foto nao resolvia, a foto ficava do tamanho da largura e cortava */
.gt-slide{flex:0 0 100%;height:100%;display:flex;align-items:center;justify-content:center;min-width:0}
.gt-foto{width:100%;height:100%;min-width:0;object-fit:contain;padding:5%;-webkit-user-drag:none;pointer-events:none;transform-origin:center center;
  transition:transform .26s cubic-bezier(.2,.8,.2,1)}
.gt-dica{display:none;position:absolute;left:50%;top:12px;z-index:2;transform:translateX(-50%);padding:6px 12px;border-radius:999px;
  background:rgb(255 255 255 / .92);color:#1d1d1f;font-size:12.5px;font-weight:600;white-space:nowrap;pointer-events:none;box-shadow:0 4px 14px -6px rgb(0 0 0 / .3)}
@media (hover:none){.gt-dica{display:block}}
.gt-seta{position:absolute;top:50%;z-index:2;width:48px;height:48px;margin-top:-24px;border:0;border-radius:50%;display:none;place-items:center;padding:0;
  background:rgb(255 255 255 / .92);color:#1d1d1f;box-shadow:0 6px 18px -6px rgb(0 0 0 / .25),inset 0 0 0 1px #e2e2e7;cursor:pointer}
.gt-seta:disabled{opacity:.35;cursor:default}
.gt-seta svg{width:22px;height:22px}
.gt-seta.esq{left:14px}
.gt-seta.dir{right:14px}
@media (min-width:720px){.gt-seta{display:grid}}
.gt-faixa{display:flex;gap:8px;overflow-x:auto;justify-content:safe center;padding:10px 14px calc(14px + env(safe-area-inset-bottom));scrollbar-width:none;overscroll-behavior-x:contain}
.gt-faixa::-webkit-scrollbar{display:none}
.gt-mini{flex:none;width:60px;height:60px;padding:0;border:0;border-radius:12px;overflow:hidden;background:#f5f5f7;cursor:pointer;
  box-shadow:inset 0 0 0 1.5px #e2e2e7;opacity:.62;transition:opacity .2s,box-shadow .2s}
.gt-mini[aria-current="true"]{opacity:1;box-shadow:inset 0 0 0 2.5px var(--accent)}
.gt-mini img{width:100%;height:100%;object-fit:contain;padding:4px;pointer-events:none}
@media (prefers-reduced-motion:reduce){.gt,.gt-trilho,.gt-foto,.gt-mini{transition:none!important}}
`;
const svg = (d: string, w = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

// ---- estado (uma galeria por página) ----
let raiz: HTMLDivElement | null = null;
let el: {
  titulo: HTMLElement; contador: HTMLElement; fechar: HTMLButtonElement; palco: HTMLDivElement; trilho: HTMLDivElement;
  esq: HTMLButtonElement; dir: HTMLButtonElement; faixa: HTMLElement; fotos: HTMLImageElement[]; minis: HTMLButtonElement[];
} | null = null;
let total = 0;
let i = 0;
let vista: Vista = { s: 1, x: 0, y: 0 };
let arrasto = 0;
let aberta = false;
let fotoAmpliada: HTMLImageElement | null = null;
let foco: Element | null = null;
let aoFechar: ((n: number) => void) | undefined;
let quadro = 0;
let saida = 0;
const ptrs = new Map<number, { x: number; y: number }>();
let gesto: Gesto | null = null;
let toque: { t: number; x: number; y: number } | null = null;
let tipoUlt = 'mouse';

// um desenho por quadro: trilho, foto ampliada, contador, setas e miniatura ativa
function pintar() {
  quadro = 0;
  if (!el) return;
  el.trilho.style.transform = `translate3d(calc(${-i * 100}% + ${arrasto}px), 0, 0)`;
  const atual = el.fotos[i];
  if (fotoAmpliada && fotoAmpliada !== atual) fotoAmpliada.style.transform = '';
  atual.style.transform = vista.s > 1 || vista.x || vista.y ? `translate3d(${vista.x}px, ${vista.y}px, 0) scale(${vista.s})` : '';
  fotoAmpliada = atual;
  el.palco.classList.toggle('amplo', vista.s > 1);
}
const agendar = () => { if (!quadro) quadro = requestAnimationFrame(pintar); };

function setVista(v: Vista) { vista = v; agendar(); }
function setMexendo(m: boolean) { raiz?.classList.toggle('mexendo', m); }

// mantém o pan dentro da foto ampliada
function limita(v: Vista): Vista {
  if (v.s <= 1) return { s: 1, x: 0, y: 0 };
  const r = el!.palco.getBoundingClientRect();
  const mx = ((v.s - 1) * r.width) / 2;
  const my = ((v.s - 1) * r.height) / 2;
  return { s: v.s, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
}
// zoom mantendo o ponto do dedo/cursor parado na tela
function zoomEm(sBruto: number, px: number, py: number) {
  const r = el!.palco.getBoundingClientRect();
  const s2 = clamp(sBruto, MIN, MAX);
  if (s2 === vista.s) return;
  const ax = px - (r.left + r.width / 2);
  const ay = py - (r.top + r.height / 2);
  const k = s2 / vista.s;
  setVista(limita({ s: s2, x: ax - k * (ax - vista.x), y: ay - k * (ay - vista.y) }));
}
function duploZoom(px: number, py: number) {
  if (vista.s > 1) setVista({ s: 1, x: 0, y: 0 });
  else zoomEm(DUPLO, px, py);
}

function irPara(n: number) {
  if (!el) return;
  const k = clamp(n, 0, total - 1);
  vista = { s: 1, x: 0, y: 0 };
  i = k;
  // a vizinha já carrega (as outras esperam)
  [k - 1, k, k + 1].forEach((j) => { const f = el!.fotos[j]; if (f && f.loading !== 'eager') f.loading = 'eager'; });
  el.contador.textContent = `${k + 1} / ${total}`;
  el.esq.disabled = k === 0;
  el.dir.disabled = k === total - 1;
  el.minis.forEach((b, j) => { if (j === k) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  miniAVista();
  agendar();
}
// miniatura ativa à vista (só a faixa rola; com a galeria escondida não há o que medir)
function miniAVista() {
  const m = el?.minis[i];
  const f = el?.faixa;
  if (!m || !f || !f.clientWidth) return;
  const esq = m.offsetLeft - 14, dir = m.offsetLeft + m.offsetWidth + 14 - f.clientWidth;
  if (esq < f.scrollLeft) f.scrollTo({ left: esq });
  else if (dir > f.scrollLeft) f.scrollTo({ left: dir });
}

// Prende o Tab dentro da galeria.
function prenderTab(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !raiz) return;
  const f = [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((x) => x.getClientRects().length > 0);
  if (!f.length) return;
  const ativo = document.activeElement;
  if (e.shiftKey && (ativo === f[0] || !raiz.contains(ativo))) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && (ativo === f[f.length - 1] || !raiz.contains(ativo))) { e.preventDefault(); f[0].focus(); }
}
function onKey(e: KeyboardEvent) {
  if (!aberta) return;
  if (e.key === 'Escape') { e.preventDefault(); fechar(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); irPara(i + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(i - 1); }
  else if (e.key === 'Home') { e.preventDefault(); irPara(0); }
  else if (e.key === 'End') { e.preventDefault(); irPara(total - 1); }
  else prenderTab(e);
}
// roda do mouse: zoom no ponto do cursor (não passivo para poder cancelar)
function onWheel(e: WheelEvent) {
  if (!e.deltaY) return;
  e.preventDefault();
  zoomEm(vista.s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
}

// ---- gestos: deslizar entre fotos, arrastar com zoom, pinça e toque duplo ----
function pDown(e: PointerEvent) {
  el!.palco.setPointerCapture(e.pointerId);
  tipoUlt = e.pointerType;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) {
    gesto = { modo: 'arrastar', x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y, s0: vista.s, d0: 0, mov: 0, t: performance.now() };
    setMexendo(true);
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    gesto = { modo: 'pinca', x: 0, y: 0, vx: vista.x, vy: vista.y, s0: vista.s, d0: dist(a, b), mov: 99, t: 0 };
  }
}
function pMove(e: PointerEvent) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const g = gesto;
  if (!g) return;
  if (g.modo === 'arrastar') {
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    g.mov = Math.max(g.mov, Math.abs(dx) + Math.abs(dy));
    if (g.s0 > 1) setVista(limita({ s: g.s0, x: g.vx + dx, y: g.vy + dy }));
    else { arrasto = dx; agendar(); }
  } else if (ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const s2 = clamp((g.s0 * dist(a, b)) / g.d0, MIN, MAX);
    const k = s2 / g.s0;
    setVista(limita({ s: s2, x: g.vx * k, y: g.vy * k }));
  }
}
function pFim(e: PointerEvent) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  const g = gesto;
  if (ptrs.size > 0) {
    // pinça terminou com um dedo ainda na tela: ignora até soltar tudo
    if (g?.modo === 'pinca') gesto = null;
    return;
  }
  gesto = null;
  setMexendo(false);
  if (vista.s < 1.02) setVista({ s: 1, x: 0, y: 0 });
  if (g?.modo === 'arrastar') {
    const dx = arrasto;
    const rapido = performance.now() - g.t < 260;
    arrasto = 0;
    if (g.s0 <= 1 && vista.s <= 1 && (Math.abs(dx) > 60 || (Math.abs(dx) > 24 && rapido))) irPara(dx < 0 ? i + 1 : i - 1);
    else agendar();
    // toque duplo no celular -> zoom
    if (tipoUlt === 'touch' && g.mov < 12) {
      const agora = performance.now();
      const ult = toque;
      if (ult && agora - ult.t < 320 && dist(ult, { x: e.clientX, y: e.clientY }) < 40) { toque = null; duploZoom(e.clientX, e.clientY); }
      else toque = { t: agora, x: e.clientX, y: e.clientY };
    }
  }
}
// duplo clique no computador (no celular o toque duplo já é tratado acima)
function onDuplo(e: MouseEvent) {
  if (tipoUlt === 'touch') return;
  duploZoom(e.clientX, e.clientY);
}

function montar(fotos: string[], minis: string[], titulo: string) {
  if (!document.getElementById('gt-estilo')) {
    const st = document.createElement('style');
    st.id = 'gt-estilo';
    st.textContent = CSS;
    document.head.append(st);
  }
  total = fotos.length;
  raiz = document.createElement('div');
  raiz.className = 'gt';
  raiz.hidden = true;
  raiz.setAttribute('role', 'dialog');
  raiz.setAttribute('aria-modal', 'true');
  raiz.setAttribute('aria-labelledby', 'gt-titulo');
  raiz.innerHTML =
    `<header class="gt-topo"><p id="gt-titulo" class="gt-titulo"></p><span class="gt-contador" aria-live="polite"></span>`
    + `<button type="button" class="gt-botao" aria-label="Fechar galeria">${svg('M6 6l12 12M18 6L6 18')}</button></header>`
    + `<div class="gt-meio"><span class="gt-dica" aria-hidden="true">Aperte com dois dedos para ampliar</span>`
    + `<div class="gt-palco"><div class="gt-trilho"></div></div>`
    + `<button type="button" class="gt-seta esq" aria-label="Foto anterior">${svg('m15 18-6-6 6-6')}</button>`
    + `<button type="button" class="gt-seta dir" aria-label="Próxima foto">${svg('m9 18 6-6-6-6')}</button></div>`
    + `<nav class="gt-faixa" aria-label="Miniaturas das fotos"></nav>`;
  const q = <T extends Element>(s: string) => raiz!.querySelector<T>(s)!;
  const trilho = q<HTMLDivElement>('.gt-trilho');
  const faixa = q<HTMLElement>('.gt-faixa');
  q<HTMLElement>('.gt-titulo').textContent = titulo;
  const imgs: HTMLImageElement[] = [];
  const botoes: HTMLButtonElement[] = [];
  fotos.forEach((src, k) => {
    const slide = document.createElement('div');
    slide.className = 'gt-slide';
    const im = document.createElement('img');
    im.className = 'gt-foto';
    im.alt = `${titulo}, foto ${k + 1} de ${total}`;
    im.draggable = false;
    im.decoding = 'async';
    im.loading = 'lazy';
    im.src = src;
    slide.append(im);
    trilho.append(slide);
    imgs.push(im);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gt-mini';
    b.setAttribute('aria-label', `Foto ${k + 1}`);
    const mi = document.createElement('img');
    mi.alt = '';
    mi.loading = 'lazy';
    mi.decoding = 'async';
    mi.draggable = false;
    mi.src = minis[k] || src;
    b.append(mi);
    b.addEventListener('click', () => irPara(k));
    faixa.append(b);
    botoes.push(b);
  });
  el = {
    titulo: q('.gt-titulo'), contador: q('.gt-contador'), fechar: q('.gt-botao'), palco: q('.gt-palco'), trilho, faixa,
    esq: q('.gt-seta.esq'), dir: q('.gt-seta.dir'), fotos: imgs, minis: botoes,
  };
  el.fechar.addEventListener('click', fechar);
  el.esq.addEventListener('click', () => irPara(i - 1));
  el.dir.addEventListener('click', () => irPara(i + 1));
  el.palco.addEventListener('pointerdown', pDown);
  el.palco.addEventListener('pointermove', pMove);
  el.palco.addEventListener('pointerup', pFim);
  el.palco.addEventListener('pointercancel', pFim);
  el.palco.addEventListener('dblclick', onDuplo);
  el.palco.addEventListener('wheel', onWheel, { passive: false });
  document.body.append(raiz);
}

export function abrirGaleria(o: Abrir) {
  if (aberta || !o.fotos.length) return;
  if (!raiz) montar(o.fotos, o.minis ?? [], o.titulo);
  foco = o.foco ?? document.activeElement;
  aoFechar = o.aoFechar;
  aberta = true;
  clearTimeout(saida);
  vista = { s: 1, x: 0, y: 0 };
  arrasto = 0;
  ptrs.clear();
  gesto = null;
  setMexendo(true); // abre já na foto certa, sem deslizar até ela
  irPara(Math.trunc(o.indice ?? 0));
  pintar();
  raiz!.hidden = false;
  miniAVista();
  document.documentElement.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
  el!.fechar.focus({ preventScroll: true });
  requestAnimationFrame(() => requestAnimationFrame(() => { raiz?.classList.add('on'); setMexendo(false); }));
}

export function fechar() {
  if (!aberta || !raiz) return;
  aberta = false;
  raiz.classList.remove('on');
  document.removeEventListener('keydown', onKey);
  aoFechar?.(i);
  saida = window.setTimeout(() => {
    if (raiz) raiz.hidden = true;
    document.documentElement.style.overflow = '';
    (foco as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, 220);
}
