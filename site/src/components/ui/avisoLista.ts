// Aviso À VISTA da lista de orçamento (uma pílula no pé da tela, que some sozinha). Nasceu para a lista cheia: tocar no
// botão da lista de um cartão com 30 peças guardadas não mostrava nada (o aviso só existia para o leitor de tela:
// revisão 14, item 26). O leitor de tela continua com o role=status de quem chama; aqui é só o que se vê (e o link).
import { MAX_LISTA, PAGINA_LISTA } from '../../lib/lista';

/** A frase da lista cheia: a mesma da página da peça (peca/listaPeca.ts). */
export const TXT_LISTA_CHEIA = `Sua lista já tem ${MAX_LISTA} peças, o máximo. Mande estas no WhatsApp e comece outra.`;

let caixa: HTMLElement | null = null;
let sumir = 0;

/** Mostra o aviso por ~6 s (tocar de novo recomeça a conta). `link` = o atalho ao lado do texto. */
export function mostrarAvisoLista(txt: string, link: { href: string; texto: string } | null = { href: PAGINA_LISTA, texto: 'Ver a lista' }) {
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'aviso-lista';
    document.body.append(caixa);
  }
  const p = document.createElement('span');
  p.textContent = txt;
  caixa.replaceChildren(p);
  if (link) caixa.append(Object.assign(document.createElement('a'), { href: link.href, textContent: link.texto }));
  caixa.hidden = false;
  // entra no quadro seguinte (a transição precisa do estado de antes)
  requestAnimationFrame(() => caixa?.classList.add('visivel'));
  clearTimeout(sumir);
  sumir = window.setTimeout(() => {
    caixa?.classList.remove('visivel');
    sumir = window.setTimeout(() => { if (caixa) caixa.hidden = true; }, 260);
  }, 6000);
}

/** A lista cheia, à vista. */
export const avisarListaCheia = () => mostrarAvisoLista(TXT_LISTA_CHEIA);
