// As vistas "por dentro": o 2º nível do Raio-x (uma parte do carro que se abre). Do painel de cada zona, o botão
// "Ver o motor por dentro" troca a arte do carro pela vista explodida daquela parte, no MESMO palco (a mesma proporção:
// nada muda de tamanho). Baixado só no clique do botão (aquecido quando o dedo/mouse encosta nele); a arte e a tabela
// das peças de cada vista (lib/raioXFrente.ts, lib/porDentro/*.ts) descem só quando a vista DELA abre.
// - Cada peça da arte é um link de verdade, desenhado na forma dela: passar o mouse ou focar acende a forma e mostra o
//   nome e quantas há (do carro salvo, do carro da página ou do estoque); o clique leva ao catálogo filtrado naquele
//   tipo/lado. No toque: o 1º toque acende e mostra o rótulo (que é o link); o 2º vai.
// - Peça sem anúncio (ou a que o estoque não tem como tipo: o capô, a tampa traseira, os bancos): cinza, e o link é o
//   WhatsApp "a gente procura no pátio" (data-botao="raio-x", o mesmo do painel das zonas).
// - Os números da arte são os da lista do painel (os mesmos links, um alvo fácil para o dedo).
// - "Voltar ao carro" (na arte e no painel) e Esc devolvem a arte do carro e o foco ao botão que abriu.
// A troca usa a View Transition do navegador quando existe (zoom a partir da parte do carro); sem ela, ou com
// "reduzir movimento"/aparelho fraco, troca na hora.
import css from './raioXPorDentro.css?inline';
import { contarComLigadas, ligadaDe, ligadasTxt, type Ligada, type PontoQuente } from '../../lib/porDentro/base';
import { VISTAS, ARTE_VISTA, ARQUIVO_DENTRO, arteDaVista, type Vista } from '../../lib/raioXVistas';
import { ZONAS, ARTE, linkLinha, qtdPecas, fotoDoCodigo, type CarroFiltro } from '../../lib/raioX';
import { precoWhats } from '../../lib/whats';
import { linkProcuraPeca } from '../../lib/aviso';
import type { Filtros, Item } from '../../lib/busca';

/** A tabela de cada vista (as peças e a forma de cada uma), pela chave da zona: um pedaço por vista. As duas laterais
 *  usam a mesma, com o lado de cada uma nos links. */
