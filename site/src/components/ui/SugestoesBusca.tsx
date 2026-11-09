// Campo de busca com sugestoes ao vivo (cabecalho e hero).
// Adaptado do padrao "Async Autocomplete" do 21st.dev (autor: coss.com): debounce, estado de
// carregando, vazio e lista com teclado (combobox/listbox), reescrito sobre o motor local Busca.
import {
  useEffect, useId, useMemo, useRef, useState,
  type FocusEvent as FE, type FormEvent as FormE, type KeyboardEvent as KE,
} from 'react';
import { Busca, capaItem, type Item } from '../../lib/busca';

type Props = {
  placeholder?: string;
  tamanho?: 'grande' | 'normal';
  autoFoco?: boolean;
};

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// um unico download do indice, compartilhado por todas as caixas da pagina
let carregamento: Promise<Busca> | null = null;
function carregarBusca(): Promise<Busca> {
  carregamento ??= fetch('/dados/busca.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((j) => new Busca(j))
    .catch((e) => {
      carregamento = null; // permite tentar de novo no proximo foco
      throw e;
    });
  return carregamento;
}

const IconeLupa = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export default function SugestoesBusca({ placeholder = 'Buscar peça, carro ou código', tamanho = 'normal', autoFoco = false }: Props) {
  const uid = useId();
  const listaId = `${uid}-lista`;
  const [q, setQ] = useState('');
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState<Busca | null>(null);
  const [estado, setEstado] = useState<'parado' | 'carregando' | 'erro' | 'pronto'>('parado');
  const [foco, setFoco] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const raiz = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // debounce de ~120 ms
  useEffect(() => {
    const t = window.setTimeout(() => setTermo(q), 120);
    return () => window.clearTimeout(t);
  }, [q]);

  const itens = useMemo<Item[]>(
    () => (busca && termo.trim().length >= 2 ? busca.sugestoes(termo, 6) : []),
    [busca, termo],
  );
  const aberto = foco && q.trim().length >= 2;
  const total = itens.length + 1; // ultima linha = ver todos os resultados
  const textoBusca = q.trim();

  useEffect(() => {
    setAtivo(-1);
  }, [termo]);

  const carregar = () => {
    if (busca || estado === 'carregando') return;
    setEstado('carregando');
    carregarBusca()
      .then((b) => {
        setBusca(b);
        setEstado('pronto');
      })
      .catch(() => setEstado('erro'));
  };

  const irPeca = (h: string) => {
    window.location.href = `/peca/${h}.html`;
  };
  const verTodos = () => form.current?.requestSubmit();

  const onKey = (e: KE<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFoco(true);
      setAtivo((a) => (a + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((a) => (a <= 0 ? total - 1 : a - 1));
    } else if (e.key === 'Enter') {
      if (aberto && ativo >= 0) {
        e.preventDefault();
        if (ativo < itens.length) irPeca(itens[ativo].h);
        else verTodos();
      }
      // sem opcao marcada: o formulario envia para /catalogo.html?q=
    } else if (e.key === 'Escape' && aberto) {
      e.preventDefault();
      setFoco(false);
      setAtivo(-1);
    }
  };

  const onBlur = (e: FE<HTMLDivElement>) => {
    if (!raiz.current?.contains(e.relatedTarget as Node | null)) {
      setFoco(false);
      setAtivo(-1);
    }
  };

  const onSubmit = (e: FormE<HTMLFormElement>) => {
    if (!textoBusca) e.preventDefault();
  };

  const semResultado = estado === 'pronto' && termo.trim().length >= 2 && itens.length === 0;
  const mostraCarregando = estado === 'carregando' && !busca;

  return (
    <div className="sb-raiz" ref={raiz} onBlur={onBlur}>
      <style>{CSS_SUGESTOES}</style>
      <form
        ref={form}
        role="search"
        action="/catalogo.html"
        method="get"
        onSubmit={onSubmit}
        className={`busca sb-busca${tamanho === 'grande' ? ' sb-grande' : ''}`}
      >
        <span className="sb-lupa"><IconeLupa /></span>
        <input
          ref={input}
          type="search"
          name="q"
          value={q}
          role="combobox"
          aria-label="Buscar peças"
          aria-expanded={aberto}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={aberto && ativo >= 0 ? `${uid}-op-${ativo}` : undefined}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFoco}
          onChange={(e) => {
            setQ(e.target.value);
            setFoco(true);
            setAtivo(-1);
          }}
          onFocus={() => {
            setFoco(true);
            carregar();
          }}
          onKeyDown={onKey}
        />
        {q && (
          <button
            type="button"
            className="sb-limpar"
            aria-label="Apagar a busca"
            onClick={() => {
              setQ('');
              setTermo('');
              input.current?.focus();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
        <button type="submit" className="botao botao-laranja sb-btn" aria-label="Buscar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <span>Buscar</span>
        </button>
      </form>

      {aberto && (
        <div className="sb-lista">
          {mostraCarregando && (
            <p className="sb-status" aria-live="polite"><span className="sb-giro" aria-hidden="true" />Carregando as peças…</p>
          )}
          {estado === 'erro' && !busca && (
            <p className="sb-status" aria-live="polite">Não deu para carregar a busca agora. Tente de novo em instantes.</p>
          )}
          {semResultado && (
            <p className="sb-status" aria-live="polite">Nada com “{textoBusca}” ainda. Tente o modelo do carro ou o código gravado.</p>
          )}
          <ul id={listaId} role="listbox" aria-label="Sugestões de peças">
            {itens.map((it, k) => (
              <li
                key={it.id}
                id={`${uid}-op-${k}`}
                role="option"
                aria-selected={ativo === k}
                className={`sb-op${ativo === k ? ' on' : ''}`}
                onMouseEnter={() => setAtivo(k)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => irPeca(it.h)}
              >
                <span className="sb-foto">
                  {it.i && <img src={capaItem(it, 'E')} alt="" width={56} height={56} loading="lazy" decoding="async" />}
                </span>
                <span className="sb-txt">
                  <b>{it.n}</b>
                  <small>{[it.b, it.m].filter(Boolean).join(' ')}</small>
                </span>
                <span className="sb-preco">{moeda.format(it.p)}</span>
              </li>
            ))}
            <li
              id={`${uid}-op-${itens.length}`}
              role="option"
              aria-selected={ativo === itens.length}
              className={`sb-op sb-ver${ativo === itens.length ? ' on' : ''}`}
              onMouseEnter={() => setAtivo(itens.length)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={verTodos}
            >
              <span>Ver todos os resultados para “{textoBusca}”</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// estilos do campo (classes .busca, .botao e .botao-laranja vem do global.css)
export const CSS_SUGESTOES = `
.sb-raiz{position:relative;width:100%;min-width:0}
.sb-busca{width:100%;min-width:0}
.sb-busca:not(.sb-grande){height:56px;border-radius:14px;padding-left:16px}
.sb-busca .sb-lupa{display:grid;place-items:center;flex:none;color:var(--ink-3)}
.sb-busca .sb-lupa svg{width:22px;height:22px}
.sb-busca input{min-width:0;flex:1}
.sb-busca input::-webkit-search-cancel-button{-webkit-appearance:none;display:none}
.sb-limpar{flex:none;width:44px;height:44px;border:0;border-radius:12px;padding:0;display:grid;place-items:center;background:transparent;color:var(--ink-3);cursor:pointer}
.sb-limpar:hover{background:var(--surface-2);color:var(--ink)}
.sb-limpar svg{width:18px;height:18px}
.sb-busca .sb-btn svg{width:20px;height:20px;color:var(--on-accent)}
@media (max-width:479px){.sb-btn{padding:0 14px}.sb-btn span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}
.sb-lista{position:absolute;z-index:40;left:0;right:0;top:calc(100% + 8px);max-height:min(70vh,460px);overflow-y:auto;overscroll-behavior:contain;
  padding:6px;border-radius:18px;background:var(--surface);box-shadow:var(--shadow-2);animation:sb-entrar .18s ease both}
.sb-lista ul{list-style:none;margin:0;padding:0}
.sb-status{display:flex;align-items:center;gap:10px;margin:0;padding:12px;font-size:14.5px;color:var(--ink-2);line-height:1.4}
.sb-giro{flex:none;width:16px;height:16px;border-radius:50%;border:2px solid var(--line-2);border-top-color:var(--accent);animation:sb-girar .8s linear infinite}
.sb-op{display:grid;grid-template-columns:56px minmax(0,1fr) auto;align-items:center;gap:12px;min-height:72px;padding:8px 12px 8px 8px;border-radius:14px;cursor:pointer;user-select:none}
.sb-op.on{background:var(--accent-soft)}
.sb-foto{width:56px;height:56px;border-radius:12px;background:var(--plate);display:grid;place-items:center;overflow:hidden}
.sb-foto img{width:100%;height:100%;object-fit:contain;padding:4px}
.sb-txt{min-width:0;display:grid;gap:2px}
.sb-txt b{font-size:15px;font-weight:580;line-height:1.25;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sb-txt small{font-size:13px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-preco{font-stretch:84%;font-weight:800;font-size:17px;color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}
.sb-ver{grid-template-columns:minmax(0,1fr) auto;min-height:52px;margin-top:4px;border-radius:12px;color:var(--accent-text);font-weight:650;font-size:14.5px}
.sb-ver svg{width:20px;height:20px}
.sb-ver span{min-width:0}
@keyframes sb-entrar{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@keyframes sb-girar{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sb-lista,.sb-giro{animation:none!important}}
`;
