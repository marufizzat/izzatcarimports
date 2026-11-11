// O palco vivo da abertura (AberturaV2.astro; as contas estão em lib/abertura.ts). Tudo aqui chega DEPOIS da 1ª
// pintura e nada muda de lugar: só transform/opacity, texto do título e atributos.
//   - entrada: as peças chegam quando as imagens estão decodificadas (uma a uma) e a luz corre pelo DRL do farol;
//   - o seletor (ui/meuCarroPicker.ts) manda: marca -> o título diz a marca; modelo/ano (evento "meu-carro") -> o
//     título diz o carro, a arte dele entra no palco e as peças viram atalhos com a contagem real;
//   - paralaxe pelo ponteiro (só mouse), deriva em CSS; tudo pausa fora da tela ou com a aba escondida;
//   - prefers-reduced-motion e aparelho fraco (html.leve): a mesma cena, parada; trocas secas.
import { EVENTO, lerMeuCarro, type MeuCarro } from '../../lib/meuCarro';
import { ARQUIVO_CARRO } from '../../lib/chegouCarro';
import { whatsUrl } from '../../lib/whats';
import { palavraViva, contarBlocos, escolherAtalhos, linkAtalho, pecasTxt, lugaresEstreitos, type IndiceCarro, type Atalho } from '../../lib/abertura';

