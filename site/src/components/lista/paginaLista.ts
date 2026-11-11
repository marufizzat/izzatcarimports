// /lista.html: monta a Lista de orçamento (o esqueleto está em pages/lista.astro). Dois modos:
//  - 'minha': as peças guardadas neste aparelho (lib/lista.ts). Tirar (com "Desfazer" no lugar), limpar (com
//    "Desfazer"), os preços e a disponibilidade conferidos no /dados/busca.json (o preço novo é gravado; a peça que saiu
//    do site fica "Já vendida", fora do total e do pedido).
//  - 'link': /lista.html?i=MLB1,MLB2 (a lista que alguém mandou): só para ver e pedir; "Guardar na minha lista" junta as
//    peças às de quem abriu (sem apagar nada) e o endereço volta a ser /lista.html.
// "Já vendida" só depois que o busca.json chegou e a peça não está nele; se ele não chegar, os valores guardados ficam,
// com um aviso discreto (nunca uma peça marcada vendida por falta de rede).
import { Busca, capaItem, type Indice, type Item } from '../../lib/busca';
import {
  lerLista, salvarLista, remover, restaurar, juntar, atualizar, itemDe, idsDoLink, linkDaLista, pecasTxt, total, totalWhats, desconto,
  EVENTO_LISTA, PAGINA_LISTA, MAX_LISTA, type ItemLista,
} from '../../lib/lista';
import { mensagemLista, linkWhats, precoWhats, anosTexto } from '../../lib/whats';
import { lerMeuCarro, nomeCarro, nomeModelos, linkCatalogo, EVENTO as EVENTO_CARRO, ABRIR } from '../../lib/meuCarro';
import { codigoPeca, brl } from '../catalogo/etiqueta';
import { icone } from '../../lib/icones';