const TABELAS: Record<string, () => Promise<PontoQuente[]>> = {
  frente: () => import('../../lib/raioXFrente').then((m) => m.PONTOS_QUENTES),
  motor: () => import('../../lib/porDentro/motor').then((m) => m.PONTOS),
  'lateral-esquerda': () => import('../../lib/porDentro/lateral').then((m) => m.pontosLateral('E')),
  'lateral-direita': () => import('../../lib/porDentro/lateral').then((m) => m.pontosLateral('D')),
  interior: () => import('../../lib/porDentro/interior').then((m) => m.PONTOS),
  teto: () => import('../../lib/porDentro/teto').then((m) => m.PONTOS),
  traseira: () => import('../../lib/porDentro/traseira').then((m) => m.PONTOS),
  rodas: () => import('../../lib/porDentro/rodas').then((m) => m.PONTOS),
  embaixo: () => import('../../lib/porDentro/embaixo').then((m) => m.PONTOS),
};
type Procurar = (f: Filtros) => Item[];
export type CtxDentro = {
  raiz: HTMLElement; palco: HTMLElement; painel: HTMLElement; conteudo: HTMLElement; dica: HTMLElement; fichas: HTMLElement;
  home: boolean;
  carro(): Promise<{ procurar: Procurar | null; filtro: CarroFiltro; aviso: string; capa?: (it: Item) => string }>;
  /** o carro na mensagem ("Volvo XC60 2019"; página do carro sem carro salvo: "Volvo XC60"; '' = sem carro) e se é o salvo */
  carroMsg(ano?: number): { nome: string; meu: boolean };
  doCarro(f: CarroFiltro): string;
  /** o sizes da arte no palco (o mesmo da arte do carro) */
  sizes: string;
  /** depois de voltar ao carro: o Raio-x repõe o painel da zona */
  aoVoltar(): void;
  /** "Girar o carro": o ponto da zona na vista que está na tela, em % do palco (null = o da arte da frente) */
  origem?(zona: string): string | null;
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number, t: number) => `${((v / t) * 100).toFixed(2)}%`;
const SETA = '<svg class="rxf-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const VOLTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
const pausa = () => (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler?.yield?.() ?? new Promise<void>((ok) => setTimeout(ok, 0));
const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('leve');

let estilo = false;
function porEstilo() {
  if (estilo) return;
  estilo = true;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
}

/** A arte e a tabela de uma vista, baixadas (a arte já decodificada) antes da troca: a transição nunca mostra a
 *  imagem pela metade. Uma vez por zona; se falhar, a próxima tentativa começa de novo. */
type Pronta = { img: HTMLImageElement; pontos: PontoQuente[] };
const prontas = new Map<string, Promise<Pronta>>();
function baixarArte(v: Vista, sizes: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((ok, falha) => {
    const img = new Image();
    img.className = 'rxf-img';
    img.alt = '';
    img.width = ARTE_VISTA.w;
    img.height = ARTE_VISTA.h;
    img.decoding = 'async';
    img.sizes = sizes;
    img.srcset = `${arteDaVista(v, 900)} 900w, ${arteDaVista(v)} ${ARTE_VISTA.w}w`;
    img.src = arteDaVista(v);
    const pronto = () => (img.decode ? img.decode().then(() => ok(img), () => ok(img)) : ok(img));
    if (img.complete && img.naturalWidth) pronto();
    else { img.onload = pronto; img.onerror = () => falha(new Error('arte')); }
  });
}
export function aquecerVista(zona: string, sizes: string): Promise<Pronta> {
  const v = VISTAS[zona];
  const tabela = TABELAS[zona];
  if (!v || !tabela) return Promise.reject(new Error('vista'));
  let p = prontas.get(zona);
  if (!p) {
    p = Promise.all([baixarArte(v, sizes), tabela()]).then(([img, pontos]) => ({ img, pontos }));
    p.catch(() => prontas.delete(zona));
    prontas.set(zona, p);
  }
  return p;
}

/** O canto da arte que o "Voltar ao carro" cobre quando fica por cima dela (arte de 640+ px), em pixels da arte, com
 *  folga. Vista com peça ali (o forro da porta na lateral, o tampão na traseira): o botão fica só na fila de baixo. */
const CANTO = { x: 400, y: 140 };

/** As contas do estoque inteiro (quem não tem carro): um arquivo para todas as vistas, uma vez. */
type DoEstoque = { z: Record<string, Record<string, number>>; l?: Record<string, Record<string, Ligada[]>> };
let estoque: Promise<DoEstoque> | null = null;
const contasDoEstoque = () => (estoque ??= fetch(ARQUIVO_DENTRO)
  .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<DoEstoque>; })
  .catch((e) => { estoque = null; throw e; }));

