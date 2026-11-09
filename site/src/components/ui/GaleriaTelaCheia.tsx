// Visualizador de fotos em tela cheia para a pagina da peca.
// Inspirado no "Thumbnail image viewer" do 21st.dev (autor: ibrandify): faixa de miniaturas
// com setas do teclado e foco visivel, reescrito sem dependencias e com zoom e gestos.
import {
  useEffect, useId, useRef, useState,
  type MouseEvent as RME, type PointerEvent as PE,
} from 'react';
import { createPortal } from 'react-dom';

// fotos: sem a prop, a galeria lê as fotos do trilho da página ([data-trilho] img, a mesma ordem): assim a lista
// não se repete dentro do HTML de cada peça.
type Props = { fotos?: string[]; titulo: string };
type Vista = { s: number; x: number; y: number };
type Gesto = {
  modo: 'arrastar' | 'pinca';
  x: number; y: number;       // ponto inicial do dedo/mouse
  vx: number; vy: number;     // pan inicial
  s0: number;                 // zoom inicial
  d0: number;                 // distancia inicial entre dedos
  mov: number;                // quanto mexeu (para separar toque de arrasto)
  t: number;                  // hora do inicio
};

const MIN = 1;
const MAX = 4;
const DUPLO = 2.5;
const VISTA_INICIAL: Vista = { s: 1, x: 0, y: 0 };
const FOCAVEIS = 'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const CSS = `
.gt{position:fixed;inset:0;z-index:1100;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:var(--plate);color:#1d1d1f;
  opacity:0;transition:opacity .22s ease;user-select:none;-webkit-user-select:none}
