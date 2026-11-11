// A página sem conexão (/offline.html, pages/offline.astro): o que está guardado NESTE aparelho, sem rede nenhuma.
//  - a lista de orçamento (lib/lista.ts) com o total no WhatsApp (o mesmo pedido da /lista.html: mensagemLista);
//  - "Você viu" (lib/vistos.ts): as peças abertas, com o preço de quando a pessoa viu; as que o service worker guardou
//    abrem sem internet (selo) e as outras ficam apagadas;
//  - quando a conexão volta, a página recarrega sozinha (o endereço é o da página pedida: ela abre de verdade).
import { lerLista } from '../../lib/lista';
import { lerVistos, type Visto } from '../../lib/vistos';
import { lerMeuCarro, nomeCarro } from '../../lib/meuCarro';
import { linkWhats, mensagemLista, precoWhats, somaPrecos } from '../../lib/whats';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const brl = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const foto = (capa: string) => capa ? `<img data-capa="${esc(capa)}" alt="" decoding="async" onerror="this.classList.add('falhou')">` : '';

/** A capa que está guardada no aparelho: a leve do cartão (/estudio-400/) só existe no cache se a pessoa passou pelo
 *  catálogo; a da página da peça (/estudio/ ou /estudio-pro/, 1000 px) existe se ela abriu a peça. Sem nenhuma: a do
 *  endereço guardado (com rede, abre; sem rede, o quadro fica vazio no fundo de estúdio). */
async function capaGuardada(capa: string): Promise<string> {
  const m = /^\/estudio[\w-]*\/(MLB\d+)\.webp$/.exec(capa);
  if (!m || !('caches' in window)) return capa;
  for (const u of [capa, `/estudio-640/${m[1]}.webp`, `/estudio-pro/${m[1]}.webp`, `/estudio/${m[1]}.webp`]) {
    try { if (await caches.match(u)) return u; } catch { return capa; }
  }
  return capa;
}
function pintarCapas(raiz: Element) {
  raiz.querySelectorAll<HTMLImageElement>('img[data-capa]').forEach((img) => {
    capaGuardada(img.dataset.capa!).then((u) => { img.src = u; });
  });
}

async function guardada(slug: string): Promise<boolean> {
  try {
    if (!('caches' in window)) return false;
    return !!(await caches.match(`/peca/${slug}.html`));
  } catch { return false; }
}

function cartao(v: Visto, temCopia: boolean): string {
  const veic = [v.carro, v.anos].filter(Boolean).join(' · ');
  return `<li><a class="off-cartao${temCopia ? '' : ' sem-copia'}" href="/peca/${esc(v.slug)}.html">`
    + `<span class="off-foto">${foto(v.capa)}</span>`
    + (temCopia ? `<span class="off-selo">Abre sem internet</span>` : '')
    + `<span class="off-cartao-txt">${veic ? `<span class="off-veic">${esc(veic)}</span>` : ''}<span class="off-nome">${esc(v.nome)}</span>`
    + (v.preco > 0 ? `<span class="off-preco num">${brl(v.preco)}</span>` : '') + `</span></a></li>`;
}

export function iniciarOffline() {
  const raiz = document.querySelector('[data-pagina-offline]');
  if (!raiz) return;
  raiz.querySelector('[data-off-tentar]')?.addEventListener('click', () => location.reload());
  // a conexão voltou: o endereço é o da página que a pessoa pediu, então recarregar abre ela de verdade
  addEventListener('online', () => setTimeout(() => location.reload(), 600));

  // ---- lista de orçamento ----
  const lista = lerLista();
  const blocoLista = raiz.querySelector<HTMLElement>('[data-off-lista]')!;
  if (lista.length) {
    raiz.querySelector('[data-off-itens]')!.innerHTML = lista.map((x) =>
      `<li class="off-item"><span class="off-foto">${foto(x.capa)}</span><span class="off-item-dados"><b>${esc(x.nome)}</b>`
      + `<span>${esc([x.carro, x.anos].filter(Boolean).join(' · '))}</span></span><span class="off-item-preco num">${x.preco > 0 ? brl(precoWhats(x.preco)) : ''}</span></li>`).join('');
    const disp = lista.filter((x) => x.preco > 0);
    raiz.querySelector('[data-off-total]')!.textContent = brl(somaPrecos(disp).whats);
    const c = lerMeuCarro();
    const pedir = raiz.querySelector<HTMLAnchorElement>('[data-off-pedir]')!;
    pedir.href = linkWhats(mensagemLista(disp, c ? nomeCarro(c) : ''));
    blocoLista.hidden = false;
    pintarCapas(blocoLista);
  }

  // ---- "Você viu" ----
  const vistos = lerVistos();
  if (vistos.length) {
    Promise.all(vistos.map((v) => guardada(v.slug))).then((tem) => {
      // as que abrem sem internet primeiro (na ordem de quando a pessoa viu)
      const ordem = vistos.map((v, i) => ({ v, t: tem[i] })).sort((a, b) => Number(b.t) - Number(a.t));
      raiz.querySelector('[data-off-grade]')!.innerHTML = ordem.map(({ v, t }) => cartao(v, t)).join('');
      const bloco = raiz.querySelector<HTMLElement>('[data-off-vistos]')!;
      bloco.hidden = false;
      pintarCapas(bloco);
    });
  }
  if (!lista.length && !vistos.length) raiz.querySelector<HTMLElement>('[data-off-dica]')!.hidden = false;
}
