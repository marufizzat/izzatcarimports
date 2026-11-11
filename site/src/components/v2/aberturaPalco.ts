// O palco vivo da abertura (AberturaV2.astro; as contas estão em lib/abertura.ts). Tudo aqui chega DEPOIS da 1ª
// pintura e nada muda de lugar: só transform/opacity, o texto do título e atributos. Sem layout forçado no começo.
//   - entrada: as peças chegam quando as imagens estão decodificadas (uma a uma) e o DRL do farol acende;
//   - o seletor (ui/meuCarroPicker.ts) manda: marca -> o título diz a marca; modelo/ano (evento "meu-carro") -> o
//     título diz o carro, a arte dele entra no palco e as peças viram atalhos com a contagem real;
//   - paralaxe pelo ponteiro (só mouse), deriva em CSS; tudo pausa fora da tela ou com a aba escondida;
//   - celular/tablet: o palco fica abaixo do cartão e dorme (data-ab-dorme) até chegar na tela, depois do load;
//   - prefers-reduced-motion e aparelho fraco (html.leve): a mesma cena, parada; trocas secas.
import { EVENTO, lerMeuCarro, carregarGaragem, type MeuCarro } from '../../lib/meuCarro';
import { ARQUIVO_CARRO } from '../../lib/chegouCarro';
import { whatsUrl } from '../../lib/whats';
import { palavraViva, contarBlocos, escolherAtalhos, linkAtalho, pecasTxt, lugaresEstreitos, type IndiceCarro, type Atalho } from '../../lib/abertura';

type Estado = '' | 'marca' | 'carro';