.gt.on{opacity:1}
.gt.mexendo .gt-trilho,.gt.mexendo .gt-foto{transition:none}
.gt-topo{display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 12px 10px 16px;min-width:0}
.gt-titulo{flex:1;min-width:0;margin:0;font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gt-contador{flex:none;padding:6px 11px;border-radius:999px;background:#1d1d1f;color:#fff;font-size:13px;font-weight:650;font-variant-numeric:tabular-nums}
.gt-botao{flex:none;width:44px;height:44px;border:0;border-radius:12px;display:grid;place-items:center;padding:0;background:#ececf0;color:#1d1d1f;cursor:pointer}
.gt-botao:hover{background:#e2e2e7}
.gt-botao svg{width:20px;height:20px}
.gt-meio{position:relative;min-height:0;overflow:hidden}
.gt-palco{position:absolute;inset:0;overflow:hidden;touch-action:none;cursor:zoom-in}
.gt-palco.amplo{cursor:grab}
.gt-palco.amplo:active{cursor:grabbing}
.gt-trilho{display:flex;height:100%;width:100%;transition:transform .34s cubic-bezier(.2,.8,.2,1);will-change:transform}
/* flex, nao grid: no grid a altura 100% da foto nao resolvia, a foto ficava do tamanho da largura (1440x1440 no PC) e cortava */
.gt-slide{flex:0 0 100%;height:100%;display:flex;align-items:center;justify-content:center;min-width:0}
.gt-foto{width:100%;height:100%;object-fit:contain;padding:5%;-webkit-user-drag:none;pointer-events:none;transform-origin:center center;
  transition:transform .26s cubic-bezier(.2,.8,.2,1)}
.gt-dica{display:none;position:absolute;left:50%;top:12px;z-index:2;transform:translateX(-50%);padding:6px 12px;border-radius:999px;
  background:rgb(255 255 255 / .92);color:#1d1d1f;font-size:12.5px;font-weight:600;white-space:nowrap;pointer-events:none;box-shadow:0 4px 14px -6px rgb(0 0 0 / .3)}
@media (hover:none){.gt-dica{display:block}}
.gt-seta{position:absolute;top:50%;z-index:2;width:48px;height:48px;margin-top:-24px;border:0;border-radius:50%;display:none;place-items:center;padding:0;
  background:rgb(255 255 255 / .92);color:#1d1d1f;box-shadow:0 6px 18px -6px rgb(0 0 0 / .25),inset 0 0 0 1px #e2e2e7;cursor:pointer}
.gt-seta:disabled{opacity:.35;cursor:default}
.gt-seta svg{width:22px;height:22px}
.gt-seta.esq{left:14px}
.gt-seta.dir{right:14px}
@media (min-width:720px){.gt-seta{display:grid}}
.gt-faixa{display:flex;gap:8px;overflow-x:auto;justify-content:safe center;padding:10px 14px calc(14px + env(safe-area-inset-bottom));scrollbar-width:none;overscroll-behavior-x:contain}
.gt-faixa::-webkit-scrollbar{display:none}
.gt-mini{flex:none;width:60px;height:60px;padding:0;border:0;border-radius:12px;overflow:hidden;background:#f5f5f7;cursor:pointer;
  box-shadow:inset 0 0 0 1.5px #e2e2e7;opacity:.62;transition:opacity .2s,box-shadow .2s}
.gt-mini[aria-current="true"]{opacity:1;box-shadow:inset 0 0 0 2.5px var(--accent)}
.gt-mini img{width:100%;height:100%;object-fit:contain;padding:4px;pointer-events:none}
@media (prefers-reduced-motion:reduce){.gt,.gt-trilho,.gt-foto,.gt-mini{transition:none!important}}
`;

// Prende o Tab dentro da galeria.
function prenderTab(e: globalThis.KeyboardEvent, raiz: HTMLElement | null) {
  if (e.key !== 'Tab' || !raiz) return;
  const f = [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.getClientRects().length > 0);
  if (!f.length) return;
  const ativo = document.activeElement;
  if (e.shiftKey && (ativo === f[0] || !raiz.contains(ativo))) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && (ativo === f[f.length - 1] || !raiz.contains(ativo))) { e.preventDefault(); f[0].focus(); }
}

function fotosDaPagina(): string[] {
  if (typeof document === 'undefined') return [];
  return [...document.querySelectorAll<HTMLImageElement>('[data-trilho] img')].map((i) => i.getAttribute('src') || '').filter(Boolean);
}

export default function GaleriaTelaCheia({ fotos: fotosProp, titulo }: Props) {
  const id = useId();
  const [fotos] = useState<string[]>(() => fotosProp ?? fotosDaPagina());
  const [aberta, setAberta] = useState(false);
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [vista, setVistaState] = useState<Vista>(VISTA_INICIAL);
  const [arrasto, setArrasto] = useState(0);
  const [mexendo, setMexendo] = useState(false);

  const vistaRef = useRef<Vista>(VISTA_INICIAL);
  const arrastoRef = useRef(0);
  const palco = useRef<HTMLDivElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const faixa = useRef<HTMLElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const focoAntes = useRef<HTMLElement | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<Gesto | null>(null);
  const toque = useRef<{ t: number; x: number; y: number } | null>(null);
  const tipoUlt = useRef<string>('mouse');

  const setVista = (v: Vista) => {
    vistaRef.current = v;
    setVistaState(v);
  };

  // mantem o pan dentro da foto ampliada
  const limita = (v: Vista): Vista => {
    if (v.s <= 1) return VISTA_INICIAL;
    const r = palco.current?.getBoundingClientRect();
    if (!r) return v;
    const mx = ((v.s - 1) * r.width) / 2;
    const my = ((v.s - 1) * r.height) / 2;
    return { s: v.s, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
  };

  // zoom mantendo o ponto do dedo/cursor parado na tela
  const zoomEm = (sBruto: number, px: number, py: number) => {
    const v = vistaRef.current;
    const r = palco.current?.getBoundingClientRect();
    if (!r) return;
    const s2 = clamp(sBruto, MIN, MAX);
    if (s2 === v.s) return;
    const ax = px - (r.left + r.width / 2);
    const ay = py - (r.top + r.height / 2);
    const k = s2 / v.s;
    setVista(limita({ s: s2, x: ax - k * (ax - v.x), y: ay - k * (ay - v.y) }));
  };

  const duploZoom = (px: number, py: number) => {
    if (vistaRef.current.s > 1) setVista(VISTA_INICIAL);
    else zoomEm(DUPLO, px, py);
  };

  const irPara = (n: number) => {
    const k = clamp(n, 0, fotos.length - 1);
    setVista(VISTA_INICIAL);
    setI(k);
  };

  const fechar = () => {
    setOn(false);
    window.setTimeout(() => {
      setAberta(false);
      focoAntes.current?.focus({ preventScroll: true });
    }, 220);
  };

  // abrir pelo evento global 'abrir-galeria' { indice }
  useEffect(() => {
    const abrir = (e: Event) => {
      const d = (e as CustomEvent<{ indice?: number }>).detail;
      focoAntes.current = document.activeElement as HTMLElement | null;
      setI(clamp(Math.trunc(d?.indice ?? 0), 0, Math.max(0, fotos.length - 1)));
      setVista(VISTA_INICIAL);
      setArrasto(0);
      arrastoRef.current = 0;
      setAberta(true);
      (window as any).__galeriaPendente = undefined;
    };
    window.addEventListener('abrir-galeria', abrir);
    // clique que aconteceu antes da ilha montar (client:idle)
    const pend = (window as any).__galeriaPendente;
    if (typeof pend === 'number') abrir(new CustomEvent('abrir-galeria', { detail: { indice: pend } }));
    return () => window.removeEventListener('abrir-galeria', abrir);
  }, [fotos.length]);

  // trava de rolagem, foco inicial e animacao de entrada
  useEffect(() => {
    if (!aberta) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    botaoFechar.current?.focus({ preventScroll: true });
    return () => {
      cancelAnimationFrame(r);
      html.style.overflow = antes;
    };
  }, [aberta]);

  // teclado: ESC, setas, Home/End e foco preso
  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); irPara(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); irPara(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); irPara(0); }
      else if (e.key === 'End') { e.preventDefault(); irPara(fotos.length - 1); }
      else prenderTab(e, dialogo.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberta, i, fotos.length]);

  // roda do mouse: zoom no ponto do cursor (listener nao passivo para poder cancelar)
  useEffect(() => {
    const el = palco.current;
    if (!aberta || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY) return;
      e.preventDefault();
      zoomEm(vistaRef.current.s * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [aberta, on]);

  // miniatura ativa sempre visivel
  useEffect(() => {
    if (!aberta) return;
    faixa.current?.querySelectorAll<HTMLButtonElement>('button')[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [i, aberta]);

  // ---- gestos: deslizar entre fotos, arrastar com zoom, pinca e toque duplo
  const pDown = (e: PE<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    tipoUlt.current = e.pointerType;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = vistaRef.current;
    if (ptrs.current.size === 1) {
      gesto.current = { modo: 'arrastar', x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, s0: v.s, d0: 0, mov: 0, t: performance.now() };
      setMexendo(true);
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesto.current = { modo: 'pinca', x: 0, y: 0, vx: v.x, vy: v.y, s0: v.s, d0: dist(a, b), mov: 99, t: 0 };
    }
  };

  const pMove = (e: PE<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesto.current;
    if (!g) return;
    if (g.modo === 'arrastar') {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      g.mov = Math.max(g.mov, Math.abs(dx) + Math.abs(dy));
      if (g.s0 > 1) {
        setVista(limita({ s: g.s0, x: g.vx + dx, y: g.vy + dy }));
      } else {
        arrastoRef.current = dx;
        setArrasto(dx);
      }
    } else if (ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const s2 = clamp((g.s0 * dist(a, b)) / g.d0, MIN, MAX);
      const k = s2 / g.s0;
      setVista(limita({ s: s2, x: g.vx * k, y: g.vy * k }));
    }
  };

  const pFim = (e: PE<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.delete(e.pointerId);
    const g = gesto.current;
    if (ptrs.current.size > 0) {
      // pinca terminou com um dedo ainda na tela: ignora ate soltar tudo
      if (g?.modo === 'pinca') gesto.current = null;
      return;
    }
    gesto.current = null;
    setMexendo(false);
    if (vistaRef.current.s < 1.02) setVista(VISTA_INICIAL);
    if (g?.modo === 'arrastar') {
      const dx = arrastoRef.current;
      const rapido = performance.now() - g.t < 260;
      if (g.s0 <= 1 && vistaRef.current.s <= 1) {
        if (Math.abs(dx) > 60 || (Math.abs(dx) > 24 && rapido)) irPara(dx < 0 ? i + 1 : i - 1);
      }
      arrastoRef.current = 0;
      setArrasto(0);
      // toque duplo no celular -> zoom
      if (tipoUlt.current === 'touch' && g.mov < 12) {
        const agora = performance.now();
        const ult = toque.current;
        if (ult && agora - ult.t < 320 && dist(ult, { x: e.clientX, y: e.clientY }) < 40) {
          toque.current = null;
          duploZoom(e.clientX, e.clientY);
        } else {
          toque.current = { t: agora, x: e.clientX, y: e.clientY };
        }
      }
    }
  };

  // duplo clique no desktop (no celular o toque duplo ja e tratado acima)
  const onDuplo = (e: RME<HTMLDivElement>) => {
    if (tipoUlt.current === 'touch') return;
    duploZoom(e.clientX, e.clientY);
  };

  if (!aberta) return null;

  const ampliada = vista.s > 1;
  const ultimo = fotos.length - 1;

  return createPortal(
    <div ref={dialogo} role="dialog" aria-modal="true" aria-labelledby={id} className={`gt${on ? ' on' : ''}${mexendo ? ' mexendo' : ''}`}>
      <style>{CSS}</style>

      <header className="gt-topo">
        <p id={id} className="gt-titulo">{titulo}</p>
        <span className="gt-contador" aria-live="polite">{i + 1} / {fotos.length}</span>
        <button ref={botaoFechar} type="button" className="gt-botao" aria-label="Fechar galeria" onClick={fechar}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="gt-meio">
        <span className="gt-dica" aria-hidden="true">Aperte com dois dedos para ampliar</span>
        <div
          ref={palco}
          className={`gt-palco${ampliada ? ' amplo' : ''}`}
          onPointerDown={pDown}
          onPointerMove={pMove}
          onPointerUp={pFim}
          onPointerCancel={pFim}
          onDoubleClick={onDuplo}
        >
          <div
            className="gt-trilho"
            style={{ transform: `translate3d(calc(${-i * 100}% + ${arrasto}px), 0, 0)` }}
          >
            {fotos.map((src, k) => (
              <div key={`${k}-${src}`} className="gt-slide">
                <img
                  className="gt-foto"
                  src={src}
                  alt={`${titulo}, foto ${k + 1} de ${fotos.length}`}
                  draggable={false}
                  decoding="async"
                  loading={Math.abs(k - i) <= 1 ? 'eager' : 'lazy'}
                  style={
                    k === i
                      ? { transform: `translate3d(${vista.x}px, ${vista.y}px, 0) scale(${vista.s})` }
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <button type="button" className="gt-seta esq" aria-label="Foto anterior" disabled={i === 0} onClick={() => irPara(i - 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button type="button" className="gt-seta dir" aria-label="Próxima foto" disabled={i === ultimo} onClick={() => irPara(i + 1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <nav ref={faixa} className="gt-faixa" aria-label="Miniaturas das fotos">
        {fotos.map((src, k) => (
          <button
            key={`m-${k}-${src}`}
            type="button"
            className="gt-mini"
            aria-label={`Foto ${k + 1}`}
            aria-current={k === i ? 'true' : undefined}
            onClick={() => irPara(k)}
          >
            <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
          </button>
        ))}
      </nav>
    </div>,
    document.body,
  );
}
