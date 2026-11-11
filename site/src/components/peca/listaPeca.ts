// "Adicionar à lista de orçamento" na página da peça (o botão discreto abaixo dos dois caminhos de compra) e nos cartões
// do "Vai junto" (VaiJunto.astro). O HTML de cada peça leva só o botão; os dados da peça são lidos do que a página já
// tem (o nome do h1, o carro e os anos, o código, o preço do window.IZZAT_PRODUCT e o endereço): nada repetido no HTML.
// Estado: lib/lista.ts (localStorage + evento 'lista'). Toque = retorno na hora (o botão vira "Na sua lista" com o visto
// e o link "Ver lista" aparece) e o aviso para o leitor de tela.
import { lerLista, tem, adicionarNaLista, salvarLista, remover, pecasTxt, EVENTO_LISTA, MAX_LISTA, PAGINA_LISTA, type ItemLista } from '../../lib/lista';
import { icone } from '../../lib/icones';

const SVG = (nome: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="${icone(nome)}"></use></svg>`;
const SETA = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** Aviso para o leitor de tela (um só por página, criado no 1º uso). */
let aviso: HTMLElement | null = null;
export function avisarLista(txt: string) {
  if (!aviso) {
    aviso = Object.assign(document.createElement('p'), { className: 'sr-only' });
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    document.body.append(aviso);
  }
  aviso.textContent = '';
  requestAnimationFrame(() => { aviso!.textContent = txt; });
}

/** "2017–2021" (cartão) -> "2017 a 2021" (a forma da mensagem) */
export const anosDoCartao = (s: string) => s.replace(/\s*[–-]\s*/, ' a ').trim();
/** "R$ 1.197,32" -> 1197.32 */
export const precoDoTexto = (s: string) => Number(s.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
/** A capa pequena para a lista: a leve de 400 px da capa de estúdio, ou a foto pequena do ML. */
export function capaPequenaDe(src: string, id: string): string {
  if (/\/estudio(-pro|-400|-640)?\/MLB\d+\.webp/.test(src)) return `/estudio-400/${id}.webp`;
  return src.replace(/-[A-Z]\.webp$/, '-V.webp');
}

/** A peça desta página, lida do HTML que já existe (também o "Você viu": peca/vistosPeca.ts). */
export function itemDaPagina(): ItemLista | null {
  const caminho = location.pathname;
  const id = /MLB\d+/.exec(caminho)?.[0];
  const slug = /\/peca\/([^/]+)\.html$/.exec(caminho)?.[1] ?? '';
  const prod = (window as unknown as { IZZAT_PRODUCT?: { id?: string; price?: number } }).IZZAT_PRODUCT;
  const nome = document.querySelector('.compra-nome')?.textContent?.trim() || '';
  if (!id || !nome) return null;
  const linha = document.querySelector('.compra-carro');
  const carro = linha?.querySelector('b')?.textContent?.trim() || '';
  const anos = (linha?.textContent || '').trim().slice(carro.length).replace(/^[\s·]+/, '').trim();
  const foto = document.querySelector<HTMLImageElement>('[data-trilho] img');
  return {
    id, slug: decodeURIComponent(slug), nome, carro, anos,
    cod: document.querySelector('.compra-cod .oem')?.textContent?.trim() || '',
    preco: prod?.id === id && typeof prod.price === 'number' ? prod.price : 0,
    capa: foto ? capaPequenaDe(foto.getAttribute('src') || '', id) : '',
  };
}

/** Liga um botão "pôr na lista" ao item (o da peça e os do "Vai junto"). `pintar(na, n)` desenha o estado. */
function ligar(botao: HTMLButtonElement, item: () => ItemLista | null, origem: string, pintar: (na: boolean, n: number) => void, depois?: (na: boolean) => void) {
  const id = () => item()?.id || '';
  const atual = () => { const l = lerLista(); pintar(tem(l, id()), l.length); };
  atual();
  window.addEventListener(EVENTO_LISTA, atual);
  botao.addEventListener('click', () => {
    const it = item();
    if (!it) return;
    const l = lerLista();
    if (tem(l, it.id)) {
      salvarLista(remover(l, it.id), 'remover', it.id, origem);
      avisarLista(`${it.nome} saiu da sua lista.`);
      depois?.(false);
      return;
    }
    const r = adicionarNaLista(it, origem);
    if (r === 'cheia') {
      avisarLista(`Sua lista já tem ${MAX_LISTA} peças, o máximo. Peça essas no WhatsApp e comece outra.`);
      botao.dispatchEvent(new CustomEvent('lista-cheia', { bubbles: true }));
      return;
    }
    avisarLista(`${it.nome} está na sua lista de orçamento: ${pecasTxt(lerLista().length)}.`);
    depois?.(true);
  });
}

/** A caixa de compra: "Adicionar à lista de orçamento" (só põe) e, com a peça na lista, o verde que LEVA à lista
 *  ("Na sua lista · Ver lista (n)", um link) com o "Tirar" pequeno e escrito ao lado: tocar no verde nunca tira a peça
 *  sem avisar (revisão 12, P3.1). O foco segue o toque (pôr -> o verde; tirar -> o "Adicionar") e o aviso sai no
 *  role=status. Com outras peças na lista (e esta fora), o "Ver lista (n)" à direita, como antes. */
export function ligarListaPeca() {
  const caixa = document.querySelector<HTMLElement>('.compra-lista');
  const botao = caixa?.querySelector<HTMLButtonElement>('button');
  if (!caixa || !botao) return;
  const item = itemDaPagina();
  if (!item || !item.preco) { caixa.hidden = true; return; }
  const ver = Object.assign(document.createElement('a'), { className: 'cl-ver', href: PAGINA_LISTA });
  // o verde: um link para a lista (o ladrilho com o visto + "Na sua lista · Ver lista (n)")
  const na = Object.assign(document.createElement('a'), { className: 'cl-na', href: PAGINA_LISTA });
  const tirar = Object.assign(document.createElement('button'), { type: 'button', className: 'cl-tirar' });
  tirar.innerHTML = 'Tirar <span class="sr-only">da lista de orçamento</span>';
  // o nome vem do texto ("Na sua lista Ver lista (3)"); no celular estreito, "Na lista · Ver lista (3)". Montado uma vez:
  // só o número muda (o visto não "pula" de novo a cada mudança da lista)
  na.innerHTML = `${SVG('lista-ok')}<span class="cl-na-txt"><b>Na <span class="cl-sua">sua </span>lista</b><span class="cl-sep" aria-hidden="true"> · </span><span class="cl-ir">Ver lista <span class="num"></span></span></span>${SETA}`;
  const naNum = na.querySelector<HTMLElement>('.num')!;
  ver.hidden = na.hidden = tirar.hidden = true;
  caixa.append(na, tirar, ver);
  let cheia: HTMLElement | null = null;
  const pintar = () => {
    const l = lerLista(), n = l.length, dentro = tem(l, item.id);
    botao.hidden = dentro;
    na.hidden = tirar.hidden = !dentro;
    ver.hidden = dentro || !n;
    naNum.textContent = `(${n})`;
    // o nome é o próprio texto ("Ver lista (3)"); o título diz por extenso
    ver.innerHTML = `<span>Ver lista</span> <span class="num">(${n})</span>${SETA}`;
    ver.title = `Ver a lista de orçamento: ${pecasTxt(n)}`;
    if (cheia && n < MAX_LISTA) { cheia.remove(); cheia = null; }
  };
  pintar();
  window.addEventListener(EVENTO_LISTA, pintar);
  botao.addEventListener('click', () => {
    const r = adicionarNaLista(item, 'peca');
    if (r === 'cheia') {
      avisarLista(`Sua lista já tem ${MAX_LISTA} peças, o máximo. Peça essas no WhatsApp e comece outra.`);
      if (!cheia) {
        cheia = Object.assign(document.createElement('p'), { className: 'cl-cheia' });
        cheia.innerHTML = `Sua lista já tem ${MAX_LISTA} peças, o máximo. <a href="${PAGINA_LISTA}">Peça essas no WhatsApp</a> e comece outra.`;
        caixa.append(cheia);
      }
      return;
    }
    pintar();
    na.focus({ preventScroll: true });
    avisarLista(`${item.nome} está na sua lista de orçamento: ${pecasTxt(lerLista().length)}.`);
  });
  tirar.addEventListener('click', () => {
    const l = lerLista();
    if (!tem(l, item.id)) return;
    salvarLista(remover(l, item.id), 'remover', item.id, 'peca');
    pintar();
    botao.focus({ preventScroll: true });
    const n = lerLista().length;
    avisarLista(`${item.nome} saiu da sua lista.${n ? ` Ficaram ${pecasTxt(n)}.` : ' A lista ficou vazia.'}`);
  });
}

/** "Vai junto": cada cartão ganha o "+ lista" no canto (dados lidos do próprio cartão). */
export function ligarVaiJunto(raiz: HTMLElement) {
  // o carro é o desta página (o "Vai junto" só mostra peças do mesmo carro)
  const carro = document.querySelector('.compra-carro b')?.textContent?.trim() || '';
  raiz.querySelectorAll<HTMLElement>(':scope > li').forEach((li) => {
    const a = li.querySelector<HTMLAnchorElement>('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const id = /MLB\d+/.exec(href)?.[0];
    const nome = li.querySelector('b')?.textContent?.trim() || '';
    if (!id || !nome) return;
    const img = li.querySelector('img');
    const item: ItemLista = {
      id, slug: /\/peca\/([^/]+)\.html$/.exec(href)?.[1] ?? '', nome, carro,
      // <small>2018–2024</small><small>Cód. <code>X</code></small> (o dos anos é o <small> sem o <code>)
      anos: anosDoCartao([...li.querySelectorAll('small')].find((s) => !s.querySelector('code'))?.textContent || ''),
      cod: li.querySelector('code')?.textContent?.trim() || '',
      preco: precoDoTexto(li.querySelector('.num')?.textContent || ''),
      capa: img ? capaPequenaDe(img.getAttribute('src') || '', id) : '',
    };
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'vj-add';
    b.innerHTML = SVG('lista-mais');
    // nome fixo e o estado no aria-pressed (o padrão do botão de alternar); o title diz o que o toque faz
    b.setAttribute('aria-label', `Adicionar à lista de orçamento: ${nome}`);
    li.append(b);
    ligar(b, () => item, 'vai-junto', (na) => {
      b.setAttribute('aria-pressed', String(na));
      b.classList.toggle('na-lista', na);
      b.title = na ? 'Na sua lista (tocar tira)' : 'Adicionar à lista de orçamento';
      b.querySelector('use')?.setAttribute('href', icone(na ? 'lista-ok' : 'lista-mais'));
    });
  });
}