export function montarAbertura(sec: HTMLElement) {
  const $ = <T extends HTMLElement>(s: string) => sec.querySelector<T>(s);
  const h1 = $('[data-ab-h1]')!;
  const palavra = $('[data-ab-palavra]')!;
  const resto = $('[data-ab-resto]');
  const pincel = $('.ab-pincel');
  const palco = $('[data-ab-palco]')!;
  const cena = $('.ab-cena')!;
  const itens = Array.from(sec.querySelectorAll<HTMLElement>('.ab-p'));
  const autos = Array.from(sec.querySelectorAll<HTMLImageElement>('[data-ab-auto]'));
  const voz = $('[data-ab-voz]');
  const legenda = $('[data-ab-legenda]');
  const seloWhats = $<HTMLAnchorElement>('[data-ab-whats]');
  const seletor = $('[data-mc-raiz]');
  const drls = Array.from(sec.querySelectorAll<HTMLElement>('.ab-drl'));
  const doPalco = (d: HTMLElement) => palco.contains(d);
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('leve');
  const largo = matchMedia('(min-width: 1024px)');

  // ---- título: a palavra viva ----
  let palavraAgora = palavra.textContent || 'carro';
  function dizer(m?: string | null, y?: number | null, b?: string | null) {
    const { t, l } = palavraViva(m, y, b);
    if (t === palavraAgora) return;
    palavraAgora = t;
    const trocar = () => { palavra.textContent = t; h1.style.setProperty('--ab-l', String(l)); };
    if (calmo || !palavra.animate) { trocar(); return; }
    // FLIP do "precisa?": ele desliza para o lugar novo enquanto a palavra troca (a leitura acontece numa interação,
    // quando o seletor acabou de redesenhar: o layout já ia ser feito neste quadro)
    const antes = resto?.getBoundingClientRect();
    trocar();
    const depois = resto?.getBoundingClientRect();
    h1.classList.add('ab-anima');
    // a palavra nova entra varrendo da esquerda, no passo do "precisa?" que desliza (uma nunca fica em cima da outra)
    const a = palavra.animate([{ opacity: .2, clipPath: 'inset(-.2em 100% -.2em 0)' }, { opacity: 1, clipPath: 'inset(-.2em 0 -.2em 0)' }], { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    a.onfinish = a.oncancel = () => { if (palavraAgora === t) h1.classList.remove('ab-anima'); };
    if (resto && antes && depois && Math.abs(antes.top - depois.top) < 4)
      resto.animate([{ transform: `translateX(${antes.left - depois.left}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    // o traço se desenha de novo (dois nomes para a mesma animação: recomeça sem forçar layout)
    if (pincel) { const outra = pincel.classList.contains('ab-traca') ? 'ab-traca2' : 'ab-traca'; pincel.classList.remove('ab-traca', 'ab-traca2'); pincel.classList.add(outra); }
  }

  // ---- peças: imagem só quando a peça vai aparecer ----
  function ligarImagem(li: HTMLElement): HTMLImageElement | null {
    for (const img of li.querySelectorAll<HTMLImageElement>('img[data-srcset]')) {
      img.srcset = img.dataset.srcset!; img.src = img.dataset.src || '';
      delete img.dataset.srcset; delete img.dataset.src;
    }
    return li.querySelector<HTMLImageElement>('img.ab-img');
  }
  const pronta = (img: HTMLImageElement | null) =>
    !img ? Promise.resolve() : (img.complete && img.naturalWidth ? Promise.resolve() : new Promise<void>((ok) => {
      img.addEventListener('load', () => ok(), { once: true });
      img.addEventListener('error', () => ok(), { once: true });
    })).then(() => (img.decode ? img.decode().catch(() => undefined) : undefined));
  const espera = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

  /** O DRL acende (o véu escuro sai correndo) ou pisca duas vezes. `onde`: o farol do palco, o do topo do celular, ou os dois. */
  function brilhar(pisca = false, onde: HTMLElement[] = drls) {
    for (const d of onde) {
      const apagado = d.classList.contains('ab-apagado');
      const outra = d.classList.contains('ab-pisca') ? 'ab-pisca2' : 'ab-pisca';
      d.classList.remove('ab-corre', 'ab-pisca', 'ab-pisca2', 'ab-apagado');
      if (calmo) continue;
      if (pisca) { if (!apagado) d.classList.add(outra); } // ainda apagado (não tinha acendido): só acende
      else if (apagado) d.classList.add('ab-corre');
    }
  }

  // ---- estados do palco ----
  let estadoAgora: Estado = (palco.getAttribute('data-ab') as Estado) || '';
  let ksAgora: string[] = [];
  let carroAgora: MeuCarro | null = null;
  let pedido = 0;
  let comecou = false;
  const usa = (li: HTMLElement, e: Estado, ks: string[]) => (e === 'carro' ? ks.includes(li.dataset.k!) : li.hasAttribute('data-cena'));
  const saindo = new Map<HTMLElement, number>();

  // o rótulo, o link e o nome acessível de cada peça como vieram no HTML (a cena de abertura: o bloco inteiro)
  const base = new Map(itens.map((li) => {
    const a = li.querySelector<HTMLAnchorElement>('a')!;
    return [li, { href: a.getAttribute('href') || '', rotulo: a.getAttribute('aria-label') || '', nome: li.querySelector('[data-ab-nome]')!.textContent || '' }] as const;
  }));
  function rotuloBase(li: HTMLElement) {
    const a = li.querySelector<HTMLAnchorElement>('a')!;
    const o = base.get(li)!;
    li.querySelector<HTMLElement>('[data-ab-nome]')!.textContent = o.nome;
    li.querySelector<HTMLElement>('[data-ab-n]')!.hidden = true;
    a.setAttribute('href', o.href);
    a.setAttribute('aria-label', o.rotulo);
  }
  function rotuloCarro(li: HTMLElement, at: Atalho, c: MeuCarro) {
    const a = li.querySelector<HTMLAnchorElement>('a')!;
    const nome = li.querySelector<HTMLElement>('[data-ab-nome]')!;
    const n = li.querySelector<HTMLElement>('[data-ab-n]')!;
    nome.textContent = nome.dataset.curto || '';
    n.textContent = at.n.toLocaleString('pt-BR');
    n.hidden = false;
    a.href = linkAtalho(at.bloco, c);
    a.setAttribute('aria-label', `${at.bloco}: ${pecasTxt(at.n)} para o seu ${[c.b, c.m, c.y].filter(Boolean).join(' ')}`);
  }
  const semSlot = (li: HTMLElement) => { delete li.dataset.slot; li.style.removeProperty('--slot'); };

  /** Põe o palco no estado `e` (com os atalhos quando é 'carro'): quem fica viaja para o lugar novo; quem sai some
   *  suave no lugar onde estava (0,4 s; o data-slot dele fica até lá) e sai do layout; quem chega entra em entrar(). */
  function aplicar(e: Estado, atalhos: Atalho[] = [], c: MeuCarro | null = null) {
    const ks = atalhos.map((a) => a.k);
    const estreito = lugaresEstreitos(ks.length);
    for (const li of itens) {
      if (!usa(li, e, ks)) {
        if (saindo.has(li)) continue; // já está saindo
        const fim = () => { li.classList.remove('ab-sai'); semSlot(li); rotuloBase(li); saindo.delete(li); };
        if (li.classList.contains('ab-on') && !calmo) {
          li.classList.remove('ab-on');
          li.classList.add('ab-sai');
          li.style.setProperty('--at', '0ms');
          saindo.set(li, window.setTimeout(fim, 420));
        } else { li.classList.remove('ab-on'); fim(); }
        continue;
      }
      if (saindo.has(li)) { clearTimeout(saindo.get(li)); saindo.delete(li); li.classList.remove('ab-sai'); }
      const i = e === 'carro' ? ks.indexOf(li.dataset.k!) : -1;
      if (i >= 0 && c) {
        li.dataset.slot = String(i);
        li.style.setProperty('--slot', String(i));
        li.style.setProperty('--n', String(ks.length));
        li.style.setProperty('--mx', String(estreito[i][0]));
        li.style.setProperty('--my', String(estreito[i][1]));
        rotuloCarro(li, atalhos[i], c);
      } else { semSlot(li); rotuloBase(li); }
    }
    estadoAgora = e;
    ksAgora = ks;
    if (e) palco.setAttribute('data-ab', e); else palco.removeAttribute('data-ab');
    if (e !== 'carro' || !ks.length) legenda?.removeAttribute('data-on');
  }

  /** Entram (escalonadas, quando as imagens estão prontas) as peças do estado de agora que ainda não estão à vista. */
  let vez = 0;
  async function entrar() {
    const minha = ++vez;
    const novas = itens.filter((li) => usa(li, estadoAgora, ksAgora) && !li.classList.contains('ab-on'));
    if (!novas.length) return;
    await Promise.race([Promise.all(novas.map((li) => pronta(ligarImagem(li)))), espera(2600)]);
    if (minha !== vez) return;
    let i = 0;
    for (const li of novas) {
      if (!usa(li, estadoAgora, ksAgora)) continue;
      li.style.setProperty('--at', `${calmo ? 0 : i++ * 80}ms`);
      li.classList.add('ab-on');
    }
  }

  /** A arte do carro salvo. O carro escolhido no seletor já traz a chave (a/as); o salvo por outra página, ou antes de
   *  a arte existir, não traz: a chave vem da garagem (/dados/meu-carro.json, o mesmo pedido do seletor). null = o
   *  modelo não tem arte. */
  type Arte = { a: string; as: number[] };
  type GaragemArte = { marcas: { n: string; modelos: { n: string; c: number; ya: [number, number][]; a?: string; as?: number[] }[] }[] };
  async function arteDe(c: MeuCarro): Promise<Arte | null> {
    if (c.a) return { a: c.a, as: c.as ?? [] };
    try {
      const g = await carregarGaragem<GaragemArte>();
      const mo = g.marcas.find((m) => m.n === c.b)?.modelos.find((x) => x.n === c.m);
      return mo?.a ? { a: mo.a, as: mo.as ?? [] } : null;
    } catch { return null; }
  }

  /** Põe a arte no palco: duas <img> que se revezam (a nova só aparece carregada: dissolvência, nunca um buraco).
   *  Sem arte (null): o palco fica no desenho "sem carro" (data-ab-semarte: os atalhos maiores, no meio). */
  let autoVez = 0;
  function mostrarArte(arte: Arte | null, semArte = false) {
    const minha = ++autoVez;
    palco.toggleAttribute('data-ab-semarte', semArte);
    const atual = autos.find((a) => a.hasAttribute('data-on'));
    if (!arte) { autos.forEach((a) => a.removeAttribute('data-on')); return; }
    const src = `/arte/v2/carro-${arte.a}.webp`;
    const ws = arte.as;
    const srcset = ws.map((w, i) => `${i === ws.length - 1 ? src : src.replace(/\.webp$/, `-${w}.webp`)} ${w}w`).join(', ');
    if (atual?.getAttribute('src') === src) return;
    const nova = autos.find((a) => a !== atual) ?? autos[0];
    nova.loading = 'eager';
    if (srcset) nova.srcset = srcset; else nova.removeAttribute('srcset');
    nova.src = src;
    pronta(nova).then(() => {
      if (minha !== autoVez) return;
      nova.setAttribute('data-on', '');
      atual?.removeAttribute('data-on');
    });
  }

  function whatsDoSelo(c: MeuCarro | null) {
    if (!seloWhats) return;
    const carro = c ? ` Meu carro: ${[c.b, c.m, c.y].filter(Boolean).join(' ')}.` : '';
    seloWhats.href = whatsUrl(`Quero comprar pelo WhatsApp com os 10% de desconto.${carro}`);
  }

  function semCarro() {
    carroAgora = null;
    pedido++;
    aplicar('');
    mostrarArte(null);
    whatsDoSelo(null);
    dizer();
    if (comecou) entrar();
  }

  async function comCarro(c: MeuCarro, primeira = false) {
    const mudou = estadoAgora !== 'carro' || !carroAgora || carroAgora.b !== c.b || carroAgora.m !== c.m;
    carroAgora = c;
    const meu = ++pedido;
    dizer(c.m, c.y, c.b);
    whatsDoSelo(c);
    // carro novo: os atalhos de antes (e a cena de abertura) saem já; só o ano mudou: ficam até a conta nova chegar
    if (mudou) aplicar('carro');
    if (mudou && !primeira) brilhar(true);
    if (!comecou) return; // palco dormindo (celular): a arte e a conta ficam para quando ele acordar
    // a arte entra assim que se sabe qual é (não espera a conta); modelo sem arte: o desenho "sem carro"
    const arte = arteDe(c).then((x) => { if (meu === pedido) mostrarArte(x, !x); return x; });
    let d: IndiceCarro | null = null;
    try {
      const r = await fetch(ARQUIVO_CARRO(c.b, c.m));
      if (r.ok) d = await r.json();
    } catch { /* sem rede: o carro fica no palco, sem os atalhos */ }
    await arte; // os atalhos já entram no desenho certo (com ou sem a arte do carro)
    if (meu !== pedido) return;
    if (!d) { aplicar('carro'); return; }
    let conta = contarBlocos(d, c.m, c.y);
    let usado: MeuCarro = c;
    // ano salvo sem peça agora: os atalhos do modelo em todos os anos (a mesma saída da grade de categorias)
    if (!conta.total && c.y != null) { conta = contarBlocos(d, c.m, null); usado = { ...c, y: null }; }
    const atalhos = escolherAtalhos(conta.por);
    aplicar('carro', atalhos, usado);
    if (legenda && atalhos.length) {
      legenda.textContent = `Para o seu ${palavraViva(usado.m, usado.y).t}`;
      legenda.setAttribute('data-on', '');
    }
    await entrar();
    if (meu !== pedido) return;
    if (voz && !primeira && atalhos.length)
      voz.textContent = `Atalhos para o seu ${c.m}: ${atalhos.map((a) => `${a.rot}, ${pecasTxt(a.n)}`).join('; ')}.`;
  }

  // ---- o seletor manda ----
  // Passo "marca" (o seletor não avisa: ele só redesenha): olha o que ele desenhou. Etapa "modelo" = a marca está
  // escolhida e o modelo ainda não; o nome dela está no campo "Marca". O carro pronto chega pelo evento "meu-carro".
  const conteudo = seletor?.querySelector<HTMLElement>('[data-mc-conteudo]');
  let marcaAgora = '';
  function olharSeletor() {
    const corpo = conteudo?.querySelector<HTMLElement>('.mc-corpo');
    if (corpo?.dataset.etapa === 'pronto') {
      // o seletor está mostrando um carro e a abertura não sabe (carro que só a garagem reconhece, apelido migrado
      // na leitura, outra aba): segue o seletor, sem festa
      const c = lerMeuCarro();
      if (c && (estadoAgora !== 'carro' || !carroAgora || carroAgora.b !== c.b || carroAgora.m !== c.m || (carroAgora.y ?? null) !== (c.y ?? null))) comCarro(c, true);
      return;
    }
    if (!corpo || corpo.dataset.etapa !== 'modelo') return;
    const b = conteudo!.querySelector<HTMLElement>('.mc-campo-cheio[data-alvo="marca"] b')?.textContent?.trim() || '';
    if (!b || (b === marcaAgora && estadoAgora === 'marca')) return;
    marcaAgora = b;
    pedido++;
    carroAgora = null;
    dizer(null, null, b);
    brilhar(true);
    aplicar('marca');
    mostrarArte(null);
    if (comecou) entrar();
  }
  if (conteudo) new MutationObserver(olharSeletor).observe(conteudo, { childList: true });
  window.addEventListener(EVENTO, (ev) => {
    const c = (ev as CustomEvent<MeuCarro | null>).detail ?? lerMeuCarro();
    if (c) comCarro(c); else semCarro();
  });
  window.addEventListener('pageshow', (ev) => {
    if (!ev.persisted) return;
    const c = lerMeuCarro();
    if (c && estadoAgora === 'carro' && (carroAgora?.m !== c.m || carroAgora?.y !== c.y)) comCarro(c, true);
  });

  // ---- vida: só com o palco na tela e a aba à vista ----
  let naTela = false;
  const viver = () => palco.toggleAttribute('data-ab-vivo', naTela && comecou && !document.hidden && !calmo);
  document.addEventListener('visibilitychange', viver);

  // paralaxe pelo ponteiro (mouse de verdade, PC): duas variáveis no palco, suavizadas num laço que para sozinho
  if (!calmo && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let ax = 0, ay = 0, x = 0, y = 0, rodando = 0, caixa: DOMRect | null = null;
    const passo = () => {
      x += (ax - x) * 0.085; y += (ay - y) * 0.085;
      cena.style.setProperty('--px', x.toFixed(4));
      cena.style.setProperty('--py', y.toFixed(4));
      rodando = Math.abs(ax - x) + Math.abs(ay - y) > 0.002 ? requestAnimationFrame(passo) : 0;
    };
    window.addEventListener('scroll', () => { caixa = null; }, { passive: true });
    window.addEventListener('resize', () => { caixa = null; }, { passive: true });
    sec.addEventListener('pointermove', (ev) => {
      if (!naTela || !largo.matches) return;
      caixa ??= sec.getBoundingClientRect();
      ax = ((ev.clientX - caixa.left) / caixa.width - 0.62) * 2;
      ay = ((ev.clientY - caixa.top) / caixa.height - 0.5) * 2;
      if (!rodando) rodando = requestAnimationFrame(passo);
    }, { passive: true });
    sec.addEventListener('pointerleave', () => { ax = 0; ay = 0; if (!rodando) rodando = requestAnimationFrame(passo); });
  }

  // ---- começo ----
  // PC: o palco é a 1ª tela, começa já. Celular/tablet: ele está abaixo do cartão e dorme; acorda quando chega na
  // tela, e nunca antes de a página terminar de carregar (nada dele disputa a 1ª tela).
  function comecar() {
    if (comecou) return;
    comecou = true;
    palco.removeAttribute('data-ab-dorme');
    const salvo = estadoAgora === 'carro' ? carroAgora ?? lerMeuCarro() : null;
    if (salvo) { for (const d of drls.filter(doPalco)) d.classList.remove('ab-apagado'); comCarro(salvo, true); }
    else entrar().then(() => setTimeout(() => brilhar(false, drls.filter(doPalco)), 380));
    viver();
  }
  const carregada = new Promise<void>((ok) => {
    if (document.readyState === 'complete') ok(); else window.addEventListener('load', () => ok(), { once: true });
  });
  const quandoPuder = () => { if (largo.matches) comecar(); else carregada.then(() => setTimeout(() => { if (naTela) comecar(); }, 120)); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      for (const e of es) naTela = e.isIntersecting;
      if (naTela) quandoPuder();
      viver();
    }).observe(palco);
  } else { naTela = true; carregada.then(comecar); }

  sec.setAttribute('data-ab-montada', '');
  // o farolzinho da 1ª tela do celular acende sozinho, logo depois da 1ª pintura
  setTimeout(() => brilhar(false, drls.filter((d) => !doPalco(d))), largo.matches ? 0 : 650);
  whatsDoSelo(lerMeuCarro());
}
