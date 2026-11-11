// O que os trilhos "da pessoa" da home ("Você viu", "Chegou para o seu carro") e o "Você também viu" da peça têm em
// comum: o esqueleto do cartão (o lugar guardado antes da 1ª pintura, com a altura do cartão de verdade), as setas do
// computador, o "depois que a página carregou e o navegador folgou" e a troca do esqueleto pelos cartões sem mexer na
// altura. Os cartões são os do catálogo (cartaoHtml, lib/vendidaCartoes.ts), montados aqui no navegador.
// Sem lib/busca.ts aqui: os cartões chegam por import() só quando há o que mostrar.

/** A largura da foto do cartão nos trilhos da home (CSS em trilhoPessoal.css): 208 px no celular; 5 por fila de 1024
 *  a 1279 px; 6 por fila depois (a moldura chega a 1240 px, 16 px entre os cartões). */
export const SIZES_PESSOAL = '(min-width: 1304px) 194px, (min-width: 1280px) calc(16.7vw - 24px), (min-width: 1024px) calc(20vw - 26px), 208px';

/** O esqueleto de um cartão: a MESMA estrutura e as mesmas classes do cartão (a mesma altura), com as linhas vazias.
 *  No cartão estreito dos trilhos (até 214 px) o carro e os anos ocupam 2 linhas e o nome, 2 (às vezes 3): o esqueleto
 *  tem a altura do cartão mais comum. */
export const ESQ_CARTAO = '<div class="etiqueta-cx tema-estudio tp-esq" aria-hidden="true"><div class="etiqueta"><div class="etiqueta-foto"></div>'
  + '<div class="etiqueta-dados"><span class="etiqueta-carro">&nbsp;<br>&nbsp;</span><span class="etiqueta-nome">&nbsp;<br>&nbsp;</span>'
  + '<span class="etiqueta-cod">&nbsp;</span><span class="etiqueta-valor"><s>&nbsp;</s><span class="etiqueta-preco"><small>&nbsp;</small>&nbsp;</span>'
  + '<span class="etiqueta-wa">&nbsp;</span></span><span class="etiqueta-confia">&nbsp;</span></div></div></div>';

/** Depois do "load" e quando o navegador folgar (nunca disputa a rede e a CPU com a 1ª tela). */
export function depoisDaCarga(fn: () => void, espera = 2500) {
  const agendar = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => fn(), { timeout: espera });
    else setTimeout(fn, 300);
  };
  if (document.readyState === 'complete') agendar();
  else window.addEventListener('load', agendar, { once: true });
}

/** Troca o esqueleto pelos cartões: a altura que estava fica como mínimo (o trilho nunca encolhe na frente da pessoa). */
export function porCartoes(trilho: HTMLElement, html: string) {
  if (trilho.offsetHeight) trilho.style.minHeight = `${trilho.offsetHeight}px`;
  trilho.innerHTML = html;
  trilho.removeAttribute('aria-busy');
  // fora da tela, a altura volta a ser a dos cartões (aí ninguém vê a seção encolher)
  if (!trilho.style.minHeight || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) return;
    trilho.style.minHeight = '';
    io.disconnect();
  });
  io.observe(trilho);
}

const SETA = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
export const SETAS_HTML = `<button type="button" class="tp-seta" data-tp-esq aria-label="Voltar" disabled>${SETA('m15 18-6-6 6-6')}</button>`
  + `<button type="button" class="tp-seta" data-tp-dir aria-label="Mais peças">${SETA('m9 18 6-6-6-6')}</button>`;

/** Setas do computador (só aparecem quando o trilho tem mais cartões que a tela: CSS + [data-rola]). Andam uma tela de
 *  cartões por vez; o trilho rola de lado, nunca a página. Liga também o "cartão focado entra inteiro". */
export function ligarSetas(secao: HTMLElement) {
  const trilho = secao.querySelector<HTMLElement>('[data-tp-trilho]');
  const esq = secao.querySelector<HTMLButtonElement>('[data-tp-esq]');
  const dir = secao.querySelector<HTMLButtonElement>('[data-tp-dir]');
  if (!trilho) return;
  const calmo = matchMedia('(prefers-reduced-motion: reduce)');
  let quadro = 0;
  const ver = () => {
    quadro = 0;
    const fim = trilho.scrollWidth - trilho.clientWidth;
    secao.toggleAttribute('data-rola', fim > 2);
    if (esq) esq.disabled = trilho.scrollLeft <= 2;
    if (dir) dir.disabled = trilho.scrollLeft >= fim - 2;
  };
  const passo = (lado: number) => trilho.scrollBy({ left: lado * Math.max(200, trilho.clientWidth - 80), behavior: calmo.matches ? 'auto' : 'smooth' });
  esq?.addEventListener('click', () => passo(-1));
  dir?.addEventListener('click', () => passo(1));
  trilho.addEventListener('scroll', () => { if (!quadro) quadro = requestAnimationFrame(ver); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(ver).observe(trilho);
  ver();
  // teclado: o cartão focado entra inteiro no trilho (o Tab não deixa cartão pela metade na borda)
  trilho.addEventListener('focusin', (e) => {
    const cx = (e.target as HTMLElement).closest<HTMLElement>('.etiqueta-cx');
    if (!cx || trilho.scrollWidth <= trilho.clientWidth + 1) return;
    const r = cx.getBoundingClientRect(), t = trilho.getBoundingClientRect();
    if (r.left >= t.left - 1 && r.right <= t.right + 1) return;
    trilho.scrollTo({ left: trilho.scrollLeft + (r.left - t.left) - 4, behavior: 'auto' });
  });
}

/** Aviso para o leitor de tela (um só por página). */
let aviso: HTMLElement | null = null;
export function avisar(txt: string) {
  if (!aviso) {
    aviso = Object.assign(document.createElement('p'), { className: 'sr-only' });
    aviso.setAttribute('role', 'status');
    document.body.append(aviso);
  }
  aviso.textContent = '';
  requestAnimationFrame(() => { aviso!.textContent = txt; });
}
