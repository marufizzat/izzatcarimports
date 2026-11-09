// Campo de busca com sugestoes ao vivo (cabecalho e hero).
// Adaptado do padrao "Async Autocomplete" do 21st.dev (autor: coss.com): debounce, estado de
// carregando, vazio e lista com teclado (combobox/listbox), reescrito sobre o motor local Busca.
import {
  useEffect, useId, useMemo, useRef, useState,
  type FocusEvent as FE, type FormEvent as FormE, type KeyboardEvent as KE,
} from 'react';
import { Busca, capaItem, type Item } from '../../lib/busca';
import './sugestoes.css';

type Props = {
  placeholder?: string;
  tamanho?: 'grande' | 'normal';
  autoFoco?: boolean;
  /** texto que já estava no campo (a busca do cabeçalho monta a ilha quando a pessoa chega no campo) */
  inicial?: string;
};

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// um unico download do indice, compartilhado por todas as caixas da pagina.
// O índice de texto é montado aos poucos (sem travar a digitação); enquanto isso aparece "Carregando as peças…".
let carregamento: Promise<Busca> | null = null;
function carregarBusca(): Promise<Busca> {
  carregamento ??= fetch('/dados/busca.json')
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then(async (j) => {
      const b = new Busca(j);
      await b.prepararIndice();
      return b;
    })
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

export default function SugestoesBusca({ placeholder = 'Buscar peça, carro ou código', tamanho = 'normal', autoFoco = false, inicial = '' }: Props) {
  const uid = useId();
  const listaId = `${uid}-lista`;
  const [q, setQ] = useState(inicial);
  const [termo, setTermo] = useState(inicial);
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

  // montada já com o foco (busca do cabeçalho, que monta quando a pessoa chega no campo): baixa o índice na hora
  useEffect(() => {
    if (autoFoco) {
      setFoco(true);
      carregar();
    }
  }, []);

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