export function montarAbertura(sec: HTMLElement) {
  const $ = <T extends HTMLElement>(s: string) => sec.querySelector<T>(s);
  const h1 = $('[data-ab-h1]')!;
  const palavra = $('[data-ab-palavra]')!;
  const resto = $('[data-ab-resto]');
  const pincel = $('.ab-pincel');
  const palco = $('[data-ab-palco]')!;
  const cena = $('.ab-cena')!;
  const lista = $('[data-ab-pecas]')!;
  const itens = Array.from(lista.querySelectorAll<HTMLElement>('.ab-p'));
  const autos = Array.from(sec.querySelectorAll<HTMLImageElement>('[data-ab-auto]'));
  const voz = $('[data-ab-voz]');
  const legenda = $('[data-ab-legenda]');
  const seloWhats = $<HTMLAnchorElement>('[data-ab-whats]');
  const seletor = $('[data-mc-raiz]');
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
    // FLIP do "precisa?": ele desliza para o lugar novo enquanto a palavra troca
    const antes = resto?.getBoundingClientRect();
    trocar();
    const depois = resto?.getBoundingClientRect();
    h1.classList.add('ab-anima');
    const mola = 'cubic-bezier(.2, .9, .25, 1.12)';
    const a = palavra.animate([{ opacity: 0, transform: 'translateY(.32em)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: mola });
    a.onfinish = a.oncancel = () => { if (palavraAgora === t) h1.classList.remove('ab-anima'); };
    if (resto && antes && depois && Math.abs(antes.top - depois.top) < 4)
      resto.animate([{ transform: `translateX(${antes.left - depois.left}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    if (pincel) { pincel.classList.remove('ab-traca'); void pincel.getBoundingClientRect(); pincel.classList.add('ab-traca'); }
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

  /** Mostra (com a entrada escalonada) as peças que este estado usa; devolve quando a última começou a entrar. */
  let vez = 0;
  async function entrar(quais: HTMLElement[]) {
    const minha = ++vez;
    const novas = quais.filter((li) => !li.classList.contains('ab-on'));
    if (novas.length) await Promise.race([Promise.all(novas.map((li) => pronta(ligarImagem(li)))), espera(2600)]);
    if (minha !== vez) return;
    novas.forEach((li, i) => { li.style.setProperty('--at', `${calmo ? 0 : i * 80}ms`); li.classList.add('ab-on'); });
    palco.removeAttribute('data-ab-entrada');
  }

  /** O DRL acende (o véu escuro sai correndo) ou pisca duas vezes. `onde`: o farol do palco, o do topo do celular, ou os dois. */
  const drls = Array.from(sec.querySelectorAll<HTMLElement>('.ab-drl'));
  function brilhar(pisca = false, onde: HTMLElement[] = drls) {
    for (const d of onde) {
      const apagado = d.classList.contains('ab-apagado');
      d.classList.remove('ab-corre', 'ab-pisca', 'ab-apagado');
      if (calmo || (pisca && apagado)) continue;
      if (!pisca && !apagado) continue; // já aceso: nada a acender
      void d.offsetWidth;
      d.classList.add(pisca ? 'ab-pisca' : 'ab-corre');
    }
  }

  // ---- estados do palco ----
  type Estado = '' | 'marca' | 'carro';
  let carroAgora: MeuCarro | null = null;
  let pedido = 0;
  const cenaBase = () => itens.filter((li) => li.hasAttribute('data-cena'));

  function rotulos(atalhos: Atalho[] | null, c: MeuCarro | null) {
    for (const li of itens) {
      const a = li.querySelector<HTMLAnchorElement>('a')!;
      const n = li.querySelector<HTMLElement>('[data-ab-n]')!;
      const nome = li.querySelector<HTMLElement>('[data-ab-nome]')!;
      const at = atalhos?.find((x) => x.k === li.dataset.k);
      nome.textContent = (at && c ? nome.dataset.curto : nome.dataset.rot) || '';
      if (at && c) {
        a.href = linkAtalho(at.bloco, c);
        n.textContent = at.n.toLocaleString('pt-BR');
        n.hidden = false;
        a.setAttribute('aria-label', `${at.bloco}: ${pecasTxt(at.n)} para o seu ${[c.b, c.m, c.y].filter(Boolean).join(' ')}`);
      } else {
        a.href = a.dataset.base!;
        n.hidden = true;
        a.setAttribute('aria-label', a.dataset.rotulo!);
      }
    }
  }

  function slots(ks: string[] | null) {
    lista.style.setProperty('--n', String(ks ? ks.length : 0));
    const estreito = lugaresEstreitos(ks ? ks.length : 0);
    for (const li of itens) {
      const i = ks ? ks.indexOf(li.dataset.k!) : -1;
      if (i >= 0) {
        li.dataset.slot = String(i);
        li.style.setProperty('--slot', String(i));
        li.style.setProperty('--mx', String(estreito[i][0]));
        li.style.setProperty('--my', String(estreito[i][1]));
      } else { delete li.dataset.slot; li.style.removeProperty('--slot'); }
    }
  }

  function estado(e: Estado) {
    if (e) palco.setAttribute('data-ab', e); else palco.removeAttribute('data-ab');
  }

  /** A arte do carro: duas <img> que se revezam (a nova só aparece carregada: dissolvência, nunca um buraco). */
  let autoVez = 0;
  function arteDoCarro(c: MeuCarro | null) {
    const minha = ++autoVez;
    const atual = autos.find((a) => a.hasAttribute('data-on'));
    if (!c?.a) { autos.forEach((a) => a.removeAttribute('data-on')); return; }
    const src = `/arte/v2/carro-${c.a}.webp`;
    const ws = c.as ?? [];
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
    estado('');
    slots(null);
    rotulos(null, null);
    arteDoCarro(null);
    whatsDoSelo(null);
    dizer();
    entrar(cenaBase());
  }

  async function comCarro(c: MeuCarro, primeira = false) {
    const mudou = !carroAgora || carroAgora.b !== c.b || carroAgora.m !== c.m;
    carroAgora = c;
    const meu = ++pedido;
    dizer(c.m, c.y, c.b);
    whatsDoSelo(c);
    estado('carro');
    arteDoCarro(c);
    if (mudou && !primeira) brilhar(true);
    let d: IndiceCarro | null = null;
    try {
      const r = await fetch(ARQUIVO_CARRO(c.b, c.m));
      if (r.ok) d = await r.json();
    } catch { /* sem rede: o carro fica no palco, sem os atalhos */ }
    if (meu !== pedido) return;
    if (!d) { slots([]); legenda?.removeAttribute('data-on'); return; }
    let conta = contarBlocos(d, c.m, c.y);
    let usado: MeuCarro = c;
    // ano salvo sem peça agora: os atalhos do modelo em todos os anos (a mesma saída da grade de categorias)
    if (!conta.total && c.y != null) { conta = contarBlocos(d, c.m, null); usado = { ...c, y: null }; }
    const atalhos = escolherAtalhos(conta.por);
    slots(atalhos.map((a) => a.k));
    rotulos(atalhos, usado);
    if (legenda) {
      legenda.textContent = `Para o seu ${palavraViva(usado.m, usado.y).t}`;
      legenda.toggleAttribute('data-on', atalhos.length > 0);
    }
    await entrar(itens.filter((li) => li.dataset.slot != null));
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
    if (!corpo || corpo.dataset.etapa !== 'modelo') return;
    const b = conteudo!.querySelector<HTMLElement>('.mc-campo-cheio[data-alvo="marca"] b')?.textContent?.trim() || '';
    if (!b || (b === marcaAgora && palco.getAttribute('data-ab') === 'marca')) return;
    marcaAgora = b;
    pedido++;
    carroAgora = null;
    dizer(null, null, b);
    brilhar(true);
    estado('marca');
    slots(null);
    rotulos(null, null);
    arteDoCarro(null);
    entrar(cenaBase());
  }
  if (conteudo) new MutationObserver(olharSeletor).observe(conteudo, { childList: true });
  window.addEventListener(EVENTO, (ev) => {
    const c = (ev as CustomEvent<MeuCarro | null>).detail ?? lerMeuCarro();
    if (c) comCarro(c); else semCarro();
  });
  window.addEventListener('pageshow', (ev) => {
    if (!ev.persisted) return;
    const c = lerMeuCarro();
    if (c && palco.getAttribute('data-ab') === 'carro' && (carroAgora?.m !== c.m || carroAgora?.y !== c.y)) comCarro(c, true);
  });

  // ---- vida: só com o palco na tela e a aba à vista ----
  let naTela = false;
  const viver = () => palco.toggleAttribute('data-ab-vivo', naTela && !document.hidden && !calmo);
  document.addEventListener('visibilitychange', viver);

  // paralaxe pelo ponteiro (mouse de verdade, PC): duas variáveis no palco, suavizadas num laço que para sozinho
  if (!calmo && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let ax = 0, ay = 0, x = 0, y = 0, rodando = 0;
    const passo = () => {
      x += (ax - x) * 0.085; y += (ay - y) * 0.085;
      cena.style.setProperty('--px', x.toFixed(4));
      cena.style.setProperty('--py', y.toFixed(4));
      rodando = Math.abs(ax - x) + Math.abs(ay - y) > 0.002 ? requestAnimationFrame(passo) : 0;
    };
    sec.addEventListener('pointermove', (ev) => {
      if (!naTela || !largo.matches) return;
      const r = sec.getBoundingClientRect();
      ax = ((ev.clientX - r.left) / r.width - 0.62) * 2;
      ay = ((ev.clientY - r.top) / r.height - 0.5) * 2;
      if (!rodando) rodando = requestAnimationFrame(passo);
    }, { passive: true });
    sec.addEventListener('pointerleave', () => { ax = 0; ay = 0; if (!rodando) rodando = requestAnimationFrame(passo); });
  }

  sec.setAttribute('data-ab-montada', '');
  // ---- começo: quando o palco chega perto da tela (no celular ele fica abaixo do cartão) ----
  let comecou = false;
  function comecar() {
    if (comecou) return;
    comecou = true;
    palco.removeAttribute('data-ab-dorme');
    const salvo = palco.getAttribute('data-ab') === 'carro' ? lerMeuCarro() : null;
    if (salvo) { for (const d of drls) if (palco.contains(d)) d.classList.remove('ab-apagado'); comCarro(salvo, true); }
    else { whatsDoSelo(null); entrar(cenaBase()).then(() => setTimeout(() => brilhar(false, drls.filter((d) => palco.contains(d))), 380)); }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      for (const e of es) {
        naTela = e.isIntersecting;
        if (naTela) comecar();
      }
      viver();
    }, { rootMargin: '80px 0px' }).observe(palco);
  } else { naTela = true; comecar(); viver(); }
  // a luz do farolzinho da 1ª tela do celular não espera o palco
  setTimeout(() => brilhar(false, drls.filter((d) => !palco.contains(d))), largo.matches ? 0 : 650);
  const c0 = lerMeuCarro();
  if (c0) whatsDoSelo(c0);
}
