// Campo de busca com sugestoes ao vivo (cabecalho e hero).
// Adaptado do padrao "Async Autocomplete" do 21st.dev (autor: coss.com): debounce, estado de
// carregando, vazio e lista com teclado (combobox/listbox), reescrito sobre o motor local Busca.
// As sugestões seguem a MESMA regra do catálogo (lib/busca.ts): o número de "Ver todos" é o que o catálogo mostra.
// No topo, o carro (ou a marca, ou o sistema) que a pessoa digitou, com a contagem. No pé, preso, "Ver todos" e, por
// último, "Não achou? A gente procura no pátio" (WhatsApp com o digitado + o carro, a MESMA mensagem do bloco do catálogo:
// lib/patio.ts), sempre que há 3+ letras, também sem nenhuma sugestão (cliente oculto 10/11, melhoria 2).
// Campo vazio: as últimas buscas da pessoa (até 5, só no navegador dela: lib/buscasRecentes.ts), com "Limpar".
// Peça com a mesma versão de outra ("T8", "2.0": campo dif) leva a pílula ao lado do carro, como no cartão.
import {
  useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type FocusEvent as FE, type FormEvent as FormE, type KeyboardEvent as KE,
} from 'react';
import { Busca, capaItem, carroAnos, type Atalho, type Item, type Sugestoes } from '../../lib/busca';
import { icone } from '../catalogo/etiqueta';
import { whatsUrl } from '../../lib/whats';
import { pedidoPatio } from '../../lib/patio';
import { lerMeuCarro } from '../../lib/meuCarro';
import { guardarBusca, lerRecentes, limparRecentes } from '../../lib/buscasRecentes';
import './sugestoes.css';

