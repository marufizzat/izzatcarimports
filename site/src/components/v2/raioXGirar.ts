// "Girar o carro": a 2ª vista do Raio-x (components/v2/RaioX.astro), o MESMO carro visto por trás e pelo lado direito
// (lib/raioXTras.ts). Baixado só quando a pessoa gira o carro (o botão na arte, deslizar o dedo, as setas do teclado)
// ou escolhe uma parte que fica do outro lado; a arte desce junto (e já decodificada antes da troca).
// - A camada de trás é feita com CÓPIAS das peças da camada da frente (a arte, os dois véus, o mapa de toque, os
//   pontos e as etiquetas): cada cópia leva o atributo de escopo do CSS do Raio-x, então o desenho, o "aceso", o
//   "vazia" e o "novo" valem igual nas duas vistas, sem estilo repetido. Só a geometria muda.
// - Cada vista fica numa caixa só dela (.rxg-lado: a arte, os véus, o mapa, os pontos e as etiquetas). A troca: as duas
//   caixas se cruzam com um leve aperto e deslize na horizontal, que se lê como o carro girando no lugar, com os
//   pontos e as etiquetas indo junto com o carro deles; o fundo do estúdio e o botão ficam parados. É a Web Animations
//   (só opacidade e transform, na placa de vídeo), igual em todo navegador. A View Transition do navegador foi medida
//   e saiu: ao começar e ao acabar, o Chrome recalcula o estilo da página inteira (54–80 ms com CPU 4× na home).
//   Com "reduzir movimento" ou aparelho fraco, troca na hora.
import css from './raioXGirar.css?inline';
import { ARTE_TRAS, ZONAS_TRAS } from '../../lib/raioXTras';
import type { LadoArte } from '../../lib/raioX';

export type CtxGirar = {
  raiz: HTMLElement; palco: HTMLElement;
  /** o sizes da arte no palco (o mesmo da arte da frente) */
  sizes: string;
};

const pct = (v: number, t: number) => `${((v / t) * 100).toFixed(2)}%`;
const calmo = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('leve');
const DURACAO = 380;

let estilo = false;
function porEstilo() {
  if (estilo) return;
  estilo = true;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
}

/** Uma cópia vazia do elemento (leva as classes e o escopo do CSS), sem os estados da vista da frente. */
function copia<T extends Element>(el: T, fundo = false): T {
  const c = el.cloneNode(fundo) as T;
  c.classList.remove('aceso', 'on', 'aquece', 'outro');
  return c;
}

