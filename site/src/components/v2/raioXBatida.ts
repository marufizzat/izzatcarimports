// "Bati o carro": o modo de batida do Raio-x (components/v2/RaioX.astro). Baixado só quando a pessoa chega perto do
// seletor de modo (ou quando o navegador folga com a arte à vista); os dados, só ao entrar no modo.
// - Na arte: os 8 pontos da batida (lib/batida.ts) no lugar de verdade, cada um um <button> (o do lado de lá fica na
//   borda visível, com a etiqueta dizendo o lado). Arte larga: etiqueta fixa com linha-guia; arte estreita: pontos
//   numerados + as fichas embaixo. Tocar acende a parte batida (o mesmo véu laranja das zonas).
// - No painel: a LISTA DO CONSERTO. Com carro (o salvo ou o da página): as peças do carro em cada linha, a mais barata
//   das PRINCIPAIS já marcada, e só quando ela É a peça do título da linha (lib/batida.ts: `ehDaLinha`; a linha que só
//   tem peça ligada vai para o pátio e a ligada fica em "Também costuma ir junto", sem marcar: revisão 15, P1-2). As
//   pequenas que "costumam ir junto" ficam para a pessoa marcar; "Outra opção" passa
//   pelas outras peças da mesma linha (nunca a palavra "trocar": é de política de loja). Sem carro: o estoque inteiro,
//   nada marcado (as peças são de carros diferentes) e o convite para dizer o carro. Linha principal sem peça: "a gente
//   procura no pátio" (entra no pedido como item para procurar, se a pessoa marcar).
// - O pé: o total das marcadas (somaPrecos de lib/whats.ts, em centavos), "Pedir o conserto no WhatsApp"
//   (mensagemConserto; data-botao="raiox-conserto" para o contato_whatsapp do rastreio.js) e "Guardar na lista"
//   (adicionarNaLista de lib/lista.ts: o cabeçalho ouve o evento).
// O que NUNCA se diz: que o kit está completo, prazo, frete, troca. Só o estoque de agora.
import css from './raioXBatida.css?inline';
import { PONTOS, PONTOS_DO_OUTRO_LADO, FRASE_PATIO, opcoesDoPonto, linhasDoPainel, marcadasDeInicio, poucoAnunciado, peDoConserto, repDe, linkDaLinha, linhaDoJson, type BatidaJson, type Linha, type Ponto, type Rep } from '../../lib/batida';
import { ARTE, fotoDoCodigo, type CarroFiltro, type LadoArte } from '../../lib/raioX';
import type { PontoTras } from '../../lib/raioXTras';
import { mensagemConserto, linkWhats, somaPrecos, precoWhats, DESCONTO_WHATS } from '../../lib/whats';
import { adicionarNaLista, lerLista, PAGINA_LISTA, MAX_LISTA, type ItemLista } from '../../lib/lista';
import type { Filtros, Item } from '../../lib/busca';

export const ARQUIVO_BATIDA = '/dados/batida.json';
export type { BatidaJson };

type Procurar = (f: Filtros) => Item[];
export type CarroDaVez = { procurar: Procurar | null; filtro: CarroFiltro; aviso: string; capa: (it: Item) => string };
export type Ctx = {
  raiz: HTMLElement; palco: HTMLElement; painel: HTMLElement; conteudo: HTMLElement; dica: HTMLElement; fichas: HTMLElement;
  home: boolean;
  /** o carro que vale agora (o salvo ou o da página), com a busca só dele; sem carro: procurar = null */
  carro(): Promise<CarroDaVez>;
  /** o carro na mensagem ("Volvo XC60 2019", "Volvo XC60, ano ____"; '' = sem carro) */
  carroMsg(ano?: number): string;
  /** "do seu XC60 2019" / "do XC60" (com o ano que a lista usa); '' = sem carro */
  doCarro(f: CarroFiltro): string;
  /** abre o seletor "Seu carro" */
  dizerCarro(): void;
  /** o ícone do WhatsApp (do sprite) */
  whats: string;
  /** "Girar o carro": a vista que a arte mostra agora e o pedido para girar (o ponto escolhido fica do outro lado) */
  lado(): LadoArte;
  girar(): Promise<boolean>;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number, t: number) => `${((v / t) * 100).toFixed(2)}%`;
