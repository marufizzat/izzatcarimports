// O botão da lista no cartão (rodada 14, cliente oculto atrito 10): um botão irmão da foto, em cima à esquerda (o desenho
// e o lugar em styles/global.css: .etiqueta-lista), que põe a peça na lista de orçamento sem abrir a peça. Os cartões estáticos (CartaoPeca.astro: home, categoria, carro, marca) são
// ligados por UM ouvinte delegado no document; o botão é criado pelo script (nada de HTML a mais por cartão). O cartão
// do catálogo (React) usa as mesmas funções (itemDeDados, classe e textos) e passa o estado pelo evento 'lista'.
import { adicionarNaLista, lerLista, tem, EVENTO_LISTA, PAGINA_LISTA, idValido, type ItemLista } from '../../lib/lista';
import { nomeModelos, lerModelos } from '../../lib/meuCarro';
import { anosTexto } from '../../lib/whats';
import { precoCheioDoTexto } from '../catalogo/etiqueta';
import { avisarListaCheia } from './avisoLista';

export const CLASSE_LISTA = 'etiqueta-lista';
/** O texto do botão: SEM o "+" (o sinal é o desenho do botão; os dois juntos davam "+ + Lista": revisão 14, P1-7). */
export const TXT_ADD = 'Lista';
/** O aviso da lista cheia para o leitor de tela (o catálogo manda o mesmo texto: é por ele que o aviso à vista sai). */
export const AVISO_CHEIA = 'A lista está cheia. Tire uma peça para pôr outra.';
export const TXT_NA = 'Na lista';

/** O item da lista a partir do que o cartão mostra (os mesmos dados da mensagem "Pedir no WhatsApp" do cartão). */
export function itemDeDados(d: {
  id: string; slug: string; nome: string; carro: string; anos: string; cod: string; preco: number; capa: string;
}): ItemLista | null {
  if (!idValido(d.id) || !d.nome || !(d.preco > 0)) return null;
  return { id: d.id, slug: d.slug, nome: d.nome, carro: d.carro, anos: d.anos, cod: d.cod, preco: d.preco, capa: d.capa };
}

/** Os textos e o aria-label do botão, conforme a peça está ou não na lista. */
export function rotulo(na: boolean, nome: string) {
  return na
    ? { txt: TXT_NA, label: `Peça na sua lista: ${nome}. Ver a lista` }
    : { txt: TXT_ADD, label: `Adicionar à Lista de orçamento: ${nome}` };
}

/** Aviso para quem usa leitor de tela (a região fica fora da tela). A lista cheia sai também À VISTA (ui/avisoLista.ts):
 *  o toque que não faz nada precisa dizer por quê a quem enxerga. */
let aviso: HTMLElement | null = null;
export function avisar(msg: string) {
  if (msg === AVISO_CHEIA) avisarListaCheia();
  if (!aviso) {
    aviso = document.createElement('p');
    aviso.id = 'lista-aviso';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    aviso.className = 'sr-only';
    document.body.append(aviso);
  }
  aviso.textContent = msg;
}

const avisoDe = (r: 'ok' | 'ja' | 'cheia', n: number) =>
  r === 'cheia' ? AVISO_CHEIA
    : r === 'ja' ? 'Essa peça já está na sua lista.'
      : `Peça na sua lista (${n}).`;

/** Lê o cartão estático (a.etiqueta com data-*, nome, preço e código) e monta o item. */
export function itemDoCartao(cx: HTMLElement): ItemLista | null {
  const a = cx.querySelector<HTMLAnchorElement>('a.etiqueta');
  if (!a) return null;
  const id = (a.getAttribute('href') || '').match(/MLB\d+/)?.[0] || '';
  const slug = (a.getAttribute('href') || '').replace(/^\/peca\//, '').replace(/\.html$/, '');
  const d = a.dataset;
  const nome = cx.querySelector('.etiqueta-nome')?.textContent?.trim() || '';
  // a lista guarda o preço CHEIO (o do site); o do WhatsApp é sempre calculado dele (lib/whats.ts)
  const preco = Number(precoCheioDoTexto(cx.querySelector('.etiqueta-dados > .sr-only')?.textContent).replace(/\./g, '').replace(',', '.'));
  const carro = nomeModelos({ b: d.b || '', m: d.m || '', ...lerModelos(d.ms, d.ys) });
  const anos = d.a0 ? anosTexto([Number(d.a0), Number(d.a1)]) : '';
  const cod = cx.querySelector('.etiqueta-cod .oem')?.textContent?.trim() || '';
  const capa = cx.querySelector<HTMLImageElement>('.etiqueta-foto img')?.getAttribute('src') || '';
  return itemDeDados({ id, slug, nome, carro, anos, cod, preco, capa });
}

function pintar(btn: HTMLButtonElement) {
  const na = tem(lerLista(), btn.dataset.id || '');
  const nome = btn.dataset.nome || '';
  const r = rotulo(na, nome);
  if (btn.dataset.na !== (na ? '1' : '0')) btn.dataset.na = na ? '1' : '0';
  if (btn.textContent !== r.txt) btn.textContent = r.txt;
  if (btn.getAttribute('aria-label') !== r.label) btn.setAttribute('aria-label', r.label);
  btn.classList.toggle('na', na);
}

/** Põe o botão em cada cartão estático que ainda não tem um (o catálogo React fica de fora: monta o seu). */
export function montar(raiz: ParentNode = document) {
  raiz.querySelectorAll<HTMLElement>('.etiqueta-cx').forEach((cx) => {
    if (cx.querySelector(`.${CLASSE_LISTA}`) || cx.closest('.cat')) return;
    const a = cx.querySelector<HTMLAnchorElement>('a.etiqueta');
    const id = (a?.getAttribute('href') || '').match(/MLB\d+/)?.[0];
    if (!a || !id) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = CLASSE_LISTA;
    b.dataset.id = id;
    b.dataset.nome = cx.querySelector('.etiqueta-nome')?.textContent?.trim() || '';
    b.dataset.botao = 'lista-cartao';
    pintar(b);
    cx.append(b);
  });
}

/** Atualiza todos os botões de cartão estático (evento 'lista': adicionar, tirar, limpar, outra aba). */
export function atualizar() {
  document.querySelectorAll<HTMLButtonElement>(`.${CLASSE_LISTA}:not([data-react])`).forEach(pintar);
}

let ligado = false;
/** Liga uma vez por página: ouvinte delegado de clique, evento 'lista' e cartões que chegam depois (ex.: as trilhas). */
export function iniciarListaCartao() {
  if (ligado) return;
  ligado = true;
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element | null)?.closest?.<HTMLButtonElement>(`.${CLASSE_LISTA}:not([data-react])`);
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.na === '1') { window.location.href = PAGINA_LISTA; return; }
    const cx = btn.closest<HTMLElement>('.etiqueta-cx');
    const item = cx ? itemDoCartao(cx) : null;
    if (!item) { avisar('Não deu para pôr esta peça na lista agora.'); return; }
    const r = adicionarNaLista(item, 'cartao');
    avisar(avisoDe(r, lerLista().length));
    atualizar();
  });
  window.addEventListener(EVENTO_LISTA, atualizar);
  montar();
  atualizar();
  // cartões montados depois pelos scripts das trilhas (sem o catálogo, que tem o seu)
  new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => {
      if (!(n instanceof HTMLElement)) return;
      if (n.matches('.etiqueta-cx')) montar(n.parentNode ?? n);
      else if (n.querySelector('.etiqueta-cx')) montar(n);
    });
  }).observe(document.body, { childList: true, subtree: true });
}