export function ligarGirar(ctx: CtxGirar) {
  porEstilo();
  const { raiz, palco } = ctx;
  const filho = <T extends Element>(sel: string) => palco.querySelector<T>(`:scope > ${sel}`)!;
  // ---- a camada da frente (a do HTML): só a marca de qual vista é ----
  const imgF = filho<HTMLImageElement>('img');
  const daFrente = [...palco.querySelectorAll<HTMLElement>(':scope > img, :scope > .rx-camada, :scope > .rx-mapa, :scope > .rx-ponto, :scope > .rx-etiqueta')];

  // ---- a camada de trás: cópias das peças da frente com a geometria de lib/raioXTras.ts ----
  const novos: Element[] = [];
  const poli = (p: string) => `M${p.trim().split(/\s+/).join('L')}Z`;
  const imgT = copia(imgF);
  imgT.removeAttribute('loading');
  imgT.removeAttribute('fetchpriority');
  imgT.sizes = ctx.sizes;
  imgT.srcset = `${ARTE_TRAS.src.replace(/\.webp$/, '-900.webp')} 900w, ${ARTE_TRAS.src} ${ARTE_TRAS.w}w`;
  imgT.src = ARTE_TRAS.src;
  novos.push(imgT);

  const escurosF = filho<SVGSVGElement>('.rx-escuros');
  const escuros = copia(escurosF);
  const furo0 = escurosF.querySelector('path')!;
  for (const z of ZONAS_TRAS) {
    const p = copia(furo0);
    p.setAttribute('data-furo', z.k);
    p.setAttribute('d', `M-120,-120H${ARTE_TRAS.w + 120}V${ARTE_TRAS.h + 120}H-120Z ${z.realce.map(poli).join(' ')}`);
    escuros.appendChild(p);
  }
  novos.push(escuros);

  const realcesF = filho<SVGSVGElement>('.rx-realces');
  const realces = copia(realcesF);
  const g0 = realcesF.querySelector('g')!;
  const pol0 = g0.querySelector('polygon')!;
  for (const z of ZONAS_TRAS) {
    const g = copia(g0);
    g.setAttribute('data-realce', z.k);
    for (const r of z.realce) { const p = copia(pol0); p.setAttribute('points', r); g.appendChild(p); }
    realces.appendChild(g);
  }
  novos.push(realces);

  const mapaF = filho<SVGSVGElement>('.rx-mapa');
  const mapa = copia(mapaF);
  const guiasF = mapaF.querySelector('.rx-guias')!;
  const guias = copia(guiasF);
  const linha0 = guiasF.querySelector('line')!;
  for (const z of ZONAS_TRAS) {
    const l = copia(linha0);
    l.setAttribute('data-guia', z.k);
    l.setAttribute('x1', String(z.ancora[0])); l.setAttribute('y1', String(z.ancora[1]));
    l.setAttribute('x2', String(z.etiqueta[0])); l.setAttribute('y2', String(z.etiqueta[1]));
    guias.appendChild(l);
  }
  mapa.appendChild(guias);
  const ancoras: SVGAElement[] = [];
  for (const z of ZONAS_TRAS) {
    // a zona da frente de mesma chave: o endereço (#painel), o nome para o leitor de tela e o "vazia" são os dela
    const aF = mapaF.querySelector<SVGAElement>(`a[data-z="${z.k}"]`)!;
    const a = copia(aF);
    const alvo0 = aF.querySelector('polygon')!;
    for (const pg of z.poligonos) { const p = copia(alvo0); p.setAttribute('points', pg); a.appendChild(p); }
    mapa.appendChild(a);
    ancoras.push(a);
  }
  novos.push(mapa);

  for (const z of ZONAS_TRAS) {
    // o ponto e a etiqueta da MESMA zona (o número, o nome e a contagem vêm prontos), só no lugar desta vista
    const p = copia(filho<HTMLElement>(`.rx-ponto[data-ponto="${z.k}"]`), true);
    p.style.left = pct(z.ancora[0], ARTE_TRAS.w);
    p.style.top = pct(z.ancora[1], ARTE_TRAS.h);
    novos.push(p);
  }
  for (const z of ZONAS_TRAS) {
    const e = copia(filho<HTMLElement>(`.rx-etiqueta[data-etiqueta="${z.k}"]`), true);
    e.style.left = pct(z.etiqueta[0], ARTE_TRAS.w);
    e.style.top = pct(z.etiqueta[1], ARTE_TRAS.h);
    novos.push(e);
  }
  // cada vista na caixa dela, no começo do palco: o botão de girar e as camadas dos outros modos (.rxb, .rxf) ficam por
  // cima e fora das caixas (não giram junto)
  const caixa = (v: 'f' | 't', filhos: Element[]) => {
    const c = document.createElement('div');
    c.className = 'rxg-lado';
    c.dataset.v = v;
    for (const el of filhos) c.appendChild(el);
    return c;
  };
  const antes = daFrente[0];
  const ladoF = document.createElement('div');
  ladoF.className = 'rxg-lado';
  ladoF.dataset.v = 'f';
  palco.insertBefore(ladoF, antes);
  for (const el of daFrente) ladoF.appendChild(el);
  const ladoT = caixa('t', novos);
  palco.insertBefore(ladoT, ladoF.nextSibling);

  // ---- a arte de trás, baixada e decodificada antes da 1ª troca (a transição nunca mostra a imagem pela metade) ----
  let pronta: Promise<void> | null = null;
  function preparar(): Promise<void> {
    pronta ??= new Promise<void>((ok, falha) => {
      const fim = () => (imgT.decode ? imgT.decode().then(() => ok(), () => ok()) : ok());
      if (imgT.complete && imgT.naturalWidth) fim();
      else { imgT.addEventListener('load', fim, { once: true }); imgT.addEventListener('error', () => falha(new Error('arte')), { once: true }); }
    });
    pronta.catch(() => { pronta = null; imgT.src = ARTE_TRAS.src; });
    return pronta;
  }

  /** Troca de vista. `dir`: 1 = o carro gira para a esquerda (o dedo deslizou para a esquerda, seta →), -1 = para a
   *  direita. `muda` troca o estado (data-lado, classes, foco) de uma vez; resolve quando a animação acaba. */
  function trocar(dir: 1 | -1, muda: () => void): Promise<void> {
    const sai = raiz.dataset.lado === 'tras' ? ladoT : ladoF;
    const entra = sai === ladoT ? ladoF : ladoT;
    if (calmo() || !sai.animate) { muda(); return Promise.resolve(); }
    // durante o giro as duas caixas ficam à vista; a que entra já vem com o estado novo (classes, pontos, foco)
    raiz.setAttribute('data-girando', '');
    muda();
    const x = 7 * dir;
    const a = sai.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-x}%) scaleX(.8)` }], { duration: DURACAO, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'both' });
    const b = entra.animate([{ opacity: 0, transform: `translateX(${x}%) scaleX(.8)` }, { opacity: 1, transform: 'none' }], { duration: DURACAO, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' });
    // os pontos da batida (uma camada só, refeita na troca) somem com a vista que sai e voltam no fim
    const c = palco.querySelector<HTMLElement>(':scope > .rxb')?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.62 }, { opacity: 1 }], { duration: DURACAO });
    const fim = () => {
      raiz.removeAttribute('data-girando');
      a.cancel(); b.cancel(); c?.cancel();
    };
    return Promise.all([a.finished, b.finished]).then(fim, fim);
  }

  return {
    /** as zonas de trás (para os ouvintes do Raio-x: clique, foco, mouse em cima) */
    ancoras,
    preparar, trocar,
    /** o ponto da zona nesta vista, em % do palco (a origem do zoom da vista "por dentro") */
    origem: (k: string, lado: LadoArte): string | null => {
      const z = lado === 'tras' ? ZONAS_TRAS.find((x) => x.k === k && !x.longe) : null;
      return z ? `${pct(z.ancora[0], ARTE_TRAS.w)} ${pct(z.ancora[1], ARTE_TRAS.h)}` : null;
    },
  };
}
export type Girar = ReturnType<typeof ligarGirar>;