const pausa = () => (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield?.() ?? new Promise<void>((ok) => setTimeout(ok, 0));
const pecasTxt = (n: number) => `${n} ${n === 1 ? 'peça' : 'peças'}`;
const SETA = '<svg class="rxb-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const TROCA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3l4 4-4 4M21 7H8M7 21l-4-4 4-4M3 17h13"/></svg>';

let estilo = false;
function porEstilo() {
  if (estilo) return;
  estilo = true;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
}

/** Uma linha do painel: a linha do kit, quantas peças, as opções (com carro: todas, as que são a peça da linha primeiro
 *  e a mais barata na frente; sem: a 1ª) e se a 1ª é a peça do título da linha. */
type LinhaP = { linha: Linha; n: number; ops: Rep[]; certa: boolean };
const semPeca = (linha: Linha): LinhaP => ({ linha, n: 0, ops: [], certa: false });
/** Sem carro: quantas linhas com peça aparecem antes do "Ver as N peças deste conserto". */
const NA_FRENTE_SEM_CARRO = 6;
type Estado = { op: number[]; marcadas: Set<number> };

export function ligarBatida(ctx: Ctx) {
  porEstilo();
  const { raiz, palco, painel, conteudo, dica, fichas } = ctx;
  const id = painel.id;
  // ---- a camada da arte: véus, áreas de toque, pontos e etiquetas (feita uma vez, escondida fora do modo) ----
  const camada = document.createElement('div');
  camada.className = 'rxb';
  camada.setAttribute('role', 'group');
  camada.setAttribute('aria-label', 'Onde foi a batida');
  const vb = `viewBox="0 0 ${ARTE.w} ${ARTE.h}"`;
  const poli = (p: string) => `M${p.trim().split(/\s+/).join('L')}Z`;
  // os pontos da vista: na da frente, os 8 de lib/batida.ts; na de trás ("Girar o carro"), os 5 que aparecem nela, com a
  // geometria de lib/raioXTras.ts (o nome, o número e as linhas continuam os do ponto de mesma chave)
  type Geo = Pick<Ponto, 'k' | 'ancora' | 'etiqueta' | 'toque' | 'realce'>;
  let ladoB: LadoArte = 'frente';
  let geoTras: PontoTras[] | null = null;
  const numero = (k: string) => PONTOS.findIndex((p) => p.k === k) + 1;
  function htmlCamada(geo: readonly Geo[]): string {
    const nome = (k: string) => PONTOS.find((p) => p.k === k)!;
    return `<svg class="rxb-camada rxb-escuros" ${vb} aria-hidden="true">${geo.map((p) => `<path data-b="${p.k}" fill-rule="evenodd" d="M-120,-120H${ARTE.w + 120}V${ARTE.h + 120}H-120Z ${p.realce.map(poli).join(' ')}"/>`).join('')}</svg>`
      + `<svg class="rxb-camada rxb-realces" ${vb} aria-hidden="true">${geo.map((p) => `<g data-b="${p.k}">${p.realce.map((r) => `<polygon points="${r}"/>`).join('')}</g>`).join('')}</svg>`
      + `<svg class="rxb-mapa" ${vb} aria-hidden="true"><g class="rxb-guias">${geo.map((p) => `<line data-b="${p.k}" x1="${p.ancora[0]}" y1="${p.ancora[1]}" x2="${p.etiqueta[0]}" y2="${p.etiqueta[1]}"/>`).join('')}</g>`
      + geo.map((p) => `<g class="rxb-toque" data-toque="${p.k}">${p.toque.map((t) => `<polygon points="${t}"/>`).join('')}</g>`).join('') + '</svg>'
      + '<span class="rxb-pergunta" aria-hidden="true">Toque onde foi a batida</span>'
      + geo.map((p) => `<button type="button" class="rxb-ponto" data-b="${p.k}" data-ponto="${p.k}" aria-pressed="false" aria-controls="${id}" style="left:${pct(p.ancora[0], ARTE.w)};top:${pct(p.ancora[1], ARTE.h)}"><span class="sr-only">Batida ${esc(nome(p.k).em)}</span><i class="num" aria-hidden="true">${numero(p.k)}</i></button>`).join('')
      + geo.map((p) => `<span class="rxb-etiqueta" data-b="${p.k}" data-toque="${p.k}" aria-hidden="true" style="left:${pct(p.etiqueta[0], ARTE.w)};top:${pct(p.etiqueta[1], ARTE.h)}">${esc(nome(p.k).nome)}</span>`).join('');
  }
  camada.innerHTML = htmlCamada(PONTOS);
  palco.appendChild(camada);
  // as fichas (um alvo maior para o dedo, com os mesmos números): fora do Tab e do leitor de tela, que têm os pontos
  const fila = document.createElement('div');
  fila.className = 'rxb-fichas';
  fila.setAttribute('aria-hidden', 'true');
  fila.innerHTML = PONTOS.map((p, i) => `<button type="button" tabindex="-1" data-b="${p.k}" data-toque="${p.k}"><i class="num">${i + 1}</i><span>${esc(p.nome)}</span></button>`).join('');
  fichas.appendChild(fila);
  let pecasVisuais: { el: HTMLElement; k: string }[] = [];
  let botoes: HTMLButtonElement[] = [];
  /** As peças da arte desta vista (refeitas quando o carro gira) e as fichas "do outro lado". */
  function lerCamada() {
    pecasVisuais = [...camada.querySelectorAll<HTMLElement>('[data-b]'), ...fila.querySelectorAll<HTMLElement>('[data-b]')].map((el) => ({ el, k: el.dataset.b! }));
    botoes = [...camada.querySelectorAll<HTMLButtonElement>('.rxb-ponto')];
    for (const f of fila.querySelectorAll<HTMLElement>('[data-b]')) f.classList.toggle('outro', PONTOS_DO_OUTRO_LADO[ladoB].includes(f.dataset.b!));
    // na vista da frente, o ponto do lado de lá (na borda visível) também gira o carro: a etiqueta dele avisa
    for (const e of camada.querySelectorAll<HTMLElement>('.rxb-etiqueta')) e.classList.toggle('outro', PONTOS_DO_OUTRO_LADO[ladoB].includes(e.dataset.b!));
  }
  lerCamada();
  /** "Girar o carro": a geometria da outra vista, baixada antes da troca (a troca em si é síncrona). */
  async function preparar(l: LadoArte) {
    if (l === 'tras' && !geoTras) geoTras = (await import('../../lib/raioXTras')).PONTOS_TRAS;
  }
  /** O carro girou: os pontos passam para o lugar deles na outra vista (o escolhido continua escolhido). */
  function virou(l: LadoArte) {
    if (l === ladoB || (l === 'tras' && !geoTras)) return;
    const foco = document.activeElement instanceof HTMLElement && camada.contains(document.activeElement) ? document.activeElement.dataset.b : undefined;
    ladoB = l;
    camada.innerHTML = htmlCamada(l === 'tras' ? geoTras! : PONTOS);
    lerCamada();
    acender();
    if (foco) camada.querySelector<HTMLElement>(`.rxb-ponto[data-b="${foco}"]`)?.focus({ preventScroll: true });
  }

  // ---- o estado ----
  let ligado = false;
  let ativo: string | null = null;
  let passando: string | null = null;
  let vez = 0;
  let carro: CarroDaVez | null = null;
  let erro = false;
  let json: Promise<BatidaJson> | null = null;
  const kits = new Map<string, LinhaP[]>();
  const estados = new Map<string, Estado>();
  const ponto = (k: string) => PONTOS.find((p) => p.k === k)!;
  const comCarro = () => !!carro?.procurar && !!carro.filtro.modelo;

  function acender() {
    const luz = passando ?? ativo;
    camada.classList.toggle('rxb-escolhido', !!ativo);
    for (const p of pecasVisuais) {
      p.el.classList.toggle('aceso', p.k === luz);
      p.el.classList.toggle('on', p.k === ativo);
    }
    for (const b of botoes) b.setAttribute('aria-pressed', String(b.dataset.b === ativo));
  }

  // ---- os dados: a busca do carro (uma linha por vez, sem tarefa longa) ou o JSON do estoque inteiro ----
  function kitComCarro(p: Ponto): LinhaP[] {
    const c = carro!;
    return linhasDoPainel(opcoesDoPonto(p, c.procurar!, c.filtro).map(({ linha, itens, certa }): LinhaP => ({ linha, n: itens.length, ops: itens.map((it) => repDe(it, c.capa)), certa })), semPeca);
  }
  async function kitDoEstoque(p: Ponto): Promise<LinhaP[]> {
    json ??= fetch(ARQUIVO_BATIDA).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<BatidaJson>; })
      .catch((e) => { json = null; throw e; });
    const j = await json;
    // a linha em que o link do catálogo mostraria peça do lado ou da posição oposta traz TODAS as peças dela (ops): o
    // painel passa por elas no "Outra opção", como com o carro salvo, e o link do catálogo não aparece (lib/batida.ts)
    return linhasDoPainel(p.linhas.map((linha, i): LinhaP => ({ linha, ...linhaDoJson(j, p.k, i) }))
      .filter((l) => l.n > 0 || !l.linha.extra), semPeca);
  }
  async function kitDe(k: string): Promise<LinhaP[]> {
    const pronto = kits.get(k);
    if (pronto) return pronto;
    const minha = vez;
    carro ??= await ctx.carro();
    if (minha !== vez) throw new Error('trocou');
    const kit = comCarro() ? kitComCarro(ponto(k)) : await kitDoEstoque(ponto(k));
    if (minha !== vez) throw new Error('trocou');
    kits.set(k, kit);
    // com carro: as principais já marcadas (marcadasDeInicio): a com peça, quando a peça é a do título, entra no total;
    // a sem peça vai como "a gente procura no pátio". Sem carro: nada marcado (as peças são de carros diferentes). A
    // peça pequena que "costuma ir junto" a pessoa marca se precisar (o total não infla sozinho). Ano salvo sem peça
    // (a lista é do modelo em todos os anos, com o aviso): nenhuma peça com preço marcada, são de outro ano.
    if (!estados.has(k)) estados.set(k, { op: kit.map(() => 0), marcadas: marcadasDeInicio(kit, comCarro(), !carro?.aviso) });
    return kit;
  }
  /** Ao entrar no modo: o carro e os 8 pontos contados quando o navegador folga (o toque no ponto já acha pronto). */
  async function aquecer() {
    const minha = vez;
    try {
      for (const p of PONTOS) {
        if (minha !== vez || !ligado) return;
        await kitDe(p.k);
        await pausa();
      }
      if (minha === vez && ligado && !ativo) aquecerPainel();
    } catch { /* o toque no ponto mostra o erro e o "Tentar de novo" */ }
  }
  /** Com as contas prontas e ninguém escolhido ainda: uma lista é montada fora da vista e desfeita (o estilo e as
   *  medidas das classes novas ficam calculados: o 1º toque num ponto não paga a 1ª vez). */
  function aquecerPainel() {
    const k = PONTOS[1].k;
    const kit = kits.get(k);
    if (!kit) return;
    const molde = conteudo.cloneNode(false) as HTMLElement;
    molde.removeAttribute('hidden');
    molde.removeAttribute('data-rx-conteudo');
    molde.classList.add('rx-molde');
    molde.setAttribute('aria-hidden', 'true');
    molde.inert = true;
    // sem os ids (a lista de verdade usa os mesmos) e sem baixar foto nenhuma
    molde.innerHTML = htmlPainel(k, kit).replace(/ (id|for|aria-describedby)="[^"]*"/g, '').replace(/<img [^>]*>/g, '');
    raiz.appendChild(molde);
    void molde.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => molde.remove()));
  }

  // ---- o painel ----
  const cabeca = (titulo: string, sub: string) => `<div class="rx-p-cabeca"><h3 class="rx-p-titulo" tabindex="-1">${esc(titulo)}</h3><p class="rx-p-sub">${sub}</p></div>`;
  const fotoRep = (r: Rep) => fotoDoCodigo(r.f);

  function linhaHtml(k: string, l: LinhaP, i: number, e: Estado, oculta = false): string {
    const r = l.ops[e.op[i]] ?? l.ops[0];
    const cid = `${id}-b${i}`;
    const src = fotoRep(r);
    const img = src ? `<img src="${esc(src)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : '';
    const href = `/peca/${esc(r.h)}.html`;
    const de = comCarro() ? r.anos : [r.carro, r.anos].filter(Boolean).join(' · ');
    const outras = l.ops.length > 1
      ? `<button type="button" class="rxb-trocar" data-trocar="${i}">${TROCA}<span>Outra opção<span class="sr-only"> de ${esc(l.linha.nome)}:</span></span><small class="num">${e.op[i] + 1} de ${l.ops.length}</small></button>`
      : l.n > 1 ? `<a class="rxb-ver" href="${esc(linkDaLinha(l.linha, carro?.filtro ?? {}))}">Ver as ${l.n} no catálogo${SETA}</a>` : '';
    return `<li class="rxb-linha" data-i="${i}"${oculta ? ' hidden' : ''}>`
      + `<span class="rxb-check"><input type="checkbox" id="${cid}" data-marca="${i}" aria-describedby="${cid}-p ${cid}-v"${e.marcadas.has(i) ? ' checked' : ''}><span class="rxb-caixa" aria-hidden="true"></span></span>`
      + `<a class="rxb-foto" href="${href}" tabindex="-1" aria-hidden="true">${img}</a>`
      + `<div class="rxb-txt"><label class="rxb-nome" for="${cid}">${esc(l.linha.nome)}<span class="rxb-tem num">Tem ${l.n}</span></label>`
      + `<a class="rxb-peca" id="${cid}-p" href="${href}">${esc(r.n)}</a>${de ? `<span class="rxb-de">${esc(de)}</span>` : ''}</div>`
      + `<div class="rxb-preco num" id="${cid}-v"><s><span class="sr-only">no site </span>R$ ${brl(r.p)}</s><b>R$ ${brl(precoWhats(r.p))}</b><small>no WhatsApp</small></div>`
      + `${outras ? `<div class="rxb-acao">${outras}</div>` : ''}</li>`;
  }

  /** As peças marcadas, na ordem em que a lista aparece (as principais, depois as que costumam ir junto): a mensagem
   *  do WhatsApp e a Lista de orçamento seguem a tela. */
  const marcadasDe = (kit: LinhaP[], e: Estado): Rep[] => [false, true].flatMap((extra) =>
    kit.flatMap((l, i) => (e.marcadas.has(i) && l.n && !!l.linha.extra === extra ? [l.ops[e.op[i]] ?? l.ops[0]] : [])));

  function pintarPe(k: string, kit: LinhaP[], e: Estado, falar = true) {
    const pe = conteudo.querySelector<HTMLElement>('.rxb-painel');
    if (!pe || !pe.querySelector('.rxb-fixo')) return;
    const itens = marcadasDe(kit, e);
    const patio = kit.flatMap((l, i) => (e.marcadas.has(i) && !l.n ? [l.linha.nome] : []));
    const { site, whats } = somaPrecos(itens.map((r) => ({ preco: r.p })));
    const total = pe.querySelector<HTMLElement>('.rxb-total')!;
    const pedir = pe.querySelector<HTMLAnchorElement>('.rxb-pedir')!;
    const guardar = pe.querySelector<HTMLButtonElement>('.rxb-guardar')!;
    const pe2 = peDoConserto(itens.length, patio.length);
    const nada = pe2.estado === 'nada';
    // o botão diz o que o pedido é: o orçamento (com preço) ou a procura no pátio (sem total em dinheiro)
    const rotulo = pedir.querySelector<HTMLElement>('.rxb-pedir-t');
    if (rotulo && rotulo.textContent !== pe2.botao) rotulo.textContent = pe2.botao;
    pedir.dataset.botao = pe2.dataBotao;
    pedir.querySelector<HTMLElement>('.rxb-pedir-d')?.toggleAttribute('hidden', pe2.estado !== 'conserto');
    const txt = nada ? '<span class="rxb-t-n">Marque as peças que você precisa.</span>'
      : !itens.length ? `<span class="rxb-t-n">${patio.length === 1 ? '1 peça' : `${patio.length} peças`} para a gente procurar no pátio</span>`
      : `<span class="rxb-t-n">${itens.length === 1 ? '1 peça marcada' : `${itens.length} peças marcadas`}${patio.length ? ` + ${patio.length} para procurar` : ''}</span>`
        + `<span class="rxb-t-v num">de <s>R$ ${brl(site)}</s> por <b>R$ ${brl(whats)}</b> <small>no WhatsApp</small></span>`;
    // o aviso do leitor de tela só quando a pessoa mexe (não ao abrir o ponto)
    if (falar) total.innerHTML = txt;
    else { total.removeAttribute('aria-live'); total.innerHTML = txt; requestAnimationFrame(() => total.setAttribute('aria-live', 'polite')); }
    // nada marcado: o pé não fica preso à tela (um botão apagado não precisa seguir a pessoa)
    total.parentElement!.classList.toggle('rxb-solto', nada);
    if (nada) { pedir.removeAttribute('href'); pedir.setAttribute('aria-disabled', 'true'); }
    else {
      pedir.removeAttribute('aria-disabled');
      pedir.href = linkWhats(mensagemConserto({
        ponto: ponto(k).em, meuCarro: ctx.carroMsg(comCarro() ? carro!.filtro.ano : undefined),
        itens: itens.map((r) => ({ nome: r.n, id: r.id, cod: r.cod, carro: r.carro, anos: r.anos, preco: r.p })), patio,
      }));
    }
    guardar.disabled = !itens.length;
  }

  function htmlPainel(k: string, kit: LinhaP[]): string {
    const p = ponto(k);
    const e = estados.get(k)!;
    const tem = kit.filter((l) => l.n);
    const patio = kit.map((l, i) => ({ l, i })).filter((x) => !x.l.n);
    const dc = comCarro() ? ctx.doCarro(carro!.filtro) : '';
    // sem nenhuma peça anunciada, o painel não termina num vazio: a lista do conserto vira o pedido de pátio
    const sub = tem.length
      ? `${dc ? `${esc(dc)} · ` : ''}${tem.length === 1 ? '1 peça deste conserto' : `${tem.length} peças deste conserto`} ${dc ? 'no estoque agora' : 'no estoque inteiro'}`
      : `${dc ? `${esc(dc)} · ` : ''}sem anúncio agora: a gente procura no pátio`;
    // pouca peça anunciada para o carro (0 ou 1 linha principal): a lista de pátio vem primeiro
    const patioPrimeiro = comCarro() && poucoAnunciado(kit);
    const htmlPatio = patio.length
      ? `<fieldset class="rxb-patio${patioPrimeiro ? ' rxb-patio-1' : ''}"><legend>A gente procura no pátio</legend>`
        + `<p>${esc(FRASE_PATIO)}</p><div class="rxb-chips">`
        + patio.map(({ l, i }) => `<label class="rxb-chip"><input type="checkbox" data-marca="${i}"${e.marcadas.has(i) ? ' checked' : ''}><span>${esc(l.linha.nome)}</span></label>`).join('')
        + '</div></fieldset>'
      : '';
    let html = `<div class="rxb-painel">${cabeca(`Batida ${p.em}`, sub)}`;
    if (carro?.aviso) html += `<p class="rx-p-aviso">${esc(carro.aviso)}</p>`;
    if (!comCarro()) {
      html += '<div class="rxb-convite"><p><b>Qual é o seu carro?</b> Com o modelo e o ano, a lista mostra só as peças que servem nele, com o total do conserto.</p>'
        + '<button type="button" class="botao botao-linha rxb-dizer" data-dizer>Dizer o meu carro</button></div>';
    }
    // sem carro, a lista é do estoque inteiro (longa, e de carros diferentes): as 6 primeiras e o resto atrás do botão.
    // Com carro, todas à vista (estão marcadas e entram no total: nada marcado fica escondido).
    const cabem = comCarro() ? Infinity : NA_FRENTE_SEM_CARRO;
    let vistas = 0;
    if (patioPrimeiro) html += htmlPatio;
    if (tem.length) {
      // primeiro as peças principais do conserto (com carro, já marcadas); depois as pequenas que costumam ir junto
      const grupo = (extra: boolean) => kit.map((l, i) => (l.n && !!l.linha.extra === extra ? linhaHtml(k, l, i, e, ++vistas > cabem && !e.marcadas.has(i)) : '')).join('');
      const principais = grupo(false);
      const junto = grupo(true);
      if (principais) html += `<ul class="rxb-linhas" aria-label="Peças principais do conserto">${principais}</ul>`;
      if (junto) html += `<p class="rxb-junto${vistas - kit.filter((l) => l.n && l.linha.extra).length >= cabem ? ' rxb-junto-oculto' : ''}">Também costuma ir junto</p><ul class="rxb-linhas" aria-label="Peças que costumam ir junto">${junto}</ul>`;
      if (tem.length > cabem) html += `<button type="button" class="rxb-mais" data-mais aria-expanded="false">Ver as ${tem.length} peças deste conserto</button>`;
    }
    if (!patioPrimeiro) html += htmlPatio;
    // o total e o botão: filhos diretos do painel (presos ao pé da tela enquanto a lista inteira rola)
    html += `<div class="rxb-fixo"><p class="rxb-total" role="status" aria-live="polite"></p>`
      + `<a class="botao botao-laranja rxb-pedir" data-botao="raiox-conserto" target="_blank" rel="noopener">${ctx.whats}<span class="rxb-pedir-t">Pedir o conserto no WhatsApp</span><span class="sr-only rxb-pedir-d">, com ${DESCONTO_WHATS}% de desconto</span></a></div>`
      + `<div class="rxb-pe"><button type="button" class="botao botao-linha rxb-guardar">Guardar na lista</button>`
      + `<p class="rxb-status" role="status" aria-live="polite"></p>`
      + `<p class="rxb-honesto">Peça usada: quando vende, acabou. A gente confere na peça antes de você comprar.</p></div></div>`;
    return html;
  }
  function mostrarPainel(k: string, kit: LinhaP[], focar: boolean) {
    dica.hidden = true;
    conteudo.hidden = false;
    painel.classList.add('aberto');
    conteudo.innerHTML = htmlPainel(k, kit);
    pintarPe(k, kit, estados.get(k)!, false);
    if (focar) conteudo.querySelector<HTMLElement>('.rx-p-titulo')?.focus({ preventScroll: true });
  }

  function esqueleto(k: string) {
    dica.hidden = true;
    conteudo.hidden = false;
    painel.classList.add('aberto');
    conteudo.innerHTML = `<div class="rxb-painel">${cabeca(`Batida ${ponto(k).em}`, 'Montando a lista do conserto…')}`
      + `<ul class="rxb-linhas rxb-esq" aria-hidden="true">${'<li class="rxb-linha"><span class="rxb-check"></span><span class="rxb-foto"></span><span class="rxb-txt"><i></i><i></i></span></li>'.repeat(4)}</ul></div>`;
  }

  function mostrarErro(k: string) {
    conteudo.innerHTML = `<div class="rxb-painel">${cabeca(`Batida ${ponto(k).em}`, 'Sem conexão para montar a lista agora.')}`
      + '<p class="rx-p-vazio">Não deu para buscar as peças. Confira a internet e tente de novo.</p>'
      + '<div class="rx-p-acoes"><button type="button" class="botao botao-linha" data-de-novo>Tentar de novo</button></div></div>';
  }

  /** O "como funciona" do modo: o MESMO cartão das zonas (a mesma caixa: trocar de modo não muda a altura de nada), só
   *  com os textos da batida. No celular ele não aparece (a pergunta fica na arte). */
  const DICA = {
    t: 'Onde foi a batida?',
    p: ['Toque no ponto da batida, na imagem ou nos nomes logo abaixo dela.',
      'Veja as peças daquele conserto que a gente tem, com o preço do site e o do WhatsApp.',
      'Marque o que você precisa e peça tudo de uma vez no WhatsApp.'],
  };
  let dicaZonas: typeof DICA | null = null;
  function textosDica(batida: boolean) {
    const b = dica.querySelector('b');
    const lis = [...dica.querySelectorAll('li')];
    if (!b || lis.length !== 3) return;
    dicaZonas ??= { t: b.textContent ?? '', p: lis.map((li) => li.lastChild?.textContent ?? '') };
    const x = batida ? DICA : dicaZonas;
    b.textContent = x.t;
    lis.forEach((li, n) => { if (li.lastChild) li.lastChild.textContent = x.p[n]; });
  }
  function mostrarDica() {
    textosDica(true);
    conteudo.hidden = true;
    conteudo.innerHTML = '';
    dica.hidden = false;
    painel.classList.remove('aberto');
  }

  let escolhidaEm = 0;
  async function selecionar(k: string, como: { focar?: boolean; rolar?: boolean } = {}) {
    raiz.classList.add('tocado');
    escolhidaEm = performance.now();
    // o ponto fica do outro lado do carro: o carro gira sozinho (a lista monta enquanto isso)
    if (PONTOS_DO_OUTRO_LADO[ctx.lado()].includes(k)) void ctx.girar();
    const igual = ativo === k && !!conteudo.querySelector('.rxb-pe');
    ativo = k;
    passando = null;
    acender();
    if (igual) { if (como.focar) conteudo.querySelector<HTMLElement>('.rx-p-titulo')?.focus({ preventScroll: true }); return; }
    const minha = vez;
    const pronto = kits.get(k);
    if (pronto) {
      // a parte acende já; a lista entra na tarefa seguinte, depois da pintura (duas tarefas curtas em vez de uma longa)
      await new Promise<void>((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
      if (ativo !== k || minha !== vez || !ligado) return;
      mostrarPainel(k, pronto, !!como.focar);
    } else {
      esqueleto(k);
      if (como.focar) conteudo.querySelector<HTMLElement>('.rx-p-titulo')?.focus({ preventScroll: true });
      try {
        const kit = await kitDe(k);
        if (ativo !== k || minha !== vez || !ligado) return;
        mostrarPainel(k, kit, false);
      } catch {
        if (ativo === k && minha === vez && ligado) { erro = true; mostrarErro(k); }
        return;
      }
    }
    requestAnimationFrame(() => setTimeout(() => {
      if (ativo !== k || !ligado) return;
      const f = fila.querySelector<HTMLElement>(`[data-b="${k}"]`);
      if (f && fila.scrollWidth > fila.clientWidth) {
        const fr = f.getBoundingClientRect();
        const lr = fila.getBoundingClientRect();
        fila.scrollLeft += fr.left - lr.left - (lr.width - fr.width) / 2;
      }
      if (como.rolar || como.focar) {
        const r = painel.getBoundingClientRect();
        const falta = r.top + Math.min(r.height, 260) - innerHeight;
        if (falta > 0) scrollBy({ top: falta + 16, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }));
  }

  function limpar(devolverFoco: boolean) {
    const k = ativo;
    const dentro = raiz.contains(document.activeElement);
    ativo = null;
    passando = null;
    acender();
    mostrarDica();
    if (devolverFoco && k && dentro) camada.querySelector<HTMLElement>(`.rxb-ponto[data-b="${k}"]`)?.focus({ preventScroll: true });
  }

  // ---- ouvintes (delegados: a camada, as fichas e o painel) ----
  const comMouse = matchMedia('(hover: hover) and (pointer: fine)');
  const noToque = (e: Event) => {
    const alvo = (e.target as Element).closest<HTMLElement>('[data-toque], [data-ponto]');
    if (!alvo || !ligado) return;
    const k = alvo.dataset.ponto ?? alvo.dataset.toque!;
    // Enter/Espaço no ponto (clique sem ponteiro: detail 0) leva o foco ao painel; o toque só abre
    void selecionar(k, { focar: !!alvo.dataset.ponto && (e as MouseEvent).detail === 0, rolar: true });
  };
  camada.addEventListener('click', noToque);
  fila.addEventListener('click', noToque);
  camada.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || !comMouse.matches || performance.now() - escolhidaEm < 700) return;
    const k = (e.target as Element).closest<HTMLElement>('[data-toque], [data-ponto]');
    const novo = k ? k.dataset.ponto ?? k.dataset.toque! : null;
    if (novo !== passando) { passando = novo; acender(); }
  });
  camada.addEventListener('pointerleave', () => { if (passando) { passando = null; acender(); } });
  camada.addEventListener('focusin', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('.rxb-ponto');
    if (b && b.matches(':focus-visible') && !ativo) { passando = b.dataset.b!; acender(); }
  });
  camada.addEventListener('focusout', () => { if (passando) { passando = null; acender(); } });

  const noPainel = (e: Event) => {
    if (!ligado || !ativo) return;
    const alvo = e.target as HTMLElement;
    const k = ativo;
    if (alvo.closest('[data-dizer]')) { ctx.dizerCarro(); return; }
    const mais = alvo.closest<HTMLElement>('[data-mais]');
    if (mais) {
      const ocultas = [...conteudo.querySelectorAll<HTMLElement>('.rxb-linha[hidden]')];
      for (const li of ocultas) li.hidden = false;
      conteudo.querySelector('.rxb-junto-oculto')?.classList.remove('rxb-junto-oculto');
      mais.remove();
      ocultas[0]?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
      return;
    }
    if (alvo.closest('[data-de-novo]')) { erro = false; ativo = null; void selecionar(k, { focar: true }); return; }
    const kit = kits.get(k);
    const est = estados.get(k);
    if (!kit || !est) return;
    const trocar = alvo.closest<HTMLElement>('[data-trocar]');
    if (trocar) {
      const i = Number(trocar.dataset.trocar);
      est.op[i] = (est.op[i] + 1) % kit[i].ops.length;
      est.marcadas.add(i);
      const li = trocar.closest('li')!;
      li.outerHTML = linhaHtml(k, kit[i], i, est);
      const novo = conteudo.querySelector<HTMLElement>(`[data-trocar="${i}"]`);
      novo?.focus({ preventScroll: true });
      const r = kit[i].ops[est.op[i]];
      falar(`${kit[i].linha.nome}: ${r.n}, R$ ${brl(precoWhats(r.p))} no WhatsApp. Opção ${est.op[i] + 1} de ${kit[i].ops.length}.`);
      pintarPe(k, kit, est);
      return;
    }
    if (alvo.closest('.rxb-guardar')) { guardar(k, kit, est); return; }
    const pedir = alvo.closest<HTMLElement>('.rxb-pedir');
    if (pedir?.getAttribute('aria-disabled') === 'true') e.preventDefault();
  };
  conteudo.addEventListener('click', noPainel);
  conteudo.addEventListener('change', (e) => {
    if (!ligado || !ativo) return;
    const caixa = (e.target as HTMLElement).closest<HTMLInputElement>('input[data-marca]');
    const kit = kits.get(ativo);
    const est = estados.get(ativo);
    if (!caixa || !kit || !est) return;
    const i = Number(caixa.dataset.marca);
    if (caixa.checked) est.marcadas.add(i); else est.marcadas.delete(i);
    pintarPe(ativo, kit, est);
  });

  function falar(txt: string, html = '') {
    const s = conteudo.querySelector<HTMLElement>('.rxb-status');
    if (!s) return;
    s.innerHTML = html || esc(txt);
    s.classList.toggle('rxb-status-on', !!html);
  }

  function guardar(k: string, kit: LinhaP[], est: Estado) {
    const itens = marcadasDe(kit, est);
    let ok = 0, ja = 0, cheia = 0;
    for (const r of itens) {
      const item: ItemLista = { id: r.id, slug: r.h, nome: r.n, carro: r.carro, anos: r.anos, cod: r.cod, preco: r.p, capa: fotoRep(r) };
      const res = adicionarNaLista(item, 'raiox-batida');
      if (res === 'ok') ok++; else if (res === 'ja') ja++; else cheia++;
    }
    const n = lerLista().length;
    const partes = [
      ok ? `${ok === 1 ? '1 peça guardada' : `${ok} peças guardadas`} na sua lista` : '',
      ja ? `${ja === 1 ? '1 já estava' : `${ja} já estavam`} nela` : '',
      cheia ? `${cheia === 1 ? '1 não coube' : `${cheia} não couberam`}: a lista leva até ${MAX_LISTA} peças` : '',
    ].filter(Boolean).join(' · ');
    const patio = kit.some((l, i) => est.marcadas.has(i) && !l.n);
    falar('', `<span>${esc(partes)}.${patio ? ' As de pátio vão só no pedido do WhatsApp.' : ''}</span> <a href="${PAGINA_LISTA}">Ver a lista (${n})</a>`);
  }

  // ---- entrar e sair do modo ----
  function entrar(pontoInicial?: string) {
    ligado = true;
    if (pontoInicial && PONTOS.some((p) => p.k === pontoInicial)) { textosDica(true); void selecionar(pontoInicial, { rolar: true }); }
    else {
      ativo = null;
      acender();
      mostrarDica();
    }
    // a 1ª vez que a camada aparece: desenhar os dois véus uma vez (quase transparentes), o 1º toque não paga
    const k = PONTOS[1].k;
    const els = [...camada.querySelectorAll<HTMLElement>(`.rxb-camada [data-b="${k}"]`)];
    for (const el of els) el.classList.add('aquece');
    requestAnimationFrame(() => requestAnimationFrame(() => { for (const el of els) el.classList.remove('aquece'); }));
    if ('requestIdleCallback' in window) requestIdleCallback(() => void aquecer(), { timeout: 1200 });
    else setTimeout(() => void aquecer(), 150);
  }
  function sair() {
    ligado = false;
    ativo = null;
    passando = null;
    acender();
    textosDica(false);
  }
  /** O carro mudou (salvou, trocou, tirou): as listas e as marcas recomeçam com o carro novo. */
  function trocouCarro() {
    vez++;
    carro = null;
    erro = false;
    kits.clear();
    estados.clear();
    if (!ligado) return;
    if (ativo) { const k = ativo; ativo = null; void selecionar(k); }
    void aquecer();
  }

  return {
    entrar, sair, trocouCarro, selecionar, preparar, virou,
    /** Esc: limpa o ponto e devolve o foco a ele */
    esc: () => { if (ligado && ativo) { limpar(true); return true; } return false; },
    get erro() { return erro; },
  };
}
export type Batida = ReturnType<typeof ligarBatida>;
