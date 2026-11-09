// Gaveta (sheet/drawer). Adaptada do componente "Drawer" do 21st.dev (autor: wensity),
// reescrita sem Base UI: no celular sobe de baixo com alca e arrastar para fechar;
// no desktop desliza pela direita. Foco preso, ESC, trava de rolagem e foco devolvido.
import {
  useEffect, useId, useRef, useState,
  type CSSProperties, type PointerEvent as PE, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type Props = {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
};

const DURACAO = 340;
const FOCAVEIS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const CSS = `
.gv-fundo{position:fixed;inset:0;z-index:1000;background:rgb(16 16 20 / .42);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .3s ease}
.gv-fundo.on{opacity:1}
html.leve .gv-fundo{-webkit-backdrop-filter:none;backdrop-filter:none}
.gv-painel{position:fixed;z-index:1001;left:0;right:0;bottom:0;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;
  background:var(--surface);color:var(--ink);border-radius:24px 24px 0 0;box-shadow:var(--shadow-2);
  transform:translate3d(0,calc(var(--dy,0px) + 100%),0);transition:transform .34s cubic-bezier(.2,.8,.2,1);overscroll-behavior:contain}
.gv-painel.on{transform:translate3d(0,var(--dy,0px),0)}
.gv-topo{touch-action:none;flex:none;cursor:grab;user-select:none;-webkit-user-select:none}
.gv-alca{display:block;width:44px;height:5px;margin:10px auto 0;border-radius:99px;background:var(--line-2)}
.gv-cabeca{display:flex;align-items:center;gap:12px;padding:6px 12px 12px 20px}
.gv-titulo{flex:1;min-width:0;margin:0;font-stretch:84%;font-weight:800;font-size:22px;line-height:1.1;letter-spacing:-.01em}
.gv-fechar{flex:none;width:44px;height:44px;border:0;border-radius:12px;display:grid;place-items:center;padding:0;
  background:var(--surface-2);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line);transition:background-color .2s}
.gv-fechar:hover{background:var(--bg-2)}
.gv-fechar svg{width:20px;height:20px}
.gv-corpo{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:4px 20px 24px}
.gv-rodape{flex:none;padding:14px 20px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--surface)}
.gv-rodape > *{width:100%}
@media (min-width:768px){
  .gv-painel{top:0;left:auto;bottom:0;width:min(440px,100vw);max-height:none;height:100dvh;border-radius:0;
    transform:translate3d(100%,0,0);transition:transform .36s cubic-bezier(.2,.8,.2,1)}
  .gv-painel.on{transform:none}
  .gv-alca{display:none}
  .gv-topo{cursor:default}
  .gv-cabeca{padding-top:22px}
  .gv-corpo{padding-top:8px}
}
@media (prefers-reduced-motion:reduce){.gv-fundo,.gv-painel{transition:none!important}}
`;

// Prende o Tab dentro do elemento (foco ciclico).
function prenderTab(e: KeyboardEvent, raiz: HTMLElement | null) {
  if (e.key !== 'Tab' || !raiz) return;
  const f = [...raiz.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((el) => el.getClientRects().length > 0);
  if (!f.length) return;
  const ativo = document.activeElement;
  const primeiro = f[0];
  const ultimo = f[f.length - 1];
  if (e.shiftKey && (ativo === primeiro || !raiz.contains(ativo))) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && (ativo === ultimo || !raiz.contains(ativo))) {
    e.preventDefault();
    primeiro.focus();
  }
}

export default function Gaveta({ aberta, aoFechar, titulo, children, rodape }: Props) {
  const id = useId();
  const [montada, setMontada] = useState(false);
  const [on, setOn] = useState(false);
  const [dy, setDy] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const painel = useRef<HTMLDivElement>(null);
  const botaoFechar = useRef<HTMLButtonElement>(null);
  const focoAntes = useRef<HTMLElement | null>(null);
  const fecharRef = useRef(aoFechar);
  const gesto = useRef<{ y: number; t: number; id: number; dy: number } | null>(null);

  useEffect(() => {
    fecharRef.current = aoFechar;
  }, [aoFechar]);

  // montar -> animar entrada; desmontar so depois da animacao de saida
  useEffect(() => {
    if (aberta) {
      focoAntes.current = document.activeElement as HTMLElement | null;
      setMontada(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
      return () => cancelAnimationFrame(r);
    }
    setOn(false);
    const t = window.setTimeout(() => {
      setMontada(false);
      setDy(0);
      focoAntes.current?.focus({ preventScroll: true });
    }, DURACAO);
    return () => window.clearTimeout(t);
  }, [aberta]);

  // trava de rolagem, foco inicial, ESC e foco preso
  useEffect(() => {
    if (!aberta || !montada) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';
    botaoFechar.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fecharRef.current();
        return;
      }
      prenderTab(e, painel.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = antes;
    };
  }, [aberta, montada]);

  // arrastar para baixo (so no celular)
  const ehCelular = () => window.matchMedia('(max-width: 767px)').matches;
  const pDown = (e: PE<HTMLDivElement>) => {
    if (!ehCelular() || (e.target as HTMLElement).closest('button')) return;
    gesto.current = { y: e.clientY, t: performance.now(), id: e.pointerId, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastando(true);
  };
  const pMove = (e: PE<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    g.dy = Math.max(0, e.clientY - g.y);
    setDy(g.dy);
  };
  const pFim = (e: PE<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    gesto.current = null;
    setArrastando(false);
    const d = g.dy;
    const velocidade = d / Math.max(1, performance.now() - g.t);
    if (d > 110 || (velocidade > 0.55 && d > 30)) {
      aoFechar(); // sai a partir da posicao atual; dy e zerado ao desmontar
    } else {
      setDy(0); // volta com transicao
    }
  };

  if (!montada) return null;

  const estilo = {
    '--dy': `${dy}px`,
    transition: arrastando ? 'none' : undefined,
  } as CSSProperties;

  return createPortal(
    <div className="gv">
      <style>{CSS}</style>
      <div className={`gv-fundo${on ? ' on' : ''}`} onClick={aoFechar} aria-hidden="true" />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`gv-painel${on ? ' on' : ''}`}
        style={estilo}
      >
        <div
          className="gv-topo"
          onPointerDown={pDown}
          onPointerMove={pMove}
          onPointerUp={pFim}
          onPointerCancel={pFim}
        >
          <span className="gv-alca" aria-hidden="true" />
          <div className="gv-cabeca">
            <h2 id={id} className="gv-titulo">{titulo}</h2>
            <button ref={botaoFechar} type="button" className="gv-fechar" aria-label="Fechar" onClick={aoFechar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="gv-corpo">{children}</div>
        {rodape && <div className="gv-rodape">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

// Exemplo de uso (para a pagina de teste): botao + gaveta com filtros.
export function GavetaDemo() {
  const [aberta, setAberta] = useState(false);
  const fechar = () => setAberta(false);
  return (
    <>
      <button type="button" className="botao botao-linha" aria-haspopup="dialog" onClick={() => setAberta(true)}>
        Abrir gaveta de filtros
      </button>
      <Gaveta
        aberta={aberta}
        aoFechar={fechar}
        titulo="Filtrar peças"
        rodape={
          <button type="button" className="botao botao-laranja" onClick={fechar}>
            Ver as peças
          </button>
        }
      >
        <fieldset style={{ border: 0, margin: '12px 0 0', padding: 0, display: 'grid', gap: 10 }}>
          <legend style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>Marca</legend>
          {['Chevrolet', 'Volkswagen', 'Fiat', 'Renault'].map((m) => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, fontSize: 16 }}>
              <input type="checkbox" style={{ width: 20, height: 20, accentColor: 'var(--accent)' }} /> {m}
            </label>
          ))}
        </fieldset>
        <p style={{ color: 'var(--ink-2)', fontSize: 14, marginTop: 24 }}>
          Gaveta de teste: no celular arrasta pela alça para baixo; no desktop abre pela direita.
        </p>
      </Gaveta>
    </>
  );
}
