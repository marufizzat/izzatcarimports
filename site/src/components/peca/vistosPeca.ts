// Página da peça: grava esta peça nas "vistas" (lib/vistos.ts) e, se a pessoa já abriu outras, mostra "Você também viu"
// no fim da página (até 6, sem esta). Nada no HTML das 5 mil páginas: os dados são os que a página já mostra (h1, linha do
// carro, código, IZZAT_PRODUCT, a faixa "Serve no seu carro?" e a 1ª foto) e a seção nasce aqui, quando o navegador
// folga, só se o lugar dela (depois do último bloco, antes do rodapé) ainda está abaixo da tela: nada se mexe na frente
// da pessoa. Os cartões (os do catálogo, cartaoHtml) e a conferência do estoque (/dados/ativas.json: a peça que vendeu
// some) só chegam quando a seção está perto de aparecer. O visual é o do "Do mesmo carro" (.dmc).
import { itemDaPagina } from './listaPeca';
import { lerVistos, registrar, salvarVistos, carregarAtivas, paraMostrar, itemDoVisto, type Visto } from '../../lib/vistos';
import { lerModelos } from '../../lib/meuCarro';
import { ESQ_CARTAO, depoisDaCarga, porCartoes } from '../v2/trilhoPessoal';

const NA_PECA = 6;

/** Esta peça, lida do HTML que já existe. */
export function vistoDaPagina(): Visto | null {
  const it = itemDaPagina();
  if (!it || !it.slug || !it.preco) return null;
  const v: Visto = { ...it, t: Date.now() };
  const faixa = document.querySelector<HTMLElement>('[data-meu-carro]');
  if (faixa?.dataset.b && faixa.dataset.m) {
    const d = faixa.dataset;
    v.b = d.b;
    v.m = d.m;
    if (d.y0 && d.y1) v.y = [Number(d.y0), Number(d.y1)];
    const mo = lerModelos(d.ms, d.ys);
    if (mo.ms) { v.ms = mo.ms; if (mo.ys) v.ys = mo.ys; }
  } else {
    // peça só com a marca (ou sem): o carro e os anos como o h1 mostra
    if (it.carro) v.b = it.carro;
    const a = /^(\d{4})(?:\s*a\s*(\d{4}))?$/.exec(it.anos);
    if (a) v.y = [Number(a[1]), Number(a[2] || a[1])];
  }
  const fotos = [...document.querySelectorAll<HTMLImageElement>('[data-trilho] img')].map((im) => im.getAttribute('src') || '');
  v.e = /\/estudio-pro\//.test(fotos[0] || '') ? '2' : /\/estudio\//.test(fotos[0] || '') ? '1' : '0';
  const ml = fotos.map((s) => /mlstatic\.com\/D_([\w-]+?)-[A-Z]\.webp$/.exec(s)?.[1]).find(Boolean);
  if (ml) v.i = ml;
  return v;
}

function tambemViu(outros: Visto[], esta: string) {
  const main = document.querySelector<HTMLElement>('main#conteudo');
  const ultimo = main ? [...main.children].filter((e) => e.tagName === 'SECTION').pop() : null;
  // o lugar já passou da tela (a pessoa rolou até o fim antes do navegador folgar): fica para a próxima visita
  if (!ultimo || ultimo.getBoundingClientRect().bottom < window.innerHeight + 40) return;
  const secao = document.createElement('section');
  secao.className = 'secao dmc tv';
  secao.setAttribute('aria-labelledby', 'tv-titulo');
  secao.innerHTML = '<div class="moldura"><div class="dmc-cabeca"><div><h2 class="titulo-secao" id="tv-titulo">Você também viu</h2>'
    + '<p class="dmc-sub">Peças que você abriu antes, guardadas só neste aparelho.</p></div></div>'
    + `<div class="trilho dmc-grade" data-tp-trilho aria-busy="true" aria-label="Peças que você também viu">${ESQ_CARTAO.repeat(Math.min(outros.length, NA_PECA))}</div></div>`;
  ultimo.after(secao);
  const trilho = secao.querySelector<HTMLElement>('[data-tp-trilho]')!;
  const montar = async () => {
    const ativas = await carregarAtivas();
    if (ativas) {
      const guardados = lerVistos();
      if (guardados.some((v) => !ativas.has(v.id))) salvarVistos(guardados.filter((v) => ativas.has(v.id)));
    }
    const mostrar = paraMostrar(outros, ativas, esta).slice(0, NA_PECA);
    try {
      if (!mostrar.length) throw new Error('nada');
      const [{ cartaoHtml, vigiarFotos }, { SIZES_CARTAO }] = await Promise.all([import('../../lib/vendidaCartoes'), import('../../lib/busca')]);
      vigiarFotos(trilho);
      porCartoes(trilho, mostrar.map((v) => cartaoHtml(itemDoVisto(v, ativas?.get(v.id)?.r ?? true), SIZES_CARTAO.parecidas)).join(''));
    } catch {
      secao.remove();   // nada à venda (ou a rede caiu): a seção sai antes de aparecer
    }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void montar();
    }, { rootMargin: '0px 0px 900px 0px' });
    io.observe(secao);
  } else void montar();
}

/** Grava esta peça e, com outras já vistas, prepara o "Você também viu". */
export function ligarVistos() {
  depoisDaCarga(() => {
    const esta = vistoDaPagina();
    if (!esta) return;
    const antes = lerVistos();
    salvarVistos(registrar(antes, esta));
    const outros = antes.filter((v) => v.id !== esta.id);
    if (outros.length) tambemViu(outros, esta.id);
  }, 4000);
}