const SITE = 'https://izzatcarimports.com.br';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const svg = (nome: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="${icone(nome)}"></use></svg>`;

/** A peça como o busca.json diz agora (nome, carro, anos, código, preço e a capa leve). */
export function itemDoIndice(it: Item): ItemLista {
  return itemDe({
    id: it.id, slug: it.h, nome: it.n, carro: nomeModelos({ b: it.b, m: it.m, ms: it.ms }), anos: anosTexto(it.y), cod: codigoPeca(it.o),
    preco: it.p, capa: capaItem(it, 'E'),
  })!;
}

export function iniciarLista() {
  const raiz = document.querySelector<HTMLElement>('[data-lst]');
  if (!raiz) return;
  const html = document.documentElement;
  const q = <T extends Element = HTMLElement>(s: string) => raiz.querySelector<T>(s)!;
  const ul = q('[data-lst-ul]'), nota = q('[data-lst-nota]'), caixaLink = q('[data-lst-link]');
  const h1 = q('[data-lst-h1]'), lead = q('[data-lst-lead]'), pe = q('[data-lst-pe]');
  const elQtd = q('[data-lst-qtd]'), elSub = q('[data-lst-sub]'), elDesc = q('[data-lst-desc]'), elTotal = q('[data-lst-total]'), elFora = q('[data-lst-fora]');
  const pedir = q<HTMLAnchorElement>('[data-lst-pedir]'), copiar = q<HTMLButtonElement>('[data-lst-copiar]'), caixaCarro = q('[data-lst-carro]');
  const desfazerTudo = q('[data-lst-desfazer-tudo]'), seuCarro = q<HTMLAnchorElement>('[data-lst-seu-carro]'), mais = q<HTMLAnchorElement>('[data-lst-mais]');
  const barra = document.querySelector<HTMLElement>('[data-lst-barra]');
  const barraTotal = barra?.querySelector<HTMLElement>('[data-lst-barra-total]');
  const barraPedir = barra?.querySelector<HTMLAnchorElement>('[data-lst-barra-pedir]');
  h1.tabIndex = -1;

  // aviso para o leitor de tela
  const aviso = Object.assign(document.createElement('p'), { className: 'sr-only' });
  aviso.setAttribute('role', 'status');
  document.body.append(aviso);
  const avisar = (t: string) => { aviso.textContent = ''; requestAnimationFrame(() => { aviso.textContent = t; }); };

  let idsLink = idsDoLink(location.search);
  if (!idsLink.length && /[?&]i=/.test(location.search)) history.replaceState(null, '', PAGINA_LISTA);
  let modo: 'minha' | 'link' = idsLink.length ? 'link' : 'minha';
  let estado: 'carregando' | 'ok' | 'erro' = 'carregando';
  let frescos: Map<string, Item> | null = null;
  /** a última peça tirada (o "Desfazer" fica no lugar dela) */
  let tirada: { item: ItemLista; i: number } | null = null;
  /** a lista inteira antes do "Limpar" ou de tirar a última (o "Desfazer" da lista vazia) */
  let antes: ItemLista[] | null = null;
  /** preço de quando a pessoa guardou, se mudou (mostra "Preço atualizado") */
  const precoAntes = new Map<string, number>();

  const existe = (id: string) => estado !== 'ok' || !!frescos?.has(id);
  /** As peças à vista: a lista guardada, ou as do link (com os dados do busca.json; sem eles, só o número do anúncio). */
  function itens(): ItemLista[] {
    if (modo === 'minha') return lerLista();
    return idsLink.map((id) => (frescos?.get(id) ? itemDoIndice(frescos.get(id)!) : { id, slug: '', nome: '', carro: '', anos: '', cod: '', preco: 0, capa: '' }));
  }
  /** As que entram no pedido e no total: as que existem no site (no link, só depois do busca.json). */
  const disponiveis = (l: ItemLista[]) => l.filter((x) => (modo === 'link' ? estado === 'ok' && frescos!.has(x.id) : existe(x.id)));

  function procurar(x: ItemLista): string {
    const u = new URLSearchParams({ q: `${x.nome} ${x.carro.replace(/ e /g, ' ')}`.trim() });
    return `/catalogo.html?${u}`;
  }

  function linha(x: ItemLista, ler: boolean): string {
    const vendida = !existe(x.id) || (modo === 'link' && estado === 'ok' && !frescos!.has(x.id));
    const href = x.slug && !vendida ? `/peca/${encodeURI(x.slug)}.html` : '';
    // a vendida fica sem foto (a capa dela já saiu do site)
    const img = x.capa && !vendida ? `<img src="${esc(x.capa)}" alt="" width="88" height="88" loading="lazy" decoding="async">` : '';
    const nome = x.nome || `Anúncio ${x.id}`;
    // carro e anos: no celular estreito os anos descem para a linha de baixo (sem o "·" sobrando no começo)
    const carro = x.carro && x.anos ? `${esc(x.carro)}<span class="lst-anos">${esc(x.anos)}</span>` : esc(x.carro || x.anos);
    let precos: string;
    if (vendida) {
      precos = `<span class="lst-vendida">Já vendida</span>${x.nome ? `<a class="lst-parecida" href="${esc(procurar(x))}">Procurar parecida</a>` : ''}`;
    } else {
      const era = precoAntes.get(x.id);
      // R$ e o número nunca se separam (\u00a0)
      precos = `<b class="lst-pw num">R$\u00a0${brl(precoWhats(x.preco))} <small>no WhatsApp</small></b>`
        + `<span class="lst-ps num">R$\u00a0${brl(x.preco)} no site</span>`
        + (era && era !== x.preco ? `<span class="lst-mudou">Preço atualizado (era R$\u00a0${brl(era)})</span>` : '');
    }
    return `<li class="lst-item${vendida ? ' vendida' : ''}${ler ? ' ler' : ''}" data-id="${x.id}">`
      + (href ? `<a class="lst-foto" href="${href}" tabindex="-1" aria-hidden="true">${img}</a>` : `<span class="lst-foto">${img}</span>`)
      + `<div class="lst-dados">${carro ? `<span class="lst-veic">${carro}</span>` : ''}`
      + (href ? `<a class="lst-nome" href="${href}">${esc(nome)}</a>` : `<span class="lst-nome">${esc(nome)}</span>`)
      + (x.cod ? `<span class="lst-cod">Cód. <span class="oem">${esc(x.cod)}</span></span>` : '') + `</div>`
      + `<div class="lst-precos">${precos}</div>`
      + (ler ? '' : `<button type="button" class="lst-tirar" data-tirar="${x.id}" aria-label="Tirar ${esc(nome)} da lista" title="Tirar da lista">${svg('tirar')}</button>`)
      + `</li>`;
  }

  function pintar() {
    const l = itens();
    const vazia = modo === 'minha' && !l.length;
    html.dataset.lst = modo === 'link' ? 'link' : vazia ? 'vazia' : 'cheia';
    const c = lerMeuCarro();

    // título e o aviso da lista de um link
    if (modo === 'link') {
      h1.textContent = 'Lista de orçamento';
      lead.textContent = `Mandaram esta lista para você: ${pecasTxt(idsLink.length)}. Peça tudo no WhatsApp ou guarde na sua lista.`;
      const minha = lerLista().length;
      caixaLink.hidden = false;
      if (!caixaLink.dataset.feito) {
        caixaLink.dataset.feito = '1';
        caixaLink.innerHTML = `<p>Esta lista veio por um link.<small data-lst-link-sub></small></p>`
          + `<button type="button" class="botao botao-linha" data-lst-guardar>${svg('lista-mais')}Guardar na minha lista</button>`;
      }
      caixaLink.querySelector('[data-lst-link-sub]')!.textContent = minha
        ? ` Guardar junta estas peças às ${pecasTxt(minha)} que já estão na sua lista (nada se perde).`
        : ' Guardando, ela fica neste aparelho para você pedir depois.';
    } else {
      h1.textContent = 'Sua lista de orçamento';
      lead.textContent = l.length
        ? `${pecasTxt(l.length)} na lista. Peça tudo de uma vez no WhatsApp, com 10% de desconto em cada peça.`
        : 'Junte as peças do serviço e peça tudo de uma vez no WhatsApp, com 10% de desconto em cada peça.';
      caixaLink.hidden = true;
    }

    // as peças (no link, enquanto o busca.json não chega, fica o esqueleto)
    if (!(modo === 'link' && estado === 'carregando')) {
      const linhas = l.map((x) => linha(x, modo === 'link'));
      if (tirada && modo === 'minha') {
        const desf = `<li class="lst-desfeito"><span><b>${esc(tirada.item.nome)}</b> saiu da lista.</span><button type="button" data-desfazer>Desfazer</button></li>`;
        linhas.splice(Math.min(tirada.i, linhas.length), 0, desf);
      }
      ul.innerHTML = linhas.join('');
      ul.removeAttribute('aria-busy');
    }
    pe.hidden = modo === 'link' && estado !== 'ok';

    // o aviso de baixo (rede)
    const txtNota = estado === 'erro'
      ? (modo === 'link' ? 'Não deu para abrir as peças desta lista agora. ' : 'Não deu para conferir os preços agora: os valores são os de quando você guardou cada peça. ')
      : '';
    nota.hidden = !txtNota;
    if (txtNota) nota.innerHTML = `${esc(txtNota)}<button type="button" class="lst-tentar" data-lst-tentar>Tentar de novo</button>`;

    // o resumo
    const disp = disponiveis(l);
    const conta = modo === 'link' && estado !== 'ok' ? null : disp;
    elQtd.textContent = conta ? `Preço no site (${pecasTxt(conta.length)})` : 'Preço no site';
    elSub.textContent = conta ? `R$ ${brl(total(conta))}` : '—';
    elDesc.textContent = conta ? `− R$ ${brl(desconto(conta))}` : '—';
    elTotal.textContent = conta ? `R$ ${brl(totalWhats(conta))}` : '—';
    const fora = estado === 'ok' ? l.length - disp.length : 0;
    elFora.hidden = !fora;
    elFora.textContent = fora ? `${pecasTxt(fora)} que já ${fora === 1 ? 'foi vendida ficou' : 'foram vendidas ficaram'} fora do total e do pedido.` : '';
    const msg = mensagemLista(disp, c ? nomeCarro(c) : '');
    const pode = disp.length > 0;
    for (const a of [pedir, barraPedir]) {
      if (!a) continue;
      a.href = linkWhats(msg);
      if (pode) a.removeAttribute('aria-disabled'); else a.setAttribute('aria-disabled', 'true');
    }
    pedir.tabIndex = pode ? 0 : -1;
    copiar.disabled = !pode;
    if (barraTotal) barraTotal.textContent = conta ? `R$ ${brl(totalWhats(conta))}` : '—';

    // o carro (vai na mensagem)
    caixaCarro.innerHTML = c
      ? `${svg('carro')}<span>Vai na mensagem: <b>${esc(nomeCarro(c))}</b></span><button type="button" data-lst-trocar>Trocar</button>`
      : `${svg('carro')}<span>Diga o seu carro e a gente confere se as peças servem nele.</span><button type="button" data-lst-trocar>Escolher</button>`;
    // vazia: o convite pelo carro salvo
    if (c) {
      seuCarro.href = linkCatalogo(c);
      seuCarro.querySelector('span')!.textContent = `Ver as peças do ${nomeCarro(c)}`;
      mais.href = linkCatalogo(c);
    } else {
      seuCarro.href = '/carros.html';
      seuCarro.querySelector('span')!.textContent = 'Escolher o meu carro';
      mais.href = '/catalogo.html';
    }
    desfazerTudo.hidden = !(vazia && antes && antes.length);
    if (!desfazerTudo.hidden) {
      desfazerTudo.innerHTML = `<span>${antes!.length === 1 ? `<b>${esc(antes![0].nome)}</b> saiu da lista.` : `A lista foi limpa (${pecasTxt(antes!.length)}).`}</span><button type="button" data-lst-desfazer-tudo-b>Desfazer</button>`;
    }
    barraVisivel();
  }

  // ---- busca.json: preço e disponibilidade de agora ----
  async function carregar() {
    estado = 'carregando';
    try {
      const r = await fetch('/dados/busca.json');
      if (!r.ok) throw new Error(String(r.status));
      const b = new Busca((await r.json()) as Indice);
      frescos = new Map(b.itens.map((it) => [it.id, it]));
      estado = 'ok';
      if (modo === 'minha') {
        // as guardadas ficam com os dados de agora (preço, nome, capa...); a que saiu do site fica como estava
        let l = lerLista(), mudou = false;
        for (const x of l) {
          const it = frescos.get(x.id);
          if (!it) continue;
          const novo = itemDoIndice(it);
          if (JSON.stringify(novo) === JSON.stringify(x)) continue;
          if (novo.preco !== x.preco && x.preco) precoAntes.set(x.id, x.preco);
          l = atualizar(l, x.id, novo);
          mudou = true;
        }
        if (mudou) { salvarLista(l, 'atualizar'); return; }   // o evento repinta
      }
    } catch {
      estado = 'erro';
    }
    pintar();
  }

  // ---- ações ----
  function tirar(id: string) {
    const l = lerLista();
    const i = l.findIndex((x) => x.id === id);
    if (i < 0) return;
    const item = l[i];
    const novo = remover(l, id);
    if (novo.length) { tirada = { item, i }; antes = null; } else { tirada = null; antes = l; }
    salvarLista(novo, 'remover', id);   // o evento repinta
    avisar(`${item.nome} saiu da lista. ${novo.length ? pecasTxt(novo.length) + ' na lista.' : 'A lista ficou vazia.'}`);
    (novo.length ? ul.querySelector<HTMLElement>('[data-desfazer]') : desfazerTudo.querySelector<HTMLElement>('button'))?.focus();
  }
  function desfazer() {
    if (!tirada) return;
    const { item, i } = tirada;
    tirada = null;
    salvarLista(restaurar(lerLista(), item, i), 'atualizar', item.id);
    avisar(`${item.nome} voltou para a lista.`);
    ul.querySelector<HTMLElement>(`[data-id="${item.id}"] .lst-nome`)?.focus();
  }
  function desfazerLimpar() {
    if (!antes) return;
    const l = antes;
    antes = null;
    salvarLista(juntar(l, lerLista()).lista, 'atualizar');
    avisar(`A lista voltou: ${pecasTxt(lerLista().length)}.`);
    h1.focus();
  }

  raiz.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button, a');
    if (!t) return;
    if (t.dataset.tirar) tirar(t.dataset.tirar);
    else if (t.hasAttribute('data-desfazer')) desfazer();
    else if (t.hasAttribute('data-lst-desfazer-tudo-b')) desfazerLimpar();
    else if (t.hasAttribute('data-lst-limpar')) {
      const l = lerLista();
      if (!l.length) return;
      antes = l;
      tirada = null;
      salvarLista([], 'limpar');
      avisar(`A lista foi limpa. Para trazer de volta, use Desfazer.`);
      desfazerTudo.querySelector<HTMLElement>('button')?.focus();
    } else if (t.hasAttribute('data-lst-tentar')) {
      nota.hidden = true;
      carregar();
    } else if (t.hasAttribute('data-lst-guardar')) {
      const doLink = itens().filter((x) => estado === 'ok' && frescos!.has(x.id));
      const r = juntar(lerLista(), doLink);
      salvarLista(r.lista, 'guardar');
      modo = 'minha';
      idsLink = [];
      history.replaceState(null, '', PAGINA_LISTA);
      pintar();
      avisar(`Pronto: ${pecasTxt(r.novas)} ${r.novas === 1 ? 'guardada' : 'guardadas'} na sua lista${r.fora ? `; ${r.fora} não couberam (o máximo é ${MAX_LISTA})` : ''}.`);
      h1.focus();
    } else if (t.hasAttribute('data-lst-trocar')) {
      window.dispatchEvent(new CustomEvent(ABRIR));
    } else if (t === seuCarro && !lerMeuCarro()) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent(ABRIR));
    }
  });

  // "Copiar o link da lista": o link com as peças que existem (quem abrir vê a mesma lista)
  const rotCopiar = copiar.querySelector('span')!;
  copiar.addEventListener('click', async () => {
    const l = itens();
    const disp = disponiveis(l);
    const url = SITE + linkDaLista((disp.length ? disp : l).map((x) => x.id));
    try {
      await navigator.clipboard.writeText(url);
      copiar.classList.add('ok');
      rotCopiar.textContent = 'Link copiado';
      avisar('Link da lista copiado. Cole no WhatsApp ou onde quiser.');
      setTimeout(() => { copiar.classList.remove('ok'); rotCopiar.textContent = 'Copiar o link da lista'; }, 2200);
    } catch {
      // sem permissão de copiar: o link num campo, já selecionado, para a pessoa copiar
      let campo = raiz.querySelector<HTMLInputElement>('.lst-copiar-campo');
      if (!campo) {
        campo = Object.assign(document.createElement('input'), { className: 'lst-copiar-campo', readOnly: true, type: 'text' });
        campo.setAttribute('aria-label', 'Link da lista');
        copiar.after(campo);
      }
      campo.value = url;
      campo.focus();
      campo.select();
      avisar('Não deu para copiar sozinho: o link está selecionado no campo, é só copiar.');
    }
  });

  // foto que não carrega: fica a placa clara (nunca o ícone quebrado)
  ul.addEventListener('error', (e) => { const img = e.target; if (img instanceof HTMLImageElement) img.classList.add('sem-capa'); }, true);

  // celular: a barra com o total aparece quando o "Pedir tudo" do resumo sai da tela
  let pedirVisivel = true;
  function barraVisivel() {
    if (!barra) return;
    const mostrar = !pedirVisivel && !pedir.hasAttribute('aria-disabled') && html.dataset.lst !== 'vazia';
    if (barra.classList.contains('visivel') === mostrar) return;
    barra.classList.toggle('visivel', mostrar);
    barra.setAttribute('aria-hidden', String(!mostrar));
    barraPedir?.setAttribute('tabindex', mostrar ? '0' : '-1');
  }
  if (barra && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { pedirVisivel = e.isIntersecting; barraVisivel(); }).observe(pedir);
  }

  window.addEventListener(EVENTO_LISTA, (e) => {
    const d = (e as CustomEvent<{ acao: string }>).detail;
    // peça posta ou tirada noutra aba: o "Desfazer" daqui perde o sentido
    if (d?.acao === 'outra-aba') { tirada = null; antes = null; }
    if (modo === 'minha' || d?.acao === 'outra-aba') pintar();
  });
  window.addEventListener(EVENTO_CARRO, pintar);

  pintar();
  carregar();
}