type Props = {
  placeholder?: string;
  tamanho?: 'grande' | 'normal';
  autoFoco?: boolean;
  /** texto que já estava no campo (a busca do cabeçalho monta a ilha quando a pessoa chega no campo) */
  inicial?: string;
};

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const n2 = (v: number) => v.toLocaleString('pt-BR');
/** busca longa na tela: corta com "…" (o campo já mostra o texto inteiro) */
const curto = (s: string, max = 28) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

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
      carregamento = null; // permite tentar de novo
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
const IconeSeta = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const IconeSprite = ({ nome }: { nome: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><use href={icone(nome)} /></svg>;
const IconeRelogio = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" />
  </svg>
);
const anosTxt = (y: Item['y']) => (y ? (y[0] === y[1] ? String(y[0]) : `${y[0]}–${y[1]}`) : '');

type Op =
  | { tipo: 'recente'; q: string }
  | { tipo: 'atalho'; a: Atalho }
  | { tipo: 'item'; it: Item }
  | { tipo: 'patio' }
  | { tipo: 'ver' };

export default function SugestoesBusca({ placeholder = 'Buscar peça, carro ou código', tamanho = 'normal', autoFoco = false, inicial = '' }: Props) {
  const uid = useId();
  const listaId = `${uid}-lista`;
  const [q, setQ] = useState(inicial);
  const [termo, setTermo] = useState(inicial);
  const [busca, setBusca] = useState<Busca | null>(null);
  const [estado, setEstado] = useState<'parado' | 'carregando' | 'erro' | 'pronto'>('parado');
  const [foco, setFoco] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [recentes, setRecentes] = useState<string[]>([]);
  const raiz = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const patio = useRef<HTMLAnchorElement>(null);

  // debounce de ~120 ms
  useEffect(() => {
    const t = window.setTimeout(() => setTermo(q), 120);
    return () => window.clearTimeout(t);
  }, [q]);

  const res = useMemo<Sugestoes | null>(
    // o carro salvo ("Meu carro") sobe nas sugestões, como no catálogo
    () => (busca && termo.trim().length >= 2 ? busca.sugestoes(termo, 6, lerMeuCarro()) : null),
    [busca, termo],
  );
  const aberto = foco && q.trim().length >= 2;
  const textoBusca = q.trim();
  // campo vazio: as buscas recentes (se houver)
  const abertoRecentes = foco && !textoBusca && recentes.length > 0;
  const listaAberta = aberto || abertoRecentes;
  const termoTela = curto(termo.trim() || textoBusca);
  const atalhos = res?.atalhos ?? [];
  const semResultado = estado === 'pronto' && !!res && res.total === 0;
  const mostraCarregando = estado === 'carregando' && !busca;
  const erro = estado === 'erro' && !busca;
  // "Não achou?": com 3+ letras ou números digitados (e sempre que a busca não achou nada ou não carregou)
  const comPatio = (textoBusca.match(/[\p{L}\p{N}]/gu) ?? []).length >= 3 || semResultado || erro;
  // com atalho no topo, na busca aproximada ou com a linha do pátio no pé, menos peças: a lista quase cabe sem rolar
  const itens = res ? res.itens.slice(0, (res.aproximado ? 4 : atalhos.length ? 5 : 6) - (comPatio ? 1 : 0)) : [];

  const ops: Op[] = abertoRecentes ? recentes.map((r) => ({ tipo: 'recente' as const, q: r })) : [
    ...atalhos.map((a) => ({ tipo: 'atalho' as const, a })),
    ...itens.map((it) => ({ tipo: 'item' as const, it })),
    ...(!semResultado ? [{ tipo: 'ver' as const }] : []),
    ...(comPatio ? [{ tipo: 'patio' as const }] : []),
  ];
  const total = ops.length;
  // Aviso para o leitor de tela, numa região viva que existe SEMPRE (a que nasce junto com a lista costuma ser pulada):
  // quantas sugestões apareceram, ou que não achou nada.
  const nSug = ops.filter((o) => o.tipo === 'item' || o.tipo === 'atalho').length;
  const anuncio = abertoRecentes ? `${recentes.length === 1 ? '1 busca recente' : `${recentes.length} buscas recentes`}. Use as setas para escolher.`
    : !aberto ? ''
    : mostraCarregando ? 'Carregando as peças…'
    : erro ? 'Não deu para carregar a busca agora.'
    : semResultado ? `Nada com “${termoTela}” no site.`
    : !res ? ''
    : res.aproximado && nSug > 0 ? `Nada exato com “${termoTela}”. ${nSug === 1 ? '1 parecida' : `${nSug} parecidas`}. Use as setas para escolher.`
    : `${nSug === 1 ? '1 sugestão' : `${nSug} sugestões`}. Use as setas para escolher.`;

  useEffect(() => {
    setAtivo(-1);
  }, [termo]);

  // celular com o teclado aberto: a lista termina acima do teclado (o "Ver todos" preso no pé fica à vista)
  useLayoutEffect(() => {
    const el = lista.current;
    if (!listaAberta || !el) return;
    const vv = window.visualViewport;
    const ajustar = () => {
      const r = raiz.current?.getBoundingClientRect();
      if (!r) return;
      const fundo = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const livre = Math.floor(fundo - r.bottom - 16);
      el.style.maxHeight = `${Math.max(200, Math.min(460, livre))}px`;
    };
    ajustar();
    vv?.addEventListener('resize', ajustar);
    vv?.addEventListener('scroll', ajustar);
    return () => {
      vv?.removeEventListener('resize', ajustar);
      vv?.removeEventListener('scroll', ajustar);
    };
  }, [listaAberta]);

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
      setRecentes(lerRecentes());
      carregar();
    }
  }, []);

  // o pedido do pátio: o texto do campo agora (não o atrasado do debounce), o carro digitado e o salvo
  const linkPatio = comPatio
    ? whatsUrl(pedidoPatio({ q: textoBusca, carroDaBusca: res?.carros[0] ?? null, meuCarro: lerMeuCarro() }).texto)
    : '';
  const escolher = (op: Op) => {
    if (op.tipo === 'recente') {
      guardarBusca(op.q);
      window.location.href = `/catalogo.html?${new URLSearchParams({ q: op.q })}`;
      return;
    }
    // o que a pessoa digitou vira busca recente (também quando ela escolhe uma sugestão)
    if (op.tipo !== 'patio') guardarBusca(textoBusca);
    if (op.tipo === 'atalho') window.location.href = op.a.href;
    else if (op.tipo === 'item') window.location.href = `/peca/${op.it.h}.html`;
    // link de verdade (o clique conta no GA4 com o data-botao e abre noutra aba), nunca window.open
    else if (op.tipo === 'patio') patio.current?.click();
    else form.current?.requestSubmit();
  };

  const onKey = (e: KE<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFoco(true);
      setAtivo((a) => (a + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((a) => (a <= 0 ? total - 1 : a - 1));
    } else if (e.key === 'Enter') {
      if (listaAberta && ativo >= 0 && ops[ativo]) {
        e.preventDefault();
        escolher(ops[ativo]);
      }
      // sem opcao marcada: o formulario envia para /catalogo.html?q=
    } else if (e.key === 'Escape' && listaAberta) {
      e.preventDefault();
      setFoco(false);
      setAtivo(-1);
    }
  };

  // a opção marcada pelo teclado fica à vista dentro da lista
  useEffect(() => {
    if (ativo < 0) return;
    document.getElementById(`${uid}-op-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, uid]);

  const onBlur = (e: FE<HTMLDivElement>) => {
    if (!raiz.current?.contains(e.relatedTarget as Node | null)) {
      setFoco(false);
      setAtivo(-1);
    }
  };

  const onSubmit = (e: FormE<HTMLFormElement>) => {
    if (!textoBusca) e.preventDefault();
    else guardarBusca(textoBusca);
  };
  const limparHistorico = () => {
    limparRecentes();
    setRecentes([]);
    setAtivo(-1);
    input.current?.focus();
  };

  const opcao = (op: Op, k: number) => {
    const comum = {
      id: `${uid}-op-${k}`,
      role: 'option',
      'aria-selected': ativo === k,
      onMouseEnter: () => setAtivo(k),
      onMouseDown: (e: { preventDefault: () => void }) => e.preventDefault(),
      onClick: () => escolher(op),
    } as const;
    const on = ativo === k ? ' on' : '';
    if (op.tipo === 'recente') {
      return (
        <li key={`r-${op.q}`} {...comum} className={`sb-op sb-recente${on}`}>
          <span className="sb-rec-ic"><IconeRelogio /></span>
          <span className="sb-rec-txt">{op.q}</span>
          <span className="sb-ir"><IconeSeta /></span>
        </li>
      );
    }
    if (op.tipo === 'atalho') {
      return (
        <li key={`a-${op.a.href}`} {...comum} className={`sb-op sb-atalho${on}`}>
          <span className="sb-foto sb-icone"><IconeSprite nome={op.a.tipo === 'sistema' ? 'garantia' : 'carro'} /></span>
          <span className="sb-txt">
            <b>{op.a.rot}</b>
            <small>{op.a.sub}</small>
          </span>
          <span className="sb-ir"><IconeSeta /></span>
        </li>
      );
    }
    if (op.tipo === 'item') {
      const it = op.it;
      return (
        <li key={it.id} {...comum} className={`sb-op${on}`}>
          <span className="sb-foto">
            {it.i && <img src={capaItem(it, 'E')} alt="" width={56} height={56} loading="lazy" decoding="async" />}
          </span>
          <span className="sb-txt">
            <b>{it.n}</b>
            {it.dif ? (
              <small className="sb-carro">
                <span className="sb-carro-nome">{carroAnos({ ...it, y: null })}</span>
                <span className="sb-dif">{it.dif}</span>
                {it.y && <span className="sb-carro-anos">· {anosTxt(it.y)}</span>}
              </small>
            ) : <small>{carroAnos(it)}</small>}
          </span>
          <span className="sb-preco">{moeda.format(it.p)}</span>
        </li>
      );
    }
    if (op.tipo === 'patio') {
      // a última linha: um link de verdade (Tab chega nele; Enter e clique abrem o WhatsApp noutra aba), que também é
      // opção da lista (as setas chegam nele e Enter no campo clica nele)
      const { onClick: _semClique, ...semClique } = comum;
      return (
        <a key="patio" {...semClique} ref={patio} className={`sb-patio${on}`} href={linkPatio} target="_blank" rel="noopener"
           data-botao="procurar-patio" tabIndex={0}>
          <span className="sb-patio-ic"><IconeSprite nome="whats" /></span>
          <span className="sb-patio-txt">Não achou? A gente procura no pátio<span className="sr-only">, pelo WhatsApp</span></span>
          <IconeSeta />
        </a>
      );
    }
    const n = res?.total ?? 0;
    return (
      <div key="ver" {...comum} className={`sb-op sb-ver${on}`}>
        <span>
          {!res || erro ? `Buscar “${termoTela}” no catálogo`
            : res.aproximado ? (n === 1 ? 'Ver a peça parecida' : `Ver as ${n2(n)} peças parecidas`)
            : n === 1 ? 'Ver o resultado no catálogo' : `Ver todos os ${n2(n)} resultados`}
        </span>
        <IconeSeta />
      </div>
    );
  };
  // o pé preso no fim da lista: "Ver todos" e "Não achou?" (as peças rolam por baixo)
  const corpo = ops.map((op, k) => [op, k] as const).filter(([op]) => op.tipo === 'atalho' || op.tipo === 'item');
  const pe = ops.map((op, k) => [op, k] as const).filter(([op]) => op.tipo === 'ver' || op.tipo === 'patio');

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
          aria-expanded={listaAberta}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={listaAberta && ativo >= 0 ? `${uid}-op-${ativo}` : undefined}
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
            setRecentes(lerRecentes());
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
        <button type="submit" className="botao botao-laranja botao-buscar sb-btn" aria-label="Buscar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-3.6-3.6" />
          </svg>
          <span>Buscar</span>
        </button>
      </form>

      <p className="sr-only" role="status">{anuncio}</p>
      {abertoRecentes && (
        <div className="sb-lista" ref={lista}>
          <div className="sb-rec-topo">
            <span id={`${uid}-rec`}>Buscas recentes</span>
            <button type="button" className="sb-rec-limpar" aria-label="Limpar as buscas recentes" onMouseDown={(e) => e.preventDefault()} onClick={limparHistorico}>Limpar</button>
          </div>
          <ul id={listaId} role="listbox" aria-labelledby={`${uid}-rec`}>
            {ops.map((op, k) => opcao(op, k))}
          </ul>
        </div>
      )}
      {aberto && (
        <div className="sb-lista" ref={lista}>
          {mostraCarregando && (
            <p className="sb-status"><span className="sb-giro" aria-hidden="true" />Carregando as peças…</p>
          )}
          {erro && (
            <p className="sb-status sb-status-erro">
              <span>Não deu para carregar a busca agora.</span>
              <button type="button" className="sb-tentar" onClick={carregar}>Tentar de novo</button>
            </p>
          )}
          {/* só com parecida na lista: sem nenhuma, a frase de baixo ("Nada com…") já diz tudo (revisão 14, P2-7) */}
          {res?.aproximado && !semResultado && itens.length > 0 && (
            <p className="sb-status sb-status-aprox">Nada exato com “{termoTela}”. {itens.length === 1 ? 'Esta é a parecida:' : 'Estas são as parecidas:'}</p>
          )}
          {semResultado && (
            <p className="sb-status">
              Nada com “{termoTela}” no site.{!res?.carros.length && ' Tente o modelo do carro ou o código gravado.'}
            </p>
          )}
          <ul id={listaId} role="listbox" aria-label="Sugestões de peças">
            {corpo.map(([op, k]) => opcao(op, k))}
            {pe.length > 0 && <li role="none" className="sb-pe">{pe.map(([op, k]) => opcao(op, k))}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
