// Os cartões "Parecidas à venda" da 404 da peça vendida. Só no navegador e só quando o endereço é de uma peça (a 404
// importa este arquivo sob demanda: a 404 comum não baixa a busca). Sem ilha React: o HTML do cartão é o MESMO do
// cartão do catálogo (Etiqueta, em catalogo/Catalogo.tsx) e do CartaoPeca.astro, montado aqui.
import { Busca, SIZES_CARTAO, foto, fotoCartao, type Indice, type Item } from './busca';
import { parecidas, type Vendida } from './vendida';
import {
  CLASSE_CARTAO, linhaCarro, precoCartao, SELO_WHATS, codigoPeca, dadosCarro, msgWhats, urlPeca, icone, linkWhats,
} from '../components/catalogo/etiqueta';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const atributos = (o: Record<string, string | number | undefined>) =>
  Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => ` ${k}="${esc(String(v))}"`).join('');

/** O cartão da peça (o desenho do catálogo), com o "Pedir no WhatsApp" de quem usa mouse. `sizes`: a largura da foto
 *  no lugar (SIZES_CARTAO); sem ela (ou com o índice do .map), a das parecidas da 404. */
export function cartaoHtml(it: Item, sizes?: string | number): string {
  const { carro, anos } = linhaCarro(it.b, it.m, it.y, it.ms);
  const pc = precoCartao(it.p);
  const cod = codigoPeca(it.o);
  const f = fotoCartao(it, typeof sizes === 'string' ? sizes : SIZES_CARTAO.parecidas);
  const leve = f.srcset ? ` srcset="${esc(f.srcset)}" sizes="${esc(f.sizes ?? '')}"` : '';
  const img = f.estudio
    ? `<img${leve} src="${esc(f.src)}" class="estudio" data-ml="${esc(it.i ? foto(it.i, 'O') : '')}" alt="" width="800" height="800" loading="lazy" decoding="async">`
    : `<img${leve} src="${esc(f.src)}" alt="" width="800" height="800" loading="lazy" decoding="async">`;
  const linha = carro ? `<span class="etiqueta-carro"><span class="etiqueta-modelo">${esc(carro)}</span>${it.dif ? ` <span class="etiqueta-dif">${esc(it.dif)}</span>` : ''}${anos ? `<span class="etiqueta-anos"><span class="etiqueta-sep"> · </span>${esc(anos)}</span>` : ''}</span>` : '';
  return `<div class="${CLASSE_CARTAO}"><a class="etiqueta" href="/peca/${esc(it.h)}.html"${atributos(dadosCarro(it.b, it.m, it.y, it.ms, it.ys, it.v1))}>`
    + `<div class="etiqueta-foto">${img}</div><div class="etiqueta-dados">${linha}<h3 class="etiqueta-nome">${esc(it.n)}</h3>`
    + (cod ? `<span class="etiqueta-cod" title="Código gravado na peça">Cód. <span class="oem">${esc(cod)}</span></span>` : '')
    + `<span class="sr-only">${pc.sr}</span><span class="etiqueta-valor num" aria-hidden="true"><s>R$ ${pc.de}</s><span class="etiqueta-preco"><small>R$</small>${pc.reais}<small>${pc.cent}</small></span><span class="etiqueta-wa">${SELO_WHATS}</span></span>`
    + `<span class="etiqueta-confia"><span>90 dias de garantia</span>${it.q === 1 ? '<b>Peça única</b>' : ''}</span>`
    + `</div></a><a class="etiqueta-acao" data-botao="pedir-cartao" href="${esc(linkWhats(msgWhats(it, urlPeca(it.h))))}" target="_blank" rel="noopener" aria-label="${esc(`Pedir no WhatsApp: ${it.n}`)}">`
    + `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="${icone('whats')}"></use></svg>Pedir no WhatsApp</a></div>`;
}

/** Foto que não carregou: a capa leve (srcset) dá lugar à capa inteira; ela, à foto do ML; se essa também falhar, fica a
 *  placa clara. */
export function vigiarFotos(raiz: HTMLElement) {
  raiz.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const ml = img.dataset.ml;
    if (img.hasAttribute('srcset') && img.classList.contains('estudio')) { img.removeAttribute('srcset'); img.removeAttribute('sizes'); }
    else if (ml && img.getAttribute('src') !== ml) { img.classList.remove('estudio'); img.src = ml; delete img.dataset.ml; }
    else img.classList.add('sem-capa');
  }, true);
}

/** Baixa o índice (o mesmo endereço do catálogo: quem já navegou tem em cache) e acha as parecidas. */
export async function carregarParecidas(v: Vendida) {
  const r = await fetch('/dados/busca.json');
  if (!r.ok) throw new Error(String(r.status));
  const busca = new Busca((await r.json()) as Indice);
  await busca.prepararIndice();
  return parecidas(busca, v);
}