export function ligarPorDentro(ctx: CtxDentro) {
  porEstilo();
  const { raiz, palco, painel, conteudo, dica, fichas } = ctx;
  let camada: HTMLElement | null = null;
  let fila: HTMLElement | null = null;
  let rotulo: HTMLAnchorElement | null = null;
  let ligado = false;
  // a vista aberta: a zona do Raio-x, o que ela diz e as peças da arte dela
  let zona = '';
  let vista: Vista = VISTAS.frente;
  let pontos: PontoQuente[] = [];
  // a arte tem peça no canto de cima, onde o "Voltar ao carro" fica por cima dela? (aí ele desce para a fila)
  let cantoOcupado = false;
  let escolhido: string | null = null;
  let passando: string | null = null;
  let ultimoPonteiro = 'mouse';
  // quando o dedo encostou pela última vez (o foco que vem do toque não acende nada: ver o focusin da camada)
  let toqueEm = -1e9;
  let quemAbriu: HTMLElement | null = null;
  let vez = 0;
  // o que vale agora: quantas de cada ponto (null = contando), o filtro do carro e o nome dele nas frases
  let contas: Record<string, number> | null = null;
  // o 3º estado: o ponto sem a peça do título mas com peça LIGADA no estoque (as peças, para o painel mostrar), e o
  // ponto cujas ligadas estão abertas no painel (null = a lista da vista)
  let ligadas: Record<string, Ligada[]> = {};
  let ligK: string | null = null;
  const temLigadas = (k: string) => (contas?.[k] === 0 ? ligadas[k]?.length ?? 0 : 0);
  let filtro: CarroFiltro = {};
  let aviso = '';
  let doCarro = '';
  const quente = (k: string) => pontos.find((p) => p.k === k)!;

  // ---- o link e o texto de cada ponto ----
  function destino(p: PontoQuente): { href: string; fora: boolean; ligadas?: boolean } {
    const n = contas?.[p.k];
    // sem a peça do título, com peça ligada: abre as ligadas no painel (o pedido de pátio é o 1º botão de lá)
    if (temLigadas(p.k)) return { href: '#', fora: false, ligadas: true };
    // sem tipo (o capô, os bancos) ou sem peça: o WhatsApp "a gente procura no pátio"; contando ainda: o catálogo (sempre vale)
    if (!p.tipo || !p.sub || n === 0) {
      const c = ctx.carroMsg(filtro.ano);
      return { href: linkProcuraPeca(p.procuro, c.nome, c.meu), fora: true };
    }
    return { href: linkLinha({ tipo: p.tipo, sub: p.sub, lado: p.lado, pos: p.pos }, filtro), fora: false };
  }
  const quantas = (p: PontoQuente) => {
    const n = contas?.[p.k];
    return n === undefined ? '' : n > 0 ? qtdPecas(n) : temLigadas(p.k) ? `a gente procura · ${ligadasTxt(temLigadas(p.k))}` : 'a gente procura no pátio';
  };
  const rotuloAria = (p: PontoQuente) => {
    const n = contas?.[p.k];
    if (n === undefined) return p.nome;
    if (n > 0) return `${p.nome}: ${qtdPecas(n)}${doCarro ? ` ${doCarro}` : ' no estoque'}`;
    const l = temLigadas(p.k);
    return l ? `${p.nome}: sem anúncio agora, a gente procura no pátio; ${l === 1 ? '1 peça ligada' : `${l} peças ligadas`} à venda, ver` : `${p.nome}: sem anúncio agora, a gente procura no pátio (WhatsApp)`;
  };
  function atributos(a: Element, p: PontoQuente) {
    const d = destino(p);
    a.setAttribute('href', d.href);
    if (d.fora) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); a.setAttribute('data-botao', 'raio-x'); }
    else { a.removeAttribute('target'); a.removeAttribute('rel'); a.removeAttribute('data-botao'); }
    if (d.ligadas) a.setAttribute('data-ligadas', ''); else a.removeAttribute('data-ligadas');
    a.classList.toggle('vazio', contas?.[p.k] === 0 || !p.tipo);
  }

  function montarCamada(img: HTMLImageElement) {
    // a camada é da vista: outra zona, outra arte e outras formas (a anterior sai)
    camada?.remove();
    camada = document.createElement('div');
    camada.className = 'rxf';
    camada.setAttribute('role', 'group');
    camada.setAttribute('aria-label', `${vista.titulo}: toque numa peça`);
    camada.innerHTML = `<button type="button" class="rxf-voltar" data-voltar>${VOLTA}Voltar ao carro</button>`
      + `<svg class="rxf-mapa" viewBox="0 0 ${ARTE_VISTA.w} ${ARTE_VISTA.h}">`
      + pontos.map((p) => `<a data-q="${p.k}" aria-label="${esc(p.nome)}">${p.poligonos.map((f) => `<polygon class="rxf-forma" points="${f}"/>`).join('')}</a>`).join('')
      + '</svg>'
      + pontos.map((p, i) => `<span class="rxf-num num" data-q="${p.k}" aria-hidden="true" style="left:${pct(p.ancora[0], ARTE_VISTA.w)};top:${pct(p.ancora[1], ARTE_VISTA.h)}">${i + 1}</span>`).join('')
      + '<a class="rxf-rotulo" tabindex="-1" aria-hidden="true" hidden></a>';
    camada.prepend(img);
    palco.appendChild(camada);
    rotulo = camada.querySelector<HTMLAnchorElement>('.rxf-rotulo');
    // no lugar das fichas: a instrução e, na arte estreita (onde o botão por cima da arte taparia peças), o "Voltar"
    if (!fila) {
      fila = document.createElement('div');
      fila.className = 'rxf-fila';
      fila.innerHTML = `<button type="button" class="rxf-voltar rxf-voltar-fila" data-voltar>${VOLTA}Voltar ao carro</button>`
        + '<p class="rxf-legenda">Toque numa peça<span>, na imagem ou na lista: o catálogo abre só com aquele tipo</span>.</p>';
      fichas.appendChild(fila);
      fila.addEventListener('click', (e) => { if ((e.target as Element).closest('[data-voltar]')) sair(true); });
    }

    camada.addEventListener('pointerdown', (e) => { ultimoPonteiro = e.pointerType || 'mouse'; if (ultimoPonteiro !== 'mouse') toqueEm = performance.now(); }, true);
    camada.addEventListener('click', (e) => {
      const alvo = e.target as Element;
      if (alvo.closest('[data-voltar]')) { sair(true); return; }
      const a = alvo.closest<SVGAElement>('a[data-q]');
      if (!a) {
        // o rótulo da peça acesa (no toque, o 2º toque): com peça ligada, abre as ligadas no painel
        const r = alvo.closest('.rxf-rotulo[data-ligadas]');
        const kr = passando ?? escolhido;
        if (r && kr) { e.preventDefault(); abrirLigadas(kr); }
        else if (!alvo.closest('.rxf-rotulo')) escolher(null);
        return;
      }
      const k = a.dataset.q!;
      if (temLigadas(k)) {
        e.preventDefault();
        // dedo: o 1º toque acende e mostra o rótulo; o 2º abre. Mouse e teclado abrem direto.
        if ((ultimoPonteiro === 'touch' || ultimoPonteiro === 'pen') && (e as MouseEvent).detail !== 0 && escolhido !== k) escolher(k);
        else abrirLigadas(k);
        return;
      }
      // dedo: o 1º toque acende a peça e mostra o rótulo (o link); o 2º vai. Mouse e teclado vão direto.
      if ((ultimoPonteiro === 'touch' || ultimoPonteiro === 'pen') && (e as MouseEvent).detail !== 0 && escolhido !== k) {
        e.preventDefault();
        escolher(k);
      }
    });
    camada.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const a = (e.target as Element).closest<HTMLElement>('a[data-q]');
      passar(a ? a.dataset.q! : null);
    });
    camada.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') passar(null); });
    camada.addEventListener('focusin', (e) => {
      // O foco que vem do TOQUE não acende a peça: quem acende é o clique (escolher). No Chrome com toque o foco chega
      // antes do clique; o rótulo aparecia ali mesmo, debaixo do dedo, o clique caía no rótulo/na camada em vez da
      // peça, a peça não ficava escolhida e o 2º toque (no rótulo) o escondia sem abrir nada (revisão 17, N-P2-1:
      // "Cinto de segurança", "Escapamento", "Semieixos traseiros", as peças cujo rótulo cobre o ponto tocado).
      if (performance.now() - toqueEm < 800) return;
      const a = (e.target as Element).closest<HTMLElement>('a[data-q]');
      if (a) passar(a.dataset.q!);
    });
    camada.addEventListener('focusout', () => passar(null));
  }

  // ---- a peça acesa (mouse em cima, foco, ou a escolhida no toque): a forma, o número, a linha da lista e o rótulo ----
  function acender() {
    const luz = passando ?? escolhido;
    for (const el of raiz.querySelectorAll<HTMLElement>('.rxf [data-q], .rxf-lista [data-q]')) el.classList.toggle('aceso', el.dataset.q === luz);
    if (!rotulo || !camada) return;
    if (!luz) { rotulo.hidden = true; return; }
    const p = quente(luz);
    const q = quantas(p);
    // só reescreve quando o texto muda: no toque, o 2º toque é NO rótulo, e o foco que sai da peça chama este acender()
    // de novo; reescrever o rótulo debaixo do dedo fazia o Chrome do Android perder o clique (o alvo do toque sumia
    // antes do clique: nem o catálogo nem as peças ligadas abriam; no ar desde a rodada 16)
    const html = `<b>${esc(p.nome)}</b>${q ? `<span class="num">${esc(q)}</span>` : ''}${SETA}`;
    if (rotulo.dataset.html !== html) { rotulo.innerHTML = html; rotulo.dataset.html = html; }
    atributos(rotulo, p);
    rotulo.hidden = false;
    // em cima do número; perto da borda de cima, embaixo; sem sair pelos lados (medido depois de escrito, num quadro só)
    const W = camada.clientWidth, H = camada.clientHeight;
    const x = (p.ancora[0] / ARTE_VISTA.w) * W, y = (p.ancora[1] / ARTE_VISTA.h) * H;
    const w = rotulo.offsetWidth, h = rotulo.offsetHeight;
    const esq = Math.max(6, Math.min(W - w - 6, x - w / 2));
    const emCima = y - h - 18 >= 6;
    rotulo.style.left = `${esq}px`;
    rotulo.style.top = `${emCima ? y - h - 18 : Math.min(H - h - 6, y + 18)}px`;
  }
  function escolher(k: string | null) { escolhido = k; acender(); }
  function passar(k: string | null) { if (passando !== k) { passando = k; acender(); } }

  // ---- as contas: do carro (o salvo ou o da página) ou do estoque inteiro ----
  async function contar() {
    const minha = ++vez;
    contas = null;
    try {
      const c = await ctx.carro();
      if (minha !== vez) return;
      aviso = c.aviso;
      if (c.procurar && c.filtro.modelo) {
        filtro = c.filtro;
        doCarro = ctx.doCarro(filtro);
        // uma peça por vez, devolvendo a vez ao navegador (15 buscas de uma vez davam uma tarefa de ~60 ms com CPU 6×)
        const n: Record<string, number> = {};
        const lig: Record<string, Ligada[]> = {};
        const capa = c.capa ?? (() => '');
        for (const p of pontos) {
          const r = contarComLigadas(c.procurar, filtro, [p])[p.k];
          n[p.k] = r.n;
          if (r.ligadas.length) lig[p.k] = r.ligadas.map((it) => ligadaDe(it, capa));
          await pausa();
          if (minha !== vez) return;
        }
        contas = n;
        ligadas = lig;
      } else {
        filtro = {};
        doCarro = '';
        const j = await contasDoEstoque();
        if (minha !== vez) return;
        if (!j.z[zona]) throw new Error('vista');
        contas = j.z[zona];
        ligadas = j.l?.[zona] ?? {};
      }
    } catch {
      if (minha !== vez) return;
      // sem conexão: os links do catálogo continuam valendo, só sem o número
      contas = null;
      ligadas = {};
      aviso = 'Sem conexão para contar as peças agora: os links abrem o catálogo de cada tipo.';
    }
    if (ligado) { pintarLinks(); pintarPainel(false); acender(); }
  }

  function pintarLinks() {
    if (!camada) return;
    for (const a of camada.querySelectorAll<SVGAElement>('a[data-q]')) {
      const p = quente(a.dataset.q!);
      atributos(a, p);
      a.setAttribute('aria-label', rotuloAria(p));
    }
    for (const n of camada.querySelectorAll<HTMLElement>('.rxf-num')) n.classList.toggle('vazio', contas?.[n.dataset.q!] === 0 || !quente(n.dataset.q!).tipo);
  }

  function pintarPainel(focar: boolean) {
    // as ligadas de um ponto estão abertas: o painel é o delas (se o carro mudou e o ponto não tem mais, volta a lista)
    if (ligK && temLigadas(ligK)) { pintarLigadas(focar); return; }
    ligK = null;
    const tem = contas ? pontos.filter((p) => (contas![p.k] ?? 0) > 0).length : 0;
    const sub = !contas ? (aviso ? '' : 'Contando as peças…')
      : `${doCarro ? `${esc(doCarro)}` : 'no estoque inteiro'} · ${tem} de ${pontos.length} peças com anúncio agora`;
    const itens = pontos.map((p, i) => {
      const d = destino(p);
      const n = contas?.[p.k];
      const vazio = n === 0 || !p.tipo;
      const fim = n === undefined && p.tipo ? '' : vazio ? '<span class="rxf-i-patio">a gente procura</span>' : `<span class="rxf-i-n num">${n}<span class="sr-only"> ${n === 1 ? 'peça' : 'peças'}</span></span>`;
      // 3º estado: sem a peça do título, com peça ligada. A linha é um botão (abre as ligadas no painel): "a gente
      // procura" como nas outras e, embaixo, discreto, "N ligadas"; o número da arte continua cinza
      const l = temLigadas(p.k);
      if (l) return `<li><button type="button" class="rxf-item vazio" data-q="${p.k}" data-ligadas>`
        + `<i class="num" aria-hidden="true">${i + 1}</i><span class="rxf-i-nome">${esc(p.nome)}</span>`
        + `<span class="rxf-i-fim">${fim}<span class="rxf-i-lig num"><span class="sr-only">, e </span>${ligadasTxt(l)}<span class="sr-only"> à venda</span></span></span>${SETA}</button></li>`;
      return `<li><a class="rxf-item${vazio ? ' vazio' : ''}" data-q="${p.k}" href="${esc(d.href)}"${d.fora ? ' target="_blank" rel="noopener" data-botao="raio-x"' : ''}>`
        + `<i class="num" aria-hidden="true">${i + 1}</i><span class="rxf-i-nome">${esc(p.nome)}</span>${fim}${SETA}</a></li>`;
    }).join('');
    // as contas chegam e a lista é refeita: o foco fica onde estava (o título, a mesma linha ou o "Voltar")
    const ativo = !focar && document.activeElement instanceof HTMLElement && conteudo.contains(document.activeElement) ? document.activeElement : null;
    const foco = ativo ? (ativo.dataset.q ? `[data-q="${ativo.dataset.q}"]` : ativo.matches('.rx-p-titulo') ? '.rx-p-titulo' : '.rxf-voltar2') : '';
    conteudo.innerHTML = `<div class="rxf-painel"><div class="rx-p-cabeca"><h3 class="rx-p-titulo" tabindex="-1">${esc(vista.titulo)}</h3><p class="rx-p-sub">${sub || '&nbsp;'}</p></div>`
      + (aviso ? `<p class="rx-p-aviso">${esc(aviso)}</p>` : '')
      + `<ol class="rxf-lista">${itens}</ol>`
      + `<div class="rxf-pe"><button type="button" class="botao botao-linha rxf-voltar2" data-voltar>${VOLTA}Voltar ao carro</button>`
      + `<p class="rxf-nota">Arte ilustrativa de um SUV: a forma de cada peça muda de carro para carro.${zona === 'lateral-direita' ? ' O desenho mostra as portas do lado esquerdo; os links desta lista são os do lado direito.' : ''}</p></div></div>`;
    dica.hidden = true;
    conteudo.hidden = false;
    painel.classList.add('aberto');
    if (focar) conteudo.querySelector<HTMLElement>('.rx-p-titulo')?.focus({ preventScroll: true });
    else if (foco) conteudo.querySelector<HTMLElement>(foco)?.focus({ preventScroll: true });
  }

  /** O painel das peças ligadas de UM ponto: primeiro o pedido de pátio da peça do título (o mesmo link do WhatsApp
   *  do ponto sem anúncio, data-botao="raio-x"); abaixo, "Peças ligadas que a gente tem", cada uma com o nome de
   *  verdade, o preço do site riscado e o do WhatsApp, e o link da peça. Nada aqui conta como "com anúncio". */
  function pintarLigadas(focar: boolean) {
    const p = quente(ligK!);
    const c = ctx.carroMsg(filtro.ano);
    const pedir = linkProcuraPeca(p.procuro, c.nome, c.meu);
    const itens = ligadas[p.k].map((r) => {
      const src = fotoDoCodigo(r.f);
      const de = doCarro ? r.anos : [r.carro, r.anos].filter(Boolean).join(' · ');
      return `<li><a class="rxf-lig" href="/peca/${esc(r.h)}.html">${src ? `<img src="${esc(src)}" alt="" width="52" height="52" loading="lazy" decoding="async">` : '<span class="rxf-lig-sem" aria-hidden="true"></span>'}`
        + `<span class="rxf-lig-tx"><b>${esc(r.n)}</b>${de ? `<small>${esc(de)}</small>` : ''}</span>`
        + `<span class="rxf-lig-p num"><s><span class="sr-only">no site </span>R$ ${brl(r.p)}</s><b>R$ ${brl(precoWhats(r.p))}</b><small>no WhatsApp</small></span></a></li>`;
    }).join('');
    conteudo.innerHTML = `<div class="rxf-painel rxf-sub"><div class="rx-p-cabeca"><h3 class="rx-p-titulo" tabindex="-1">${esc(p.nome)}</h3>`
      + `<p class="rx-p-sub">${doCarro ? `${esc(doCarro)} · ` : ''}sem anúncio desta peça agora</p></div>`
      + `<a class="botao botao-laranja rxf-pedir" href="${esc(pedir)}" target="_blank" rel="noopener" data-botao="raio-x">Pedir para a gente procurar no pátio</a>`
      + `<h4 class="rxf-lig-t">Peças ligadas que a gente tem</h4><ul class="rxf-ligadas">${itens}</ul>`
      + `<div class="rxf-pe"><button type="button" class="botao botao-linha rxf-voltar2" data-voltar-lista>${VOLTA}Voltar à lista</button></div></div>`;
    dica.hidden = true;
    conteudo.hidden = false;
    painel.classList.add('aberto');
    if (focar) conteudo.querySelector<HTMLElement>('.rx-p-titulo')?.focus({ preventScroll: true });
  }
  function abrirLigadas(k: string) {
    if (!ligado || !temLigadas(k)) return;
    ligK = k;
    escolher(k);
    pintarLigadas(true);
    // o painel à vista (no celular ele vem embaixo da arte; no PC a lista pode estar rolada)
    requestAnimationFrame(() => {
      const r = painel.getBoundingClientRect();
      if (r.top < 96 || r.top > innerHeight - 200) scrollBy({ top: r.top - 104, behavior: calmo() ? 'auto' : 'smooth' });
    });
  }
  function fecharLigadas(focar: boolean) {
    const k = ligK;
    ligK = null;
    escolher(null);
    pintarLinks();
    pintarPainel(false);
    // o foco volta à linha, mas a peça não fica acesa na arte: o rótulo dela (agora de duas linhas) ficava por cima das
    // peças vizinhas e o toque seguinte na arte caía nele
    if (focar && k) { focoSemLuz = true; conteudo.querySelector<HTMLElement>(`.rxf-lista [data-q="${k}"]`)?.focus({ preventScroll: true }); focoSemLuz = false; }
  }
  let focoSemLuz = false;

  const noPainel = (e: Event) => {
    if (!ligado) return;
    const alvo = e.target as Element;
    if (alvo.closest('[data-voltar-lista]')) { fecharLigadas(true); return; }
    const b = alvo.closest<HTMLElement>('.rxf-lista [data-ligadas]');
    if (b) { abrirLigadas(b.dataset.q!); return; }
    if (alvo.closest('[data-voltar]')) sair(true);
  };
  const sobreLista = (e: Event) => {
    if (!ligado) return;
    if (e.type === 'focusin' && focoSemLuz) return;
    const a = (e.target as Element).closest<HTMLElement>('.rxf-item');
    passar(e.type === 'pointerover' || e.type === 'focusin' ? a?.dataset.q ?? null : null);
  };
  conteudo.addEventListener('click', noPainel);
  for (const t of ['pointerover', 'focusin', 'pointerleave', 'focusout']) conteudo.addEventListener(t, sobreLista);

  // ---- a troca de arte ----
  function trocar(entrando: boolean, muda: () => void) {
    type Doc = Document & { startViewTransition?: (f: () => void) => { finished: Promise<void> } };
    const doc = document as Doc;
    if (calmo() || !doc.startViewTransition) { muda(); return; }
    const html = document.documentElement;
    // o zoom sai da parte do carro que se abre (o ponto da zona na arte do carro)
    const z = ZONAS.find((x) => x.k === zona);
    if (z) html.style.setProperty('--rxf-origem', ctx.origem?.(zona) ?? `${pct(z.ancora[0], ARTE.w)} ${pct(z.ancora[1], ARTE.h)}`);
    palco.style.setProperty('view-transition-name', 'rx-palco');
    html.classList.add('rxf-troca');
    html.classList.toggle('rxf-volta', !entrando);
    const fim = () => { palco.style.removeProperty('view-transition-name'); html.style.removeProperty('--rxf-origem'); html.classList.remove('rxf-troca', 'rxf-volta'); };
    try { doc.startViewTransition(muda).finished.then(fim, fim); } catch { fim(); muda(); }
  }

  /** Abre a vista por dentro da zona `k` (a que o botão do painel dela pede, ou a do endereço). */
  async function abrir(k: string, botao: HTMLElement | null) {
    if (ligado && zona === k) return true;
    if (!VISTAS[k]) return false;
    quemAbriu = botao;
    botao?.setAttribute('aria-busy', 'true');
    let pronta: Pronta;
    try { pronta = await aquecerVista(k, ctx.sizes); } catch { botao?.removeAttribute('aria-busy'); return false; }
    botao?.removeAttribute('aria-busy');
    // outra vista aberta (o endereço mudou): sai dela na hora, sem repor o painel da zona antiga
    if (ligado) { ligado = false; vez++; }
    if (zona !== k || !camada) {
      zona = k;
      vista = VISTAS[k];
      pontos = pronta.pontos;
      cantoOcupado = pontos.some((p) => p.poligonos.some((f) => f.split(' ').some((xy) => { const [x, y] = xy.split(',').map(Number); return x < CANTO.x && y < CANTO.y; })));
      contas = null;
      montarCamada(pronta.img);
    }
    ligado = true;
    escolhido = null;
    passando = null;
    ligK = null;
    trocar(true, () => {
      raiz.dataset.vista = 'dentro';
      raiz.dataset.dentro = zona;
      raiz.toggleAttribute('data-canto', cantoOcupado);
      pintarLinks();
      pintarPainel(true);
      acender();
    });
    void contar();
    return true;
  }

  /** Volta à arte do carro. `naHora`: sem a animação (a pessoa trocou de modo com a vista aberta). */
  function sair(focar: boolean, naHora = false) {
    if (!ligado) return;
    ligado = false;
    vez++;
    escolhido = null;
    passando = null;
    ligK = null;
    (naHora ? (_e: boolean, f: () => void) => f() : trocar)(false, () => {
      raiz.dataset.vista = 'achar';
      delete raiz.dataset.dentro;
      raiz.removeAttribute('data-canto');
      acender();
      ctx.aoVoltar();
      if (focar) {
        // o botão que abriu foi refeito com o painel da zona: o foco volta ao novo
        const b = raiz.querySelector<HTMLElement>('[data-rx-dentro]') ?? quemAbriu;
        b?.focus({ preventScroll: true });
      }
    });
  }

  return {
    abrir, sair,
    /** Esc: com as peças ligadas de um ponto abertas, volta à lista da vista; senão, volta ao carro */
    esc: () => { if (ligK) fecharLigadas(true); else sair(true); },
    get ligado() { return ligado; },
    /** a zona da vista aberta ('' = nenhuma) */
    get zona() { return ligado ? zona : ''; },
    /** o carro mudou com a vista aberta: as contas e os links acompanham */
    trocouCarro: () => { if (ligado) { pintarPainel(false); void contar(); } },
  };
}
export type PorDentro = ReturnType<typeof ligarPorDentro>;
